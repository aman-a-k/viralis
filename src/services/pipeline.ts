import { randomUUID } from 'node:crypto';
import { after } from 'next/server';
import type { Job, Project, Clip } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { HttpError, badRequest, paymentRequired } from '../lib/http';
import {
  enqueueJob,
  claimJob,
  finishJob,
  heartbeatJob,
  failJob,
  yieldJob,
  parsePayload,
  workerConfigured,
  findAbandonedJobs,
  cancelJobs,
} from '../lib/jobs';
import { reserveUsage, commitUsage, releaseUsage, linkUsage, getEntitlement } from '../lib/usage';
import { belongsToWorkspace, sourcePathPrefix, signedReadUrl, renderPathPrefix, isBlobUrl, deleteMedia } from '../lib/storage';
import {
  segmentsToWords,
  wordsInRange,
  buildCues,
  cueOptionsForStyle,
  cueCoverage,
  parseWords,
  parseSegments,
  tokenize,
  type TranscriptSegment,
  type TranscriptWord,
  type CaptionCue,
} from '../lib/captions';
import { describeLlmError, MissingApiKeyError } from '../lib/llm';
import { analyzeChunk, chunkTranscript, selectClips, candidatesPerChunk, type AnalyzedClip, type AnalyzeOptions } from './analyzerService';
import { fetchYouTubeMetadata, fetchYouTubeVideo, fetchYouTubeDurationSeconds, extractVideoId } from './youtubeService';
import { FeedbackLoopService } from './feedbackLoopService';

export interface RunConfig {
  platforms?: string[];
  orientations?: string[];
  captionStyle?: string;
  language?: string;
}

export interface Actor {
  workspaceId: string;
  userId: string;
  /** Platform admins aren't metered. */
  unlimited?: boolean;
}

const DEFAULT_ORIENTATIONS = ['9:16', '1:1', '16:9'];
const ASPECTS = ['9:16', '1:1', '16:9'] as const;
export type Aspect = (typeof ASPECTS)[number];
export const isAspect = (v: unknown): v is Aspect => typeof v === 'string' && (ASPECTS as readonly string[]).includes(v);

const LANGUAGES = new Set(['auto', 'en', 'hi', 'kn', 'ta', 'te', 'ml', 'mr', 'bn', 'gu', 'pa', 'ur', 'es', 'fr', 'de', 'pt', 'it', 'ja', 'ko', 'zh', 'ar', 'id']);
export const normalizeLanguage = (v: unknown) => (typeof v === 'string' && LANGUAGES.has(v) ? v : 'auto');

export function normalizeConfig(body: Record<string, unknown>): RunConfig {
  const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 10) : undefined);
  return {
    platforms: arr(body.platforms)?.length ? arr(body.platforms) : undefined,
    orientations: arr(body.orientations)?.filter((o) => isAspect(o)).length ? arr(body.orientations)!.filter((o) => isAspect(o)) : undefined,
    captionStyle: body.captionStyle === 'Minimalist' ? 'Minimalist' : 'Dynamic Pop',
    language: normalizeLanguage(body.language),
  };
}

export const clampClipCount = (v: unknown) => Math.min(10, Math.max(3, Number(v) || 5));

interface AnalyzePayload {
  desiredClipCount: number;
  config: RunConfig;
  autoQueue?: boolean;
  /** Re-analysis replaces existing candidates instead of adding more. */
  replaceCandidates?: boolean;
}

interface AnalyzeProgress {
  candidates: AnalyzedClip[];
  doneChunks: number[];
}

interface TranscribePayload {
  source: { blobPath: string } | { legacyUrl: string } | { youtubeUrl: string };
  language: string;
  usageEntryId: string;
  reservedSeconds: number;
  analyze: AnalyzePayload;
}

interface RenderPayload {
  clipId: string;
  aspectRatio: Aspect;
  captionStyle: string;
  captionPosition: string;
  layout: string;
  cropX: number;
  startTime: number;
  endTime: number;
  cues: CaptionCue[];
  source: TranscribePayload['source'];
  usageEntryId: string;
}

// ─── Ingest ──────────────────────────────────────────────────────────────

async function checkLength(actor: Actor, seconds: number) {
  const ent = await getEntitlement(actor.workspaceId, { unlimited: actor.unlimited });
  if (ent.source === 'none') throw paymentRequired('Choose a plan to process recordings.', 'no_plan');
  if (seconds > ent.plan.maxSourceMinutes * 60) {
    throw paymentRequired(
      `This recording is ${Math.ceil(seconds / 60)} minutes long; your plan accepts recordings up to ${ent.plan.maxSourceMinutes} minutes.`,
      'too_long'
    );
  }
  return ent;
}

