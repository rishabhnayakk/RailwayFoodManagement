-- ==============================================================================
-- RAILGUARD – COMPLETE DATABASE SCHEMA & SECURITY POLICIES
-- ==============================================================================
-- Run this script in the Supabase Dashboard: SQL Editor -> New Query -> Run
-- Contains zero dummy or mock data. The database starts completely clean.
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ENUM TYPES
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'inspector', 'vendor', 'passenger');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'vendor';

DO $$ BEGIN
    CREATE TYPE complaint_status AS ENUM (
        'submitted',
        'pending_review',
        'assigned',
        'in_progress',
        'report_submitted',
        'unable_to_resolve',
        'escalated',
        'resolved',
        'reopened'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TYPE public.complaint_status ADD VALUE IF NOT EXISTS 'unable_to_resolve';
ALTER TYPE public.complaint_status ADD VALUE IF NOT EXISTS 'escalated';

DO $$ BEGIN
    CREATE TYPE complaint_severity AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ==============================================================================
-- TABLE 1: profiles
-- User accounts for Admin, Quality Inspectors, Vendors, and Passengers.
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT,
    role user_role NOT NULL DEFAULT 'passenger',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended'));

CREATE INDEX IF NOT EXISTS idx_profiles_role_status ON public.profiles(role, status);

-- ==============================================================================
-- TABLE 2: vendors
-- Railway catering contractors and pantry agencies (Managed by Admin).
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id UUID UNIQUE REFERENCES public.profiles(id) ON DELETE SET NULL,
    business_name TEXT NOT NULL,
    license_number TEXT UNIQUE NOT NULL,
    contact_name TEXT,
    phone TEXT,
    email TEXT,
    station_location TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.vendors
    ADD COLUMN IF NOT EXISTS owner_user_id UUID UNIQUE REFERENCES public.profiles(id) ON DELETE SET NULL;

-- ==============================================================================
-- TABLE 3: food_packages
-- Food packages uploaded by Vendors and approved by Railway Administration.
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.food_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_code TEXT UNIQUE NOT NULL,
    vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
    package_name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Meals',
    description TEXT,
    price NUMERIC(10, 2) CHECK (price IS NULL OR price >= 0),
    image_url TEXT,
    ingredients TEXT,
    prepared_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    fssai_license TEXT,
    train_info TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    approval_status TEXT NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
    approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.food_packages
    ADD COLUMN IF NOT EXISTS package_code TEXT,
    ADD COLUMN IF NOT EXISTS image_url TEXT,
    ADD COLUMN IF NOT EXISTS ingredients TEXT,
    ADD COLUMN IF NOT EXISTS prepared_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS fssai_license TEXT,
    ADD COLUMN IF NOT EXISTS train_info TEXT,
    ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
    ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

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

CREATE INDEX IF NOT EXISTS idx_food_packages_code ON public.food_packages(package_code);
CREATE INDEX IF NOT EXISTS idx_food_packages_vendor ON public.food_packages(vendor_id);
CREATE INDEX IF NOT EXISTS idx_food_packages_approval ON public.food_packages(approval_status);

-- ==============================================================================
-- TABLE 4: qr_codes
-- Unique, unpredictable QR tokens generated by Vendors for food packages.
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.qr_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_id UUID NOT NULL UNIQUE REFERENCES public.food_packages(id) ON DELETE CASCADE,
    qr_token TEXT UNIQUE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    expires_at TIMESTAMPTZ,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.qr_codes
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_qr_codes_token ON public.qr_codes(qr_token);
CREATE INDEX IF NOT EXISTS idx_qr_codes_package ON public.qr_codes(package_id);

-- ==============================================================================
-- TABLE 5: feedback
-- Passenger star ratings (1 to 5) and written reviews.
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_id UUID NOT NULL REFERENCES public.food_packages(id) ON DELETE CASCADE,
    passenger_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    passenger_name TEXT,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    food_quality_rating INTEGER CHECK (food_quality_rating >= 1 AND food_quality_rating <= 5),
    taste_rating INTEGER CHECK (taste_rating >= 1 AND taste_rating <= 5),
    packaging_rating INTEGER CHECK (packaging_rating >= 1 AND packaging_rating <= 5),
    hygiene_rating INTEGER CHECK (hygiene_rating >= 1 AND hygiene_rating <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_feedback_package ON public.feedback(package_id);
CREATE INDEX IF NOT EXISTS idx_feedback_passenger ON public.feedback(passenger_id);

-- ==============================================================================
-- TABLE 6: complaints
-- Passenger food-quality and hygiene complaints with full investigative tracking.
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.complaints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_ref TEXT UNIQUE NOT NULL,
    package_id UUID NOT NULL REFERENCES public.food_packages(id) ON DELETE CASCADE,
    passenger_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    assigned_inspector_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    issue_type TEXT NOT NULL,
    description TEXT NOT NULL,
    severity complaint_severity NOT NULL DEFAULT 'medium',
    status complaint_status NOT NULL DEFAULT 'submitted',
    image_url TEXT,
    passenger_name TEXT,
    passenger_contact TEXT,
    pnr_number TEXT,
    train_number TEXT,
    coach_seat TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS passenger_name TEXT;
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS complaint_ref TEXT;

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

DROP TRIGGER IF EXISTS trg_complaints_set_ref ON public.complaints;
CREATE TRIGGER trg_complaints_set_ref
    BEFORE INSERT ON public.complaints
    FOR EACH ROW
    EXECUTE FUNCTION public.set_complaint_ref();

CREATE INDEX IF NOT EXISTS idx_complaints_ref ON public.complaints(complaint_ref);
CREATE INDEX IF NOT EXISTS idx_complaints_package ON public.complaints(package_id);
CREATE INDEX IF NOT EXISTS idx_complaints_passenger ON public.complaints(passenger_id);
CREATE INDEX IF NOT EXISTS idx_complaints_inspector ON public.complaints(assigned_inspector_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON public.complaints(status);

-- ==============================================================================
-- TABLE 7: inspection_reports
-- Detailed investigation findings, action taken, and evidence submitted by Inspectors.
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.inspection_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
    inspector_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    investigation_date DATE NOT NULL DEFAULT CURRENT_DATE,
    problem_identified TEXT,
    findings TEXT NOT NULL,
    action_taken TEXT,
    resolution_description TEXT,
    recommended_status TEXT NOT NULL DEFAULT 'report_submitted' CHECK (recommended_status IN ('report_submitted', 'resolved', 'unable_to_resolve', 'escalated')),
    evidence_image_url TEXT,
    evidence_images JSONB NOT NULL DEFAULT '[]'::jsonb,
    remarks TEXT,
    status TEXT NOT NULL DEFAULT 'submitted',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.inspection_reports
    ADD COLUMN IF NOT EXISTS investigation_date DATE NOT NULL DEFAULT CURRENT_DATE,
    ADD COLUMN IF NOT EXISTS problem_identified TEXT,
    ADD COLUMN IF NOT EXISTS action_taken TEXT,
    ADD COLUMN IF NOT EXISTS resolution_description TEXT,
    ADD COLUMN IF NOT EXISTS recommended_status TEXT NOT NULL DEFAULT 'report_submitted' CHECK (recommended_status IN ('report_submitted', 'resolved', 'unable_to_resolve', 'escalated')),
    ADD COLUMN IF NOT EXISTS evidence_images JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_inspection_reports_complaint ON public.inspection_reports(complaint_id);
CREATE INDEX IF NOT EXISTS idx_inspection_reports_inspector ON public.inspection_reports(inspector_id);

-- ==============================================================================
-- TABLE 8: complaint_assignments
-- Audit log of inspector assignments by Admin.
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.complaint_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
    inspector_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_complaint_assignments_complaint ON public.complaint_assignments(complaint_id);
CREATE INDEX IF NOT EXISTS idx_complaint_assignments_inspector ON public.complaint_assignments(inspector_id);

-- ==============================================================================
-- TABLE 9: complaint_status_history
-- Full chronological audit trail of complaint transitions.
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.complaint_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
    changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    old_status TEXT,
    new_status TEXT NOT NULL,
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_status_history_complaint ON public.complaint_status_history(complaint_id);

-- ==============================================================================
-- TABLE 10: audit_logs
-- Platform-wide administrative and operational activity log.
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    target_entity TEXT,
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Security helper functions (require active account status)
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() AND status = 'active';
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT (public.current_user_role() = 'admin');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_inspector()
RETURNS BOOLEAN AS $$
  SELECT (public.current_user_role() = 'inspector');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_vendor()
RETURNS BOOLEAN AS $$
  SELECT (public.current_user_role() = 'vendor');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- PROFILES POLICIES
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id OR public.is_admin() OR public.is_inspector());

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (
        auth.uid() = id
        AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
        AND status = (SELECT p.status FROM public.profiles p WHERE p.id = auth.uid())
    );

DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
CREATE POLICY "Admins can manage all profiles"
    ON public.profiles FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- VENDORS POLICIES
-- Public users verify packages through /api/qr/verify; internal vendor records are scoped.
DROP POLICY IF EXISTS "Anyone can view active vendors" ON public.vendors;
DROP POLICY IF EXISTS "Public can verify active vendor identity" ON public.vendors;
DROP POLICY IF EXISTS "Admins can manage vendors" ON public.vendors;
DROP POLICY IF EXISTS "Vendors can view their own vendor record" ON public.vendors;
DROP POLICY IF EXISTS "Staff and owning vendor can view vendor records" ON public.vendors;

CREATE POLICY "Staff and owning vendor can view vendor records"
    ON public.vendors FOR SELECT
    USING (
        public.is_admin()
        OR public.is_inspector()
        OR owner_user_id = auth.uid()
        OR status = 'active'
    );

CREATE POLICY "Admins can manage vendors"
    ON public.vendors FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- FOOD PACKAGES POLICIES
DROP POLICY IF EXISTS "Anyone can view packages" ON public.food_packages;
DROP POLICY IF EXISTS "Admins can manage food packages" ON public.food_packages;
DROP POLICY IF EXISTS "Vendors manage own food packages" ON public.food_packages;
DROP POLICY IF EXISTS "Authenticated staff and owning vendor view packages" ON public.food_packages;
DROP POLICY IF EXISTS "Vendors insert own food packages" ON public.food_packages;
DROP POLICY IF EXISTS "Vendors update own food packages" ON public.food_packages;

CREATE POLICY "Authenticated staff and owning vendor view packages"
    ON public.food_packages FOR SELECT
    USING (
        public.is_admin()
        OR public.is_inspector()
        OR EXISTS (
            SELECT 1 FROM public.vendors v
            WHERE v.id = vendor_id AND v.owner_user_id = auth.uid()
        )
        OR (
            status = 'active'
            AND approval_status = 'approved'
            AND EXISTS (
                SELECT 1 FROM public.vendors v
                WHERE v.id = vendor_id AND v.status = 'active'
            )
        )
    );

CREATE POLICY "Admins can manage food packages"
    ON public.food_packages FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "Vendors insert own food packages"
    ON public.food_packages FOR INSERT
    WITH CHECK (
        public.is_vendor()
        AND approval_status = 'pending'
        AND EXISTS (
            SELECT 1 FROM public.vendors v
            WHERE v.id = vendor_id
              AND v.owner_user_id = auth.uid()
              AND v.status = 'active'
        )
    );

CREATE POLICY "Vendors update own food packages"
    ON public.food_packages FOR UPDATE
    USING (
        public.is_vendor()
        AND EXISTS (
            SELECT 1 FROM public.vendors v
            WHERE v.id = vendor_id
              AND v.owner_user_id = auth.uid()
              AND v.status = 'active'
        )
    )
    WITH CHECK (
        public.is_vendor()
        AND EXISTS (
            SELECT 1 FROM public.vendors v
            WHERE v.id = vendor_id
              AND v.owner_user_id = auth.uid()
              AND v.status = 'active'
        )
    );

-- QR CODES POLICIES
DROP POLICY IF EXISTS "Anyone can read active qr codes" ON public.qr_codes;
DROP POLICY IF EXISTS "Admins can manage qr codes" ON public.qr_codes;
DROP POLICY IF EXISTS "Vendors view own qr codes" ON public.qr_codes;
DROP POLICY IF EXISTS "Vendors create own qr codes" ON public.qr_codes;
DROP POLICY IF EXISTS "Vendors update own qr codes" ON public.qr_codes;

CREATE POLICY "Admins can manage qr codes"
    ON public.qr_codes FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "Public can verify active approved qr codes"
    ON public.qr_codes FOR SELECT
    USING (
        is_active = true
        AND EXISTS (
            SELECT 1 FROM public.food_packages p
            JOIN public.vendors v ON v.id = p.vendor_id
            WHERE p.id = package_id
              AND p.status = 'active'
              AND p.approval_status = 'approved'
              AND v.status = 'active'
        )
    );

CREATE POLICY "Vendors view own qr codes"
    ON public.qr_codes FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.food_packages p
            JOIN public.vendors v ON v.id = p.vendor_id
            WHERE p.id = package_id AND v.owner_user_id = auth.uid()
        )
    );

