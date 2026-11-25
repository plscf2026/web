-- ==============================================================================
-- DATABASE MIGRATION: 20270305000000_finance_manager_staff_relationship_and_rbac.sql
-- POLICE LINES SCHOOL AND COLLEGE, FARIDPUR — GRAND REUNION 2027
-- 1. Super Admin-only account creation, assignment, password reset, status & session control
-- 2. Strict Finance Manager <-> Finance Staff relationship & DB-level isolation
-- 3. Forced temporary password rotation & audit logging (never storing passwords)
-- 4. Approved-only financial totals including approved staff_expenses without duplicates
-- ==============================================================================

-- 1. EXTEND EXISTING ACCOUNT TABLES NON-DESTRUCTIVELY
ALTER TABLE public.admin_accounts
  ADD COLUMN IF NOT EXISTS mobile_number TEXT,
  ADD COLUMN IF NOT EXISTS staff_code TEXT,
  ADD COLUMN IF NOT EXISTS assigned_station TEXT,
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.staff_accounts
  ADD COLUMN IF NOT EXISTS mobile_number TEXT,
  ADD COLUMN IF NOT EXISTS staff_code TEXT,
  ADD COLUMN IF NOT EXISTS assigned_manager_id TEXT REFERENCES public.admin_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_manager_name TEXT,
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_staff_accounts_assigned_manager
  ON public.staff_accounts(assigned_manager_id);

-- Expand staff_accounts status check to support DISABLED/INACTIVE/SUSPENDED safely
ALTER TABLE public.staff_accounts
  DROP CONSTRAINT IF EXISTS staff_accounts_status_check;

ALTER TABLE public.staff_accounts
  ADD CONSTRAINT staff_accounts_status_check
  CHECK (status IN ('ACTIVE', 'DISABLED', 'SUSPENDED'));

-- 2. AUTHORIZATION HELPER FUNCTIONS (RESPECTING ACTIVE/LOCKED STATUS)
CREATE OR REPLACE FUNCTION public.current_admin_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
  SELECT role
  FROM public.admin_accounts
  WHERE auth_user_id = auth.uid()
    AND (status = 'ACTIVE' OR status IS NULL)
    AND is_locked IS NOT TRUE
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_admin_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
  SELECT id
  FROM public.admin_accounts
  WHERE auth_user_id = auth.uid()
    AND (status = 'ACTIVE' OR status IS NULL)
    AND is_locked IS NOT TRUE
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_staff_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
  SELECT id
  FROM public.staff_accounts
  WHERE auth_user_id = auth.uid()
    AND status = 'ACTIVE'
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin_caller()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
  SELECT
    COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), '') = 'service_role'
    OR (auth.uid() IS NOT NULL AND public.current_admin_role() = 'super_admin')
    OR (
      auth.uid() IS NULL
      AND NULLIF(current_setting('request.jwt.claim.role', true), '') IS NULL
      AND session_user IN ('postgres', 'supabase_admin')
    )
$$;

CREATE OR REPLACE FUNCTION public.is_finance_manager_of_staff(p_staff_id TEXT)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
  SELECT
    public.is_super_admin_caller()
    OR (
      public.current_admin_role() = 'finance_manager'
      AND EXISTS (
        SELECT 1
        FROM public.staff_accounts s
        WHERE s.id = p_staff_id
          AND s.assigned_manager_id = public.current_admin_id()
      )
    )
$$;

