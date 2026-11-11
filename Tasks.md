# Actionable Task List & Engineering Backlog (Tasks.md)
## Police Lines School & College Faridpur — Reunion 2026 Platform
### Technology Stack: Next.js 15 (App Router) + Supabase + Tailwind CSS v4

---

## Task Priority Definitions
- **P0 (Critical / Launch Blocker)**: Must be implemented before any public testing or payment handling.
- **P1 (High / Core Architecture)**: Data integrity, security boundaries, and operational essentials.
- **P2 (Medium / Functional UX)**: Scanner experience, reporting, administrative management.
- **P3 (Low / Polish & Optimization)**: Advanced animations, extra filters, print layout tweaks.

---

## Epic 1: Next.js 15 Scaffold & Raw Form (Light Sky) Design System

- [ ] `TASK-101` [P1] **Initialize Next.js 15 App Router & Project Structure**
  - Setup Next.js 15 with TypeScript, Tailwind CSS v4, and PostCSS.
  - Setup ESLint and Prettier configurations.
- [ ] `TASK-102` [P1] **Typography & Font Pipeline Configuration**
  - Integrate **Clash Display** for headings (`font-clash`) and **Satoshi** for body (`font-satoshi`).
  - Configure CSS font-display swap and fallback system stacks.
- [ ] `TASK-103` [P1] **Light Sky Color Tokens & Global Styling**
  - Define CSS variables for Light Sky palette (`#F0F6FA`, `#0F172A`, `#0284C7`, `#0EA5E9`, `#38BDF8`, `#E2EEF8`).
  - Configure custom 8px scrollbar (`#0284C7` thumb, `#F0F6FA` track) and text selection highlight.
- [ ] `TASK-104` [P2] **Signature Brutalist Components**
  - Build `BrutalistButton` with directional white sliding hover fill and text color transition to `#0284C7`.
  - Build `AnimatedGradientBlob` with organic pulse, 140px blur, and multiply blend mode.
  - Build `TypographicHero` featuring full-viewport 18vw headline and 15vw indentation.
  - Build `CategoryDivider` with alternating right/left aligned 12vw titles.
  - Build `Navigation` with mobile `mix-blend-difference` and Lucide icons.
  - Build `Footer` with massive 10vw `'2026'` watermark.

---

## Epic 2: Supabase Database Schema, RLS & Storage Buckets

- [ ] `TASK-201` [P0] **Consolidate PostgreSQL Migrations**
  - Consolidate legacy migrations into a clean, reproducible initial migration script.
  - Fix table schema mismatch: ensure `registrations_2026` has all required fields, nullable constraints, and checks.
- [ ] `TASK-202` [P1] **Create Missing Database Tables**
  - Provision `public.current_student_ids` for atomic student ID verification.
  - Provision `public.inquiries` for public contact messages.
  - Provision `private.ticket_lookup_rate_limits` for sliding-window rate limiting.
- [ ] `TASK-203` [P1] **Foreign Key & Index Optimization**
  - Establish explicit foreign keys between `gate_events`, `food_distributions`, `dress_distributions`, and `registrations_2026`.
  - Add query indexes on `mobile_number`, `qr_token`, `transaction_id`, `payment_status`, and `timestamp`.
- [ ] `TASK-204` [P1] **Row Level Security (RLS) Policy Enforcement**
  - Configure zero-trust RLS policies isolating public anonymous, authenticated staff roles, and super-admin.
  - Implement breakfast time restriction policy (cutoff strictly at 13:00 Dhaka time).
- [ ] `TASK-205` [P1] **Supabase Storage Buckets Setup**
  - Provision `student-photos` bucket (max 2MB, image MIME types).
  - Provision `payment-receipts` private bucket for expense vouchers.

---

## Epic 3: Bilingual Public Experience & Landing Page

- [ ] `TASK-301` [P2] **Internationalization (i18n) Engine**
  - Setup bilingual dictionary system supporting English (`en`) and Bangla (`বাংলা`).
  - Create language switcher component in navigation bar with cookie persistence.
- [ ] `TASK-302` [P2] **Landing Page Sections Assembly**
  - Implement Hero section with live attendee registration counter.
  - Implement Event Schedule & Timeline section with accordion details.
  - Implement Official Notice Board with downloadable attachments.
  - Implement Archival Photo Gallery with batch filters.
  - Implement Contact & Support form saving to `public.inquiries`.

---

## Epic 4: Robust Registration Engine & Photo Pipeline

- [ ] `TASK-401` [P0] **Registration Form State & Multi-Step Wizard**
  - Implement multi-step registration flow: Category Selection $\rightarrow$ Personal Details $\rightarrow$ Merchandise $\rightarrow$ Review.
  - Add client-side Zod validation with Bangladeshi mobile regex (`^(?:\+?88)?01[3-9]\d{8}$`).
- [ ] `TASK-402` [P1] **Client Image Compression & Direct Storage Upload**
  - Implement image cropper with 1:1 aspect ratio constraint.
  - Compress image client-side to WebP format ($< 2$ MB).
  - Stream directly to Supabase Storage bucket `student-photos`; eliminate base64 database storage.
- [ ] `TASK-403` [P1] **Current Student Atomic Verification**
  - Connect student registration to `public.current_student_ids`.
  - Atomically mark student ID as reserved to prevent concurrent re-use.

---

