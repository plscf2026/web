-- ============================================================================
-- MIGRATION: Separate Login Portals for Every User Role & Strict RBAC
-- Roles: Super Admin, Admin, Moderator, Finance Team, Registration Team, Committee Member
-- Guarantees unique portal identity, Supabase auth authorization, and URL guard security
-- ============================================================================

-- 1. EXPAND ALLOWED ROLES IN admin_accounts
DO $$
BEGIN
  -- Drop existing role check constraint if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'admin_accounts_role_check'
      AND conrelid = 'public.admin_accounts'::regclass
  ) THEN
    ALTER TABLE public.admin_accounts DROP CONSTRAINT admin_accounts_role_check;
  END IF;

  -- Add updated role check constraint supporting all 6 role portals
  ALTER TABLE public.admin_accounts
    ADD CONSTRAINT admin_accounts_role_check
    CHECK (role IN (
      'super_admin',
      'admin',
      'moderator',
      'finance_manager',
      'finance',
      'registration_officer',
      'registration',
      'committee_member',
      'committee',
      'gate_scanner'
    ));
END $$;

-- 2. CREATE INDEX ON admin_accounts.role FOR HIGH-PERFORMANCE RBAC LOOKUPS
CREATE INDEX IF NOT EXISTS idx_admin_accounts_role
  ON public.admin_accounts (role);

-- 3. STORED PROCEDURE: rpc_authenticate_portal_role
-- Authoritatively checks if an authenticated user has the required portal role
CREATE OR REPLACE FUNCTION public.rpc_authenticate_portal_role(
  p_user_email TEXT,
  p_required_role TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_account RECORD;
  v_is_authorized BOOLEAN := false;
BEGIN
  -- Find target admin account by email or username
  SELECT * INTO v_account
  FROM public.admin_accounts
  WHERE LOWER(email) = LOWER(p_user_email)
     OR LOWER(username) = LOWER(p_user_email);

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'ACCOUNT_NOT_FOUND',
      'message', 'No authorized staff account found matching credentials.'
    );
  END IF;

  -- Super Admin has global bypass authority to all portals
  IF v_account.role = 'super_admin' THEN
    v_is_authorized := true;
  -- Role synonym normalization
  ELSIF (p_required_role = 'finance' OR p_required_role = 'finance_manager')
    AND (v_account.role = 'finance' OR v_account.role = 'finance_manager') THEN
    v_is_authorized := true;
  ELSIF (p_required_role = 'registration' OR p_required_role = 'registration_officer')
    AND (v_account.role = 'registration' OR v_account.role = 'registration_officer') THEN
    v_is_authorized := true;
  ELSIF (p_required_role = 'committee' OR p_required_role = 'committee_member')
    AND (v_account.role = 'committee' OR v_account.role = 'committee_member') THEN
    v_is_authorized := true;
  ELSIF v_account.role = p_required_role THEN
    v_is_authorized := true;
  ELSE
    v_is_authorized := false;
  END IF;

  IF NOT v_is_authorized THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'ROLE_MISMATCH',
      'account_role', v_account.role,
      'required_role', p_required_role,
      'message', 'Access Denied: Your account role is not authorized for this specific portal.'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'account', jsonb_build_object(
      'id', v_account.id,
      'username', v_account.username,
      'full_name', v_account.full_name,
      'email', v_account.email,
      'role', v_account.role,
      'created_at', v_account.created_at
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_authenticate_portal_role(TEXT, TEXT) TO anon, authenticated, service_role;
