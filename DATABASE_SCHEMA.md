# Database Schema Specification
## Sylhet Police Lines High School & College Reunion 2027

---

## 1. Schema Overview
The Reunion Management System (RMS) database is designed for PostgreSQL 15+ hosted on Supabase. It features 15+ normalized relational tables enforcing referential integrity, check constraints, UUID primary keys, and automated audit tracking.

---

## 2. Table Definitions

### 2.1 `rms_users`
Stores administrative identities and leadership accounts.
```sql
CREATE TABLE rms_users (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN (
        'SUPER_ADMIN', 'CHIEF_ADVISER', 'CONVENER', 'MEMBER_SECRETARY',
        'COMMITTEE_DIRECTOR', 'ASSISTANT_DIRECTOR', 'COMMITTEE_MEMBER',
        'FINANCE_OFFICER', 'VOLUNTEER'
    )),
    committee_id TEXT,
    avatar_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
```

### 2.2 `rms_committees`
Stores the dynamic configuration of all 12 sub-committees.
```sql
CREATE TABLE rms_committees (
    id TEXT PRIMARY KEY,
    name_en TEXT NOT NULL,
    name_bn TEXT NOT NULL,
    description_en TEXT NOT NULL,
    description_bn TEXT NOT NULL,
    director_id TEXT REFERENCES rms_users(id),
    director_name TEXT NOT NULL,
    director_phone TEXT NOT NULL,
    director_email TEXT NOT NULL,
    assigned_responsibilities TEXT[] NOT NULL DEFAULT '{}',
    budget_total NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    budget_allocated NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    budget_spent NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    meeting_day TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
```

### 2.3 `rms_committee_members`
Stores member and assistant director assignments.
```sql
CREATE TABLE rms_committee_members (
    id TEXT PRIMARY KEY,
    committee_id TEXT NOT NULL REFERENCES rms_committees(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES rms_users(id),
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    role_in_committee TEXT NOT NULL CHECK (role_in_committee IN (
        'DIRECTOR', 'ASSISTANT_DIRECTOR', 'MEMBER', 'ADVISER'
    )),
    assigned_tasks_count INTEGER NOT NULL DEFAULT 0,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
```

### 2.4 `rms_tasks`
Stores committee action items, milestones, priorities, and deliverable review status.
```sql
CREATE TABLE rms_tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    committee_id TEXT NOT NULL REFERENCES rms_committees(id),
    committee_name TEXT NOT NULL,
    assigned_member_id TEXT,
    assigned_member_name TEXT NOT NULL,
    created_by TEXT NOT NULL REFERENCES rms_users(id),
    created_by_name TEXT NOT NULL,
    start_date DATE NOT NULL,
    deadline DATE NOT NULL,
    priority TEXT NOT NULL CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    status TEXT NOT NULL CHECK (status IN (
        'ASSIGNED', 'IN_PROGRESS', 'REVIEW_REQUESTED', 'COMPLETED', 'BLOCKED'
    )),
    completion_evidence TEXT,
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    attachments TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
```

### 2.5 `rms_budget_requests`
Stores committee budget requisition requests through the 3-step approval workflow.
```sql
CREATE TABLE rms_budget_requests (
    id TEXT PRIMARY KEY,
    committee_id TEXT NOT NULL REFERENCES rms_committees(id),
    committee_name TEXT NOT NULL,
    request_title TEXT NOT NULL,
    expense_category TEXT NOT NULL,
    requested_amount NUMERIC(12, 2) NOT NULL CHECK (requested_amount > 0),
    description TEXT NOT NULL,
    supporting_documents TEXT[] NOT NULL DEFAULT '{}',
    requested_by TEXT NOT NULL REFERENCES rms_users(id),
    requested_by_name TEXT NOT NULL,
    request_date DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN (
        'DRAFT', 'SUBMITTED', 'FINANCE_REVIEWED', 'RECOMMENDED', 'APPROVED', 'REJECTED'
    )),
    finance_reviewer_id TEXT,
    finance_reviewer_name TEXT,
    finance_comments TEXT,
    approved_by TEXT,
    approved_by_name TEXT,
    approved_amount NUMERIC(12, 2),
    approval_date TIMESTAMPTZ,
    rejection_reason TEXT
);
```

