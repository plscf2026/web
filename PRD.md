# Product Requirements Document (PRD)
## Police Lines School & College Faridpur — Reunion 2026 Platform
### Design System: Raw Form (Light Sky Brutalist Edition)
### Core Stack: Next.js (App Router) + Supabase (PostgreSQL, Auth, RLS, Storage)

---

## 1. Executive Summary & Vision

Police Lines School & College Faridpur (PLSCF, Est. 1962) is celebrating its grand **Reunion 2026**. This platform serves as the official bilingual (**বাংলা ও English**) digital ecosystem for attendee registration, secure online payments, instant digital ticketing with tamper-evident QR verification, multi-gate on-site check-in, meal & dress fulfillment, and end-to-end event financial management.

Built with **Next.js 15 (App Router)** and backed by **Supabase (PostgreSQL with strict Row Level Security, Auth, Storage, and Edge Functions)**, the platform pairs mission-critical enterprise reliability with **Raw Form (Light Sky Brutalist Edition)**—a high-contrast, editorial Swiss Brutalist design language featuring massive typography breaks, light sky paper backgrounds, electric azure accents, and smooth organic animations.

---

## 2. Problem Statement & Strategic Goals

### Current Limitations Identified
- Prior legacy single-page prototype relied on client-side state (`localStorage`), lacked atomic database writes, had no server-side QR decoding, and had payment processing completely stubbed out (returning 503).
- Registration photos were kept as multi-megabyte base64 strings in memory instead of persistent Supabase Storage buckets.
- Concurrent user operations, multi-device gate check-ins, and financial records were vulnerable to race conditions without server-authoritative ledger models.

### Primary Objectives
1. **Frictionless Public Onboarding**: Deliver a blazing-fast, bilingual registration flow that handles thousands of concurrent alumni and student registrations without latency or dropped submissions.
2. **Server-Authoritative Payment Engine**: Implement an end-to-end, production-ready payment flow (integrated with PayStation / SSLCommerz / bKash merchant gateways) with cryptographic signature validation, idempotent callbacks, and automatic ticket generation.
3. **High-Throughput On-Site Verification**: Provide zero-friction, camera-enabled QR scanner modules for Gate Entry, Food Distribution (Breakfast, Lunch, Dinner with strict time windows), and Dress/T-Shirt distribution.
4. **Transparent Event Ledger & Expense Tracking**: Real-time budget monitoring, staff fund allocations, vendor expense submissions with receipt uploads, and an immutable admin audit log.
5. **Distinctive Editorial Brand Experience**: Immerse alumni in a striking, culturally grounded Swiss Brutalist aesthetic engineered specifically for high readability and visual impact.

---

## 3. Target User Personas

| Persona | Role & Description | Core Needs & Goals |
|---|---|---|
| **Alumnus / Alumna (Ex-Student)** | Former students across batches (1962–2025) residing locally and internationally. | Simple registration, batch selection, instant bKash/Nagad/Card payment, downloadable digital ticket with QR code. |
| **Current Student** | Enrolled students eligible for subsidized or student-rate access. | Student ID verification, batch/class validation, nominal fee processing, and ticket generation. |
| **Teacher / Honorable Guest** | Current and retired faculty members and VIP dignitaries. | Dedicated VIP registration, complimentary pass issuance, and special seating badge generation. |
| **Gate / Scanner Staff** | On-site event volunteers operating smartphones or handheld barcode scanners. | Instant camera QR code decoding, offline-resilient local sync, duplicate check-in prevention, and attendee photo display. |
| **Logistics & Food Staff** | Volunteers managing merchandise counters and meal distributions. | T-shirt size verification, meal entitlement enforcement (Breakfast cutoff before 13:00 Dhaka time), one-tap fulfillment logging. |
| **Finance Manager / Volunteer** | Staff members holding cash advances for event procurement. | Logging expenses, uploading merchant receipts, tracking remaining cash balance, submitting refund ledgers. |
| **Super Admin / Steering Committee** | School principal and event steering committee heads. | System configuration, fee management, financial approvals, ticket invalidation/reissue, and tamper-evident audit trails. |

