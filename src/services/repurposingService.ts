import { prisma } from '../lib/prisma';
import { analyzeTranscript, MissingApiKeyError, type AnalyzedClip, type AnalyzeOptions } from './analyzerService';
import {
  fetchYouTubeVideo,
  fetchYouTubeMetadata,
  isYouTubeUrl,
  segmentPastedTranscript,
  type TranscriptSegment,
} from './youtubeService';
import { describeLlmError } from '../lib/llm';
import {
  startRenderJob,
  getRenderJobStatus,
  renderWorkerConfigured,
  startTranscriptJob,
  getTranscriptJobStatus,
  warmUpWorker,
  type RenderJobStatus,
} from '../lib/renderWorker';

export interface RunConfig {
  /** Platforms to generate captions for. Defaults to all five. */
  platforms?: string[];
  /** Target export orientations, stored on each clip. Defaults to all three. */
  orientations?: string[];
  /** "Dynamic Pop" or "Minimalist". */
  captionStyle?: string;
}

export interface IngestOptions extends RunConfig {
  title?: string;
  sourceVideoUrl?: string;
  sourceType?: 'upload' | 'youtube' | 'drive' | 'zoom';
  transcriptText?: string;
  desiredClipCount?: number;
}

const DEFAULT_ORIENTATIONS = ['9:16', '1:1', '16:9'];

/**
 * Real analysis pipeline:
 *   YouTube link  ->  fetch metadata + captions  ->  AI highlight detection
 *                 ->  persist Project + Clips (with real timestamps + native copy)
 *
 * No video is downloaded and no frames are rendered here — that belongs to the
 * separate media worker. Clips are created with status "candidate" / videoUrl null.
 */
export class RepurposingService {
  static async ingestVideo(options: IngestOptions) {
    const url = (options.sourceVideoUrl || '').trim();
    const config: RunConfig = {
      platforms: options.platforms,
      orientations: options.orientations,
      captionStyle: options.captionStyle,
    };

    if (url && isYouTubeUrl(url)) {
      return this.ingestYouTube(url, options.desiredClipCount ?? 5, config);
    }

    if (options.transcriptText && options.transcriptText.trim().length > 200) {
      return this.ingestPastedTranscript(
        options.title || 'Pasted transcript',
        options.transcriptText.trim(),
        options.desiredClipCount ?? 5,
        config
      );
    }

    throw new Error(
      'Paste a YouTube link (with captions) or a full transcript. Direct file analysis needs the media worker, which is not enabled on this deployment.'
    );
  }

  static async ingestYouTube(url: string, desiredClipCount = 5, config: RunConfig = {}) {
    // Direct transcript fetch usually fails (YouTube blocks it from cloud
    // IPs) and falls back to the worker — start waking it from Render's
    // free-tier idle spin-down now, in parallel with that doomed attempt,
    // instead of paying the full cold-start cost only once we know we need it.
    if (renderWorkerConfigured()) warmUpWorker();

    let video;
    try {
      video = await fetchYouTubeVideo(url);
    } catch (err) {
      // Direct transcript fetch failed — almost always YouTube's bot detection
      // blocking this from a cloud IP. If the render worker is configured, it
      // can transcribe the audio itself (as a background job, since that can
      // take far longer than this request should wait). Otherwise, surface
      // the original error.
      if (!renderWorkerConfigured()) throw err;
      return this.ingestYouTubeAsync(url, desiredClipCount, config);
    }

    const project = await prisma.project.create({
      data: {
        title: video.title,
        sourceVideoUrl: video.url,
        sourceVideoId: video.videoId,
        sourceType: 'youtube',
        channel: video.author,
        thumbnail: video.thumbnail,
        transcript: video.fullText,
        transcriptJson: JSON.stringify(video.transcript),
        duration: video.durationSeconds,
        status: 'processing',
        metadata: JSON.stringify({
          transcriptSource: video.transcriptSource,
          segmentCount: video.transcript.length,
          ingestedAt: new Date().toISOString(),
        }),
      },
    });

    try {
      const highlights = await analyzeTranscript(video, desiredClipCount, config);
      const clips = await this.persistClips(project.id, highlights, config);
      const updated = await prisma.project.update({
        where: { id: project.id },
        data: { status: 'ready' },
      });
      return { project: updated, clips, transcribing: false as const };
    } catch (err) {
      const message = err instanceof MissingApiKeyError ? err.message : describeLlmError(err);
      await prisma.project.update({
        where: { id: project.id },
        data: { status: 'failed', errorMessage: message },
      });
      throw new Error(
        err instanceof MissingApiKeyError
          ? `Fetched the transcript for "${video.title}", but ${message}`
          : message
      );
    }
  }

