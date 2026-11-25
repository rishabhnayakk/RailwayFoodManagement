-- Structured feedback dimensions & complaint_assignments audit table
ALTER TABLE public.feedback
  ADD COLUMN IF NOT EXISTS food_quality_rating INTEGER CHECK (food_quality_rating >= 1 AND food_quality_rating <= 5),
  ADD COLUMN IF NOT EXISTS taste_rating INTEGER CHECK (taste_rating >= 1 AND taste_rating <= 5),
  ADD COLUMN IF NOT EXISTS packaging_rating INTEGER CHECK (packaging_rating >= 1 AND packaging_rating <= 5),
  ADD COLUMN IF NOT EXISTS hygiene_rating INTEGER CHECK (hygiene_rating >= 1 AND hygiene_rating <= 5);

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

ALTER TABLE public.complaint_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and assigned inspectors view assignments" ON public.complaint_assignments;
CREATE POLICY "Admins and assigned inspectors view assignments"
  ON public.complaint_assignments FOR SELECT
  USING (public.is_admin() OR inspector_id = auth.uid());

DROP POLICY IF EXISTS "Admins manage complaint assignments" ON public.complaint_assignments;
CREATE POLICY "Admins manage complaint assignments"
  ON public.complaint_assignments FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
