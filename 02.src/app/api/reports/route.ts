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

function monthBounds(yearMonth: string) {
  const [year, month] = yearMonth.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  return { start, end };
}

function buildMonthlyEvaluation(knowledgeCount: number, skillCount: number, achievementCount: number, knowledgePoints: number, skillPoints: number, achievementPoints: number) {
  if (knowledgeCount === 0 && skillCount === 0 && achievementCount === 0) {
    return {
      title: '次の一歩を始める準備ができています',
      message: '今月の登録はまだありませんが、1件の記録から成長の軌跡を始められます。',
      focus: '次のステップ: まずは最も大事な一件だけを、対象・気づき・対策の3点で残しましょう。',
    };
  }

  return {
    title: '今月も前に進めています',
    message: `ナレッジ${knowledgeCount}件、スキル${skillCount}件、実績${achievementCount}件を記録できています。内訳は${knowledgePoints}KP、${skillPoints}SP、${achievementPoints}APです。`,
    focus: '次のステップ: いちばん強く再利用できる経験を選び、他の人にも伝えられる形にまとめましょう。',
  };
}

function buildEngineerEvaluation(totalEp: number, monthlyGrowth: number) {
  return {
    title: '成長の質が安定しています',
    message: `現在の総EPは${totalEp}、今月の伸びは${monthlyGrowth}です。継続的に小さな改善を積み上げているため、今の成長は十分に支えられています。`,
    nextAction: '次は「再発防止」「標準化」「共有」を1つずつ明文化して、知識を次の作業へつなげてください。',
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const yearMonth = searchParams.get('yearMonth') ?? '';
  const user = await getDemoUser();

  if (!yearMonth) {
    const reports = await prisma.monthlyReport.findMany({
      where: { userId: user.id },
      orderBy: { generatedAt: 'desc' },
    });

    return NextResponse.json(reports);
  }

  const report = await prisma.monthlyReport.findUnique({
    where: { userId_periodKey: { userId: user.id, periodKey: yearMonth } },
  });

  if (!report) {
    return NextResponse.json({ error: 'report not found' }, { status: 404 });
  }

  return NextResponse.json(report);
}

export async function POST(request: Request) {
  const payload = (await request.json()) as { yearMonth?: string };
  const yearMonth = String(payload.yearMonth ?? '').trim();

  if (!yearMonth) {
    return NextResponse.json({ error: 'yearMonth is required' }, { status: 400 });
  }

  const user = await getDemoUser();
  const { start, end } = monthBounds(yearMonth);

  const [knowledgeEntries, skills, achievements, userRecord] = await Promise.all([
    prisma.knowledgeEntry.findMany({
      where: { userId: user.id, occurredAt: { gte: start, lt: end } },
      orderBy: { occurredAt: 'desc' },
    }),
    prisma.acquiredSkill.findMany({
      where: { userId: user.id, acquiredAt: { gte: start, lt: end } },
      orderBy: { acquiredAt: 'desc' },
    }),
    prisma.achievementRecord.findMany({
      where: { userId: user.id, achievedAt: { gte: start, lt: end } },
      orderBy: { achievedAt: 'desc' },
    }),
    prisma.user.findUnique({ where: { id: user.id } }),
  ]);

  const knowledgeCount = knowledgeEntries.length;
  const skillCount = skills.length;
  const achievementCount = achievements.length;
  const knowledgePoints = knowledgeEntries.reduce((total, entry) => total + entry.knowledgePoints, 0);
  const skillPoints = skills.reduce((total, skill) => total + skill.points, 0);
  const achievementPoints = achievements.reduce((total, item) => total + item.points, 0);
  const monthlyGrowth = knowledgePoints + skillPoints + achievementPoints;
  const totalEp = userRecord?.totalEp ?? 0;

  const monthlyEvaluation = buildMonthlyEvaluation(knowledgeCount, skillCount, achievementCount, knowledgePoints, skillPoints, achievementPoints);
  const engineerEvaluation = buildEngineerEvaluation(totalEp, monthlyGrowth);

  const report = await prisma.monthlyReport.upsert({
    where: {
      userId_periodKey: {
        userId: user.id,
        periodKey: yearMonth,
      },
    },
    update: {
      periodStart: start,
      periodEnd: end,
      generatedAt: new Date(),
      monthlyTitle: monthlyEvaluation.title,
      monthlyMessage: monthlyEvaluation.message,
      monthlyFocus: monthlyEvaluation.focus,
      engineerTitle: engineerEvaluation.title,
      engineerMessage: engineerEvaluation.message,
      engineerNextAction: engineerEvaluation.nextAction,
      snapshotJson: {
        knowledgeCount,
        skillCount,
        achievementCount,
        knowledgePoints,
        skillPoints,
        achievementPoints,
        totalEp,
        monthlyGrowth,
      },
    },
    create: {
      userId: user.id,
      periodKey: yearMonth,
      periodStart: start,
      periodEnd: end,
      monthlyTitle: monthlyEvaluation.title,
      monthlyMessage: monthlyEvaluation.message,
      monthlyFocus: monthlyEvaluation.focus,
      engineerTitle: engineerEvaluation.title,
      engineerMessage: engineerEvaluation.message,
      engineerNextAction: engineerEvaluation.nextAction,
      snapshotJson: {
        knowledgeCount,
        skillCount,
        achievementCount,
        knowledgePoints,
        skillPoints,
        achievementPoints,
        totalEp,
        monthlyGrowth,
      },
    },
  });

  return NextResponse.json(
    {
      id: report.id,
      periodKey: report.periodKey,
      generatedAt: report.generatedAt.toISOString(),
      periodLabel: `${report.periodKey.slice(0, 4)}年${Number(report.periodKey.slice(5, 7))}月`,
      monthlyEvaluation,
      engineerEvaluation,
    },
    { status: 201 },
  );
}