  /**
   * Creates the Project from metadata alone and kicks off worker-side
   * transcription as a background job. The project sits in status
   * "transcribing" until pollTranscription() picks up the finished result.
   */
  private static async ingestYouTubeAsync(url: string, desiredClipCount: number, config: RunConfig) {
    const meta = await fetchYouTubeMetadata(url);
    const jobId = await startTranscriptJob(meta.url);
    if (!jobId) {
      throw new Error('Could not start transcription — the render worker is not reachable.');
    }

    const project = await prisma.project.create({
      data: {
        title: meta.title,
        sourceVideoUrl: meta.url,
        sourceVideoId: meta.videoId,
        sourceType: 'youtube',
        channel: meta.author,
        thumbnail: meta.thumbnail,
        status: 'transcribing',
        transcriptJobId: jobId,
        metadata: JSON.stringify({ desiredClipCount, config, ingestedAt: new Date().toISOString() }),
      },
    });

    return { project, clips: [] as never[], transcribing: true as const };
  }

  /**
   * Checks a worker transcription job and, once it finishes, runs analysis
   * and persists clips — same end state as the synchronous ingestYouTube
   * path, just split across polls. Safe to call repeatedly; once the project
   * is out of "transcribing" it just returns the current state.
   */
  static async pollTranscription(projectId: string, options: { autoQueue?: boolean } = {}) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new Error('Project not found.');

    if (project.status !== 'transcribing') {
      const clips = await prisma.clip.findMany({ where: { projectId }, orderBy: { viralityScore: 'desc' } });
      return { status: project.status as 'processing' | 'ready' | 'failed', project, clips };
    }
    if (!project.transcriptJobId) {
      throw new Error('This project has no transcription job to check.');
    }

    let jobStatus;
    try {
      jobStatus = await getTranscriptJobStatus(project.transcriptJobId);
    } catch (err) {
      // Jobs live in the worker's memory, so a worker restart/redeploy (or
      // the 1h result retention running out) loses them for good — without
      // this the project would sit in "transcribing" forever.
      if (err instanceof Error && /unknown or expired job/i.test(err.message)) {
        const updated = await prisma.project.update({
          where: { id: projectId },
          data: {
            status: 'failed',
            errorMessage: 'The transcription job was lost (the render worker restarted or the result expired). Add the video again to retry.',
          },
        });
        return { status: 'failed' as const, project: updated, clips: [] as never[] };
      }
      throw err;
    }
    if (jobStatus.status === 'processing') {
      return { status: 'transcribing' as const, project, clips: [] as never[] };
    }
    if (jobStatus.status === 'error') {
      const updated = await prisma.project.update({
        where: { id: projectId },
        data: { status: 'failed', errorMessage: jobStatus.error },
      });
      // The one failure mode that needs a human to actually do something
      // (re-export the worker's YouTube cookies) — alert proactively rather
      // than letting it surface only as a UI error someone has to notice.
      if (/signed-in session|cookies/i.test(jobStatus.error)) {
        const { NotificationService } = await import('./notifications');
        await NotificationService.sendDiscordNotification(
          'YouTube session expired',
          `Transcription for "${project.title}" failed: the render worker's YouTube cookies need to be refreshed. Export a fresh cookies.txt and update the worker's Secret File.`,
          'error'
        );
      }
      return { status: 'failed' as const, project: updated, clips: [] as never[] };
    }

