-- Multi-tenant workspaces, durable jobs, billing and usage, auth tokens.

-- DropIndex
DROP INDEX "Video_createdAt_idx";

-- DropIndex
DROP INDEX "ApprovalQueue_status_createdAt_idx";

-- DropIndex
DROP INDEX "Trend_createdAt_idx";

-- DropIndex
DROP INDEX "Project_createdAt_idx";

-- DropIndex
DROP INDEX "Clip_status_idx";

-- DropIndex
DROP INDEX "Schedule_status_idx";

-- DropIndex
DROP INDEX "Metric_clipId_idx";

-- DropIndex
DROP INDEX "Metric_fetchedAt_idx";

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "retentionDays" INTEGER NOT NULL DEFAULT 30,
    "trialGranted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invite" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "tokenHash" TEXT NOT NULL,
    "invitedById" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelConnection" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'youtube',
    "externalId" TEXT,
    "title" TEXT,
    "refreshTokenEnc" TEXT NOT NULL,
    "scopes" TEXT,
    "legacyClientId" TEXT,
    "legacyClientSecretEnc" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastError" TEXT,
    "connectedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "payload" TEXT NOT NULL,
    "result" TEXT,
    "progress" TEXT,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "runAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseUntil" TIMESTAMP(3),
    "lockedBy" TEXT,
    "projectId" TEXT,
    "clipId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'razorpay',
    "providerSubscriptionId" TEXT NOT NULL,
    "providerCustomerId" TEXT,
    "planId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageEntry" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'reserved',
    "refType" TEXT,
    "refId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsageEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "detail" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthToken_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "workspaceId" TEXT;

-- AlterTable
ALTER TABLE "ApprovalQueue" ADD COLUMN     "workspaceId" TEXT;

-- AlterTable
ALTER TABLE "Trend" ADD COLUMN     "workspaceId" TEXT;

-- AlterTable
ALTER TABLE "Analytics" ADD COLUMN     "workspaceId" TEXT;

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "defaultLanguage" TEXT DEFAULT 'auto',
ADD COLUMN     "workspaceId" TEXT,
ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "language" TEXT DEFAULT 'auto',
ADD COLUMN     "rightsConfirmed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sourceBlobPath" TEXT,
ADD COLUMN     "stage" TEXT,
ADD COLUMN     "workspaceId" TEXT;

-- AlterTable
ALTER TABLE "Clip" ADD COLUMN     "captionPosition" TEXT NOT NULL DEFAULT 'bottom',
ADD COLUMN     "captionStyle" TEXT NOT NULL DEFAULT 'Dynamic Pop',
ADD COLUMN     "captionWords" TEXT,
ADD COLUMN     "containsSyntheticMedia" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "cropX" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
ADD COLUMN     "layout" TEXT NOT NULL DEFAULT 'fill',
ADD COLUMN     "madeForKids" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "publishDescription" TEXT,
ADD COLUMN     "publishTags" TEXT,
ADD COLUMN     "publishTitle" TEXT,
ADD COLUMN     "renderBlobPath" TEXT,
ADD COLUMN     "renderedAspect" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "workspaceId" TEXT;

-- AlterTable
ALTER TABLE "Schedule" ADD COLUMN     "lockKey" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "workspaceId" TEXT;

-- AlterTable
ALTER TABLE "Metric" ADD COLUMN     "workspaceId" TEXT;

-- AlterTable
ALTER TABLE "TrendSignal" ADD COLUMN     "workspaceId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- ─── Backfill: everything that existed before workspaces belongs to one ───
-- ─── legacy workspace, owned by the first account that was created.     ───
INSERT INTO "Workspace" ("id", "name", "retentionDays", "trialGranted", "createdAt", "updatedAt")
SELECT 'ws_legacy', COALESCE((SELECT "brandName" FROM "Settings" WHERE "id" = 'default'), 'My workspace'), 3650, true, NOW(), NOW()
WHERE EXISTS (SELECT 1 FROM "User") OR EXISTS (SELECT 1 FROM "Project") OR EXISTS (SELECT 1 FROM "Settings")
   OR EXISTS (SELECT 1 FROM "ApprovalQueue") OR EXISTS (SELECT 1 FROM "Trend") OR EXISTS (SELECT 1 FROM "Video");