---

## 4. Functional Requirements & Feature Modules

### 4.1. Public Landing & Information Architecture
- **Raw Form Hero Showcase**: Typographic hero utilizing *Clash Display* at massive viewport scale (`18vw`), animated Light Sky atmospheric blobs, dynamic live registration counter, and primary brutalist call-to-actions.
- **Bilingual Internationalization (i18n)**: Instant client- and server-side language switching between English and Bangla (`বাংলা`). All legal terms, notices, form labels, and tickets must be localized.
- **Live Event Countdown & Timeline**: Interactive agenda detailing morning assembly, campus rally, reminiscence sessions, lunch, cultural gala, and closing fireworks.
- **Official Notice Board & Press Releases**: Searchable, categorised event notices and guidelines with downloadable attachments.
- **Archival Photo Gallery**: Interactive photo mosaic celebrating PLSCF's 64-year history, with batch-wise filters.
- **Inquiry & Support Desk**: Server-action backed contact form with Supabase persistence and spam rate-limiting.

### 4.2. Registration Engine & Pricing Matrix
- **Tiered Attendee Categories**:
  - *Alumni (Single)*: Base fee (e.g., ৳1,500 BDT).
  - *Alumni (With Spouse / Child)*: Dynamic guest surcharge per additional attendee.
  - *Current Student*: Subsidized fee (e.g., ৳500 BDT) validated against pre-seeded or verified student ID database.
  - *Teacher / Dignitary*: Honorary (৳0 BDT).
  - *Optional Voluntary Contribution*: Custom donation amount added directly to checkout invoice.
- **Form Data Capture**:
  - Full Name (English & Bangla), Mobile Number (Bangladeshi 11-digit regex validated: `^(?:\+?88)?01[3-9]\d{8}$`), Email Address (optional), National ID / Birth Certificate number (optional).
  - Passing Year / Batch (1962–2025) or Current Class (Class 6–12).
  - T-Shirt / Merchandise Size: `S`, `M`, `L`, `XL`, `XXL`, `XXXL`, `Oversize 50`.
  - Profile Photo Upload: Direct-to-Supabase Storage with client-side image compression (max 2 MB), MIME-type verification, and secure public/authenticated CDN URL storage.

### 4.3. Payment Processing & Gateway Pipeline
- **Merchant Gateway Integration**: PayStation Sandbox & Production APIs (with automated fallback to SSLCommerz / bKash direct API).
- **Server-Authoritative Flow**:
  1. Client submits validated registration payload to Next.js Route Handler `/api/checkout/initiate`.
  2. Server generates unique `order_id` (e.g., `PLSCF26-ORD-XXXXX`), calculates immutable fee server-side, and writes a `pending` registration record.
  3. Server invokes Gateway API and returns secure redirection URL to client.
  4. Upon transaction completion, payment gateway calls server webhook `/api/checkout/callback`.
  5. Webhook verifies cryptographic hash/signature using gateway secret, confirms exact paid amount against order record, transitions status to `paid`, generates a high-entropy `qr_token`, and seals the record with an HMAC signature.
- **Idempotency & Replay Protection**: Strict prevention of double ticketing or duplicate transaction processing using Postgres unique constraints on `transaction_id`.

### 4.4. Digital Ticketing & Public Ticket Retrieval
- **Digital Pass Presentation (`TicketView`)**:
  - Brutalist boarding-pass layout featuring high-contrast typography, attendee portrait, registered batch, assigned gate, and high-density QR code.
  - Direct print stylesheet optimization (A4 / 4x6 thermal badge) and one-click PDF generation.
- **Secure Public Ticket Lookup**:
  - Searchable by Registration ID or Normalized Mobile Number without requiring user login.
  - Protected by database-backed IP and subject rate-limiting (e.g., max 5 attempts per subject / 20 attempts per IP per minute).
  - Returns only payment-verified passes; masks sensitive PII.
