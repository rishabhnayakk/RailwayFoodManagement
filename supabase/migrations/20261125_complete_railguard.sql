-- RailGuard Complete Schema Upgrade Migration
-- Safe to run on an existing RailGuard Supabase database after earlier migrations.

ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'vendor';
ALTER TYPE public.complaint_status ADD VALUE IF NOT EXISTS 'unable_to_resolve';
ALTER TYPE public.complaint_status ADD VALUE IF NOT EXISTS 'escalated';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended'));

CREATE INDEX IF NOT EXISTS idx_profiles_role_status ON public.profiles(role, status);

ALTER TABLE public.food_packages
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

CREATE INDEX IF NOT EXISTS idx_food_packages_approval ON public.food_packages(approval_status);

ALTER TABLE public.qr_codes
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.inspection_reports
  ADD COLUMN IF NOT EXISTS investigation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS problem_identified TEXT,
  ADD COLUMN IF NOT EXISTS action_taken TEXT,
  ADD COLUMN IF NOT EXISTS resolution_description TEXT,
  ADD COLUMN IF NOT EXISTS recommended_status TEXT NOT NULL DEFAULT 'report_submitted' CHECK (recommended_status IN ('report_submitted', 'resolved', 'unable_to_resolve', 'escalated')),
  ADD COLUMN IF NOT EXISTS evidence_images JSONB NOT NULL DEFAULT '[]'::jsonb;

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('food-images', 'food-images', true),
  ('complaint-evidence', 'complaint-evidence', true),
  ('inspection-evidence', 'inspection-evidence', true)
ON CONFLICT (id) DO NOTHING;
