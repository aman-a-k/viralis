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

export class FeedbackLoopService {
  static async getFeedbackLoopReport(): Promise<FeedbackLoopData> {
    const metrics = await prisma.metric.findMany({
      orderBy: { fetchedAt: 'desc' },
      take: 500,
      include: { clip: { select: { id: true, title: true, duration: true, viralityScore: true, hookType: true } } },
    });

    if (metrics.length === 0) return SAMPLE_REPORT;

    // Latest snapshot per clip+platform, so repeated syncs don't double-count.
    const latest = new Map<string, (typeof metrics)[number]>();
    for (const m of metrics) {
      if (!m.clip) continue;
      const key = `${m.clip.id}:${m.platform}`;
      if (!latest.has(key)) latest.set(key, m);
    }
    const measured = [...latest.values()];
    // Watch-through needs YouTube Analytics access; snapshots without it
    // still count toward views but not toward retention figures.
    const withRetention = measured.filter((m) => m.watchThroughPct !== null);
    const watch = (m: (typeof metrics)[number]) => m.watchThroughPct as number;

    const overallWatchThrough = withRetention.length
      ? Math.round(withRetention.reduce((sum, m) => sum + watch(m), 0) / withRetention.length)
      : null;

    const underperformingClips = withRetention
      .filter((m) => watch(m) < UNDERPERFORMING_WATCH_PCT)
      .sort((a, b) => watch(a) - watch(b))
      .slice(0, 4)
      .map((m) => ({
        clipTitle: m.clip!.title,
        platform: m.platform,
        views: m.views,
        watchThrough: Math.round(watch(m)),
        rootCause: m.rootCauseTag || likelyCause(m.clip!),
      }));

    const byHook = new Map<string, { total: number; count: number }>();
    for (const m of withRetention) {
      const hook = m.clip!.hookType || 'other';
      const agg = byHook.get(hook) || { total: 0, count: 0 };
      agg.total += watch(m);
      agg.count += 1;
      byHook.set(hook, agg);
    }
    const highPerformingHooks = [...byHook.entries()]
      .map(([hook, { total, count }]) => ({ hook, avg: total / count, count }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 3)
      .map(({ hook, avg, count }) =>
        `${humanizeHook(hook)} — ${Math.round(avg)}% avg watch-through (${count} clip${count === 1 ? '' : 's'})`
      );

    return {
      isSampleData: false,
      overallWatchThrough,
      clipsMeasured: new Set(measured.map((m) => m.clip!.id)).size,
      totalViews: measured.reduce((sum, m) => sum + m.views, 0),
      highPerformingHooks,
      underperformingClips,
      modelWeightAdjustments: null,
      backCatalogSuggestions: [],
    };
  }
}
