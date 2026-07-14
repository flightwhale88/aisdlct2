import { cookies } from 'next/headers';

export interface Session {
  userId: number;
}

const SESSION_COOKIE = 'dev_user_id';

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const userIdRaw = cookieStore.get(SESSION_COOKIE)?.value;
  if (!userIdRaw) {
    return null;
  }

  const userId = Number(userIdRaw);
  if (!Number.isInteger(userId) || userId <= 0) {
    return null;
  }

  return { userId };
}

export function getSessionCookieName(): string {
  return SESSION_COOKIE;
}