### 2.6 `rms_expenses`
Stores verified operational disbursements and mandatory reversal audit references.
```sql
CREATE TABLE rms_expenses (
    id TEXT PRIMARY KEY,
    committee_id TEXT NOT NULL REFERENCES rms_committees(id),
    committee_name TEXT NOT NULL,
    expense_title TEXT NOT NULL,
    expense_category TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    payment_method TEXT NOT NULL CHECK (payment_method IN (
        'CASH', 'BKASH', 'NAGAD', 'BANK_TRANSFER', 'CHEQUE'
    )),
    vendor TEXT NOT NULL,
    expense_date DATE NOT NULL,
    voucher_number TEXT NOT NULL UNIQUE,
    receipt_url TEXT,
    submitted_by TEXT NOT NULL REFERENCES rms_users(id),
    submitted_by_name TEXT NOT NULL,
    verification_status TEXT NOT NULL CHECK (verification_status IN (
        'PENDING_VERIFICATION', 'VERIFIED', 'FLAGGED', 'REVERSED'
    )),
    verified_by TEXT,
    verified_by_name TEXT,
    reversal_reason TEXT,
    reversal_authorized_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
```

### 2.7 `rms_sponsors` & `rms_sponsor_benefits`
Stores sponsorship CRM records and benefit delivery tracking.
```sql
CREATE TABLE rms_sponsors (
    id TEXT PRIMARY KEY,
    company_name TEXT NOT NULL,
    contact_person TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    address TEXT,
    category TEXT NOT NULL CHECK (category IN (
        'TITLE_SPONSOR', 'PLATINUM', 'GOLD', 'SILVER', 'SUPPORTING', 'MEDIA_PARTNER', 'OTHER_PARTNER'
    )),
    proposed_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    agreed_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    received_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    payment_status TEXT NOT NULL CHECK (payment_status IN ('NOT_PAID', 'PARTIAL', 'PAID_FULL')),
    agreement_document_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE rms_sponsor_benefits (
    id TEXT PRIMARY KEY,
    sponsor_id TEXT NOT NULL REFERENCES rms_sponsors(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('LOGO', 'STAGE', 'BANNER', 'SOCIAL', 'BOOTH', 'VIP_PASS')),
    is_delivered BOOLEAN NOT NULL DEFAULT false,
    notes TEXT
);
```

### 2.8 `rms_documents`
Stores committee documents with encrypted paths and access boundaries.
```sql
CREATE TABLE rms_documents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    committee_id TEXT NOT NULL REFERENCES rms_committees(id),
    committee_name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN (
        'OFFICIAL_LETTERS', 'PERMISSION_DOCUMENTS', 'MEETING_MINUTES',
        'BUDGET_PROPOSALS', 'BILLS_VOUCHERS', 'SPONSORSHIP_AGREEMENTS',
        'EVENT_DESIGNS', 'VENDOR_AGREEMENTS', 'PHOTOS_VIDEOS', 'OTHER'
    )),
    file_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    file_type TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    uploaded_by TEXT NOT NULL REFERENCES rms_users(id),
    uploaded_by_name TEXT NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    access_permission TEXT NOT NULL CHECK (access_permission IN ('PUBLIC', 'COMMITTEE_ONLY', 'CENTRAL_ONLY'))
);
```

### 2.9 `rms_meetings`
Stores scheduled meetings, attendees, minutes, and follow-up tasks.
```sql
CREATE TABLE rms_meetings (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    committee_id TEXT REFERENCES rms_committees(id),
    committee_name TEXT,
    is_central_meeting BOOLEAN NOT NULL DEFAULT false,
    meeting_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    venue TEXT NOT NULL,
    agenda TEXT[] NOT NULL DEFAULT '{}',
    decisions TEXT[] NOT NULL DEFAULT '{}',
    minutes_document_url TEXT,
    created_by TEXT NOT NULL REFERENCES rms_users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
```