function requireWorker() {
  if (!workerConfigured()) {
    throw new HttpError(503, 'Video processing is temporarily unavailable. Please try again later.', 'worker_unavailable');
  }
}

/** A file the browser uploaded to this workspace's private storage area. */
export async function ingestUpload(
  actor: Actor,
  input: { blobPath: string; title: string; durationSeconds: number; clipCount: number; config: RunConfig; rightsConfirmed: boolean }
) {
  if (!input.rightsConfirmed) throw badRequest('Confirm you own this recording or have permission to use it.');
  if (!belongsToWorkspace(actor.workspaceId, input.blobPath) || !input.blobPath.includes(`/sources/`)) {
    throw badRequest('That upload isn’t from your workspace.');
  }
  requireWorker();
  const estimate = Math.max(60, Math.ceil(Number(input.durationSeconds) || 0));
  await checkLength(actor, estimate);

  const usage = await reserveUsage(actor.workspaceId, 'source_seconds', estimate, { refType: 'project', note: 'upload' }, { unlimited: actor.unlimited });
  try {
    const project = await prisma.project.create({
      data: {
        workspaceId: actor.workspaceId,
        createdById: actor.userId,
        title: input.title.trim().slice(0, 200) || 'Uploaded recording',
        sourceType: 'upload',
        sourceBlobPath: input.blobPath,
        language: input.config.language || 'auto',
        rightsConfirmed: true,
        status: 'transcribing',
        stage: 'Waiting to transcribe',
        metadata: JSON.stringify({ ingestedAt: new Date().toISOString() }),
      },
    });
    await linkUsage(usage.id, project.id);
    const job = await enqueueJob({
      workspaceId: actor.workspaceId,
      type: 'transcribe',
      projectId: project.id,
      payload: {
        source: { blobPath: input.blobPath },
        language: project.language || 'auto',
        usageEntryId: usage.id,
        reservedSeconds: estimate,
        analyze: { desiredClipCount: input.clipCount, config: input.config },
      } satisfies TranscribePayload,
    });
    return prisma.project.update({ where: { id: project.id }, data: { transcriptJobId: job.id } });
  } catch (err) {
    await releaseUsage(usage.id, 'ingest failed');
    throw err;
  }
}

/** A YouTube link. Captions are used when reachable; otherwise the worker transcribes. */
export async function ingestYouTube(
  actor: Actor,
  input: { url: string; clipCount: number; config: RunConfig; rightsConfirmed: boolean; autoQueue?: boolean }
) {
  if (!input.rightsConfirmed) {
    throw badRequest('Confirm you own this video or have the rights holder’s permission to reuse it.');
  }
  const videoId = extractVideoId(input.url);
  if (!videoId) throw badRequest('That doesn’t look like a YouTube video link.');

  const apiDuration = await fetchYouTubeDurationSeconds(videoId);
  if (apiDuration) await checkLength(actor, apiDuration);

  // Captions straight from YouTube are fastest, but YouTube usually blocks
  // this from cloud servers; the worker's own transcription is the fallback.
  let direct: Awaited<ReturnType<typeof fetchYouTubeVideo>> | null = null;
  try {
    direct = await fetchYouTubeVideo(input.url);
  } catch {
    direct = null;
  }
  const seconds = apiDuration || direct?.durationSeconds || 600;
  if (!apiDuration) await checkLength(actor, seconds);
  if (!direct) requireWorker();

  const usage = await reserveUsage(actor.workspaceId, 'source_seconds', seconds, { refType: 'project', note: 'youtube' }, { unlimited: actor.unlimited });
  try {
    const meta = direct ?? (await fetchYouTubeMetadata(input.url));
    const analyze: AnalyzePayload = { desiredClipCount: input.clipCount, config: input.config, autoQueue: input.autoQueue };
    const project = await prisma.project.create({
      data: {
        workspaceId: actor.workspaceId,
        createdById: actor.userId,
        title: meta.title,
        sourceVideoUrl: meta.url,
        sourceVideoId: meta.videoId,
        sourceType: 'youtube',
        channel: meta.author,
        thumbnail: meta.thumbnail,
        language: input.config.language || 'auto',
        rightsConfirmed: true,
        duration: seconds,
        status: direct ? 'analyzing' : 'transcribing',
        stage: direct ? 'Finding clips' : 'Waiting to transcribe',
        transcript: direct?.fullText,
        transcriptJson: direct ? JSON.stringify(direct.transcript) : undefined,
        metadata: JSON.stringify({ transcriptSource: direct ? 'youtube-captions' : 'worker', ingestedAt: new Date().toISOString() }),
      },
    });
    await linkUsage(usage.id, project.id);

    if (direct) {
      await commitUsage(usage.id, direct.durationSeconds || seconds);
      await startAnalysis(project, analyze);
      return project;
    }
    const job = await enqueueJob({
      workspaceId: actor.workspaceId,
      type: 'transcribe',
      projectId: project.id,
      payload: {
        source: { youtubeUrl: meta.url },
        language: project.language || 'auto',
        usageEntryId: usage.id,
        reservedSeconds: seconds,
        analyze,
      } satisfies TranscribePayload,
    });
    return prisma.project.update({ where: { id: project.id }, data: { transcriptJobId: job.id } });
  } catch (err) {
    await releaseUsage(usage.id, 'ingest failed');
    throw err;
  }
}

