ALTER TABLE public.acquired_skills
ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';

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
END
$repair$;