### 2.10 `rms_volunteers`
Stores the field volunteer duty roster and live check-in telemetry.
```sql
CREATE TABLE rms_volunteers (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    assigned_committee_id TEXT NOT NULL REFERENCES rms_committees(id),
    assigned_location TEXT NOT NULL,
    assigned_date DATE NOT NULL,
    duty_start_time TIME NOT NULL,
    duty_end_time TIME NOT NULL,
    supervisor_name TEXT NOT NULL,
    supervisor_phone TEXT NOT NULL,
    attendance_status TEXT NOT NULL CHECK (attendance_status IN ('PENDING', 'CHECKED_IN', 'COMPLETED', 'ABSENT')),
    check_in_time TIMESTAMPTZ,
    check_out_time TIMESTAMPTZ,
    responsibilities TEXT[] NOT NULL DEFAULT '{}',
    emergency_contact_name TEXT NOT NULL,
    emergency_contact_relation TEXT NOT NULL,
    emergency_contact_phone TEXT NOT NULL
);
```

### 2.11 `rms_incidents`
Stores event-day incident reports and resolution tracking.
```sql
CREATE TABLE rms_incidents (
    id TEXT PRIMARY KEY,
    incident_type TEXT NOT NULL CHECK (incident_type IN (
        'MEDICAL', 'SECURITY', 'TECHNICAL', 'CROWD_MANAGEMENT', 'FOOD_BEVERAGE', 'LOST_FOUND', 'OTHER'
    )),
    severity TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    location TEXT NOT NULL,
    description TEXT NOT NULL,
    reported_by TEXT NOT NULL,
    reported_by_name TEXT NOT NULL,
    reported_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    assigned_team TEXT NOT NULL,
    assigned_responder TEXT,
    resolution_status TEXT NOT NULL CHECK (resolution_status IN (
        'REPORTED', 'DISPATCHED', 'IN_PROGRESS', 'RESOLVED'
    )),
    resolution_notes TEXT,
    resolved_at TIMESTAMPTZ
);
```

### 2.12 `rms_weekly_reports`
Stores committee weekly progress submissions.
```sql
CREATE TABLE rms_weekly_reports (
    id TEXT PRIMARY KEY,
    committee_id TEXT NOT NULL REFERENCES rms_committees(id),
    committee_name TEXT NOT NULL,
    director_id TEXT NOT NULL REFERENCES rms_users(id),
    director_name TEXT NOT NULL,
    report_week_number INTEGER NOT NULL,
    report_date DATE NOT NULL,
    work_completed TEXT[] NOT NULL DEFAULT '{}',
    work_in_progress TEXT[] NOT NULL DEFAULT '{}',
    work_pending TEXT[] NOT NULL DEFAULT '{}',
    problems_encountered TEXT NOT NULL DEFAULT '',
    budget_spent NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    upcoming_activities TEXT[] NOT NULL DEFAULT '{}',
    support_required TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL CHECK (status IN (
        'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REVISION_REQUESTED'
    )),
    reviewer_comments TEXT,
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ
);
```

### 2.13 `rms_audit_logs`
Stores immutable system-wide audit entries.
```sql
CREATE TABLE rms_audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    user_role TEXT NOT NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL CHECK (entity_type IN (
        'COMMITTEE', 'TASK', 'BUDGET', 'EXPENSE', 'SPONSOR', 'DOCUMENT',
        'MEETING', 'VOLUNTEER', 'INCIDENT', 'REPORT', 'AUTH', 'SYSTEM'
    )),
    entity_id TEXT NOT NULL,
    previous_value TEXT,
    new_value TEXT,
    details TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
```

