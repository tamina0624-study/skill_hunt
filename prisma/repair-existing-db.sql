ALTER TABLE public.acquired_skills
ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';

ALTER TABLE public.acquired_skills
ADD COLUMN IF NOT EXISTS "confidentialityConfirmed" BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.acquired_skills
ADD COLUMN IF NOT EXISTS "potentialImpact" TEXT,
ADD COLUMN IF NOT EXISTS "perceivedCause" TEXT,
ADD COLUMN IF NOT EXISTS "detectionTrigger" TEXT,
ADD COLUMN IF NOT EXISTS "reuseIdea" TEXT;

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
