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
  const skills = await prisma.acquiredSkill.findMany({
    where: { userId: user.id },
    orderBy: { recordedAt: 'desc' },
  });

  return NextResponse.json(skills);
}

export async function POST(request: Request) {
  const payload = await request.json();
  const title = String(payload.title ?? '').trim();
  const description = String(payload.description ?? '').trim();

  if (!title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }
  if (payload.confidentialityConfirmed !== true) {
    return NextResponse.json({ error: 'confidentiality confirmation is required' }, { status: 400 });
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
  const impactLevel = ['none', 'minor', 'occurred'].includes(String(payload.actualHarm))
    ? String(payload.actualHarm)
    : 'none';
  const status = ['considering', 'completed'].includes(String(payload.status))
    ? String(payload.status)
    : 'considering';
  const riskLevel = ['low', 'medium', 'high', 'critical'].includes(String(payload.riskLevel))
    ? String(payload.riskLevel)
    : null;
  const categories = Array.isArray(payload.categories)
    ? payload.categories.map(String).slice(0, 5)
    : [];
  const score = (value: unknown, fallback: number) => {
    const number = Number(value);
    return Number.isInteger(number) && number >= 1 && number <= 5 ? number : fallback;
  };
  const occurrenceScore = score(payload.occurrence, 3);
  const severityScore = score(payload.severity, 3);
  const detectabilityScore = score(payload.detectability, 3);
  const rpn = Number(payload.rpn);

  const skill = await prisma.acquiredSkill.create({
    data: {
      userId: user.id,
      title,
      description,
      confidentialityConfirmed: true,
      potentialImpact: String(payload.potentialImpact ?? '').trim() || null,
      perceivedCause: String(payload.perceivedCause ?? '').trim() || null,
      detectionTrigger: String(payload.detectionTrigger ?? '').trim() || null,
      reuseIdea: String(payload.reuseIdea ?? '').trim() || null,
      impactLevel: impactLevel as 'none' | 'minor' | 'occurred',
      status: status as 'considering' | 'completed',
      categories,
      occurrenceScore,
      severityScore,
      detectabilityScore,
      rpn: Number.isInteger(rpn) && rpn >= 1 && rpn <= 125 ? rpn : occurrenceScore * severityScore * detectabilityScore,
      riskLevel: riskLevel as 'low' | 'medium' | 'high' | 'critical' | null,
      points: judgment.points,
      reason: judgment.reason,
      recordedAt,
    },
  });

  return NextResponse.json(skill, { status: 201 });
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get('id')?.trim();

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const user = await getDemoUser();
  const result = await prisma.acquiredSkill.deleteMany({
    where: { id, userId: user.id },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: 'skill not found' }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
