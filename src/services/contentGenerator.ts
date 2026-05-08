import OpenAI from 'openai';
import { TrendData, GeneratedContent } from '../types';
import { prisma } from '../lib/prisma';

export class ContentGenerator {
  /**
   * Generates a video script, visual prompts, and precise English captions using OpenAI.
   */
  static async generateVideoContent(trend: TrendData): Promise<GeneratedContent> {
    console.log(`[ContentGenerator] Connecting to OpenAI for topic: ${trend.topic}`);

    const settings = await prisma.settings.findFirst({ where: { id: 'default' } });
    const apiKey = settings?.openAiKey || process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not configured. Please enter it in the Settings dashboard.");
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
      throw new Error("Failed to generate content. Please check your OpenAI API Key.");
    }
  }
}
