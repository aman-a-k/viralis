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

function asProvider(v: string | null | undefined): AiProvider | null {
  const p = (v || '').toLowerCase();
  return p === 'gemini' || p === 'groq' || p === 'openai' ? p : null;
}

export interface LlmConfig {
  provider: AiProvider;
  /** Empty when no key is configured anywhere. */
  key: string;
  model: string;
  keySource: 'settings' | 'env' | null;
}

/**
 * Works out which provider + key to use. A key saved in Settings always goes
 * with the provider picked next to it. Otherwise it falls back to whichever
 * provider has a key in the server environment — a key is never sent to a
 * provider it doesn't belong to (Settings.aiProvider defaults to "gemini" in
 * the database, which used to route an env OPENAI_API_KEY to Gemini).
 */
export async function resolveLlmConfig(): Promise<LlmConfig> {
  const settings = await prisma.settings.findFirst({ where: { id: 'default' } });
  const savedProvider = asProvider(settings?.aiProvider);
  const envProvider = asProvider(process.env.AI_PROVIDER);

  const modelFor = (provider: AiProvider, fromSettings: boolean) =>
    (fromSettings && settings?.aiModel) ||
    (provider === envProvider && process.env.AI_MODEL) ||
    PROVIDERS[provider].defaultModel;

  if (settings?.aiApiKey) {
    const provider = savedProvider || envProvider || 'gemini';
    return { provider, key: settings.aiApiKey, model: modelFor(provider, true), keySource: 'settings' };
  }
  if (settings?.openAiKey) {
    // Legacy field — always an OpenAI key.
    return { provider: 'openai', key: settings.openAiKey, model: modelFor('openai', savedProvider === 'openai'), keySource: 'settings' };
  }

  const candidates = [envProvider, savedProvider, 'gemini', 'groq', 'openai'] as (AiProvider | null)[];
  for (const provider of candidates) {
    if (!provider) continue;
    const key = process.env[PROVIDERS[provider].keyEnv];
    if (key) return { provider, key, model: modelFor(provider, provider === savedProvider), keySource: 'env' };
  }

  const provider = savedProvider || envProvider || 'gemini';
  return { provider, key: '', model: modelFor(provider, true), keySource: null };
}

/** Resolve the AI provider + key from workspace Settings, falling back to env. */
export async function getLlmClient(): Promise<LlmClient> {
  const { provider, key, model } = await resolveLlmConfig();
  if (!key) throw new MissingApiKeyError(provider);
  const cfg = PROVIDERS[provider];

  return {
    client: new OpenAI({
      apiKey: key,
      baseURL: cfg.baseURL,
      maxRetries: 4, // SDK backs off on 429/503
      timeout: 60_000,
    }),
    model,
    provider,
  };
}

/** Human-friendly message for the common LLM failures. */
export function describeLlmError(err: unknown): string {
  const status = (err as { status?: number })?.status;
  const msg = err instanceof Error ? err.message : String(err ?? '');
  const has = (code: number) => status === code || new RegExp(`\\b${code}\\b`).test(msg);

  if (has(429))
    return "The AI provider hit its rate/quota limit. Free tiers allow ~10–15 requests/min and a daily cap — wait a bit, or switch provider in Settings.";
  if (has(503) || has(500))
    return 'The AI provider is temporarily overloaded. Try again in a moment.';
  if (has(401) || has(403))
    return 'The AI API key was rejected. Check it in Settings.';
  if (has(404))
    return 'The AI provider doesn’t recognize that model. Clear the Model field in Settings to use the default.';
  if (has(400))
    return 'The AI provider rejected the request — usually the key belongs to a different provider than the one selected, or the model name is wrong. Check Settings → AI Engine.';
  return msg || 'AI request failed.';
}
