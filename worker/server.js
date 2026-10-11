// Viralis media worker.
//
// Runs separately from the Next.js app (Vercel functions can't run ffmpeg,
// yt-dlp or whisper, or hold a job for minutes). It pulls work from the app:
//
//   POST {APP_URL}/api/worker/claim              -> next job (or null)
//   POST {APP_URL}/api/worker/jobs/:id           -> heartbeat | complete | fail
//
// Jobs live in the app's database with a lease. The worker heartbeats while
// it works; if it crashes or is redeployed, the lease lapses and the job is
// handed out again — nothing is lost with the process.
//
// Job types:
//   transcribe: audio from an uploaded file (signed URL) or YouTube (yt-dlp)
//               -> whisper.cpp with word-level timestamps, any language.
//   render:     cut + reframe + burn the app-supplied caption cues -> upload
//               to Blob storage under the workspace's renders/ prefix.
//
// Auth: every call to the app carries `Authorization: Bearer <WORKER_SECRET>`
// (the app's RENDER_WORKER_SECRET). The app calls POST /wake with the same
// secret to make the worker claim immediately instead of on its next poll.

import express from 'express';
import { put } from '@vercel/blob';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, readFile, readdir, rm, copyFile, stat } from 'node:fs/promises';
import { existsSync, createReadStream } from 'node:fs';
import { tmpdir, hostname } from 'node:os';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { groupWords, buildAss, describeWorkerError } from './media.js';

const execFileAsync = promisify(execFile);

const PORT = process.env.PORT || 8080;
const APP_URL = (process.env.APP_URL || '').replace(/\/$/, '');
const WORKER_SECRET = process.env.WORKER_SECRET || '';
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN || '';
const BLOB_ACCESS = process.env.BLOB_ACCESS === 'public' ? 'public' : 'private';
const WHISPER_BIN = process.env.WHISPER_BIN || 'whisper-cli';
const WHISPER_MODEL = process.env.WHISPER_MODEL || '';
const WHISPER_THREADS = String(process.env.WHISPER_THREADS || 2);
const IDLE_POLL_MS = Number(process.env.IDLE_POLL_MS || 60_000);
const HEARTBEAT_MS = 30_000;
const WORKER_ID = `${hostname()}-${randomUUID().slice(0, 8)}`;

// See the Dockerfile: YouTube blocks anonymous downloads from cloud IPs, so a
// cookies.txt can be mounted as a secret file. It's copied to a writable
// path because yt-dlp rewrites the jar as Google rotates session cookies.
const SECRET_COOKIES_PATH = '/etc/secrets/yt-cookies.txt';
const COOKIES_PATH = path.join(tmpdir(), 'yt-cookies-writable.txt');
if (existsSync(SECRET_COOKIES_PATH)) {
  await copyFile(SECRET_COOKIES_PATH, COOKIES_PATH);
  console.log('[startup] copied yt-cookies.txt to a writable path for yt-dlp');
}

for (const [name, value] of Object.entries({ APP_URL, WORKER_SECRET, BLOB_READ_WRITE_TOKEN: BLOB_TOKEN, WHISPER_MODEL })) {
  if (!value) console.warn(`[startup] ${name} is not set — jobs that need it will fail.`);
}

// --- Talking to the app -----------------------------------------------------

