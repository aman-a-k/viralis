import OpenAI from 'openai';
import { TrendData } from './trendAnalyzer';

export interface GeneratedContent {
  script: string;
  captions: { startTime: number; endTime: number; text: string }[];
  visualPrompts: string[];
}

export class ContentGenerator {
  /**
   * Generates a video script, visual prompts, and precise English captions using OpenAI.
   */
  static async generateVideoContent(trend: TrendData): Promise<GeneratedContent> {
    console.log(`[ContentGenerator] Connecting to OpenAI for topic: ${trend.topic}`);

    const apiKey = process.env.OPENAI_API_KEY;
    
    // Fallback if no API key is present
    if (!apiKey) {
      console.warn("[ContentGenerator] OPENAI_API_KEY is missing. Using simulated response for demonstration.");
      return this.simulateGeneration(trend);
    }

    const openai = new OpenAI({ apiKey });

    try {
      const prompt = `
      You are an expert social media content creator. Your task is to generate a highly engaging, viral 60-second video script about "${trend.topic}".
      Related keywords: ${trend.keywords.join(", ")}
      
      Target audience: General internet users looking for entertainment and knowledge.
      Tone: Fast-paced, intriguing, and visually descriptive.
      
      You must return ONLY a raw JSON object (without markdown wrappers or codeblocks) with the following structure:
      {
        "script": "The full voiceover script.",
        "visualPrompts": ["Prompt 1 for 4K AI video generator", "Prompt 2", "Prompt 3"],
        "captions": [
          { "startTime": 0, "endTime": 2.5, "text": "Exact text matching script part 1" },
          { "startTime": 2.5, "endTime": 5.0, "text": "Exact text matching script part 2" }
        ]
      }
      `;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini", // Using mini for speed and cost, replace with gpt-4o for highest quality
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
      });

      const responseText = response.choices[0].message.content || "{}";
      const cleanedJSON = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      
      return JSON.parse(cleanedJSON) as GeneratedContent;
      
    } catch (error) {
      console.error("[ContentGenerator] OpenAI generation failed:", error);
      console.log("[ContentGenerator] Falling back to simulated generation.");
      return this.simulateGeneration(trend);
    }
  }

  private static async simulateGeneration(trend: TrendData): Promise<GeneratedContent> {
    await new Promise(resolve => setTimeout(resolve, 2000));
    return {
      script: `Did you know that ${trend.topic.toLowerCase()} is going viral right now? It's completely changing how we view the world! In just the last 24 hours, everyone is talking about ${trend.keywords[0] || 'this'}. Imagine a world where...`,
      visualPrompts: [
        `Cinematic 4K shot, hyperrealistic, wide angle, visualizing ${trend.keywords[0] || trend.topic}, dramatic lighting, Unreal Engine 5 render.`,
        `Close up dynamic shot, neon lights, futuristic interpretation of ${trend.topic}, 8k resolution, highly detailed.`
      ],
      captions: [
        { startTime: 0, endTime: 2.5, text: `Did you know that ${trend.topic.toLowerCase()}` },
        { startTime: 2.5, endTime: 5.0, text: "is going viral right now?" },
        { startTime: 5.0, endTime: 8.0, text: `Everyone is talking about ${trend.keywords[0] || 'this'}` }
      ]
    };
  }
}
