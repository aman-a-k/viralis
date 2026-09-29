import { google } from 'googleapis';
import { prisma } from '../lib/prisma';
import { describeYouTubeError, getYouTubeAuth, YouTubeNotConnectedError } from './youtubePublisher';

export interface SyncResult {
  videosChecked: number;
  snapshotsSaved: number;
  /** Set when retention data couldn't be fetched (views/likes were still saved). */
  retentionNote?: string;
}

/**
 * Pulls the latest numbers for every clip we've published to YouTube and
 * stores a Metric snapshot for each: views/likes/comments from the Data API,
 * plus average percentage viewed from the Analytics API when the connected
 * account granted that access. This is what the Learning Loop reads.
 */
export async function syncYouTubeMetrics(): Promise<SyncResult> {
  const published = await prisma.schedule.findMany({
    where: { platform: 'youtube', status: 'published', postId: { not: null }, clipId: { not: null } },
    orderBy: { publishedTime: 'asc' },
  });
  if (published.length === 0) return { videosChecked: 0, snapshotsSaved: 0 };

  const auth = await getYouTubeAuth();
  const byVideo = new Map(published.map((p) => [p.postId as string, p]));
  const ids = [...byVideo.keys()];
  const youtube = google.youtube({ version: 'v3', auth });

  const stats = new Map<string, { views: number; likes: number; comments: number }>();
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

  const retention = new Map<string, number>();
  let retentionNote: string | undefined;
  try {
    const analytics = google.youtubeAnalytics({ version: 'v2', auth });
    const startDate = (published[0].publishedTime || published[0].createdAt).toISOString().slice(0, 10);
    const res = await analytics.reports.query({
      ids: 'channel==MINE',
      startDate,
      endDate: new Date().toISOString().slice(0, 10),
      metrics: 'averageViewPercentage',
      dimensions: 'video',
      filters: `video==${ids.slice(0, 500).join(',')}`,
    });
    for (const row of res.data.rows || []) retention.set(String(row[0]), Number(row[1]));
  } catch (err) {
    retentionNote = /insufficient|scope|forbidden|accessNotConfigured|has not been used/i.test(String((err as Error)?.message))
      ? 'Watch-through needs YouTube Analytics access: enable the "YouTube Analytics API" in your Google Cloud project, then reconnect YouTube in Settings.'
      : describeYouTubeError(err);
  }

  let snapshotsSaved = 0;
  for (const [videoId, s] of stats) {
    const sched = byVideo.get(videoId)!;
    await prisma.metric.create({
      data: {
        clipId: sched.clipId,
        platform: 'youtube',
        postId: videoId,
        views: s.views,
        likes: s.likes,
        comments: s.comments,
        watchThroughPct: retention.get(videoId) ?? null,
      },
    });
    snapshotsSaved += 1;
  }

  return { videosChecked: ids.length, snapshotsSaved, retentionNote };
}

export { YouTubeNotConnectedError };
