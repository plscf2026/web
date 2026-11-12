# RECOMMENDED ADMINISTRATIVE HIERARCHY & GOVERNANCE MODEL

**System:** Police Lines School & College, Faridpur — Grand Reunion 2026 / 2027 Management Platform  
**Audit Document:** Administrative Structure & Governance Framework  
**Auditor:** Senior Software Architect & Governance Specialist  

---

## 1. Executive Administrative Overview

The reunion management platform manages significant responsibilities:
- Approximately 5,000–10,000 alumni and student registrations.
- ৳1.5–2.5 Crore BDT in registration fees, patron sponsorships, and event expenditures.
- Turnstile gate entry, 3 distinct meal sessions (Breakfast, Lunch, Dinner), commemorative T-shirt handouts, and security incidents.
- 12 active executive sub-committees under the Reunion Secretariat.
- Production and gang-run printing of official 54×86mm CR80 student ID cards.

To safeguard financial integrity and operational efficiency, this document establishes a **Four-Tier Least-Privilege Administrative Hierarchy** that completely separates high-risk financial and system operations from field scanner tasks.

---

## 2. Recommended Four-Tier Administrative Hierarchy

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                               TIER 1: EXECUTIVE GOVERNANCE & SUPERVISION                         │
│                                      [Super Administrator]                                       │
│                                  [Convener & Member Secretary]                                   │
└────────────────────────────────────────────────┬─────────────────────────────────────────────────┘
                                                 │
                   ┌─────────────────────────────┴─────────────────────────────┐
                   ▼                                                           ▼
┌──────────────────────────────────────┐                   ┌──────────────────────────────────────┐
│  TIER 2: DOMAIN MANAGERS & OFFICERS  │                   │    TIER 2: COMMITTEE LEADERSHIP      │
│  - Finance Manager / Chief Accounts  │                   │  - Committee Directors               │
│  - Registration Secretariat Lead     │                   │  - Assistant Directors               │
│  - ID Card Production Supervisor     │                   │  - Sub-Committee Secretaries         │
└──────────────────┬───────────────────┘                   └──────────────────┬───────────────────┘
                   │                                                           │
                   ▼                                                           ▼
