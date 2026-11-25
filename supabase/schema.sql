-- RailGuard initial schema
-- Run in Supabase SQL Editor after reviewing project settings.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null default 'passenger' check (role in ('admin','inspector','vendor','passenger')),
  created_at timestamptz not null default now()
);

create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid unique references public.profiles(id) on delete set null,
  business_name text not null,
  contact_email text,
  contact_phone text,
  address text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.food_packages (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete restrict,
  name text not null,
  description text,
  price numeric(10,2),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.qr_codes (
  id uuid primary key default gen_random_uuid(),
  food_package_id uuid not null unique references public.food_packages(id) on delete cascade,
  qr_token text not null unique default encode(gen_random_bytes(24), 'hex'),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  passenger_id uuid not null references public.profiles(id) on delete restrict,
  food_package_id uuid not null references public.food_packages(id) on delete restrict,
  rating int not null check (rating between 1 and 5),
  comments text,
  created_at timestamptz not null default now()
);

create table if not exists public.complaints (
  id uuid primary key default gen_random_uuid(),
  passenger_id uuid not null references public.profiles(id) on delete restrict,
  food_package_id uuid not null references public.food_packages(id) on delete restrict,
  passenger_name text not null,
  pnr_number text not null,
  category text not null,
  description text not null,
  photo_url text,
  status text not null default 'pending',
  assigned_inspector_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.inspection_reports (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null unique references public.complaints(id) on delete cascade,
  inspector_id uuid not null references public.profiles(id) on delete restrict,
  findings text not null,
  remarks text,
  evidence_url text,
  submitted_at timestamptz not null default now()
);

create or replace function public.current_user_role()
returns text language sql stable security definer set search_path = public
as $$ select role from public.profiles where id = auth.uid() $$;

alter table public.profiles enable row level security;
alter table public.vendors enable row level security;
alter table public.food_packages enable row level security;
alter table public.qr_codes enable row level security;
alter table public.feedback enable row level security;
alter table public.complaints enable row level security;
alter table public.inspection_reports enable row level security;

-- Base policies; expand only after validating each workflow.
create policy "profiles read own or admin" on public.profiles for select
using (id = auth.uid() or public.current_user_role() = 'admin');
create policy "profiles update own" on public.profiles for update
using (id = auth.uid()) with check (id = auth.uid());
create policy "vendors admin manage" on public.vendors for all
using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');
create policy "vendors owner read" on public.vendors for select
using (owner_id = auth.uid());
create policy "packages admin manage" on public.food_packages for all
using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');
create policy "packages vendor read own" on public.food_packages for select
using (exists(select 1 from public.vendors v where v.id = vendor_id and v.owner_id = auth.uid()));
create policy "qr admin manage" on public.qr_codes for all
using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');
create policy "qr vendor read own" on public.qr_codes for select
using (exists(select 1 from public.food_packages p join public.vendors v on v.id=p.vendor_id where p.id=food_package_id and v.owner_id=auth.uid()));
create policy "feedback passenger read own" on public.feedback for select using (passenger_id = auth.uid());
create policy "feedback passenger create own" on public.feedback for insert with check (passenger_id = auth.uid() and public.current_user_role() = 'passenger');
create policy "complaints passenger read own" on public.complaints for select using (passenger_id = auth.uid());
create policy "complaints passenger create own" on public.complaints for insert with check (passenger_id = auth.uid() and public.current_user_role() = 'passenger');
create policy "complaints admin read" on public.complaints for select using (public.current_user_role() = 'admin');
create policy "complaints assigned inspector read" on public.complaints for select using (assigned_inspector_id = auth.uid() and public.current_user_role() = 'inspector');
create policy "reports inspector manage own" on public.inspection_reports for all
using (inspector_id = auth.uid() and public.current_user_role() = 'inspector')
with check (inspector_id = auth.uid() and public.current_user_role() = 'inspector');
create policy "reports admin read" on public.inspection_reports for select using (public.current_user_role() = 'admin');

-- NOTE: This is a starting schema, not a completed security audit.
-- Add narrowly scoped admin write policies, vendor update policies, storage policies,
-- safe profile provisioning, and server-side QR verification before production use.
