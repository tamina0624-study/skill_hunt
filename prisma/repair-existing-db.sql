DO $repair$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'ImpactLevel'
      AND typnamespace = 'public'::regnamespace
  ) THEN
    EXECUTE 'CREATE TYPE public."ImpactLevel" AS ENUM (''none'', ''minor'', ''occurred'')';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'KnowledgeStatus'
      AND typnamespace = 'public'::regnamespace
  ) THEN
    EXECUTE 'CREATE TYPE public."KnowledgeStatus" AS ENUM (''considering'', ''completed'')';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'RiskLevel'
      AND typnamespace = 'public'::regnamespace
  ) THEN
    EXECUTE 'CREATE TYPE public."RiskLevel" AS ENUM (''low'', ''medium'', ''high'', ''critical'')';
  END IF;
END
$repair$;

ALTER TABLE public.acquired_skills
ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS "confidentialityConfirmed" BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS "potentialImpact" TEXT,
ADD COLUMN IF NOT EXISTS "perceivedCause" TEXT,
ADD COLUMN IF NOT EXISTS "detectionTrigger" TEXT,
ADD COLUMN IF NOT EXISTS "reuseIdea" TEXT,
ADD COLUMN IF NOT EXISTS "impactLevel" public."ImpactLevel" NOT NULL DEFAULT 'none',
ADD COLUMN IF NOT EXISTS status public."KnowledgeStatus" NOT NULL DEFAULT 'considering',
ADD COLUMN IF NOT EXISTS categories TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "occurrenceScore" SMALLINT,
ADD COLUMN IF NOT EXISTS "severityScore" SMALLINT,
ADD COLUMN IF NOT EXISTS "detectabilityScore" SMALLINT,
ADD COLUMN IF NOT EXISTS rpn SMALLINT,
ADD COLUMN IF NOT EXISTS "riskLevel" public."RiskLevel",
ADD COLUMN IF NOT EXISTS points INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS reason TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS "acquiredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $repair$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'knowledge_entries'
      AND column_name = 'subject'
  ) THEN
    ALTER TABLE public.knowledge_entries
    ALTER COLUMN subject SET DEFAULT '';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'knowledge_entries'
      AND column_name = 'summary'
  ) THEN
    ALTER TABLE public.knowledge_entries
    ALTER COLUMN summary SET DEFAULT '';
  END IF;
END
$repair$;
