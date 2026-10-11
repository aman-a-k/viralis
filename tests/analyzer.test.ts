import { describe, it, expect } from 'vitest';
import { chunkTranscript, selectClips, candidatesPerChunk, snapToSentences, type AnalyzedClip } from '@/services/analyzerService';
import { transcriptFromText } from '@/services/pipeline';
import type { TranscriptSegment } from '@/lib/captions';

const longTranscript = (minutes: number): TranscriptSegment[] =>
  Array.from({ length: minutes * 12 }, (_, i) => ({
    text: `Sentence number ${i} explains an important idea about the topic in some detail.`,
    start: i * 5,
    end: i * 5 + 5,
  }));

const clip = (start: number, end: number, score: number): AnalyzedClip => ({
  title: `c${start}`, startTime: start, endTime: end, viralityScore: score, reasoning: '', hookType: 'insight', transcriptSegment: '',
  captions: { instagram: 'x', youtube: 'x', linkedin: '', twitter: '', tiktok: '' },
});

describe('full-transcript analysis', () => {
  it('covers a 2-hour transcript from start to end (not just the first 13k chars)', () => {
    const segs = longTranscript(120);
    const chunks = chunkTranscript(segs);
    expect(chunks.length).toBeGreaterThan(5);
    expect(chunks[0].start).toBe(0);
    expect(chunks[chunks.length - 1].end).toBe(segs[segs.length - 1].end);
    // Consecutive windows overlap, so no moment falls between them.
    for (let i = 1; i < chunks.length; i++) expect(chunks[i].start).toBeLessThan(chunks[i - 1].end);
    for (const c of chunks) expect(c.text.length).toBeLessThanOrEqual(9200);
  });

  it('handles a short transcript in one window', () => {
    expect(chunkTranscript(longTranscript(2))).toHaveLength(1);
  });

  it('drops near-duplicate moments found by overlapping windows and keeps the best', () => {
    const segs = longTranscript(10);
    const picked = selectClips([clip(100, 140, 80), clip(105, 142, 90), clip(300, 330, 70), clip(400, 430, 60)], segs, 2);
    expect(picked.map((c) => c.startTime)).toEqual([105, 300]);
    expect(picked[0].transcriptSegment).toContain('Sentence number');
  });

  it('snaps clip edges to nearby sentence boundaries', () => {
    const segs = [
      { text: 'Energy is never used up.', start: 10, end: 14 },
      { text: 'It only changes form.', start: 14, end: 17 },
      { text: 'Think about a ball.', start: 17, end: 40 },
      { text: 'Next topic.', start: 40, end: 44 },
    ];
    const snapped = snapToSentences(clip(15.5, 38, 80), segs);
    expect(snapped.startTime).toBe(14);
    expect(snapped.endTime).toBe(40);
    // Far from any boundary: left alone.
    expect(snapToSentences(clip(25, 30, 80), [{ text: 'long', start: 0, end: 60 }]).startTime).toBe(25);
  });

  it('asks each window for enough candidates to choose from', () => {
    expect(candidatesPerChunk(5, 1)).toBe(8);
    expect(candidatesPerChunk(5, 10)).toBe(2);
  });

  it('turns pasted text into timed sentence segments', () => {
    const segs = transcriptFromText('First point here. Second point follows! और यह तीसरा है।');
    expect(segs).toHaveLength(3);
    expect(segs[1].start).toBeGreaterThan(segs[0].start);
    expect(segs[2].text).toContain('तीसरा');
  });
});
