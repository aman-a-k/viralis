import OpenAI from 'openai';
import { prisma } from '../lib/prisma';

export interface AgentResponse {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

export abstract class BaseAgent {
  protected openai: OpenAI | null = null;
  protected name: string;
  protected role: string;

  constructor(name: string, role: string) {
    this.name = name;
    this.role = role;
  }

  protected async initOpenAI() {
    if (this.openai) return;

    const settings = await prisma.settings.findFirst({ where: { id: 'default' } });
    const apiKey = settings?.openAiKey || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error(`[${this.name}] OPENAI_API_KEY is not configured.`);
    }

    this.openai = new OpenAI({ apiKey });
  }

  /**
   * The core "thinking" method of the agent.
   * This should be implemented by subclasses to define how they process information.
   */
  abstract run(input: any): Promise<AgentResponse>;

  protected async chat(prompt: string, model: string = "gpt-4o-mini"): Promise<string> {
    await this.initOpenAI();
    if (!this.openai) throw new Error("OpenAI not initialized");

    const response = await this.openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: `You are ${this.name}, ${this.role}.` },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
    });

    return response.choices[0].message.content || "";
  }

  protected log(message: string) {
    console.log(`[Agent: ${this.name}] ${message}`);
  }
}