-- Everyone already had full access to the shared workspace (sign-up was
-- invite-only), so they stay in it: the earliest account becomes owner.
INSERT INTO "Membership" ("id", "workspaceId", "userId", "role", "createdAt")
SELECT 'mem_' || u."id", 'ws_legacy', u."id",
       CASE WHEN u."id" = (SELECT MIN("id") FROM "User") THEN 'owner' ELSE 'admin' END,
       NOW()
FROM "User" u
WHERE EXISTS (SELECT 1 FROM "Workspace" WHERE "id" = 'ws_legacy');

UPDATE "Video" SET "workspaceId" = 'ws_legacy' WHERE "workspaceId" IS NULL;
UPDATE "ApprovalQueue" SET "workspaceId" = 'ws_legacy' WHERE "workspaceId" IS NULL;
UPDATE "Trend" SET "workspaceId" = 'ws_legacy' WHERE "workspaceId" IS NULL;
UPDATE "Analytics" SET "workspaceId" = 'ws_legacy' WHERE "workspaceId" IS NULL;
UPDATE "Settings" SET "workspaceId" = 'ws_legacy' WHERE "workspaceId" IS NULL;
UPDATE "Project" SET "workspaceId" = 'ws_legacy' WHERE "workspaceId" IS NULL;
UPDATE "Clip" SET "workspaceId" = 'ws_legacy' WHERE "workspaceId" IS NULL;
UPDATE "Schedule" SET "workspaceId" = 'ws_legacy' WHERE "workspaceId" IS NULL;
UPDATE "Metric" SET "workspaceId" = 'ws_legacy' WHERE "workspaceId" IS NULL;
UPDATE "TrendSignal" SET "workspaceId" = 'ws_legacy' WHERE "workspaceId" IS NULL;

-- Accounts that existed before this release were admitted by allowlist;
-- treat their addresses as verified so the upgrade doesn't lock them out.
UPDATE "User" SET "emailVerified" = NOW() WHERE "emailVerified" IS NULL;

-- Clip status "approved" used to mean "sent to the review queue". It now means
-- a person approved it; "in_review" is the queued state.
UPDATE "Clip" c SET "status" = 'in_review'
WHERE c."status" = 'approved'
  AND NOT EXISTS (SELECT 1 FROM "ApprovalQueue" q WHERE q."clipId" = c."id" AND q."status" = 'approved');

-- Work that was in flight on the old worker (whose jobs lived only in its
-- memory) can't be resumed by the new job queue; say so instead of spinning.
UPDATE "Clip" SET "renderStatus" = 'failed', "renderError" = 'Interrupted by a system upgrade. Export it again.', "renderJobId" = NULL
WHERE "renderStatus" IN ('rendering', 'pending');
UPDATE "Project" SET "status" = 'failed', "errorMessage" = 'Interrupted by a system upgrade. Please add this recording again.', "transcriptJobId" = NULL
WHERE "status" IN ('transcribing', 'processing');

-- One publish lock per clip+platform for what's already published.
UPDATE "Schedule" s SET "lockKey" = s."clipId" || ':' || s."platform"
WHERE s."id" IN (
  SELECT DISTINCT ON ("clipId", "platform") "id" FROM "Schedule"
  WHERE "status" = 'published' AND "clipId" IS NOT NULL
  ORDER BY "clipId", "platform", "createdAt" ASC
);

-- Keep an existing YouTube connection working. It was made with the
-- workspace's own Google Cloud client, so that client is carried over. The
-- "plain:" values are encrypted by the app the first time they're used.
INSERT INTO "ChannelConnection" ("id", "workspaceId", "provider", "refreshTokenEnc", "legacyClientId", "legacyClientSecretEnc", "status", "createdAt", "updatedAt")
SELECT 'chan_legacy_youtube', 'ws_legacy', 'youtube', 'plain:' || s."youtubeRefreshToken", s."youtubeClientId",
       'plain:' || s."youtubeClientSecret", 'active', NOW(), NOW()
FROM "Settings" s
WHERE s."id" = 'default' AND s."workspaceId" = 'ws_legacy'
  AND s."youtubeRefreshToken" IS NOT NULL AND s."youtubeClientId" IS NOT NULL AND s."youtubeClientSecret" IS NOT NULL;

