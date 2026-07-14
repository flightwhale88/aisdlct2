import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { tagDB, todoDB } from '@/lib/db';

// POST /api/todos/[id]/tags — attach a tag to a todo (idempotent)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;
  const todoId = parseInt(id, 10);
  if (isNaN(todoId)) {
    return NextResponse.json({ error: 'Invalid todo id' }, { status: 400 });
  }

  // Verify todo belongs to user
  const todo = todoDB.findById(todoId, session.userId);
  if (!todo) {
    return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
  }

  const body = await request.json();
  const { tag_id } = body as { tag_id?: number };
  if (!tag_id || typeof tag_id !== 'number') {
    return NextResponse.json({ error: 'tag_id is required' }, { status: 400 });
  }

  try {
    tagDB.attachToTodo(todoId, tag_id, session.userId);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
  }
}

// DELETE /api/todos/[id]/tags — detach a tag from a todo (idempotent)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;
  const todoId = parseInt(id, 10);
  if (isNaN(todoId)) {
    return NextResponse.json({ error: 'Invalid todo id' }, { status: 400 });
  }

  // Verify todo belongs to user
  const todo = todoDB.findById(todoId, session.userId);
  if (!todo) {
    return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
  }

  const body = await request.json();
  const { tag_id } = body as { tag_id?: number };
  if (!tag_id || typeof tag_id !== 'number') {
    return NextResponse.json({ error: 'tag_id is required' }, { status: 400 });
  }

  try {
    tagDB.detachFromTodo(todoId, tag_id, session.userId);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
  }
}
