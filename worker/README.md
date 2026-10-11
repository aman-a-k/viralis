# Viralis media worker

Transcribes recordings (whisper.cpp, any language, word-level timestamps) and
renders clips (ffmpeg: cut, reframe, burn captions). It runs **separately**
from the Next.js app because serverless functions can't run ffmpeg/whisper or
hold a job for minutes.

## How it works

The worker **pulls** work from the app; jobs live in the app's database:

1. `POST {APP_URL}/api/worker/claim` — returns the next job (or `null`) with
   short-lived signed URLs for the media it needs.
2. While working it heartbeats `POST {APP_URL}/api/worker/jobs/:id` every 30s.
3. It reports `complete` (with the transcript, or the uploaded render's path)
   or `fail` (with whether a retry could help).

Each claim holds a 3-minute lease that heartbeats extend. If the worker crashes
or is redeployed, the lease lapses and the job is handed out again (up to 3
attempts) — nothing is lost with the process. On a normal shutdown (SIGTERM)
the current job is handed back immediately.

The worker polls every 60s when idle, and the app calls `POST /wake` whenever
it queues work so jobs start right away. It never needs database credentials.

## Deploy on Render

1. [dashboard.render.com](https://dashboard.render.com) → **New → Web Service** → this repo.
2. **Root Directory**: `worker` · **Runtime**: Docker.
3. **Instance type**: the free tier (512 MB) works with the default `base` model
   for recordings up to ~45 minutes, but it sleeps after 15 idle minutes.
   For paying customers use **Starter or above** (always on); with 2 GB+ you can
   build with `WHISPER_MODEL_NAME=small-q5_1` for noticeably better accuracy on
   Indian languages (Docker build argument).
4. **Environment**:

| Variable | Value |
|---|---|
| `APP_URL` | The app's public URL, e.g. `https://viralis.example` |
| `WORKER_SECRET` | Long random string (`openssl rand -hex 24`). Same value as the app's `RENDER_WORKER_SECRET`. |
| `BLOB_READ_WRITE_TOKEN` | The app's Blob store token (renders are uploaded there). |
| `BLOB_ACCESS` | `private` (default) or `public` — must match the app. |
| `WHISPER_THREADS` | CPU threads for transcription (default 2). |
| `IDLE_POLL_MS` | Idle poll interval (default 60000). |

5. Optional **Secret File** `yt-cookies.txt` (Netscape format) — only needed for
   YouTube-link projects, because YouTube blocks anonymous downloads from cloud
   servers. Uploaded files never touch YouTube.

6. In the app's environment set `RENDER_WORKER_URL` (this service's URL) and
   `RENDER_WORKER_SECRET`, and redeploy the app.

## Verify a deployment

- `GET /health` → `{ "ok": true, "busy": false }`.
- In the app's **Admin** view, "Worker last claimed" updates after you upload a
  recording, and the queue drains.
- Upload a short recording with Hindi or Kannada speech, export a clip, and
  check the burned-in captions show the script correctly and follow the speech.

## Pinned tools

`Dockerfile` pins yt-dlp, Deno, whisper.cpp and the model by build argument, and
`package-lock.json` pins the Node dependencies. Upgrade deliberately: bump the
argument, rebuild, and re-run the verification above.
