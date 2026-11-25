-- Migration: Automatic Unique Food Package Code (FD-YYYY-XXXXXX) & Atomic QR Code Generation
-- Ensures every food_packages row gets a unique package_code and an associated qr_codes row
-- automatically at the exact time the vendor submits the food item.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

ALTER TABLE public.food_packages
    ADD COLUMN IF NOT EXISTS package_code TEXT;

CREATE OR REPLACE FUNCTION public.generate_package_code()
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

        candidate := 'FD-' || year_part || '-' || suffix;

        IF NOT EXISTS (
            SELECT 1 FROM public.food_packages p WHERE p.package_code = candidate
        ) THEN
            RETURN candidate;
        END IF;

        IF attempts >= 25 THEN
            RAISE EXCEPTION 'Unable to generate unique package_code after % attempts', attempts;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, extensions;

CREATE OR REPLACE FUNCTION public.set_package_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.package_code IS NULL OR btrim(NEW.package_code) = '' THEN
        NEW.package_code := public.generate_package_code();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

CREATE OR REPLACE FUNCTION public.ensure_package_qr_code()
RETURNS TRIGGER AS $$
DECLARE
    candidate_token TEXT;
    attempts INTEGER := 0;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.qr_codes q WHERE q.package_id = NEW.id) THEN
        LOOP
            attempts := attempts + 1;
            candidate_token := encode(gen_random_bytes(24), 'hex');
            IF NOT EXISTS (SELECT 1 FROM public.qr_codes q WHERE q.qr_token = candidate_token) THEN
                INSERT INTO public.qr_codes (package_id, qr_token, is_active)
                VALUES (NEW.id, candidate_token, true)
                ON CONFLICT (package_id) DO NOTHING;
                EXIT;
            END IF;
            IF attempts >= 15 THEN
                RAISE EXCEPTION 'Unable to generate unique qr_token after % attempts', attempts;
            END IF;
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

UPDATE public.food_packages
SET package_code = public.generate_package_code()
WHERE package_code IS NULL OR btrim(package_code) = '';

ALTER TABLE public.food_packages
    ALTER COLUMN package_code SET DEFAULT public.generate_package_code();

ALTER TABLE public.food_packages
    ALTER COLUMN package_code SET NOT NULL;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'food_packages_package_code_key'
    ) THEN
        ALTER TABLE public.food_packages
            ADD CONSTRAINT food_packages_package_code_key UNIQUE (package_code);
    END IF;
EXCEPTION
    WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_food_packages_code ON public.food_packages(package_code);

DROP TRIGGER IF EXISTS trg_food_packages_set_code ON public.food_packages;
CREATE TRIGGER trg_food_packages_set_code
    BEFORE INSERT ON public.food_packages
    FOR EACH ROW
    EXECUTE FUNCTION public.set_package_code();

DROP TRIGGER IF EXISTS trg_food_packages_ensure_qr ON public.food_packages;
CREATE TRIGGER trg_food_packages_ensure_qr
    AFTER INSERT ON public.food_packages
    FOR EACH ROW
    EXECUTE FUNCTION public.ensure_package_qr_code();

-- Backfill QR codes for any existing food_packages without a qr_codes row
INSERT INTO public.qr_codes (package_id, qr_token, is_active)
SELECT p.id, encode(gen_random_bytes(24), 'hex'), true
FROM public.food_packages p
WHERE NOT EXISTS (SELECT 1 FROM public.qr_codes q WHERE q.package_id = p.id)
ON CONFLICT (package_id) DO NOTHING;
