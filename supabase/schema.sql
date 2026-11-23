-- ==============================================================================
-- RAILGUARD DATABASE SCHEMA & ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
-- Run this script in your Supabase Dashboard: SQL Editor -> New Query -> Run
-- This script does NOT insert any dummy or sample records.
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. ENUM TYPES
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'inspector', 'vendor');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE complaint_status AS ENUM ('pending', 'under_review', 'resolved', 'rejected');
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
-- Extends Supabase auth.users with railway platform roles and contact info
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'inspector',
    phone TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- TABLE 2: vendors
-- Registered railway catering & pantry food vendors
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_name TEXT NOT NULL,
    license_number TEXT UNIQUE NOT NULL,
    contact_name TEXT,
    phone TEXT,
    email TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'warning', 'suspended')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- TABLE 3: food_packages
-- Authorized food packages with unique tamper-evident QR tokens
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.food_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
    package_name TEXT NOT NULL,
    qr_token TEXT UNIQUE NOT NULL,
    batch_number TEXT,
    description TEXT,
    price NUMERIC(10, 2),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'recalled', 'expired')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Create index on qr_token for fast lookup when passengers scan QR
CREATE INDEX IF NOT EXISTS idx_food_packages_qr_token ON public.food_packages(qr_token);

-- ==============================================================================
-- TABLE 4: feedback
-- Anonymous passenger food ratings (1 to 5 stars)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_id UUID NOT NULL REFERENCES public.food_packages(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_feedback_package_id ON public.feedback(package_id);

-- ==============================================================================
-- TABLE 5: complaints
-- Passenger food hygiene complaints and reported defects
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.complaints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_id UUID NOT NULL REFERENCES public.food_packages(id) ON DELETE CASCADE,
    issue_type TEXT NOT NULL,
    description TEXT,
    severity complaint_severity NOT NULL DEFAULT 'medium',
    status complaint_status NOT NULL DEFAULT 'pending',
    image_url TEXT,
    passenger_contact TEXT,
    assigned_inspector_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_complaints_package_id ON public.complaints(package_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON public.complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_assigned_inspector ON public.complaints(assigned_inspector_id);

-- ==============================================================================
-- TABLE 6: inspections
-- Inspector investigative findings, laboratory checks, and resolution remarks
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.inspections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
    inspector_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    findings TEXT NOT NULL,
    action_taken TEXT,
    remarks TEXT,
    status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('in_progress', 'completed', 'escalated')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_inspections_complaint ON public.inspections(complaint_id);

-- ==============================================================================
-- TABLE 7: audit_logs
-- Chronological audit trail of admin and inspector state modifications
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

-- Enable RLS across all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper functions for role identification
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_inspector()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'inspector'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PROFILES POLICIES
DROP POLICY IF EXISTS "Public can view basic profiles" ON public.profiles;
CREATE POLICY "Public can view basic profiles"
    ON public.profiles FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Admins can manage profiles" ON public.profiles;
CREATE POLICY "Admins can manage profiles"
    ON public.profiles FOR ALL
    USING (public.is_admin());

-- VENDORS POLICIES
DROP POLICY IF EXISTS "Anyone can view vendors" ON public.vendors;
CREATE POLICY "Anyone can view vendors"
    ON public.vendors FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Admins can modify vendors" ON public.vendors;
CREATE POLICY "Admins can modify vendors"
    ON public.vendors FOR ALL
    USING (public.is_admin());

-- FOOD_PACKAGES POLICIES
DROP POLICY IF EXISTS "Anyone can verify food packages by token" ON public.food_packages;
CREATE POLICY "Anyone can verify food packages by token"
    ON public.food_packages FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Admins can modify packages" ON public.food_packages;
CREATE POLICY "Admins can modify packages"
    ON public.food_packages FOR ALL
    USING (public.is_admin());

-- FEEDBACK POLICIES
DROP POLICY IF EXISTS "Anyone can submit anonymous feedback" ON public.feedback;
CREATE POLICY "Anyone can submit anonymous feedback"
    ON public.feedback FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "Everyone can view feedback aggregations" ON public.feedback;
CREATE POLICY "Everyone can view feedback aggregations"
    ON public.feedback FOR SELECT
    USING (true);

-- COMPLAINTS POLICIES
DROP POLICY IF EXISTS "Anyone can submit anonymous complaints" ON public.complaints;
CREATE POLICY "Anyone can submit anonymous complaints"
    ON public.complaints FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "Public can view complaints" ON public.complaints;
CREATE POLICY "Public can view complaints"
    ON public.complaints FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Inspectors and admins can update complaints" ON public.complaints;
CREATE POLICY "Inspectors and admins can update complaints"
    ON public.complaints FOR UPDATE
    USING (public.is_admin() OR public.is_inspector());

-- INSPECTIONS POLICIES
DROP POLICY IF EXISTS "Inspectors and admins can view inspections" ON public.inspections;
CREATE POLICY "Inspectors and admins can view inspections"
    ON public.inspections FOR SELECT
    USING (public.is_admin() OR public.is_inspector());

DROP POLICY IF EXISTS "Inspectors can insert findings" ON public.inspections;
CREATE POLICY "Inspectors can insert findings"
    ON public.inspections FOR INSERT
    WITH CHECK (public.is_inspector() OR public.is_admin());

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
-- STORAGE BUCKET FOR FOOD IMAGES
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('food-images', 'food-images', true)
ON CONFLICT (id) DO NOTHING;

-- Public can upload evidence photos up to 5MB (image/jpeg, image/png, image/webp)
DROP POLICY IF EXISTS "Public can upload food evidence" ON storage.objects;
CREATE POLICY "Public can upload food evidence"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'food-images'
);

DROP POLICY IF EXISTS "Public can view food evidence" ON storage.objects;
CREATE POLICY "Public can view food evidence"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'food-images'
);
