-- AlterTable
ALTER TABLE "Metric" ADD COLUMN     "postId" TEXT,
ALTER COLUMN "watchThroughPct" DROP NOT NULL,
ALTER COLUMN "watchThroughPct" DROP DEFAULT;
