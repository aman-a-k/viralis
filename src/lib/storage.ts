import { del, issueSignedToken, presignUrl } from '@vercel/blob';

/**
 * Customer media (uploaded recordings and rendered clips) lives in Vercel
 * Blob under a per-workspace prefix:
 *
 *   ws/<workspaceId>/sources/<file>   uploads
 *   ws/<workspaceId>/renders/<file>   rendered clips
 *
 * With BLOB_ACCESS=private (the default, needs a *private* Blob store) files
 * can only be read through short-lived signed URLs this app issues after
 * checking the requester belongs to the workspace. BLOB_ACCESS=public is a
 * fallback for an existing public store: paths are still unguessable and the
 * browser never receives them directly, but a leaked URL stays readable.
 */
export type BlobAccess = 'private' | 'public';

export function blobAccess(): BlobAccess {
  return process.env.BLOB_ACCESS === 'public' ? 'public' : 'private';
}

export function storageConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

const safeName = (name: string) =>
  name
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '_')
    .replace(/_+/g, '_')
    .slice(-80) || 'file';

export function sourcePathPrefix(workspaceId: string) {
  return `ws/${workspaceId}/sources/`;
}

export function sourcePath(workspaceId: string, filename: string) {
  return `${sourcePathPrefix(workspaceId)}${safeName(filename)}`;
}

export function renderPathPrefix(workspaceId: string) {
  return `ws/${workspaceId}/renders/`;
}

/** Pathname of a blob URL ("https://<store>.blob.vercel-storage.com/a/b.mp4" -> "a/b.mp4"). */
export function blobPathname(urlOrPath: string): string {
  try {
    return decodeURIComponent(new URL(urlOrPath).pathname.replace(/^\//, ''));
  } catch {
    return urlOrPath.replace(/^\//, '');
  }
}

export function isBlobUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && u.hostname.endsWith('.blob.vercel-storage.com');
  } catch {
    return false;
  }
}

/** True when a stored path/URL is inside this workspace's area of the store. */
export function belongsToWorkspace(workspaceId: string, urlOrPath: string): boolean {
  return blobPathname(urlOrPath).startsWith(`ws/${workspaceId}/`);
}

/**
 * A URL the holder can read the file from for `ttlSeconds`. Private blobs get
 * a signed URL; legacy public URLs are returned as-is.
 */
export async function signedReadUrl(stored: string, ttlSeconds = 15 * 60): Promise<string> {
  if (/^https?:\/\//.test(stored) && /\.public\.blob\.vercel-storage\.com$/.test(new URL(stored).hostname)) {
    return stored;
  }
  if (blobAccess() === 'public' && /^https?:\/\//.test(stored)) return stored;

  const pathname = blobPathname(stored);
  const validUntil = Date.now() + ttlSeconds * 1000;
  const token = await issueSignedToken({ pathname, operations: ['get', 'head'], validUntil });
  const { presignedUrl } = await presignUrl(token, { operation: 'get', pathname, access: 'private', validUntil });
  return presignedUrl;
}

/** Best-effort deletion; missing files are not an error. */
export async function deleteMedia(items: (string | null | undefined)[]) {
  const targets = items.filter((x): x is string => !!x && (isBlobUrl(x) || x.startsWith('ws/')));
  if (!targets.length || !storageConfigured()) return;
  try {
    await del(targets);
  } catch (err) {
    console.error('[storage] delete failed', err);
  }
}
