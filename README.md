# RailGuard

**Passenger Food Feedback & Railway Quality Audit Platform**

RailGuard is a Next.js App Router + Supabase web application for railway catering quality monitoring. It enforces strict separation across four role-based portals (**Admin**, **Vendor**, **Inspector**, and **Passenger**) backed by PostgreSQL Row Level Security (RLS), server-side QR verification, and Supabase Storage.

---

## 1. Technology Stack

- **Framework:** Next.js 16.4.6 (App Router)
- **Language:** JavaScript (ES6+), JSX (No TypeScript)
- **Styling:** Standard CSS & CSS Modules
- **Database & Auth:** Supabase PostgreSQL with Row Level Security (RLS) & Supabase Auth
- **Storage Buckets:** Supabase Storage (`food-images`, `complaint-evidence`, `inspection-evidence`)
- **QR Generation & Scanning:** `qrcode` (PNG sticker export) + `html5-qrcode` (camera scanner + manual token lookup)
- **Deployment:** Vercel compatible

---

## 2. Four Portals & Responsibility Separation

| Portal | Login Route | Responsibilities | Restrictions |
| :--- | :--- | :--- | :--- |
| **Admin** | `/admin/login` | Creates and activates/suspends Vendor & Inspector accounts; monitors platform KPIs; approves/rejects vendor food packages; assigns complaints to inspectors; reviews inspection reports; verifies resolution or reopens cases. | Does not upload food packages, routinely generate vendor QR codes, or perform field inspections. |
| **Vendor** | `/vendor/login` | Uploads food packages (details, ingredients, prep/expiry times, FSSAI licence, train info, food photo); generates unique packaging QR tokens and downloads PNG QR stickers; views approval status, ratings, and sanitized complaint status. | Accesses only own packages, feedback, and complaints; suspended vendors cannot upload packages or expose active QR codes. |
| **Inspector** | `/inspector/login` | Views complaints assigned to them; acknowledges cases (`assigned` -> `in_progress`); uploads inspection evidence photos; records root cause, findings, action taken, resolution description, and outcome (`report_submitted` / `unable_to_resolve` / `escalated`). | Sees only assigned complaints; cannot create/suspend accounts, upload packages, generate QR codes, or close complaints on behalf of Admin. |
| **Passenger** | `/auth/login`, `/auth/register` | Scans meal QR codes (`/scan`) or enters tokens manually; views verified food/vendor details; submits 1–5 star ratings and food feedback; optionally registers complaints with photos and journey details; tracks complaint status (`/passenger/complaints`). | Public users cannot read internal database tables; unapproved, revoked, expired, or suspended-vendor QR codes are blocked server-side. |

---

## 3. Complaint Lifecycle

```text
SUBMITTED ──▶ ASSIGNED ──▶ IN_PROGRESS ──▶ REPORT_SUBMITTED ──▶ RESOLVED
                                  │                                 ▲
                                  ├──▶ UNABLE_TO_RESOLVE ───────────┤
                                  └──▶ ESCALATED ───────────────────┘
                                                                    │
                                               (Admin Reopens) ◀────┘
                                                   REOPENED
```

Every status change is recorded in `complaint_status_history` with complaint ID, previous status, new status, actor ID, timestamp, and remarks.

---

## 4. Application Routes & API Endpoints

### Portal & Public Pages
- `/` — Redesigned RAILGUARD homepage with hero banner, Scan QR workflow, and Track Previous Complaint entry
- `/scan` — Mobile-friendly QR camera scanner (`html5-qrcode`) and manual token entry
- `/scan/[token]` — Server-verified food package details, 1–5 star rating, food feedback, and optional complaint registration with automatic unique Complaint ID (`RG-YYYY-XXXXXX`)
- `/track` — Public Complaint Tracking page by unique Complaint ID (`RG-YYYY-XXXXXX`) showing live status and timeline
- `/auth/login`, `/auth/register` — Passenger login & registration
- `/passenger`, `/passenger/complaints`, `/passenger/feedback` — Passenger dashboard, complaint lifecycle tracker, and rating history
- `/vendor/login`, `/vendor`, `/vendor/packages`, `/vendor/feedback`, `/vendor/complaints` — Vendor workspace, food package upload + QR generation, feedback, and sanitized complaints
- `/inspector/login`, `/inspector`, `/inspector/cases`, `/inspector/cases/[id]`, `/inspector/history` — Inspector investigation workbench, case file & report submission, and report history
- `/admin/login`, `/admin`, `/admin/vendors`, `/admin/inspectors`, `/admin/qr-codes`, `/admin/complaints`, `/admin/complaints/[id]`, `/admin/feedback`, `/admin/analytics`, `/admin/audit-logs` — Admin console, account management, package approvals, complaint assignment/verification, and audit logs

