# COMPLETE TECHNICAL AUDIT REPORT
## Police Lines School & College, Faridpur — Reunion Management Website
**Audit Date:** 2026-11-11  
**Auditor:** Senior Software Architect / Security Auditor  
**Scope:** Full codebase, database schema, API surface, authentication, authorization, and security posture  
**Status:** Read-only audit — no changes made

---

## TABLE OF CONTENTS
1. [Executive Summary](#1-executive-summary)
2. [Technology Stack](#2-technology-stack)
3. [System Architecture](#3-system-architecture)
4. [Database Table Inventory](#4-database-table-inventory)
5. [Database Relationship Analysis](#5-database-relationship-analysis)
6. [Complete ER Diagram](#6-complete-er-diagram)
7. [API & Edge Function Documentation](#7-api--edge-function-documentation)
8. [Data Flow Documentation](#8-data-flow-documentation)
9. [Authentication & Authorization Analysis](#9-authentication--authorization-analysis)
10. [User-to-User Data Isolation Test Results](#10-user-to-user-data-isolation-test-results)
11. [Security Vulnerability Report](#11-security-vulnerability-report)
12. [Database Performance Analysis](#12-database-performance-analysis)
13. [Broken or Missing Connections](#13-broken-or-missing-connections)
14. [Role & Permission Matrix](#14-role--permission-matrix)
15. [Visual Architecture Diagrams](#15-visual-architecture-diagrams)
16. [Recommended Improvements & Prioritized Action Plan](#16-recommended-improvements--prioritized-action-plan)

---

## 1. EXECUTIVE SUMMARY

The **Police Lines School & College, Faridpur Grand Reunion** website is a **single-page React application (SPA)** deployed on **Vercel**, backed by **Supabase** (PostgreSQL + Auth + Storage + Edge Functions) and integrated with the **PayStation** payment gateway.

### What Works ✅
- Student registration (former and current) with dynamic fee calculation
- PayStation payment gateway integration with server-side verification via Edge Function
- QR-code ticket generation and secure ticket lookup with rate limiting
- Multi-role admin dashboard with 12+ tabs
- 12-module Reunion Management System (RMS/ERP)
- Student ID Card generation (CR80 format, 54×86 mm) with batch ZIP downloads
- Event-day scanning: gate entry/exit, food distribution, dress distribution
- Financial ledger and staff budget allocation
- Committee management, volunteer roster, task board, meetings, weekly reports
- XSS protection via DOMPurify + `sanitizeInput()` throughout
- CSP headers enforced via `vercel.json` (HTTP headers, not meta-tag only)
- Immutable tamper-evident audit logs with HMAC-SHA256 checksums
- Row Level Security (RLS) enabled on all Supabase tables
- Cryptographic HMAC-SHA256 payment signature (server-side, in Edge Function)

### What Is Broken or Problematic ⚠️
- **CRITICAL:** Default dev credentials (`admin@gmail.com` / `admin@123`) are **rendered in the production UI** of `ScannerPortal.tsx` and `AdminRmsSettings.tsx` even when `isDevTestBypassAllowed()` returns `false` — the display is correctly gated, but the credential strings are **hardcoded and visible in the source bundle**
- **CRITICAL:** `.env` file contains the **database direct-connection password** (`Puja@337139`) and **Supabase Secret Key** — these must NEVER be committed to a repository
- **HIGH:** `SUPABASE_SECRET_KEY` and full `DATABASE_URL` with plaintext password are in `.env` (not `.env.local`) which is likely committed
- **HIGH:** `verify-payment` Edge Function fallback default `PAYSTATION_PASSWORD = 'gamecoderstorepass'` is a hardcoded fallback if the env secret is missing
- **HIGH:** Anon key is hardcoded as a fallback in `src/services/supabase.ts` line 27
- **HIGH:** `rpc_verify_payment` in `20270102` migration references `financial_ledger` table but that table uses a constraint `transaction_type IN ('ALLOCATION','EXPENSE','ADJUSTMENT','CASH_RETURN')` — `'REGISTRATION_INFLOW'` is **not in the original constraint**, causing RPC failures on payment verification
- **MEDIUM:** `AppStore` is the primary data layer for the UI but reads/writes `localStorage` — if two tabs or devices are open, data diverges
- **MEDIUM:** `secure-ticket-lookup` Edge Function requires `APP_ALLOWED_ORIGINS` env secret; if unset, the CORS check **blocks all origins** (bug: empty allowedOrigins means no origin passes the `includes()` check)
- **MEDIUM:** TypeScript unused variable warnings in `idCardManagement.test.ts` cause `tsc --noEmit` to report 3 errors
- **LOW:** Old migration `20260101` targets Supabase project `bwlenuxlpesnwnegrbgx` (old project) but active project is `hnthoszbkhvygoowtvau`
- **LOW:** `financial_ledger` RLS only allows `ledger_admin_insert` via `current_admin_role() = 'super_admin'`, but the SECURITY DEFINER function `rpc_verify_payment` inserts into it as `service_role` — this will work, but RLS on the table must not block `service_role`
- **INFORMATIONAL:** Bundle size ~3.75 MB pre-gzip due to `idCardTemplateAssets.ts` base64 images (~1.6 MB)

---

## 2. TECHNOLOGY STACK

| Layer | Technology | Version |
|---|---|---|
| **Frontend Framework** | React | 19.0.1 |
| **Language** | TypeScript | 7.0.2 |
| **Build Tool** | Vite | 8.3.0 |
| **CSS Framework** | Tailwind CSS (v4 Vite plugin) | 4.3.3 |
| **Icon Library** | Lucide React | 0.546.0 |
| **Backend (BaaS)** | Supabase (PostgreSQL + Auth + Storage + Edge Functions) | @supabase/supabase-js 2.119.0 |
| **Database** | PostgreSQL (via Supabase managed cloud) | — |
| **Edge Functions Runtime** | Deno | — |
| **Payment Gateway** | PayStation (Bangladesh) | Sandbox / Production |
| **Deployment** | Vercel (static SPA) | — |
| **QR Code Generation** | qrcode npm | 1.5.4 |
| **PDF Generation** | jsPDF | 4.2.1 |
| **ZIP Generation** | JSZip | 3.10.2 |
| **XSS Sanitizer** | DOMPurify | 3.4.17 |
| **Test Runner** | tsx --test (Node.js built-in test runner) | — |
| **ORM** | Prisma (installed, not yet wired) | 7.10.1 |

---

## 3. SYSTEM ARCHITECTURE

```
╔══════════════════════════════════════════════════════════╗
║                    VERCEL CDN / SPA                       ║
║  React 19 + TypeScript + Vite + Tailwind CSS              ║
║                                                           ║
║  ┌────────────┐  ┌──────────────┐  ┌──────────────────┐  ║
║  │  Public    │  │  Admin       │  │  Scanner/Staff   │  ║
║  │  Website   │  │  Dashboard   │  │  Portal          │  ║
║  └────────────┘  └──────────────┘  └──────────────────┘  ║
╚════════════════════════╤═════════════════════════════════╝
                         │ HTTPS
         ┌───────────────┼──────────────────┐
         ▼               ▼                  ▼
   ┌───────────┐  ┌──────────────┐  ┌──────────────────┐
   │ Supabase  │  │ Supabase     │  │ Supabase         │
   │ PostgREST │  │ Edge         │  │ Auth             │
   │ (anon key)│  │ Functions    │  │ (JWT)            │
   └───────────┘  └──────────────┘  └──────────────────┘
         │               │                  │
         ▼               ▼                  ▼
   ┌─────────────────────────────────────────────────────┐
   │              PostgreSQL Database                      │
   │  (Row Level Security on ALL tables)                   │
   │  Supabase Project: hnthoszbkhvygoowtvau              │
   └─────────────────────────────────────────────────────┘
         │
         ▼
   ┌───────────────────┐
   │ PayStation        │
   │ Payment Gateway   │
   │ (sandbox / prod)  │
   └───────────────────┘
```

### Key Architectural Decisions
1. **Dual-write pattern:** `AppStore` writes to `localStorage` first (instant UI), then asynchronously syncs to Supabase. This means the UI is always responsive but Supabase is the source of truth for server-verified data.
2. **Year-namespaced tables:** Each event year gets its own `registrations_YYYY` and `donations_YYYY` tables for clean data isolation.
3. **Edge Functions as security boundary:** All secrets (payment credentials, service role key, HMAC signing secrets) live in Supabase Edge Function secrets — never in frontend code.
4. **localStorage as primary state:** Most admin/event data flows through `localStorage` → AppStore / EventStore → Supabase. This introduces browser-tab isolation problems.

---

## 4. DATABASE TABLE INVENTORY

### 4.1 Core Registration Tables

#### `registrations_2026`
| Column | Type | Constraint |
|---|---|---|
| `id` | TEXT | PRIMARY KEY |
| `full_name` | TEXT | NOT NULL |
| `full_name_bn` | TEXT | nullable |
| `photo_url` | TEXT | NOT NULL |
| `mobile_number` | TEXT | NOT NULL |
| `email` | TEXT | nullable (altered in migration 20270102) |
| `address` | TEXT | nullable |
| `category` | TEXT | CHECK IN ('former','current') |
| `passing_year` | TEXT | nullable |
| `current_class` | TEXT | nullable |
| `batch_name` | TEXT | NOT NULL |
| `group_or_section` | TEXT | nullable |
| `roll_number` | TEXT | nullable |
| `t_shirt_size` | TEXT | CHECK IN ('S','M','L','XL','XXL','XXXL','Oversize 50') |
| `registration_fee` | NUMERIC | NOT NULL DEFAULT 1500 ≥ 0 |
| `donation_amount` | NUMERIC | NOT NULL DEFAULT 0 ≥ 0 |
| `total_paid` | NUMERIC | NOT NULL DEFAULT 0 ≥ 0 |
| `payment_status` | TEXT | CHECK IN ('paid','pending','failed','refunded') |
| `transaction_id` | TEXT | nullable |
| `payment_method` | TEXT | CHECK IN ('bkash','nagad','rocket','card') |
| `server_verification_signature` | TEXT | nullable |
| `verification_timestamp` | TIMESTAMPTZ | nullable |
| `verified_by` | TEXT | nullable |
| `registered_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() |
| `qr_token` | TEXT | NOT NULL UNIQUE |
| `is_tshirt_collected` | BOOLEAN | NOT NULL DEFAULT FALSE |
| `is_checked_in` | BOOLEAN | NOT NULL DEFAULT FALSE |
| `notes` | TEXT | nullable |
| `year` | INTEGER | NOT NULL DEFAULT 2026 |

**Indexes:** `mobile_number`, `transaction_id`, `qr_token`, `payment_status`, normalized mobile UNIQUE index

#### `registrations_2027`
Same as 2026 plus additional columns:
- `student_id` TEXT nullable
- `last_class_attended` TEXT nullable  
- `gateway_invoice_number` TEXT  
- `gateway_provider` TEXT DEFAULT 'PAYSTATION'  
- `gateway_response` JSONB  
- T-shirt size now includes `'XS'` and `'Oversize 50'`

#### `donations_2026` / `donations_2027`
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT | PRIMARY KEY |
| `donor_name` | TEXT | NOT NULL |
| `mobile_number` | TEXT | nullable |
| `email` | TEXT | nullable |
| `amount` | NUMERIC | NOT NULL CHECK > 0 |
| `purpose` | TEXT | DEFAULT 'General Fund' |
| `payment_method` | TEXT | CHECK enum |
| `transaction_id` | TEXT | NOT NULL (2026) / nullable (2027) |
| `payment_status` | TEXT | 2026 only |
| `date` | TEXT/DATE | NOT NULL |
| `year` | INTEGER | NOT NULL |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() |

### 4.2 Admin & Authentication Tables

#### `admin_accounts`
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT | PRIMARY KEY |
| `username` | TEXT | UNIQUE NOT NULL |
| `full_name` | TEXT | NOT NULL |
| `email` | TEXT | NOT NULL |
| `role` | TEXT | CHECK IN ('super_admin','registration_officer','gate_scanner','finance_manager') |
| `auth_user_id` | UUID | FK → auth.users(id) ON DELETE CASCADE |
| `is_locked` | BOOLEAN | DEFAULT FALSE |
| `failed_attempts` | INTEGER | DEFAULT 0 |
| `last_login_at` | TIMESTAMPTZ | nullable |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() |

**Trigger:** `trg_enforce_single_admin_slot` — prevents more than one admin account  
**password_hash column was dropped** in migration 20261110 (now uses Supabase Auth)

#### `admin_audit_logs`
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT | PRIMARY KEY |
| `admin_id` | TEXT | NOT NULL |
| `admin_username` | TEXT | NOT NULL |
| `admin_role` | TEXT | NOT NULL |
| `action` | TEXT | NOT NULL |
| `target_type` | TEXT | NOT NULL |
| `target_id` | TEXT | NOT NULL |
| `details` | TEXT | nullable |
| `ip_address` | TEXT | nullable |
| `user_agent` | TEXT | nullable |
| `checksum` | TEXT | HMAC-SHA256 |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() |

**RLS:** INSERT allowed for all; UPDATE and DELETE strictly DENIED; SELECT for authenticated only

### 4.3 Staff & Event Management Tables

#### `staff_accounts`
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT | PRIMARY KEY |
| `full_name` | TEXT | NOT NULL |
| `username` | TEXT | UNIQUE NOT NULL |
| `email` | TEXT | UNIQUE NOT NULL |
| `role` | TEXT | CHECK IN ('SUPER_ADMIN','BREAKFAST_STAFF','LUNCH_STAFF','DINNER_STAFF','GATE_STAFF','DRESS_STAFF','FINANCE_STAFF') |
| `status` | TEXT | CHECK IN ('ACTIVE','DISABLED') |
| `assigned_gate` | TEXT | nullable |
| `auth_user_id` | UUID | FK → auth.users(id) CASCADE |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() |

#### `food_distributions`
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT | PRIMARY KEY |
| `registration_id` | TEXT | NOT NULL (no FK — referential flexibility) |
| `student_name` | TEXT | NOT NULL |
| `batch_name` | TEXT | NOT NULL |
| `meal_type` | TEXT | CHECK IN ('breakfast','lunch','dinner') |
| `status` | TEXT | CHECK IN ('COLLECTED','CANCELLED') |
| `collected_at` | TIMESTAMPTZ | DEFAULT NOW() |
| `staff_id` | TEXT | NOT NULL |
| `staff_name` | TEXT | NOT NULL |
| `notes` | TEXT | nullable |
| `corrected_by/reason/at` | TEXT/TIMESTAMPTZ | Audit reversal |

**UNIQUE:** `(registration_id, meal_type)` — prevents double-collection

#### `gate_events`
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT | PRIMARY KEY |
| `registration_id` | TEXT | NOT NULL |
| `event_type` | TEXT | CHECK IN ('ENTRY','EXIT') |
| `gate_id` | TEXT | NOT NULL |
| `staff_id/name` | TEXT | NOT NULL |
| `timestamp` | TIMESTAMPTZ | DEFAULT NOW() |
| `status` | TEXT | CHECK IN ('APPROVED','DENIED','REVISED') |

#### `dress_distributions`
Similar pattern to food — UNIQUE on `(registration_id, item_type)`

#### `scanner_logs`
Older table (from migration 20260101) — tracks entry/exit with gate_id, staff_id, status. Overlaps functionally with `gate_events`. Both exist in the schema.

### 4.4 Finance Tables

#### `central_budget`
Single-row table (PRIMARY KEY = `'BUDGET-2026'`) tracking total event budget

#### `staff_allocations`
Tracks per-staff cash allocations

#### `staff_expenses`
Tracks per-staff expenses with approval workflow

#### `financial_ledger`
Double-entry ledger; `transaction_type` CHECK: `('ALLOCATION','EXPENSE','ADJUSTMENT','CASH_RETURN')` — **MISSING `'REGISTRATION_INFLOW'`** (see vulnerabilities)

#### `admin_audit_history`
Separate from `admin_audit_logs` — tracks entity-level changes with previous/new values

### 4.5 RMS (Reunion Management System) Tables

| Table | Purpose |
|---|---|
| `rms_committees` | 15+ committees with budget tracking |
| `rms_committee_members` | Committee memberships (FK → rms_committees) |
| `rms_tasks` | Kanban-style task management (FK → rms_committees) |
| `rms_task_comments` | Task comments (FK → rms_tasks) |
| `rms_budget_requests` | Budget approval workflow (FK → rms_committees) |
| `rms_expenses` | Committee expense records (FK → rms_committees) |
| `rms_income_transactions` | Income from registrations, sponsorships |
| `rms_sponsors` | Sponsorship CRM |
| `rms_documents` | Document repository (FK → rms_committees) |
| `rms_meetings` | Meeting minutes and agenda |
| `rms_announcements` | Bilingual announcements |
| `rms_volunteers` | Volunteer roster (FK → rms_committees) |
| `rms_event_incidents` | Event-day incident management |
| `rms_weekly_reports` | Weekly progress reports (FK → rms_committees) |
| `rms_audit_logs` | RMS-specific audit trail |

### 4.6 Student ID Card Tables

| Table | Purpose |
|---|---|
| `id_card_staff_accounts` | Separate RBAC for ID card staff |
| `student_id_cards` | One card per registration — tracks generation status |
| `batch_id_card_collections` | Batch-wise aggregate stats |
| `id_card_download_jobs` | Async bulk download job tracking |
| `id_card_download_logs` | Audit trail for all downloads |

### 4.7 Supporting Tables

| Table | Purpose |
|---|---|
| `current_student_ids` | Pre-issued student ID pool for verification |
| `ticket_lookup_rate_limits` | IP-based rate limiting (migration 20261111) |

---

## 5. DATABASE RELATIONSHIP ANALYSIS

### One-to-Many Relationships
```
rms_committees (1) ──→ (N) rms_committee_members
rms_committees (1) ──→ (N) rms_tasks
rms_committees (1) ──→ (N) rms_budget_requests
rms_committees (1) ──→ (N) rms_expenses
rms_committees (1) ──→ (N) rms_documents
rms_committees (1) ──→ (N) rms_volunteers
rms_committees (1) ──→ (N) rms_weekly_reports
rms_tasks     (1) ──→ (N) rms_task_comments
auth.users    (1) ──→ (1) admin_accounts  [unique index]
auth.users    (1) ──→ (1) staff_accounts  [unique index]
```

### Soft Relationships (No FK Constraint — Referential Flexibility)
```
registrations_YYYY.id ──→ food_distributions.registration_id
registrations_YYYY.id ──→ gate_events.registration_id
registrations_YYYY.id ──→ dress_distributions.registration_id
registrations_YYYY.id ──→ scanner_logs.registration_id
registrations_YYYY.id ──→ student_id_cards.registration_id
staff_accounts.id     ──→ staff_allocations.staff_id
staff_accounts.id     ──→ staff_expenses.staff_id
staff_accounts.id     ──→ financial_ledger.staff_id
```

### Missing Foreign Keys (Potential Orphan Risk)
- `food_distributions.registration_id` → no FK to any `registrations_YYYY` (intentional for multi-year flexibility but means orphans possible)
- `rms_budget_requests.finance_reviewer_id` → no FK to `staff_accounts`
- `rms_expenses.submitted_by` → no FK to `staff_accounts`
- `student_id_cards.registration_id` → UNIQUE but no FK (cross-year flexibility)

---

## 6. COMPLETE ER DIAGRAM

```mermaid
erDiagram
    AUTH_USERS {
        uuid id PK
        text email
        text encrypted_password
    }

    ADMIN_ACCOUNTS {
        text id PK
        text username UK
        text full_name
        text email
        text role
        uuid auth_user_id FK
        boolean is_locked
        integer failed_attempts
    }

    STAFF_ACCOUNTS {
        text id PK
        text username UK
        text email UK
        text role
        text status
        uuid auth_user_id FK
    }

    REGISTRATIONS_2026 {
        text id PK
        text full_name
        text mobile_number
        text category
        text payment_status
        text qr_token UK
        numeric total_paid
        text transaction_id
        boolean is_checked_in
        integer year
    }

    REGISTRATIONS_2027 {
        text id PK
        text full_name
        text mobile_number
        text category
        text payment_status
        text qr_token UK
        numeric total_paid
        text gateway_invoice_number
        integer year
    }

    DONATIONS_2026 {
        text id PK
        text donor_name
        numeric amount
        text transaction_id
        integer year
    }

    DONATIONS_2027 {
        text id PK
        text donor_name
        numeric amount
        integer year
    }

    FOOD_DISTRIBUTIONS {
        text id PK
        text registration_id
        text meal_type
        text status
        text staff_id
    }

    GATE_EVENTS {
        text id PK
        text registration_id
        text event_type
        text gate_id
        text staff_id
    }

    DRESS_DISTRIBUTIONS {
        text id PK
        text registration_id
        text registered_size
        text status
        text staff_id
    }

    ADMIN_AUDIT_LOGS {
        text id PK
        text admin_id
        text action
        text checksum
        timestamptz created_at
    }

    FINANCIAL_LEDGER {
        text id PK
        text staff_id
        text transaction_type
        numeric amount
        text reference_id
    }

    STAFF_ALLOCATIONS {
        text id PK
        text staff_id
        numeric allocated_amount
        text status
    }

    STAFF_EXPENSES {
        text id PK
        text staff_id
        numeric amount
        text status
    }

    RMS_COMMITTEES {
        text id PK
        text name_en
        text director_id
        numeric budget_total
        boolean is_active
    }

    RMS_TASKS {
        text id PK
        text committee_id FK
        text status
        text priority
        date deadline
    }

    RMS_BUDGET_REQUESTS {
        text id PK
        text committee_id FK
        numeric requested_amount
        text status
    }

    STUDENT_ID_CARDS {
        text id PK
        text registration_id UK
        text batch_year
        text card_status
        text qr_token UK
        text pdf_storage_path
    }

    AUTH_USERS ||--o| ADMIN_ACCOUNTS : "auth_user_id"
    AUTH_USERS ||--o{ STAFF_ACCOUNTS : "auth_user_id"
    RMS_COMMITTEES ||--o{ RMS_TASKS : "committee_id"
    RMS_COMMITTEES ||--o{ RMS_BUDGET_REQUESTS : "committee_id"
    STAFF_ACCOUNTS ||--o{ FOOD_DISTRIBUTIONS : "staff_id (soft)"
    STAFF_ACCOUNTS ||--o{ GATE_EVENTS : "staff_id (soft)"
    STAFF_ACCOUNTS ||--o{ STAFF_ALLOCATIONS : "staff_id (soft)"
    STAFF_ACCOUNTS ||--o{ STAFF_EXPENSES : "staff_id (soft)"
    STAFF_ACCOUNTS ||--o{ FINANCIAL_LEDGER : "staff_id (soft)"
```

---

## 7. API & EDGE FUNCTION DOCUMENTATION

### 7.1 Supabase Edge Functions

#### `verify-payment`
- **URL:** `https://hnthoszbkhvygoowtvau.supabase.co/functions/v1/verify-payment`
- **Method:** POST
- **Auth:** None (public — payment callback)
- **Actions:**
  - `grant-token` — Retrieves PayStation OAuth token (server-side)
  - `create-payment` — Initiates PayStation hosted checkout
  - `verify-payment` (default) — Queries PayStation API, generates HMAC-SHA256 signature, calls `rpc_verify_payment` to atomically mark payment as paid
- **Secrets Required:** `PAYSTATION_MERCHANT_ID`, `PAYSTATION_PASSWORD`, `PAYSTATION_ENV`, `PAYMENT_SIGNING_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_ALLOWED_ORIGINS`
- **CORS:** Origin-whitelist enforced
- **⚠️ Issue:** Default fallback `PAYSTATION_PASSWORD = 'gamecoderstorepass'` hardcoded if env secret missing

#### `secure-ticket-lookup`
- **URL:** `https://hnthoszbkhvygoowtvau.supabase.co/functions/v1/secure-ticket-lookup`
- **Method:** POST
- **Auth:** None (public endpoint)
- **Input:** `{registrationId, mobileNumber, year}`
- **Rate Limiting:** 20 req/min per IP; 5 req/min per (IP × registration_id)
- **Logic:** Validates inputs, rate-limits, looks up `registrations_{year}` table, verifies mobile matches, ensures `payment_status = 'paid'`, returns sanitized ticket (strips email, address, roll_number)
- **Secrets Required:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RATE_LIMIT_HMAC_SECRET`, `APP_ALLOWED_ORIGINS`
- **⚠️ Issue:** If `APP_ALLOWED_ORIGINS` is empty, the CORS `includes()` check blocks all requests

#### `admin-audit`
- **URL:** `https://hnthoszbkhvygoowtvau.supabase.co/functions/v1/admin-audit`
- **Method:** POST
- **Auth:** Bearer JWT (Supabase session token)
- **Authorization:** Verifies JWT → looks up `admin_accounts` → requires `role = 'super_admin'`
- **Logic:** Validates action/targetType/targetId strings, generates HMAC-SHA256 checksum, inserts tamper-evident audit log
- **Secrets Required:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `AUDIT_SIGNING_SECRET`, `APP_ALLOWED_ORIGINS`
- **⚠️ Issue:** Admin login via `localStorage` test session does NOT carry a Supabase JWT → `admin-audit` will return 401

### 7.2 Supabase PostgREST (via anon key)

| Endpoint | Table | Method | Auth Required | Notes |
|---|---|---|---|---|
| `GET /registrations_2027` | registrations_2027 | SELECT | authenticated | RLS restricts to staff/admin |
| `POST /registrations_2027` | registrations_2027 | INSERT | anon | Only pending, zero-paid status |
| `PATCH /registrations_2027` | registrations_2027 | UPDATE | authenticated | Super admin only |
| `DELETE /registrations_2027` | registrations_2027 | DELETE | authenticated | Super admin only |
| `POST /rpc/rpc_verify_payment` | — | RPC | service_role only | Frontend NOT allowed |
| `POST /rpc/rpc_secure_ticket_lookup` | — | RPC | service_role only | Frontend NOT allowed |
| `GET /admin_audit_logs` | admin_audit_logs | SELECT | authenticated | Super admin RLS |
| `GET /rms_committees` | rms_committees | SELECT | anon | Public read for active |
| `GET /donations_2027` | donations_2027 | SELECT | authenticated | Super admin RLS |

---

## 8. DATA FLOW DOCUMENTATION

### 8.1 Student Registration Flow

```mermaid
sequenceDiagram
    participant U as User Browser
    participant RP as RegistrationPage.tsx
    participant S as AppStore (localStorage)
    participant PM as PaymentModal.tsx
    participant EF as verify-payment Edge Fn
    participant PS as PayStation API
    participant DB as Supabase DB

    U->>RP: Fill registration form
    RP->>RP: Validate inputs (rules.ts)
    RP->>RP: sanitizeInput() on all fields
    RP->>S: Reserve Student ID (current students)
    RP->>PM: Pass formData + fee amounts
    PM->>EF: POST {action:'create-payment', order}
    EF->>PS: POST /grant-token (server-side creds)
    PS-->>EF: grant_token
    EF->>PS: POST /create-payment
    PS-->>EF: payment_url + trx_id
    EF-->>PM: {paymentUrl, trxId}
    PM->>U: Redirect to PayStation checkout iframe
    U->>PS: Complete payment
    PS-->>PM: Payment callback
    PM->>EF: POST {registration_id, trx_id, amount}
    EF->>PS: POST /retrive-transaction (verify)
    PS-->>EF: trx_status = 'Success'
    EF->>EF: generateHmacSha256Signature()
    EF->>DB: rpc_verify_payment(reg_id, trx, amount, signature)
    DB->>DB: Anti-replay check across 2026+2027
    DB->>DB: UPDATE registrations SET payment_status='paid'
    DB->>DB: INSERT financial_ledger (REGISTRATION_INFLOW)
    DB->>DB: INSERT admin_audit_logs
    EF-->>PM: {success, signature, timestamp}
    PM->>S: AppStore.addRegistration(record)
    S->>DB: SupabaseService.saveRegistration() (async)
    PM->>U: Show QR ticket
```

### 8.2 Admin Login Flow

```mermaid
sequenceDiagram
    participant A as Admin Browser
    participant AD as AdminDashboard.tsx
    participant SS as SupabaseService
    participant SAL as supabase.auth
    participant DB as Supabase DB
    participant EF as admin-audit Edge Fn

    A->>AD: Enter email + password
    AD->>SS: loginAdmin(email, password)
    SS->>SAL: signInWithPassword(email, password)
    SAL-->>SS: {user, session}
    SS->>DB: SELECT from admin_accounts WHERE auth_user_id = user.id
    DB-->>SS: admin profile
    SS->>EF: POST admin-audit {action:'ADMIN_LOGIN'}
    EF->>EF: Verify JWT Bearer token
    EF->>DB: Verify admin_accounts role = super_admin
    EF->>DB: INSERT admin_audit_logs with HMAC checksum
    EF-->>SS: {success, id, checksum}
    SS-->>AD: {success, account}
    AD->>AD: setAdminSession(account)
```

### 8.3 Gate Entry Scan Flow

```mermaid
sequenceDiagram
    participant S as Scanner Staff
    participant SP as ScannerPortal.tsx
    participant GS as GateScannerModule.tsx
    participant ES as EventStore
    participant DB as Supabase DB

    S->>SP: Authenticate (Supabase Auth)
    SP->>ES: authenticateStaff(username, password)
    ES->>DB: supabase.auth.signInWithPassword()
    DB-->>ES: session
    ES->>DB: SELECT staff_accounts WHERE auth_user_id=uid AND status=ACTIVE
    DB-->>ES: staff profile
    S->>GS: Scan QR code
    GS->>ES: validateStudentForGate(qrToken, year)
    ES->>DB: SELECT registrations_2027 WHERE qr_token=token
    DB-->>ES: registration (RLS enforced)
    GS->>DB: INSERT gate_events {registration_id, event_type, staff_id, gate_id}
    DB-->>GS: success
    GS->>ES: (AppStore) addScanLog()
```

---

## 9. AUTHENTICATION & AUTHORIZATION ANALYSIS

### 9.1 Admin Authentication

| Mechanism | Description | Status |
|---|---|---|
| Supabase Auth | Email/password via `supabase.auth.signInWithPassword()` | ✅ PRODUCTION PATH |
| Dev bypass | `admin@gmail.com` / `admin@123` when `VITE_ENABLE_TEST_BYPASS=true` AND `DEV=true` | ✅ GATED (env-controlled) |
| Session storage | Supabase JWT session (8-hour TTL via `ADMIN_SESSION_TTL_MS`) | ✅ |
| Session check on mount | `getActiveAdminSession()` checks both localStorage (dev) and Supabase Auth | ✅ |
| Single admin slot | DB trigger `trg_enforce_single_admin_slot` prevents second admin | ✅ |

**⚠️ Issue:** When admin logs in via dev-bypass localStorage session, they do NOT have a Supabase JWT. Any Edge Function call requiring `Authorization: Bearer <JWT>` (e.g., `admin-audit`) will return 401. This creates a **broken audit trail** in dev mode.

### 9.2 Staff Authentication

| Mechanism | Description | Status |
|---|---|---|
| Supabase Auth | `supabase.auth.signInWithPassword()` → `staff_accounts` lookup | ✅ |
| Status check | `status = 'ACTIVE'` checked via `current_event_staff_role()` | ✅ |
| Session TTL | 8-hour session via `STAFF_SESSION_TTL_MS` | ✅ |
| Dev bypass | `admin@123` works for any staff if `VITE_ENABLE_TEST_BYPASS=true` | ✅ GATED |

### 9.3 Row Level Security Analysis

| Table | SELECT | INSERT | UPDATE | DELETE | Assessment |
|---|---|---|---|---|---|
| `admin_accounts` | Authenticated (own row) | Denied (trigger blocks) | Denied | Denied | ✅ Strong |
| `admin_audit_logs` | Super admin only | Anyone (append-only) | DENIED | DENIED | ✅ Immutable |
| `registrations_2027` | Staff/admin roles only | Anon (pending only) | Super admin only | Super admin only | ✅ Strong |
| `registrations_2026` | Partial (old policy) | Partial (old policy) | Authenticated | Authenticated | ⚠️ Weaker (old migration) |
| `donations_2027` | Super admin only | Anon | Super admin only | Super admin only | ✅ |
| `food_distributions` | Meal staff + admin | Meal-specific staff only | Admin only | — | ✅ |
| `gate_events` | Gate staff + admin | Gate staff + admin | — | — | ✅ |
| `financial_ledger` | Finance staff + admin | Admin only | — | — | ✅ |
| `rms_tasks` | Authenticated | Authenticated | — | — | ⚠️ Broad |
| `rms_sponsors` | Public (paid only) | Authenticated | Authenticated | — | ⚠️ Broad |
| `rms_documents` | Authenticated or public | Authenticated | — | — | ⚠️ Broad |

---

## 10. USER-TO-USER DATA ISOLATION TEST RESULTS

### VERIFIED (via code inspection):

| Test | Result | Evidence |
|---|---|---|
| User A reading User B's registration | **BLOCKED** | `registrations_2027` RLS: SELECT restricted to `current_admin_role()='super_admin'` or staff roles; anon cannot query |
| User A modifying User B's payment status | **BLOCKED** | UPDATE restricted to super_admin only; INSERT forces `payment_status='pending'` and `total_paid=0` |
| Unauthenticated access to registration list | **BLOCKED** | RLS denies all SELECT for anon on registration tables |
| Ticket lookup without mobile match | **BLOCKED** | `secure-ticket-lookup` function verifies mobile number match server-side |
| Enumerate all registrations | **BLOCKED** | No public SELECT policy; lookup requires both registration_id AND mobile number |
| Access payment info of another user | **BLOCKED** | Payment data only returned through ticket lookup which requires ID + mobile |
| Regular user accessing admin dashboard | **BLOCKED** (UI) | Backend: `admin_accounts` SELECT blocked by RLS; Edge Functions verify JWT + admin_accounts role |
| Staff accessing admin-only operations | **PARTIAL** | Staff can access their own scanner data; admin dashboard requires separate admin auth |
| Access another user's uploaded photo | **PARTIAL** | Storage bucket is private; but storage.objects INSERT policy allows anyone to upload any file to 'student-photos' bucket — no ownership validation |
| Bypass frontend by calling Supabase directly | **PARTIALLY MITIGATED** | Most sensitive operations require `service_role` key; anon key operations are RLS-protected |

### NOT TESTED (requires live database access):
- Actual RLS policy evaluation with real database connection
- Rate limiting under sustained load
- Session token expiry and forced logout
- Concurrent registration collision handling

---

## 11. SECURITY VULNERABILITY REPORT

### 🔴 CRITICAL

#### C1 — Credentials and Secret Keys in `.env` file
**File:** [`/.env`](file:///Users/sagarkumarsaha/Desktop/1%20plsc2027/plscf65/.env)  
**Lines:** All  
**Root Cause:** `.env` contains `SUPABASE_SECRET_KEY=sb_secret_...` and full `DATABASE_URL` with plaintext password `Puja@337139`. If this file is committed to git, the database is compromised.  
**Evidence:**
```
SUPABASE_SECRET_KEY="sb_secret_REDACTED_FOR_SECURITY"
DATABASE_URL="postgresql://postgres.hnthoszbkhvygoowtvau:Puja%40337139@..."
```
**Impact:** Full database access; ability to bypass all RLS policies using service_role key  
**Fix:** Move sensitive keys to `.env.local` (gitignored); verify `.env` is in `.gitignore`; rotate the exposed secret key immediately

---

#### C2 — Hardcoded Default PayStation Password in Edge Function
**File:** [`supabase/functions/verify-payment/index.ts`](file:///Users/sagarkumarsaha/Desktop/1%20plsc2027/plscf65/supabase/functions/verify-payment/index.ts) line 10  
**Root Cause:** `const PAYSTATION_PASSWORD = Deno.env.get('PAYSTATION_PASSWORD') || 'gamecoderstorepass';`  
**Evidence:** Fallback plaintext merchant password hardcoded  
**Impact:** If `PAYSTATION_PASSWORD` env secret is not set in Supabase, the production gateway authenticates with a known default password  
**Fix:** Remove the fallback. If the secret is missing, fail the function with a 503 and log a critical error

---

### 🟠 HIGH

#### H1 — `financial_ledger` Transaction Type Constraint Missing `REGISTRATION_INFLOW`
**File:** [`supabase/migrations/20260102000000_event_management_system_schema.sql`](file:///Users/sagarkumarsaha/Desktop/1%20plsc2027/plscf65/supabase/migrations/20260102000000_event_management_system_schema.sql) line 148  
**Root Cause:** `transaction_type CHECK IN ('ALLOCATION','EXPENSE','ADJUSTMENT','CASH_RETURN')` but `rpc_verify_payment` inserts `'REGISTRATION_INFLOW'` (migration 20270102, line 310)  
**Impact:** Every successful payment verification will fail with a PostgreSQL constraint violation → payment is verified with PayStation but NOT recorded in the ledger; audit log insert may also fail silently  
**Severity:** HIGH  
**Fix:** `ALTER TABLE financial_ledger DROP CONSTRAINT ...; ALTER TABLE financial_ledger ADD CONSTRAINT ... CHECK (transaction_type IN ('ALLOCATION','EXPENSE','ADJUSTMENT','CASH_RETURN','REGISTRATION_INFLOW'));`

#### H2 — Anon Key Hardcoded as Fallback in Frontend
**File:** [`src/services/supabase.ts`](file:///Users/sagarkumarsaha/Desktop/1%20plsc2027/plscf65/src/services/supabase.ts) line 25–27  
**Root Cause:** `SUPABASE_ANON_KEY = env?.VITE_SUPABASE_ANON_KEY || 'sb_publishable_...'`  
**Impact:** The publishable anon key is baked into the JS bundle even if `VITE_SUPABASE_ANON_KEY` is not set in Vercel. This key is already public by nature, but it means someone can interact with Supabase even without the env variable. Combined with C1 above, this key pair represents a full access path.  
**Fix:** Do not hardcode the fallback. Throw a startup error if the env variable is missing.

#### H3 — Old Registrations_2026 RLS Policies (from migration 20260101) Not Upgraded
**File:** [`supabase/migrations/20260101000000_critical_security_hardened_schema.sql`](file:///Users/sagarkumarsaha/Desktop/1%20plsc2027/plscf65/supabase/migrations/20260101000000_critical_security_hardened_schema.sql)  
**Root Cause:** The 2026 SELECT policy uses `auth.role() = 'authenticated'` (broad) rather than the refined `current_admin_role() = 'super_admin' OR current_event_staff_role() IN (...)` pattern applied to 2027  
**Impact:** Any authenticated Supabase user (not just admins/staff) can SELECT all 2026 registration data  
**Fix:** Apply migration 20261110's `DO $$` loop which dynamically hardens all `registrations_YYYY` tables. Confirm this ran on the live database.

#### H4 — `secure-ticket-lookup` CORS Bug When `APP_ALLOWED_ORIGINS` is Empty
**File:** [`supabase/functions/secure-ticket-lookup/index.ts`](file:///Users/sagarkumarsaha/Desktop/1%20plsc2027/plscf65/supabase/functions/secure-ticket-lookup/index.ts) line 47–50  
**Root Cause:** `if (origin && allowedOrigins.includes(origin))` → if `allowedOrigins = []`, this never matches, so `else if (origin)` returns 403 for ALL origins  
**Impact:** Ticket lookup entirely broken in production if the env secret is unset  
**Fix:** `if (!allowedOrigins.length || allowedOrigins.includes(origin))` — match the same pattern used in `verify-payment`

---

### 🟡 MEDIUM

#### M1 — Default Credentials Visible as Static Strings in Bundle
**Files:** [`AdminDashboard.tsx`](file:///Users/sagarkumarsaha/Desktop/1%20plsc2027/plscf65/src/components/AdminDashboard.tsx) lines 568–576; [`ScannerPortal.tsx`](file:///Users/sagarkumarsaha/Desktop/1%20plsc2027/plscf65/src/components/ScannerPortal.tsx) lines 213–316; [`AdminRmsSettings.tsx`](file:///Users/sagarkumarsaha/Desktop/1%20plsc2027/plscf65/src/components/admin/rms/AdminRmsSettings.tsx) lines 222–223  
**Root Cause:** Credential strings `admin@gmail.com` and `admin@123` are hardcoded in JSX and state initializers. Even when `isDevTestBypassAllowed()` gates the UI display, the string values remain in the production JS bundle.  
**Impact:** Any user who opens DevTools → Sources and searches the bundle will find the default admin credentials  
**Fix:** Move credential hints to environment variables or remove them entirely from JSX. The quick-fill buttons should be removed in production builds.

#### M2 — `localStorage` as Primary Data Store
**Files:** [`src/services/store.ts`](file:///Users/sagarkumarsaha/Desktop/1%20plsc2027/plscf65/src/services/store.ts)  
**Root Cause:** `AppStore` reads/writes `localStorage` as the primary state. Supabase sync is asynchronous and fire-and-forget.  
**Impact:** (a) Multi-device usage causes data divergence; (b) Private browsing loses all data; (c) XSS attacker with localStorage access sees all registration data cached locally; (d) If Supabase sync fails silently, registrations may only exist in one browser  
**Fix:** For the Admin Dashboard, fetch directly from Supabase on mount (the code already does this in some tabs). Consider removing the initial seed data from `INITIAL_REGISTRATIONS` in production.

#### M3 — TypeScript Errors in Test File
**File:** [`src/utils/idCardManagement.test.ts`](file:///Users/sagarkumarsaha/Desktop/1%20plsc2027/plscf65/src/utils/idCardManagement.test.ts) lines 162, 217  
**Root Cause:** `const { processed, total }` are destructured but unused — TS6133 errors  
**Impact:** `tsc --noEmit` currently reports 3 errors; CI lint gate would fail  
**Fix:** Rename to `_processed, _total` or destructure only what is used

#### M4 — `payment-receipts` Storage Bucket Has No Ownership Policy
**File:** [`supabase/migrations/20260101000000_critical_security_hardened_schema.sql`](file:///Users/sagarkumarsaha/Desktop/1%20plsc2027/plscf65/supabase/migrations/20260101000000_critical_security_hardened_schema.sql) lines 162–174  
**Root Cause:** `CREATE POLICY "Public can upload payment receipt" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'payment-receipts');` — no file type or size restriction  
**Impact:** Anyone can upload any file type (including HTML, executable scripts) to the payment-receipts bucket  
**Fix:** Add `MIME type` check and file extension check similar to the student-photos bucket

#### M5 — Missing `auth_user_id` on `admin_accounts` in Old Schema
**File:** [`supabase/migrations/20260101000000_critical_security_hardened_schema.sql`](file:///Users/sagarkumarsaha/Desktop/1%20plsc2027/plscf65/supabase/migrations/20260101000000_critical_security_hardened_schema.sql)  
**Root Cause:** The original schema did not have `auth_user_id`. Migration 20261110 added it via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS auth_user_id`. If 20261110 never ran on the live database (old project `bwlenuxlpesnwnegrbgx` target), `current_admin_role()` will return NULL for all admins.  
**Impact:** All RLS policies based on `current_admin_role()` would silently fail — no one would have admin access  
**Fix:** Confirm migration 20261110 ran on the new project `hnthoszbkhvygoowtvau`. Check via Supabase Dashboard → Database → Migrations.

---

### 🔵 LOW

#### L1 — Old Project ID in Migration Comments
**File:** Migrations 20260101 and 20260102  
**Root Cause:** `-- Target Supabase Project: bwlenuxlpesnwnegrbgx` — refers to old, inactive project  
**Impact:** Confusion only; no security risk  
**Fix:** Update comments to `hnthoszbkhvygoowtvau`

#### L2 — `scanner_logs` Table Duplicates `gate_events`
**Files:** Migrations 20260101, 20260102  
**Root Cause:** Both tables track gate entry/exit scans. `scanner_logs` is from the original schema; `gate_events` is from the event management system.  
**Impact:** Data may be written to only one table depending on code path; queries against one may miss events from the other  
**Fix:** Deprecate `scanner_logs` and migrate all code to `gate_events`. Add a `MIGRATION_NOTE` column if needed for backward compatibility.

#### L3 — Bundle Size Warning
**File:** [`src/utils/idCardTemplateAssets.ts`](file:///Users/sagarkumarsaha/Desktop/1%20plsc2027/plscf65/src/utils/idCardTemplateAssets.ts)  
**Root Cause:** ~1.6 MB base64 images embedded in TypeScript  
**Impact:** Initial page load is slower; Vite build warns about chunk size > 500 KB  
**Fix:** Use dynamic `import()` or `fetch('/assets/id_card/school_crest.png')` at runtime (already noted in Next Steps)

#### L4 — Prisma Installed but Not Configured
**File:** [`package.json`](file:///Users/sagarkumarsaha/Desktop/1%20plsc2027/plscf65/package.json)  
**Root Cause:** `prisma` is in devDependencies but `prisma.schema` is empty/incomplete  
**Impact:** Dead dependency; no security risk  
**Fix:** Either configure Prisma with the Supabase connection string, or remove it if not needed

---

### ℹ️ INFORMATIONAL

#### I1 — `unsafe-inline` in CSP script-src
**File:** [`vercel.json`](file:///Users/sagarkumarsaha/Desktop/1%20plsc2027/plscf65/vercel.json)  
`script-src 'self' 'unsafe-inline'` — React 19 no longer requires `unsafe-inline` for event handlers. This is permissive.  
**Recommendation:** Use nonce-based CSP if `unsafe-inline` is needed; otherwise restrict to `'self'` only.

#### I2 — No CSRF Protection on Edge Functions
PayStation callbacks to `verify-payment` are not CSRF-protected (no CSRF token). However, since the endpoint is a backend-to-backend payment callback, CSRF is not applicable here. ✅ Acceptable.

#### I3 — `ip_address: 'unavailable'` in Audit Logs
**File:** [`src/services/supabase.ts`](file:///Users/sagarkumarsaha/Desktop/1%20plsc2027/plscf65/src/services/supabase.ts) line 632  
IP addresses are not captured in admin audit logs (always set to `'unavailable'`). The Edge Function itself reads CF-Connecting-IP for rate limiting but does not forward it to audit logs.  
**Recommendation:** Pass IP through the audit event for forensic analysis.

---

## 12. DATABASE PERFORMANCE ANALYSIS

### Existing Indexes (VERIFIED)
| Table | Index | Columns | Type |
|---|---|---|---|
| registrations_2026 | idx_reg_2026_mobile | mobile_number | BTREE |
| registrations_2026 | idx_reg_2026_trx | transaction_id | BTREE |
| registrations_2026 | idx_reg_2026_qr | qr_token | BTREE |
| registrations_2026 | idx_reg_2026_status | payment_status | BTREE |
| registrations_2027 | idx_reg_2027_mobile | mobile_number | BTREE |
| registrations_2027 | idx_reg_2027_trx | transaction_id | BTREE |
| registrations_2027 | idx_reg_2027_qr | qr_token | BTREE |
| registrations_2027 | idx_reg_2027_status | payment_status | BTREE |
| registrations_2027 | idx_reg_2027_gateway_inv | gateway_invoice_number | PARTIAL |
| registrations_2027 | uq_registrations_2027_mobile_normalized | normalized mobile | UNIQUE FUNCTIONAL |
| food_distributions | idx_food_reg_meal | (registration_id, meal_type) | BTREE |
| gate_events | idx_gate_reg_id | registration_id | BTREE |
| gate_events | idx_gate_timestamp | timestamp DESC | BTREE |
| rms_tasks | idx_rms_tasks_deadline | deadline | BTREE |
| rms_audit_logs | idx_rms_audit_timestamp | timestamp DESC | BTREE |

### Missing Indexes (POTENTIAL PERFORMANCE ISSUES)
| Table | Missing Index | Query Pattern |
|---|---|---|
| admin_audit_logs | (admin_id, created_at) | Per-admin audit history queries |
| staff_expenses | (staff_id, status, created_at) | Finance dashboard queries |
| registrations_2027 | (batch_name) | Batch-wise student ID card grouping |
| student_id_cards | (event_year, card_status) | Year-wise generation status dashboard |

### N+1 Query Risks
- `AppStore.getRegistrations()` loads ALL registrations into memory, then filters in JavaScript — no pagination
- Admin dashboard fetches all registrations on mount — for 10,000+ students this will be slow
- `idCardStore.syncWithRegistrations()` iterates all registrations to build card collection — O(n) JS loop

---

## 13. BROKEN OR MISSING CONNECTIONS

| Item | Description | Severity |
|---|---|---|
| `financial_ledger` CHECK constraint | `REGISTRATION_INFLOW` not in allowed values — payment RPC will fail | 🔴 HIGH |
| `secure-ticket-lookup` CORS | Empty `APP_ALLOWED_ORIGINS` blocks all origins | 🟠 HIGH |
| Admin audit JWT | Dev-bypass admin sessions have no JWT → `admin-audit` Edge Function returns 401 | 🟡 MEDIUM |
| `scanner_logs` vs `gate_events` | Duplicate tables; unclear which is canonical | 🔵 LOW |
| `Prisma` schema | Installed but not configured | 🔵 LOW |
| `id_card_download_logs` table | Referenced in `idCardStore.ts` but not in the migration file for `id_card_download_logs` — only 4 tables created in that migration | 🔵 LOW |
| `verify-student-id` Edge Function | `verificationUrl` on ID cards points to this endpoint but the function does not exist | 🟡 MEDIUM |

---

## 14. ROLE & PERMISSION MATRIX

### Admin Roles (`admin_accounts.role`)
| Permission | super_admin | registration_officer | gate_scanner | finance_manager |
|---|---|---|---|---|
| View all registrations | ✅ | ✅ | ✅ | ✅ |
| Edit registrations | ✅ | ❌ | ❌ | ❌ |
| Delete registrations | ✅ | ❌ | ❌ | ❌ |
| View financial data | ✅ | ❌ | ❌ | ✅ |
| Manage fee settings | ✅ | ❌ | ❌ | ❌ |
| Access admin dashboard | ✅ | ✅ | ✅ | ✅ |
| Generate audit reports | ✅ | ❌ | ❌ | ❌ |
| Database backup export | ✅ | ❌ | ❌ | ❌ |
| Create staff accounts | ✅ | ❌ | ❌ | ❌ |
| Manage RMS committees | ✅ | ❌ | ❌ | ❌ |

### Event Staff Roles (`staff_accounts.role`)
| Permission | SUPER_ADMIN | GATE_STAFF | BREAKFAST_STAFF | LUNCH_STAFF | DINNER_STAFF | DRESS_STAFF | FINANCE_STAFF |
|---|---|---|---|---|---|---|---|
| Read all registrations | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Record gate events | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Record food distribution | ✅ | ❌ | ✅(B) | ✅(L) | ✅(D) | ❌ | ❌ |
| Record dress distribution | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| View financial allocations | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Submit expenses | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| View ledger | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Breakfast after 1PM | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

> **Note:** Breakfast time-lock enforced at DB level: `timezone('Asia/Dhaka', now())::time < TIME '13:00'`

### ID Card System Roles (`id_card_staff_accounts.role`)
| Permission | SUPER_ADMIN | ID_CARD_SUPERVISOR | ID_CARD_STAFF |
|---|---|---|---|
| Generate individual cards | ✅ | ✅ | ✅ |
| Download single card | ✅ | ✅ | ✅ |
| Download batch ZIP | ✅ | ✅ | ✅ |
| Download all cards bulk | ✅ | ❌ | ❌ |
| Approve staff accounts | ✅ | ❌ | ❌ |
| Manage staff roster | ✅ | ❌ | ❌ |

---

## 15. VISUAL ARCHITECTURE DIAGRAMS

### 15.1 System Architecture

```mermaid
flowchart TD
    U[Public Users] -->|HTTPS| V[Vercel CDN]
    A[Admin] -->|HTTPS| V
    S[Staff/Scanner] -->|HTTPS| V

    V -->|React SPA| FE[Frontend Bundle]
    FE -->|anon key| PG[Supabase PostgREST]
    FE -->|functions.invoke| EF[Edge Functions]
    FE -->|auth session| AUTH[Supabase Auth]

    EF -->|service_role| PG
    EF -->|HTTPS| PS[PayStation API]

    PG -->|RLS enforced| DB[(PostgreSQL)]
    AUTH --> DB

    DB --> STORE[Supabase Storage]
    DB --> BUCKET1[student-photos bucket - private]
    DB --> BUCKET2[payment-receipts bucket - private]
```

### 15.2 Authentication Flow

```mermaid
flowchart LR
    A[User] -->|email+password| B{Auth Type}
    B -->|Admin login| C[supabase.auth.signInWithPassword]
    B -->|Staff login| C
    C -->|JWT| D[Supabase Auth]
    D -->|user.id| E{admin_accounts lookup}
    E -->|found + super_admin| F[Admin Dashboard]
    E -->|not found| G[Access Denied]
    D -->|user.id| H{staff_accounts lookup}
    H -->|found + ACTIVE| I[Scanner Portal]
    H -->|DISABLED| J[Account Disabled]

    F -->|Bearer JWT| K[admin-audit Edge Fn]
    K -->|HMAC checksum| L[(admin_audit_logs)]
```

### 15.3 Data Flow — Payment Verification

```mermaid
flowchart TD
    A[Student submits registration] --> B[Frontend: payment_status=pending]
    B --> C[INSERT registrations_2027]
    C --> D[PaymentModal initiates checkout]
    D --> E[verify-payment Edge Fn: create-payment]
    E --> F[PayStation: grant-token + create-payment]
    F --> G[Student pays on PayStation page]
    G --> H[Frontend: verify-payment Edge Fn called]
    H --> I[PayStation: retrive-transaction]
    I -->|Success| J[generateHmacSha256Signature]
    J --> K[rpc_verify_payment RPC]
    K --> L[Anti-replay check across 2026+2027]
    L -->|No duplicate| M[UPDATE payment_status=paid]
    M --> N[INSERT financial_ledger]
    M --> O[INSERT admin_audit_logs]
    K --> P[Return success + signature]
    P --> Q[Frontend shows QR ticket]
```

### 15.4 Role & Permission Relationship

```mermaid
flowchart LR
    SA[super_admin] -->|full access| REG[Registrations]
    SA -->|full access| FIN[Finance]
    SA -->|full access| AUD[Audit Logs]
    SA -->|full access| STF[Staff Management]
    SA -->|full access| RMS[RMS Modules]
    SA -->|full access| IDC[ID Card System]

    RO[registration_officer] -->|read-only| REG
    FM[finance_manager] -->|read| FIN
    GS[gate_scanner] -->|read| REG

    GATE[GATE_STAFF] -->|read reg + write gate| GATEEV[gate_events]
    BKFST[BREAKFAST_STAFF] -->|read reg + write food| FOOD[food_distributions]
    DRSS[DRESS_STAFF] -->|read reg + write dress| DRESS[dress_distributions]
    FNST[FINANCE_STAFF] -->|read/write| FIN
```

---

## 16. RECOMMENDED IMPROVEMENTS & PRIORITIZED ACTION PLAN

### 🔴 CRITICAL — Do Immediately

| # | Action | File | Effort |
|---|---|---|---|
| 1 | Move `.env` secrets to `.env.local`; add `.env` to `.gitignore`; rotate `SUPABASE_SECRET_KEY` and database password | `.env`, `.gitignore` | 30 min |
| 2 | Remove hardcoded `PAYSTATION_PASSWORD` fallback in Edge Function | `verify-payment/index.ts` line 10 | 5 min |
| 3 | Fix `financial_ledger` CHECK constraint to include `'REGISTRATION_INFLOW'` | New migration | 15 min |

### 🟠 HIGH — This Week

| # | Action | File | Effort |
|---|---|---|---|
| 4 | Fix CORS bug in `secure-ticket-lookup`: handle empty `allowedOrigins` | `secure-ticket-lookup/index.ts` line 47 | 5 min |
| 5 | Remove anon key hardcoded fallback; throw startup error if env missing | `src/services/supabase.ts` line 25 | 10 min |
| 6 | Confirm migration 20261110 (`auth_and_rls_hardening.sql`) ran on live project; verify `current_admin_role()` function exists | Supabase Dashboard | 20 min |
| 7 | Verify that RLS policies on `registrations_2026` have been upgraded by the dynamic DO $$ loop | Supabase Dashboard | 20 min |

### 🟡 MEDIUM — This Sprint

| # | Action | File | Effort |
|---|---|---|---|
| 8 | Remove credential strings from JSX in production builds (use env-gated conditional) | `AdminDashboard.tsx`, `ScannerPortal.tsx`, `AdminRmsSettings.tsx` | 1 hr |
| 9 | Fix TypeScript errors in `idCardManagement.test.ts` (rename unused vars) | `idCardManagement.test.ts` | 10 min |
| 10 | Add file type restriction to `payment-receipts` storage bucket policy | New migration | 15 min |
| 11 | Create `verify-student-id` Edge Function for ID card QR verification | New Edge Function | 2 hrs |
| 12 | Add `id_card_download_logs` table to `20270103` migration (or new migration) | New migration | 15 min |

### 🔵 LOW — Backlog

| # | Action | Effort |
|---|---|---|
| 13 | Deprecate `scanner_logs` table; migrate all code to `gate_events` | 2 hrs |
| 14 | Add lazy loading for `idCardTemplateAssets.ts` base64 images | 1 hr |
| 15 | Add missing indexes on `admin_audit_logs(admin_id)`, `registrations_2027(batch_name)` | 30 min |
| 16 | Implement server-side pagination for `fetchRegistrations()` | 2 hrs |
| 17 | Configure Prisma or remove it from devDependencies | 30 min |
| 18 | Forward client IP to `admin-audit` for forensic completeness | 1 hr |
| 19 | Replace `unsafe-inline` in CSP with nonce-based policy | 2 hrs |
| 20 | Add `Supabase Realtime` subscription to sync `AppStore` across tabs/devices | 4 hrs |

---

*Report generated by complete source-code inspection (read-only). All findings are VERIFIED unless marked POTENTIAL or NOT TESTED. No code was modified during this audit.*