-- 3. DROP AMBIGUOUS OLD OVERLOADS BEFORE RECREATING HARDENED RPCs
DROP FUNCTION IF EXISTS public.rpc_create_system_user(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.rpc_create_system_user(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, UUID, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.rpc_manage_user_profile(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.rpc_set_user_password(TEXT, TEXT, TEXT, TEXT);

-- 4. SUPER ADMIN-ONLY: UNIFIED USER DISCOVERY
CREATE OR REPLACE FUNCTION public.rpc_get_unified_system_users()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_users JSONB;
BEGIN
  IF NOT public.is_super_admin_caller() THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Only Super Admin can view system user credentials and roles.';
  END IF;

  WITH admin_list AS (
    SELECT
      a.id,
      'ADMIN' AS user_type,
      a.full_name,
      a.username,
      a.email,
      a.mobile_number,
      COALESCE(a.staff_code, a.id) AS staff_code,
      NULL::text AS assigned_manager_id,
      NULL::text AS assigned_manager_name,
      COALESCE(a.must_change_password, false) AS must_change_password,
      a.role,
      CASE
        WHEN lower(a.role) IN ('super_admin', 'superadmin') THEN 'SUPER_ADMIN'
        WHEN lower(a.role) = 'admin' THEN 'ADMIN'
        WHEN lower(a.role) IN ('finance_manager', 'finance') THEN 'FINANCE'
        WHEN lower(a.role) IN ('moderator', 'registration_officer', 'committee_member') THEN 'ADMIN'
        ELSE 'ADMIN'
      END AS role_category,
      COALESCE(a.department, 'CENTRAL_ADMIN') AS department,
      CASE
        WHEN upper(COALESCE(a.status, '')) IN ('SUSPENDED', 'SUSPEND') THEN 'SUSPENDED'
        WHEN a.is_locked IS TRUE OR upper(COALESCE(a.status, '')) IN ('INACTIVE', 'DISABLED') THEN 'INACTIVE'
        ELSE 'ACTIVE'
      END AS status,
      COALESCE(
        NULLIF(a.assigned_station, ''),
        CASE
          WHEN lower(a.role) IN ('finance_manager', 'finance') THEN 'Central Finance Oversight Office'
          ELSE 'Super Admin Command Center'
        END
      ) AS assigned_station,
      COALESCE(a.permissions, '["VIEW", "VERIFY", "APPROVE", "EXPORT", "MANAGE"]'::jsonb) AS permissions,
      a.created_at,
      COALESCE(u.last_sign_in_at, a.last_login_at) AS last_login_at,
      a.auth_user_id,
      'SUPER_ADMIN' AS created_by
    FROM public.admin_accounts a
    LEFT JOIN auth.users u ON a.auth_user_id = u.id
  ),
  staff_list AS (
    SELECT
      s.id,
      'STAFF' AS user_type,
      s.full_name,
      s.username,
      s.email,
      s.mobile_number,
      COALESCE(s.staff_code, s.id) AS staff_code,
      s.assigned_manager_id,
      COALESCE(m.full_name, s.assigned_manager_name) AS assigned_manager_name,
      COALESCE(s.must_change_password, false) AS must_change_password,
      s.role,
      CASE
        WHEN upper(s.role) IN ('SUPER_ADMIN', 'SUPERADMIN') THEN 'SUPER_ADMIN'
        WHEN upper(s.role) IN ('ADMIN') THEN 'ADMIN'
        WHEN upper(s.role) IN ('FINANCE_STAFF', 'FINANCE') THEN 'FINANCE'
        ELSE 'STAFF'
      END AS role_category,
      COALESCE(s.department, 'OPERATIONS') AS department,
      CASE
        WHEN upper(COALESCE(s.status, '')) IN ('SUSPENDED', 'SUSPEND') THEN 'SUSPENDED'
        WHEN upper(COALESCE(s.status, '')) IN ('DISABLED', 'INACTIVE') THEN 'INACTIVE'
        ELSE 'ACTIVE'
      END AS status,
      COALESCE(s.assigned_gate, 'Operational Station') AS assigned_station,
      COALESCE(s.permissions, '["VIEW", "SCAN", "VERIFY", "APPROVE"]'::jsonb) AS permissions,
      s.created_at,
      COALESCE(u.last_sign_in_at, s.last_login_at) AS last_login_at,
      s.auth_user_id,
      s.created_by
    FROM public.staff_accounts s
    LEFT JOIN auth.users u ON s.auth_user_id = u.id
    LEFT JOIN public.admin_accounts m ON s.assigned_manager_id = m.id
  ),
  combined AS (
    SELECT * FROM admin_list
    UNION ALL
    SELECT * FROM staff_list
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', c.id,
      'userType', c.user_type,
      'fullName', c.full_name,
      'username', c.username,
      'email', c.email,
      'mobileNumber', c.mobile_number,
      'staffCode', c.staff_code,
      'assignedManagerId', c.assigned_manager_id,
      'assignedManagerName', c.assigned_manager_name,
      'mustChangePassword', c.must_change_password,
      'role', c.role,
      'roleCategory', c.role_category,
      'department', c.department,
      'status', c.status,
      'assignedStation', c.assigned_station,
      'permissions', c.permissions,
      'createdAt', c.created_at,
      'lastLoginAt', c.last_login_at,
      'authUserId', c.auth_user_id,
      'createdBy', c.created_by
    ) ORDER BY c.created_at ASC
  ) INTO v_users
  FROM combined c;

  RETURN COALESCE(v_users, '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_get_unified_system_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_get_unified_system_users() TO authenticated, service_role;

-- 5. FINANCE MANAGER SCOPED DIRECTORY RPC (MANAGER SEES ONLY ASSIGNED STAFF)
CREATE OR REPLACE FUNCTION public.rpc_get_manager_finance_staff()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_role TEXT := public.current_admin_role();
  v_admin_id TEXT := public.current_admin_id();
  v_staff JSONB;
BEGIN
  IF NOT (public.is_super_admin_caller() OR v_role = 'finance_manager') THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Only Finance Managers or Super Admin can access the Finance Staff directory.';
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'staffCode', COALESCE(s.staff_code, s.id),
      'authUserId', s.auth_user_id,
      'fullName', s.full_name,
      'username', s.username,
      'email', s.email,
      'mobileNumber', s.mobile_number,
      'role', s.role,
      'department', COALESCE(s.department, 'FINANCE'),
      'permissions', COALESCE(s.permissions, '["VIEW", "SCAN", "VERIFY"]'::jsonb),
      'status', s.status,
      'assignedGate', s.assigned_gate,
      'assignedManagerId', s.assigned_manager_id,
      'assignedManagerName', COALESCE(m.full_name, s.assigned_manager_name),
      'createdAt', s.created_at,
      'createdBy', s.created_by
    ) ORDER BY s.created_at ASC
  ) INTO v_staff
  FROM public.staff_accounts s
  LEFT JOIN public.admin_accounts m ON s.assigned_manager_id = m.id
  WHERE
    (public.is_super_admin_caller() AND upper(s.role) = 'FINANCE_STAFF')
    OR (v_role = 'finance_manager' AND s.assigned_manager_id = v_admin_id AND upper(s.role) = 'FINANCE_STAFF');

  RETURN COALESCE(v_staff, '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_get_manager_finance_staff() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_get_manager_finance_staff() TO authenticated, service_role;

-- 6. SUPER ADMIN-ONLY: CREATE SYSTEM USER (WITH INITIAL STATUS, MANAGER LINK & TEMP PASSWORD FLAG)
CREATE OR REPLACE FUNCTION public.rpc_create_system_user(
  p_user_type TEXT,
  p_full_name TEXT,
  p_username TEXT,
  p_email TEXT,
  p_role TEXT,
  p_department TEXT,
  p_assigned_station TEXT DEFAULT NULL,
  p_permissions JSONB DEFAULT NULL,
  p_auth_user_id UUID DEFAULT NULL,
  p_initial_password TEXT DEFAULT NULL,
  p_admin_id TEXT DEFAULT 'SUPER_ADMIN',
  p_admin_name TEXT DEFAULT 'Super Administrator',
  p_mobile_number TEXT DEFAULT NULL,
  p_staff_code TEXT DEFAULT NULL,
  p_assigned_manager_id TEXT DEFAULT NULL,
  p_initial_status TEXT DEFAULT 'ACTIVE',
  p_must_change_password BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_clean_username TEXT := lower(trim(COALESCE(p_username, '')));
  v_clean_email TEXT := lower(trim(COALESCE(p_email, '')));
  v_norm_status TEXT := upper(trim(COALESCE(p_initial_status, 'ACTIVE')));
  v_clean_mobile TEXT := NULLIF(trim(COALESCE(p_mobile_number, '')), '');
  v_clean_code TEXT := NULLIF(trim(COALESCE(p_staff_code, '')), '');
  v_clean_mgr_id TEXT := NULLIF(trim(COALESCE(p_assigned_manager_id, '')), '');
  v_mgr_name TEXT;
  v_new_id TEXT;
  v_auth_id UUID := p_auth_user_id;
  v_encrypted_pw TEXT;
  v_banned_until TIMESTAMPTZ := NULL;
BEGIN
  IF NOT public.is_super_admin_caller() THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED: Only Super Admin can create accounts.');
  END IF;

  IF v_clean_username = '' OR v_clean_email = '' OR trim(COALESCE(p_full_name, '')) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Full Name, Login ID / Username, and Email are required.');
  END IF;

  IF v_norm_status NOT IN ('ACTIVE', 'INACTIVE') THEN
    v_norm_status := 'ACTIVE';
  END IF;

  IF v_norm_status = 'INACTIVE' THEN
    v_banned_until := '2099-12-31T23:59:59Z'::timestamptz;
  END IF;

  -- Check duplicates across both tables
  IF EXISTS (SELECT 1 FROM public.admin_accounts WHERE lower(username) = v_clean_username)
     OR EXISTS (SELECT 1 FROM public.staff_accounts WHERE lower(username) = v_clean_username) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Login ID / Username "' || p_username || '" is already registered.');
  END IF;

  IF EXISTS (SELECT 1 FROM public.admin_accounts WHERE lower(email) = v_clean_email)
     OR EXISTS (SELECT 1 FROM public.staff_accounts WHERE lower(email) = v_clean_email) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Email "' || p_email || '" is already registered.');
  END IF;

  -- For Finance Staff, enforce valid assigned Finance Manager
  IF upper(p_user_type) <> 'ADMIN' AND upper(trim(COALESCE(p_role, ''))) = 'FINANCE_STAFF' THEN
    IF v_clean_mgr_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Finance Staff must be assigned to a specific Finance Manager.');
    END IF;

    SELECT full_name INTO v_mgr_name
    FROM public.admin_accounts
    WHERE id = v_clean_mgr_id
      AND lower(role) IN ('finance_manager', 'super_admin')
    LIMIT 1;

    IF v_mgr_name IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Selected Assigned Finance Manager account was not found.');
    END IF;
  ELSIF v_clean_mgr_id IS NOT NULL THEN
    SELECT full_name INTO v_mgr_name FROM public.admin_accounts WHERE id = v_clean_mgr_id LIMIT 1;
  END IF;

  -- Provision Supabase Auth credentials securely (password NEVER stored in profile tables or audit logs)
  IF p_initial_password IS NOT NULL AND length(trim(p_initial_password)) > 0 THEN
    IF length(trim(p_initial_password)) < 6 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Initial password must be at least 6 characters long.');
    END IF;

    v_encrypted_pw := crypt(trim(p_initial_password), gen_salt('bf', 10));
    SELECT id INTO v_auth_id FROM auth.users WHERE lower(email) = v_clean_email LIMIT 1;

    IF v_auth_id IS NOT NULL THEN
      UPDATE auth.users
      SET encrypted_password = v_encrypted_pw,
          banned_until = v_banned_until,
          raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
            'full_name', trim(p_full_name),
            'email', v_clean_email,
            'must_change_password', COALESCE(p_must_change_password, true)
          ),
          updated_at = NOW()
      WHERE id = v_auth_id;
    ELSE
      v_auth_id := gen_random_uuid();
      INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        banned_until, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
      ) VALUES (
        v_auth_id,
        '00000000-0000-0000-0000-000000000000'::uuid,
        'authenticated',
        'authenticated',
        v_clean_email,
        v_encrypted_pw,
        NOW(),
        v_banned_until,
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object(
          'full_name', trim(p_full_name),
          'email', v_clean_email,
          'must_change_password', COALESCE(p_must_change_password, true)
        ),
        NOW(),
        NOW()
      );
    END IF;
  END IF;

  IF upper(p_user_type) = 'ADMIN' THEN
    v_new_id := 'ADM-' || to_char(NOW(), 'YYMM') || '-' || floor(random() * 9000 + 1000)::INT;
    INSERT INTO public.admin_accounts (
      id, username, full_name, email, role, status, is_locked, department,
      assigned_station, permissions, auth_user_id, mobile_number, staff_code,
      must_change_password, created_at, updated_at
    ) VALUES (
      v_new_id,
      v_clean_username,
      trim(p_full_name),
      v_clean_email,
      lower(trim(p_role)),
      v_norm_status,
      (v_norm_status <> 'ACTIVE'),
      COALESCE(NULLIF(trim(p_department), ''), 'CENTRAL_ADMIN'),
      p_assigned_station,
      COALESCE(p_permissions, '["VIEW", "VERIFY", "APPROVE", "EXPORT", "MANAGE"]'::jsonb),
      v_auth_id,
      v_clean_mobile,
      COALESCE(v_clean_code, v_new_id),
      COALESCE(p_must_change_password, true),
      NOW(),
      NOW()
    );
  ELSE
    v_new_id := 'STF-' || to_char(NOW(), 'YYMM') || '-' || floor(random() * 9000 + 1000)::INT;
    INSERT INTO public.staff_accounts (
      id, username, full_name, email, role, status, department, assigned_gate,
      permissions, auth_user_id, mobile_number, staff_code, assigned_manager_id,
      assigned_manager_name, must_change_password, created_by, created_at, updated_at
    ) VALUES (
      v_new_id,
      v_clean_username,
      trim(p_full_name),
      v_clean_email,
      upper(trim(p_role)),
      CASE WHEN v_norm_status = 'INACTIVE' THEN 'DISABLED' ELSE 'ACTIVE' END,
      COALESCE(NULLIF(trim(p_department), ''), 'GATE'),
      p_assigned_station,
      COALESCE(p_permissions, '["VIEW", "SCAN", "VERIFY", "APPROVE"]'::jsonb),
      v_auth_id,
      v_clean_mobile,
      COALESCE(v_clean_code, v_new_id),
      v_clean_mgr_id,
      v_mgr_name,
      COALESCE(p_must_change_password, true),
      p_admin_name,
      NOW(),
      NOW()
    );
  END IF;

  -- Immutable Audit Trail (never record passwords)
  INSERT INTO public.admin_audit_logs (
    id, admin_id, admin_username, admin_role, action, target_type, target_id, details, created_at
  ) VALUES (
    'AUD-NEW-' || EXTRACT(EPOCH FROM NOW())::BIGINT || '-' || floor(random() * 900 + 100)::INT,
    p_admin_id,
    p_admin_name,
    'super_admin',
    'ADMIN_ACCOUNT_CREATE',
    'user_account',
    v_new_id,
    'Created ' || p_user_type || ' account ' || v_new_id || ' (' || trim(p_full_name) || ', role: ' || p_role || ', status: ' || v_norm_status || ')' ||
      CASE WHEN v_clean_mgr_id IS NOT NULL THEN ' assigned to manager ' || COALESCE(v_mgr_name, v_clean_mgr_id) ELSE '' END,
    NOW()
  );

  INSERT INTO public.admin_audit_history (
    id, admin_id, admin_name, entity_type, entity_id, action, previous_value, new_value, reason, timestamp
  ) VALUES (
    'HIST-NEW-' || EXTRACT(EPOCH FROM NOW())::BIGINT || '-' || floor(random() * 900 + 100)::INT,
    p_admin_id,
    p_admin_name,
    'STAFF',
    v_new_id,
    'CREATE_ACCOUNT',
    NULL,
    p_role || ' (' || v_norm_status || ')',
    'Account created by Super Admin' || CASE WHEN v_clean_mgr_id IS NOT NULL THEN ' (Assigned Manager: ' || COALESCE(v_mgr_name, v_clean_mgr_id) || ')' ELSE '' END,
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'userId', v_new_id,
    'staffCode', COALESCE(v_clean_code, v_new_id),
    'userType', p_user_type,
    'fullName', trim(p_full_name),
    'username', v_clean_username,
    'role', p_role,
    'status', v_norm_status,
    'assignedManagerId', v_clean_mgr_id,
    'assignedManagerName', v_mgr_name,
    'mustChangePassword', COALESCE(p_must_change_password, true),
    'authUserId', v_auth_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_create_system_user(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_create_system_user(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO authenticated, service_role;

-- 7. SUPER ADMIN-ONLY: DIRECT / TEMPORARY PASSWORD RESET & SESSION REVOCATION
CREATE OR REPLACE FUNCTION public.rpc_set_user_password(
  p_email TEXT,
  p_new_password TEXT,
  p_admin_id TEXT DEFAULT 'SUPER_ADMIN',
  p_admin_name TEXT DEFAULT 'Super Administrator',
  p_must_change_password BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_clean_email TEXT := lower(trim(COALESCE(p_email, '')));
  v_auth_id UUID;
  v_encrypted_pw TEXT;
  v_target_id TEXT;
BEGIN
  IF NOT public.is_super_admin_caller() THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED: Only Super Admin can reset passwords.');
  END IF;

  IF v_clean_email = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Valid email address is required.');
  END IF;

  IF length(COALESCE(trim(p_new_password), '')) < 6 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Password must be at least 6 characters long.');
  END IF;

  v_encrypted_pw := crypt(trim(p_new_password), gen_salt('bf', 10));
  SELECT id INTO v_auth_id FROM auth.users WHERE lower(email) = v_clean_email LIMIT 1;

  IF v_auth_id IS NOT NULL THEN
    UPDATE auth.users
    SET encrypted_password = v_encrypted_pw,
        raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('must_change_password', COALESCE(p_must_change_password, true)),
        updated_at = NOW()
    WHERE id = v_auth_id;

    -- Revoke existing active sessions when password is reset by Super Admin
    DELETE FROM auth.sessions WHERE user_id = v_auth_id;
    UPDATE auth.refresh_tokens SET revoked = true WHERE user_id = v_auth_id::text;
  ELSE
    v_auth_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES (
      v_auth_id,
      '00000000-0000-0000-0000-000000000000'::uuid,
      'authenticated',
      'authenticated',
      v_clean_email,
      v_encrypted_pw,
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('email', v_clean_email, 'must_change_password', COALESCE(p_must_change_password, true)),
      NOW(),
      NOW()
    );
  END IF;

  UPDATE public.admin_accounts
  SET auth_user_id = v_auth_id,
      must_change_password = COALESCE(p_must_change_password, true),
      updated_at = NOW()
  WHERE lower(email) = v_clean_email;

  UPDATE public.staff_accounts
  SET auth_user_id = v_auth_id,
      must_change_password = COALESCE(p_must_change_password, true),
      updated_at = NOW()
  WHERE lower(email) = v_clean_email;

  SELECT COALESCE(
    (SELECT id FROM public.admin_accounts WHERE lower(email) = v_clean_email LIMIT 1),
    (SELECT id FROM public.staff_accounts WHERE lower(email) = v_clean_email LIMIT 1),
    v_clean_email
  ) INTO v_target_id;

  -- Record audit entry without ever logging the password
  INSERT INTO public.admin_audit_logs (
    id, admin_id, admin_username, admin_role, action, target_type, target_id, details, created_at
  ) VALUES (
    'AUD-PW-' || EXTRACT(EPOCH FROM NOW())::BIGINT || '-' || floor(random() * 900 + 100)::INT,
    p_admin_id,
    p_admin_name,
    'super_admin',
    'ADMIN_PASSWORD_RESET',
    'user_credentials',
    v_target_id,
    'Password reset performed by Super Admin (' || p_admin_name || ') for account ' || v_clean_email ||
      CASE WHEN COALESCE(p_must_change_password, true) THEN ' (temporary password; rotation required on next login)' ELSE '' END,
    NOW()
  );

  INSERT INTO public.admin_audit_history (
    id, admin_id, admin_name, entity_type, entity_id, action, previous_value, new_value, reason, timestamp
  ) VALUES (
    'HIST-PW-' || EXTRACT(EPOCH FROM NOW())::BIGINT || '-' || floor(random() * 900 + 100)::INT,
    p_admin_id,
    p_admin_name,
    'STAFF',
    v_target_id,
    'PASSWORD_RESET',
    NULL,
    CASE WHEN COALESCE(p_must_change_password, true) THEN 'TEMPORARY_PASSWORD_SET' ELSE 'PASSWORD_RESET' END,
    'Secure password reset by Super Admin (active sessions revoked)',
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'email', v_clean_email,
    'authUserId', v_auth_id,
    'mustChangePassword', COALESCE(p_must_change_password, true),
    'message', 'Password successfully updated in Supabase Auth and prior sessions revoked.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_set_user_password(TEXT, TEXT, TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_set_user_password(TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO authenticated, service_role;

-- 8. SIGNED-IN USER SELF-SERVICE COMPLETION FOR TEMPORARY PASSWORD ROTATION
CREATE OR REPLACE FUNCTION public.rpc_complete_forced_password_change(
  p_new_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_clean_pw TEXT := trim(COALESCE(p_new_password, ''));
  v_email TEXT;
  v_account_id TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication session required.');
  END IF;

  IF length(v_clean_pw) < 6 THEN
    RETURN jsonb_build_object('success', false, 'error', 'New password must be at least 6 characters long.');
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;

  UPDATE auth.users
  SET encrypted_password = crypt(v_clean_pw, gen_salt('bf', 10)),
      raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"must_change_password": false}'::jsonb,
      updated_at = NOW()
  WHERE id = v_uid;

  UPDATE public.admin_accounts
  SET must_change_password = false,
      updated_at = NOW()
  WHERE auth_user_id = v_uid;

  UPDATE public.staff_accounts
  SET must_change_password = false,
      updated_at = NOW()
  WHERE auth_user_id = v_uid;

  SELECT COALESCE(
    (SELECT id FROM public.admin_accounts WHERE auth_user_id = v_uid LIMIT 1),
    (SELECT id FROM public.staff_accounts WHERE auth_user_id = v_uid LIMIT 1),
    v_uid::text
  ) INTO v_account_id;

  INSERT INTO public.admin_audit_logs (
    id, admin_id, admin_username, admin_role, action, target_type, target_id, details, created_at
  ) VALUES (
    'AUD-PWROT-' || EXTRACT(EPOCH FROM NOW())::BIGINT || '-' || floor(random() * 900 + 100)::INT,
    v_account_id,
    COALESCE(v_email, v_account_id),
    COALESCE(public.current_admin_role(), public.current_event_staff_role(), 'user'),
    'FORCED_PASSWORD_ROTATION',
    'user_credentials',
    v_account_id,
    'User completed required temporary password change at sign-in.',
    NOW()
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_complete_forced_password_change(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_complete_forced_password_change(TEXT) TO authenticated, service_role;

-- 9. SUPER ADMIN-ONLY: STATUS UPDATE & AUTH SESSION REVOCATION
CREATE OR REPLACE FUNCTION public.rpc_manage_user_status(
  p_user_id TEXT,
  p_user_type TEXT,
  p_new_status TEXT,
  p_admin_id TEXT DEFAULT 'SUPER_ADMIN',
  p_admin_name TEXT DEFAULT 'Super Administrator',
  p_reason TEXT DEFAULT 'Status update by Super Admin'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_norm_status TEXT;
  v_active_super_admins INT;
  v_target_role TEXT;
  v_old_status TEXT;
  v_auth_id UUID;
BEGIN
  IF NOT public.is_super_admin_caller() THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED: Only Super Admin can activate or deactivate accounts.');
  END IF;

  v_norm_status := upper(trim(COALESCE(p_new_status, 'ACTIVE')));
  IF v_norm_status NOT IN ('ACTIVE', 'INACTIVE', 'SUSPENDED') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid status: ' || p_new_status);
  END IF;

  IF upper(p_user_type) = 'ADMIN' THEN
    SELECT role, status, auth_user_id INTO v_target_role, v_old_status, v_auth_id
    FROM public.admin_accounts
    WHERE id = p_user_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Admin user not found');
    END IF;

    IF lower(v_target_role) = 'super_admin' AND v_norm_status <> 'ACTIVE' THEN
      SELECT count(*) INTO v_active_super_admins
      FROM public.admin_accounts
      WHERE lower(role) = 'super_admin' AND (status = 'ACTIVE' OR status IS NULL) AND is_locked IS NOT TRUE;

      IF v_active_super_admins <= 1 THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'PROTECTED_ACCOUNT: Cannot deactivate the sole remaining active Super Administrator.'
        );
      END IF;
    END IF;

    UPDATE public.admin_accounts
    SET status = v_norm_status,
        is_locked = (v_norm_status <> 'ACTIVE'),
        updated_at = NOW()
    WHERE id = p_user_id;
  ELSE
    SELECT role, status, auth_user_id INTO v_target_role, v_old_status, v_auth_id
    FROM public.staff_accounts
    WHERE id = p_user_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Staff user not found');
    END IF;

    UPDATE public.staff_accounts
    SET status = CASE WHEN v_norm_status = 'INACTIVE' THEN 'DISABLED' ELSE v_norm_status END,
        updated_at = NOW()
    WHERE id = p_user_id;
  END IF;

  -- Lock/Unlock in Supabase Auth & revoke active sessions when deactivated
  IF v_auth_id IS NOT NULL THEN
    IF v_norm_status <> 'ACTIVE' THEN
      UPDATE auth.users SET banned_until = '2099-12-31T23:59:59Z'::timestamptz WHERE id = v_auth_id;
      DELETE FROM auth.sessions WHERE user_id = v_auth_id;
      UPDATE auth.refresh_tokens SET revoked = true WHERE user_id = v_auth_id::text;
    ELSE
      UPDATE auth.users SET banned_until = NULL WHERE id = v_auth_id;
    END IF;
  END IF;

  INSERT INTO public.admin_audit_logs (
    id, admin_id, admin_username, admin_role, action, target_type, target_id, details, created_at
  ) VALUES (
    'AUD-STATUS-' || EXTRACT(EPOCH FROM NOW())::BIGINT || '-' || floor(random() * 900 + 100)::INT,
    p_admin_id,
    p_admin_name,
    'super_admin',
    'ADMIN_STATUS_UPDATE',
    'admin_account',
    p_user_id,
    'Changed status of ' || p_user_id || ' (' || COALESCE(v_target_role, 'USER') || ') from ' || COALESCE(v_old_status, 'UNKNOWN') || ' to ' || v_norm_status || '. Reason: ' || COALESCE(p_reason, 'No reason provided'),
    NOW()
  );

  INSERT INTO public.admin_audit_history (
    id, admin_id, admin_name, entity_type, entity_id, action, previous_value, new_value, reason, timestamp
  ) VALUES (
    'HIST-' || EXTRACT(EPOCH FROM NOW())::BIGINT || '-' || floor(random() * 900 + 100)::INT,
    p_admin_id,
    p_admin_name,
    'STAFF',
    p_user_id,
    'CHANGE_STATUS',
    v_old_status,
    v_norm_status,
    COALESCE(p_reason, 'Super Admin user status toggle'),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'userId', p_user_id,
    'newStatus', v_norm_status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_manage_user_status(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_manage_user_status(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;

-- 10. SUPER ADMIN-ONLY: PROFILE MODIFICATION & STAFF REASSIGNMENT
CREATE OR REPLACE FUNCTION public.rpc_manage_user_profile(
  p_user_id TEXT,
  p_user_type TEXT,
  p_full_name TEXT,
  p_username TEXT,
  p_email TEXT,
  p_role TEXT,
  p_department TEXT,
  p_assigned_station TEXT,
  p_permissions JSONB,
  p_admin_id TEXT DEFAULT 'SUPER_ADMIN',
  p_admin_name TEXT DEFAULT 'Super Administrator',
  p_reason TEXT DEFAULT 'Profile updated by Super Admin',
  p_mobile_number TEXT DEFAULT NULL,
  p_staff_code TEXT DEFAULT NULL,
  p_assigned_manager_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_clean_username TEXT := lower(trim(COALESCE(p_username, '')));
  v_clean_email TEXT := lower(trim(COALESCE(p_email, '')));
  v_old_role TEXT;
  v_old_mgr_id TEXT;
  v_old_mgr_name TEXT;
  v_new_mgr_id TEXT := NULLIF(trim(COALESCE(p_assigned_manager_id, '')), '');
  v_new_mgr_name TEXT;
BEGIN
  IF NOT public.is_super_admin_caller() THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED: Only Super Admin can modify account profiles.');
  END IF;

  IF upper(p_user_type) = 'ADMIN' THEN
    SELECT role INTO v_old_role FROM public.admin_accounts WHERE id = p_user_id;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Admin user not found');
    END IF;

    IF EXISTS (SELECT 1 FROM public.admin_accounts WHERE id <> p_user_id AND (lower(username) = v_clean_username OR lower(email) = v_clean_email))
       OR EXISTS (SELECT 1 FROM public.staff_accounts WHERE lower(username) = v_clean_username OR lower(email) = v_clean_email) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Username or email already in use by another account.');
    END IF;

    UPDATE public.admin_accounts
    SET full_name = trim(COALESCE(p_full_name, full_name)),
        username = v_clean_username,
        email = v_clean_email,
        role = lower(trim(COALESCE(p_role, role))),
        department = trim(COALESCE(p_department, department)),
        assigned_station = COALESCE(NULLIF(trim(p_assigned_station), ''), assigned_station),
        mobile_number = CASE WHEN p_mobile_number IS NOT NULL THEN NULLIF(trim(p_mobile_number), '') ELSE mobile_number END,
        staff_code = CASE WHEN p_staff_code IS NOT NULL THEN NULLIF(trim(p_staff_code), '') ELSE staff_code END,
        permissions = COALESCE(p_permissions, permissions),
        updated_at = NOW()
    WHERE id = p_user_id;
  ELSE
    SELECT role, assigned_manager_id, assigned_manager_name
    INTO v_old_role, v_old_mgr_id, v_old_mgr_name
    FROM public.staff_accounts
    WHERE id = p_user_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Staff user not found');
    END IF;

    IF EXISTS (SELECT 1 FROM public.staff_accounts WHERE id <> p_user_id AND (lower(username) = v_clean_username OR lower(email) = v_clean_email))
       OR EXISTS (SELECT 1 FROM public.admin_accounts WHERE lower(username) = v_clean_username OR lower(email) = v_clean_email) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Username or email already in use by another account.');
    END IF;

    IF v_new_mgr_id IS NOT NULL THEN
      SELECT full_name INTO v_new_mgr_name
      FROM public.admin_accounts
      WHERE id = v_new_mgr_id
        AND lower(role) IN ('finance_manager', 'super_admin')
      LIMIT 1;
      IF v_new_mgr_name IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Assigned Finance Manager not found.');
      END IF;
    ELSIF upper(trim(COALESCE(p_role, v_old_role))) = 'FINANCE_STAFF' AND p_assigned_manager_id IS NOT NULL AND trim(p_assigned_manager_id) = '' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Finance Staff must remain assigned to a Finance Manager.');
    END IF;

    UPDATE public.staff_accounts
    SET full_name = trim(COALESCE(p_full_name, full_name)),
        username = v_clean_username,
        email = v_clean_email,
        role = upper(trim(COALESCE(p_role, role))),
        department = trim(COALESCE(p_department, department)),
        assigned_gate = trim(COALESCE(p_assigned_station, assigned_gate)),
        mobile_number = CASE WHEN p_mobile_number IS NOT NULL THEN NULLIF(trim(p_mobile_number), '') ELSE mobile_number END,
        staff_code = CASE WHEN p_staff_code IS NOT NULL THEN NULLIF(trim(p_staff_code), '') ELSE staff_code END,
        assigned_manager_id = CASE WHEN p_assigned_manager_id IS NOT NULL THEN v_new_mgr_id ELSE assigned_manager_id END,
        assigned_manager_name = CASE WHEN p_assigned_manager_id IS NOT NULL THEN v_new_mgr_name ELSE assigned_manager_name END,
        permissions = COALESCE(p_permissions, permissions),
        updated_at = NOW()
    WHERE id = p_user_id;

    -- Log staff reassignment separately if manager changed
    IF p_assigned_manager_id IS NOT NULL AND COALESCE(v_old_mgr_id, '') <> COALESCE(v_new_mgr_id, '') THEN
      INSERT INTO public.admin_audit_logs (
        id, admin_id, admin_username, admin_role, action, target_type, target_id, details, created_at
      ) VALUES (
        'AUD-REASSIGN-' || EXTRACT(EPOCH FROM NOW())::BIGINT || '-' || floor(random() * 900 + 100)::INT,
        p_admin_id,
        p_admin_name,
        'super_admin',
        'STAFF_REASSIGNED',
        'user_account',
        p_user_id,
        'Reassigned staff ' || p_user_id || ' from manager ' || COALESCE(v_old_mgr_name, v_old_mgr_id, 'Unassigned') || ' to ' || COALESCE(v_new_mgr_name, v_new_mgr_id, 'Unassigned'),
        NOW()
      );
    END IF;
  END IF;

  INSERT INTO public.admin_audit_logs (
    id, admin_id, admin_username, admin_role, action, target_type, target_id, details, created_at
  ) VALUES (
    'AUD-EDIT-' || EXTRACT(EPOCH FROM NOW())::BIGINT || '-' || floor(random() * 900 + 100)::INT,
    p_admin_id,
    p_admin_name,
    'super_admin',
    'ADMIN_PROFILE_UPDATE',
    'user_account',
    p_user_id,
    'Updated profile for ' || p_user_id || ' (' || COALESCE(p_full_name, '') || '). Role: ' || COALESCE(v_old_role, '') || ' -> ' || COALESCE(p_role, '') || '. Reason: ' || COALESCE(p_reason, ''),
    NOW()
  );

  INSERT INTO public.admin_audit_history (
    id, admin_id, admin_name, entity_type, entity_id, action, previous_value, new_value, reason, timestamp
  ) VALUES (
    'HIST-EDIT-' || EXTRACT(EPOCH FROM NOW())::BIGINT || '-' || floor(random() * 900 + 100)::INT,
    p_admin_id,
    p_admin_name,
    'STAFF',
    p_user_id,
    'UPDATE_PROFILE',
    v_old_role,
    p_role,
    COALESCE(p_reason, 'Profile updated by Super Admin'),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'userId', p_user_id,
    'updatedRole', p_role
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_manage_user_profile(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_manage_user_profile(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;

-- 11. SUPER ADMIN-ONLY: SESSION REVOCATION RPC
CREATE OR REPLACE FUNCTION public.rpc_revoke_user_sessions(
  p_user_id TEXT,
  p_user_type TEXT,
  p_admin_id TEXT DEFAULT 'SUPER_ADMIN',
  p_admin_name TEXT DEFAULT 'Super Administrator',
  p_reason TEXT DEFAULT 'Session revoked by Super Admin'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_auth_id UUID;
  v_deleted INT := 0;
BEGIN
  IF NOT public.is_super_admin_caller() THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED: Only Super Admin can revoke user sessions.');
  END IF;

  IF upper(p_user_type) = 'ADMIN' THEN
    SELECT auth_user_id INTO v_auth_id FROM public.admin_accounts WHERE id = p_user_id;
  ELSE
    SELECT auth_user_id INTO v_auth_id FROM public.staff_accounts WHERE id = p_user_id;
  END IF;

  IF v_auth_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No active authentication link found for this account.');
  END IF;

  DELETE FROM auth.sessions WHERE user_id = v_auth_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  UPDATE auth.refresh_tokens SET revoked = true WHERE user_id = v_auth_id::text;

  INSERT INTO public.admin_audit_logs (
    id, admin_id, admin_username, admin_role, action, target_type, target_id, details, created_at
  ) VALUES (
    'AUD-REV-' || EXTRACT(EPOCH FROM NOW())::BIGINT || '-' || floor(random() * 900 + 100)::INT,
    p_admin_id,
    p_admin_name,
    'super_admin',
    'SESSION_REVOKED',
    'user_credentials',
    p_user_id,
    'Revoked ' || v_deleted || ' active sessions for ' || p_user_id || '. Reason: ' || COALESCE(p_reason, 'Security policy'),
    NOW()
  );

  RETURN jsonb_build_object('success', true, 'revokedSessions', v_deleted);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_revoke_user_sessions(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_revoke_user_sessions(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;

-- 12. HARDEN TABLE RLS POLICIES (MANAGER <-> ASSIGNED STAFF ISOLATION + SUPER ADMIN ACCOUNT CONTROL)

-- admin_accounts: read own or super_admin; writes super_admin only
DROP POLICY IF EXISTS admin_profile_read_own ON public.admin_accounts;
DROP POLICY IF EXISTS admin_profile_super_admin_all ON public.admin_accounts;
DROP POLICY IF EXISTS admin_profile_super_admin_write ON public.admin_accounts;

CREATE POLICY admin_profile_read_own
  ON public.admin_accounts FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid() OR public.is_super_admin_caller());

CREATE POLICY admin_profile_super_admin_write
  ON public.admin_accounts FOR ALL
  TO authenticated
  USING (public.is_super_admin_caller())
  WITH CHECK (public.is_super_admin_caller());

-- staff_accounts: self read, super_admin read/write, finance_manager read ONLY assigned FINANCE_STAFF (no writes!)
DROP POLICY IF EXISTS staff_profile_read_own_or_admin ON public.staff_accounts;
DROP POLICY IF EXISTS staff_profile_admin_insert ON public.staff_accounts;
DROP POLICY IF EXISTS staff_profile_admin_update ON public.staff_accounts;
DROP POLICY IF EXISTS staff_profile_admin_delete ON public.staff_accounts;

CREATE POLICY staff_profile_read_own_or_admin
  ON public.staff_accounts FOR SELECT
  TO authenticated
  USING (
    auth_user_id = auth.uid()
    OR public.is_super_admin_caller()
    OR (
      public.current_admin_role() = 'finance_manager'
      AND assigned_manager_id = public.current_admin_id()
    )
  );

CREATE POLICY staff_profile_admin_insert
  ON public.staff_accounts FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_admin_caller());

CREATE POLICY staff_profile_admin_update
  ON public.staff_accounts FOR UPDATE
  TO authenticated
  USING (public.is_super_admin_caller())
  WITH CHECK (public.is_super_admin_caller());

CREATE POLICY staff_profile_admin_delete
  ON public.staff_accounts FOR DELETE
  TO authenticated
  USING (public.is_super_admin_caller());

-- central_budget: super_admin and finance_manager
DROP POLICY IF EXISTS budget_admin_read ON public.central_budget;
DROP POLICY IF EXISTS budget_admin_write ON public.central_budget;

CREATE POLICY budget_admin_read
  ON public.central_budget FOR SELECT
  TO authenticated
  USING (public.current_admin_role() IN ('super_admin', 'finance_manager'));

CREATE POLICY budget_admin_write
  ON public.central_budget FOR ALL
  TO authenticated
  USING (public.current_admin_role() IN ('super_admin', 'finance_manager'))
  WITH CHECK (public.current_admin_role() IN ('super_admin', 'finance_manager'));

-- staff_allocations: super_admin, assigned finance_manager, or own staff_id
DROP POLICY IF EXISTS allocation_finance_read ON public.staff_allocations;
DROP POLICY IF EXISTS allocation_admin_write ON public.staff_allocations;
DROP POLICY IF EXISTS allocation_manager_insert ON public.staff_allocations;
DROP POLICY IF EXISTS allocation_manager_update ON public.staff_allocations;
DROP POLICY IF EXISTS allocation_admin_delete ON public.staff_allocations;

CREATE POLICY allocation_finance_read
  ON public.staff_allocations FOR SELECT
  TO authenticated
  USING (
    public.is_finance_manager_of_staff(staff_id)
    OR (public.current_event_staff_role() = 'FINANCE_STAFF' AND staff_id = public.current_staff_id())
  );

CREATE POLICY allocation_manager_insert
  ON public.staff_allocations FOR INSERT
  TO authenticated
  WITH CHECK (public.is_finance_manager_of_staff(staff_id));

CREATE POLICY allocation_manager_update
  ON public.staff_allocations FOR UPDATE
  TO authenticated
  USING (public.is_finance_manager_of_staff(staff_id))
  WITH CHECK (public.is_finance_manager_of_staff(staff_id));

CREATE POLICY allocation_admin_delete
  ON public.staff_allocations FOR DELETE
  TO authenticated
  USING (public.is_super_admin_caller());

-- staff_expenses: super_admin, assigned finance_manager, or own staff_id (staff cannot approve/update!)
DROP POLICY IF EXISTS expenses_finance_read ON public.staff_expenses;
DROP POLICY IF EXISTS expenses_staff_insert ON public.staff_expenses;
DROP POLICY IF EXISTS expenses_admin_update ON public.staff_expenses;

CREATE POLICY expenses_finance_read
  ON public.staff_expenses FOR SELECT
  TO authenticated
  USING (
    public.is_finance_manager_of_staff(staff_id)
    OR (public.current_event_staff_role() = 'FINANCE_STAFF' AND staff_id = public.current_staff_id())
  );

CREATE POLICY expenses_staff_insert
  ON public.staff_expenses FOR INSERT
  TO authenticated
  WITH CHECK (
    amount > 0
    AND (
      public.is_super_admin_caller()
      OR (
        public.current_event_staff_role() = 'FINANCE_STAFF'
        AND staff_id = public.current_staff_id()
        AND status = 'SUBMITTED'
      )
    )
  );

CREATE POLICY expenses_admin_update
  ON public.staff_expenses FOR UPDATE
  TO authenticated
  USING (public.is_finance_manager_of_staff(staff_id))
  WITH CHECK (public.is_finance_manager_of_staff(staff_id));

-- financial_ledger: super_admin, assigned finance_manager, or own staff_id
DROP POLICY IF EXISTS ledger_finance_read ON public.financial_ledger;
DROP POLICY IF EXISTS ledger_admin_insert ON public.financial_ledger;

CREATE POLICY ledger_finance_read
  ON public.financial_ledger FOR SELECT
  TO authenticated
  USING (
    public.is_finance_manager_of_staff(staff_id)
    OR (public.current_admin_role() = 'finance_manager' AND transaction_type = 'REGISTRATION_INFLOW')
    OR (public.current_event_staff_role() = 'FINANCE_STAFF' AND staff_id = public.current_staff_id())
  );

CREATE POLICY ledger_admin_insert
  ON public.financial_ledger FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_finance_manager_of_staff(staff_id)
    OR (
      public.current_event_staff_role() = 'FINANCE_STAFF'
      AND staff_id = public.current_staff_id()
      AND transaction_type = 'EXPENSE'
    )
  );

-- expenses table: allow finance_manager alongside super_admin per Finance Portal access
DROP POLICY IF EXISTS "Admin manage expenses" ON public.expenses;
CREATE POLICY "Admin manage expenses"
  ON public.expenses FOR ALL
  TO authenticated
  USING (public.current_admin_role() IN ('super_admin', 'finance_manager'))
  WITH CHECK (public.current_admin_role() IN ('super_admin', 'finance_manager'));

-- 13. UPDATE FINANCIAL TRANSPARENCY SUMMARY RPC (INCLUDE APPROVED STAFF_EXPENSES ONLY, ZERO DUPLICATES)
CREATE OR REPLACE FUNCTION public.rpc_get_financial_transparency_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_total_reg_fee numeric := 0;
    v_total_reg_donations numeric := 0;
    v_total_standalone_donations numeric := 0;
    v_total_donations numeric := 0;
    v_total_collected numeric := 0;
    v_total_direct_expenses numeric := 0;
    v_total_staff_approved_expenses numeric := 0;
    v_total_expenses numeric := 0;
    v_remaining_balance numeric := 0;
    v_paid_student_count integer := 0;
    v_donor_count integer := 0;
    v_categories jsonb := '[]'::jsonb;
    v_recent_expenses jsonb := '[]'::jsonb;
    v_recent_donations jsonb := '[]'::jsonb;
BEGIN
    -- 1. Money from paid registrations
    SELECT
        COALESCE(SUM(registration_fee), 0),
        COALESCE(SUM(donation_amount), 0),
        COUNT(*)
    INTO
        v_total_reg_fee,
        v_total_reg_donations,
        v_paid_student_count
    FROM public.registrations_2027
    WHERE payment_status = 'paid';

    -- 2. Money from standalone donations
    SELECT COALESCE(SUM(amount), 0), COUNT(*)
    INTO v_total_standalone_donations, v_donor_count
    FROM public.donations
    WHERE payment_status = 'paid' AND (registration_id IS NULL OR registration_id = '');

    v_total_donations := v_total_reg_donations + v_total_standalone_donations;
    v_total_collected := v_total_reg_fee + v_total_donations;

    -- 3. Direct approved expense vouchers
    SELECT COALESCE(SUM(amount), 0)
    INTO v_total_direct_expenses
    FROM public.expenses
    WHERE status = 'approved';

    -- 4. Approved staff expenses ONLY (excludes SUBMITTED, REJECTED, VOIDED, and deduplicates against expenses)
    SELECT COALESCE(SUM(se.amount), 0)
    INTO v_total_staff_approved_expenses
    FROM public.staff_expenses se
    WHERE se.status = 'APPROVED'
      AND NOT EXISTS (SELECT 1 FROM public.expenses e WHERE e.id = se.id);

    v_total_expenses := v_total_direct_expenses + v_total_staff_approved_expenses;
    v_remaining_balance := v_total_collected - v_total_expenses;

    -- Category breakdown
    SELECT COALESCE(jsonb_agg(cat_row), '[]'::jsonb)
    INTO v_categories
    FROM (
        SELECT
            c.id,
            c.name_en,
            c.name_bn,
            c.icon,
            c.color,
            c.budget_allocated,
            COALESCE(SUM(e.amount), 0) AS total_spent,
            COUNT(e.id) AS expense_count
        FROM public.expense_categories c
        LEFT JOIN public.expenses e ON e.category_id = c.id AND e.status = 'approved'
        GROUP BY c.id, c.name_en, c.name_bn, c.icon, c.color, c.budget_allocated, c.display_order
        ORDER BY c.display_order ASC
    ) cat_row;

    -- Recent verified expenses (approved direct vouchers + strictly APPROVED staff expenses)
    SELECT COALESCE(jsonb_agg(exp_row), '[]'::jsonb)
    INTO v_recent_expenses
    FROM (
        SELECT * FROM (
            SELECT
                e.id,
                e.category_id,
                e.category,
                e.amount,
                e.expense_date::text AS expense_date,
                e.description,
                e.description_bn,
                e.vendor_name,
                e.responsible_person,
                e.voucher_number,
                e.receipt_url,
                e.receipt_filename,
                e.status,
                e.created_at
            FROM public.expenses e
            WHERE e.status = 'approved'
            UNION ALL
            SELECT
                se.id,
                NULL::text AS category_id,
                se.category,
                se.amount,
                se.expense_date::text AS expense_date,
                se.description,
                NULL::text AS description_bn,
                se.vendor_name,
                se.staff_name AS responsible_person,
                se.id AS voucher_number,
                se.receipt_url,
                NULL::text AS receipt_filename,
                'approved'::text AS status,
                se.created_at
            FROM public.staff_expenses se
            WHERE se.status = 'APPROVED'
              AND NOT EXISTS (SELECT 1 FROM public.expenses e2 WHERE e2.id = se.id)
        ) unified_exp
        ORDER BY unified_exp.expense_date DESC, unified_exp.created_at DESC
        LIMIT 50
    ) exp_row;

    -- Recent donations
    SELECT COALESCE(jsonb_agg(don_row), '[]'::jsonb)
    INTO v_recent_donations
    FROM (
        SELECT
            d.id,
            CASE WHEN d.is_anonymous THEN 'Anonymous Donor' ELSE d.donor_name END AS donor_name,
            CASE
                WHEN d.registration_id IS NOT NULL AND length(d.registration_id) > 6
                THEN substring(d.registration_id from 1 for length(d.registration_id) - 4) || '****'
                ELSE NULL
            END AS masked_registration_id,
            d.batch_name,
            d.passing_year,
            d.amount,
            d.purpose,
            d.payment_method,
            d.donation_date,
            d.is_anonymous,
            d.created_at
        FROM public.donations d
        WHERE d.payment_status = 'paid'
        ORDER BY d.donation_date DESC, d.created_at DESC
        LIMIT 100
    ) don_row;

    RETURN jsonb_build_object(
        'total_collected', v_total_collected,
        'total_registration_fees', v_total_reg_fee,
        'total_donations', v_total_donations,
        'total_expenses', v_total_expenses,
        'remaining_balance', v_remaining_balance,
        'paid_student_count', v_paid_student_count,
        'donor_count', v_donor_count + (SELECT COUNT(*) FROM public.registrations_2027 WHERE payment_status = 'paid' AND donation_amount > 0),
        'categories', v_categories,
        'recent_expenses', v_recent_expenses,
        'recent_donations', v_recent_donations,
        'updated_at', now()
    );
END;
$function$;
