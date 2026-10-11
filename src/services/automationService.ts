import { prisma } from '../lib/prisma';
import { fetchTrendingVideos, pickBestForNiche, type TrendingVideo } from './youtubeTrending';
import { ingestYouTube, type Actor, type RunConfig } from './pipeline';

export interface AutomationResult {
  video: TrendingVideo;
  projectId: string;
  projectTitle: string;
}

/**
 * One-click pipeline: pick a trending video that fits the workspace niche,
 * analyze it, and send every clip to the review queue. Nothing is published
 * — review is the human gate, and the customer has attested they have the
 * rights to reuse the chosen video before this runs.
 */
export async function runAutomaticDiscovery(
  actor: Actor,
  config: RunConfig & { clipCount: number; region?: string; category?: string; rightsConfirmed: boolean }
): Promise<AutomationResult> {
  const settings = await prisma.settings.findUnique({ where: { workspaceId: actor.workspaceId } });
  const niche = settings?.brandNiche || 'general interest';

  const { videos } = await fetchTrendingVideos({ regionCode: config.region, categoryId: config.category, maxResults: 15 });
  if (videos.length === 0) throw new Error('No trending videos returned right now — try again shortly.');

  const chosen = await pickBestForNiche(videos, niche);
  const project = await ingestYouTube(actor, {
    url: chosen.url,
    clipCount: config.clipCount,
    config: { platforms: config.platforms, orientations: config.orientations, captionStyle: config.captionStyle, language: config.language },
    rightsConfirmed: config.rightsConfirmed,
    autoQueue: true,
  });
  return { video: chosen, projectId: project.id, projectTitle: project.title };
}