/** Splits pasted text into sentence-sized segments with estimated timing (~2.5 words/s). */
export function transcriptFromText(text: string): TranscriptSegment[] {
  const sentences = text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?।])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const segments: TranscriptSegment[] = [];
  let t = 0;
  for (const sentence of sentences) {
    const dur = Math.max(1.5, tokenize(sentence).length / 2.5);
    segments.push({ text: sentence, start: Math.round(t * 10) / 10, end: Math.round((t + dur) * 10) / 10 });
    t += dur;
  }
  return segments;
}

export async function ingestTranscript(actor: Actor, input: { title: string; text: string; clipCount: number; config: RunConfig }) {
  const text = input.text.trim();
  if (text.length < 200) throw badRequest('Paste a transcript of at least ~200 characters.');
  if (text.length > 400_000) throw badRequest('That transcript is too long. Split it into parts under ~400,000 characters.');
  const segments = transcriptFromText(text);
  const seconds = Math.ceil(segments[segments.length - 1]?.end || 60);
  await checkLength(actor, seconds);

  const usage = await reserveUsage(actor.workspaceId, 'source_seconds', seconds, { refType: 'project', note: 'transcript' }, { unlimited: actor.unlimited });
  try {
    const project = await prisma.project.create({
      data: {
        workspaceId: actor.workspaceId,
        createdById: actor.userId,
        title: input.title.trim().slice(0, 200) || 'Pasted transcript',
        sourceType: 'transcript',
        transcript: text,
        transcriptJson: JSON.stringify(segments),
        duration: seconds,
        language: input.config.language || 'auto',
        rightsConfirmed: true,
        status: 'analyzing',
        stage: 'Finding clips',
      },
    });
    await linkUsage(usage.id, project.id);
    await commitUsage(usage.id, seconds);
    await startAnalysis(project, { desiredClipCount: input.clipCount, config: input.config });
    return project;
  } catch (err) {
    await releaseUsage(usage.id, 'ingest failed');
    throw err;
  }
}

// ─── Analysis (runs in the app, in slices) ───────────────────────────────

async function startAnalysis(project: Pick<Project, 'id' | 'workspaceId'>, payload: AnalyzePayload) {
  const job = await enqueueJob({
    workspaceId: project.workspaceId,
    type: 'analyze',
    projectId: project.id,
    payload: payload as unknown as Record<string, unknown>,
    maxAttempts: 4,
  });
  kickAnalysis(job.id);
  return job;
}

/** Runs an analysis slice after the current response is sent. */
export function kickAnalysis(jobId?: string, projectId?: string) {
  const run = () => runAnalysisSlice({ jobId, projectId }).catch((err) => console.error('[analysis]', err));
  try {
    after(run);
  } catch {
    void run();
  }
}

/** Re-runs clip finding on a project's stored transcript. */
export async function reanalyzeProject(actor: Actor, projectId: string, clipCount: number, config: RunConfig) {
  const project = await prisma.project.findFirst({ where: { id: projectId, workspaceId: actor.workspaceId } });
  if (!project) throw new HttpError(404, 'Project not found.');
  if (!project.transcriptJson) throw badRequest('This project has no transcript yet.');
  if (['transcribing', 'analyzing'].includes(project.status)) throw badRequest('This project is still being processed.');
  await prisma.project.update({ where: { id: project.id }, data: { status: 'analyzing', stage: 'Finding clips', errorMessage: null } });
  // Re-analysis reuses the already-paid-for transcript, so it isn't metered.
  await startAnalysis(project, { desiredClipCount: clipCount, config, replaceCandidates: true });
}

const ANALYSIS_CONCURRENCY = 2;

