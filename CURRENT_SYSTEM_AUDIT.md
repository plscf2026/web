# Current System Audit Report
## Sylhet Police Lines High School & College Reunion Platform

---

## 1. Executive Audit Overview
This audit examines the existing web platform for Sylhet Police Lines High School & College, Faridpur (Est. 1962). The application is an active, production-grade event registration and ticketing system built using a modern React/TypeScript stack backed by Supabase PostgreSQL and PayStation Bangladesh.

---

## 2. Technical Stack & Architecture

### 2.1 Frontend Architecture
- **Framework**: React 18.3.1 (with TypeScript strict mode enabled: `noUnusedLocals: true`, `noUnusedParameters: true`).
- **Build Tool**: Vite 8.3.7 with Rolldown optimization (sub-400ms production builds).
- **Styling**: Tailwind CSS utility framework with brutalist-inspired typography (`Clash Display` for bold headlines, `Satoshi` for body text).
- **Component Model**: Functional React components with custom hooks and TypeScript interfaces.
- **Routing Structure**: Single-Page Application (SPA) driven by stateful view routing in `src/App.tsx`:
  - `home`: Public landing page, countdown timer, hero section, schedule preview, sponsor showcases.
  - `register`: Comprehensive attendee registration form (Current & Alumni).
  - `find-ticket`: Public lookup tool to recover QR e-Ticket using mobile number.
  - `ticket`: High-resolution digital e-Ticket with HMAC verification signature and printable pass.
  - `donate`: Dedicated donation & contributor portal.
  - `notices`: Institutional notice board.
  - `gallery`: Historical and reunion photo gallery.
  - `about`: Institutional history, campus location, and helpdesk contacts.
  - `scanner`: Multi-station barcode and QR scanner portal (Gate, Food, Dress).
  - `admin`: Full-featured administrative command dashboard.

### 2.2 Backend & API Structure
- **BaaS Provider**: Supabase (`bwlenuxlpesnwnegrbgx.supabase.co`).
- **Database Engine**: PostgreSQL 15+ with Row Level Security (RLS) policies.
- **Serverless Functions**: Supabase Edge Functions (`verify-payment`).
- **Client Service Layer**:
  - `src/services/supabase.ts`: Supabase client, administrative session management, registration upsert/query, and table fallbacks.
  - `src/services/store.ts`: Authoritative local cache (`AppStore`) with atomic synchronization to Supabase.
  - `src/services/studentIdStore.ts`: Atomic student ID inventory and reservation manager (`StudentIdService`).
  - `src/services/eventStore.ts`: Master budget and expense management store (`EventStore`).
  - `src/services/rmsStore.ts`: Reunion Management ERP persistence store (`RmsStore`).
  - `src/services/paystation.ts`: Official PayStation Bangladesh API integration client.

### 2.3 Database Architecture
- **Year-Partitioned Tables**: Table names resolve dynamically based on event year (e.g. `registrations_2026`, `registrations_2027`, `donations_2026`, `expenses_2026`).
- **Core Entities**:
  - `registrations_YYYY`: Attendee ID, full name, Bengali name, photo URL, mobile number, optional email, student category (`former` / `current`), verified student ID, passing year, batch name, t-shirt size, fee, donation, payment status, transaction ID, QR token, meal/gate/dress collection flags.
  - `donations_YYYY`: Donor details, amount, transaction ID, payment status.
  - `expenses_YYYY`: Operational budget expenses, category, voucher ID, verifying officer.
  - `scan_logs_YYYY`: Physical event scan telemetry (Gate entry/exit, Food tokens, Kit issuance).
  - `admin_users`: Administrative credentials, single-slot session control tokens.
  - `student_id_inventory`: Pre-verified student ID cards with reservation timestamps.
  - `rms_*`: 15 normalized ERP tables covering committees, tasks, budgets, expenses, sponsors, documents, meetings, volunteers, incidents, weekly reports, and audit logs.

### 2.4 Administrative Authentication & Authorization
- **Single-Slot Concurrency Control**: Uses an active session heartbeat mechanism in `SupabaseService.loginAdmin` and `getActiveAdminSession` to prevent simultaneous conflicting administrative overrides.
- **Universal Test Credential**: `admin@gmail.com` with unified password `admin@123`.
- **Staff Access Control**: Multi-Station Scanner portal supports designated staff PINs with role-based restriction (Gate scanner staff cannot distribute food or alter financial allocations).

### 2.5 Student Registration System
- **Categories**:
  1. `former`: Former students / Alumni (requires passing year and batch name).
  2. `current`: Current enrolled students (requires verified institutional student ID and section).
- **Validation**:
  - Bangladeshi mobile numbers strictly validated to 11 digits (`013` to `019`).
  - Email is strictly optional.
  - Student IDs verified atomically against `student_id_inventory`.

### 2.6 Payment Gateway Integration
- **Gateway**: PayStation Bangladesh (`api.paystation.com.bd` / sandbox `sandbox.paystation.com.bd`).
- **Workflow**:
  1. Merchant grant token request via HMAC authentication.
  2. Create payment URL with order ID, customer mobile, and amount.
  3. Customer redirected to PayStation multi-channel gateway (bKash, Nagad, Rocket, Cards).
  4. Server-to-server transaction retrieval and verification.
  5. Cryptographic HMAC signature generated on completion to prevent client tampering.

### 2.7 Image & File Upload System
- **Client-Side Compression**: High-resolution mobile camera pictures or uploaded files are processed in-browser via an HTML5 Canvas pipeline (`compressImageTo200KB`).
- **Target Constraint**: File size is guaranteed under 200KB prior to upload.
- **Storage**: Stored as base64 data URLs or uploaded to Supabase Storage.

### 2.8 Routing & Navigation
- State-based navigation via `App.tsx` avoiding brittle URL hash mismatches.
- Persistent language state (`en` / `bn`) synced to `localStorage`.

### 2.9 Security & Database Access Rules
- Strict XSS escaping of attendee input.
- SQL injection pattern detection on search inputs.
- Anti-replay duplicate payment receipt detection.
- Cryptographic HMAC-SHA256 signature on QR codes.
- Zero-silent-deletion policy on approved expenses.
- 38/38 passing automated unit tests.

