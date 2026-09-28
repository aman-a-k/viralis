// Files uploaded by users live in this app's Vercel Blob store. Anything the
// worker is asked to fetch must be one of those — never an arbitrary URL.
export function isBlobUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && u.hostname.endsWith('.public.blob.vercel-storage.com');
  } catch {
    return false;
  }
}
