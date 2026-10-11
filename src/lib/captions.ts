/**
 * Caption timing. Everything here is pure (no I/O) so it can be unit-tested
 * and shared by the analyzer, the editor and the render job.
 *
 * Words carry absolute timestamps in the source recording (seconds). Cues are
 * relative to the clip start, ready to burn in.
 */

export interface TranscriptWord {
  w: string;
  s: number;
  e: number;
}

export interface TranscriptSegment {
  text: string;
  start: number;
  end: number;
  /** Per-word timing when the transcriber produced it (whisper). */
  words?: TranscriptWord[];
}

export interface CaptionCue {
  start: number;
  end: number;
  text: string;
}

// Scripts written without spaces between words: split into short runs so a
// single "word" doesn't become a whole sentence on screen.
const NO_SPACE_SCRIPT = /[぀-ヿ㐀-䶿一-鿿가-힯฀-๿]/;

/** Splits text into display tokens without discarding any characters. */
export function tokenize(text: string): string[] {
  const tokens: string[] = [];
  for (const part of text.replace(/[\u0000-\u001f\u007f]/g, ' ').split(/\s+/)) {
    if (!part) continue;
    if (NO_SPACE_SCRIPT.test(part) && [...part].length > 8) {
      const chars = [...part];
      for (let i = 0; i < chars.length; i += 6) tokens.push(chars.slice(i, i + 6).join(''));
    } else {
      tokens.push(part);
    }
  }
  return tokens;
}

const graphemes = (s: string) => Math.max(1, [...s].length);

/**
 * Word-level timeline for a transcript. Segments with real word timing use
 * it; otherwise each segment's words are spread across that segment only, in
 * proportion to their length — so timing error is bounded by one caption
 * line (a few seconds), not by the whole clip.
 */
export function segmentsToWords(segments: TranscriptSegment[]): TranscriptWord[] {
  const out: TranscriptWord[] = [];
  for (const seg of segments) {
    if (seg.words?.length) {
      for (const w of seg.words) {
        const text = String(w.w ?? '').trim();
        if (text) out.push({ w: text, s: Number(w.s), e: Math.max(Number(w.e), Number(w.s)) });
      }
      continue;
    }
    const tokens = tokenize(seg.text || '');
    if (!tokens.length) continue;
    const start = Number(seg.start) || 0;
    const end = Math.max(start + 0.2 * tokens.length, Number(seg.end) || start);
    const total = tokens.reduce((n, t) => n + graphemes(t), 0);
    let t = start;
    for (const tok of tokens) {
      const dur = ((end - start) * graphemes(tok)) / total;
      out.push({ w: tok, s: round(t), e: round(t + dur) });
      t += dur;
    }
  }
  return out.sort((a, b) => a.s - b.s);
}

const round = (n: number) => Math.round(n * 1000) / 1000;

/** Words whose midpoint falls inside [start, end). */
export function wordsInRange(words: TranscriptWord[], start: number, end: number): TranscriptWord[] {
  return words.filter((w) => {
    const mid = (w.s + w.e) / 2;
    return mid >= start && mid < end;
  });
}

export function wordsToText(words: TranscriptWord[]): string {
  return words.map((w) => w.w).join(' ');
}

export interface CueOptions {
  maxWords: number;
  maxChars: number;
  /** A silence longer than this starts a new cue. */
  pauseBreak: number;
}

export function cueOptionsForStyle(style: string): CueOptions {
  return style === 'Minimalist'
    ? { maxWords: 7, maxChars: 34, pauseBreak: 0.7 }
    : { maxWords: 3, maxChars: 18, pauseBreak: 0.5 };
}

const SENTENCE_END = /[.!?…।॥。！？]$/;

/**
 * Groups the clip's words into on-screen cues, relative to clipStart. Every
 * input word appears in exactly one cue, in order — nothing is dropped.
 * A cue stays up until the next one starts (or briefly past its last word),
 * so captions never flash off mid-sentence.
 */
export function buildCues(words: TranscriptWord[], clipStart: number, clipEnd: number, opts: CueOptions): CaptionCue[] {
  const duration = Math.max(0, clipEnd - clipStart);
  const groups: TranscriptWord[][] = [];
  let cur: TranscriptWord[] = [];
  let chars = 0;

  for (const word of words) {
    const prev = cur[cur.length - 1];
    const len = graphemes(word.w);
    const breakHere =
      cur.length > 0 &&
      (cur.length >= opts.maxWords ||
        chars + 1 + len > opts.maxChars ||
        (prev && word.s - prev.e > opts.pauseBreak) ||
        (prev && SENTENCE_END.test(prev.w)));
    if (breakHere) {
      groups.push(cur);
      cur = [];
      chars = 0;
    }
    cur.push(word);
    chars += (cur.length > 1 ? 1 : 0) + len;
  }
  if (cur.length) groups.push(cur);

  const cues: CaptionCue[] = groups.map((g) => ({
    start: clamp(g[0].s - clipStart, 0, duration),
    end: clamp(g[g.length - 1].e - clipStart, 0, duration),
    text: wordsToText(g),
  }));

  for (let i = 0; i < cues.length; i++) {
    const next = cues[i + 1];
    const hold = next ? Math.min(next.start, cues[i].end + 0.6) : Math.min(duration, cues[i].end + 0.4);
    cues[i].end = Math.max(cues[i].start + 0.25, hold);
    if (next && cues[i].end > next.start) cues[i].end = next.start;
    cues[i].start = round(cues[i].start);
    cues[i].end = round(Math.min(cues[i].end, duration || cues[i].end));
  }
  return cues.filter((c) => c.text);
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * Fraction of the clip's words that appear in the cues (1 = complete).
 * Used as a release check: anything below 1 means captions would drop speech.
 */
export function cueCoverage(words: TranscriptWord[], cues: CaptionCue[]): number {
  if (!words.length) return 1;
  const shown = tokenize(cues.map((c) => c.text).join(' ')).length;
  const spoken = tokenize(wordsToText(words)).length;
  return Math.min(1, shown / spoken);
}

/**
 * Re-times an edited caption text against the clip's original word timings.
 * Edits that keep the word count keep exact timing; otherwise the new words
 * are spread across the original words' time span in proportion to length.
 */
export function retimeEditedText(original: TranscriptWord[], editedText: string, clipStart: number, clipEnd: number): TranscriptWord[] {
  const tokens = tokenize(editedText);
  if (!tokens.length) return [];
  if (tokens.length === original.length) {
    return tokens.map((w, i) => ({ w, s: original[i].s, e: original[i].e }));
  }
  const start = original.length ? original[0].s : clipStart;
  const end = original.length ? original[original.length - 1].e : clipEnd;
  const total = tokens.reduce((n, t) => n + graphemes(t), 0);
  let t = start;
  return tokens.map((w) => {
    const dur = ((end - start) * graphemes(w)) / total;
    const word = { w, s: round(t), e: round(t + dur) };
    t += dur;
    return word;
  });
}

export function parseWords(json: string | null | undefined): TranscriptWord[] | null {
  if (!json) return null;
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr.filter((w) => w && typeof w.w === 'string').map((w) => ({ w: w.w, s: Number(w.s), e: Number(w.e) })) : null;
  } catch {
    return null;
  }
}

export function parseSegments(json: string | null | undefined): TranscriptSegment[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
