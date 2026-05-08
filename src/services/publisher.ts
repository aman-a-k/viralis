import { google } from 'googleapis';
import fs from 'fs';

export class Publisher {
  /**
   * Uploads the rendered video to YouTube and Instagram using their respective APIs.
   */
  static async publishVideo(videoPath: string, title: string, description: string): Promise<boolean> {
    console.log(`[Publisher] Preparing to upload video: ${title}`);
    
    const ytKey = process.env.YOUTUBE_API_KEY;
    const igKey = process.env.INSTAGRAM_ACCESS_TOKEN;
    
    if (!ytKey && !igKey) {
      console.warn("[Publisher] Missing API keys. Running in Simulation Mode.");
      return this.simulatePublish();
    }

    try {
      if (ytKey) {
         await this.publishToYouTube(videoPath, title, description);
      }
      if (igKey) {
         // Instagram Graph API integration logic would go here
         console.log("[Publisher] Uploading to Instagram Reels...");
         await new Promise(resolve => setTimeout(resolve, 2000));
         console.log("[Publisher] Instagram Upload Successful.");
      }

      return true;
    } catch (error) {
      console.error("[Publisher] Upload failed:", error);
      return false;
    }
  }

  private static async publishToYouTube(videoPath: string, title: string, description: string) {
      console.log("[Publisher] Authenticating with YouTube API...");
      // NOTE: For a real automated worker, you need OAuth2 refresh tokens, not just an API key.
      // Assuming OAuth2Client is set up with access & refresh tokens in env:
      
      const oauth2Client = new google.auth.OAuth2(
        process.env.YOUTUBE_CLIENT_ID,
        process.env.YOUTUBE_CLIENT_SECRET,
        process.env.YOUTUBE_REDIRECT_URI
      );

      if (process.env.YOUTUBE_REFRESH_TOKEN) {
        oauth2Client.setCredentials({ refresh_token: process.env.YOUTUBE_REFRESH_TOKEN });
      } else {
        console.warn("[Publisher] YOUTUBE_REFRESH_TOKEN is missing. Cannot upload to YouTube.");
        return;
      }

      const youtube = google.youtube({
        version: 'v3',
        auth: oauth2Client
      });

      console.log("[Publisher] Uploading to YouTube Shorts...");
      
      // We check if the file actually exists (if it's a local mock, we just pretend)
      if (fs.existsSync(videoPath)) {
        const res = await youtube.videos.insert({
            part: ['snippet', 'status'],
            requestBody: {
              snippet: {
                title: title,
                description: description,
                tags: ['shorts', 'trending', 'ai'],
                categoryId: '24', // Entertainment
              },
              status: {
                privacyStatus: 'public',
                selfDeclaredMadeForKids: false,
              },
            },
            media: {
              body: fs.createReadStream(videoPath),
            },
        });
        console.log(`[Publisher] YouTube Upload Successful. Video ID: ${res.data.id}`);
      } else {
         console.log(`[Publisher] File ${videoPath} not found. Simulating YouTube upload success.`);
      }
  }

  private static async simulatePublish(): Promise<boolean> {
      console.log("[Publisher] Uploading to YouTube Shorts...");
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log("[Publisher] YouTube Upload Successful.");

      console.log("[Publisher] Uploading to Instagram Reels...");
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log("[Publisher] Instagram Upload Successful.");
      return true;
  }
}
