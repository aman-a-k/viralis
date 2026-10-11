import { describe, it, expect } from 'vitest';
import {
  buildCues, cueCoverage, cueOptionsForStyle, retimeEditedText, segmentsToWords, tokenize, wordsInRange,
  type TranscriptSegment, type TranscriptWord,
} from '@/lib/captions';

const words = (n: number, start = 0, perWord = 1 / 3): TranscriptWord[] =>
  Array.from({ length: n }, (_, i) => ({ w: `word${i}`, s: start + i * perWord, e: start + (i + 1) * perWord }));

describe('caption cues', () => {
  it('shows every word of a dense clip (review diagnostic: 180 words in 60s)', () => {
    const w = words(180, 0, 60 / 180);
    for (const style of ['Dynamic Pop', 'Minimalist']) {
      const cues = buildCues(w, 0, 60, cueOptionsForStyle(style));
      const shown = cues.flatMap((c) => c.text.split(' '));
      expect(shown).toHaveLength(180);
      expect(shown).toEqual(w.map((x) => x.w));
      expect(cueCoverage(w, cues)).toBe(1);
    }
  });

  it('keeps cues in order, non-overlapping and inside the clip', () => {
    const w = words(120, 10, 0.4);
    const cues = buildCues(w, 10, 58, cueOptionsForStyle('Dynamic Pop'));
    for (let i = 0; i < cues.length; i++) {
      expect(cues[i].start).toBeGreaterThanOrEqual(0);
      expect(cues[i].end).toBeLessThanOrEqual(48);
      expect(cues[i].end).toBeGreaterThan(cues[i].start);
      if (i > 0) expect(cues[i].start).toBeGreaterThanOrEqual(cues[i - 1].end);
    }
  });

  it('times cues from the words, not spread evenly across the clip', () => {
    // Speech only in the second half: the first cue must start there.
    const w = words(6, 30, 0.5);
    const cues = buildCues(w, 0, 60, cueOptionsForStyle('Dynamic Pop'));
    expect(cues[0].start).toBeCloseTo(30, 1);
  });

  it('preserves Hindi, Kannada and mixed-script text exactly', () => {
    const seg: TranscriptSegment[] = [
      { text: 'नमस्ते दोस्तों, आज हम physics पढ़ेंगे।', start: 0, end: 4 },
      { text: 'ಇದು ಕನ್ನಡ ವಾಕ್ಯ. Thermodynamics is fun!', start: 4, end: 9 },
    ];
    const w = segmentsToWords(seg);
    const cues = buildCues(w, 0, 9, cueOptionsForStyle('Minimalist'));
    const text = cues.map((c) => c.text).join(' ');
    expect(text).toContain('नमस्ते');
    expect(text).toContain('पढ़ेंगे।');
    expect(text).toContain('ಕನ್ನಡ');
    expect(text).toContain('Thermodynamics');
    expect(cueCoverage(w, cues)).toBe(1);
  });

  it('breaks long runs of CJK text into readable chunks without losing characters', () => {
    const t = '今日は熱力学の基本について話しましょう';
    const tokens = tokenize(t);
    expect(tokens.length).toBeGreaterThan(1);
    expect(tokens.join('')).toBe(t);
  });
});

describe('word timing from segment-level captions', () => {
  it('keeps each word inside its own segment', () => {
    const seg: TranscriptSegment[] = [
      { text: 'one two three', start: 0, end: 3 },
      { text: 'four five', start: 10, end: 12 },
    ];
    const w = segmentsToWords(seg);
    expect(w.map((x) => x.w)).toEqual(['one', 'two', 'three', 'four', 'five']);
    expect(w[2].e).toBeLessThanOrEqual(3);
    expect(w[3].s).toBeGreaterThanOrEqual(10);
  });

  it('uses real word timing when the transcriber provides it', () => {
    const seg: TranscriptSegment[] = [{ text: 'hi there', start: 0, end: 2, words: [{ w: 'hi', s: 0.1, e: 0.3 }, { w: 'there', s: 1.5, e: 1.9 }] }];
    expect(segmentsToWords(seg)).toEqual([{ w: 'hi', s: 0.1, e: 0.3 }, { w: 'there', s: 1.5, e: 1.9 }]);
  });

  it('selects words by midpoint for a clip window', () => {
    const w = words(30, 0, 1);
    expect(wordsInRange(w, 5, 10).map((x) => x.w)).toEqual(['word5', 'word6', 'word7', 'word8', 'word9']);
  });
});

describe('caption editing', () => {
  it('keeps exact timing for one-for-one word fixes', () => {
    const w = words(4, 2, 1);
    const edited = retimeEditedText(w, 'word0 Kirchhoff word2 word3', 2, 6);
    expect(edited[1]).toEqual({ w: 'Kirchhoff', s: w[1].s, e: w[1].e });
  });

  it('spreads added words across the original span', () => {
    const w = words(2, 2, 1);
    const edited = retimeEditedText(w, 'a much longer corrected sentence', 2, 4);
    expect(edited).toHaveLength(5);
    expect(edited[0].s).toBeCloseTo(2);
    expect(edited[4].e).toBeCloseTo(4);
  });
});