    // done — build the same "video" shape analyzeTranscript expects and finish exactly like the sync path.
    const segments: TranscriptSegment[] = jobStatus.transcript;
    const fullText = segments.map((s) => s.text).join(' ');
    const durationSeconds = segments.length ? Math.ceil(segments[segments.length - 1].end) : 0;

    // Claim the project before analyzing: polls can overlap (the tab's poll
    // loop, a "Check now" click, a second tab), and each would otherwise run
    // its own analysis and persist a duplicate set of clips. Saving the
    // transcript here also means Re-analyze works if the analysis fails.
    const claimed = await prisma.project.updateMany({
      where: { id: projectId, status: 'transcribing' },
      data: {
        status: 'processing',
        duration: durationSeconds,
        transcript: fullText,
        transcriptJson: JSON.stringify(segments),
      },
    });
    if (claimed.count === 0) {
      const current = await prisma.project.findUnique({ where: { id: projectId } });
      const clips = await prisma.clip.findMany({ where: { projectId }, orderBy: { viralityScore: 'desc' } });
      return { status: (current?.status ?? 'processing') as 'processing' | 'ready' | 'failed', project: current ?? project, clips };
    }

    let meta: { desiredClipCount?: number; config?: RunConfig } = {};
    try {
      meta = project.metadata ? JSON.parse(project.metadata) : {};
    } catch {
      /* ignore malformed metadata, use defaults */
    }

    const video = {
      videoId: project.sourceVideoId || '',
      url: project.sourceVideoUrl || '',
      title: project.title,
      author: project.channel || 'Unknown',
      description: '',
      durationSeconds,
      thumbnail: project.thumbnail,
      transcript: segments,
      fullText,
      transcriptSource: 'captions' as const,
    };

