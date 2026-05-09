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
