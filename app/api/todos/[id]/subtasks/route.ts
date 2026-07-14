import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { todoDB, subtaskDB } from '@/lib/db';

// POST /api/todos/[id]/subtasks — add a subtask to a todo
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

  // Verify todo belongs to this user
  const todo = todoDB.findById(todoId, session.userId);
  if (!todo) {
    return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
  }

  const body = await request.json();
  const title = (body.title as string | undefined)?.trim();
  if (!title) {
    return NextResponse.json({ error: 'Subtask title is required' }, { status: 400 });
  }

  const subtask = subtaskDB.create(todoId, title);
  return NextResponse.json(subtask, { status: 201 });
}

// GET /api/todos/[id]/subtasks — list subtasks for a todo
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;
  const todoId = parseInt(id, 10);

  const todo = todoDB.findById(todoId, session.userId);
  if (!todo) {
    return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
  }

  return NextResponse.json(subtaskDB.findByTodoId(todoId));
}
