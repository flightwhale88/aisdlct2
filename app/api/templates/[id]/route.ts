import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { templateDB } from '@/lib/db';

// PUT /api/templates/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  const updated = templateDB.update(parseInt(id, 10), session.userId, body);
  if (!updated) return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  return NextResponse.json(updated);
}

// DELETE /api/templates/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { id } = await params;
  const deleted = templateDB.delete(parseInt(id, 10), session.userId);
  if (!deleted) return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
