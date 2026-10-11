import { describe, it, expect } from 'vitest';
import { groupWords, buildAss, assEscape, describeWorkerError } from '../worker/media.js';

describe('worker: subtitle file', () => {
  const cues = [
    { start: 0, end: 1.2, text: 'नमस्ते दोस्तों' },
    { start: 1.2, end: 2.5, text: 'ಕನ್ನಡ {bold} \\N test' },
  ];

  it('writes every cue verbatim in any script', () => {
    const ass = buildAss(cues, 1080, 1920, 'Minimalist', 'bottom');
    expect(ass).toContain('नमस्ते दोस्तों');
    expect(ass).toContain('ಕನ್ನಡ');
    expect(ass.match(/^Dialogue:/gm)).toHaveLength(2);
    expect(ass).toContain('0:00:01.20,0:00:02.50');
  });

  it('neutralizes ASS override syntax so captions can’t inject styling', () => {
    expect(assEscape('a {\\b1} b\\N c')).not.toMatch(/[{}\\]/);
  });

  it('places captions where the customer chose', () => {
    const align = (pos: string) => buildAss(cues, 1080, 1920, 'Dynamic Pop', pos).match(/Style: Default,[^\n]*/)![0].split(',')[18];
    expect(align('top')).toBe('8');
    expect(align('middle')).toBe('5');
    expect(align('bottom')).toBe('2');
  });

  it('uses a font family with Indic coverage', () => {
    expect(buildAss(cues, 1080, 1920, 'Dynamic Pop', 'bottom')).toContain('Noto Sans');
  });
});

describe('worker: grouping whisper words into segments', () => {
  it('splits on sentence ends and pauses, keeping word timing', () => {
    const words = [
      { w: 'Hello', s: 0, e: 0.4 }, { w: 'everyone.', s: 0.5, e: 2.5 },
      { w: 'आज', s: 2.6, e: 2.9 }, { w: 'हम', s: 3.0, e: 3.2 },
      { w: 'after', s: 6, e: 6.3 }, { w: 'pause', s: 6.4, e: 6.8 },
    ];
    const segs = groupWords(words);
    expect(segs.map((s: { text: string }) => s.text)).toEqual(['Hello everyone.', 'आज हम', 'after pause']);
    expect(segs[1].words).toHaveLength(2);
    expect(segs[2].start).toBe(6);
  });
});

describe('worker: error messages', () => {
  it('never shows raw command output and says whether a retry can help', () => {
    const bad = describeWorkerError({ stderr: 'ffmpeg -i /tmp/x... moov atom not found' }, 'transcribe');
    expect(bad.retryable).toBe(false);
    expect(bad.message).not.toContain('/tmp');
    const net = describeWorkerError(new Error('ECONNRESET'), 'render');
    expect(net.retryable).toBe(true);
    const priv = describeWorkerError({ stderr: 'ERROR: Private video' }, 'transcribe');
    expect(priv.retryable).toBe(false);
  });
});
