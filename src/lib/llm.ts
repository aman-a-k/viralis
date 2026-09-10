import OpenAI from 'openai';
import { prisma } from './prisma';

/**
 * Viralis talks to any OpenAI-compatible chat API. Pick a provider with
 * AI_PROVIDER (or the workspace Settings). All three of these expose a free
 * tier or free key:
 *
 *   gemini  — Google AI Studio key, no card, generous free tier   (recommended)
 *   groq    — Groq key, no card, very fast Llama models
 *   openai  — paid, but best quality
 */
export type AiProvider = 'openai' | 'gemini' | 'groq';

interface ProviderConfig {
  baseURL?: string;
  defaultModel: string;
  keyEnv: string;
  label: string;
  getKeyUrl: string;
}

export const PROVIDERS: Record<AiProvider, ProviderConfig> = {
  openai: {
    defaultModel: 'gpt-4o-mini',
    keyEnv: 'OPENAI_API_KEY',
    label: 'OpenAI',
    getKeyUrl: 'https://platform.openai.com/api-keys',
  },
  gemini: {
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    defaultModel: 'gemini-flash-latest',
    keyEnv: 'GEMINI_API_KEY',
    label: 'Google Gemini (free)',
    getKeyUrl: 'https://aistudio.google.com/apikey',
  },
  groq: {
    baseURL: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    keyEnv: 'GROQ_API_KEY',
    label: 'Groq (free)',
    getKeyUrl: 'https://console.groq.com/keys',
  },
};

export class MissingApiKeyError extends Error {
  constructor(public provider: AiProvider) {
    super(
      `No API key for ${PROVIDERS[provider].label}. Add one in Settings (get a free key at ${PROVIDERS[provider].getKeyUrl}).`
    );
    this.name = 'MissingApiKeyError';
  }
}

export interface LlmClient {
  client: OpenAI;
  model: string;
  provider: AiProvider;
}

function normalizeProvider(v: string | null | undefined): AiProvider {
  const p = (v || '').toLowerCase();
  return p === 'gemini' || p === 'groq' || p === 'openai' ? p : 'openai';
}

/** Resolve the AI provider + key from workspace Settings, falling back to env. */
export async function getLlmClient(): Promise<LlmClient> {
  const settings = await prisma.settings.findFirst({ where: { id: 'default' } });

  const provider = normalizeProvider(
    settings?.aiProvider || process.env.AI_PROVIDER || (process.env.GEMINI_API_KEY ? 'gemini' : 'openai')
  );
  const cfg = PROVIDERS[provider];

  const key =
    settings?.aiApiKey ||
    settings?.openAiKey || // legacy field
    process.env[cfg.keyEnv] ||
    process.env.OPENAI_API_KEY ||
    '';

  if (!key) throw new MissingApiKeyError(provider);

  const model = settings?.aiModel || process.env.AI_MODEL || cfg.defaultModel;

  return {
    client: new OpenAI({ apiKey: key, baseURL: cfg.baseURL }),
    model,
    provider,
  };
}
