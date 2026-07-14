import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'dev-secret-change-in-production-min-32-chars',
);
const COOKIE_NAME = 'session';
const SESSION_EXPIRY = '7d';

export interface SessionPayload {
  userId: number;
  username: string;
}

// ─── Challenge Storage (In-memory, single-instance) ────────────────────────

const challengeStore = new Map<string, { challenge: string; expiresAt: number }>();

export function generateChallenge(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64');
}

export async function saveChallenge(username: string, challenge: string): Promise<void> {
  challengeStore.set(username, {
    challenge,
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
  });
}

export async function getChallenge(username: string): Promise<string | null> {
  const stored = challengeStore.get(username);
  if (!stored) return null;
  if (Date.now() > stored.expiresAt) {
    challengeStore.delete(username);
    return null;
  }
  challengeStore.delete(username); // Single-use
  return stored.challenge;
}

export async function createSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(SESSION_EXPIRY)
    .sign(JWT_SECRET);
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days in seconds
    path: '/',
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