/**
 * Advances one analysis job by as many transcript windows as fit in the time
 * budget, saving progress between slices. Safe to call from anywhere (poll
 * endpoint, worker callbacks, cron): the job lease ensures only one caller
 * works on a job at a time.
 */
export async function runAnalysisSlice(opts: { jobId?: string; projectId?: string; budgetMs?: number } = {}) {
  const holder = `app:${randomUUID()}`;
  const job = await claimJob(holder, ['analyze'], { jobId: opts.jobId, projectId: opts.projectId });
  if (!job) return null;
  const deadline = Date.now() + (opts.budgetMs ?? 40_000);
  const payload = parsePayload<AnalyzePayload>(job);
  const progress: AnalyzeProgress = job.result ? JSON.parse(job.result) : { candidates: [], doneChunks: [] };

  const project = job.projectId ? await prisma.project.findUnique({ where: { id: job.projectId } }) : null;
  if (!project) {
    await failJob(job.id, holder, 'Project no longer exists.', false);
    return null;
  }
  const segments = parseSegments(project.transcriptJson);
  if (!segments.length) {
    await failJob(job.id, holder, 'No speech was found in this recording.', false);
    await markProjectFailed(project.id, 'No speech was found in this recording.');
    return null;
  }

  const chunks = chunkTranscript(segments);
  const perChunk = candidatesPerChunk(payload.desiredClipCount, chunks.length);
  const settings = await prisma.settings.findUnique({ where: { workspaceId: project.workspaceId } });
  const options: AnalyzeOptions = {
    ...payload.config,
    language: project.language || payload.config.language,
    performanceNotes: (await FeedbackLoopService.getPerformanceNotes(project.workspaceId)) || undefined,
    brand: { name: settings?.brandName, niche: settings?.brandNiche, tone: settings?.brandTone, audience: settings?.targetAudience },
  };
  const meta = { title: project.title, author: project.channel || 'the speaker', durationSeconds: Math.ceil(segments[segments.length - 1].end) };

  try {
    let pending = chunks.filter((c) => !progress.doneChunks.includes(c.index));
    // Always make progress: at least one batch per slice, then as many as fit.
    let first = true;
    while (pending.length && (first || Date.now() < deadline)) {
      first = false;
      // Keep the lease while a slow AI call runs; if another run took the
      // job over meanwhile, stop — that run owns the result now.
      if (!(await heartbeatJob(job.id, holder, `Analyzing ${progress.doneChunks.length}/${chunks.length} parts`))) return null;
      const batch = pending.slice(0, ANALYSIS_CONCURRENCY);
      const results = await Promise.all(batch.map((c) => analyzeChunk(meta, c, perChunk, options)));
      results.forEach((r, i) => {
        progress.candidates.push(...r);
        progress.doneChunks.push(batch[i].index);
      });
      pending = pending.slice(batch.length);
      await prisma.project.update({
        where: { id: project.id },
        data: { stage: chunks.length > 1 ? `Finding clips (${progress.doneChunks.length}/${chunks.length} parts)` : 'Finding clips' },
      });
    }

    if (pending.length) {
      await yieldJob(job.id, holder, progress, { progress: `Analyzed ${progress.doneChunks.length}/${chunks.length} parts` });
      kickAnalysis(job.id);
      return { status: 'partial' as const };
    }

    const selected = selectClips(progress.candidates, segments, payload.desiredClipCount);
    if (!selected.length) {
      await finishJob(job.id, holder, { clips: 0 });
      await markProjectFailed(project.id, 'No usable highlights were found in this recording. Try a recording with more continuous speech.');
      return { status: 'failed' as const };
    }

    const clips = await prisma.$transaction(async (tx) => {
      // Complete the job and save its clips atomically, and only while this
      // run still holds it — otherwise a run whose lease lapsed and a newer
      // one could both save a full set of clips.
      const owned = await tx.job.updateMany({
        where: { id: job.id, lockedBy: holder, status: 'running' },
        data: { status: 'succeeded', result: JSON.stringify({ clips: selected.length }), progress: 'Done', finishedAt: new Date(), leaseUntil: null, error: null },
      });
      if (owned.count === 0) return null;
      if (payload.replaceCandidates) await tx.clip.deleteMany({ where: { projectId: project.id, status: 'candidate', renderStatus: null } });
      const orientations = payload.config.orientations?.length ? payload.config.orientations : DEFAULT_ORIENTATIONS;
      const created: Clip[] = [];
      for (const h of selected) {
        created.push(
          await tx.clip.create({
            data: {
              workspaceId: project.workspaceId,
              projectId: project.id,
              title: h.title,
              startTime: h.startTime,
              endTime: h.endTime,
              duration: Math.round(h.endTime - h.startTime),
              viralityScore: h.viralityScore,
              reasoning: h.reasoning,
              hookType: h.hookType,
              aspectRatios: JSON.stringify(orientations),
              transcriptSegment: h.transcriptSegment,
              captionVersions: JSON.stringify(h.captions),
              captionStyle: payload.config.captionStyle === 'Minimalist' ? 'Minimalist' : 'Dynamic Pop',
              publishTitle: (h.captions.youtube?.split('\n')[0] || h.title).slice(0, 100),
              publishDescription: h.captions.youtube || null,
              status: 'candidate',
            },
          })
        );
      }
      await tx.project.update({ where: { id: project.id }, data: { status: 'ready', stage: null, errorMessage: null } });
      return created;
    });
    if (!clips) return null;

    if (payload.autoQueue) {
      for (const clip of clips) {
        await sendToReview({ workspaceId: project.workspaceId, userId: project.createdById || 'system' }, clip.id).catch(() => {});
      }
    }
    return { status: 'done' as const, clips: clips.length };
  } catch (err) {
    const message = err instanceof MissingApiKeyError ? err.message : describeLlmError(err);
    const status = (err as { status?: number })?.status;
    if (status === 429) {
      // Provider rate limit: come back in a minute without burning an attempt.
      await yieldJob(job.id, holder, progress, { delaySeconds: 60, progress: 'Waiting for the AI service' });
      return { status: 'partial' as const };
    }
    const failed = await failJob(job.id, holder, message, !(err instanceof MissingApiKeyError));
    if (failed?.terminal) await markProjectFailed(project.id, message);
    else await prisma.job.update({ where: { id: job.id }, data: { result: JSON.stringify(progress) } });
    return { status: 'error' as const, message };
  }
}

