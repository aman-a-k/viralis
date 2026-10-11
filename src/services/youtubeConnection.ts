import { google } from 'googleapis';
import { prisma } from '../lib/prisma';
import { decryptSecret, encryptSecret, isLegacyPlaintext } from '../lib/crypto';

export const YOUTUBE_SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
];

export class YouTubeNotConnectedError extends Error {
  constructor(message = 'Connect your YouTube channel first (Settings → Channels).') {
    super(message);
    this.name = 'YouTubeNotConnectedError';
  }
}

/**
 * The platform's Google OAuth app. YOUTUBE_OAUTH_CLIENT_ID/SECRET may point at
 * a separate Google Cloud client; otherwise the sign-in client is reused (it
 * then needs the YouTube scopes enabled on its consent screen).
 */
export function platformOAuthConfigured(): boolean {
  return Boolean(
    (process.env.YOUTUBE_OAUTH_CLIENT_ID && process.env.YOUTUBE_OAUTH_CLIENT_SECRET) ||
      (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
  );
}

export function platformOAuthClient(redirectUri?: string) {
  const id = process.env.YOUTUBE_OAUTH_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.YOUTUBE_OAUTH_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;
  if (!id || !secret) throw new Error('YouTube connection is not configured on this server.');
  return new google.auth.OAuth2(id, secret, redirectUri);
}

export async function getConnection(workspaceId: string) {
  return prisma.channelConnection.findUnique({ where: { workspaceId_provider: { workspaceId, provider: 'youtube' } } });
}

/** OAuth client authorized for the workspace's connected channel. */
export async function getYouTubeAuth(workspaceId: string) {
  const conn = await getConnection(workspaceId);
  if (!conn || conn.status === 'revoked') throw new YouTubeNotConnectedError();

  const refreshToken = decryptSecret(conn.refreshTokenEnc);
  const auth = conn.legacyClientId && conn.legacyClientSecretEnc
    ? new google.auth.OAuth2(conn.legacyClientId, decryptSecret(conn.legacyClientSecretEnc))
    : platformOAuthClient();
  auth.setCredentials({ refresh_token: refreshToken });

  // Values carried over by the migration are stored in plaintext until first use.
  if (isLegacyPlaintext(conn.refreshTokenEnc) || isLegacyPlaintext(conn.legacyClientSecretEnc)) {
    await prisma.channelConnection.update({
      where: { id: conn.id },
      data: {
        refreshTokenEnc: encryptSecret(refreshToken),
        legacyClientSecretEnc: conn.legacyClientSecretEnc ? encryptSecret(decryptSecret(conn.legacyClientSecretEnc)) : null,
      },
    });
  }
  return auth;
}

export async function saveConnection(workspaceId: string, userId: string, refreshToken: string, scopes: string | null | undefined) {
  const auth = platformOAuthClient();
  auth.setCredentials({ refresh_token: refreshToken });
  let externalId: string | null = null;
  let title: string | null = null;
  try {
    const res = await google.youtube({ version: 'v3', auth }).channels.list({ part: ['snippet'], mine: true });
    externalId = res.data.items?.[0]?.id || null;
    title = res.data.items?.[0]?.snippet?.title || null;
  } catch {
    /* channel details are informational */
  }
  const data = {
    refreshTokenEnc: encryptSecret(refreshToken),
    scopes: scopes || null,
    externalId,
    title,
    status: 'active',
    lastError: null,
    legacyClientId: null,
    legacyClientSecretEnc: null,
    connectedById: userId,
  };
  return prisma.channelConnection.upsert({
    where: { workspaceId_provider: { workspaceId, provider: 'youtube' } },
    update: data,
    create: { workspaceId, provider: 'youtube', ...data },
  });
}

/** Revokes Google's grant (best effort) and forgets the connection. */
export async function disconnect(workspaceId: string) {
  const conn = await getConnection(workspaceId);
  if (!conn) return;
  try {
    const auth = await getYouTubeAuth(workspaceId);
    await auth.revokeToken(decryptSecret(conn.refreshTokenEnc));
  } catch {
    /* already revoked or unreachable — remove locally anyway */
  }
  await prisma.channelConnection.delete({ where: { id: conn.id } });
}

export async function markConnectionError(workspaceId: string, message: string, revoked = false) {
  await prisma.channelConnection.updateMany({
    where: { workspaceId, provider: 'youtube' },
    data: { lastError: message.slice(0, 300), ...(revoked ? { status: 'revoked' } : {}) },
  });
}
