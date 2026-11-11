# Project Implementation Phases & Milestones (Phases.md)
## Police Lines School & College Faridpur — Reunion 2026 Platform
### Technology Stack: Next.js 15 App Router + Supabase + Tailwind CSS v4
### Design Language: Raw Form — Light Sky Brutalist Edition

---

## 1. Roadmap Overview & Timeline

The project is structured into **9 distinct, progressive phases** designed to transition the application from the legacy prototype into an enterprise-grade, high-performance, and secure event operating platform.

```mermaid
gantt
  title PLSCF Reunion 2026 Implementation Timeline
  dateFormat  YYYY-MM-DD
  section Foundation & System
    Phase 1: Next.js & Raw Form Light Sky Design   :p1, 2026-11-15, 7d
    Phase 2: Database Schema & RLS Hardening       :p2, 2026-11-20, 6d
  section Core Capabilities
    Phase 3: Bilingual Public Portal & Registration:p3, 2026-11-25, 8d
    Phase 4: PayStation Payment Integration        :p4, 2026-12-02, 7d
    Phase 5: Digital Ticketing & Public Lookup     :p5, 2026-12-08, 6d
  section Operations & Finance
    Phase 6: On-Site Scanner Suite (Gate/Food/Dress):p6, 2026-12-14, 8d
    Phase 7: Event Budget & Staff Expense Ledger   :p7, 2026-12-21, 6d
  section Administration & Launch
    Phase 8: Admin Dashboard & Immutable Audit Trail:p8, 2026-12-26, 7d
    Phase 9: Load Testing, QA & Production Launch  :p9, 2027-01-02, 6d
```

---

## 2. Detailed Phase Breakdown

### Phase 1: Next.js 15 Foundation & Raw Form Light Sky Design Tokens
- **Objective**: Establish the Next.js 15 App Router structure and implement the "Raw Form" Swiss Brutalist design language configured in the **Light Sky** color palette.
- **Key Deliverables**:
  - Next.js 15 project bootstrap with TypeScript, ESLint, and Tailwind CSS v4.
  - Integration of brand fonts: **Clash Display** (Headings, bold 700, tight tracking) and **Satoshi** (Body, 400/500).
  - CSS variables and Tailwind theme setup for the Light Sky palette:
    - Base: `#F0F6FA`, Primary: `#0F172A`, Accent Blue: `#0284C7`, Vibrant Cyan: `#0EA5E9`, Soft Sky Glow: `#38BDF8`, Secondary Surface: `#E2EEF8`.
  - Core Brutalist component library:
    - `BrutalistButton` with directional white sliding hover fill and text color shift.
    - `AnimatedGradientBlob` with organic pulse and multiply blend mode.
    - `TypographicHero` featuring full-height 18vw headline and indented sub-lines.
    - `CategoryDivider` with 12vw oversized section titles.
    - Fixed minimalist navigation with mobile `mix-blend-difference` mode and brutalist footer with 10vw year banner.

### Phase 2: Database Schema Consolidation & RLS Hardening
- **Objective**: Unify and harden the PostgreSQL database schema in Supabase, resolving all schema drift and missing table issues identified in the project audit.
- **Key Deliverables**:
  - Consolidation of migrations into a clean, reproducible migration script.
  - Creation of missing tables: `public.current_student_ids`, `public.inquiries`, and `private.ticket_lookup_rate_limits`.
  - Declaration of missing foreign keys and secondary indexes on high-query columns (`mobile_number`, `transaction_id`, `qr_token`, `staff_id`, `gate_id`).
  - Strict Row Level Security (RLS) policies on all tables, isolating public, staff, and admin permissions.
  - Storage bucket provisioning (`student-photos` and `payment-receipts`) with signed URL access controls and MIME-type restrictions.
  - Establishment of `@supabase/ssr` server and browser client helpers.

