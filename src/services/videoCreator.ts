import { GeneratedContent, Scene } from '../types';
import * as googleTTS from 'google-tts-api';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { prisma } from '../lib/prisma';

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

export class VideoCreator {
  /**
   * Renders a professional MP4 video by fetching B-Roll and generating high-quality TTS.
   */
  static async renderVideo(content: GeneratedContent): Promise<string> {
    console.log("[VideoCreator] Initializing PRO Video Render Pipeline...");
    
    const settings = await prisma.settings.findFirst({ where: { id: 'default' } });
    
    const outputDir = path.join(process.cwd(), 'public', 'renders');
    const tempDir = path.join(process.cwd(), 'public', 'temp');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const timestamp = Date.now();
    const finalAudioPath = path.join(tempDir, `audio_${timestamp}.mp3`);
    const outputPath = path.join(outputDir, `output_${timestamp}.mp4`);

    try {
      // 1. Generate Voiceover
      console.log("[VideoCreator] Generating Voiceover...");
      if (settings?.elevenLabsApiKey) {
        await this.generateElevenLabsAudio(content.script, finalAudioPath, settings.elevenLabsApiKey);
      } else {
        await this.generateGoogleAudio(content.script, finalAudioPath);
      }

      // 2. Fetch Visual Assets (B-Roll) based on Scenes
      console.log("[VideoCreator] Processing Scenes & Visuals...");
      let hasRealVisuals = false;
      const bRollPaths: string[] = [];
      
      if (content.scenes && content.scenes.length > 0 && settings?.pexelsApiKey) {
        hasRealVisuals = true;
        for (let i = 0; i < content.scenes.length; i++) {
          const scene = content.scenes[i];
          const clipPath = path.join(tempDir, `broll_${timestamp}_${i}.mp4`);
          const success = await this.fetchPexelsVideo(scene.bRollPrompt, clipPath, settings.pexelsApiKey);
          if (success) {
            bRollPaths.push(clipPath);
          } else {
            // Fallback empty video
            bRollPaths.push(await this.createFallbackClip(tempDir, i, timestamp, scene.durationEstimate || 3));
          }
        }
      }

      // 3. Render Final Video
      console.log(`[VideoCreator] Rendering final .mp4 with ${settings?.videoStyle || 'Cinematic Stock'} style...`);
      
      await new Promise<void>((resolve, reject) => {
        let command = ffmpeg();
        
        if (hasRealVisuals && bRollPaths.length > 0) {
           // Complex FFmpeg logic for concatenating multiple videos goes here.
           // For stability and simplicity in this automated flow, if we have multiple clips,
           // we'll use a file list approach or complex filter.
           // To keep the initial setup robust, we'll create a single fallback or use the first clip looped if concat fails.
           // A true pro editor would create a txt file and use the concat demuxer.
           const listPath = path.join(tempDir, `list_${timestamp}.txt`);
           const listContent = bRollPaths.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n');
           fs.writeFileSync(listPath, listContent);
           
           command = command
             .input(listPath)
             .inputOptions(['-f concat', '-safe 0']);
        } else {
           command = command
             .input('color=c=#0f172a:s=1080x1920:r=30') // Vertical Shorts format (Slate/Dark color)
             .inputFormat('lavfi');
        }

        command
          .input(finalAudioPath)
          .outputOptions([
            '-c:v libx264',
            '-tune stillimage',
            '-c:a aac',
            '-b:a 192k',
            '-pix_fmt yuv420p',
            '-shortest',
          ])
          // Pro Caption Styling
          .videoFilters([{
            filter: 'drawtext',
            options: {
              text: settings?.captionStyle === 'Minimalist' ? 'Tap to unmute' : 'WAIT FOR IT...',
              fontsize: settings?.captionStyle === 'Minimalist' ? 50 : 90,
              fontcolor: 'yellow',
              fontfile: 'Arial', // Ensure you have fonts available in a real environment
              x: '(w-text_w)/2',
              y: '(h-text_h)/2',
              box: 1,
              boxcolor: 'black@0.6',
              boxborderw: 15
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
      if (fs.existsSync(finalAudioPath)) fs.unlinkSync(finalAudioPath);
      bRollPaths.forEach(p => { if(fs.existsSync(p)) fs.unlinkSync(p); });

      return outputPath;
    } catch (error) {
      console.error("[VideoCreator] Real rendering failed.", error);
      throw new Error("Video rendering failed due to missing dependencies or FFmpeg error.");
    }
  }

  private static async generateElevenLabsAudio(text: string, outputPath: string, apiKey: string) {
    console.log("[VideoCreator] Using ElevenLabs for Pro Audio...");
    try {
      const voiceId = "EXAVITQu4vr4xnSDxMaL"; // "Bella" or any preferred voice
      const response = await axios.post(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        text: text,
        model_id: "eleven_monolingual_v1",
        voice_settings: { stability: 0.5, similarity_boost: 0.5 }
      }, {
        headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
        responseType: 'arraybuffer'
      });
      fs.writeFileSync(outputPath, response.data);
    } catch (error) {
      console.error("[VideoCreator] ElevenLabs failed, falling back to Google TTS.", error);
      await this.generateGoogleAudio(text, outputPath);
    }
  }

  private static async generateGoogleAudio(text: string, outputPath: string) {
     const audioChunks = await googleTTS.getAllAudioBase64(text, {
        lang: 'en',
        slow: false,
        host: 'https://translate.google.com',
        splitPunct: ',.?'
      });
      const audioBuffer = Buffer.concat(audioChunks.map(chunk => Buffer.from(chunk.base64, 'base64')));
      fs.writeFileSync(outputPath, audioBuffer);
  }

  private static async fetchPexelsVideo(query: string, outputPath: string, apiKey: string): Promise<boolean> {
    try {
      const response = await axios.get(`https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&orientation=portrait&per_page=1`, {
        headers: { Authorization: apiKey }
      });
      
      if (response.data.videos && response.data.videos.length > 0) {
        // Find HD file
        const videoFiles = response.data.videos[0].video_files;
        const hdFile = videoFiles.find((f: any) => f.quality === 'hd') || videoFiles[0];
        
        const videoRes = await axios.get(hdFile.link, { responseType: 'stream' });
        const writer = fs.createWriteStream(outputPath);
        videoRes.data.pipe(writer);
        
        return new Promise((resolve) => {
          writer.on('finish', () => resolve(true));
          writer.on('error', () => resolve(false));
        });
      }
      return false;
    } catch (error) {
      console.error(`[VideoCreator] Failed to fetch Pexels video for query: ${query}`);
      return false;
    }
  }

  private static async createFallbackClip(tempDir: string, index: number, timestamp: number, duration: number): Promise<string> {
    const p = path.join(tempDir, `fallback_${timestamp}_${index}.mp4`);
    await new Promise<void>((resolve, reject) => {
       ffmpeg()
         .input(`color=c=#1e293b:s=1080x1920:r=30:d=${duration}`)
         .inputFormat('lavfi')
         .outputOptions(['-c:v libx264', '-pix_fmt yuv420p'])
         .save(p)
         .on('end', () => resolve())
         .on('error', (err) => reject(err));
    });
    return p;
  }
}
