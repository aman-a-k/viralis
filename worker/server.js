// Viralis render worker.
//
// Standalone service (deployed separately — e.g. Render — because Vercel's
// serverless functions can't run ffmpeg/yt-dlp or hold a job open long
// enough). Receives one clip job at a time from the Next.js app, downloads
// just that time range of the source video, cuts + reframes + burns
// captions with ffmpeg, uploads the result to Vercel Blob, and returns the
// public URL synchronously.
//
// Also runs transcription: YouTube now blocks anonymous automated access to
// both video and captions, and even authenticated (cookie) requests can't
// get captions past a proof-of-origin token requirement. So instead of
// asking YouTube for captions, this worker downloads the audio (which does
// work with cookies) and transcribes it itself with whisper.cpp. That's
// slow for long videos — far past what a single HTTP request can wait on —
// so transcription runs as a background job the main app polls for.
//
// Auth: every request must carry `Authorization: Bearer <WORKER_SECRET>`
// matching the WORKER_SECRET env var here (same value goes into the Next.js
// app's RENDER_WORKER_SECRET).

import express from 'express';
import { put } from '@vercel/blob';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

const execFileAsync = promisify(execFile);
const app = express();
app.use(express.json({ limit: '2mb' }));

const PORT = process.env.PORT || 8080;
const WORKER_SECRET = process.env.WORKER_SECRET || '';
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN || '';
const WHISPER_BIN = process.env.WHISPER_BIN || 'whisper-cli';
const WHISPER_MODEL = process.env.WHISPER_MODEL || '';

// A YouTube cookies.txt (Netscape format), added as a Render "Secret File".
// Anonymous requests from cloud IPs are blocked outright; authenticated ones
// get a separate, much higher rate limit. Optional — falls back to anonymous
// (and will likely fail) if not present, so local/dev keeps working.
const COOKIES_PATH = '/etc/secrets/yt-cookies.txt';

app.get('/health', (_req, res) => res.json({ ok: true }));

function checkAuth(req, res) {
  if (!WORKER_SECRET) {
    res.status(500).json({ success: false, error: 'WORKER_SECRET is not set on the worker.' });
    return false;
  }
  const auth = req.header('authorization') || '';
  if (auth !== `Bearer ${WORKER_SECRET}`) {
    res.status(401).json({ success: false, error: 'Unauthorized.' });
    return false;
  }
  return true;
}

app.post('/render', async (req, res) => {
  if (!checkAuth(req, res)) return;
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
    await runYtDlpWithRetry(
      [
        '--no-playlist',
        '--download-sections', `*${padStart}-${padEnd}`,
        '--force-keyframes-at-cuts',
        '-f', 'bv*[height<=1080][ext=mp4]+ba[ext=m4a]/b[height<=1080][ext=mp4]/b',
        '--merge-output-format', 'mp4',
        '-o', rawPath,
        youtubeUrl,
      ],
      `render clip ${clipId || '?'}`
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

// --- Transcription (background job) ---------------------------------------
//
// Transcribing a full video with whisper.cpp on a free-tier CPU can take far
// longer than any single HTTP request should wait, so this is a fire-and-poll
// job: POST /transcript/start kicks it off and returns immediately, GET
// /transcript/status/:jobId reports progress. Jobs live in memory only —
// fine for a single always-on instance, but lost on a restart/redeploy.
const transcriptJobs = new Map();
const JOB_TIMEOUT_MS = 20 * 60 * 1000; // hard ceiling per transcription
const JOB_RETENTION_MS = 60 * 60 * 1000; // how long a finished job's result is kept

function pruneOldJobs() {
  const now = Date.now();
  for (const [id, job] of transcriptJobs) {
    if (job.status !== 'processing' && now - job.updatedAt > JOB_RETENTION_MS) {
      transcriptJobs.delete(id);
    }
  }
}

app.post('/transcript/start', (req, res) => {
  if (!checkAuth(req, res)) return;
  if (!WHISPER_MODEL) {
    return res.status(500).json({ success: false, error: 'WHISPER_MODEL is not set on the worker.' });
  }

  const { youtubeUrl } = req.body || {};
  if (!youtubeUrl) {
    return res.status(400).json({ success: false, error: 'youtubeUrl is required.' });
  }

  pruneOldJobs();
  const jobId = randomUUID();
  transcriptJobs.set(jobId, { status: 'processing', updatedAt: Date.now() });
  runTranscriptionJob(jobId, youtubeUrl);
  res.json({ success: true, jobId });
});

app.get('/transcript/status/:jobId', (req, res) => {
  if (!checkAuth(req, res)) return;
  const job = transcriptJobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ success: false, error: 'Unknown or expired job id.' });
  }
  if (job.status === 'processing') return res.json({ success: true, status: 'processing' });
  if (job.status === 'error') return res.json({ success: true, status: 'error', error: job.error });
  res.json({ success: true, status: 'done', transcript: job.transcript });
});

