import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { google } from 'googleapis';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/apiAuth';

const YT_OAUTH_STATE_COOKIE = 'yt_oauth_state';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const auth = await requireSession();
  if (auth instanceof NextResponse) {
    return NextResponse.redirect(`${url.origin}/auth/signin`);
  }

  const redirectUri = `${url.origin}/api/auth/youtube/callback`;

  const settings = await prisma.settings.findFirst({ where: { id: 'default' } });

  if (!settings || !settings.youtubeClientId || !settings.youtubeClientSecret) {
    return NextResponse.json({ error: "Missing YouTube Client ID and Secret in settings." }, { status: 400 });
  }

  const oauth2Client = new google.auth.OAuth2(
    settings.youtubeClientId,
    settings.youtubeClientSecret,
    redirectUri
  );

  const state = randomBytes(32).toString('hex');

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    state,
    scope: [
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube.readonly'
    ],
  });

  const res = NextResponse.redirect(authUrl);
  res.cookies.set(YT_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: url.protocol === 'https:',
    sameSite: 'lax',
    path: '/api/auth/youtube',
    maxAge: 10 * 60,
  });
  return res;
}
