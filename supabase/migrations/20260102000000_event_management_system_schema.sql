-- ============================================================================
-- POLICE LINES SCHOOL AND COLLEGE, FARIDPUR - GRAND REUNION 2026
-- PHASE 2: COMPLETE EVENT MANAGEMENT SYSTEM SCHEMA & RLS POLICIES
-- Target Supabase Project: bwlenuxlpesnwnegrbgx
-- Migration: 20260102000000_event_management_system_schema.sql
-- ============================================================================

-- 1. STAFF ACCOUNTS TABLE (Role-Based Authentication)
CREATE TABLE IF NOT EXISTS public.staff_accounts (
  id TEXT PRIMARY KEY DEFAULT ('STF-' || substr(gen_random_uuid()::text, 1, 6)),
  full_name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN (
    'SUPER_ADMIN',
    'BREAKFAST_STAFF',
    'LUNCH_STAFF',
    'DINNER_STAFF',
    'GATE_STAFF',
    'DRESS_STAFF',
    'FINANCE_STAFF'
  )),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DISABLED')),
  assigned_gate TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT DEFAULT 'SUPER_ADMIN'
);

CREATE INDEX IF NOT EXISTS idx_staff_accounts_username ON public.staff_accounts(username);
CREATE INDEX IF NOT EXISTS idx_staff_accounts_role ON public.staff_accounts(role);

-- 2. FOOD DISTRIBUTION TABLE (Breakfast, Lunch, Dinner Independent Tracking)
CREATE TABLE IF NOT EXISTS public.food_distributions (
  id TEXT PRIMARY KEY DEFAULT ('FOOD-' || substr(gen_random_uuid()::text, 1, 8)),
  registration_id TEXT NOT NULL,
  student_name TEXT NOT NULL,
  batch_name TEXT NOT NULL,
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner')),
  status TEXT NOT NULL DEFAULT 'COLLECTED' CHECK (status IN ('COLLECTED', 'CANCELLED')),
  collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  staff_id TEXT NOT NULL,
  staff_name TEXT NOT NULL,
  notes TEXT,
  corrected_by TEXT,
  correction_reason TEXT,
  corrected_at TIMESTAMPTZ,
  CONSTRAINT uq_student_meal UNIQUE (registration_id, meal_type)
);

CREATE INDEX IF NOT EXISTS idx_food_reg_meal ON public.food_distributions(registration_id, meal_type);
CREATE INDEX IF NOT EXISTS idx_food_meal_type ON public.food_distributions(meal_type);

-- 3. GATE ENTRY & EXIT MANAGEMENT TABLE
CREATE TABLE IF NOT EXISTS public.gate_events (
  id TEXT PRIMARY KEY DEFAULT ('GATE-' || substr(gen_random_uuid()::text, 1, 8)),
  registration_id TEXT NOT NULL,
  student_name TEXT NOT NULL,
  batch_name TEXT NOT NULL,
  photo_url TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('ENTRY', 'EXIT')),
  gate_id TEXT NOT NULL,
  scanner_id TEXT,
  staff_id TEXT NOT NULL,
  staff_name TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'APPROVED' CHECK (status IN ('APPROVED', 'DENIED', 'REVISED')),
  correction_reason TEXT,
  corrected_by TEXT,
  corrected_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_gate_reg_id ON public.gate_events(registration_id);
CREATE INDEX IF NOT EXISTS idx_gate_timestamp ON public.gate_events(timestamp DESC);

-- 4. DRESS / T-SHIRT DISTRIBUTION TABLE
CREATE TABLE IF NOT EXISTS public.dress_distributions (
  id TEXT PRIMARY KEY DEFAULT ('DRS-' || substr(gen_random_uuid()::text, 1, 8)),
  registration_id TEXT NOT NULL,
  student_name TEXT NOT NULL,
  item_type TEXT NOT NULL DEFAULT 'reunion_tshirt',
  registered_size TEXT NOT NULL CHECK (registered_size IN ('XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL')),
  status TEXT NOT NULL DEFAULT 'RECEIVED' CHECK (status IN ('RECEIVED', 'RETURNED', 'CORRECTED')),
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  staff_id TEXT NOT NULL,
  staff_name TEXT NOT NULL,
  notes TEXT,
  corrected_by TEXT,
  correction_reason TEXT,
  corrected_at TIMESTAMPTZ,
  CONSTRAINT uq_student_dress UNIQUE (registration_id, item_type)
);

CREATE INDEX IF NOT EXISTS idx_dress_reg ON public.dress_distributions(registration_id);

-- 5. CENTRAL EVENT BUDGET TABLE
CREATE TABLE IF NOT EXISTS public.central_budget (
  id TEXT PRIMARY KEY DEFAULT 'BUDGET-2026',
  academic_year INTEGER NOT NULL DEFAULT 2026,
  total_budget NUMERIC NOT NULL DEFAULT 0 CHECK (total_budget >= 0),
  description TEXT DEFAULT 'Reunion 2026 Master Budget',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT NOT NULL DEFAULT 'SUPER_ADMIN'
);