async function markProjectFailed(projectId: string, message: string) {
  await prisma.project.update({ where: { id: projectId }, data: { status: 'failed', stage: null, errorMessage: message.slice(0, 500) } });
}

// ─── Rendering ───────────────────────────────────────────────────────────

function renderSource(project: Project): RenderPayload['source'] {
  if (project.sourceType === 'youtube' && project.sourceVideoUrl) return { youtubeUrl: project.sourceVideoUrl };
  if (project.sourceBlobPath) return { blobPath: project.sourceBlobPath };
  if (project.sourceVideoUrl && isBlobUrl(project.sourceVideoUrl)) return { legacyUrl: project.sourceVideoUrl };
  throw badRequest('This clip has no source video to render from (it came from a pasted transcript). Download the captions instead.');
}

/** The words that will be burned into a clip: the editor's version, else the transcript's. */
export function clipWords(clip: Pick<Clip, 'captionWords' | 'startTime' | 'endTime'>, project: Pick<Project, 'transcriptJson'>): TranscriptWord[] {
  const edited = parseWords(clip.captionWords);
  if (edited) return edited;
  return wordsInRange(segmentsToWords(parseSegments(project.transcriptJson)), clip.startTime, clip.endTime);
}

export function clipCues(clip: Clip, project: Project, style = clip.captionStyle) {
  const words = clipWords(clip, project);
  const cues = buildCues(words, clip.startTime, clip.endTime, cueOptionsForStyle(style));
  return { words, cues, coverage: cueCoverage(words, cues) };
}

export async function requestRender(actor: Actor, clipId: string, aspectRatio: Aspect) {
  const clip = await prisma.clip.findFirst({ where: { id: clipId, workspaceId: actor.workspaceId }, include: { project: true } });
  if (!clip) throw new HttpError(404, 'Clip not found.');
  if (clip.status === 'rejected') throw badRequest('This clip was rejected. Restore it before exporting.');
  if (clip.renderStatus === 'queued' || clip.renderStatus === 'rendering') return clip;
  const source = renderSource(clip.project);
  requireWorker();

  const { cues, coverage } = clipCues(clip, clip.project);
  if (cues.length && coverage < 1) {
    // Never ship captions that silently drop speech.
    throw new HttpError(500, 'Caption check failed for this clip. Please contact support.', 'caption_coverage');
  }

  const usage = await reserveUsage(actor.workspaceId, 'exports', 1, { refType: 'clip', refId: clip.id, note: aspectRatio }, { unlimited: actor.unlimited });
  try {
    const job = await enqueueJob({
      workspaceId: actor.workspaceId,
      type: 'render',
      clipId: clip.id,
      projectId: clip.projectId,
      payload: {
        clipId: clip.id,
        aspectRatio,
        captionStyle: clip.captionStyle,
        captionPosition: clip.captionPosition,
        layout: clip.layout,
        cropX: clip.cropX,
        startTime: clip.startTime,
        endTime: clip.endTime,
        cues,
        source,
        usageEntryId: usage.id,
      } satisfies RenderPayload,
    });
    return prisma.clip.update({
      where: { id: clip.id },
      data: { renderStatus: 'queued', renderJobId: job.id, renderError: null, renderedAspect: aspectRatio },
    });
  } catch (err) {
    await releaseUsage(usage.id, 'render enqueue failed');
    throw err;
  }
}