CREATE POLICY "Vendors create own qr codes"
    ON public.qr_codes FOR INSERT
    WITH CHECK (
        public.is_vendor()
        AND EXISTS (
            SELECT 1 FROM public.food_packages p
            JOIN public.vendors v ON v.id = p.vendor_id
            WHERE p.id = package_id
              AND v.owner_user_id = auth.uid()
              AND v.status = 'active'
        )
    );

-- FEEDBACK POLICIES
DROP POLICY IF EXISTS "Passengers and visitors can insert feedback" ON public.feedback;
DROP POLICY IF EXISTS "Passengers view own feedback or admin all" ON public.feedback;
DROP POLICY IF EXISTS "Vendors view feedback for own packages" ON public.feedback;

CREATE POLICY "Passengers and visitors can insert feedback"
    ON public.feedback FOR INSERT
    WITH CHECK (
        (passenger_id IS NULL OR passenger_id = auth.uid())
        AND EXISTS (
            SELECT 1 FROM public.food_packages p
            JOIN public.vendors v ON v.id = p.vendor_id
            WHERE p.id = package_id
              AND p.status = 'active'
              AND p.approval_status = 'approved'
              AND v.status = 'active'
        )
    );

CREATE POLICY "Passengers view own feedback or admin all"
    ON public.feedback FOR SELECT
    USING (
        passenger_id = auth.uid()
        OR public.is_admin()
        OR public.is_inspector()
    );