### Server API Route Handlers
- `GET /api/qr/verify?token=...` — Server-side QR verification (active QR, non-expired token, approved & active package, active vendor)
- `POST /api/scan/submit` — Server-validated feedback & optional complaint submission returning the unique DB-generated `complaintRef` (`RG-YYYY-XXXXXX`)
- `GET /api/complaints/track?id=...` — Public Complaint ID lookup returning non-PII complaint status, package info, and chronological status history
- `GET /api/admin/stats` — Authenticated Admin KPI aggregation
- `POST /api/admin/create-account` — Authenticated Admin provisioning of Vendor and Inspector accounts
- `POST /api/admin/toggle-status` — Authenticated Admin activation/suspension for Vendor and Inspector accounts
- `GET /api/vendor/complaints` — Vendor-scoped complaint summaries omitting passenger PII and internal investigation details

---

## 5. Environment Variables Setup

Create a `.env` file in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> **Security Note:** `SUPABASE_SERVICE_ROLE_KEY` is used strictly inside server-side Route Handlers and is never exposed to client-side code. Never commit `.env.local`.

---

## 6. Supabase Database, RLS & Storage Setup

1. Open your **Supabase Dashboard** → **SQL Editor** → **New Query**.
2. Run the contents of [`supabase/schema.sql`](supabase/schema.sql) (or [`supabase/migrations/20261125_complete_railguard.sql`](supabase/migrations/20261125_complete_railguard.sql) followed by the RLS policies in `supabase/schema.sql` if upgrading an existing database).
3. Confirm all 10 tables exist with RLS enabled:
   - `profiles`, `vendors`, `food_packages`, `qr_codes`, `feedback`, `complaints`, `inspection_reports`, `complaint_assignments`, `complaint_status_history`, `audit_logs`
4. Confirm all 3 Storage buckets exist under **Storage**:
   - `food-images`
   - `complaint-evidence`
   - `inspection-evidence`

---

## 7. Authentication & Initial Admin Setup

1. Public sign-up at `/auth/register` always creates a `passenger` profile via the `handle_new_user()` database trigger.
2. To create the initial **Admin** account:
   - Create a user in **Supabase Dashboard → Authentication → Users → Add User** (with Auto Confirm).
   - Promote the user in **SQL Editor**:
     ```sql
     UPDATE public.profiles
     SET role = 'admin', status = 'active'
     WHERE email = 'your-admin@example.com';
     ```
3. Sign in at `/admin/login` to create Vendor accounts (`/admin/vendors`) and Inspector accounts (`/admin/inspectors`).

---

## 8. QR Code Generation & Scanning Workflow

1. **Vendor Upload & QR Generation:** Sign in at `/vendor/login` → **Packages & QR** (`/vendor/packages`), upload a food package with photo and details, and download the generated PNG QR sticker.
2. **Admin Approval:** Sign in at `/admin/login` → **Package Approvals** (`/admin/qr-codes`) and approve the package. Unapproved packages are rejected by `/api/qr/verify`.
3. **Passenger Scan:** Open `/scan` (camera requires HTTPS in production; `localhost` works in development) or enter a token manually to view verified food details, submit 1–5 star ratings/feedback, and optionally file a complaint.

---

## 9. Running Locally & Verification

```bash
npm install
# Create .env in the project root with your Supabase credentials
npm run dev
```

Open `http://localhost:3000`.

Build & lint verification:

```bash
npm run lint
npm run build
```

---

## 10. Deploying to Vercel

1. Push the repository to GitHub.
2. Import the project in **Vercel** (`https://vercel.com/new`).
3. Configure these Environment Variables in Vercel Project Settings:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_APP_URL` (e.g. `https://your-app.vercel.app`)
4. Deploy and add your Vercel domain to **Supabase Auth → URL Configuration** (`Site URL` and `Redirect URLs`).
