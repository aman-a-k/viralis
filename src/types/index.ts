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

// Secrets are never sent to the client — only whether one is saved.
export interface SettingsData {
  youtubeId: string;
  instagramId: string;
  brandName: string;
  brandTone: string;
  brandNiche: string;
  targetAudience: string;
  videoStyle: string;
  captionStyle: string;
  aiProvider: 'openai' | 'gemini' | 'groq';
  aiModel: string;
  hasAiKey: boolean;
  /** Where the active AI key comes from: saved in Settings, or the server env. */
  aiKeySource: 'settings' | 'env' | null;
  hasOpenAi: boolean;
  youtubeClientId: string;
  hasYoutubeClientSecret: boolean;
  hasYoutubeAuth: boolean;
  hasInstagramToken: boolean;
  hasDiscordWebhook: boolean;
  hasPexelsKey: boolean;
  hasElevenLabsKey: boolean;
  hasYoutubeDataKey: boolean;
  defaultPlatforms: string[];
  defaultOrientations: string[];
}

export interface ApprovalQueueItem {
  id: string;
  topic: string;
  script: string;
  visualPrompts: string;
  captions: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
  seoTags?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string | null;
  clipId?: string | null;
  renderStatus?: string | null;
  renderError?: string | null;
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

/** A clip with a real rendered file, for the Content Library. */
export interface RenderedClipData {
  id: string;
  projectId: string;
  title: string;
  startTime: number;
  endTime: number;
  duration: number;
  viralityScore: number;
  hookType?: string | null;
  videoUrl: string;
  status: string;
  createdAt: string;
  project: { title: string; thumbnail?: string | null };
}

export interface VideoData {
  id: string;
  topic: string;
  status: string;
  createdAt: string;
  views: number;
  likes: number;
}

export interface DashboardStats {
  totalGenerated: number;
  successCount: number;
  views: number;
  engagement: number;
  subs: number;
  revenue: number;
  /** null until at least one clip has real performance metrics. */
  avgWatchThrough?: number | null;
}

export interface AgentStatus {
  id: string;
  name: string;
  role: string;
  status: 'idle' | 'working' | 'error';
  lastAction: string;
  capabilities: string[];
}

export interface PlatformCaptions {
  instagram: string;
  youtube: string;
  linkedin: string;
  twitter: string;
  tiktok: string;
}

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
  aspectRatios: string[] | string;
  transcriptSegment: string;
  captionVersions: PlatformCaptions | string;
  videoUrl?: string | null;
  status: 'candidate' | 'approved' | 'scheduled' | 'published' | 'rejected';
  createdAt: string;
  metrics?: MetricData[];
}

export interface ProjectData {
  id: string;
  title: string;
  sourceVideoUrl?: string | null;
  sourceVideoId?: string | null;
  sourceType: 'upload' | 'youtube' | 'drive' | 'zoom';
  channel?: string | null;
  thumbnail?: string | null;
  transcript?: string | null;
  duration?: number | null;
  status: 'processing' | 'transcribing' | 'ready' | 'failed';
  errorMessage?: string | null;
  metadata?: string | null;
  createdAt: string;
  updatedAt: string;
  clips?: ClipData[];
}

export interface ScheduleData {
  id: string;
  clipId?: string | null;
  clip?: ClipData | null;
  platform: string;
  scheduledTime: string;
  publishedTime?: string | null;
  status: 'pending' | 'published' | 'failed';
  postId?: string | null;
}

export interface MetricData {
  id: string;
  clipId?: string | null;
  platform: string;
  views: number;
  likes: number;
  shares: number;
  comments: number;
  saves: number;
  watchThroughPct: number;
  rootCauseTag?: string | null;
  fetchedAt: string;
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
  overallWatchThrough: number;
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
