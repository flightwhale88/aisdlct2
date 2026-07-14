import { NextRequest, NextResponse } from 'next/server';
import { getSessionCookieName } from '@/lib/auth';

export function middleware(request: NextRequest): NextResponse {
  if (request.nextUrl.pathname === '/login') {
    return NextResponse.next();
  }

  const cookie = request.cookies.get(getSessionCookieName())?.value;
  if (!cookie) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/calendar'],
};
