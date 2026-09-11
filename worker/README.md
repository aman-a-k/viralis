# Viralis render worker

Cuts, reframes, and caption-burns clips with real ffmpeg + yt-dlp. Deployed
**separately** from the main Next.js app — Vercel's serverless functions
can't run ffmpeg or hold a job open long enough, so this runs as its own
always-on service.

## Deploy to Render (free tier, no card to start)

1. Push this repo to GitHub (already done if you're reading this from the repo).
2. [dashboard.render.com](https://dashboard.render.com) → **New +** → **Web Service**.
3. Connect this GitHub repo.
4. Settings:
   - **Root Directory**: `worker`
   - **Runtime**: `Docker` (it'll pick up `worker/Dockerfile` automatically)
   - **Instance Type**: Free
5. **Environment** → add:
   - `WORKER_SECRET` — any long random string (generate one with `openssl rand -hex 24`). You'll put the same value in the main app's `RENDER_WORKER_SECRET`.
   - `BLOB_READ_WRITE_TOKEN` — from the Vercel project → Storage → your Blob store → `.env.local` tab.
6. Deploy. Render gives you a URL like `https://viralis-render-worker.onrender.com`.

## Wire it into the main app

In the **Next.js app's** Vercel env vars, add:

```
RENDER_WORKER_URL=https://<your-render-worker>.onrender.com
RENDER_WORKER_SECRET=<the same WORKER_SECRET value>
```

Redeploy the main app. "Approve & Render" in the Approval Queue will now
actually cut a real clip instead of returning the "media worker not
enabled" message.

## Notes

- **Free-tier cold starts**: Render's free web services spin down after
  ~15 minutes idle and take ~30-60s to wake up on the next request. The
  main app's render call has a generous timeout to absorb this, but the
  first render after a quiet period will feel slow. Upgrading the Render
  plan removes the spin-down.
- **yt-dlp** downloads only the clip's time range (`--download-sections`),
  not the whole source video, to keep jobs fast even for long videos.
- Rendered clips are uploaded to **Vercel Blob** (public) and the URL is
  written back to `Clip.videoUrl`.
