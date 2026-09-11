import { prisma } from '../lib/prisma';
import { analyzeTranscript, MissingApiKeyError, type AnalyzedClip } from './analyzerService';
import { fetchYouTubeVideo, isYouTubeUrl } from './youtubeService';
import { describeLlmError } from '../lib/llm';

export interface IngestOptions {
  title?: string;
  sourceVideoUrl?: string;
  sourceType?: 'upload' | 'youtube' | 'drive' | 'zoom';
  transcriptText?: string;
  desiredClipCount?: number;
}

/**
 * Real analysis pipeline:
 *   YouTube link  ->  fetch metadata + captions  ->  AI highlight detection
 *                 ->  persist Project + Clips (with real timestamps + native copy)
 *
 * No video is downloaded and no frames are rendered here — that belongs to the
 * separate media worker. Clips are created with status "analyzed" / videoUrl null.
 */
export class RepurposingService {
  static async ingestVideo(options: IngestOptions) {
    const url = (options.sourceVideoUrl || '').trim();

    if (url && isYouTubeUrl(url)) {
      return this.ingestYouTube(url, options.desiredClipCount ?? 5);
    }

    if (options.transcriptText && options.transcriptText.trim().length > 200) {
      return this.ingestPastedTranscript(
        options.title || 'Pasted transcript',
        options.transcriptText.trim(),
        options.desiredClipCount ?? 5
      );
    }

    throw new Error(
      'Paste a YouTube link (with captions) or a full transcript. Direct file analysis needs the media worker, which is not enabled on this deployment.'
    );
  }

  static async ingestYouTube(url: string, desiredClipCount = 5) {
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
      const highlights = await analyzeTranscript(video, desiredClipCount);
      const clips = await this.persistClips(project.id, highlights);
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

  static async ingestPastedTranscript(title: string, text: string, desiredClipCount = 5) {

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
      const highlights = await analyzeTranscript(video, desiredClipCount);
      const clips = await this.persistClips(project.id, highlights);
      const updated = await prisma.project.update({ where: { id: project.id }, data: { status: 'ready' } });
      return { project: updated, clips };
    } catch (err) {
      const message = err instanceof MissingApiKeyError ? err.message : describeLlmError(err);
      await prisma.project.update({ where: { id: project.id }, data: { status: 'failed', errorMessage: message } });
      throw new Error(message);
    }
  }

  private static async persistClips(projectId: string, highlights: AnalyzedClip[]) {
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
          aspectRatios: JSON.stringify(['9:16', '1:1', '16:9']),
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
  static async reanalyzeProject(projectId: string, desiredClipCount = 5) {
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

    const highlights = await analyzeTranscript(video, desiredClipCount);
    await prisma.clip.deleteMany({ where: { projectId, status: 'candidate' } });
    const clips = await this.persistClips(projectId, highlights);
    await prisma.project.update({ where: { id: projectId }, data: { status: 'ready', errorMessage: null } });
    return { project, clips };
  }

  /** Video rendering is not available on this deployment (needs the media worker). */
  static async renderClip(): Promise<never> {
    throw new Error(
      'Clip rendering runs on the media worker, which is not enabled here. Use the timestamps and captions to cut the clip, or connect a worker.'
    );
  }
}
