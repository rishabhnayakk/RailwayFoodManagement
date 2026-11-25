-- Migration: Automatic Unique Readable Complaint ID Generation (RG-YYYY-XXXXXX)
-- Adds `complaint_ref` with UNIQUE constraint, database-side random generator,
-- collision handling, and BEFORE INSERT trigger.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

ALTER TABLE public.complaints
    ADD COLUMN IF NOT EXISTS complaint_ref TEXT;

CREATE OR REPLACE FUNCTION public.generate_complaint_ref()
RETURNS TEXT AS $$
DECLARE
    chars CONSTANT TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    year_part TEXT := to_char(timezone('utc'::text, now()), 'YYYY');
    raw_bytes BYTEA;
    suffix TEXT;
    candidate TEXT;
    i INTEGER;
    attempts INTEGER := 0;
BEGIN
    LOOP
        attempts := attempts + 1;
        raw_bytes := gen_random_bytes(6);
        suffix := '';
        FOR i IN 0..5 LOOP
            suffix := suffix || substr(chars, (get_byte(raw_bytes, i) % length(chars)) + 1, 1);
        END LOOP;

        candidate := 'RG-' || year_part || '-' || suffix;

        IF NOT EXISTS (
            SELECT 1 FROM public.complaints c WHERE c.complaint_ref = candidate
        ) THEN
            RETURN candidate;
        END IF;

        IF attempts >= 25 THEN
            RAISE EXCEPTION 'Unable to generate unique complaint_ref after % attempts', attempts;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, extensions;

CREATE OR REPLACE FUNCTION public.set_complaint_ref()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.complaint_ref IS NULL OR btrim(NEW.complaint_ref) = '' THEN
        NEW.complaint_ref := public.generate_complaint_ref();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

-- Backfill any pre-existing complaints safely before enforcing NOT NULL + UNIQUE
UPDATE public.complaints
SET complaint_ref = public.generate_complaint_ref()
WHERE complaint_ref IS NULL OR btrim(complaint_ref) = '';

ALTER TABLE public.complaints
    ALTER COLUMN complaint_ref SET DEFAULT public.generate_complaint_ref();

ALTER TABLE public.complaints
    ALTER COLUMN complaint_ref SET NOT NULL;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'complaints_complaint_ref_key'
    ) THEN
        ALTER TABLE public.complaints
            ADD CONSTRAINT complaints_complaint_ref_key UNIQUE (complaint_ref);
    END IF;
EXCEPTION
    WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_complaints_ref ON public.complaints(complaint_ref);

DROP TRIGGER IF EXISTS trg_complaints_set_ref ON public.complaints;
CREATE TRIGGER trg_complaints_set_ref
    BEFORE INSERT ON public.complaints
    FOR EACH ROW
    EXECUTE FUNCTION public.set_complaint_ref();
