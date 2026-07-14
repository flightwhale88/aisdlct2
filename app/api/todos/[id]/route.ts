import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { todoDB, validatePriority } from '@/lib/db';

// GET /api/todos/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;
  const todo = todoDB.findById(parseInt(id, 10), session.userId);
  if (!todo) return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
  return NextResponse.json(todo);
}

// PUT /api/todos/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  if (body.priority !== undefined) {
    try {
      body.priority = validatePriority(body.priority);
    } catch (err) {
      return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    }
  }

  const updated = todoDB.update(parseInt(id, 10), session.userId, body);
  if (!updated) return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
  return NextResponse.json(updated);
}

// DELETE /api/todos/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;
  const deleted = todoDB.delete(parseInt(id, 10), session.userId);
  if (!deleted) return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
