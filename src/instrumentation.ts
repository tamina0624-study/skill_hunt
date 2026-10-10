export async function register() {
  if (
    process.env.REBUILD_DATABASE !== '1' ||
    process.env.NEXT_RUNTIME !== 'nodejs' ||
    process.env.NEXT_PHASE === 'phase-production-build'
  ) {
    return;
  }

  const [{ Prisma }, { prisma }] = await Promise.all([
    import('@prisma/client'),
    import('./lib/prisma'),
  ]);

  console.info('REBUILD_DATABASE=1: applying non-destructive database repairs.');

  await prisma.$executeRaw(
    Prisma.sql`ALTER TABLE public.acquired_skills
      ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT ''`,
  );

  const [legacySubject] = await prisma.$queryRaw<{ exists: boolean }[]>(
    Prisma.sql`SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'knowledge_entries'
        AND column_name = 'subject'
    ) AS "exists"`,
  );

  if (legacySubject.exists) {
    await prisma.$executeRaw(
      Prisma.sql`ALTER TABLE public.knowledge_entries
        ALTER COLUMN subject SET DEFAULT ''`,
    );
  }

  console.info('REBUILD_DATABASE=1: database repairs completed.');
}
