import { getLlmClient } from '../lib/llm';

export interface AgentResponse {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

export abstract class BaseAgent {
  protected name: string;
  protected role: string;

  constructor(name: string, role: string) {
    this.name = name;
    this.role = role;
  }

  abstract run(input: any): Promise<AgentResponse>;

  /** Plain-text completion. */
  protected async chat(prompt: string): Promise<string> {
    const { client, model } = await getLlmClient();
    const res = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: `You are ${this.name}, ${this.role}.` },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
    });
    return res.choices[0]?.message?.content || '';
  }

  /** JSON completion — asks for and parses a strict JSON object. */
  protected async chatJSON<T = any>(prompt: string): Promise<T> {
    const { client, model } = await getLlmClient();
    const res = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `You are ${this.name}, ${this.role}. Respond ONLY with a valid JSON object, no prose or code fences.`,
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });
    const raw = res.choices[0]?.message?.content || '{}';
    try {
      return JSON.parse(raw) as T;
    } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      if (!m) throw new Error(`[${this.name}] model returned non-JSON output.`);
      return JSON.parse(m[0]) as T;
    }
  }

  protected log(message: string) {
    console.log(`[Agent: ${this.name}] ${message}`);
  }
}
