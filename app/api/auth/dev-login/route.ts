import { NextRequest, NextResponse } from 'next/server';
import { getSessionCookieName } from '@/lib/auth';
import { userDB } from '@/lib/db';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json()) as { username?: string };
  const username = (body.username ?? '').trim();

  if (!username) {
    return NextResponse.json({ error: 'Username is required' }, { status: 400 });
  }

  const user = userDB.createIfMissing(username);
  const response = NextResponse.json({ success: true, userId: user.id });
  response.cookies.set(getSessionCookieName(), String(user.id), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}
