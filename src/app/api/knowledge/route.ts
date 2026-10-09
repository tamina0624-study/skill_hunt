import { NextResponse } from 'next/server';

import { fallbackEvaluation } from '../../../lib/ai';
import { prisma } from '../../../lib/prisma';

export const runtime = 'nodejs';

async function getDemoUser() {
  return prisma.user.upsert({
    where: { email: 'demo@example.com' },
    update: {},
    create: {
      email: 'demo@example.com',
      displayName: 'Demo User',
    },
  });
}

function readAiEvaluation(payload: Record<string, unknown>) {
  const value = payload.aiEvaluation;
  if (!value || typeof value !== 'object') return null;
  const evaluation = value as Record<string, unknown>;
  const points = evaluation.points;
  const reason = String(evaluation.reason ?? '').trim();
  if (typeof points !== 'number' || !Number.isInteger(points) || points < 0 || points > 100 || !reason) return null;
  return { points, reason };
}

export async function GET() {
  const user = await getDemoUser();
  const entries = await prisma.knowledgeEntry.findMany({
    where: { userId: user.id, deletedAt: null },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(entries);
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get('id')?.trim();

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const user = await getDemoUser();
  const result = await prisma.knowledgeEntry.updateMany({
    where: { id, userId: user.id, deletedAt: null },
    data: { deletedAt: new Date() },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: 'knowledge entry not found' }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}

export async function POST(request: Request) {
  const payload = await request.json();
  const content = String(payload.content ?? '').trim();

  if (!content) {
    return NextResponse.json({ error: 'content is required' }, { status: 400 });
  }

  const user = await getDemoUser();
  const judgment = readAiEvaluation(payload) ?? fallbackEvaluation('knowledge', content, content);

  const entry = await prisma.knowledgeEntry.create({
    data: {
      userId: user.id,
      occurredAt: new Date(payload.occurredAt ?? Date.now()),
      content,
      knowledgePoints: judgment.points,
      knowledgePointReason: judgment.reason,
    },
  });

  return NextResponse.json(entry, { status: 201 });
}
