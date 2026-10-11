import { google } from 'googleapis';
import { prisma } from '../lib/prisma';
import { describeYouTubeError } from './youtubePublisher';
import { getYouTubeAuth, markConnectionError, YouTubeNotConnectedError } from './youtubeConnection';

export interface SyncResult {
  videosChecked: number;
  snapshotsSaved: number;
  /** Set when retention data couldn't be fetched (views/likes were still saved). */
  retentionNote?: string;
}

/**
 * Pulls the latest numbers for every clip this workspace published to
 * YouTube and stores a Metric snapshot for each: views/likes/comments from
 * the Data API, plus average percentage viewed from the Analytics API.
 */
export async function syncYouTubeMetrics(workspaceId: string): Promise<SyncResult> {
  const published = await prisma.schedule.findMany({
    where: { workspaceId, platform: 'youtube', status: 'published', postId: { not: null }, clipId: { not: null } },
    orderBy: { publishedTime: 'asc' },
  });
  if (published.length === 0) return { videosChecked: 0, snapshotsSaved: 0 };

  const auth = await getYouTubeAuth(workspaceId);
  const byVideo = new Map(published.map((p) => [p.postId as string, p]));
  const ids = [...byVideo.keys()];
  const youtube = google.youtube({ version: 'v3', auth });

  const stats = new Map<string, { views: number; likes: number; comments: number }>();
  try {
    for (let i = 0; i < ids.length; i += 50) {
      const res = await youtube.videos.list({ part: ['statistics'], id: ids.slice(i, i + 50) });
      for (const v of res.data.items || []) {
        if (!v.id) continue;
        stats.set(v.id, {
          views: Number(v.statistics?.viewCount || 0),
          likes: Number(v.statistics?.likeCount || 0),
          comments: Number(v.statistics?.commentCount || 0),
        });
      }
    }
  } catch (err) {
    const message = describeYouTubeError(err);
    if (/expired or was revoked/.test(message)) await markConnectionError(workspaceId, message, true);
    throw new Error(message);
  }

  const retention = new Map<string, number>();
  let retentionNote: string | undefined;
  try {
    const analytics = google.youtubeAnalytics({ version: 'v2', auth });
    const startDate = (published[0].publishedTime || published[0].createdAt).toISOString().slice(0, 10);
    for (let i = 0; i < ids.length; i += 200) {
      const res = await analytics.reports.query({
        ids: 'channel==MINE',
        startDate,
        endDate: new Date().toISOString().slice(0, 10),
        metrics: 'averageViewPercentage',
        dimensions: 'video',
        filters: `video==${ids.slice(i, i + 200).join(',')}`,
      });
      for (const row of res.data.rows || []) retention.set(String(row[0]), Number(row[1]));
    }
  } catch (err) {
    retentionNote = /insufficient|scope|forbidden|accessNotConfigured|has not been used/i.test(String((err as Error)?.message))
      ? 'Watch-through needs YouTube Analytics access — reconnect your channel in Settings and allow analytics.'
      : describeYouTubeError(err);
  }

  const rows = [...stats].map(([videoId, s]) => ({
    workspaceId,
    clipId: byVideo.get(videoId)!.clipId,
    platform: 'youtube',
    postId: videoId,
    views: s.views,
    likes: s.likes,
    comments: s.comments,
    watchThroughPct: retention.get(videoId) ?? null,
  }));
  if (rows.length) await prisma.metric.createMany({ data: rows });

  return { videosChecked: ids.length, snapshotsSaved: rows.length, retentionNote };
}

/** Daily cron: sync every workspace with a live connection. */
export async function syncAllWorkspaces() {
  const conns = await prisma.channelConnection.findMany({ where: { provider: 'youtube', status: 'active' }, select: { workspaceId: true } });
  let synced = 0;
  for (const { workspaceId } of conns) {
    try {
      await syncYouTubeMetrics(workspaceId);
      synced += 1;
    } catch (err) {
      if (!(err instanceof YouTubeNotConnectedError)) console.warn('[metrics] sync failed for', workspaceId, (err as Error).message);
    }
  }
  return synced;
}

export { YouTubeNotConnectedError };