// ─── Worker hand-off ─────────────────────────────────────────────────────

/** What the worker needs to run a claimed job, with short-lived signed media URLs. */
export async function workerAssignment(job: Job) {
  const ttl = 6 * 60 * 60;
  const resolve = async (src: TranscribePayload['source']) => {
    if ('youtubeUrl' in src) return { youtubeUrl: src.youtubeUrl };
    if ('blobPath' in src) return { mediaUrl: await signedReadUrl(src.blobPath, ttl) };
    return { mediaUrl: src.legacyUrl };
  };
  if (job.type === 'transcribe') {
    const p = parsePayload<TranscribePayload>(job);
    return { jobId: job.id, type: job.type, attempt: job.attempts, source: await resolve(p.source), language: p.language };
  }
  const p = parsePayload<RenderPayload>(job);
  return {
    jobId: job.id,
    type: job.type,
    attempt: job.attempts,
    source: await resolve(p.source),
    clipId: p.clipId,
    startTime: p.startTime,
    endTime: p.endTime,
    aspectRatio: p.aspectRatio,
    captionStyle: p.captionStyle,
    captionPosition: p.captionPosition,
    layout: p.layout,
    cropX: p.cropX,
    cues: p.cues,
    outputPrefix: renderPathPrefix(job.workspaceId),
  };
}

interface TranscribeResult {
  segments: TranscriptSegment[];
  durationSeconds: number;
  language?: string;
}

interface RenderResult {
  pathname: string;
  bytes?: number;
}

/**
 * Checks a worker's result before the job is marked done. Returns an error
 * message for results the app must not accept (the job is then retried).
 */
export function invalidWorkerResult(job: Job, result: unknown): string | null {
  if (job.type === 'render') {
    const r = result as RenderResult | undefined;
    if (!r?.pathname || !r.pathname.startsWith(renderPathPrefix(job.workspaceId))) {
      return 'The export was stored in the wrong place.';
    }
  }
  if (job.type === 'transcribe') {
    const r = result as TranscribeResult | undefined;
    if (!r || !Array.isArray(r.segments)) return 'The transcription result was malformed.';
  }
  return null;
}

export async function onWorkerJobSucceeded(job: Job, result: unknown) {
  if (job.type === 'transcribe') {
    const p = parsePayload<TranscribePayload>(job);
    const r = result as TranscribeResult;
    const segments = Array.isArray(r?.segments) ? r.segments.filter((s) => s && typeof s.text === 'string') : [];
    if (!job.projectId) return;
    if (!segments.length) {
      await releaseUsage(p.usageEntryId, 'no speech');
      await markProjectFailed(job.projectId, 'No speech was detected in this recording.');
      return;
    }
    const actual = Math.ceil(Number(r.durationSeconds) || segments[segments.length - 1].end);

    // The upload's length was estimated by the browser; settle on the real one.
    if (actual > p.reservedSeconds + 60) {
      try {
        const extra = await reserveUsage(job.workspaceId, 'source_seconds', actual - p.reservedSeconds, { refType: 'project', refId: job.projectId, note: 'length correction' });
        await commitUsage(extra.id);
      } catch (err) {
        await releaseUsage(p.usageEntryId, 'over allowance after transcription');
        await markProjectFailed(job.projectId, err instanceof HttpError ? err.message : 'This recording is longer than your remaining allowance.');
        return;
      }
      await commitUsage(p.usageEntryId);
    } else {
      await commitUsage(p.usageEntryId, actual);
    }

    const fullText = segments.map((s) => s.text).join(' ');
    const project = await prisma.project.update({
      where: { id: job.projectId },
      data: {
        transcript: fullText,
        transcriptJson: JSON.stringify(segments),
        duration: actual,
        language: r.language && r.language !== 'auto' ? r.language : undefined,
        status: 'analyzing',
        stage: 'Finding clips',
        transcriptJobId: null,
      },
    });
    await startAnalysis(project, p.analyze);
    return;
  }

  if (job.type === 'render') {
    const p = parsePayload<RenderPayload>(job);
    const r = result as RenderResult;
    const clip = await prisma.clip.findUnique({ where: { id: p.clipId } });
    const previous = clip?.renderBlobPath;
    await prisma.clip.update({
      where: { id: p.clipId },
      data: { renderStatus: 'rendered', renderBlobPath: r.pathname, renderedAspect: p.aspectRatio, renderJobId: null, renderError: null },
    });
    await commitUsage(p.usageEntryId);
    if (previous && previous !== r.pathname) await deleteMedia([previous]);
  }
}

