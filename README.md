<div align="center">

# 🚂 RailGuard

### Passenger Food Feedback & Railway Quality Audit Platform

![Next.js](https://img.shields.io/badge/Next.js-16.4.6-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-61dafb?logo=react)
![CSS Modules](https://img.shields.io/badge/Styling-CSS_Modules-blue)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ecf8e?logo=supabase)
![Zero Dummy Data](https://img.shields.io/badge/Data-100%25_Real_DB-brightgreen)

> **A QR-based passenger food feedback and quality audit platform built for Indian Railways. Passengers scan QR codes printed on authorized railway food packaging, view food and vendor details, submit ratings, upload food images, and report hygiene complaints. Quality management teams investigate complaints, inspect vendors, and monitor real-time audit trends.**

</div>

---

## 📋 Table of Contents

- [1. Technology Stack](#1-technology-stack)
- [2. System Architecture & Role Model](#2-system-architecture--role-model)
- [3. Six-Stage Complaint Lifecycle](#3-six-stage-complaint-lifecycle)
- [4. Complete Directory Structure](#4-complete-directory-structure)
- [5. Clean Data & Zero-Dummy Policy](#5-clean-data--zero-dummy-policy)
- [6. Environment Variables Setup](#6-environment-variables-setup)
- [7. Supabase Database Schema & Storage](#7-supabase-database-schema--storage)
- [8. Application Routes & Portals](#8-application-routes--portals)
- [9. Getting Started (Local Run)](#9-getting-started-local-run)
- [10. Academic Presentation & Viva Guide](#10-academic-presentation--viva-guide)

---

## 1. Technology Stack

Built strictly with clean, pure, beginner-friendly technologies suitable for college presentations and engineering vivas:

- **Framework**: Next.js 16 (App Router)
- **Language**: JavaScript (ES6+), JSX (No TypeScript)
- **Styling**: Standard CSS & CSS Modules (Native Next.js Turbopack pure CSS selectors, responsive flexbox/grid, zero external CSS framework overhead)
- **Database**: Supabase PostgreSQL with Row Level Security (RLS)
- **Authentication**: Supabase Auth (Email & Password with role metadata synced to `public.profiles`)
- **Evidence Storage**: Supabase Storage (`food-images` bucket for passenger & inspector photo evidence)
- **QR Engine**: Cryptographically secure tokens (`crypto.getRandomValues`), `qrcode` library for visual QR sticker generation & downloadable PNGs

---

## 2. System Architecture & Role Model

RailGuard models four distinct entities in Indian Railways catering operations, with **three application user account types**:

```
                              ┌──────────────────────────────────┐
                              │     Railway Quality Admin        │
                              │  (Role: 'admin', Full Control)   │
                              └────────────────┬─────────────────┘
                                               │
             ┌─────────────────────────────────┼────────────────────────────────┐
             ▼                                 ▼                                ▼
   ┌──────────────────┐              ┌──────────────────┐             ┌──────────────────┐
   │ Food Vendors /   │              │ Quality Inspect. │             │ Railway Passeng. │
   │ Catering Contrs. │              │ (Role:           │             │ (Role:           │
   │ (Entity Only)    │              │  'inspector')    │             │  'passenger')    │
   └────────┬─────────┘              └────────┬─────────┘             └────────┬─────────┘
            │                                 │                                │
     Admin registers                   Admin assigns                    Scans QR sticker
    pantry contractors                  complaint to                     on meal box,
    and meal packages.                  specific inspector               submits ratings &
    NO LOGIN / NO APP.                  to audit & report.               hygiene evidence.
```

### Role Breakdown:

1. **Railway Administrator (`role = 'admin'`)**:
   - Authorized railway quality authority officer.
   - Manages food vendor registry (registers catering companies, links base stations, toggles active/suspended status).
   - Registers authorized food packages and generates unique cryptographic QR tokens.
   - Views all passenger complaints with reporter details, journey data (train, PNR, seat), and photographs.
   - Formally assigns complaints to field Quality Inspection Officers.
   - Reviews inspector audit reports and photographic evidence.
   - Resolves/closes complaints with administrative closure remarks and penalties, or reopens cases for re-audit.
   - Monitors quality analytics and system-wide audit logs.
   - Onboards and registers new Quality Inspector accounts.

2. **Quality Inspector (`role = 'inspector'`)**:
   - Field officer conducting on-site pantry and kitchen hygiene investigations.
   - Logs into `/inspector/login` and accesses dedicated `/inspector/*` workspace.
   - **Strict Privacy Isolation**: Can only access complaints formally assigned to their officer ID (enforced via Supabase RLS and Next.js authorization checks).
   - Acknowledges assigned cases (`assigned` → `in_progress`).
   - Conducts physical inspection, examines passenger evidence photo, records observations.
   - Uploads inspector evidence photograph and submits formal Quality Audit Report to Administration (`in_progress` → `report_submitted`).
   - Views past investigation history.
   - **Restrictions**: Cannot register vendors, cannot modify QR tokens, cannot view other inspectors' cases, and cannot close complaints.

3. **Passenger (`role = 'passenger'`)**:
   - Railway food consumer.
   - Registers at `/auth/register` and logs in at `/auth/login`.
   - Scans packaging QR code (`/scan/[token]`) to view verified food package details, catering vendor, and FSSAI license.
   - Submits 1-to-5 star quality rating and written review.
   - Reports hygiene-related defects (foreign object, bad odour, expired food, pest contamination, etc.) with uploaded photographic evidence and optional train/PNR/coach coordinates.
   - Tracks submitted complaints across the 6-stage lifecycle stepper in the Passenger Portal (`/passenger/complaints`).

4. **Food Vendor (Catering Contractor / Pantry Agency)**:
   - **NOT an application user. Vendors have NO login credentials and NO dashboard.**
   - Managed entirely by Railway Administration in the `vendors` table.
   - Associated with station location, license number, and multiple food packages.
   - Admin tracks performance, ratings, and complaints for each vendor contractor.

---

## 3. Six-Stage Complaint Lifecycle

RailGuard implements a structured, transparent 6-stage complaint resolution lifecycle:

| Stage | Status Key | Description | Responsible Party |
| :--- | :--- | :--- | :--- |
| **Stage 1** | `submitted` | Complaint filed by passenger via packaging QR portal with defect type & photo evidence. | Passenger |
| **Stage 2** | `pending_review` | Complaint received at central Railway Quality Administration desk awaiting review. | Admin |
| **Stage 3** | `assigned` | Case formally assigned to a designated field Quality Inspector. | Admin |
| **Stage 4** | `in_progress` | Inspector acknowledges case and initiates on-site pantry or kitchen audit. | Inspector |
| **Stage 5** | `report_submitted` | Inspector uploads findings, evidence, and recommendations to the Admin. | Inspector |
| **Stage 6** | `resolved` | Admin reviews inspection findings, imposes vendor penalties, and closes case. | Admin |
| *Reopened* | `reopened` | If passenger appeals or further inquiry is warranted, Admin reopens case. | Admin |

Every transition is permanently recorded in `complaint_status_history` with actor ID, timestamp, and audit notes.

---

## 4. Complete Directory Structure

```
Railway Management System/
├── app/
│   ├── page.js                          # Public landing page with role-based navigation
│   ├── layout.js                        # Root HTML & body layout
│   ├── globals.css                      # CSS custom properties, theme colors & resets
│   ├── scan/
│   │   ├── page.js                      # QR code scanner & manual token entry
│   │   ├── scan.module.css              # Scanner styling
│   │   └── [token]/
│   │       ├── page.js                  # Verified food package, 5-star rating & complaint form
│   │       └── feedback.module.css      # Passenger submission styling
│   ├── auth/
│   │   ├── login/page.js                # Universal / Passenger login with role redirection
│   │   ├── register/page.js             # Passenger registration
│   │   └── auth.module.css              # Authentication styling
│   ├── passenger/
│   │   ├── page.js                      # Passenger overview dashboard (KPI cards & recent submissions)
│   │   ├── complaints/page.js           # Passenger complaints list & 6-stage lifecycle stepper
│   │   ├── feedback/page.js             # Passenger ratings and reviews history
│   │   └── passenger.module.css         # Passenger portal styling
│   ├── inspector/
│   │   ├── login/page.js                # Dedicated Inspector login
│   │   ├── page.js                      # Inspector dashboard (KPIs & active assignments)
│   │   ├── cases/
│   │   │   ├── page.js                  # Assigned cases list with status filters
│   │   │   └── [id]/page.js             # Case investigation file, passenger photo inspection & report submission
│   │   ├── history/page.js              # Filed inspection audit reports archive
│   │   └── inspector.module.css         # Inspector portal styling
│   ├── admin/
│   │   ├── login/page.js                # Dedicated Railway Authority login
│   │   ├── page.js                      # Central Admin KPI dashboard (complaints, ratings, vendors)
│   │   ├── dashboard.module.css
│   │   ├── complaints/
│   │   │   ├── page.js                  # Searchable complaints table (7 lifecycle statuses, severity filter)
│   │   │   ├── [id]/page.js             # Case review, inspector assignment modal, closure/reopen actions
│   │   │   └── complaints.module.css
│   │   ├── vendors/
│   │   │   ├── page.js                  # Vendor registry, station locations, status toggles & package overview
│   │   │   └── vendors.module.css
│   │   ├── qr-codes/
│   │   │   ├── page.js                  # Package registration, QR generation, PNG sticker download & revoke
│   │   │   └── qrcodes.module.css
│   │   ├── inspectors/
│   │   │   ├── page.js                  # Inspector directory, workload stats & new inspector registration
│   │   │   └── inspectors.module.css
│   │   ├── analytics/
│   │   │   ├── page.js                  # Pure CSS rating breakdown & hygiene defect distribution
│   │   │   └── analytics.module.css
│   │   └── audit-logs/
│   │       ├── page.js                  # Platform-wide administrative activity trail
│   │       └── auditlogs.module.css
│   └── api/
│       ├── admin/stats/route.js         # Live KPI aggregation API for dashboard
│       └── qr/verify/route.js           # Server-side QR token verification Route Handler
├── components/
│   ├── layout/
│   │   ├── AdminLayout.jsx              # Admin layout shell with responsive state
│   │   ├── AdminSidebar.jsx             # Admin sidebar navigation
│   │   ├── AdminHeader.jsx              # Admin header with mobile toggle
│   │   ├── InspectorLayout.jsx          # Dedicated Inspector layout shell & navigation
│   │   └── PassengerLayout.jsx          # Dedicated Passenger layout shell & navigation
│   └── ui/
│       ├── Button.jsx                   # Primary, outline, ghost & danger button with loading spinner
│       ├── Card.jsx                     # Modular Card, CardHeader, CardTitle, CardBody, CardFooter
│       ├── Badge.jsx                    # StatusBadge, SeverityBadge, RoleBadge
│       ├── Input.jsx                    # Accessible Input, Textarea, Select components
│       ├── EmptyState.jsx               # Zero-data presentation display
│       └── Skeleton.jsx                 # SkeletonLine, SkeletonCard loading placeholders
├── lib/
│   ├── auth.js                          # Authentication helpers (signInUser, registerPassenger, signOutUser)
│   ├── constants.js                     # Roles, 7 lifecycle statuses, severity levels, hygiene defects, nav items
│   ├── utils.js                         # Date formatters, token generators, string truncators
│   └── supabase/
│       ├── client.js                    # Browser Supabase client
│       └── server.js                    # Server Supabase client
├── supabase/
│   └── schema.sql                       # Complete PostgreSQL schema, RLS policies, trigger & storage bucket
├── .env.local                           # Supabase environment variables (URL + Anon Key)
└── .env.local.example                   # Empty template for environment variables
```

---

## 5. Clean Data & Zero-Dummy Policy

- **No Hardcoded Records**: RailGuard contains zero hardcoded complaints, vendors, or feedback rows.
- **Real Database Records**: When the database is newly initialized, components present informative `<EmptyState />` banners ("No complaints found", "No vendors registered yet") rather than crashing or displaying fake numbers.
- **Fail-Safe Architecture**: If `.env.local` is missing or unconfigured, the application displays a friendly setup notice rather than crashing.

---

## 6. Environment Variables Setup

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-publishable-anon-key
```

> **Security Note**: Never expose the Supabase `service_role` secret in frontend code. RailGuard uses the public anonymous key and enforces access permissions through PostgreSQL Row Level Security (RLS).

---

## 7. Supabase Database Schema & Storage

The database schema is fully defined in `supabase/schema.sql`.

### To apply the schema:
1. Open your Supabase Dashboard (`https://supabase.com/dashboard`).
2. Navigate to **SQL Editor** -> **New Query**.
3. Paste the contents of `supabase/schema.sql` and click **Run**.

### Schema Summary:
- **`profiles`**: Stores user profiles for Admins, Inspectors, and Passengers (synced via `auth.users` trigger `handle_new_user`).
- **`vendors`**: Stores authorized railway catering contractors (managed by Admin).
- **`food_packages`**: Authorized meals and snack packages linked to vendors.
- **`qr_codes`**: Unique cryptographic tokens linked to food packages.
- **`feedback`**: 1-to-5 star ratings and reviews submitted by passengers.
- **`complaints`**: Detailed food defect complaints with journey details (PNR, train, coach/seat) and photo URL.
- **`inspection_reports`**: Official quality audit findings, evidence photos, and penalty recommendations submitted by inspectors.
- **`complaint_status_history`**: Chronological audit trail of all status transitions.
- **`audit_logs`**: Administrative action logs (vendor registrations, status toggles, inspector assignments).
- **`food-images` (Storage Bucket)**: Public Supabase storage bucket for passenger and inspector evidence images.

---

## 8. Application Routes & Portals

| Route | Role / Audience | Description |
| :--- | :--- | :--- |
| `/` | Public | Platform landing page with quick links to all portals and QR scanner. |
| `/scan` | Passenger | QR camera scanner and manual token lookup. |
| `/scan/[token]` | Passenger | Verified package details, 1–5 star rating submission, and hygiene complaint form with photo upload. |
| `/auth/login` | Passenger | Passenger login with role-based redirection. |
| `/auth/register` | Passenger | Passenger account registration. |
| `/passenger` | Passenger | Passenger dashboard with submitted complaint counts and ratings history. |
| `/passenger/complaints`| Passenger | Track passenger complaints with 6-stage visual progress stepper. |
| `/passenger/feedback` | Passenger | View submitted star ratings and reviews. |
| `/inspector/login` | Inspector | Dedicated Quality Inspector login. |
| `/inspector` | Inspector | Inspector dashboard with active assignments and investigation KPIs. |
| `/inspector/cases` | Inspector | List of complaints assigned to the logged-in inspector. |
| `/inspector/cases/[id]`| Inspector | Case investigation file, passenger evidence photo inspection, and official inspection report submission form. |
| `/inspector/history` | Inspector | Archive of past inspection reports filed by this officer. |
| `/admin/login` | Admin | Dedicated Railway Quality Authority login. |
| `/admin` | Admin | Central executive dashboard with live KPI metrics and recent complaints. |
| `/admin/complaints` | Admin | Complaints management table with 7 lifecycle status filters and search. |
| `/admin/complaints/[id]`| Admin | Full complaint file, inspector assignment module, inspection report review, and resolution/reopen controls. |
| `/admin/vendors` | Admin | Vendor registry, station locations, active/suspended toggles, and package view. |
| `/admin/qr-codes` | Admin | Food package registration, visual QR sticker generation, printable PNG download, and token revocation. |
| `/admin/inspectors` | Admin | Quality Inspector directory, workload metrics, and new inspector registration. |
| `/admin/analytics` | Admin | Pure CSS rating distribution and hygiene defect category breakdowns. |
| `/admin/audit-logs` | Admin | Chronological system-wide administrative activity trail. |

---

## 9. Getting Started (Local Run)

```bash
# 1. Install dependencies
npm install

# 2. Configure environment variables
cp .env.local.example .env.local
# Edit .env.local with your Supabase Project URL and Anon Key

# 3. Run development server
npm run dev

# 4. Open in browser
# http://localhost:3000
```

### Production Build Verification:
```bash
npm run build
# Compiles with 0 errors across all 24 routes
```

---

## 10. Academic Presentation & Viva Guide

### Key Architectural Concepts to Highlight:

1. **Why do Vendors NOT have user accounts?**
   - In Indian Railways operations, food catering contractors are third-party agencies governed by the railway administration. The platform's objective is strict quality audit and accountability. Admin holds the authority to register vendors, inspect their meals, track complaints, and suspend contracts. Giving vendors write access to complaint records would introduce a conflict of interest.

2. **How is Inspector Privacy and Role Isolation Enforced?**
   - At the database level, PostgreSQL **Row Level Security (RLS)** restricts queries on `complaints` so that inspectors can only read rows where `assigned_inspector_id = auth.uid()`.
   - At the frontend level, `app/inspector/cases/[id]/page.js` validates that the logged-in user is the assigned officer or an administrator, blocking unauthorized access.

3. **How does QR Token Verification Work?**
   - QR codes do not encode raw package information (which could be tampered with). Instead, they store a 48-character cryptographically random token (`generateToken(24)` via Web Crypto API).
   - When scanned, `/api/qr/verify?token=...` checks the token against the database, verifies that the package is active and unrevoked, and returns verified vendor details.

4. **Why Pure CSS Modules instead of Tailwind or Heavy UI Libraries?**
   - Keeps the codebase clean, readable, and 100% compliant with standard CSS and JSX.
   - Eliminates bundle bloat and third-party styling conflicts.
   - Ideal for academic presentations where professors ask students to explain CSS properties and layout logic without relying on external UI component black boxes.
