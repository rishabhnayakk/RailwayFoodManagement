-- RailGuard vendor accounts and least-privilege vendor access.
-- Apply after the original schema.sql in Supabase SQL Editor.
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'vendor';

ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS owner_user_id UUID UNIQUE REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Public self-registration must never assign a privileged role from user metadata.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'RailGuard User'),
    NEW.raw_user_meta_data->>'phone',
    'passenger'
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      full_name = COALESCE(NULLIF(EXCLUDED.full_name, 'RailGuard User'), public.profiles.full_name),
      phone = COALESCE(EXCLUDED.phone, public.profiles.phone);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Vendors can read their own business record; Admin retains full management.
DROP POLICY IF EXISTS "Anyone can view active vendors" ON public.vendors;
CREATE POLICY "Public can verify active vendor identity"
  ON public.vendors FOR SELECT USING (status = 'active');
DROP POLICY IF EXISTS "Vendors can view their own vendor record" ON public.vendors;
CREATE POLICY "Vendors can view their own vendor record"
  ON public.vendors FOR SELECT USING (owner_user_id = auth.uid());

-- Admins manage packages; vendor users may manage only packages belonging to their vendor.
DROP POLICY IF EXISTS "Admins can manage food packages" ON public.food_packages;
CREATE POLICY "Admins can manage food packages"
  ON public.food_packages FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "Vendors manage own food packages" ON public.food_packages;
CREATE POLICY "Vendors manage own food packages"
  ON public.food_packages FOR ALL
  USING (EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = vendor_id AND v.owner_user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = vendor_id AND v.owner_user_id = auth.uid()));

-- Vendor feedback visibility is limited to feedback for their own packages.
DROP POLICY IF EXISTS "Vendors view feedback for own packages" ON public.feedback;
CREATE POLICY "Vendors view feedback for own packages"
  ON public.feedback FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.food_packages p
    JOIN public.vendors v ON v.id = p.vendor_id
    WHERE p.id = package_id AND v.owner_user_id = auth.uid()
  ));

-- Do not grant vendor access to complaint reporter details or inspection reports.