## Epic 5: PayStation Payment Integration & Server Webhook Pipeline

- [ ] `TASK-501` [P0] **Checkout Initiation Route Handler (`/api/checkout/initiate`)**
  - Implement server-side fee recalculation (Alumni base ৳1,500, Guest surcharges, Subsidized Student ৳500).
  - Insert initial `pending` record in `registrations_2026`.
  - Call PayStation Sandbox API to obtain secure hosted checkout URL.
- [ ] `TASK-502` [P0] **Payment Webhook Route Handler (`/api/checkout/callback`)**
  - Implement cryptographic HMAC-SHA256 signature verification.
  - Implement amount and currency matching against order record.
  - Implement idempotent handling using unique `transaction_id`.
- [ ] `TASK-503` [P0] **Automatic Ticket & QR Token Issuance**
  - Generate high-entropy 64-character `qr_token`.
  - Calculate server verification signature HMAC and transition order to `paid`.
  - Write transaction entry to `financial_ledger`.
  - Trigger transactional confirmation email with ticket link.

---

## Epic 6: Digital Ticketing & Public Rate-Limited Lookup

- [ ] `TASK-601` [P1] **Brutalist Ticket Presentation (`TicketView`)**
  - Design editorial boarding-pass pass in Light Sky Brutalist theme.
  - Render high-density QR code encoding verified `qr_token`.
  - Implement CSS print media queries for clean A4 and badge printing.
  - Add client-side PDF export button.
- [ ] `TASK-602` [P1] **Secure Public Ticket Lookup (`/ticket`)**
  - Implement public search interface by Registration ID or Normalized Mobile Number.
  - Wire database RPC `private.consume_ticket_lookup_rate_limit` (20 req/IP/min, 5 req/subject/min).
  - Mask sensitive personal info in search results.

---

## Epic 7: On-Site Operational Scanner Modules

- [ ] `TASK-701` [P1] **In-Browser Camera QR Code Decoder**
  - Integrate HTML5-QRCode / ZXing camera stream into Next.js client component.
  - Provide continuous autofocus and camera switching (rear/front).
- [ ] `TASK-702` [P1] **Gate Entry Scanner Module**
  - Wire `/api/scanner/verify-gate`.
  - Implement instant duplicate scan detection with prior timestamp and staff ID.
  - Add visual cues (Green / Red) and Web Audio API chimes (success ping / error buzzer).
  - Connect Supabase Realtime channel for multi-gate synchronization.
- [ ] `TASK-703` [P1] **Meal & Food Distribution Scanner Module**
  - Wire `/api/scanner/verify-food` for Breakfast, Lunch, Dinner.
  - Enforce server cutoff for Breakfast before 13:00 Dhaka time.
  - Prevent duplicate meal claims per registration ID.
- [ ] `TASK-704` [P1] **Dress / T-Shirt Distribution Module**
  - Wire `/api/scanner/verify-dress`.
  - Display attendee photo and registered T-shirt size (`S` to `Oversize 50`).
  - Log one-tap physical handover.
- [ ] `TASK-705` [P2] **Offline Scan Queuing with IndexedDB**
  - Implement local queue storage when scanner is offline.
  - Auto-flush queue via `/api/scanner/batch-sync` upon network reconnection.

---

## Epic 8: Financial Management & Staff Petty Cash Ledger

- [ ] `TASK-801` [P2] **Central Budget Management**
  - Super-admin interface to set total event budget and categorized spending limits.
- [ ] `TASK-802` [P2] **Staff Petty Cash Allocation**
  - Interface to disburse cash allocations to team leads.
- [ ] `TASK-803` [P2] **Staff Mobile Expense Submission**
  - Mobile interface for staff to log vendor expenses with camera receipt upload to `payment-receipts`.
- [ ] `TASK-804` [P2] **Expense Review Queue & Approval Workflow**
  - Two-tier approval dashboard for finance heads to approve, reject, or void expenses.
  - Compute real-time staff remaining balance.

---

## Epic 9: Executive Admin Dashboard & Tamper-Evident Audit Trail

- [ ] `TASK-901` [P2] **Real-Time Analytics Dashboard**
  - Real-time KPI summary: Total Registrations, Revenue Collected, Check-In Count, Meal Count.
- [ ] `TASK-902` [P2] **Attendee Roster & Management**
  - Filterable attendee table (by Batch, Category, Payment Status, Gate).
  - Manual override modal (with mandatory audit reason).
  - CSV / Excel export generator.
- [ ] `TASK-903` [P1] **Cryptographic Audit Trail Logging**
  - Automate logging of administrative mutations in `admin_audit_logs`.
  - Compute HMAC-SHA256 checksum server-side for each audit entry.

---

## Epic 10: Quality Assurance, Security Audit & Deployment

- [ ] `TASK-1001` [P1] **Automated Test Suite**
  - Write unit tests for fee calculation, phone number normalization, and rate limiting.
  - Write integration tests for payment webhook signature validation.
- [ ] `TASK-1002` [P1] **Playwright End-to-End Tests**
  - Simulate full registration, checkout redirect, webhook confirmation, and ticket display.
  - Simulate gate scanner check-in and duplicate detection.
- [ ] `TASK-1003` [P1] **Production Deployment on Vercel & Supabase**
  - Configure production environment variables and edge headers.
  - Verify TLS, CSP, CORS, and automated daily database backups.

