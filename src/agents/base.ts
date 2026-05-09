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

  protected async chat(prompt: string, model: string = "gpt-4o", tools?: OpenAI.Chat.Completions.ChatCompletionTool[]): Promise<any> {
    await this.initOpenAI();
    if (!this.openai) throw new Error("OpenAI not initialized");

    const response = await this.openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: `You are ${this.name}, ${this.role}. You have access to tools that you can call to perform actions. Always aim for high-quality, viral results.` },
        { role: "user", content: prompt }
      ],
      tools,
      tool_choice: tools ? "auto" : undefined,
      temperature: 0.7,
    });

    return response.choices[0].message;
  }

  protected async executeTool(toolCall: OpenAI.Chat.Completions.ChatCompletionMessageToolCall, toolHandlers: Record<string, Function>) {
    const name = toolCall.function.name;
    const args = JSON.parse(toolCall.function.arguments);
    
    this.log(`Executing tool: ${name} with args: ${JSON.stringify(args)}`);
    
    if (toolHandlers[name]) {
      return await toolHandlers[name](args);
    }
    
    throw new Error(`Tool ${name} not found.`);
  }

  protected log(message: string) {
    console.log(`[Agent: ${this.name}] ${message}`);
  }
}
