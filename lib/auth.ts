import { cookies } from 'next/headers';

export interface Session {
  userId: number;
  email?: string;
  name?: string;
}

const SESSION_COOKIE_NAME = 'taskboard-session';

let testSession: Session | null | undefined;

function parseSession(rawValue: string): Session | null {
  try {
    const parsed = JSON.parse(rawValue) as Partial<Session>;
    if (typeof parsed.userId === 'number') {
      return {
        userId: parsed.userId,
        email: typeof parsed.email === 'string' ? parsed.email : undefined,
        name: typeof parsed.name === 'string' ? parsed.name : undefined,
      };
    }
  } catch {
    return null;
  }

  return null;
}

export function setTestSession(session: Session | null): void {
  testSession = session;
}

export function clearTestSession(): void {
  testSession = undefined;
}

export async function getSession(): Promise<Session | null> {
  if (testSession !== undefined) {
    return testSession;
  }

  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!cookieValue) {
    return null;
  }

  return parseSession(cookieValue);
}