import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { google } from 'googleapis';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/apiAuth';

const YT_OAUTH_STATE_COOKIE = 'yt_oauth_state';

function statesMatch(a: string | null | undefined, b: string | null | undefined) {
  if (!a || !b) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  const code = url.searchParams.get('code');
  const returnedState = url.searchParams.get('state');
  const expectedState = req.cookies.get(YT_OAUTH_STATE_COOKIE)?.value;

  if (!statesMatch(returnedState, expectedState)) {
    return NextResponse.json({ error: "Invalid or expired OAuth state. Start the YouTube connection again from Settings." }, { status: 400 });
  }

  if (!code) {
    return NextResponse.json({ error: "No code provided by Google." }, { status: 400 });
  }

  const redirectUri = `${url.origin}/api/auth/youtube/callback`;
  const settings = await prisma.settings.findFirst({ where: { id: 'default' } });

  if (!settings || !settings.youtubeClientId || !settings.youtubeClientSecret) {
    return NextResponse.json({ error: "Missing YouTube Client credentials." }, { status: 400 });
  }

  const oauth2Client = new google.auth.OAuth2(
    settings.youtubeClientId,
    settings.youtubeClientSecret,
    redirectUri
  );

  try {
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      return NextResponse.json({ error: "No refresh token provided by Google. Try revoking app permissions and trying again." }, { status: 400 });
    }

    await prisma.settings.update({
      where: { id: 'default' },
      data: { youtubeRefreshToken: tokens.refresh_token }
    });
    const res = NextResponse.redirect(`${url.origin}/?success=youtube_connected`);
    res.cookies.delete({ name: YT_OAUTH_STATE_COOKIE, path: '/api/auth/youtube' });
    return res;
  } catch (error) {
    console.error("Error exchanging code for tokens:", error);
    return NextResponse.json({ error: "Authentication failed." }, { status: 500 });
  }
}
