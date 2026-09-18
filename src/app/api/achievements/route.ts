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

function judgeAchievementPoints(title: string) {
  const normalized = title.toLowerCase();

  if (/障害|本番|リリース|改善|自動|削減|解決|復旧|設計/.test(normalized)) {
    return { points: 50, reason: 'AI判定: 影響の大きい成果または改善実績として50APです。' };
  }
  if (/レビュー|共有|資料|標準化|手順|教育|支援|提案/.test(normalized)) {
    return { points: 30, reason: 'AI判定: チームや将来の作業に再利用できる実績として30APです。' };
  }
  if (/対応|確認|調査|整理|記録/.test(normalized)) {
    return { points: 20, reason: 'AI判定: 日々の業務改善につながる実績として20APです。' };
  }

  return { points: 10, reason: 'AI判定: 実績として記録された行動に10APです。' };
}

export async function GET() {
  const user = await getDemoUser();
  const items = await prisma.achievementRecord.findMany({
    where: { userId: user.id },
    orderBy: { achievedAt: 'desc' },
  });

  return NextResponse.json(items);
}

export async function POST(request: Request) {
  const payload = await request.json();
  const title = String(payload.title ?? '').trim();

  if (!title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }

  const user = await getDemoUser();
  const judgment = judgeAchievementPoints(title);

  const item = await prisma.achievementRecord.create({
    data: {
      userId: user.id,
      title,
      points: judgment.points,
      reason: judgment.reason,
      achievedAt: new Date(payload.yearMonth ? `${payload.yearMonth}-01T00:00:00.000Z` : Date.now()),
    },
  });

  return NextResponse.json(item, { status: 201 });
}
