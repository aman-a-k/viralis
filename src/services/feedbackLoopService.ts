import { prisma } from '../lib/prisma';
import { humanizeHook } from '../lib/hookLabels';
import { FeedbackLoopData } from '../types';

const UNDERPERFORMING_WATCH_PCT = 55;

// Shown only while there are no real Metric rows, behind a "Sample data"
// banner. Deliberately uses made-up titles so it can't be mistaken for
// anything about the user's own projects.
const SAMPLE_REPORT: FeedbackLoopData = {
  isSampleData: true,
  overallWatchThrough: 74,
  clipsMeasured: 0,
  totalViews: 0,
  highPerformingHooks: [
    'Surprising take — 88% avg watch-through',
    'Step-by-step — 84% avg watch-through',
    'Quick fact — 81% avg watch-through',
  ],
  underperformingClips: [
    { clipTitle: 'Why Most Teams Struggle with Scaling', platform: 'instagram', views: 840, watchThrough: 38, rootCause: 'hook too slow (drop-off before 3s)' },
    { clipTitle: 'Deep Technical Architecture Breakdown', platform: 'tiktok', views: 420, watchThrough: 31, rootCause: 'wrong platform fit (too academic for TikTok)' },
  ],
  modelWeightAdjustments: {
    hookSpeedWeight: 28,
    emotionalIntensityWeight: 18,
    controversyWeight: -12,
    nicheTopicRelevance: 35,
  },
  backCatalogSuggestions: [
    { projectId: 'sample-1', projectTitle: 'The Future of Scalable Automation', timestamp: '08:15 - 09:20', suggestedAngle: 'Cut the 45-second prediction on agentic workflow consolidation', matchingTrend: '#AgenticAI #AutonomousSystems' },
    { projectId: 'sample-2', projectTitle: 'Creator Distribution Masterclass', timestamp: '14:30 - 15:15', suggestedAngle: 'Highlight why raw cross-posting destroys reach', matchingTrend: '#CreatorEconomy #ShortFormContent' },
  ],
};

function likelyCause(clip: { duration: number; viralityScore: number }) {
  if (clip.viralityScore < 85) return 'likely a weak hook — the analyzer scored it low';
  if (clip.duration > 70) return 'likely pacing — long clips lose viewers mid-way';
  return 'likely a slow opening — viewers left early';
}

interface LatestMetric {
  clipId: string;
  platform: string;
  views: number;
  watchThroughPct: number | null;
  rootCauseTag: string | null;
  title: string;
  duration: number;
  viralityScore: number;
  hookType: string | null;
}

/**
 * The newest snapshot per clip+platform for a workspace. Repeated daily
 * syncs store a row each time; only the latest describes the clip now.
 */
async function latestMetrics(workspaceId: string): Promise<LatestMetric[]> {
  return prisma.$queryRaw<LatestMetric[]>`
    SELECT DISTINCT ON (m."clipId", m."platform")
      m."clipId", m."platform", m."views", m."watchThroughPct", m."rootCauseTag",
      c."title", c."duration", c."viralityScore", c."hookType"
    FROM "Metric" m
    JOIN "Clip" c ON c."id" = m."clipId"
    WHERE m."workspaceId" = ${workspaceId} AND m."clipId" IS NOT NULL
    ORDER BY m."clipId", m."platform", m."fetchedAt" DESC`;
}

function hookAverages(rows: LatestMetric[]) {
  const byHook = new Map<string, { total: number; count: number }>();
  for (const m of rows) {
    if (m.watchThroughPct === null) continue;
    const hook = m.hookType || 'other';
    const agg = byHook.get(hook) || { total: 0, count: 0 };
    agg.total += m.watchThroughPct;
    agg.count += 1;
    byHook.set(hook, agg);
  }
  return [...byHook.entries()]
    .map(([hook, { total, count }]) => ({ hook, avg: total / count, count }))
    .sort((a, b) => b.avg - a.avg);
}

export class FeedbackLoopService {
  static async getFeedbackLoopReport(workspaceId: string): Promise<FeedbackLoopData> {
    const measured = await latestMetrics(workspaceId);
    if (measured.length === 0) return SAMPLE_REPORT;

    // Watch-through needs YouTube Analytics access; snapshots without it
    // still count toward views but not toward retention figures.
    const withRetention = measured.filter((m) => m.watchThroughPct !== null);
    const watch = (m: LatestMetric) => m.watchThroughPct as number;

    const overallWatchThrough = withRetention.length
      ? Math.round(withRetention.reduce((sum, m) => sum + watch(m), 0) / withRetention.length)
      : null;

    const underperformingClips = withRetention
      .filter((m) => watch(m) < UNDERPERFORMING_WATCH_PCT)
      .sort((a, b) => watch(a) - watch(b))
      .slice(0, 4)
      .map((m) => ({
        clipTitle: m.title,
        platform: m.platform,
        views: m.views,
        watchThrough: Math.round(watch(m)),
        rootCause: m.rootCauseTag || likelyCause(m),
      }));

    const highPerformingHooks = hookAverages(measured)
      .slice(0, 3)
      .map(({ hook, avg, count }) =>
        `${humanizeHook(hook)} — ${Math.round(avg)}% avg watch-through (${count} clip${count === 1 ? '' : 's'})`
      );

    return {
      isSampleData: false,
      overallWatchThrough,
      clipsMeasured: new Set(measured.map((m) => m.clipId)).size,
      totalViews: measured.reduce((sum, m) => sum + m.views, 0),
      highPerformingHooks,
      underperformingClips,
      modelWeightAdjustments: null,
      backCatalogSuggestions: [],
    };
  }

  /**
   * One-line guidance for the clip finder, built from this workspace's own
   * published results — this is how measured performance feeds back into
   * which moments get picked next time. Null until there's enough data.
   */
  static async getPerformanceNotes(workspaceId: string): Promise<string | null> {
    const hooks = hookAverages(await latestMetrics(workspaceId)).filter((h) => h.count >= 2);
    if (hooks.length < 2) return null;
    const best = hooks[0];
    const worst = hooks[hooks.length - 1];
    if (best.avg - worst.avg < 8) return null;
    return `${humanizeHook(best.hook)} clips have held viewers best (${Math.round(best.avg)}% average watch-through) and ${humanizeHook(worst.hook).toLowerCase()} clips the least (${Math.round(worst.avg)}%). Prefer moments like the former when the content supports it.`;
  }
}
