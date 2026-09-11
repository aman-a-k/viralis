-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "defaultOrientations" TEXT DEFAULT '["9:16","1:1","16:9"]',
ADD COLUMN     "defaultPlatforms" TEXT DEFAULT '["instagram","youtube","linkedin","twitter","tiktok"]',
ADD COLUMN     "youtubeDataApiKey" TEXT;
