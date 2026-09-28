-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE INDEX "ApprovalQueue_status_createdAt_idx" ON "ApprovalQueue"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ApprovalQueue_clipId_idx" ON "ApprovalQueue"("clipId");

-- CreateIndex
CREATE INDEX "Clip_projectId_idx" ON "Clip"("projectId");

-- CreateIndex
CREATE INDEX "Clip_status_idx" ON "Clip"("status");

-- CreateIndex
CREATE INDEX "Metric_clipId_idx" ON "Metric"("clipId");

-- CreateIndex
CREATE INDEX "Metric_fetchedAt_idx" ON "Metric"("fetchedAt");

-- CreateIndex
CREATE INDEX "Project_createdAt_idx" ON "Project"("createdAt");

-- CreateIndex
CREATE INDEX "Project_status_idx" ON "Project"("status");

-- CreateIndex
CREATE INDEX "Schedule_clipId_idx" ON "Schedule"("clipId");

-- CreateIndex
CREATE INDEX "Schedule_status_idx" ON "Schedule"("status");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Trend_createdAt_idx" ON "Trend"("createdAt");

-- CreateIndex
CREATE INDEX "Video_createdAt_idx" ON "Video"("createdAt");
