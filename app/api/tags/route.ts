import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { tagDB } from '@/lib/db';

// GET /api/tags — list all tags for the authenticated user
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const tags = tagDB.findAllByUser(session.userId);
  return NextResponse.json(tags);
}

// POST /api/tags — create a new tag
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await request.json();
  const { name, color } = body as { name?: string; color?: string };

  const trimmedName = name?.trim();
  if (!trimmedName) {
    return NextResponse.json({ error: 'Tag name is required' }, { status: 400 });
  }

  if (color !== undefined && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
    return NextResponse.json(
      { error: 'Color must be a valid hex code (e.g. #3B82F6)' },
      { status: 400 },
    );
  }

  try {
    const tag = tagDB.create(session.userId, {
      name: trimmedName,
      color: color ?? '#3B82F6',
    });
    return NextResponse.json(tag, { status: 201 });
  } catch {
    // UNIQUE(user_id, name) violation
    return NextResponse.json(
      { error: 'A tag with this name already exists' },
      { status: 409 },
    );
  }
}