async function callApp(pathname, body, timeoutMs = 30_000) {
  const res = await fetch(`${APP_URL}${pathname}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${WORKER_SECRET}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ workerId: WORKER_ID, ...body }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

const report = (jobId, body) => callApp(`/api/worker/jobs/${encodeURIComponent(jobId)}`, body, 60_000);

/** Thrown when the app says this worker no longer holds the job. */
class LeaseLost extends Error {}

function startHeartbeat(jobId, state) {
  const timer = setInterval(async () => {
    try {
      const { status } = await report(jobId, { action: 'heartbeat', progress: state.progress });
      if (status === 409) state.leaseLost = true;
    } catch {
      /* transient; the lease is long enough to survive a missed beat */
    }
  }, HEARTBEAT_MS);
  return () => clearInterval(timer);
}

// --- Main loop: one heavy job at a time -------------------------------------
// whisper and a 1080p encode each want most of a small instance's memory.

let busy = false;
let wakeRequested = false;
let shuttingDown = false;
let currentJob = null;

async function loop() {
  if (busy || shuttingDown || !APP_URL || !WORKER_SECRET) return;
  busy = true;
  try {
    for (;;) {
      wakeRequested = false;
      let job = null;
      try {
        const { status, data } = await callApp('/api/worker/claim', {}, 60_000);
        if (status !== 200) {
          console.warn(`[claim] app returned HTTP ${status}`);
          break;
        }
        job = data.job;
      } catch (err) {
        console.warn('[claim] app unreachable:', err?.message || err);
        break;
      }
      if (!job) {
        if (wakeRequested) continue;
        break;
      }
      await runJob(job);
      if (shuttingDown) break;
    }
  } finally {
    busy = false;
  }
}

async function runJob(job) {
  const tag = `[${job.type} ${job.jobId} #${job.attempt}]`;
  const state = { progress: 'Starting', leaseLost: false };
  currentJob = job;
  const stopHeartbeat = startHeartbeat(job.jobId, state);
  const setProgress = (p) => {
    state.progress = p;
    console.log(`${tag} ${p}`);
    if (state.leaseLost) throw new LeaseLost();
  };
  try {
    const result = job.type === 'transcribe' ? await transcribe(job, setProgress) : await renderClip(job, setProgress);
    if (state.leaseLost) throw new LeaseLost();
    const { status } = await report(job.jobId, { action: 'complete', result });
    if (status === 409) console.warn(`${tag} finished, but the job had been reassigned — result discarded.`);
    else console.log(`${tag} done`);
  } catch (err) {
    if (err instanceof LeaseLost) {
      console.warn(`${tag} lease lost; dropping job.`);
    } else {
      const { message, retryable } = describeWorkerError(err, job.type);
      console.error(`${tag} failed:`, err?.stderr?.toString?.().slice(-2000) || err?.message || err);
      await report(job.jobId, { action: 'fail', error: message, retryable }).catch(() => {});
    }
  } finally {
    stopHeartbeat();
    currentJob = null;
  }
}

setInterval(() => loop().catch((e) => console.error('[loop]', e)), IDLE_POLL_MS);
setTimeout(() => loop().catch((e) => console.error('[loop]', e)), 2_000);

// --- HTTP: health + wake ----------------------------------------------------

const app = express();
app.get('/health', (_req, res) => res.json({ ok: true, busy, worker: WORKER_ID }));
app.post('/wake', (req, res) => {
  if (!WORKER_SECRET || req.header('authorization') !== `Bearer ${WORKER_SECRET}`) {
    return res.status(401).json({ ok: false });
  }
  wakeRequested = true;
  loop().catch((e) => console.error('[loop]', e));
  res.json({ ok: true, busy });
});
const server = app.listen(PORT, () => console.log(`Viralis worker ${WORKER_ID} listening on :${PORT}`));

// On redeploy, hand the current job back right away (as retryable) instead
// of waiting for its lease to lapse.
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[shutdown] ${signal}`);
  server.close();
  if (currentJob) {
    await report(currentJob.jobId, { action: 'fail', error: 'The processing server restarted. Retrying.', retryable: true }).catch(() => {});
  }
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// --- Transcription ----------------------------------------------------------

async function transcribe(job, setProgress) {
  if (!WHISPER_MODEL) throw new Error('WHISPER_MODEL is not set on the worker.');
  const workDir = await mkdtemp(path.join(tmpdir(), 'viralis-whisper-'));
  const outBase = path.join(workDir, 'transcript');
  const wavPath = path.join(workDir, 'audio.wav');
  try {
    let audioInput = job.source.mediaUrl;
    if (job.source.youtubeUrl) {
      setProgress('Downloading audio');
      await runYtDlpWithRetry(
        ['--no-playlist', '-f', 'bestaudio/best', '-o', path.join(workDir, 'audio.%(ext)s'), job.source.youtubeUrl],
        `transcript ${job.jobId}`
      );
      const audioFile = (await readdir(workDir)).find((f) => f.startsWith('audio.'));
      if (!audioFile) throw new Error('yt-dlp did not produce an audio file.');
      audioInput = path.join(workDir, audioFile);
    }

    setProgress('Preparing audio');
    await execFileAsync('ffmpeg', ['-y', '-i', audioInput, '-vn', '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', wavPath], {
      timeout: 20 * 60 * 1000,
    });
    const durationSeconds = await probeDuration(wavPath);

    setProgress('Transcribing');
    const lang = /^[a-z]{2}$/.test(job.language || '') ? job.language : 'auto';
    // -ml 1 -sow: one segment per word, split on word boundaries -> per-word timing.
    await execFileAsync(
      WHISPER_BIN,
      ['-m', WHISPER_MODEL, '-f', wavPath, '-l', lang, '-t', WHISPER_THREADS, '-ml', '1', '-sow', '-oj', '-of', outBase],
      { timeout: 3 * 60 * 60 * 1000, maxBuffer: 1024 * 1024 * 64 }
    );

    const json = JSON.parse(await readFile(`${outBase}.json`, 'utf8'));
    const words = (json.transcription || [])
      .map((t) => ({ w: String(t.text || '').trim(), s: (t.offsets?.from ?? 0) / 1000, e: (t.offsets?.to ?? 0) / 1000 }))
      .filter((w) => w.w && !/^\[.*\]$/.test(w.w)); // drop [BLANK_AUDIO], [Music] markers
    const segments = groupWords(words);
    if (!segments.length) {
      const err = new Error('No speech was detected in this recording.');
      err.permanent = true;
      throw err;
    }
    return { segments, durationSeconds: Math.ceil(durationSeconds || words[words.length - 1].e), language: json.result?.language || lang };
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function probeDuration(file) {
  try {
    const { stdout } = await execFileAsync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]);
    return Number(stdout.trim()) || 0;
  } catch {
    return 0;
  }
}

// --- Rendering --------------------------------------------------------------

const FRAME = { '9:16': [1080, 1920], '1:1': [1080, 1080], '16:9': [1920, 1080] };

async function renderClip(job, setProgress) {
  if (!BLOB_TOKEN) throw new Error('BLOB_READ_WRITE_TOKEN is not set on the worker.');
  const { startTime, endTime, aspectRatio, captionStyle, captionPosition, layout, cropX, cues, clipId, outputPrefix } = job;
  const duration = Math.min(180, endTime - startTime);
  const [W, H] = FRAME[aspectRatio] || FRAME['9:16'];
  const workDir = await mkdtemp(path.join(tmpdir(), 'viralis-render-'));
  const rawPath = path.join(workDir, 'raw.mp4');
  const assPath = path.join(workDir, 'subs.ass');
  const outPath = path.join(workDir, 'out.mp4');

  try {
    let inputArgs;
    if (job.source.mediaUrl) {
      // ffmpeg seeks with HTTP range requests, so only the needed part is read.
      inputArgs = ['-ss', String(startTime), '-i', job.source.mediaUrl];
    } else {
      setProgress('Downloading the section');
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
          job.source.youtubeUrl,
        ],
        `render ${clipId}`
      );
      inputArgs = ['-ss', String(Math.max(0, startTime - padStart)), '-i', rawPath];
    }

    await writeFile(assPath, buildAss(cues || [], W, H, captionStyle, captionPosition), 'utf8');
    const assFilter = `ass=${assPath.replace(/\\/g, '/').replace(/:/g, '\\:')}`;
    const x = Math.min(1, Math.max(0, Number(cropX ?? 0.5)));
    const filter =
      layout === 'fit'
        ? // Whole frame visible (slides, wide shots) over a blurred fill.
          `[0:v]split[a][b];[a]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},boxblur=20:4[bg];` +
          `[b]scale=${W}:${H}:force_original_aspect_ratio=decrease[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,${assFilter}[v]`
        : // Crop to frame, with the horizontal focus the customer chose.
          `[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}:(iw-${W})*${x.toFixed(3)}:(ih-${H})/2,${assFilter}[v]`;

    setProgress('Encoding');
    await execFileAsync(
      'ffmpeg',
      [
        '-y', ...inputArgs, '-t', String(duration),
        '-filter_complex', filter, '-map', '[v]', '-map', '0:a?',
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart',
        outPath,
      ],
      { timeout: 30 * 60 * 1000, maxBuffer: 1024 * 1024 * 20 }
    );

    setProgress('Uploading');
    const size = (await stat(outPath)).size;
    const blob = await put(`${outputPrefix}${clipId}_${aspectRatio.replace(':', 'x')}.mp4`, createReadStream(outPath), {
      access: BLOB_ACCESS,
      contentType: 'video/mp4',
      token: BLOB_TOKEN,
      addRandomSuffix: true,
      multipart: size > 50 * 1024 * 1024,
    });
    return { pathname: blob.pathname, bytes: size };
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

// --- yt-dlp -----------------------------------------------------------------

// YouTube blocks anonymous requests from cloud IPs (429/403). With cookies,
// only the "web" client supports authenticated sessions; without cookies
// (local/dev), android/ios skip the JS-runtime step.
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
        return await execFileAsync('yt-dlp', [...cookieArgs, '--extractor-args', `youtube:player_client=${client}`, ...args], {
          timeout: 15 * 60 * 1000,
          maxBuffer: 1024 * 1024 * 20,
        });
      } catch (err) {
        lastErr = err;
        const msg = err?.stderr?.toString?.() || err?.message || '';
        console.warn(`[yt-dlp] ${label} (${client}, attempt ${attempt + 1}) failed: ${msg.slice(0, 300)}`);
        if (!/429|Too Many Requests|403|Forbidden/.test(msg)) break;
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      }
    }
  }
  throw lastErr;
}
