import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const host = url.host;
  const protocol = url.protocol;
  const redirectUri = `${protocol}//${host}/api/auth/youtube/callback`;

  const settings = await prisma.settings.findFirst({ where: { id: 'default' } });

  if (!settings || !settings.youtubeClientId || !settings.youtubeClientSecret) {
    return NextResponse.json({ error: "Missing YouTube Client ID and Secret in settings." }, { status: 400 });
  }

  const oauth2Client = new google.auth.OAuth2(
    settings.youtubeClientId,
    settings.youtubeClientSecret,
    redirectUri
  );

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline', // Request a refresh token
    prompt: 'consent', // Force consent screen to ensure refresh token is given
    scope: [
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube.readonly'
    ],
  });

  return NextResponse.redirect(authUrl);
}