┌──────────────────────────────────────┐                   ┌──────────────────────────────────────┐
│  TIER 3: FIELD OPERATIONAL STAFF     │                   │    TIER 3: COMMITTEE MEMBERS         │
│  - Gate Entry Turnstile Staff        │                   │  - Appointed Alumni Members          │
│  - Meal Distribution Officers        │                   │  - Committee Volunteers              │
│  - Kit & T-Shirt Distribution Staff  │                   │                                      │
│  - ID Card Printing Technicians      │                   │                                      │
└──────────────────┬───────────────────┘                   └──────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│  TIER 4: FIELD VOLUNTEERS & RUNNERS  │
│  - Student Volunteers & Ushers       │
│  - Medical & Security Monitors       │
└──────────────────────────────────────┘
```

---

## 3. Role Definitions, Mandates & Scope of Authority

### Tier 1: Executive Governance

#### 1. Super Administrator (System Owner & Technical Lead)
- **Primary Mandate:** Total administrative authority, infrastructure governance, security configuration, and database policy oversight.
- **Allowed Access:** Full access across all 37 database tables, admin tabs, Edge Functions, and audit trails.
- **Creation Authority:** Can provision Tier 2 Admin accounts, assign department roles, configure fee structures, and modify database settings.
- **Strict Limitations:** Must operate under non-repudiation; all actions (especially deletions, role elevations, and ledger adjustments) automatically generate cryptographically signed entries in `admin_audit_logs`.
- **Requires Confirmation:** Any destructive action (deleting registration, purging audit log, resetting event phase) requires explicit two-step modal confirmation.

#### 2. Convener & Member Secretary (Executive Secretariat)
- **Primary Mandate:** Overall event leadership, budget approval, policy sanctioning, and external sponsor relationship management.
- **Allowed Access:** High-level dashboard views, comprehensive financial ledger summaries, committee task overviews, executive reports.
- **Creation Authority:** Signs off on committee budget requisitions, formal announcements, and executive circulars.
- **Restricted Access:** Cannot directly alter software source code, execute raw database queries, or modify cryptographic keys.

---

### Tier 2: Domain Managers & Officers

#### 3. Finance Manager / Chief Accounts Officer
- **Primary Mandate:** Authoritative management of registration revenue, merchant gateway balances, field budget allocations, and expense verification.
- **Allowed Access:** Financial ledger, payment reconciliation, donation records, staff budget allocations, committee expense receipts.
- **Creation / Edit Authority:** Can allocate operational cash to staff, record verified expense vouchers, and approve recommended budget requests.
- **Strict Limitations:**
  - Cannot alter student personal identity details (names, photos, graduation years).
  - Cannot delete registrations.
  - Cannot execute financial reversals without Super Admin counter-signature (Two-Person Rule / Maker-Checker control).

#### 4. Registration Manager / Secretariat Desk Lead
- **Primary Mandate:** Verification of attendee eligibility, student ID matching, category corrections, and attendee support.
- **Allowed Access:** Registration records (`registrations_2027`), verification queue, batch statistics, attendance roster.
- **Creation / Edit Authority:** Can correct misspelled attendee names, update contact phone numbers, correct assigned batch/passing years, and update T-shirt sizes before printing cutoffs.
- **Strict Limitations:**
  - Cannot mark an unpaid ticket as "Paid" without valid gateway transaction proof.
  - Cannot access bank account credentials, merchant gateway payout controls, or raw audit logs.

#### 5. ID Card Production Supervisor
- **Primary Mandate:** Oversight of student badge production, physical printing verification, batch packaging, and re-issuance management.
- **Allowed Access:** Student ID Card portal (`student_id_cards`), 9-cards-per-A4 gang-run PDF generator, hierarchical batch ZIP packaging.
- **Creation / Edit Authority:** Can trigger batch card rendering, flag incomplete records for review, and record card collection status.
- **Strict Limitations:** Cannot modify financial ledger or alter registration fees.

---

### Tier 3: Field Operational Staff (Department Isolated)

#### 6. Gate Entry Turnstile Staff (`GATE_STAFF`)
- **Primary Mandate:** Fast-throughput ticket QR scanning at campus entry gates.
- **Allowed Access:** Gate scanner portal only (`GateScannerModule.tsx`).
- **Station Scope:** Restricted to assigned gate (e.g. `Gate 01 - Main Entrance`).
- **Data Access:** Sees only attendee photo, full name, batch, and verified badge. Contact numbers, home addresses, and financial amounts are redacted.
- **Restricted Actions:** Cannot approve food meals, hand out T-shirts, or edit records.

#### 7. Meal Distribution Officers (`BREAKFAST_STAFF`, `LUNCH_STAFF`, `DINNER_STAFF`)
- **Primary Mandate:** Verification and redemption of meal coupons at dining pavilions.
- **Department Isolation:** Strictly bound to assigned meal type. Breakfast staff cannot approve Lunch or Dinner.
- **Automatic Safeguards:** System blocks second collection for the same meal type (`ALREADY_DISTRIBUTED`) and enforces meal timing cutoffs (e.g. Breakfast cutoff at 1:00 PM BD time).

#### 8. Dress & Kit Distribution Staff (`DRESS_STAFF`)
- **Primary Mandate:** Verification and handout of official commemorative T-shirts and delegate bags.
- **Allowed Access:** Dress scanner module (`DressScannerModule.tsx`).
- **Verification Rule:** Displays attendee's registered size (`XS` to `Oversize 50`). Enforces single-collection rule.

---

## 4. The "Maker-Checker" (Two-Person) Rule for Sensitive Operations

To prevent fraud and catastrophic human error, the following operations require **Maker-Checker** dual authorization:

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 MAKER-CHECKER WORKFLOW MATRIX                                   │
├───────────────────────────────┬───────────────────────────┬─────────────────────────────────────┤
│ Operation                     │ Initiator (Maker)         │ Authorizer (Checker)                │
├───────────────────────────────┼───────────────────────────┼─────────────────────────────────────┤
│ Financial Reversal / Refund   │ Finance Manager           │ Super Administrator                 │
│ Committee Budget Request      │ Committee Director        │ Finance Officer -> Convener         │
│ Attendee Record Deletion      │ Registration Manager      │ Super Administrator                 │
│ Offline Payment Validation    │ Registration Desk Staff   │ Finance Manager                     │
│ Bulk ID Card Batch Download   │ ID Card Staff             │ ID Card Supervisor                  │
│ Staff Role Provisioning       │ Department Head           │ Super Administrator                 │
└───────────────────────────────┴───────────────────────────┴─────────────────────────────────────┘
```

---

## 5. Audit Logging & Non-Repudiation Policy

Every administrative action that modifies state must record a permanent, non-deletable audit log in `public.admin_audit_logs`:
1. **Immutable Log Entries:** Table has RLS policy denying UPDATE and DELETE to all users (even Super Admin).
2. **Cryptographic Checksum:** Each log entry computes a SHA-256 HMAC checksum across `(id, adminId, action, targetType, targetId, details, timestamp)`. If an attacker directly alters database rows, the checksum verification fails, indicating tampering.
3. **Mandatory Logging Operations:**
   - `ADMIN_LOGIN` / `ADMIN_LOGOUT`
   - `PAYMENT_VERIFIED_MANUAL`
   - `REGISTRATION_UPDATED` / `REGISTRATION_DELETED`
   - `BUDGET_APPROVED` / `EXPENSE_RECORDED`
   - `FINANCIAL_REVERSAL`
   - `ID_CARD_GENERATED` / `ID_CARD_BATCH_DOWNLOAD`
   - `STAFF_PROVISIONED` / `STAFF_DEACTIVATED`

