-- ============================================================================
-- SYLHET POLICE LINES HIGH SCHOOL & COLLEGE REUNION 2027
-- REUNION MANAGEMENT SYSTEM (RMS) - COMPLETE ENTERPRISE ERP SCHEMA
-- Migration: 20270101000000_reunion_management_erp_schema.sql
-- ============================================================================

-- 1. COMMITTEES TABLE (Dynamic, not hardcoded)
CREATE TABLE IF NOT EXISTS public.rms_committees (
  id TEXT PRIMARY KEY,
  name_en TEXT NOT NULL,
  name_bn TEXT NOT NULL,
  description_en TEXT,
  description_bn TEXT,
  director_id TEXT NOT NULL,
  director_name TEXT NOT NULL,
  director_phone TEXT,
  director_email TEXT,
  assistant_director_names TEXT[] DEFAULT '{}',
  assigned_responsibilities TEXT[] DEFAULT '{}',
  budget_total NUMERIC NOT NULL DEFAULT 0 CHECK (budget_total >= 0),
  budget_allocated NUMERIC NOT NULL DEFAULT 0 CHECK (budget_allocated >= 0),
  budget_spent NUMERIC NOT NULL DEFAULT 0 CHECK (budget_spent >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  meeting_day TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rms_committees_active ON public.rms_committees(is_active);

-- 2. COMMITTEE MEMBERS TABLE
CREATE TABLE IF NOT EXISTS public.rms_committee_members (
  id TEXT PRIMARY KEY DEFAULT ('MEM-' || substr(gen_random_uuid()::text, 1, 8)),
  committee_id TEXT NOT NULL REFERENCES public.rms_committees(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  mobile_number TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('DIRECTOR', 'ASSISTANT_DIRECTOR', 'MEMBER', 'COORDINATOR')),
  assigned_responsibilities TEXT[] DEFAULT '{}',
  joined_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'TRANSFERRED', 'INACTIVE')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rms_comm_members_committee ON public.rms_committee_members(committee_id);
CREATE INDEX IF NOT EXISTS idx_rms_comm_members_role ON public.rms_committee_members(role);

-- 3. TASKS TABLE (Kanban, Table & Calendar Views)
CREATE TABLE IF NOT EXISTS public.rms_tasks (
  id TEXT PRIMARY KEY DEFAULT ('TSK-' || substr(gen_random_uuid()::text, 1, 8)),
  title TEXT NOT NULL,
  description TEXT,
  committee_id TEXT NOT NULL REFERENCES public.rms_committees(id) ON DELETE CASCADE,
  committee_name TEXT NOT NULL,
  assigned_member_id TEXT,
  assigned_member_name TEXT,
  created_by TEXT NOT NULL,
  created_by_name TEXT NOT NULL,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  deadline DATE NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN (
    'PENDING', 'ASSIGNED', 'IN_PROGRESS', 'UNDER_REVIEW', 'COMPLETED', 'REJECTED', 'ON_HOLD', 'CANCELLED'
  )),
  completion_evidence TEXT,
  rejection_reason TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rms_tasks_committee ON public.rms_tasks(committee_id);
CREATE INDEX IF NOT EXISTS idx_rms_tasks_status ON public.rms_tasks(status);
CREATE INDEX IF NOT EXISTS idx_rms_tasks_priority ON public.rms_tasks(priority);
CREATE INDEX IF NOT EXISTS idx_rms_tasks_deadline ON public.rms_tasks(deadline);

-- 4. TASK COMMENTS TABLE
CREATE TABLE IF NOT EXISTS public.rms_task_comments (
  id TEXT PRIMARY KEY DEFAULT ('CMT-' || substr(gen_random_uuid()::text, 1, 8)),
  task_id TEXT NOT NULL REFERENCES public.rms_tasks(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_role TEXT NOT NULL,
  content TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rms_task_comments_task ON public.rms_task_comments(task_id);

-- 5. BUDGET REQUESTS TABLE
CREATE TABLE IF NOT EXISTS public.rms_budget_requests (
  id TEXT PRIMARY KEY DEFAULT ('BGT-' || substr(gen_random_uuid()::text, 1, 8)),
  committee_id TEXT NOT NULL REFERENCES public.rms_committees(id) ON DELETE CASCADE,
  committee_name TEXT NOT NULL,
  request_title TEXT NOT NULL,
  expense_category TEXT NOT NULL,
  requested_amount NUMERIC NOT NULL CHECK (requested_amount > 0),
  description TEXT,
  supporting_documents TEXT[] DEFAULT '{}',
  requested_by TEXT NOT NULL,
  requested_by_name TEXT NOT NULL,
  request_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN (
    'SUBMITTED', 'FINANCE_REVIEWED', 'RECOMMENDED', 'APPROVED', 'REJECTED', 'DISBURSED'
  )),
  finance_reviewer_id TEXT,
  finance_reviewer_name TEXT,
  finance_comments TEXT,
  approved_by TEXT,
  approved_by_name TEXT,
  approved_amount NUMERIC CHECK (approved_amount >= 0),
  approval_date TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rms_budget_committee ON public.rms_budget_requests(committee_id);
CREATE INDEX IF NOT EXISTS idx_rms_budget_status ON public.rms_budget_requests(status);

-- 6. EXPENSES TABLE WITH AUDIT REVERSAL SUPPORT
CREATE TABLE IF NOT EXISTS public.rms_expenses (
  id TEXT PRIMARY KEY DEFAULT ('EXP-' || substr(gen_random_uuid()::text, 1, 8)),
  committee_id TEXT NOT NULL REFERENCES public.rms_committees(id) ON DELETE RESTRICT,
  committee_name TEXT NOT NULL,
  expense_title TEXT NOT NULL,
  expense_category TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('CASH', 'BKASH', 'NAGAD', 'BANK_TRANSFER', 'CHEQUE')),
  vendor TEXT NOT NULL,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  voucher_number TEXT NOT NULL,
  voucher_url TEXT,
  submitted_by TEXT NOT NULL,
  submitted_by_name TEXT NOT NULL,
  verification_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (verification_status IN (
    'PENDING', 'VERIFIED', 'REJECTED', 'REVERSED'
  )),
  verified_by TEXT,
  verified_by_name TEXT,
  reversal_reason TEXT,
  reversal_authorized_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rms_expenses_committee ON public.rms_expenses(committee_id);
CREATE INDEX IF NOT EXISTS idx_rms_expenses_status ON public.rms_expenses(verification_status);

-- 7. INCOME TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS public.rms_income_transactions (
  id TEXT PRIMARY KEY DEFAULT ('INC-' || substr(gen_random_uuid()::text, 1, 8)),
  source TEXT NOT NULL CHECK (source IN ('REGISTRATION', 'SPONSORSHIP', 'DONATION', 'OTHER')),
  source_title TEXT NOT NULL,
  reference_id TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  received_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT NOT NULL,
  recorded_by TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'CONFIRMED' CHECK (status IN ('CONFIRMED', 'PENDING', 'REVERSED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rms_income_source ON public.rms_income_transactions(source);

-- 8. SPONSORS TABLE (Sponsorship CRM)
CREATE TABLE IF NOT EXISTS public.rms_sponsors (
  id TEXT PRIMARY KEY DEFAULT ('SPN-' || substr(gen_random_uuid()::text, 1, 8)),
  company_name TEXT NOT NULL,
  contact_person TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT,
  category TEXT NOT NULL CHECK (category IN (
    'TITLE_SPONSOR', 'PLATINUM', 'GOLD', 'SILVER', 'SUPPORTING', 'MEDIA_PARTNER', 'OTHER_PARTNER'
  )),
  proposed_amount NUMERIC NOT NULL DEFAULT 0,
  agreed_amount NUMERIC NOT NULL DEFAULT 0,
  received_amount NUMERIC NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'NOT_PAID' CHECK (payment_status IN ('NOT_PAID', 'PARTIAL', 'PAID_FULL')),
  agreement_document_url TEXT,
  assigned_member_id TEXT,
  assigned_member_name TEXT,
  benefits JSONB DEFAULT '[]'::jsonb,
  contact_history JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rms_sponsors_cat ON public.rms_sponsors(category);
CREATE INDEX IF NOT EXISTS idx_rms_sponsors_pay_status ON public.rms_sponsors(payment_status);

-- 9. DOCUMENTS TABLE (Repository Workspaces)
CREATE TABLE IF NOT EXISTS public.rms_documents (
  id TEXT PRIMARY KEY DEFAULT ('DOC-' || substr(gen_random_uuid()::text, 1, 8)),
  title TEXT NOT NULL,
  committee_id TEXT NOT NULL REFERENCES public.rms_committees(id) ON DELETE CASCADE,
  committee_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'OFFICIAL_LETTERS', 'PERMISSION_DOCUMENTS', 'MEETING_MINUTES', 'BUDGET_PROPOSALS',
    'BILLS_VOUCHERS', 'SPONSORSHIP_AGREEMENTS', 'EVENT_DESIGNS', 'VENDOR_AGREEMENTS',
    'PHOTOS_VIDEOS', 'OTHER'
  )),
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL DEFAULT 0,
  file_type TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  uploaded_by TEXT NOT NULL,
  uploaded_by_name TEXT NOT NULL,
  access_permission TEXT NOT NULL DEFAULT 'COMMITTEE_ONLY' CHECK (access_permission IN (
    'PUBLIC', 'COMMITTEE_ONLY', 'CENTRAL_ONLY'
  )),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rms_docs_committee ON public.rms_documents(committee_id);
CREATE INDEX IF NOT EXISTS idx_rms_docs_category ON public.rms_documents(category);

-- 10. MEETINGS TABLE
CREATE TABLE IF NOT EXISTS public.rms_meetings (
  id TEXT PRIMARY KEY DEFAULT ('MTG-' || substr(gen_random_uuid()::text, 1, 8)),
  title TEXT NOT NULL,
  committee_id TEXT REFERENCES public.rms_committees(id) ON DELETE SET NULL,
  committee_name TEXT,
  is_central_meeting BOOLEAN NOT NULL DEFAULT FALSE,
  meeting_date DATE NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  venue TEXT NOT NULL,
  agenda TEXT[] DEFAULT '{}',
  attendees JSONB DEFAULT '[]'::jsonb,
  meeting_minutes TEXT,
  decisions TEXT[] DEFAULT '{}',
  follow_up_tasks JSONB DEFAULT '[]'::jsonb,
  minutes_document_url TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rms_meetings_date ON public.rms_meetings(meeting_date);

-- 11. ANNOUNCEMENTS & NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.rms_announcements (
  id TEXT PRIMARY KEY DEFAULT ('ANN-' || substr(gen_random_uuid()::text, 1, 8)),
  title_en TEXT NOT NULL,
  title_bn TEXT NOT NULL,
  content_en TEXT NOT NULL,
  content_bn TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('NORMAL', 'URGENT', 'CRITICAL')),
  target_audience TEXT NOT NULL CHECK (target_audience IN ('ALL', 'COMMITTEE_HEADS', 'VOLUNTEERS', 'PUBLIC')),
  committee_id TEXT REFERENCES public.rms_committees(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. VOLUNTEER ROSTER TABLE
CREATE TABLE IF NOT EXISTS public.rms_volunteers (
  id TEXT PRIMARY KEY DEFAULT ('VOL-' || substr(gen_random_uuid()::text, 1, 8)),
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  assigned_committee_id TEXT NOT NULL REFERENCES public.rms_committees(id) ON DELETE CASCADE,
  assigned_location TEXT NOT NULL,
  assigned_date DATE NOT NULL,
  duty_start_time TEXT NOT NULL,
  duty_end_time TEXT NOT NULL,
  supervisor_name TEXT NOT NULL,
  supervisor_phone TEXT NOT NULL,
  attendance_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (attendance_status IN ('PENDING', 'CHECKED_IN', 'COMPLETED', 'ABSENT')),
  check_in_time TIMESTAMPTZ,
  check_out_time TIMESTAMPTZ,
  responsibilities TEXT[] DEFAULT '{}',
  emergency_contact JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rms_volunteers_date ON public.rms_volunteers(assigned_date);
CREATE INDEX IF NOT EXISTS idx_rms_volunteers_status ON public.rms_volunteers(attendance_status);

-- 13. EVENT DAY INCIDENTS TABLE
CREATE TABLE IF NOT EXISTS public.rms_event_incidents (
  id TEXT PRIMARY KEY DEFAULT ('INC-' || substr(gen_random_uuid()::text, 1, 8)),
  incident_type TEXT NOT NULL CHECK (incident_type IN (
    'MEDICAL', 'SECURITY', 'TECHNICAL', 'CROWD_MANAGEMENT', 'FOOD_BEVERAGE', 'LOST_FOUND', 'OTHER'
  )),
  severity TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  location TEXT NOT NULL,
  description TEXT NOT NULL,
  reported_by TEXT NOT NULL,
  reported_by_name TEXT NOT NULL,
  reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_team TEXT NOT NULL,
  assigned_responder TEXT,
  resolution_status TEXT NOT NULL DEFAULT 'REPORTED' CHECK (resolution_status IN (
    'REPORTED', 'DISPATCHED', 'IN_PROGRESS', 'RESOLVED'
  )),
  resolution_notes TEXT,
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_rms_incidents_severity ON public.rms_event_incidents(severity);
CREATE INDEX IF NOT EXISTS idx_rms_incidents_status ON public.rms_event_incidents(resolution_status);

-- 14. WEEKLY PROGRESS REPORTS TABLE
CREATE TABLE IF NOT EXISTS public.rms_weekly_reports (
  id TEXT PRIMARY KEY DEFAULT ('WPR-' || substr(gen_random_uuid()::text, 1, 8)),
  committee_id TEXT NOT NULL REFERENCES public.rms_committees(id) ON DELETE CASCADE,
  committee_name TEXT NOT NULL,
  director_id TEXT NOT NULL,
  director_name TEXT NOT NULL,
  report_week_number INTEGER NOT NULL,
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  work_completed TEXT[] DEFAULT '{}',
  work_in_progress TEXT[] DEFAULT '{}',
  work_pending TEXT[] DEFAULT '{}',
  problems_encountered TEXT,
  budget_spent NUMERIC NOT NULL DEFAULT 0,
  upcoming_activities TEXT[] DEFAULT '{}',
  support_required TEXT,
  status TEXT NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN (
    'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REVISION_REQUESTED'
  )),
  reviewer_comments TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rms_weekly_reports_comm ON public.rms_weekly_reports(committee_id);

-- 15. RMS AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.rms_audit_logs (
  id TEXT PRIMARY KEY DEFAULT ('LOG-' || substr(gen_random_uuid()::text, 1, 8)),
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_role TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  previous_value TEXT,
  new_value TEXT,
  details TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rms_audit_timestamp ON public.rms_audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_rms_audit_entity ON public.rms_audit_logs(entity_type, entity_id);

-- ENABLE ROW LEVEL SECURITY
ALTER TABLE public.rms_committees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rms_committee_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rms_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rms_task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rms_budget_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rms_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rms_income_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rms_sponsors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rms_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rms_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rms_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rms_volunteers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rms_event_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rms_weekly_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rms_audit_logs ENABLE ROW LEVEL SECURITY;

-- PUBLIC READ FOR BASIC COMMITTEE AND ANNOUNCEMENT DATA
CREATE POLICY "Public read approved committees" ON public.rms_committees
  FOR SELECT USING (is_active = true);

CREATE POLICY "Public read active announcements" ON public.rms_announcements
  FOR SELECT USING (is_active = true AND target_audience = 'PUBLIC');

-- SERVICE ROLE & AUTHENTICATED ACCESS FOR ERP TABLES
CREATE POLICY "Allow authenticated read on all rms tables" ON public.rms_tasks
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated access to budget" ON public.rms_budget_requests
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated access to expenses" ON public.rms_expenses
  FOR ALL USING (auth.role() = 'authenticated');

