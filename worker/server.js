// Viralis render worker.
//
// Standalone service (deployed separately — e.g. Render — because Vercel's
// serverless functions can't run ffmpeg/yt-dlp or hold a job open long
// enough). Receives one clip job at a time from the Next.js app, downloads
// just that time range of the source video, cuts + reframes + burns
// captions with ffmpeg, uploads the result to Vercel Blob, and returns the
// public URL synchronously.
//
// Auth: every request must carry `Authorization: Bearer <WORKER_SECRET>`
// matching the WORKER_SECRET env var here (same value goes into the Next.js
// app's RENDER_WORKER_SECRET).

import express from 'express';
import { put } from '@vercel/blob';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const execFileAsync = promisify(execFile);
const app = express();
app.use(express.json({ limit: '2mb' }));

const PORT = process.env.PORT || 8080;
const WORKER_SECRET = process.env.WORKER_SECRET || '';
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN || '';

app.get('/health', (_req, res) => res.json({ ok: true }));

app.post('/render', async (req, res) => {
  if (!WORKER_SECRET) {
    return res.status(500).json({ success: false, error: 'WORKER_SECRET is not set on the worker.' });
  }
  const auth = req.header('authorization') || '';
  if (auth !== `Bearer ${WORKER_SECRET}`) {
    return res.status(401).json({ success: false, error: 'Unauthorized.' });
  }
  if (!BLOB_TOKEN) {
    return res.status(500).json({ success: false, error: 'BLOB_READ_WRITE_TOKEN is not set on the worker.' });
  }

  const {
    youtubeUrl,
    startTime,
    endTime,
    aspectRatio = '9:16',
    captionText = '',
    captionStyle = 'Dynamic Pop',
    clipId,
  } = req.body || {};

  if (!youtubeUrl || typeof startTime !== 'number' || typeof endTime !== 'number' || endTime <= startTime) {
    return res.status(400).json({ success: false, error: 'youtubeUrl, startTime and endTime are required.' });
  }

  const duration = Math.min(90, endTime - startTime);
  const workDir = await mkdtemp(path.join(tmpdir(), 'viralis-'));
  const rawPath = path.join(workDir, 'raw.mp4');
  const assPath = path.join(workDir, 'subs.ass');
  const outPath = path.join(workDir, 'out.mp4');

  try {
    console.log(`[render] clip ${clipId || '?'}: downloading ${startTime}-${endTime}s of ${youtubeUrl}`);

    // Pad the section slightly so ffmpeg has keyframes to cut cleanly on.
    const padStart = Math.max(0, Math.floor(startTime) - 2);
    const padEnd = Math.ceil(endTime) + 2;
    await execFileAsync(
      'yt-dlp',
      [
        '--no-playlist',
        '--download-sections', `*${padStart}-${padEnd}`,
        '--force-keyframes-at-cuts',
        '-f', 'bv*[height<=1080][ext=mp4]+ba[ext=m4a]/b[height<=1080][ext=mp4]/b',
        '--merge-output-format', 'mp4',
        '-o', rawPath,
        youtubeUrl,
      ],
      { timeout: 8 * 60 * 1000, maxBuffer: 1024 * 1024 * 20 }
    );

    await writeFile(assPath, buildAss(captionText, duration, aspectRatio, captionStyle), 'utf8');

    const scaleCrop = SCALE_CROP[aspectRatio] || SCALE_CROP['9:16'];
    const relativeStart = Math.max(0, startTime - padStart);
    const assFilterPath = assPath.replace(/\\/g, '/').replace(/:/g, '\\:');

    console.log(`[render] clip ${clipId || '?'}: cutting + burning captions`);
    await execFileAsync(
      'ffmpeg',
      [
        '-y',
        '-ss', String(relativeStart),
        '-i', rawPath,
        '-t', String(duration),
        '-vf', `${scaleCrop},ass=${assFilterPath}`,
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-movflags', '+faststart',
        outPath,
      ],
      { timeout: 5 * 60 * 1000 }
    );

    const fileBuffer = await readFile(outPath);
    const filename = `clips/${clipId || Date.now()}_${aspectRatio.replace(':', 'x')}.mp4`;
    console.log(`[render] clip ${clipId || '?'}: uploading (${(fileBuffer.length / 1e6).toFixed(1)}MB)`);
    const blob = await put(filename, fileBuffer, {
      access: 'public',
      contentType: 'video/mp4',
      token: BLOB_TOKEN,
    });

    res.json({ success: true, videoUrl: blob.url });
  } catch (err) {
    console.error('[render] failed:', err?.stderr?.toString?.() || err?.message || err);
    res.status(500).json({
      success: false,
      error: `Render failed: ${err?.message || 'unknown error'}`,
    });
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
});

const SCALE_CROP = {
  '9:16': 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920',
  '1:1': 'scale=1080:1080:force_original_aspect_ratio=increase,crop=1080:1080',
  '16:9': 'scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080',
};

function assTime(seconds) {
  const s = Math.max(0, seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const cs = Math.floor((s % 1) * 100);
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

function buildAss(text, durationSeconds, aspectRatio, style) {
  const vertical = aspectRatio === '9:16';
  const resX = vertical ? 1080 : aspectRatio === '1:1' ? 1080 : 1920;
  const resY = vertical ? 1920 : aspectRatio === '1:1' ? 1080 : 1080;
  const marginV = vertical ? 960 : Math.round(resY / 2);

  let header = `[Script Info]\nScriptType: v4.00+\nPlayResX: ${resX}\nPlayResY: ${resY}\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n`;

  if (style === 'Minimalist') {
    header += `Style: Default,Helvetica,${Math.round(resX * 0.045)},&H00FFFFFF,&H000000FF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,4,0,2,10,10,${Math.round(resY * 0.08)},1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;
  } else {
    header += `Style: Default,Arial,${Math.round(resX * 0.065)},&H0000FFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,10,0,5,10,10,${marginV},1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;
  }

  const words = String(text || '').replace(/[^\w\s'.,!?-]/g, '').split(/\s+/).filter(Boolean);
  if (words.length === 0) return header;

  const chunkDuration = Math.max(1.6, durationSeconds / Math.max(1, Math.ceil(words.length / 3)));
  let t = 0;
  let lines = '';
  for (let i = 0; i < words.length; i += 3) {
    const phrase = words.slice(i, i + 3).join(' ').toUpperCase();
    const start = assTime(t);
    const end = assTime(Math.min(durationSeconds, t + chunkDuration));
    lines +=
      style === 'Minimalist'
        ? `Dialogue: 0,${start},${end},Default,,0,0,0,,${phrase}\n`
        : `Dialogue: 0,${start},${end},Default,,0,0,0,,{\\an5\\fscx115\\fscy115}${phrase}\n`;
    t += chunkDuration;
    if (t >= durationSeconds) break;
  }
  return header + lines;
}

app.listen(PORT, () => {
  console.log(`Viralis render worker listening on :${PORT}`);
});