    try {
      const highlights = await analyzeTranscript(video, meta.desiredClipCount ?? 5, meta.config ?? {});
      const clips = await this.persistClips(projectId, highlights, meta.config ?? {});
      const updated = await prisma.project.update({
        where: { id: projectId },
        data: { status: 'ready', errorMessage: null },
      });

      let queued = 0;
      if (options.autoQueue) {
        for (const clip of clips) {
          try {
            await this.queueClip(clip.id);
            queued += 1;
          } catch {
            /* keep going even if one clip fails to queue */
          }
        }
      }

      return { status: 'ready' as const, project: updated, clips, queued };
    } catch (err) {
      const message = err instanceof MissingApiKeyError ? err.message : describeLlmError(err);
      const updated = await prisma.project.update({
        where: { id: projectId },
        data: { status: 'failed', errorMessage: message },
      });
      return { status: 'failed' as const, project: updated, clips: [] as never[] };
    }
  }

  static async ingestPastedTranscript(title: string, text: string, desiredClipCount = 5, config: RunConfig = {}) {
    // Split into timed segments so each clip gets its own start/end and its
    // own slice of text (one giant segment gave every clip the whole transcript).
    const segments = segmentPastedTranscript(text);
    const approxDuration = Math.ceil(segments[segments.length - 1]?.end || 0);
    const video = {
      videoId: '',
      url: '',
      title,
      author: 'Transcript',
      description: '',
      durationSeconds: approxDuration,
      thumbnail: null,
      transcript: segments,
      fullText: segments.map((s) => s.text).join(' '),
      transcriptSource: 'captions' as const,
    };

    const project = await prisma.project.create({
      data: {
        title,
        sourceType: 'upload',
        transcript: text,
        transcriptJson: JSON.stringify(video.transcript),
        duration: approxDuration,
        status: 'processing',
      },
    });

    try {
      const highlights = await analyzeTranscript(video, desiredClipCount, config);
      const clips = await this.persistClips(project.id, highlights, config);
      const updated = await prisma.project.update({ where: { id: project.id }, data: { status: 'ready' } });
      return { project: updated, clips };
    } catch (err) {
      const message = err instanceof MissingApiKeyError ? err.message : describeLlmError(err);
      await prisma.project.update({ where: { id: project.id }, data: { status: 'failed', errorMessage: message } });
      throw new Error(message);
    }
  }

  private static async persistClips(projectId: string, highlights: AnalyzedClip[], config: RunConfig = {}) {
    const orientations = config.orientations?.length ? config.orientations : DEFAULT_ORIENTATIONS;
    const created = [];
    for (const h of highlights) {
      const clip = await prisma.clip.create({
        data: {
          projectId,
          title: h.title,
          startTime: h.startTime,
          endTime: h.endTime,
          duration: Math.round(h.endTime - h.startTime),
          viralityScore: h.viralityScore,
          reasoning: h.reasoning,
          hookType: h.hookType,
          aspectRatios: JSON.stringify(orientations),
          transcriptSegment: h.transcriptSegment,
          captionVersions: JSON.stringify(h.captions),
          status: 'candidate',
          videoUrl: null,
        },
      });
      created.push(clip);
    }
    return created;
  }

  /**
   * Re-run analysis on an existing project's stored transcript (e.g. after the
   * user adds an API key, or wants a different number of clips).
   */
  static async reanalyzeProject(projectId: string, desiredClipCount = 5, config: RunConfig = {}) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new Error('Project not found.');
    if (!project.transcriptJson) throw new Error('This project has no stored transcript to re-analyze.');

    const segments = JSON.parse(project.transcriptJson);
    const video = {
      videoId: project.sourceVideoId || '',
      url: project.sourceVideoUrl || '',
      title: project.title,
      author: project.channel || 'Unknown',
      description: '',
      durationSeconds: project.duration || 0,
      thumbnail: project.thumbnail,
      transcript: segments,
      fullText: project.transcript || '',
      transcriptSource: 'captions' as const,
    };

    const highlights = await analyzeTranscript(video, desiredClipCount, config);
    await prisma.clip.deleteMany({ where: { projectId, status: 'candidate' } });
    const clips = await this.persistClips(projectId, highlights, config);
    const updated = await prisma.project.update({ where: { id: projectId }, data: { status: 'ready', errorMessage: null } });
    return { project: updated, clips };
  }

  /**
   * Sends one analyzed clip to the human-review Approval Queue, generating
   * the SEO metadata from its captions. Shared by the manual "Send to queue"
   * button and the automatic-discovery pipeline.
   */
  static async queueClip(clipId: string) {
    const clip = await prisma.clip.findUnique({ where: { id: clipId }, include: { project: true } });
    if (!clip) throw new Error('Clip not found.');

    // Already waiting for review — don't create a second copy (double clicks,
    // or an Automatic run over a clip that was queued by hand).
    const alreadyQueued = await prisma.approvalQueue.findFirst({ where: { clipId, status: 'pending' } });
    if (alreadyQueued) {
      if (clip.status !== 'approved') await prisma.clip.update({ where: { id: clipId }, data: { status: 'approved' } });
      return clip;
    }

    let parsedCaptions: Record<string, string> = {};
    try {
      parsedCaptions = JSON.parse(clip.captionVersions);
    } catch {
      parsedCaptions = { instagram: clip.captionVersions };
    }

    await prisma.approvalQueue.create({
      data: {
        topic: `[Repurposed] ${clip.title}`,
        script: clip.transcriptSegment,
        visualPrompts: JSON.stringify([
          '9:16 vertical reframe with face-tracking',
          `Hormozi dynamic pop subtitles: ${clip.title}`,
        ]),
        captions: JSON.stringify([{ startTime: 0, endTime: clip.duration, text: clip.transcriptSegment.slice(0, 100) }]),
        seoTitle: parsedCaptions.youtube?.slice(0, 80) || clip.title,
        seoDescription: parsedCaptions.linkedin || parsedCaptions.instagram || clip.reasoning,
        seoTags: JSON.stringify(['shorts', 'viral', 'repurpose', 'clips']),
        status: 'pending',
        clipId: clip.id,
        renderStatus: 'pending',
      },
    });

    await prisma.clip.update({ where: { id: clipId }, data: { status: 'approved' } });
    return clip;
  }

  /**
   * Starts cutting the real clip on the standalone render worker (see
   * /worker). Rendering takes minutes, so this returns a job id to poll with
   * checkRender() — or the finished URL straight away if the worker is an
   * older synchronous build. Throws RenderWorkerNotConfiguredError if the
   * worker isn't wired up yet.
   */
  static async startRender(
    clipId: string,
    aspectRatio?: string,
    captionStyle?: string
  ): Promise<{ status: 'rendering'; jobId: string } | { status: 'done'; videoUrl: string }> {
    const clip = await prisma.clip.findUnique({ where: { id: clipId }, include: { project: true } });
    if (!clip) throw new Error('Clip not found.');
    if (!clip.project.sourceVideoUrl || clip.project.sourceType !== 'youtube') {
      throw new Error('This clip has no YouTube source to render from (it came from a pasted transcript).');
    }

    // Default to the clip's first chosen orientation and the workspace caption style.
    let ratio = RENDER_RATIOS.find((r) => r === aspectRatio);
    if (!ratio) {
      let chosen: string[] = [];
      try {
        chosen = JSON.parse(clip.aspectRatios);
      } catch {
        /* fall back to 9:16 */
      }
      ratio = RENDER_RATIOS.find((r) => chosen.includes(r)) ?? '9:16';
    }
    const style =
      captionStyle ||
      (await prisma.settings.findFirst({ where: { id: 'default' } }))?.captionStyle ||
      'Dynamic Pop';

    const started = await startRenderJob({
      clipId: clip.id,
      youtubeUrl: clip.project.sourceVideoUrl,
      startTime: clip.startTime,
      endTime: clip.endTime,
      aspectRatio: ratio,
      captionText: clip.transcriptSegment,
      captionStyle: style,
    });

    await prisma.approvalQueue.updateMany({
      where: { clipId, renderStatus: { in: ['pending', 'failed'] } },
      data: { renderStatus: 'rendering', renderError: null },
    });

    if ('videoUrl' in started) {
      await this.saveRender(clipId, { status: 'done', videoUrl: started.videoUrl });
      return { status: 'done', videoUrl: started.videoUrl };
    }
    return { status: 'rendering', jobId: started.jobId };
  }

  /** Polls a render job; once it finishes, saves the video URL onto the clip. */
  static async checkRender(clipId: string, jobId: string) {
    const job = await getRenderJobStatus(jobId);
    if (job.status === 'done' && job.clipId && job.clipId !== clipId) {
      throw new Error('That render job belongs to a different clip.');
    }
    await this.saveRender(clipId, job);
    return job;
  }

  private static async saveRender(clipId: string, job: RenderJobStatus) {
    if (job.status === 'done') {
      await prisma.clip.update({ where: { id: clipId }, data: { videoUrl: job.videoUrl } });
      await prisma.approvalQueue.updateMany({
        where: { clipId, renderStatus: { not: 'rendered' } },
        data: { renderStatus: 'rendered', renderError: null },
      });
    } else if (job.status === 'error') {
      await prisma.approvalQueue.updateMany({
        where: { clipId, renderStatus: 'rendering' },
        data: { renderStatus: 'failed', renderError: job.error },
      });
    }
  }
}

const RENDER_RATIOS = ['9:16', '1:1', '16:9'] as const;

export type { AnalyzeOptions };