export async function onWorkerJobFailed(job: Job, error: string, terminal: boolean) {
  if (!terminal) {
    if (job.type === 'render' && job.clipId) {
      await prisma.clip.update({ where: { id: job.clipId }, data: { renderStatus: 'queued' } }).catch(() => {});
    }
    return;
  }
  if (job.type === 'transcribe') {
    const p = parsePayload<TranscribePayload>(job);
    await releaseUsage(p.usageEntryId, 'transcription failed');
    if (job.projectId) await markProjectFailed(job.projectId, error);
  }
  if (job.type === 'render') {
    const p = parsePayload<RenderPayload>(job);
    await releaseUsage(p.usageEntryId, 'render failed');
    await prisma.clip.update({ where: { id: p.clipId }, data: { renderStatus: 'failed', renderError: error.slice(0, 500), renderJobId: null } }).catch(() => {});
  }
  if (job.type === 'analyze' && job.projectId) {
    await markProjectFailed(job.projectId, error);
  }
}

/** Fails jobs whose last attempt's worker vanished, and settles their records. */
export async function sweepAbandonedJobs() {
  const abandoned = await findAbandonedJobs();
  for (const job of abandoned) {
    const res = await failJob(job.id, null, 'Processing was interrupted repeatedly. Please try again.', false);
    if (res) await onWorkerJobFailed(res.job, res.job.error || 'Processing failed.', true);
  }
  return abandoned.length;
}

export async function cancelProjectProcessing(workspaceId: string, projectId: string) {
  const jobs = await prisma.job.findMany({ where: { workspaceId, projectId, status: { in: ['queued', 'running'] } } });
  await cancelJobs({ workspaceId, projectId });
  for (const job of jobs) {
    const p = parsePayload<{ usageEntryId?: string }>(job);
    await releaseUsage(p.usageEntryId, 'canceled');
  }
}

// ─── Review ──────────────────────────────────────────────────────────────

/** Puts a clip in the review queue (status "in_review"). */
export async function sendToReview(actor: Pick<Actor, 'workspaceId' | 'userId'>, clipId: string) {
  const clip = await prisma.clip.findFirst({ where: { id: clipId, workspaceId: actor.workspaceId } });
  if (!clip) throw new HttpError(404, 'Clip not found.');
  if (clip.status === 'in_review' || clip.status === 'approved' || clip.status === 'published') return clip;

  let captions: Record<string, string> = {};
  try {
    captions = JSON.parse(clip.captionVersions);
  } catch {
    captions = {};
  }
  await prisma.$transaction([
    prisma.approvalQueue.create({
      data: {
        workspaceId: actor.workspaceId,
        topic: clip.title,
        script: clip.transcriptSegment,
        visualPrompts: '[]',
        captions: '[]',
        seoTitle: clip.publishTitle || captions.youtube?.slice(0, 100) || clip.title,
        seoDescription: clip.publishDescription || captions.youtube || clip.reasoning,
        seoTags: clip.publishTags || '[]',
        status: 'pending',
        clipId: clip.id,
      },
    }),
    prisma.clip.update({ where: { id: clip.id }, data: { status: 'in_review' } }),
  ]);
  return clip;
}

/**
 * A reviewer's decision. Approving a clip makes it publishable (and starts
 * its export if it hasn't been rendered); rejecting takes it out of play.
 */
