import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { subtaskDB, todoDB } from '@/lib/db';

// Verify the subtask exists and its parent todo belongs to session.userId.
// Returns the subtask or null (caller should 404).
async function authorizeSubtask(subtaskId: number, userId: number) {
  const subtask = subtaskDB.findById(subtaskId);
  if (!subtask) return null;
  const todo = todoDB.findById(subtask.todo_id, userId);
  if (!todo) return null; // todo not found or owned by another user → 404
  return subtask;
}

// PUT /api/subtasks/[id] — toggle completion and/or rename
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;
  const subtaskId = parseInt(id, 10);
  if (isNaN(subtaskId)) {
    return NextResponse.json({ error: 'Invalid subtask id' }, { status: 400 });
  }

  const subtask = await authorizeSubtask(subtaskId, session.userId);
  if (!subtask) {
    return NextResponse.json({ error: 'Subtask not found' }, { status: 404 });
  }

  const body = await request.json() as { title?: string; completed?: boolean | number };

  const title = typeof body.title === 'string' ? body.title.trim() || undefined : undefined;
  const completed =
    body.completed !== undefined ? (body.completed ? 1 : 0) : undefined;

  const updated = subtaskDB.update(subtaskId, subtask.todo_id, {
    title,
    completed,
  });

  if (!updated) {
    return NextResponse.json({ error: 'Subtask not found' }, { status: 404 });
  }

  return NextResponse.json(updated);
}

// DELETE /api/subtasks/[id] — permanently remove a subtask
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;
  const subtaskId = parseInt(id, 10);
  if (isNaN(subtaskId)) {
    return NextResponse.json({ error: 'Invalid subtask id' }, { status: 400 });
  }

  const subtask = await authorizeSubtask(subtaskId, session.userId);
  if (!subtask) {
    return NextResponse.json({ error: 'Subtask not found' }, { status: 404 });
  }

  subtaskDB.delete(subtaskId, subtask.todo_id);
  return new NextResponse(null, { status: 204 });
}
