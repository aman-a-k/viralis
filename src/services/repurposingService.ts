import { prisma } from '../lib/prisma';
import { analyzeTranscript, MissingApiKeyError, type AnalyzedClip, type AnalyzeOptions } from './analyzerService';
import { fetchYouTubeVideo, isYouTubeUrl } from './youtubeService';
import { describeLlmError } from '../lib/llm';

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
    const video = await fetchYouTubeVideo(url);

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
      return { project: updated, clips };
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

  static async ingestPastedTranscript(title: string, text: string, desiredClipCount = 5, config: RunConfig = {}) {
    // Build a single-segment transcript so the analyzer has something to work with.
    const approxDuration = Math.max(120, Math.round(text.split(/\s+/).length / 2.5));
    const video = {
      videoId: '',
      url: '',
      title,
      author: 'Transcript',
      description: '',
      durationSeconds: approxDuration,
      thumbnail: null,
      transcript: [{ text, start: 0, end: approxDuration }],
      fullText: text,
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
    await prisma.project.update({ where: { id: projectId }, data: { status: 'ready', errorMessage: null } });
    return { project, clips };
  }

  /**
   * Sends one analyzed clip to the human-review Approval Queue, generating
   * the SEO metadata from its captions. Shared by the manual "Send to queue"
   * button and the automatic-discovery pipeline.
   */
  static async queueClip(clipId: string) {
    const clip = await prisma.clip.findUnique({ where: { id: clipId }, include: { project: true } });
    if (!clip) throw new Error('Clip not found.');

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
      },
    });

    await prisma.clip.update({ where: { id: clipId }, data: { status: 'approved' } });
    return clip;
  }

  /** Video rendering is not available on this deployment (needs the media worker). */
  static async renderClip(): Promise<never> {
    throw new Error(
      'Clip rendering runs on the media worker, which is not enabled here. Use the timestamps and captions to cut the clip, or connect a worker.'
    );
  }
}

export type { AnalyzeOptions };
