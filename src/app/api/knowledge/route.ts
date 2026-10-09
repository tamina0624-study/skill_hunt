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
  const subject = String(payload.workContext ?? '').trim();
  const content = String(payload.description ?? '').trim();

  if (!subject || !content) {
    return NextResponse.json(
      { error: 'workContext and description are required' },
      { status: 400 },
    );
  }

  const user = await getDemoUser();
  const actualHarm = String(payload.actualHarm ?? 'none');
  const status = String(payload.status ?? 'considering');
  const categories = Array.isArray(payload.categories)
    ? (payload.categories as unknown[]).filter((value): value is unknown => Boolean(value)).map((value) => String(value)).slice(0, 5)
    : [];

  const riskLevel = ['low', 'medium', 'high', 'critical'].includes(String(payload.riskLevel ?? 'low'))
    ? String(payload.riskLevel ?? 'low')
    : 'low';

  const knowledgeDetails = [
    content,
    payload.potentialImpact,
    payload.perceivedCause,
    payload.detectionTrigger,
    payload.userCountermeasure,
  ].map((value) => String(value ?? '').trim()).filter(Boolean).join('\n');
  const judgment = readAiEvaluation(payload) ?? fallbackEvaluation('knowledge', subject, knowledgeDetails);

  const entry = await prisma.knowledgeEntry.create({
    data: {
      userId: user.id,
      occurredAt: new Date(payload.occurredAt ?? Date.now()),
      subject,
      content,
      potentialImpact: payload.potentialImpact ? String(payload.potentialImpact) : null,
      perceivedCause: payload.perceivedCause ? String(payload.perceivedCause) : null,
      detectionTrigger: payload.detectionTrigger ? String(payload.detectionTrigger) : null,
      reuseIdea: payload.userCountermeasure ? String(payload.userCountermeasure) : null,
      impactLevel: actualHarm === 'minor' ? 'minor' : actualHarm === 'occurred' ? 'occurred' : 'none',
      status: status === 'completed' ? 'completed' : 'considering',
      categories,
      occurrenceScore: Number(payload.occurrence ?? 3),
      severityScore: Number(payload.severity ?? 3),
      detectabilityScore: Number(payload.detectability ?? 3),
      rpn: Number(payload.rpn ?? 27),
      riskLevel: riskLevel as 'low' | 'medium' | 'high' | 'critical',
      summary: `${subject}で得た気づきを記録しました。`,
      knowledgePoints: judgment.points,
      knowledgePointReason: judgment.reason,
    },
  });

  return NextResponse.json(entry, { status: 201 });
}
