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

function judgeSkillPoints(title: string) {
  const normalized = title.toLowerCase();

  if (/自動|テスト|監視|ci|cd|script|スクリプト|lint|検証/.test(normalized)) {
    return { points: 50, reason: 'AI判定: 自動化や検証の仕組みに関わるスキルのため50SPです。' };
  }
  if (/設計|レビュー|分析|改善|再発|原因|要件|仕様/.test(normalized)) {
    return { points: 30, reason: 'AI判定: 設計、分析、レビューに関わる再利用しやすいスキルのため30SPです。' };
  }
  if (/確認|手順|チェック|共有|記録|整理/.test(normalized)) {
    return { points: 20, reason: 'AI判定: 作業品質を安定させる基本スキルのため20SPです。' };
  }

  return { points: 10, reason: 'AI判定: 新しく言語化されたスキルとして10SPです。' };
}

export async function GET() {
  const user = await getDemoUser();
  const skills = await prisma.acquiredSkill.findMany({
    where: { userId: user.id },
    orderBy: { acquiredAt: 'desc' },
  });

  return NextResponse.json(skills);
}

export async function POST(request: Request) {
  const payload = await request.json();
  const title = String(payload.title ?? '').trim();

  if (!title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }

  const user = await getDemoUser();
  const judgment = judgeSkillPoints(title);

  const skill = await prisma.acquiredSkill.create({
    data: {
      userId: user.id,
      title,
      points: judgment.points,
      reason: judgment.reason,
      acquiredAt: new Date(payload.yearMonth ? `${payload.yearMonth}-01T00:00:00.000Z` : Date.now()),
    },
  });

  return NextResponse.json(skill, { status: 201 });
}
