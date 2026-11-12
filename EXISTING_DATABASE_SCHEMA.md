# Existing Database Schema & Entity Structure
## Police Lines High School & College, Faridpur Reunion Platform

---

## 1. Overview
The platform utilizes a consolidated PostgreSQL database schema on Supabase paired with synchronized local cache persistence. `public.registrations_2027` is the authoritative, primary registration table for all student registrations, payments, QR verification, and ID cards. The legacy `registrations_2026` table has been permanently removed after completing data consolidation.

---

## 2. Table Definitions

### 2.1 `registrations_2027` (Consolidated Primary Registration Table)
Stores verified online and on-spot attendee registrations for the Grand Reunion 2027.
```sql
CREATE TABLE registrations_2027 (
    id TEXT PRIMARY KEY,                       -- e.g. 'PLSCF-2027-F8472'
    full_name TEXT NOT NULL,
    full_name_bn TEXT,
    photo_url TEXT NOT NULL,                   -- Compressed JPEG data URL or Storage URI (<200KB)
    mobile_number TEXT NOT NULL,               -- Validated 11-digit Bangladeshi mobile
    email TEXT,                                -- Optional attendee email
    address TEXT,
    category TEXT NOT NULL CHECK (category IN ('former', 'current')),
    student_id TEXT,                           -- Mandatory verified ID for current students
    passing_year TEXT,                         -- e.g. '1998', '2012' for former students
    last_class_attended TEXT,                  -- Optional for students who left before SSC
    current_class TEXT,                        -- e.g. 'Class 10', 'Class 12'
    batch_name TEXT NOT NULL,                  -- e.g. 'SSC 1998', 'HSC 2014'
    group_or_section TEXT,
    roll_number TEXT,
    t_shirt_size TEXT NOT NULL CHECK (t_shirt_size IN ('XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'Oversize 50')),
    registration_fee NUMERIC(10, 2) NOT NULL DEFAULT 1000.00,
    donation_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    total_paid NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('paid', 'pending', 'refunded', 'failed')),
    transaction_id TEXT,
    payment_method TEXT CHECK (payment_method IN ('bkash', 'nagad', 'rocket', 'card')),
    gateway_invoice_number TEXT,
    gateway_provider TEXT DEFAULT 'PAYSTATION',
    gateway_response JSONB DEFAULT '{}'::jsonb,
    server_verification_signature TEXT,
    verification_timestamp TIMESTAMPTZ,
    verified_by TEXT,
    registered_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    qr_token TEXT NOT NULL UNIQUE,
    is_tshirt_collected BOOLEAN NOT NULL DEFAULT false,
    is_checked_in BOOLEAN NOT NULL DEFAULT false,
    notes TEXT,
    year INTEGER NOT NULL DEFAULT 2027,
    is_demo BOOLEAN NOT NULL DEFAULT false,
    is_legacy BOOLEAN NOT NULL DEFAULT false,
    migration_source TEXT,
    legacy_source_year INTEGER
);

CREATE INDEX idx_reg_2027_mobile ON registrations_2027 (mobile_number);
CREATE INDEX idx_reg_2027_trx ON registrations_2027 (transaction_id);
CREATE INDEX idx_reg_2027_qr ON registrations_2027 (qr_token);
CREATE INDEX idx_reg_2027_status ON registrations_2027 (payment_status);
CREATE INDEX idx_reg_2027_gateway_inv ON registrations_2027 (gateway_invoice_number);
CREATE UNIQUE INDEX uq_registrations_2027_mobile_normalized ON registrations_2027 (
  (CASE
    WHEN regexp_replace(mobile_number, '[^0-9]', '', 'g') LIKE '880%'
      THEN '0' || substr(regexp_replace(mobile_number, '[^0-9]', '', 'g'), 4)
    ELSE regexp_replace(mobile_number, '[^0-9]', '', 'g')
  END)
) WHERE mobile_number IS NOT NULL AND mobile_number <> '';
```

### 2.2 `donations_YYYY`
Stores voluntary alumni financial donations.
```sql
CREATE TABLE donations_2026 (
    id TEXT PRIMARY KEY,
    donor_name TEXT NOT NULL,
    donor_name_bn TEXT,
    batch_name TEXT NOT NULL,
    passing_year TEXT,
    mobile_number TEXT NOT NULL,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    payment_method TEXT NOT NULL,
    transaction_id TEXT NOT NULL,
    payment_status TEXT NOT NULL DEFAULT 'paid',
    donated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    is_anonymous BOOLEAN NOT NULL DEFAULT false,
    message TEXT
);
```

### 2.3 `expenses_YYYY`
Stores operational expenditures.
```sql
CREATE TABLE expenses_2026 (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    reason TEXT NOT NULL,
    spent_by TEXT NOT NULL,
    expense_date DATE NOT NULL,
    receipt_number TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
```

### 2.4 `scan_logs_YYYY`
Stores live physical event gate and token scan telemetry.
```sql
CREATE TABLE scan_logs_2026 (
    id TEXT PRIMARY KEY,
    registration_id TEXT NOT NULL,
    student_name TEXT NOT NULL,
    student_category TEXT NOT NULL,
    scan_type TEXT NOT NULL CHECK (scan_type IN ('entry', 'exit')),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    scanned_by TEXT NOT NULL,
    gate_number TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('approved', 'rejected')),
    rejection_reason TEXT
);
```

### 2.5 `student_id_inventory`
Stores the active roster of current institutional students for registration validation.
```sql
CREATE TABLE student_id_inventory (
    student_id TEXT PRIMARY KEY,
    student_name TEXT NOT NULL,
    current_class TEXT NOT NULL,
    section TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('AVAILABLE', 'RESERVED', 'ALREADY_USED', 'INACTIVE')),
    reserved_until TIMESTAMPTZ,
    used_at TIMESTAMPTZ,
    registration_id TEXT
);
```

### 2.6 `admin_users`
Stores authorized administrative accounts with single-slot active session tokens.
```sql
CREATE TABLE admin_users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'ADMIN',
    active_session_token TEXT,
    last_heartbeat TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
```

### 2.7 `rms_*` (Reunion Management ERP Tables)
- `rms_users`: Executive personas and committee directors.
- `rms_committees`: 12 dynamic sub-committees with budgets and responsibilities.
- `rms_committee_members`: Member rosters and cross-committee allocations.
- `rms_tasks`: Task lifecycle board (`ASSIGNED`, `IN_PROGRESS`, `REVIEW_REQUESTED`, `COMPLETED`, `BLOCKED`).
- `rms_budget_requests`: 3-stage budget approvals.
- `rms_expenses`: Operational disbursements with mandatory audit reversals.
- `rms_income_transactions`: Inflow ledger tracking registration fees and sponsorships.
- `rms_sponsors` & `rms_sponsor_benefits`: Corporate partner CRM.
- `rms_documents`: Committee document archive with role boundaries.
- `rms_meetings`: Meeting scheduler, roll call, and minutes archive.
- `rms_volunteers`: Duty rosters and shift check-ins.
- `rms_incidents`: Live incident reporting and resolution desk.
- `rms_weekly_reports`: Committee weekly progress submissions.
- `rms_audit_logs`: Immutable compliance audit trail.

