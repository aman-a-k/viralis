// Pure helpers used by the worker (no I/O), kept separate so they can be unit-tested.

export const SENTENCE_END = /[.!?…।॥。！？]$/;

/** Groups words into sentence-sized transcript segments, keeping each word's timing. */
export function groupWords(words) {
  const segments = [];
  let cur = [];
  const flush = () => {
    if (!cur.length) return;
    segments.push({ text: cur.map((w) => w.w).join(' '), start: cur[0].s, end: cur[cur.length - 1].e, words: cur });
    cur = [];
  };
  for (const w of words) {
    const prev = cur[cur.length - 1];
    if (prev && (w.s - prev.e > 1.0 || w.e - cur[0].s > 15)) flush();
    cur.push(w);
    if (SENTENCE_END.test(w.w) && w.e - cur[0].s > 2) flush();
  }
  flush();
  return segments;
}

export function assTime(seconds) {
  const cs = Math.max(0, Math.round(seconds * 100));
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const s = Math.floor((cs % 6000) / 100);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs % 100).padStart(2, '0')}`;
}

// Text is kept exactly as written (any script). Only the characters that
// mean something to the ASS format are neutralized.
export const assEscape = (t) => String(t).replace(/\\/g, '⧵').replace(/\{/g, '(').replace(/\}/g, ')').replace(/\r?\n/g, ' ');

/**
 * Burns the app's cues verbatim — the app decides the words and timing (and
 * checks every spoken word is covered); the worker only draws them.
 * Font: Noto Sans, with fontconfig falling back to the matching Noto family
 * for Devanagari, Kannada, Tamil, etc.
 */
export function buildAss(cues, W, H, style, position) {
  const alignment = position === 'top' ? 8 : position === 'middle' ? 5 : 2;
  const marginV = position === 'middle' ? 0 : Math.round(H * (W < H ? 0.14 : 0.08));
  const minimal = style === 'Minimalist';
  const size = Math.round(W * (minimal ? 0.048 : W < H ? 0.07 : 0.05));
  const styleLine = minimal
    ? `Style: Default,Noto Sans,${size},&H00FFFFFF,&H000000FF,&H00000000,&H64000000,0,0,0,0,100,100,0,0,1,3,1,${alignment},60,60,${marginV},1`
    : `Style: Default,Noto Sans,${size},&H0000FFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,8,0,${alignment},60,60,${marginV},1`;

  let out =
    `[Script Info]\nScriptType: v4.00+\nPlayResX: ${W}\nPlayResY: ${H}\nWrapStyle: 0\nScaledBorderAndShadow: yes\n\n` +
    `[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n` +
    `${styleLine}\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;

  for (const cue of cues) {
    const text = minimal ? assEscape(cue.text) : assEscape(cue.text).toLocaleUpperCase();
    const pop = minimal ? '' : '{\\fscx108\\fscy108\\t(0,90,\\fscx100\\fscy100)}';
    out += `Dialogue: 0,${assTime(cue.start)},${assTime(cue.end)},Default,,0,0,0,,${pop}${text}\n`;
  }
  return out;
}

/**
 * Raw yt-dlp/ffmpeg/whisper failures (command lines, stderr dumps) are
 * logged here but never shown to customers. This turns them into a short
 * message plus whether trying again could help.
 */
export function describeWorkerError(err, type) {
  const raw = String(err?.stderr?.toString?.() || err?.message || err || '');
  const permanent = (message) => ({ message, retryable: false });
  const transient = (message) => ({ message, retryable: true });
  if (err?.permanent) return permanent(err.message);
  if (/cookies are no longer valid|cookies.*rotated|Sign in to confirm/i.test(raw)) {
    return transient('YouTube is temporarily blocking our download of this video. We’re retrying; if it keeps failing, upload the file instead.');
  }
  if (/Video unavailable|has been removed/i.test(raw)) return permanent('This video is unavailable or has been removed.');
  if (/Private video/i.test(raw)) return permanent('This video is private and can’t be accessed. Upload the file instead.');
  if (/429|Too Many Requests/i.test(raw)) return transient('YouTube is rate-limiting downloads right now. Retrying shortly.');
  if (/Invalid data found|moov atom not found|does not contain any stream|Output file #0 does not contain any stream/i.test(raw)) {
    return permanent('We couldn’t read that file. Export it as MP4 (H.264/AAC) and upload it again.');
  }
  if (/Server returned 4\d\d|HTTP error 4\d\d/i.test(raw)) return permanent('The source file is no longer available.');
  if (/SIGKILL|killed|ENOMEM|out of memory/i.test(raw)) return transient('The processing server ran out of memory. Retrying.');
  if (/ETIMEDOUT|ENOTFOUND|ECONNRESET|EAI_AGAIN|network|socket hang up|5\d\d/i.test(raw)) return transient('A network error interrupted processing. Retrying.');
  return transient(type === 'render' ? 'Exporting this clip failed. Retrying.' : 'Transcribing this recording failed. Retrying.');
}
