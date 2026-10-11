# Viralis

Turn a recorded lesson, webinar or talk into editable, captioned short clips.

Customers upload a recording (or link a video they have rights to). Viralis
transcribes it, finds the strongest standalone moments across the whole
recording, and gives them clips they can trim, re-caption and reframe, then
download — or publish to YouTube after approving them.

## Architecture

```
Browser ──► Next.js app (Vercel) ──► PostgreSQL
              │  ▲                    (workspaces, projects, clips, jobs,
              │  │                     subscriptions, usage ledger, audit)
              │  └── claim / heartbeat / complete ──┐
              │                                     │
              ├──► Vercel Blob (private) ◄── Media worker (Render, Docker:
              │      ws/<workspace>/sources|renders     ffmpeg + whisper.cpp + yt-dlp)
              ├──► AI provider (Gemini/Groq/OpenAI) — clip finding + post copy
              ├──► Razorpay — subscriptions (webhooks)
              ├──► Resend — verification / reset / invite emails
              └──► Google — sign-in, YouTube publishing & stats
```

- **Workspaces** isolate customers. Every API route resolves the caller's
  workspace (`requireWorkspace`) and scopes every query by it.
- **Jobs** (`transcribe`, `render`, `analyze`) are rows in Postgres with leases,
  so a worker restart delays work instead of losing it.
- **Usage** is reserved before work starts, committed on success and released
  on failure (`src/lib/usage.ts`); plans live in `src/lib/plans.ts`.
- **Media** is private; the browser only ever gets short-lived signed links from
  `/api/media/*` after a membership check.

## Local development

Requirements: Node 22, a PostgreSQL database.

```bash
npm ci
cp .env.example .env.local      # fill in DATABASE_URL, NEXTAUTH_SECRET, GEMINI_API_KEY at minimum
npx prisma migrate deploy
npm run dev
```

In development, "Developer sign-in" creates a local verified account, and
emails (verification, password reset) are printed to the server log instead of
sent. Video upload and export need the worker (see `worker/README.md`);
without it you can still paste a transcript to try clip finding and editing.

### Tests

```bash
npm test                                            # unit tests only
TEST_DATABASE_URL=postgresql://…/viralis_test npm test   # + integration tests
```

Integration tests run against a disposable database (they truncate it). They
cover tenant isolation through the real route handlers, concurrent usage
reservations, job leases and worker crashes, duplicate payment webhooks,
duplicate publishing, and the full upload → transcribe → find clips → review →
export flow. CI (`.github/workflows/ci.yml`) runs lint, typecheck, tests against
Postgres, the production build and a dependency audit on every push.

## Deploying (supported path)

1. **Database** — any PostgreSQL 15+ (Neon, Supabase, Vercel Postgres). Set
   `DATABASE_URL` (pooled) and `DIRECT_URL` (unpooled). Production deploys run
   `prisma migrate deploy` automatically (`scripts/migrate-on-deploy.mjs`).
   **Back up the database before the first deploy of this version** — it
   migrates existing data into a workspace (see "Upgrading" below).
2. **Blob storage** — create a **private** Vercel Blob store, connect it to the
   project (`BLOB_READ_WRITE_TOKEN`), keep `BLOB_ACCESS=private`.
3. **Worker** — deploy `worker/` on Render per `worker/README.md`; set
   `RENDER_WORKER_URL` / `RENDER_WORKER_SECRET` on the app.
4. **App on Vercel** — set the variables in `.env.example`: at minimum
   `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `APP_URL`, `ENCRYPTION_KEY`,
   `GEMINI_API_KEY`, `CRON_SECRET`, `ADMIN_EMAILS`.
5. **Email** — verify your domain in Resend; set `RESEND_API_KEY`, `EMAIL_FROM`,
   `SUPPORT_EMAIL`. Without it, sign-up works but verification emails can't be sent.
6. **Payments** — in Razorpay create a monthly plan for each paid plan in
   `src/lib/plans.ts` (Creator: ₹999), set `RAZORPAY_KEY_ID`,
   `RAZORPAY_KEY_SECRET`, `RAZORPAY_PLAN_CREATOR`, and add a webhook to
   `<APP_URL>/api/billing/webhook` for `subscription.*` events with
   `RAZORPAY_WEBHOOK_SECRET`. Test in Razorpay test mode first.
7. **Google** — one OAuth client with redirect URIs
   `<APP_URL>/api/auth/callback/google` and `<APP_URL>/api/auth/youtube/callback`,
   the YouTube Data API v3 and YouTube Analytics API enabled, and the
   `youtube.upload`, `youtube.readonly`, `yt-analytics.readonly` scopes on the
   consent screen. Publishing for the public requires Google's OAuth app
   verification for those scopes; until then only listed test users can connect.
   `YOUTUBE_API_KEY` (an API key) powers trending and video-length checks.

The daily cron (`vercel.json` → `/api/cron/daily`) recovers stuck jobs, releases
stale usage reservations, deletes media past retention, reconciles
subscriptions with Razorpay, and syncs YouTube stats.

### Upgrading an existing deployment

The `20261011120000_workspaces_jobs_billing` migration moves all existing data
into one workspace owned by the earliest account (other existing accounts
become admins of it), keeps an existing YouTube connection working, gives
clips that were only *queued* the new `in_review` status, and marks work that
was mid-render/mid-transcription on the old in-memory worker as interrupted.
Redeploy the worker together with the app — the old worker can't talk to the
new job queue.

## Operating

- **Admin view** (accounts in `ADMIN_EMAILS`): configuration check, queue depth,
  worker liveness, failures with one-click retry, subscriptions, usage and the
  audit trail. Admin workspaces aren't metered.
- **Health**: `GET /api/health` (database) and the worker's `GET /health`.
- **Support**: processing failures return the customer's minutes/exports
  automatically; failed jobs can be retried from Admin.

## Launch checklist

- [ ] Database backed up; migration applied; `/api/health` OK
- [ ] Private Blob store connected; an upload → export → download works
- [ ] Worker deployed (always-on instance); Admin shows it claiming jobs
- [ ] Captions checked on a real Hindi/Kannada recording
- [ ] Resend domain verified; verification and reset emails arrive
- [ ] Razorpay test-mode subscribe → webhook → plan active → cancel works; then live keys
- [ ] Google OAuth consent screen verified for YouTube scopes (or users added as testers)
- [ ] Legal pages reviewed (`/terms`, `/privacy`, `/refunds`, `/content-policy`, `/contact`)
- [ ] `ADMIN_EMAILS`, `CRON_SECRET`, `ENCRYPTION_KEY` set and stored safely
