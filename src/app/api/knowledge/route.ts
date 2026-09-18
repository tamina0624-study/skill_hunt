import { NextResponse } from 'next/server';

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

function calculateKnowledgePoints(payload: Record<string, unknown>) {
  const text = `${String(payload.workContext ?? '')} ${String(payload.description ?? '')} ${String(payload.potentialImpact ?? '')} ${String(payload.perceivedCause ?? '')} ${String(payload.detectionTrigger ?? '')} ${String(payload.userCountermeasure ?? '')}`;
  let points = 10;
  const reasons: string[] = ['気づきをナレッジとして記録できています'];

  if (String(payload.description ?? '').length >= 30) {
    points += 10;
    reasons.push('起こりそうだったことが具体的です');
  }
  if (String(payload.detectionTrigger ?? '').trim()) {
    points += 10;
    reasons.push('発見契機が残っており再利用しやすいです');
  }
  if (String(payload.perceivedCause ?? '').trim()) {
    points += 10;
    reasons.push('原因仮説があり改善につなげやすいです');
  }
  if (/チェック|レビュー|自動|検証|監視|手順|防止/.test(text)) {
    points += 10;
    reasons.push('対策につながる語彙が含まれています');
  }
  if (['high', 'critical'].includes(String(payload.riskLevel ?? ''))) {
    points += 10;
    reasons.push('高リスクの気づきを早めに言語化できています');
  }

  return {
    points: Math.min(points, 60),
    reason: `AI判定: ${reasons.join('。 ')}。`,
  };
}

export async function GET() {
  const user = await getDemoUser();
  const entries = await prisma.knowledgeEntry.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(entries);
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

  const judgment = calculateKnowledgePoints({
    ...payload,
    riskLevel,
  });

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
