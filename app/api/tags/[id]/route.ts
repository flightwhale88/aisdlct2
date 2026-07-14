import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { tagDB } from '@/lib/db';

// PUT /api/tags/[id] — update a tag's name and/or color
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;
  const tagId = parseInt(id, 10);
  if (isNaN(tagId)) {
    return NextResponse.json({ error: 'Invalid tag id' }, { status: 400 });
  }

  const body = await request.json();
  const { name, color } = body as { name?: string; color?: string };

  const trimmedName = name?.trim();
  if (trimmedName !== undefined && trimmedName === '') {
    return NextResponse.json({ error: 'Tag name cannot be empty' }, { status: 400 });
  }

  if (color !== undefined && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
    return NextResponse.json(
      { error: 'Color must be a valid hex code (e.g. #3B82F6)' },
      { status: 400 },
    );
  }

  try {
    const updated = tagDB.update(tagId, session.userId, {
      name: trimmedName,
      color,
    });

    if (!updated) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch {
    // UNIQUE(user_id, name) violation on rename
    return NextResponse.json(
      { error: 'A tag with this name already exists' },
      { status: 409 },
    );
  }
}

// DELETE /api/tags/[id] — delete a tag (cascades todo_tags)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;
  const tagId = parseInt(id, 10);
  if (isNaN(tagId)) {
    return NextResponse.json({ error: 'Invalid tag id' }, { status: 400 });
  }

  const deleted = tagDB.delete(tagId, session.userId);
  if (!deleted) {
    return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