CREATE POLICY "Vendors view feedback for own packages"
    ON public.feedback FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.food_packages p
        JOIN public.vendors v ON v.id = p.vendor_id
        WHERE p.id = package_id AND v.owner_user_id = auth.uid()
    ));

-- COMPLAINTS POLICIES
DROP POLICY IF EXISTS "Passengers can file complaints" ON public.complaints;
DROP POLICY IF EXISTS "Complaints access policy" ON public.complaints;
DROP POLICY IF EXISTS "Admins and assigned inspectors can update complaints" ON public.complaints;

CREATE POLICY "Passengers can file complaints"
    ON public.complaints FOR INSERT
    WITH CHECK (
        (passenger_id IS NULL OR passenger_id = auth.uid())
        AND status = 'submitted'
        AND assigned_inspector_id IS NULL
        AND EXISTS (
            SELECT 1 FROM public.food_packages p
            JOIN public.vendors v ON v.id = p.vendor_id
            WHERE p.id = package_id
              AND p.status = 'active'
              AND p.approval_status = 'approved'
              AND v.status = 'active'
        )
    );

CREATE POLICY "Complaints access policy"
    ON public.complaints FOR SELECT
    USING (
        public.is_admin()
        OR passenger_id = auth.uid()
        OR (public.is_inspector() AND assigned_inspector_id = auth.uid())
    );

