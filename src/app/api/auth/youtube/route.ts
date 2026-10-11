import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getWorkspaceContext } from '@/lib/workspace';
import { platformOAuthClient, platformOAuthConfigured, YOUTUBE_SCOPES } from '@/services/youtubeConnection';

const YT_OAUTH_STATE_COOKIE = 'yt_oauth_state';

/** Starts connecting the workspace's YouTube channel through the platform's Google app. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const ctx = await getWorkspaceContext();
  if (!ctx) return NextResponse.redirect(`${url.origin}/auth/signin`);
  if (ctx.role === 'member') return NextResponse.redirect(`${url.origin}/?tab=settings&error=youtube_permission`);
  if (!platformOAuthConfigured()) return NextResponse.redirect(`${url.origin}/?tab=settings&error=youtube_unavailable`);

  const state = randomBytes(32).toString('hex');
  const authUrl = platformOAuthClient(`${url.origin}/api/auth/youtube/callback`).generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: true,
    state,
    scope: YOUTUBE_SCOPES,
  });

  const res = NextResponse.redirect(authUrl);
  res.cookies.set(YT_OAUTH_STATE_COOKIE, `${state}.${ctx.workspaceId}`, {
    httpOnly: true,
    secure: url.protocol === 'https:',
    sameSite: 'lax',
    path: '/api/auth/youtube',
    maxAge: 10 * 60,
  });
  return res;
}

/** Disconnects (and revokes) the workspace's channel. */
export async function DELETE() {
  const ctx = await getWorkspaceContext();
  if (!ctx) return NextResponse.json({ success: false, error: 'Sign in to continue.' }, { status: 401 });
  if (ctx.role === 'member') return NextResponse.json({ success: false, error: 'Ask a workspace admin to do that.' }, { status: 403 });
  const { disconnect } = await import('@/services/youtubeConnection');
  const { audit } = await import('@/lib/workspace');
  await disconnect(ctx.workspaceId);
  await audit(ctx, 'channel.disconnect', { provider: 'youtube' });
  return NextResponse.json({ success: true });
}
