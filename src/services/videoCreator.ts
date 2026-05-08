import { GeneratedContent } from '../types';
import * as googleTTS from 'google-tts-api';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import fs from 'fs';
import path from 'path';

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

export class VideoCreator {
  /**
   * Actually renders an .mp4 video using fluent-ffmpeg and google-tts-api.
   */
  static async renderVideo(content: GeneratedContent): Promise<string> {
    console.log("[VideoCreator] Initializing real Video Render Pipeline...");
    
    const outputDir = path.join(process.cwd(), 'public', 'renders');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = Date.now();
    const audioPath = path.join(outputDir, `audio_${timestamp}.mp3`);
    const outputPath = path.join(outputDir, `output_${timestamp}.mp4`);

    console.log("[VideoCreator] Generating full Text-to-Speech audio...");
    
    try {
      // 1. Generate FULL TTS from script using chunking
      const audioChunks = await googleTTS.getAllAudioBase64(content.script, {
        lang: 'en',
        slow: false,
        host: 'https://translate.google.com',
        splitPunct: ',.?'
      });
      
      // Combine base64 chunks into a single audio buffer
      const audioBuffer = Buffer.concat(
        audioChunks.map(chunk => Buffer.from(chunk.base64, 'base64'))
      );
      
      fs.writeFileSync(audioPath, audioBuffer);
      console.log(`[VideoCreator] Full audio saved to ${audioPath}`);
      
      // 2. Generate a basic video
      // For production, we use a deep purple background instead of plain black for better aesthetics.
      console.log("[VideoCreator] Rendering final .mp4 using FFmpeg...");
      
      await new Promise<void>((resolve, reject) => {
        ffmpeg()
          .input('color=c=#1e1b4b:s=1080x1920:r=30') // Vertical Shorts format
          .inputFormat('lavfi')
          .input(audioPath)
          .outputOptions([
            '-c:v libx264',
            '-tune stillimage',
            '-c:a aac',
            '-b:a 192k',
            '-pix_fmt yuv420p',
            '-shortest', // End when the shortest stream (audio) ends
          ])
          // Add text overlay (simulating captions)
          .videoFilters([{
            filter: 'drawtext',
            options: {
              text: 'Trending Now!',
              fontsize: 80,
              fontcolor: 'white',
              x: '(w-text_w)/2',
              y: '(h-text_h)/2',
              box: 1,
              boxcolor: 'black@0.5',
              boxborderw: 10
            }
          }])
          .save(outputPath)
          .on('end', () => {
            console.log('[VideoCreator] FFmpeg rendering finished.');
            resolve();
          })
          .on('error', (err) => {
            console.error('[VideoCreator] FFmpeg error:', err);
            reject(err);
          });
      });

      console.log(`[VideoCreator] Render complete. Video available at: ${outputPath}`);
      
      // Clean up temp files
      if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);

      return outputPath;
    } catch (error) {
      console.error("[VideoCreator] Real rendering failed.", error);
      throw new Error("Video rendering failed due to missing dependencies or FFmpeg error.");
    }
  }
}
