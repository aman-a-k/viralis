import OpenAI from 'openai';

/**
 * Viralis talks to any OpenAI-compatible chat API. The provider and key are
 * platform configuration (AI_PROVIDER + the provider's key env var) —
 * customers never need an AI account. Supported:
 *
 *   gemini  — Google AI Studio key, no card, generous free tier   (recommended)
 *   groq    — Groq key, no card, very fast Llama models
 *   openai  — paid, but best quality
 */
export type AiProvider = 'openai' | 'gemini' | 'groq';

interface ProviderConfig {
  baseURL?: string;
  defaultModel: string;
  /** Tried in order when the default is overloaded, rate-limited or retired. */
  fallbackModels?: string[];
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
    defaultModel: 'gemini-3-flash-preview',
    fallbackModels: ['gemini-flash-lite-latest', 'gemini-flash-latest'],
    keyEnv: 'GEMINI_API_KEY',
    label: 'Google Gemini (free)',
    getKeyUrl: 'https://aistudio.google.com/apikey',
  },
  groq: {
    baseURL: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    fallbackModels: ['llama-3.1-8b-instant'],
    keyEnv: 'GROQ_API_KEY',
    label: 'Groq (free)',
    getKeyUrl: 'https://console.groq.com/keys',
  },
};

export class MissingApiKeyError extends Error {
  constructor(public provider: AiProvider) {
    super('The AI service isn’t configured on this server yet. Please contact support.');
    console.error(`[llm] ${PROVIDERS[provider].keyEnv} is not set (get a key at ${PROVIDERS[provider].getKeyUrl}).`);
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

export function aiConfigured(): boolean {
  const provider = normalizeProvider(process.env.AI_PROVIDER || (process.env.GEMINI_API_KEY ? 'gemini' : 'openai'));
  return Boolean(process.env[PROVIDERS[provider].keyEnv]);
}

/** The platform's AI client, from env. */
export async function getLlmClient(): Promise<LlmClient> {
  const provider = normalizeProvider(
    process.env.AI_PROVIDER || (process.env.GEMINI_API_KEY ? 'gemini' : 'openai')
  );
  const cfg = PROVIDERS[provider];
  const key = process.env[cfg.keyEnv] || '';
  if (!key) throw new MissingApiKeyError(provider);

  const client = new OpenAI({ apiKey: key, baseURL: cfg.baseURL, maxRetries: 1, timeout: 60_000 });
  const model = process.env.AI_MODEL || cfg.defaultModel;
  withModelFallback(client, provider, [model, ...(cfg.fallbackModels || [])]);
  return { client, model, provider };
}

// The model that last answered, per provider. A slow or retired model is
// skipped for a while instead of costing every request a timeout.
const preferred = new Map<AiProvider, { model: string; until: number }>();
const PREFER_MS = 10 * 60_000;

function isFallbackWorthy(err: unknown): boolean {
  if (err instanceof OpenAI.APIConnectionTimeoutError) return true;
  const status = (err as { status?: number })?.status;
  return status === 404 || status === 429 || (typeof status === 'number' && status >= 500);
}

/**
 * Makes `client.chat.completions.create` try the provider's models in order:
 * free-tier models are regularly overloaded (tens of seconds per reply) or
 * retired, and a request that waits on one blows the 60s function limit.
 */
function withModelFallback(client: OpenAI, provider: AiProvider, chain: string[]) {
  const models = [...new Set(chain)];
  const create = client.chat.completions.create.bind(client.chat.completions) as (
    p: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming,
    o?: OpenAI.RequestOptions
  ) => Promise<OpenAI.Chat.ChatCompletion>;

  const wrapped = async (params: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming, opts?: OpenAI.RequestOptions) => {
    // Only reroute calls made with the configured model.
    if (params.model !== models[0] || models.length === 1) return create(params, opts);
    const pref = preferred.get(provider);
    const order = pref && pref.until > Date.now() ? [pref.model, ...models.filter((m) => m !== pref.model)] : models;
    let lastErr: unknown;
    for (let i = 0; i < order.length; i++) {
      const last = i === order.length - 1;
      try {
        const res = await create(
          { ...params, model: order[i], ...(provider === 'gemini' && !params.reasoning_effort ? { reasoning_effort: 'low' as const } : {}) },
          { ...opts, timeout: last ? 45_000 : 25_000, maxRetries: last ? 1 : 0 }
        );
        if (order[i] !== models[0]) preferred.set(provider, { model: order[i], until: Date.now() + PREFER_MS });
        else preferred.delete(provider);
        return res;
      } catch (err) {
        lastErr = err;
        if (last || !isFallbackWorthy(err)) throw err;
        console.warn(`[llm] ${order[i]} failed (${(err as Error).message?.slice(0, 80)}); trying ${order[i + 1]}`);
      }
    }
    throw lastErr;
  };
  (client.chat.completions as unknown as { create: typeof wrapped }).create = wrapped;
}

/** Human-friendly message for the common LLM failures. */
export function describeLlmError(err: unknown): string {
  const status = (err as { status?: number })?.status;
  const msg = err instanceof Error ? err.message : String(err ?? '');
  const has = (code: number) => status === code || new RegExp(`\\b${code}\\b`).test(msg);

  if (err instanceof MissingApiKeyError) return err.message;
  if (has(429)) return 'Our AI service is busy right now. Try again in a minute.';
  if (has(503) || has(500)) return 'The AI service is temporarily overloaded. Try again in a moment.';
  if (has(401) || has(403)) {
    console.error('[llm] provider rejected the API key:', msg);
    return 'The AI service is unavailable right now. Please contact support if this continues.';
  }
  return msg || 'AI request failed.';
}