export async function decideReview(actor: Actor, approvalId: string, decision: 'approve' | 'reject', reason?: string) {
  const item = await prisma.approvalQueue.findFirst({ where: { id: approvalId, workspaceId: actor.workspaceId } });
  if (!item) throw new HttpError(404, 'Item not found.');
  if (item.status !== 'pending') return { item, message: `Already ${item.status}.` };

  if (decision === 'reject') {
    await prisma.$transaction([
      prisma.approvalQueue.update({ where: { id: item.id }, data: { status: 'rejected', rejectionReason: reason?.slice(0, 500) || null } }),
      ...(item.clipId ? [prisma.clip.update({ where: { id: item.clipId }, data: { status: 'rejected' } })] : []),
    ]);
    return { item, message: 'Rejected.' };
  }

  await prisma.$transaction([
    prisma.approvalQueue.update({ where: { id: item.id }, data: { status: 'approved' } }),
    ...(item.clipId ? [prisma.clip.update({ where: { id: item.clipId }, data: { status: 'approved' } })] : []),
  ]);
  if (!item.clipId) return { item, message: 'Approved. The script is saved under Script ideas.' };

  const clip = await prisma.clip.findUnique({ where: { id: item.clipId }, include: { project: { select: { sourceType: true } } } });
  if (clip?.project.sourceType === 'transcript') {
    return { item, message: 'Approved. This clip came from a pasted transcript, so there’s no video to export — download its captions instead.' };
  }
  if (clip && !clip.renderBlobPath && !clip.videoUrl && !['queued', 'rendering'].includes(clip.renderStatus || '')) {
    try {
      await requestRender(actor, clip.id, (isAspect(clip.renderedAspect) ? clip.renderedAspect : '9:16'));
      return { item, message: 'Approved — exporting the video now.' };
    } catch (err) {
      const msg = err instanceof HttpError ? err.message : 'the export couldn’t start';
      return { item, message: `Approved, but ${msg.charAt(0).toLowerCase()}${msg.slice(1)}` };
    }
  }
  return { item, message: 'Approved.' };
}

// ─── Read models ─────────────────────────────────────────────────────────

/** Project + clips shaped for the browser: no storage paths, no transcripts. */
export async function projectView(workspaceId: string, projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId },
    include: {
      clips: { orderBy: [{ startTime: 'asc' }], include: { schedules: { where: { platform: 'youtube' }, orderBy: { createdAt: 'desc' }, take: 1 } } },
      jobs: { where: { status: { in: ['queued', 'running'] } }, orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });
  if (!project) return null;
  return serializeProject(project);
}

type ProjectWithClips = Project & {
  clips: (Clip & { schedules?: { status: string; postUrl: string | null; error: string | null }[] })[];
  jobs?: Job[];
};

export function serializeProject(p: ProjectWithClips) {
  const job = p.jobs?.[0];
  return {
    id: p.id,
    title: p.title,
    sourceType: p.sourceType,
    sourceVideoId: p.sourceVideoId,
    sourceVideoUrl: p.sourceType === 'youtube' ? p.sourceVideoUrl : null,
    hasSourceMedia: Boolean(p.sourceBlobPath || (p.sourceVideoUrl && p.sourceType !== 'youtube')),
    channel: p.channel,
    thumbnail: p.thumbnail,
    duration: p.duration,
    language: p.language,
    status: p.status,
    stage: job?.progress && job.status === 'running' ? p.stage || job.progress : p.stage,
    errorMessage: p.errorMessage,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    clips: p.clips.map(serializeClip),
  };
}

export function serializeClip(c: Clip & { schedules?: { status: string; postUrl: string | null; error: string | null }[] }) {
  let captions: Record<string, string> = {};
  try {
    captions = JSON.parse(c.captionVersions);
  } catch {
    captions = {};
  }
  let tags: string[] = [];
  try {
    tags = c.publishTags ? JSON.parse(c.publishTags) : [];
  } catch {
    tags = [];
  }
  const latest = c.schedules?.[0];
  return {
    id: c.id,
    projectId: c.projectId,
    title: c.title,
    startTime: c.startTime,
    endTime: c.endTime,
    duration: c.duration,
    viralityScore: c.viralityScore,
    reasoning: c.reasoning,
    hookType: c.hookType,
    transcriptSegment: c.transcriptSegment,
    captionVersions: captions,
    status: c.status,
    renderStatus: c.renderStatus,
    renderError: c.renderError,
    renderedAspect: c.renderedAspect,
    hasRender: Boolean(c.renderBlobPath || c.videoUrl),
    edited: Boolean(c.captionWords),
    cropX: c.cropX,
    layout: c.layout,
    captionPosition: c.captionPosition,
    captionStyle: c.captionStyle,
    publishTitle: c.publishTitle || c.title,
    publishDescription: c.publishDescription ?? captions.youtube ?? '',
    publishTags: tags,
    madeForKids: c.madeForKids,
    containsSyntheticMedia: c.containsSyntheticMedia,
    publish: latest ? { status: latest.status, postUrl: latest.postUrl, error: latest.error } : null,
    updatedAt: c.updatedAt,
  };
}

export { sourcePathPrefix };
