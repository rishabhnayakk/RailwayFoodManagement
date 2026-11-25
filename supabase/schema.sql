-- ==============================================================================
-- RAILGUARD – COMPLETE DATABASE SCHEMA & SECURITY POLICIES
-- ==============================================================================
-- Run this script in the Supabase Dashboard: SQL Editor -> New Query -> Run
-- Contains zero dummy or mock data. The database starts completely clean.
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. ENUM TYPES
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'inspector', 'passenger');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE complaint_status AS ENUM (
        'submitted',
        'pending_review',
        'assigned',
        'in_progress',
        'report_submitted',
        'resolved',
        'reopened'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE complaint_severity AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ==============================================================================
-- TABLE 1: profiles
-- User accounts for Admin, Quality Inspectors, and Passengers.
-- Vendors do NOT have logins and are NOT stored here.
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT,
    role user_role NOT NULL DEFAULT 'passenger',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- TABLE 2: vendors
-- Railway catering contractors and pantry agencies (Managed by Admin).
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- ==============================================================================
-- TABLE 3: food_packages
-- Authorized food packages provided by registered vendors.
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.food_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
    package_name TEXT NOT NULL,
    category TEXT DEFAULT 'Meals',
    description TEXT,
    price NUMERIC(10, 2),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_food_packages_vendor ON public.food_packages(vendor_id);

-- ==============================================================================
-- TABLE 4: qr_codes
-- Unique, unpredictable QR tokens linked to authorized food packages.
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.qr_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_id UUID NOT NULL REFERENCES public.food_packages(id) ON DELETE CASCADE,
    qr_token TEXT UNIQUE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

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

-- Keep existing Supabase projects compatible with the QR complaint form.
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS passenger_name TEXT;

CREATE INDEX IF NOT EXISTS idx_complaints_package ON public.complaints(package_id);
CREATE INDEX IF NOT EXISTS idx_complaints_passenger ON public.complaints(passenger_id);
CREATE INDEX IF NOT EXISTS idx_complaints_inspector ON public.complaints(assigned_inspector_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON public.complaints(status);

-- ==============================================================================
-- TABLE 7: inspection_reports
-- Findings, remarks, and photographic evidence submitted by Quality Inspectors.
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.inspection_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
    inspector_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    findings TEXT NOT NULL,
    evidence_image_url TEXT,
    remarks TEXT,
    status TEXT NOT NULL DEFAULT 'submitted',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_inspection_reports_complaint ON public.inspection_reports(complaint_id);
CREATE INDEX IF NOT EXISTS idx_inspection_reports_inspector ON public.inspection_reports(inspector_id);

-- ==============================================================================
-- TABLE 8: complaint_status_history
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
-- TABLE 9: audit_logs
-- Platform-wide administrative activity log.
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
ALTER TABLE public.complaint_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Security helper functions
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT (public.current_user_role() = 'admin');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_inspector()
RETURNS BOOLEAN AS $$
  SELECT (public.current_user_role() = 'inspector');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- PROFILES POLICIES
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id OR public.is_admin() OR public.is_inspector());

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
CREATE POLICY "Admins can manage all profiles"
    ON public.profiles FOR ALL
    USING (public.is_admin());

-- VENDORS POLICIES (Public read for packaging verification; Admin manage)
DROP POLICY IF EXISTS "Anyone can view active vendors" ON public.vendors;
CREATE POLICY "Anyone can view active vendors"
    ON public.vendors FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Admins can manage vendors" ON public.vendors;
CREATE POLICY "Admins can manage vendors"
    ON public.vendors FOR ALL
    USING (public.is_admin());

-- FOOD PACKAGES POLICIES
DROP POLICY IF EXISTS "Anyone can view packages" ON public.food_packages;
CREATE POLICY "Anyone can view packages"
    ON public.food_packages FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Admins can manage food packages" ON public.food_packages;
CREATE POLICY "Admins can manage food packages"
    ON public.food_packages FOR ALL
    USING (public.is_admin());

-- QR CODES POLICIES
DROP POLICY IF EXISTS "Anyone can read active qr codes" ON public.qr_codes;
CREATE POLICY "Anyone can read active qr codes"
    ON public.qr_codes FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Admins can manage qr codes" ON public.qr_codes;
CREATE POLICY "Admins can manage qr codes"
    ON public.qr_codes FOR ALL
    USING (public.is_admin());

-- FEEDBACK POLICIES
DROP POLICY IF EXISTS "Passengers and visitors can insert feedback" ON public.feedback;
CREATE POLICY "Passengers and visitors can insert feedback"
    ON public.feedback FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "Passengers view own feedback or admin all" ON public.feedback;
CREATE POLICY "Passengers view own feedback or admin all"
    ON public.feedback FOR SELECT
    USING (
        passenger_id = auth.uid() OR
        public.is_admin() OR
        public.is_inspector()
    );

-- COMPLAINTS POLICIES
DROP POLICY IF EXISTS "Passengers can file complaints" ON public.complaints;
CREATE POLICY "Passengers can file complaints"
    ON public.complaints FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "Complaints access policy" ON public.complaints;
CREATE POLICY "Complaints access policy"
    ON public.complaints FOR SELECT
    USING (
        public.is_admin() OR
        passenger_id = auth.uid() OR
        assigned_inspector_id = auth.uid()
    );

DROP POLICY IF EXISTS "Admins and assigned inspectors can update complaints" ON public.complaints;
CREATE POLICY "Admins and assigned inspectors can update complaints"
    ON public.complaints FOR UPDATE
    USING (
        public.is_admin() OR
        assigned_inspector_id = auth.uid()
    );

-- INSPECTION REPORTS POLICIES
DROP POLICY IF EXISTS "Inspectors and admins can view inspection reports" ON public.inspection_reports;
CREATE POLICY "Inspectors and admins can view inspection reports"
    ON public.inspection_reports FOR SELECT
    USING (
        public.is_admin() OR
        inspector_id = auth.uid()
    );

DROP POLICY IF EXISTS "Inspectors can insert reports" ON public.inspection_reports;
CREATE POLICY "Inspectors can insert reports"
    ON public.inspection_reports FOR INSERT
    WITH CHECK (
        public.is_inspector() OR
        public.is_admin()
    );

DROP POLICY IF EXISTS "Inspectors can update own reports" ON public.inspection_reports;
CREATE POLICY "Inspectors can update own reports"
    ON public.inspection_reports FOR UPDATE
    USING (
        inspector_id = auth.uid() OR
        public.is_admin()
    );

-- COMPLAINT STATUS HISTORY POLICIES
DROP POLICY IF EXISTS "Anyone involved can view status history" ON public.complaint_status_history;
CREATE POLICY "Anyone involved can view status history"
    ON public.complaint_status_history FOR SELECT
    USING (
        public.is_admin() OR
        EXISTS (
            SELECT 1 FROM public.complaints c
            WHERE c.id = complaint_id AND (c.passenger_id = auth.uid() OR c.assigned_inspector_id = auth.uid())
        )
    );

DROP POLICY IF EXISTS "System and staff can insert status history" ON public.complaint_status_history;
CREATE POLICY "System and staff can insert status history"
    ON public.complaint_status_history FOR INSERT
    WITH CHECK (true);

-- AUDIT LOGS POLICIES
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Admins can view audit logs"
    ON public.audit_logs FOR SELECT
    USING (public.is_admin());

DROP POLICY IF EXISTS "System can append audit logs" ON public.audit_logs;
CREATE POLICY "System can append audit logs"
    ON public.audit_logs FOR INSERT
    WITH CHECK (true);

-- ==============================================================================
-- AUTOMATIC PROFILE CREATION TRIGGER
-- When a user registers via Supabase Auth, populate public.profiles.
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role user_role := 'passenger';
BEGIN
  -- Check user_metadata for role ('admin' or 'inspector' can be assigned or created by admin)
  IF (NEW.raw_user_meta_data->>'role') IN ('admin', 'inspector', 'passenger') THEN
    v_role := (NEW.raw_user_meta_data->>'role')::user_role;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, phone, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Railway Passenger'),
    NEW.raw_user_meta_data->>'phone',
    v_role
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    phone = COALESCE(EXCLUDED.phone, public.profiles.phone);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- STORAGE BUCKET CONFIGURATION
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('food-images', 'food-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public can upload food evidence images" ON storage.objects;
CREATE POLICY "Public can upload food evidence images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'food-images');

DROP POLICY IF EXISTS "Public can view food evidence images" ON storage.objects;
CREATE POLICY "Public can view food evidence images"
ON storage.objects FOR SELECT
USING (bucket_id = 'food-images');