CREATE POLICY "Admins and assigned inspectors can update complaints"
    ON public.complaints FOR UPDATE
    USING (
        public.is_admin()
        OR (public.is_inspector() AND assigned_inspector_id = auth.uid())
    )
    WITH CHECK (
        public.is_admin()
        OR (
            public.is_inspector()
            AND assigned_inspector_id = auth.uid()
            AND status IN ('in_progress', 'report_submitted', 'unable_to_resolve', 'escalated')
        )
    );

-- INSPECTION REPORTS POLICIES
DROP POLICY IF EXISTS "Inspectors and admins can view inspection reports" ON public.inspection_reports;
DROP POLICY IF EXISTS "Inspectors can insert reports" ON public.inspection_reports;
DROP POLICY IF EXISTS "Inspectors can update own reports" ON public.inspection_reports;

CREATE POLICY "Inspectors and admins can view inspection reports"
    ON public.inspection_reports FOR SELECT
    USING (
        public.is_admin()
        OR (public.is_inspector() AND inspector_id = auth.uid())
    );

CREATE POLICY "Inspectors can insert reports"
    ON public.inspection_reports FOR INSERT
    WITH CHECK (
        public.is_admin()
        OR (
            public.is_inspector()
            AND inspector_id = auth.uid()
            AND EXISTS (
                SELECT 1 FROM public.complaints c
                WHERE c.id = complaint_id AND c.assigned_inspector_id = auth.uid()
            )
        )
    );

CREATE POLICY "Inspectors can update own reports"
    ON public.inspection_reports FOR UPDATE
    USING (
        public.is_admin()
        OR (public.is_inspector() AND inspector_id = auth.uid())
    );

-- COMPLAINT ASSIGNMENTS POLICIES
DROP POLICY IF EXISTS "Admins and assigned inspectors view assignments" ON public.complaint_assignments;
DROP POLICY IF EXISTS "Admins manage complaint assignments" ON public.complaint_assignments;

