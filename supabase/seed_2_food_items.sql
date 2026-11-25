-- ==============================================================================
-- RailGuard – Self-Contained Seed for 2 Approved Food Items with Scannable QRs
-- ==============================================================================
-- Safe to run directly in Supabase Dashboard -> SQL Editor -> New Query.
-- Ensures columns/triggers exist, inserts 2 active vendors + 2 approved food
-- items, and guarantees each has a unique `package_code` and active `qr_token`.
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Ensure required columns exist even on older schema versions
ALTER TABLE public.food_packages
  ADD COLUMN IF NOT EXISTS package_code TEXT,
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS ingredients TEXT,
  ADD COLUMN IF NOT EXISTS fssai_license TEXT,
  ADD COLUMN IF NOT EXISTS train_info TEXT,
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- 1. Ensure 2 active vendors exist
INSERT INTO public.vendors (business_name, license_number, contact_name, station_location, status)
VALUES
  ('Sharma Food Services', 'FSSAI-RG-1001', 'Rajesh Sharma', 'New Delhi Railway Station (NDLS)', 'active'),
  ('Punjab Fresh Foods', 'FSSAI-RG-1002', 'Harpreet Singh', 'Ludhiana Junction (LDH)', 'active')
ON CONFLICT (license_number) DO UPDATE
SET
  business_name = EXCLUDED.business_name,
  station_location = EXCLUDED.station_location,
  status = 'active',
  updated_at = timezone('utc'::text, now());

-- 2. Insert 2 approved food items
WITH v1 AS (
  SELECT id, license_number FROM public.vendors WHERE license_number = 'FSSAI-RG-1001' LIMIT 1
)
INSERT INTO public.food_packages (
  package_code,
  vendor_id,
  package_name,
  category,
  description,
  price,
  ingredients,
  fssai_license,
  train_info,
  status,
  approval_status,
  approved_at
)
SELECT
  'FD-' || to_char(timezone('utc'::text, now()), 'YYYY') || '-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6)),
  v1.id,
  'Veg Thali',
  'Meals',
  'Standard Indian Railways vegetarian thali with 2 rotis, dal tadka, paneer sabzi, steamed rice, and pickle.',
  120.00,
  'Whole wheat flour, yellow lentils, paneer, basmati rice, vegetable oil, spices',
  v1.license_number,
  '12951 Mumbai Rajdhani Express',
  'active',
  'approved',
  timezone('utc'::text, now())
FROM v1
WHERE NOT EXISTS (
  SELECT 1 FROM public.food_packages p WHERE p.vendor_id = v1.id AND p.package_name = 'Veg Thali'
);

WITH v2 AS (
  SELECT id, license_number FROM public.vendors WHERE license_number = 'FSSAI-RG-1002' LIMIT 1
)
INSERT INTO public.food_packages (
  package_code,
  vendor_id,
  package_name,
  category,
  description,
  price,
  ingredients,
  fssai_license,
  train_info,
  status,
  approval_status,
  approved_at
)
SELECT
  'FD-' || to_char(timezone('utc'::text, now()), 'YYYY') || '-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6)),
  v2.id,
  'Veg Biryani',
  'Meals',
  'Aromatic basmati vegetable dum biryani packed in a sealed food-grade container with mint raita.',
  100.00,
  'Basmati rice, mixed vegetables, curd, mint, ghee, whole spices',
  v2.license_number,
  '12013 Amritsar Shatabdi Express',
  'active',
  'approved',
  timezone('utc'::text, now())
FROM v2
WHERE NOT EXISTS (
  SELECT 1 FROM public.food_packages p WHERE p.vendor_id = v2.id AND p.package_name = 'Veg Biryani'
);

-- 3. Ensure every food package has a unique active QR code
INSERT INTO public.qr_codes (package_id, qr_token, is_active)
SELECT p.id, encode(gen_random_bytes(24), 'hex'), true
FROM public.food_packages p
WHERE NOT EXISTS (
  SELECT 1 FROM public.qr_codes q WHERE q.package_id = p.id
);

-- 4. Inspect seeded items
SELECT
  p.package_code,
  p.package_name,
  p.category,
  p.price,
  p.approval_status,
  v.business_name AS vendor_name,
  q.qr_token,
  q.is_active AS qr_active
FROM public.food_packages p
JOIN public.vendors v ON v.id = p.vendor_id
JOIN public.qr_codes q ON q.package_id = p.id
WHERE v.license_number IN ('FSSAI-RG-1001', 'FSSAI-RG-1002')
ORDER BY p.created_at DESC;
