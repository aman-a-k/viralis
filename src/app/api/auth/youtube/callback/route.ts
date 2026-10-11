import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceContext, audit } from '@/lib/workspace';
import { safeEqual } from '@/lib/crypto';
import { platformOAuthClient, saveConnection } from '@/services/youtubeConnection';

const YT_OAUTH_STATE_COOKIE = 'yt_oauth_state';

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const back = (q: string) => {
    const res = NextResponse.redirect(`${url.origin}/?tab=settings&${q}`);
    res.cookies.delete({ name: YT_OAUTH_STATE_COOKIE, path: '/api/auth/youtube' });
    return res;
  };

  const ctx = await getWorkspaceContext();
  if (!ctx) return NextResponse.redirect(`${url.origin}/auth/signin`);

  const [expectedState, workspaceId] = (req.cookies.get(YT_OAUTH_STATE_COOKIE)?.value || '').split('.');
  const returnedState = url.searchParams.get('state') || '';
  // The flow must finish in the same workspace it started in.
  if (!expectedState || !safeEqual(returnedState, expectedState) || workspaceId !== ctx.workspaceId) {
    return back('error=youtube_state');
  }
  if (url.searchParams.get('error')) return back('error=youtube_denied');

  const code = url.searchParams.get('code');
  if (!code) return back('error=youtube_denied');

  try {
    const { tokens } = await platformOAuthClient(`${url.origin}/api/auth/youtube/callback`).getToken(code);
    if (!tokens.refresh_token) return back('error=youtube_no_refresh');
    if (!tokens.scope?.includes('youtube.upload')) return back('error=youtube_scope');
    const conn = await saveConnection(ctx.workspaceId, ctx.userId, tokens.refresh_token, tokens.scope);
    await audit(ctx, 'channel.connect', { provider: 'youtube', channel: conn.externalId });
    return back('success=youtube_connected');
  } catch (error) {
    console.error('[youtube callback] token exchange failed', error);
    return back('error=youtube_failed');
  }
}
