import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { hasDb, resetDb, makeUser, makeProjectWithClip } from './helpers';

const insert = vi.fn();

vi.mock('googleapis', () => ({
  google: {
    youtube: () => ({ videos: { insert } }),
    auth: { OAuth2: class { setCredentials() {} } },
  },
}));
vi.mock('@/services/youtubeConnection', async (orig) => ({
  ...(await orig<typeof import('@/services/youtubeConnection')>()),
  getYouTubeAuth: vi.fn(async () => ({})),
}));
vi.mock('@/lib/storage', async (orig) => ({
  ...(await orig<typeof import('@/lib/storage')>()),
  signedReadUrl: vi.fn(async () => 'https://blob.test/clip.mp4'),
}));

describe.skipIf(!hasDb)('publishing', () => {
  let ws: string;
  beforeEach(async () => {
    await resetDb();
    ws = (await makeUser('pub@example.com')).workspaceId;
    insert.mockReset();
    insert.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 150)); // a slow upload
      return { data: { id: 'yt_video_1' } };
    });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array([0, 1, 2]))));
  });

  it('simultaneous publish clicks upload the clip exactly once', async () => {
    const { clip } = await makeProjectWithClip(ws, { clipStatus: 'approved', rendered: true });
    const { publishClipToYouTube } = await import('@/services/youtubePublisher');
    const results = await Promise.allSettled([1, 2, 3].map(() => publishClipToYouTube(ws, clip.id, 'unlisted')));
    expect(insert).toHaveBeenCalledTimes(1);
    expect(results.filter((r) => r.status === 'fulfilled').length).toBeGreaterThanOrEqual(1);
    for (const r of results) if (r.status === 'rejected') expect(r.reason.status).toBe(409);
    expect(await prisma.schedule.count({ where: { clipId: clip.id, status: 'published' } })).toBe(1);

    // Publishing again later returns the existing post instead of uploading.
    const again = await publishClipToYouTube(ws, clip.id, 'public');
    expect(again.postId).toBe('yt_video_1');
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it('refuses clips that haven’t been approved', async () => {
    const { clip } = await makeProjectWithClip(ws, { clipStatus: 'in_review', rendered: true });
    const { publishClipToYouTube } = await import('@/services/youtubePublisher');
    await expect(publishClipToYouTube(ws, clip.id, 'public')).rejects.toMatchObject({ status: 400 });
    expect(insert).not.toHaveBeenCalled();
  });

  it('passes the customer’s own audience declarations to YouTube', async () => {
    const { clip } = await makeProjectWithClip(ws, { clipStatus: 'approved', rendered: true });
    await prisma.clip.update({ where: { id: clip.id }, data: { madeForKids: true, containsSyntheticMedia: true, publishTitle: 'Custom title' } });
    const { publishClipToYouTube } = await import('@/services/youtubePublisher');
    await publishClipToYouTube(ws, clip.id, 'private');
    const body = insert.mock.calls[0][0].requestBody;
    expect(body.status).toMatchObject({ privacyStatus: 'private', selfDeclaredMadeForKids: true, containsSyntheticMedia: true });
    expect(body.snippet.title).toBe('Custom title #Shorts');
  });

  it('a failed upload releases the lock so the customer can retry', async () => {
    const { clip } = await makeProjectWithClip(ws, { clipStatus: 'approved', rendered: true });
    insert.mockRejectedValueOnce(Object.assign(new Error('quota'), { response: { data: { error: { message: 'quota', errors: [{ reason: 'quotaExceeded' }] } } } }));
    const { publishClipToYouTube } = await import('@/services/youtubePublisher');
    await expect(publishClipToYouTube(ws, clip.id, 'unlisted')).rejects.toMatchObject({ status: 502 });
    const retry = await publishClipToYouTube(ws, clip.id, 'unlisted');
    expect(retry.status).toBe('published');
  });
});
