# RailGuard

Passenger Food Feedback & Railway Quality Audit Platform.

## Stack
- Next.js App Router + JavaScript
- Supabase Auth, Postgres and Row Level Security
- html5-qrcode for camera scanning
- Vercel deployment

## Local setup
1. Install Node.js LTS.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local`.
4. Add your Supabase project URL and anon/publishable key.
5. Run `npm run dev`.

## Database
Review and run `supabase/schema.sql` in the Supabase SQL Editor. The schema is an initial foundation; complete and test role policies and server-side workflows before production.

## Security
Never expose a Supabase service-role key in browser code or any `NEXT_PUBLIC_*` variable.