- **Automated Ticket Delivery**: Asynchronous transactional email dispatch containing ticket PDF and QR pass link.

### 4.5. On-Site Operations & Scanner Suite
- **Gate Check-In Module**:
  - In-browser live camera stream using ZXing / HTML5-QRCode decoder for instant QR scanning.
  - Instant duplicate scan detection (flags previously checked-in passes with exact timestamp and staff ID).
  - Offline-first cache syncing with Supabase Realtime channel.
- **Meal & Food Distribution Module**:
  - Tracks individual entitlements: Breakfast, Lunch, Dinner.
  - Enforces operational business rules (e.g., Breakfast distribution closed strictly at 13:00 Dhaka time).
  - Prevents multi-serving fraud with immediate visual feedback (Green = Verified, Red = Already Collected, Yellow = Invalid).
- **Dress / Merchandise Fulfillment Module**:
  - Displays registered T-shirt size (`S` to `Oversize 50`).
  - Logs hand-over timestamp, distribution counter ID, and volunteer sign-off.

### 4.6. Budget, Expense Ledger & Staff Petty Cash
- **Central Event Budget**: Configured by Super Admin with categorized expenditure limits (Catering, Stage/Sound, Merchandise, Security, Media).
- **Staff Petty Cash Allocation**: Allocation of cash disbursements to authorized team leads.
- **Expense Logging & Receipts**: Staff upload receipt photos directly to `payment-receipts` bucket and submit vendor name, category, and BDT amount.
- **Two-Tier Approval Workflow**: Admin review, approval, or voiding with automated ledger rebalancing.

### 4.7. Administration, Analytics & Auditing
- **Executive Dashboard**: Real-time KPI cards for Total Registrations, Batch-wise breakdown, Gross Collections, Meal consumption rates, and Dress collection stats.
- **Attendee Roster Management**: Filtering, manual verification overrides (with audit reasons), CSV/Excel data exports.
- **Immutable Audit Trail (`admin_audit_logs`)**: Cryptographic record of every administrative intervention (fee modification, manual check-in, expense approval) signed with HMAC-SHA256.

---

## 5. Non-Functional Requirements (NFRs)

### 5.1. Performance & Latency
- First Contentful Paint (FCP) < 1.0s; Largest Contentful Paint (LCP) < 2.0s on standard 4G networks.
- QR verification API response time < 250ms under peak load (up to 1,000 requests/minute during morning gate opening).
- Optimistic UI updates for scanner operators with background synchronization.

### 5.2. Security & Compliance
- **Zero Client-Side Trust**: Client applications never compute ticket validity, fees, or admin privileges. All security boundaries enforced via Postgres Row Level Security (RLS) and Server Actions.
- **Rate-Limiting**: Edge-level rate limiting on public ticket search and contact submission.
- **Data Protection**: Personal contact numbers and payment reference IDs encrypted or masked in public-facing interfaces.
- **Cross-Site Scripting (XSS) & CSRF Defense**: Sanitized inputs, strict Content Security Policy (CSP), and SameSite cookie tokens for authenticated staff.

### 5.3. Reliability & Offline Resilience
- Progressive Web App (PWA) manifest support for scanner terminals on mobile devices.
- Supabase Realtime fallback to polling when intermittent campus Wi-Fi fluctuates.
- Graceful degradation: scanner queues offline scans in IndexedDB and flushes upon reconnection.

---

## 6. Success Metrics & Key Performance Indicators (KPIs)

1. **Registration Conversion**: > 98% successful checkout completion rate for initiated payments.
2. **Scanner Throughput**: < 3 seconds average queue time per attendee at physical entry gates.
3. **Food Distribution Accuracy**: Zero reported duplicate meals served per registered ticket token.
4. **Data Integrity**: 100% audit log coverage for administrative actions with verified checksums.
5. **System Availability**: 99.9% uptime throughout the 48-hour peak event window.

