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

export interface SettingsData {
  youtubeId: string;
  instagramId: string;
  hasOpenAi: boolean;
  openAiKey: string;
  youtubeClientId: string;
  youtubeClientSecret: string;
  hasYoutubeAuth: boolean;
  instagramAccessToken: string;
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
  aspectRatios: string[];
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
  status: 'processing' | 'ready' | 'failed';
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
  overallWatchThrough: number;
  highPerformingHooks: string[];
  underperformingClips: {
    clipTitle: string;
    platform: string;
    views: number;
    watchThrough: number;
    rootCause: string;
  }[];
  modelWeightAdjustments: {
    hookSpeedWeight: number; // e.g. +25%
    emotionalIntensityWeight: number; // e.g. +15%
    controversyWeight: number; // e.g. -10%
    nicheTopicRelevance: number; // e.g. +30%
  };
  backCatalogSuggestions: {
    projectId: string;
    projectTitle: string;
    timestamp: string;
    suggestedAngle: string;
    matchingTrend: string;
  }[];
}
