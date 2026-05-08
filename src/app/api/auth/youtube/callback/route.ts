import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const host = url.host;
  const protocol = url.protocol;
  const redirectUri = `${protocol}//${host}/api/auth/youtube/callback`;

  if (!code) {
    return NextResponse.json({ error: "No code provided by Google." }, { status: 400 });
  }

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
    
    // Save the refresh token to the database
    if (tokens.refresh_token) {
      await prisma.settings.update({
        where: { id: 'default' },
        data: { youtubeRefreshToken: tokens.refresh_token }
      });
      return NextResponse.redirect(`${protocol}//${host}/?success=youtube_connected`);
    } else {
      return NextResponse.json({ error: "No refresh token provided by Google. Try revoking app permissions and trying again." }, { status: 400 });
    }
  } catch (error) {
    console.error("Error exchanging code for tokens:", error);
    return NextResponse.json({ error: "Authentication failed." }, { status: 500 });
  }
}
