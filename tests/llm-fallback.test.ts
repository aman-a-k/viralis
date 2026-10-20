import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// The free-tier models are regularly overloaded or retired; getLlmClient's
// client must move on to the next model instead of failing the request.
describe('AI model fallback', () => {
  const env = { ...process.env };
  const calls: string[] = [];

  beforeEach(() => {
    vi.resetModules();
    calls.length = 0;
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'test-key';
    delete process.env.AI_MODEL;
  });
  afterEach(() => {
    process.env = { ...env };
    vi.unstubAllGlobals();
  });

  const reply = (content: string) =>
    Response.json({ id: 'x', object: 'chat.completion', created: 0, model: 'm', choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content } }] });

  it('falls through a retired model to the next one and remembers it', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
      const { model } = JSON.parse(String(init.body));
      calls.push(model);
      return model === 'gemini-3-flash-preview' ? Response.json({ error: { message: 'not found' } }, { status: 404 }) : reply(`hi from ${model}`);
    }));
    const { getLlmClient } = await import('@/lib/llm');
    const { client, model } = await getLlmClient();
    const res = await client.chat.completions.create({ model, messages: [{ role: 'user', content: 'hi' }] });
    expect(res.choices[0].message.content).toBe('hi from gemini-flash-lite-latest');
    expect(calls).toEqual(['gemini-3-flash-preview', 'gemini-flash-lite-latest']);

    // The next request goes straight to the model that worked.
    calls.length = 0;
    const again = await getLlmClient();
    await again.client.chat.completions.create({ model: again.model, messages: [{ role: 'user', content: 'hi' }] });
    expect(calls).toEqual(['gemini-flash-lite-latest']);
  });

  it('does not reroute on errors a different model would not fix', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
      calls.push(JSON.parse(String(init.body)).model);
      return Response.json({ error: { message: 'bad key' } }, { status: 401 });
    }));
    const { getLlmClient } = await import('@/lib/llm');
    const { client, model } = await getLlmClient();
    await expect(client.chat.completions.create({ model, messages: [{ role: 'user', content: 'hi' }] })).rejects.toMatchObject({ status: 401 });
    expect(calls).toEqual(['gemini-3-flash-preview']);
  });
});
