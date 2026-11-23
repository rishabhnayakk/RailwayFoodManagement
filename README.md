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
- [2. System Architecture](#2-system-architecture)
- [3. Clean Data Policy](#3-clean-data-policy)
- [4. Environment Variables](#4-environment-variables)
- [5. Supabase Database Schema](#5-supabase-database-schema)
- [6. Application Routes](#6-application-routes)
- [7. Getting Started](#7-getting-started)
- [8. Academic Presentation & Viva Guide](#8-academic-presentation--viva-guide)

---

## 1. Technology Stack

Built with pure, beginner-friendly technologies suitable for college presentations:

- **Framework**: Next.js 16 (App Router)
- **Language**: JavaScript (ES6+), JSX
- **Styling**: Standard CSS & CSS Modules (Native Next.js Turbopack CSS engine, pure selectors, no external CSS library conflicts)
- **Backend & Database**: Supabase PostgreSQL, Supabase Storage, Route Handlers
- **Validation & QR**: Standard Web Crypto API (`crypto.getRandomValues`), Zod, qrcode

---

## 2. System Architecture

```
Railway Management System/
├── app/
│   ├── page.js                    # Public portal landing page
│   ├── layout.js                  # Global application shell
│   ├── globals.css                # Global styles and CSS variables
│   ├── scan/
│   │   ├── page.js                # Passenger QR scan & manual code entry
│   │   └── scan.module.css        # Mobile-first scanner layout
│   ├── inspector/
│   │   ├── page.js                # Quality inspector credentials portal
│   │   └── inspector.module.css
│   ├── admin/
│   │   ├── page.js                # Admin dashboard (Live DB stats & CSS bars)
│   │   ├── dashboard.module.css
│   │   ├── complaints/page.js     # Searchable/filterable complaints table
│   │   ├── vendors/page.js        # Vendor registry & performance cards
│   │   ├── qr-codes/page.js       # Food package registration & QR generator
│   │   ├── inspectors/page.js     # Quality inspectors directory
│   │   ├── analytics/page.js      # CSS-based statistical distribution reports
│   │   └── audit-logs/page.js     # System activity audit trail
│   └── api/
│       └── admin/stats/route.js   # Live database statistics aggregator
├── components/
│   ├── ui/
│   │   ├── Button.jsx             # Reusable button with loading & variants
│   │   ├── Card.jsx               # Modular card container
│   │   ├── Badge.jsx              # Status and severity indicator pills
│   │   ├── EmptyState.jsx         # Informative zero-data state display
│   │   ├── Input.jsx              # Labelled input and textarea fields
│   │   └── Skeleton.jsx           # Loading placeholders
│   └── layout/
│       ├── AdminLayout.jsx        # Dashboard wrapper with responsive state
│       ├── AdminSidebar.jsx       # Navigation sidebar with active-link state
│       └── AdminHeader.jsx        # Top header with mobile hamburger toggle
├── lib/
│   ├── constants.js               # Application constants, roles, and status enums
│   ├── utils.js                   # Date formatters, string truncators, token generators
│   └── supabase/
│       ├── client.js              # Browser-safe client using public anon key
│       └── server.js              # Server client for API route handlers
├── supabase/
│   └── schema.sql                 # Complete PostgreSQL schema & RLS policies
├── .env.local                     # Local environment keys (gitignored)
└── .env.local.example             # Clean template for environment keys
```

---

## 3. Clean Data Policy

- **Zero Hardcoded Records**: All previous dummy complaints, mock vendors, simulated packages, and fake charts have been removed.
- **Dynamic Database Queries**: Dashboard counts, rating averages, and complaint tables query Supabase directly via `/api/admin/stats`.
- **Friendly Empty States**: When the database is newly initialized, components present informative empty state banners ("No complaints found", "No vendors registered yet") rather than crashing or showing fake data.
- **Setup Detection**: If `.env.local` contains empty or placeholder values, an actionable setup reminder is displayed on the dashboard.

---

## 4. Environment Variables

Create `.env.local` in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

A clean template is provided in [`.env.local.example`](./.env.local.example).

---

## 5. Supabase Database Schema

The complete SQL setup script is provided in [`supabase/schema.sql`](./supabase/schema.sql).

### Normalized Tables:
1. `profiles`: User accounts extending Supabase auth with roles (`admin`, `inspector`, `vendor`).
2. `vendors`: Licensed railway catering agencies and pantry services.
3. `food_packages`: Authorized food packages with unique cryptographic `qr_token` strings.
4. `feedback`: Anonymous passenger star ratings (1 to 5).
5. `complaints`: Food hygiene complaints with severity, status, and evidence image URLs.
6. `inspections`: Inspector findings, field check notes, and resolution remarks.
7. `audit_logs`: Chronological audit trail of all platform updates.

---

## 6. Application Routes

| Path | Description | Access |
|---|---|---|
| `/` | Landing page explaining platform & portals | Public |
| `/scan` | Mobile QR scanner & package code lookup | Passengers (Anonymous) |
| `/inspector` | Quality Inspector access portal | Quality Inspectors |
| `/admin` | Centralized quality control dashboard | Railway Administrators |
| `/admin/complaints` | Real-time complaint management & search | Railway Administrators |
| `/admin/vendors` | Vendor directory & package tracking | Railway Administrators |
| `/admin/qr-codes` | Package registration & QR code generation | Railway Administrators |
| `/admin/inspectors` | Registered quality inspectors directory | Railway Administrators |
| `/admin/analytics` | CSS-based statistical quality breakdown | Railway Administrators |
| `/admin/audit-logs` | Platform action history & audit trail | Railway Administrators |
| `/api/admin/stats` | Aggregated metrics Route Handler | Server API |

---

## 7. Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Configure Supabase credentials
cp .env.local.example .env.local
# Enter your NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY

# 3. Apply SQL schema in Supabase SQL Editor
# Run the commands from supabase/schema.sql

# 4. Start local development server
npm run dev

# 5. Build for production verification
npm run build
```

---

## 8. Academic Presentation & Viva Guide

### Key Architecture Points to Explain:
1. **Next.js App Router**: Route-based folder structure where each `page.js` represents a URL. Server Components render on the server, while Client Components (`"use client"`) handle interactive state like forms and toggles.
2. **CSS Modules**: Styles are scoped locally to each component, preventing global CSS name collisions.
3. **Cryptographic QR Tokens**: Instead of predictable sequential IDs (which attackers could guess), each food package receives a 48-character hex token generated via `crypto.getRandomValues`.
4. **Row Level Security (RLS)**: Security is enforced directly at the PostgreSQL layer. Anonymous passengers can only insert feedback and complaints against authorized packages, while administrative tables require role privileges.
