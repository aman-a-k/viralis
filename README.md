# Viralis

Turns long-form YouTube videos (or pasted transcripts) into short-form clips:
AI picks the strongest moments, writes captions for each platform, and — with
the render worker connected — cuts real 9:16 / 1:1 / 16:9 videos with
burned-in subtitles. Autopilot writes scripts for trending topics in your niche.

## What works, and what it needs

| Feature | Needs |
| --- | --- |
| Repurpose Studio — analyze a YouTube link or pasted transcript | An AI key (Gemini / Groq / OpenAI) |
| Browse trending / Automatic mode | AI key + YouTube Data API key |
| Render clips to video files, Content Library | [Render worker](worker/README.md) + Vercel Blob |
| Transcribing videos YouTube won't serve captions for | Render worker |
| Autopilot scripts, Trend Radar | AI key |
| Agent Fleet "Ask an agent" | AI key |
| Approval Queue, Discord alerts | Discord webhook (optional) |
| Learning Loop | Shows sample data until clips have performance metrics — publishing and metric import aren't built yet |

Keys can be set in **Settings** inside the app or as environment variables
(see `.env.example`). A key saved in Settings wins over the environment.

## Local setup

```bash
cp .env.example .env        # fill in DATABASE_URL, DIRECT_URL, NEXTAUTH_SECRET, and one AI key
npm install
npx prisma migrate deploy   # create the tables
npm run dev
```

Open http://localhost:3000. In development a **Developer bypass** sign-in is
available; otherwise create the first account with email + password (sign-up
is then closed unless `ALLOWED_EMAILS` lists more people).

## Deploying

- **App**: Vercel (or `docker compose up` with a filled-in `.env`). Run
  `npx prisma migrate deploy` against the production database whenever
  `prisma/migrations` changes.
- **Render worker**: separate service — see [worker/README.md](worker/README.md).
  Then set `RENDER_WORKER_URL` and `RENDER_WORKER_SECRET` on the app.

## Checks

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## Development notes

This project runs on a newer Next.js release with some breaking changes from
older versions — API shapes, conventions, and file structure can differ from
what you might expect. Check `node_modules/next/dist/docs/` for the version-
specific guides, and watch for deprecation warnings when running the dev
server.
