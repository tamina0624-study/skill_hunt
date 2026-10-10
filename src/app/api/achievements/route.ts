import { NextResponse } from 'next/server';

import { parseRecordDate } from '../../../lib/record-date';
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
  const items = await prisma.achievementRecord.findMany({
    where: { userId: user.id },
    orderBy: { recordedAt: 'desc' },
  });

  return NextResponse.json(items);
}

export async function POST(request: Request) {
  const payload = await request.json();
  const title = String(payload.title ?? '').trim();

  if (!title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }

  const recordedAt = parseRecordDate(payload.recordedAt);
  if (!recordedAt) {
    return NextResponse.json({ error: 'recordedAt must be a valid date' }, { status: 400 });
  }

  const judgment = readAiEvaluation(payload);
  if (!judgment) {
    return NextResponse.json({ error: 'A current AI evaluation is required' }, { status: 400 });
  }

  const user = await getDemoUser();

  const item = await prisma.achievementRecord.create({
    data: {
      userId: user.id,
      title,
      points: judgment.points,
      reason: judgment.reason,
      recordedAt,
    },
  });

  return NextResponse.json(item, { status: 201 });
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get('id')?.trim();

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const user = await getDemoUser();
  const result = await prisma.achievementRecord.deleteMany({
    where: { id, userId: user.id },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: 'achievement not found' }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
