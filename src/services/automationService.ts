import { prisma } from '../lib/prisma';
import { fetchTrendingVideos, pickBestForNiche, type TrendingVideo } from './youtubeTrending';
import { RepurposingService, type RunConfig } from './repurposingService';

export interface AutomationResult {
  video: TrendingVideo;
  projectId: string;
  projectTitle: string;
  clipsCreated: number;
  clipsQueued: number;
  /** True when transcription is still running in the background — the
   * caller should poll /api/repurpose/poll with autoQueue:true. */
  transcribing?: boolean;
}

/**
 * Zero-click pipeline: find a real trending video for the workspace niche,
 * analyze it, and drop every clip straight into the Approval Queue. Nothing
 * is published — the Approval Queue is the human review gate before anything
 * goes out, same as a manually-run analysis.
 */
export async function runAutomaticDiscovery(
  config: RunConfig & { clipCount?: number; region?: string; category?: string } = {}
): Promise<AutomationResult> {
  const settings = await prisma.settings.findFirst({ where: { id: 'default' } });
  const niche = settings?.brandNiche || 'technology and internet culture';

  const videos = await fetchTrendingVideos({
    regionCode: config.region,
    categoryId: config.category,
    maxResults: 15,
  });
  if (videos.length === 0) throw new Error('No trending videos returned right now — try again shortly.');

  const chosen = await pickBestForNiche(videos, niche);

  const result = await RepurposingService.ingestYouTube(chosen.url, config.clipCount ?? 5, {
    platforms: config.platforms,
    orientations: config.orientations,
    captionStyle: config.captionStyle,
  });

  if ('transcribing' in result && result.transcribing) {
    return {
      video: chosen,
      projectId: result.project.id,
      projectTitle: result.project.title,
      clipsCreated: 0,
      clipsQueued: 0,
      transcribing: true,
    };
  }

  const { project, clips } = result;
  let queued = 0;
  for (const clip of clips) {
    try {
      await RepurposingService.queueClip(clip.id);
      queued += 1;
    } catch {
      /* keep going even if one clip fails to queue */
    }
  }

  return {
    video: chosen,
    projectId: project.id,
    projectTitle: project.title,
    clipsCreated: clips.length,
    clipsQueued: queued,
  };
}
