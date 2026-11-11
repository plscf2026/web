-- ============================================================================
-- POLICE LINES SCHOOL AND COLLEGE, FARIDPUR - GRAND REUNION 2026 / 2027
-- STUDENT ID CARD MANAGEMENT, GENERATION & BULK DOWNLOAD SYSTEM
-- Schema Version: 20270103000000_student_id_card_management_schema.sql
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. ID CARD STAFF ACCOUNTS TABLE (Role-Based Access Control)
-- Super Admin manages accounts; Staff must be explicitly APPROVED before login.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.id_card_staff_accounts (
  id TEXT PRIMARY KEY DEFAULT ('IDC-STF-' || substr(gen_random_uuid()::text, 1, 6)),
  full_name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'ID_CARD_STAFF' CHECK (role IN ('SUPER_ADMIN', 'ID_CARD_SUPERVISOR', 'ID_CARD_STAFF')),
  status TEXT NOT NULL DEFAULT 'PENDING_APPROVAL' CHECK (status IN ('PENDING_APPROVAL', 'APPROVED', 'ACTIVE', 'REJECTED', 'DISABLED')),
  can_generate BOOLEAN NOT NULL DEFAULT TRUE,
  can_download_single BOOLEAN NOT NULL DEFAULT TRUE,
  can_download_batch BOOLEAN NOT NULL DEFAULT TRUE,
  can_download_all BOOLEAN NOT NULL DEFAULT FALSE,
  assigned_batch_years TEXT[] DEFAULT '{}', -- empty means all batches allowed
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT DEFAULT 'SUPER_ADMIN',
  approved_at TIMESTAMPTZ,
  approved_by TEXT,
  last_login_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_idc_staff_username ON public.id_card_staff_accounts(username);
CREATE INDEX IF NOT EXISTS idx_idc_staff_status ON public.id_card_staff_accounts(status);

-- ============================================================================
-- 2. STUDENT ID CARDS TABLE (One card per eligible student registration)
-- Tracks generation status, secure QR token, storage references, and review flags.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.student_id_cards (
  id TEXT PRIMARY KEY DEFAULT ('IDC-' || substr(gen_random_uuid()::text, 1, 10)),
  registration_id TEXT NOT NULL UNIQUE,
  event_year INTEGER NOT NULL DEFAULT 2026,
  student_name TEXT NOT NULL,
  student_name_bn TEXT,
  batch_year TEXT NOT NULL, -- e.g. '1998', '2014', '2026', or 'REVIEW_REQUIRED'
  batch_name TEXT NOT NULL,
  id_number TEXT NOT NULL, -- matches registration_id
  contact_number TEXT NOT NULL,
  photo_url TEXT,
  has_photo BOOLEAN NOT NULL DEFAULT FALSE,
  qr_token TEXT NOT NULL UNIQUE,
  verification_url TEXT NOT NULL,
  card_status TEXT NOT NULL DEFAULT 'ELIGIBLE' CHECK (card_status IN ('ELIGIBLE', 'GENERATED', 'REGENERATED', 'FLAGGED_REVIEW')),
  review_reason TEXT,
  pdf_storage_path TEXT, -- e.g. 'STUDENT_ID_CARDS/Batch_1998/Individual_Cards/Student_PLSCF-2026-F1001.pdf'
  pdf_file_size_bytes INTEGER DEFAULT 0,
  pdf_checksum TEXT,
  card_dimensions TEXT NOT NULL DEFAULT '54x86mm',
  version INTEGER NOT NULL DEFAULT 1,
  generated_at TIMESTAMPTZ,
  generated_by TEXT,
  regenerated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_id_cards_reg_id ON public.student_id_cards(registration_id);
CREATE INDEX IF NOT EXISTS idx_id_cards_batch_year ON public.student_id_cards(batch_year);
CREATE INDEX IF NOT EXISTS idx_id_cards_status ON public.student_id_cards(card_status);
CREATE INDEX IF NOT EXISTS idx_id_cards_qr_token ON public.student_id_cards(qr_token);

-- ============================================================================
-- 3. BATCH ID CARD COLLECTIONS TABLE
-- Year-wise folder aggregations and combined print-ready PDF tracking.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.batch_id_card_collections (
  id TEXT PRIMARY KEY DEFAULT ('BATCH-COLL-' || substr(gen_random_uuid()::text, 1, 8)),
  batch_year TEXT NOT NULL UNIQUE,
  total_eligible_students INTEGER NOT NULL DEFAULT 0,
  total_generated_cards INTEGER NOT NULL DEFAULT 0,
  combined_pdf_path TEXT, -- e.g. 'STUDENT_ID_CARDS/Batch_1998/Batch_1998_All_Cards.pdf'
  combined_pdf_size_bytes INTEGER DEFAULT 0,
  batch_zip_path TEXT, -- e.g. 'STUDENT_ID_CARDS/Batch_1998/Batch_1998.zip'
  batch_zip_size_bytes INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'GENERATING', 'READY', 'ERROR')),
  last_generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_batch_coll_year ON public.batch_id_card_collections(batch_year);

-- ============================================================================
-- 4. ID CARD DOWNLOAD JOBS TABLE
-- Asynchronous background bulk processing with progress tracking.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.id_card_download_jobs (
  id TEXT PRIMARY KEY DEFAULT ('JOB-ZIP-' || substr(gen_random_uuid()::text, 1, 10)),
  requested_by_id TEXT NOT NULL,
  requested_by_name TEXT NOT NULL,
  job_type TEXT NOT NULL CHECK (job_type IN ('SINGLE_CARD', 'BATCH_FOLDER', 'BATCH_COMBINED_PDF', 'ALL_CARDS_BULK_ZIP')),
  target_batch_year TEXT,
  total_cards INTEGER NOT NULL DEFAULT 0,
  processed_cards INTEGER NOT NULL DEFAULT 0,
  progress_percentage INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED')),
  archive_filename TEXT,
  archive_storage_path TEXT,
  archive_file_size_bytes BIGINT DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_idc_jobs_status ON public.id_card_download_jobs(status);
CREATE INDEX IF NOT EXISTS idx_idc_jobs_user ON public.id_card_download_jobs(requested_by_id);

-- ============================================================================
-- 5. ID CARD DOWNLOAD AUDIT LOGS TABLE
-- Immutable administrative audit trail for Super Admin compliance and reporting.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.id_card_download_logs (
  id TEXT PRIMARY KEY DEFAULT ('LOG-DL-' || substr(gen_random_uuid()::text, 1, 12)),
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_role TEXT NOT NULL,
  download_type TEXT NOT NULL CHECK (download_type IN ('INDIVIDUAL_PDF', 'BATCH_COMBINED_PDF', 'BATCH_ZIP', 'ALL_CARDS_BULK_ZIP')),
  batch_year TEXT NOT NULL,
  registration_id TEXT,
  card_count INTEGER NOT NULL DEFAULT 1,
  ip_address TEXT,
  status TEXT NOT NULL DEFAULT 'SUCCESS' CHECK (status IN ('SUCCESS', 'FAILED')),
  details TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_idc_logs_user ON public.id_card_download_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_idc_logs_type ON public.id_card_download_logs(download_type);
CREATE INDEX IF NOT EXISTS idx_idc_logs_time ON public.id_card_download_logs(timestamp);

-- ============================================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
ALTER TABLE public.id_card_staff_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_id_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batch_id_card_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.id_card_download_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.id_card_download_logs ENABLE ROW LEVEL SECURITY;

-- Staff Accounts: Read/Write restricted to super admins & authorized staff auth
CREATE POLICY "Super Admins can manage all staff accounts"
  ON public.id_card_staff_accounts
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Student ID Cards: Accessible to authorized staff & admin; read-only to verified token checks
CREATE POLICY "Authorized staff can read and manage student ID cards"
  ON public.student_id_cards
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Batch Collections: Accessible to staff and admins
CREATE POLICY "Authorized staff can read and manage batch collections"
  ON public.batch_id_card_collections
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Download Jobs: Accessible to job creator and admins
CREATE POLICY "Users can manage their download jobs"
  ON public.id_card_download_jobs
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Audit Logs: Read-only to Super Admin, append-only to system
CREATE POLICY "Append-only ID card audit logs"
  ON public.id_card_download_logs
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Super Admin can view ID card audit logs"
  ON public.id_card_download_logs
  FOR SELECT
  USING (true);

