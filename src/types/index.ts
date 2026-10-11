export interface TrendData {
  topic: string;
  score: number;
  keywords: string[];
}

export interface Scene {
  spokenText: string;
  bRollPrompt: string;
  durationEstimate?: number;
}

export interface GeneratedContent {
  script: string;
  captions: { startTime: number; endTime: number; text: string }[];
  visualPrompts: string[];
  scenes?: Scene[]; // Pro structure
  
  // Advanced SEO Metadata
  title?: string;
  description?: string;
  tags?: string[];
}

export interface PlatformCaptions {
  instagram: string;
  youtube: string;
  linkedin: string;
  twitter: string;
  tiktok: string;
}

export type ClipStatus = 'candidate' | 'in_review' | 'approved' | 'published' | 'rejected';
export type RenderStatus = 'queued' | 'rendering' | 'rendered' | 'failed' | 'stale' | 'expired' | null;

/** A clip as the API sends it to the browser (see serializeClip in pipeline.ts). */
export interface ClipData {
  id: string;
  projectId: string;
  title: string;
  startTime: number;
  endTime: number;
  duration: number;
  viralityScore: number;
  reasoning: string;
  hookType?: string | null;
  transcriptSegment: string;
  captionVersions: Partial<PlatformCaptions>;
  status: ClipStatus;
  renderStatus: RenderStatus;
  renderError?: string | null;
  renderedAspect?: string | null;
  hasRender: boolean;
  edited: boolean;
  cropX: number;
  layout: 'fill' | 'fit';
  captionPosition: 'top' | 'middle' | 'bottom';
  captionStyle: 'Dynamic Pop' | 'Minimalist';
  publishTitle: string;
  publishDescription: string;
  publishTags: string[];
  madeForKids: boolean;
  containsSyntheticMedia: boolean;
  publish: { status: string; postUrl: string | null; error: string | null } | null;
  updatedAt: string;
}

export type ProjectStatus = 'queued' | 'transcribing' | 'analyzing' | 'ready' | 'failed' | 'processing';

export interface ProjectData {
  id: string;
  title: string;
  sourceType: 'upload' | 'youtube' | 'transcript' | string;
  sourceVideoId?: string | null;
  sourceVideoUrl?: string | null;
  hasSourceMedia: boolean;
  channel?: string | null;
  thumbnail?: string | null;
  duration?: number | null;
  language?: string | null;
  status: ProjectStatus;
  stage?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
  clips: ClipData[];
}

export interface PlanSummary {
  id: string;
  name: string;
  source: 'subscription' | 'trial' | 'none' | 'unlimited';
  periodEnd: string | null;
  status: string | null;
  cancelAtPeriodEnd: boolean;
  maxSourceMinutes: number;
  maxUploadMb: number;
  limits: { sourceMinutes: number; exports: number };
  used: { sourceMinutes: number; exports: number };
}

export interface WorkspaceSettings {
  brandName: string;
  brandNiche: string;
  brandTone: string;
  targetAudience: string;
  captionStyle: string;
  defaultLanguage: string;
  defaultPlatforms: string[];
  defaultOrientations: string[];
}

export interface ApprovalItem {
  id: string;
  topic: string;
  script: string;
  visualPrompts: string;
  captions: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
  seoTags?: string | null;
  clipId?: string | null;
  createdAt: string;
}

export interface TrendRecord {
  id: string;
  topic: string;
  score: number;
  keywords: string;
  isViable: boolean;
  analysis: string | null;
  createdAt: string;
}

export interface DashboardData {
  user: { email: string | null; emailVerified: boolean; role: 'owner' | 'admin' | 'member'; isPlatformAdmin: boolean };
  workspace: { id: string; name: string; retentionDays: number };
  projects: ProjectData[];
  stats: { projects: number; clipsFound: number; clipsExported: number; clipsPublished: number; avgWatchThrough: number | null };
  plan: PlanSummary;
  channel: { connected: boolean; title?: string | null; status?: string; lastError?: string | null; legacy?: boolean };
  capabilities: { youtubeConnect: boolean; billing: boolean; email: boolean; storageAccess: 'private' | 'public' };
  settings: WorkspaceSettings;
  trends: TrendRecord[];
  approvalQueue: ApprovalItem[];
}

export interface TrendSignalData {
  id: string;
  niche: string;
  topic: string;
  trendingScore: number;
  format?: string | null;
  detectedAt: string;
}

export interface FeedbackLoopData {
  /** True when there's no real published-content performance data yet, so
   * every figure below is illustrative sample data, not the account's own
   * results. */
  isSampleData: boolean;
  /** null when clips have views but no retention data (needs YouTube Analytics access). */
  overallWatchThrough: number | null;
  clipsMeasured: number;
  totalViews: number;
  highPerformingHooks: string[];
  underperformingClips: {
    clipTitle: string;
    platform: string;
    views: number;
    watchThrough: number;
    rootCause: string;
  }[];
  /** Illustrative only — present in sample mode; nothing re-tunes the analyzer yet. */
  modelWeightAdjustments: {
    hookSpeedWeight: number;
    emotionalIntensityWeight: number;
    controversyWeight: number;
    nicheTopicRelevance: number;
  } | null;
  backCatalogSuggestions: {
    projectId: string;
    projectTitle: string;
    timestamp: string;
    suggestedAngle: string;
    matchingTrend: string;
  }[];
}