CREATE POLICY "Admins and assigned inspectors view assignments"
    ON public.complaint_assignments FOR SELECT
    USING (public.is_admin() OR (public.is_inspector() AND inspector_id = auth.uid()));

CREATE POLICY "Admins manage complaint assignments"
    ON public.complaint_assignments FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- COMPLAINT STATUS HISTORY POLICIES
DROP POLICY IF EXISTS "Anyone involved can view status history" ON public.complaint_status_history;
DROP POLICY IF EXISTS "System and staff can insert status history" ON public.complaint_status_history;

CREATE POLICY "Anyone involved can view status history"
    ON public.complaint_status_history FOR SELECT
    USING (
        public.is_admin()
        OR EXISTS (
            SELECT 1 FROM public.complaints c
            WHERE c.id = complaint_id
              AND (
                c.passenger_id = auth.uid()
                OR (public.is_inspector() AND c.assigned_inspector_id = auth.uid())
              )
        )
    );

CREATE POLICY "System and staff can insert status history"
    ON public.complaint_status_history FOR INSERT
    WITH CHECK (
        public.is_admin()
        OR (
            public.is_inspector()
            AND EXISTS (
                SELECT 1 FROM public.complaints c
                WHERE c.id = complaint_id AND c.assigned_inspector_id = auth.uid()
            )
        )
        OR (
            new_status = 'submitted'
            AND EXISTS (
                SELECT 1 FROM public.complaints c
                WHERE c.id = complaint_id AND c.passenger_id = auth.uid()
            )
        )
    );

-- AUDIT LOGS POLICIES
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "System can append audit logs" ON public.audit_logs;

CREATE POLICY "Admins can view audit logs"
    ON public.audit_logs FOR SELECT
    USING (public.is_admin());

CREATE POLICY "System can append audit logs"
    ON public.audit_logs FOR INSERT
    WITH CHECK (
        (public.is_admin() OR public.is_inspector() OR public.is_vendor())
        AND (user_id IS NULL OR user_id = auth.uid())
    );

-- ==============================================================================
-- AUTOMATIC PROFILE CREATION TRIGGER
-- Public self-registration always assigns 'passenger'; privileged accounts are
-- provisioned server-side by Admin via /api/admin/create-account.
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone, role, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Railway Passenger'),
    NEW.raw_user_meta_data->>'phone',
    'passenger',
    'active'
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, 'Railway Passenger'), public.profiles.full_name),
    phone = COALESCE(EXCLUDED.phone, public.profiles.phone);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- STORAGE BUCKET CONFIGURATION (3 DEDICATED BUCKETS)
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('food-images', 'food-images', true),
  ('complaint-evidence', 'complaint-evidence', true),
  ('inspection-evidence', 'inspection-evidence', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies (wrapped so newer Supabase storage ownership never rolls back tables)
DO $$ BEGIN
  -- Food Images (Vendors & Admins upload; public read for verified food display)
  DROP POLICY IF EXISTS "Public can upload food evidence images" ON storage.objects;
  DROP POLICY IF EXISTS "Public can view food evidence images" ON storage.objects;
  DROP POLICY IF EXISTS "Vendors and admins can upload food images" ON storage.objects;
  DROP POLICY IF EXISTS "Public can view food images" ON storage.objects;

  CREATE POLICY "Vendors and admins can upload food images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'food-images' AND (public.is_vendor() OR public.is_admin()));

  CREATE POLICY "Public can view food images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'food-images');

  -- Complaint Evidence (Uploaded during QR complaint filing; public/staff read)
  DROP POLICY IF EXISTS "Anyone can upload complaint evidence" ON storage.objects;
  DROP POLICY IF EXISTS "Public can view complaint evidence" ON storage.objects;

  CREATE POLICY "Anyone can upload complaint evidence"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'complaint-evidence');

  CREATE POLICY "Public can view complaint evidence"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'complaint-evidence');

  -- Inspection Evidence (Inspectors & Admins upload; staff/public read)
  DROP POLICY IF EXISTS "Inspectors and admins can upload inspection evidence" ON storage.objects;
  DROP POLICY IF EXISTS "Public can view inspection evidence" ON storage.objects;

  CREATE POLICY "Inspectors and admins can upload inspection evidence"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'inspection-evidence' AND (public.is_inspector() OR public.is_admin()));

  CREATE POLICY "Public can view inspection evidence"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'inspection-evidence');
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipped storage.objects policy setup due to ownership permissions; configure via Storage UI if needed.';
END $$;

NOTIFY pgrst, 'reload schema';