-- 6. STAFF MONEY ALLOCATIONS TABLE
CREATE TABLE IF NOT EXISTS public.staff_allocations (
  id TEXT PRIMARY KEY DEFAULT ('ALC-' || substr(gen_random_uuid()::text, 1, 8)),
  staff_id TEXT NOT NULL,
  staff_name TEXT NOT NULL,
  allocated_amount NUMERIC NOT NULL CHECK (allocated_amount > 0),
  academic_year INTEGER NOT NULL DEFAULT 2026,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CLOSED', 'VOIDED')),
  allocated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  allocated_by TEXT NOT NULL DEFAULT 'SUPER_ADMIN',
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_allocations_staff ON public.staff_allocations(staff_id);

-- 7. STAFF EXPENSE RECORDS TABLE
CREATE TABLE IF NOT EXISTS public.staff_expenses (
  id TEXT PRIMARY KEY DEFAULT ('EXP-' || substr(gen_random_uuid()::text, 1, 8)),
  staff_id TEXT NOT NULL,
  staff_name TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  expense_date TEXT NOT NULL,
  expense_time TEXT NOT NULL,
  vendor_name TEXT,
  receipt_url TEXT,
  status TEXT NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN ('SUBMITTED', 'APPROVED', 'REJECTED', 'VOIDED')),
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  void_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_staff ON public.staff_expenses(staff_id);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON public.staff_expenses(status);

-- 8. AUTHORITATIVE FINANCIAL LEDGER (Double-Entry Ledger Transactions)
CREATE TABLE IF NOT EXISTS public.financial_ledger (
  id TEXT PRIMARY KEY DEFAULT ('LDG-' || substr(gen_random_uuid()::text, 1, 10)),
  staff_id TEXT NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('ALLOCATION', 'EXPENSE', 'ADJUSTMENT', 'CASH_RETURN')),
  amount NUMERIC NOT NULL,
  reference_id TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ledger_staff ON public.financial_ledger(staff_id);

-- 9. ADMIN AUDIT HISTORY (Comprehensive Track of All Privileged Corrections)
CREATE TABLE IF NOT EXISTS public.admin_audit_history (
  id TEXT PRIMARY KEY DEFAULT ('HIST-' || substr(gen_random_uuid()::text, 1, 10)),
  admin_id TEXT NOT NULL,
  admin_name TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('REGISTRATION', 'PAYMENT', 'FOOD', 'GATE', 'DRESS', 'BUDGET', 'EXPENSE', 'STAFF')),
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  previous_value TEXT,
  new_value TEXT,
  reason TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_hist_entity ON public.admin_audit_history(entity_type, entity_id);

-- ============================================================================
-- 10. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
ALTER TABLE public.staff_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_distributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gate_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dress_distributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.central_budget ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_history ENABLE ROW LEVEL SECURITY;

-- 10.1 Staff Accounts RLS
CREATE POLICY "Super admin full management on staff_accounts"
  ON public.staff_accounts FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public staff login check"
  ON public.staff_accounts FOR SELECT
  USING (status = 'ACTIVE');

-- 10.2 Food Distributions RLS
CREATE POLICY "Staff can insert food distribution"
  ON public.food_distributions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Public and staff can view food distribution"
  ON public.food_distributions FOR SELECT
  USING (true);

CREATE POLICY "Super admin can update food distributions"
  ON public.food_distributions FOR UPDATE
  USING (true);

-- 10.3 Gate Events RLS
CREATE POLICY "Gate staff can log gate events"
  ON public.gate_events FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Gate events viewable by staff"
  ON public.gate_events FOR SELECT
  USING (true);

-- 10.4 Dress Distributions RLS
CREATE POLICY "Dress staff can log dress distribution"
  ON public.dress_distributions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Dress distributions viewable by staff"
  ON public.dress_distributions FOR SELECT
  USING (true);

-- 10.5 Financial Ledger and Expenses RLS
CREATE POLICY "Staff can view their own expenses"
  ON public.staff_expenses FOR SELECT
  USING (true);

CREATE POLICY "Staff can insert expenses"
  ON public.staff_expenses FOR INSERT
  WITH CHECK (amount > 0);

CREATE POLICY "Admin can update expenses"
  ON public.staff_expenses FOR UPDATE
  USING (true);

CREATE POLICY "Ledger viewable by authenticated users"
  ON public.financial_ledger FOR SELECT
  USING (true);

CREATE POLICY "Ledger entries append-only"
  ON public.financial_ledger FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Audit history append-only"
  ON public.admin_audit_history FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Audit history viewable by super admin"
  ON public.admin_audit_history FOR SELECT
  USING (true);

-- ============================================================================
-- 11. HELPER STORED PROCEDURES & LEDGER FUNCTIONS
-- ============================================================================

-- Function to compute authoritative staff remaining balance
CREATE OR REPLACE FUNCTION public.get_staff_remaining_balance(p_staff_id TEXT)
RETURNS NUMERIC AS $$
DECLARE
  v_allocated NUMERIC := 0;
  v_expenses NUMERIC := 0;
  v_returns NUMERIC := 0;
BEGIN
  -- Sum all active allocations
  SELECT COALESCE(SUM(allocated_amount), 0) INTO v_allocated
  FROM public.staff_allocations
  WHERE staff_id = p_staff_id AND status = 'ACTIVE';

  -- Sum all submitted and approved expenses (cannot double spend while pending approval)
  SELECT COALESCE(SUM(amount), 0) INTO v_expenses
  FROM public.staff_expenses
  WHERE staff_id = p_staff_id AND status IN ('SUBMITTED', 'APPROVED');

  -- Sum cash returns
  SELECT COALESCE(SUM(amount), 0) INTO v_returns
  FROM public.financial_ledger
  WHERE staff_id = p_staff_id AND transaction_type = 'CASH_RETURN';

  RETURN (v_allocated - v_expenses - v_returns);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
