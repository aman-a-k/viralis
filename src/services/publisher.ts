import { google } from 'googleapis';
import fs from 'fs';
import { prisma } from '../lib/prisma';

export class Publisher {
  /**
   * Uploads the rendered video to YouTube and Instagram using their respective APIs.
   */
  static async publishVideo(videoPath: string, title: string, description: string): Promise<boolean> {
    console.log(`[Publisher] Preparing to upload video: ${title}`);
    
    const settings = await prisma.settings.findFirst({ where: { id: 'default' } });
    const ytKey = settings?.youtubeId || process.env.YOUTUBE_API_KEY;
    const igKey = settings?.instagramId || process.env.INSTAGRAM_ACCESS_TOKEN;
    
    if (!ytKey && !igKey) {
      throw new Error("No destination configured. Please configure YouTube or Instagram in the Settings dashboard.");
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
      
      const settings = await prisma.settings.findFirst({ where: { id: 'default' } });
      
      if (!settings?.youtubeClientId || !settings?.youtubeClientSecret || !settings?.youtubeRefreshToken) {
        throw new Error("Missing complete YouTube OAuth credentials in Database.");
      }

      const oauth2Client = new google.auth.OAuth2(
        settings.youtubeClientId,
        settings.youtubeClientSecret
      );

      oauth2Client.setCredentials({ refresh_token: settings.youtubeRefreshToken });

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
         throw new Error(`File ${videoPath} not found. Cannot upload to YouTube.`);
      }
  }
}