-- Rows that can't be attributed to any workspace (nothing existed to own
-- them) would block the NOT NULL constraint below; there are none unless
-- the table was empty of users and settings, in which case drop them.
DELETE FROM "Video" WHERE "workspaceId" IS NULL;
DELETE FROM "ApprovalQueue" WHERE "workspaceId" IS NULL;
DELETE FROM "Trend" WHERE "workspaceId" IS NULL;
DELETE FROM "Analytics" WHERE "workspaceId" IS NULL;
DELETE FROM "Settings" WHERE "workspaceId" IS NULL;
DELETE FROM "Project" WHERE "workspaceId" IS NULL;
DELETE FROM "Clip" WHERE "workspaceId" IS NULL;
DELETE FROM "Schedule" WHERE "workspaceId" IS NULL;
DELETE FROM "Metric" WHERE "workspaceId" IS NULL;
DELETE FROM "TrendSignal" WHERE "workspaceId" IS NULL;

ALTER TABLE "Video" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "ApprovalQueue" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "Trend" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "Analytics" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "Settings" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "Project" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "Clip" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "Schedule" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "Metric" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "TrendSignal" ALTER COLUMN "workspaceId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Membership_userId_idx" ON "Membership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_workspaceId_userId_key" ON "Membership"("workspaceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Invite_tokenHash_key" ON "Invite"("tokenHash");

-- CreateIndex
CREATE INDEX "Invite_workspaceId_idx" ON "Invite"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelConnection_workspaceId_provider_key" ON "ChannelConnection"("workspaceId", "provider");

-- CreateIndex
CREATE INDEX "Job_status_type_runAfter_idx" ON "Job"("status", "type", "runAfter");

-- CreateIndex
CREATE INDEX "Job_workspaceId_createdAt_idx" ON "Job"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "Job_projectId_idx" ON "Job"("projectId");

-- CreateIndex
CREATE INDEX "Job_clipId_idx" ON "Job"("clipId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_workspaceId_key" ON "Subscription"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_providerSubscriptionId_key" ON "Subscription"("providerSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingEvent_eventId_key" ON "BillingEvent"("eventId");

-- CreateIndex
CREATE INDEX "UsageEntry_workspaceId_metric_createdAt_idx" ON "UsageEntry"("workspaceId", "metric", "createdAt");

-- CreateIndex
CREATE INDEX "UsageEntry_refType_refId_idx" ON "UsageEntry"("refType", "refId");

-- CreateIndex
CREATE INDEX "AuditEvent_workspaceId_createdAt_idx" ON "AuditEvent"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_userId_createdAt_idx" ON "AuditEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "LoginAttempt_key_createdAt_idx" ON "LoginAttempt"("key", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuthToken_tokenHash_key" ON "AuthToken"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthToken_userId_purpose_idx" ON "AuthToken"("userId", "purpose");

-- CreateIndex
CREATE INDEX "Video_workspaceId_createdAt_idx" ON "Video"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "ApprovalQueue_workspaceId_status_createdAt_idx" ON "ApprovalQueue"("workspaceId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Trend_workspaceId_createdAt_idx" ON "Trend"("workspaceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Analytics_workspaceId_key" ON "Analytics"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Settings_workspaceId_key" ON "Settings"("workspaceId");

-- CreateIndex
CREATE INDEX "Project_workspaceId_createdAt_idx" ON "Project"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "Clip_workspaceId_status_idx" ON "Clip"("workspaceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Schedule_lockKey_key" ON "Schedule"("lockKey");

-- CreateIndex
CREATE INDEX "Schedule_workspaceId_status_idx" ON "Schedule"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "Metric_clipId_platform_fetchedAt_idx" ON "Metric"("clipId", "platform", "fetchedAt");

-- CreateIndex
CREATE INDEX "Metric_workspaceId_fetchedAt_idx" ON "Metric"("workspaceId", "fetchedAt");

-- CreateIndex
CREATE INDEX "TrendSignal_workspaceId_idx" ON "TrendSignal"("workspaceId");

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalQueue" ADD CONSTRAINT "ApprovalQueue_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trend" ADD CONSTRAINT "Trend_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Analytics" ADD CONSTRAINT "Analytics_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settings" ADD CONSTRAINT "Settings_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Clip" ADD CONSTRAINT "Clip_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Metric" ADD CONSTRAINT "Metric_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrendSignal" ADD CONSTRAINT "TrendSignal_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelConnection" ADD CONSTRAINT "ChannelConnection_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageEntry" ADD CONSTRAINT "UsageEntry_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