### Phase 3: Bilingual Public Portal & Registration Engine
- **Objective**: Deliver a captivating public landing page and seamless multi-step registration engine supporting English and Bangla (`বাংলা`).
- **Key Deliverables**:
  - Bilingual i18n dictionary system (`en.json`, `bn.json`) with client toggle and cookie/URL persistence.
  - Landing page content sections: Hero, Countdown Timer, Event Schedule, Archival Photo Gallery, and Notice Board.
  - Registration Form supporting Alumni, Current Student, and Teacher categories.
  - Real-time client and server-side validation using Zod.
  - Direct-to-Supabase Storage image uploader with client compression (max 2 MB) and crop preview.
  - Real-time Student ID verification against `current_student_ids` table.

### Phase 4: Production Payment Gateway (PayStation / Merchant Integration)
- **Objective**: Replace the disabled payment stub with a secure, server-authoritative PayStation payment pipeline.
- **Key Deliverables**:
  - Next.js Route Handler `/api/checkout/initiate` for server-calculated fee orders.
  - PayStation Sandbox and Production API client with environment-isolated credentials.
  - Webhook Route Handler `/api/checkout/callback` with cryptographic HMAC-SHA256 signature verification.
  - Idempotent order processing preventing double-billing or duplicate ticket generation.
  - Automatic ticket generation and QR token provisioning upon payment confirmation.

### Phase 5: Digital Ticketing & Public Retrieval Portal
- **Objective**: Provide attendees with an editorial boarding-pass style digital ticket and rate-limited public retrieval.
- **Key Deliverables**:
  - `TicketView` component with brutalist aesthetics, attendee portrait, registered batch, assigned gate, and high-density QR code.
  - Clean print stylesheet and client-side PDF export functionality.
  - Public ticket lookup page (`/ticket`) allowing retrieval via Registration ID or Mobile Number.
  - Database-backed rate limiting (20 req/min per IP, 5 req/min per subject) via PostgreSQL stored procedure.
  - Asynchronous transactional email dispatch containing ticket download link and PDF pass.

### Phase 6: On-Site Operational Scanner Modules (Camera Stream & Realtime)
- **Objective**: Equip on-site gate and distribution volunteers with instant, camera-enabled verification tools.
- **Key Deliverables**:
  - In-browser live camera stream utilizing HTML5-QRCode / ZXing library.
  - Gate Check-in module with duplicate entry prevention and audio alerts (success chime vs. rejection buzzer).
  - Food Distribution module supporting Breakfast, Lunch, and Dinner.
  - Enforcement of Breakfast distribution cutoff strictly before 13:00 Dhaka time.
  - Dress Distribution module displaying registered T-shirt size (`S` to `Oversize 50`) and logging one-tap fulfillment.
  - Supabase Realtime synchronization across all concurrent scanner devices.

### Phase 7: Event Budget, Staff Petty Cash & Expense Ledger
- **Objective**: Provide steering committee and finance teams with transparent, real-time expenditure management.
- **Key Deliverables**:
  - Central budget allocation dashboard with category caps.
  - Staff petty cash disbursement tracking.
  - Mobile-friendly expense submission interface with camera receipt upload to `payment-receipts`.
  - Multi-tier approval workflow (Pending $\rightarrow$ Approved $\rightarrow$ Rejected $\rightarrow$ Voided).
  - Real-time computed staff remaining balance.

### Phase 8: Executive Admin Dashboard & Tamper-Evident Audit Trail
- **Objective**: Deliver an administrative command center for steering committee leaders.
- **Key Deliverables**:
  - Real-time metrics overview (Gross collections, Registration volume by batch, Meal consumption rates).
  - Attendee roster with advanced filtering, manual override modal, and CSV/Excel export.
  - Staff account management with granular role assignment (`gate_staff`, `food_staff`, `dress_staff`, `finance_staff`, `super_admin`).
  - Immutable audit trail (`admin_audit_logs`) recording every administrative change with an HMAC-SHA256 checksum.

### Phase 9: End-to-End Testing, Load Testing & Production Launch
- **Objective**: Guarantee zero-defect execution during peak registration and event day operations.
- **Key Deliverables**:
  - Comprehensive unit and integration test suite with > 90% coverage on core rules.
  - Playwright E2E tests simulating registration, checkout, payment webhook, ticket generation, and scanner check-in.
  - Simulated load test: 1,000 concurrent QR scanner verifications per minute with sub-250ms response times.
  - Production deployment on Vercel and Supabase Managed Cloud with automated database backups and failover procedures.