async function runTranscriptionJob(jobId, youtubeUrl) {
  const workDir = await mkdtemp(path.join(tmpdir(), 'viralis-whisper-'));
  const outBase = path.join(workDir, 'transcript');
  try {
    console.log(`[transcript ${jobId}]: downloading audio for ${youtubeUrl}`);
    await runYtDlpWithRetry(
      ['--no-playlist', '-f', 'bestaudio/best', '-o', path.join(workDir, 'audio.%(ext)s'), youtubeUrl],
      `transcript-audio ${jobId}`
    );

    const files = await readdir(workDir);
    const audioFile = files.find((f) => f.startsWith('audio.'));
    if (!audioFile) throw new Error('yt-dlp did not produce an audio file.');

    const wavPath = path.join(workDir, 'audio.wav');
    console.log(`[transcript ${jobId}]: converting to 16kHz mono wav`);
    await execFileAsync(
      'ffmpeg',
      ['-y', '-i', path.join(workDir, audioFile), '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', wavPath],
      { timeout: 5 * 60 * 1000 }
    );

    console.log(`[transcript ${jobId}]: transcribing with whisper.cpp (this can take a while)`);
    await execFileAsync(
      WHISPER_BIN,
      ['-m', WHISPER_MODEL, '-f', wavPath, '-l', 'en', '-ovtt', '-of', outBase],
      { timeout: JOB_TIMEOUT_MS, maxBuffer: 1024 * 1024 * 20 }
    );

    const vtt = await readFile(`${outBase}.vtt`, 'utf8');
    const transcript = parseVtt(vtt);
    transcriptJobs.set(jobId, {
      status: transcript.length ? 'done' : 'error',
      transcript,
      error: transcript.length ? undefined : 'No speech detected in this video.',
      updatedAt: Date.now(),
    });
  } catch (err) {
    console.error(`[transcript ${jobId}] failed:`, err?.stderr?.toString?.() || err?.message || err);
    transcriptJobs.set(jobId, {
      status: 'error',
      error: `Transcription failed: ${err?.message || 'unknown error'}`,
      updatedAt: Date.now(),
    });
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

// YouTube blocks anonymous requests from cloud IPs outright (429/403) and,
// separately, the default web client needs a JS runtime to solve signature
// challenges this image doesn't have. With cookies attached, only client
// types that support authenticated sessions are usable (yt-dlp silently
// skips android/ios otherwise), so we only try "web" in that case; without
// cookies (local/dev), try android/ios first since they skip the JS-runtime
// step and are trusted longer. Either way, retry with backoff since 429s can
// be transient.
function ytDlpClientsFor(hasCookies) {
  return hasCookies ? ['web'] : ['android', 'ios', 'web'];
}

async function runYtDlpWithRetry(args, label) {
  const hasCookies = existsSync(COOKIES_PATH);
  const cookieArgs = hasCookies ? ['--cookies', COOKIES_PATH] : [];
  let lastErr;
  for (const client of ytDlpClientsFor(hasCookies)) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await execFileAsync(
          'yt-dlp',
          [...cookieArgs, '--extractor-args', `youtube:player_client=${client}`, ...args],
          { timeout: 8 * 60 * 1000, maxBuffer: 1024 * 1024 * 20 }
        );
      } catch (err) {
        lastErr = err;
        const msg = err?.stderr?.toString?.() || err?.message || '';
        console.warn(`[yt-dlp] ${label} (${client}, attempt ${attempt + 1}) failed: ${msg.slice(0, 300)}`);
        const transient = /429|Too Many Requests|403|Forbidden/.test(msg);
        if (!transient) break; // no point retrying a hard failure (e.g. private video) with the same client
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      }
    }
  }
  throw lastErr;
}

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

function vttTimeToSeconds(t) {
  const [h, m, s] = t.split(':');
  return parseInt(h, 10) * 3600 + parseInt(m, 10) * 60 + parseFloat(s);
}

/** Parses a WebVTT file (whisper.cpp's -ovtt output) into plain timestamped
 * segments. */
function parseVtt(vtt) {
  const lines = vtt.replace(/\r/g, '').split('\n');
  const timeRe = /(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})/;
  const segments = [];

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(timeRe);
    if (!m) continue;
    const start = vttTimeToSeconds(m[1]);
    const end = vttTimeToSeconds(m[2]);
    const textLines = [];
    i++;
    while (i < lines.length && lines[i].trim() !== '') {
      textLines.push(lines[i]);
      i++;
    }
    const text = textLines
      .join(' ')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (text) segments.push({ text, start, end: end || start + 3 });
  }

  const deduped = [];
  for (const seg of segments) {
    const prev = deduped[deduped.length - 1];
    if (prev && prev.text === seg.text) {
      prev.end = seg.end;
      continue;
    }
    deduped.push(seg);
  }
  return deduped;
}

app.listen(PORT, () => {
  console.log(`Viralis render worker listening on :${PORT}`);
});
