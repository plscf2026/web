-- ============================================================================
-- Migration: Immutable Super Admin Lock
-- Ensures at most one Super Admin account exists in the database and that
-- no user, admin, or RPC can create another Super Admin or modify/delete
-- the Super Admin account's ID, username, email, role, status, or password.
-- ============================================================================

-- 1. Helper: detect if an email or auth_user_id belongs to the protected Super Admin
CREATE OR REPLACE FUNCTION public.is_protected_super_admin_identity(
  p_email TEXT DEFAULT NULL,
  p_auth_user_id UUID DEFAULT NULL,
  p_account_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_accounts a
    WHERE lower(trim(COALESCE(a.role, ''))) IN ('super_admin', 'superadmin')
      AND (
        (p_account_id IS NOT NULL AND a.id = p_account_id)
        OR (p_auth_user_id IS NOT NULL AND a.auth_user_id = p_auth_user_id)
        OR (
          p_email IS NOT NULL
          AND trim(p_email) <> ''
          AND (
            lower(trim(a.email)) = lower(trim(p_email))
            OR lower(trim(a.username)) = lower(trim(p_email))
          )
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.is_protected_super_admin_identity(TEXT, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_protected_super_admin_identity(TEXT, UUID, TEXT) TO authenticated, service_role;

-- 2. Storage-engine level uniqueness: at most ONE Super Admin in public.admin_accounts
CREATE UNIQUE INDEX IF NOT EXISTS uq_single_super_admin_account
  ON public.admin_accounts ((true))
  WHERE lower(trim(role)) IN ('super_admin', 'superadmin');

-- 3. Trigger on public.admin_accounts: block creating additional Super Admins or modifying/deleting the Super Admin
CREATE OR REPLACE FUNCTION public.fn_protect_immutable_super_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF lower(trim(COALESCE(NEW.role, ''))) IN ('super_admin', 'superadmin') THEN
      IF EXISTS (
        SELECT 1 FROM public.admin_accounts
        WHERE lower(trim(role)) IN ('super_admin', 'superadmin')
      ) THEN
        RAISE EXCEPTION 'SUPER_ADMIN_IMMUTABLE: No additional Super Admin account can be created.'
          USING ERRCODE = '42501';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF lower(trim(COALESCE(OLD.role, ''))) IN ('super_admin', 'superadmin') THEN
      RAISE EXCEPTION 'SUPER_ADMIN_IMMUTABLE: Super Admin account cannot be deleted.'
        USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF lower(trim(COALESCE(OLD.role, ''))) NOT IN ('super_admin', 'superadmin')
       AND lower(trim(COALESCE(NEW.role, ''))) IN ('super_admin', 'superadmin') THEN
      RAISE EXCEPTION 'SUPER_ADMIN_IMMUTABLE: Cannot promote another account to Super Admin.'
        USING ERRCODE = '42501';
    END IF;

    IF lower(trim(COALESCE(OLD.role, ''))) IN ('super_admin', 'superadmin') THEN
      IF NEW.id IS DISTINCT FROM OLD.id
         OR lower(trim(COALESCE(NEW.username, ''))) IS DISTINCT FROM lower(trim(COALESCE(OLD.username, '')))
         OR lower(trim(COALESCE(NEW.email, ''))) IS DISTINCT FROM lower(trim(COALESCE(OLD.email, '')))
         OR lower(trim(COALESCE(NEW.role, ''))) IS DISTINCT FROM lower(trim(COALESCE(OLD.role, '')))
         OR NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id
         OR upper(trim(COALESCE(NEW.status, 'ACTIVE'))) IS DISTINCT FROM upper(trim(COALESCE(OLD.status, 'ACTIVE')))
         OR COALESCE(NEW.is_locked, false) IS DISTINCT FROM COALESCE(OLD.is_locked, false)
         OR COALESCE(NEW.must_change_password, false) IS DISTINCT FROM COALESCE(OLD.must_change_password, false) THEN
        RAISE EXCEPTION 'SUPER_ADMIN_IMMUTABLE: Super Admin ID, email, role, status, and credentials link cannot be changed.'
          USING ERRCODE = '42501';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_immutable_super_admin ON public.admin_accounts;
CREATE TRIGGER trg_protect_immutable_super_admin
  BEFORE INSERT OR UPDATE OR DELETE ON public.admin_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_protect_immutable_super_admin();

-- 4. Trigger on public.staff_accounts: prevent creating/promoting SUPER_ADMIN rows or editing/deleting Super Admin linked row
CREATE OR REPLACE FUNCTION public.fn_protect_immutable_super_admin_staff()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_super_auth_id UUID;
BEGIN
  SELECT auth_user_id INTO v_super_auth_id
  FROM public.admin_accounts
  WHERE lower(trim(role)) IN ('super_admin', 'superadmin')
  LIMIT 1;

  IF TG_OP = 'INSERT' THEN
    IF upper(trim(COALESCE(NEW.role, ''))) IN ('SUPER_ADMIN', 'SUPERADMIN')
       AND v_super_auth_id IS NOT NULL THEN
      RAISE EXCEPTION 'SUPER_ADMIN_IMMUTABLE: Cannot create additional Super Admin staff entries.'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF v_super_auth_id IS NOT NULL AND OLD.auth_user_id = v_super_auth_id THEN
      RAISE EXCEPTION 'SUPER_ADMIN_IMMUTABLE: Protected Super Admin staff entry cannot be deleted.'
        USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF upper(trim(COALESCE(OLD.role, ''))) NOT IN ('SUPER_ADMIN', 'SUPERADMIN')
       AND upper(trim(COALESCE(NEW.role, ''))) IN ('SUPER_ADMIN', 'SUPERADMIN') THEN
      RAISE EXCEPTION 'SUPER_ADMIN_IMMUTABLE: Cannot promote staff account to SUPER_ADMIN.'
        USING ERRCODE = '42501';
    END IF;

    IF v_super_auth_id IS NOT NULL AND OLD.auth_user_id = v_super_auth_id THEN
      IF NEW.id IS DISTINCT FROM OLD.id
         OR lower(trim(COALESCE(NEW.username, ''))) IS DISTINCT FROM lower(trim(COALESCE(OLD.username, '')))
         OR lower(trim(COALESCE(NEW.email, ''))) IS DISTINCT FROM lower(trim(COALESCE(OLD.email, '')))
         OR upper(trim(COALESCE(NEW.role, ''))) IS DISTINCT FROM upper(trim(COALESCE(OLD.role, '')))
         OR NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id
         OR upper(trim(COALESCE(NEW.status, 'ACTIVE'))) IS DISTINCT FROM upper(trim(COALESCE(OLD.status, 'ACTIVE'))) THEN
        RAISE EXCEPTION 'SUPER_ADMIN_IMMUTABLE: Super Admin identity fields cannot be modified.'
          USING ERRCODE = '42501';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_immutable_super_admin_staff ON public.staff_accounts;
CREATE TRIGGER trg_protect_immutable_super_admin_staff
  BEFORE INSERT OR UPDATE OR DELETE ON public.staff_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_protect_immutable_super_admin_staff();

-- 5. Attempt trigger on auth.users to block changing Super Admin email, encrypted_password, or deleting auth user
--    (Safely skips with NOTICE if managed auth schema restricts direct DDL trigger ownership)
CREATE OR REPLACE FUNCTION public.fn_protect_immutable_super_admin_auth()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF public.is_protected_super_admin_identity(OLD.email, OLD.id, NULL) THEN
      RAISE EXCEPTION 'SUPER_ADMIN_IMMUTABLE: Super Admin auth account cannot be deleted.'
        USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF public.is_protected_super_admin_identity(OLD.email, OLD.id, NULL) THEN
      IF lower(trim(COALESCE(NEW.email, ''))) IS DISTINCT FROM lower(trim(COALESCE(OLD.email, '')))
         OR NEW.encrypted_password IS DISTINCT FROM OLD.encrypted_password
         OR NEW.banned_until IS DISTINCT FROM OLD.banned_until
         OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
        RAISE EXCEPTION 'SUPER_ADMIN_IMMUTABLE: Super Admin login email and password are permanently locked.'
          USING ERRCODE = '42501';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

DO $$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS trg_protect_immutable_super_admin_auth ON auth.users';
  EXECUTE 'CREATE TRIGGER trg_protect_immutable_super_admin_auth BEFORE UPDATE OR DELETE ON auth.users FOR EACH ROW EXECUTE FUNCTION public.fn_protect_immutable_super_admin_auth()';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'auth.users trigger skipped due to schema ownership; RPC and public table immutability guards remain active.';
END $$;

-- 6. Harden rpc_create_system_user: disallow creating Super Admin accounts or reusing Super Admin email/username
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
  v_clean_role TEXT := lower(trim(COALESCE(p_role, '')));
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

  IF v_clean_role IN ('super_admin', 'superadmin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'SUPER_ADMIN_IMMUTABLE: Super Admin account creation is permanently locked.');
  END IF;

  IF public.is_protected_super_admin_identity(v_clean_email, v_auth_id, NULL)
     OR public.is_protected_super_admin_identity(v_clean_username, NULL, NULL) THEN
    RETURN jsonb_build_object('success', false, 'error', 'SUPER_ADMIN_IMMUTABLE: Cannot overwrite or reuse the Super Admin ID or email.');
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

  IF EXISTS (SELECT 1 FROM public.admin_accounts WHERE lower(username) = v_clean_username)
     OR EXISTS (SELECT 1 FROM public.staff_accounts WHERE lower(username) = v_clean_username) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Login ID / Username "' || p_username || '" is already registered.');
  END IF;

  IF EXISTS (SELECT 1 FROM public.admin_accounts WHERE lower(email) = v_clean_email)
     OR EXISTS (SELECT 1 FROM public.staff_accounts WHERE lower(email) = v_clean_email) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Email "' || p_email || '" is already registered.');
  END IF;

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
      v_clean_role,
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

-- 7. Harden rpc_set_user_password: reject resetting Super Admin password
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

  IF public.is_protected_super_admin_identity(v_clean_email, NULL, NULL) THEN
    RETURN jsonb_build_object('success', false, 'error', 'SUPER_ADMIN_IMMUTABLE: Super Admin password cannot be changed.');
  END IF;

  IF length(COALESCE(trim(p_new_password), '')) < 6 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Password must be at least 6 characters long.');
  END IF;

  v_encrypted_pw := crypt(trim(p_new_password), gen_salt('bf', 10));
  SELECT id INTO v_auth_id FROM auth.users WHERE lower(email) = v_clean_email LIMIT 1;

  IF v_auth_id IS NOT NULL THEN
    IF public.is_protected_super_admin_identity(NULL, v_auth_id, NULL) THEN
      RETURN jsonb_build_object('success', false, 'error', 'SUPER_ADMIN_IMMUTABLE: Super Admin password cannot be changed.');
    END IF;

    UPDATE auth.users
    SET encrypted_password = v_encrypted_pw,
        raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('must_change_password', COALESCE(p_must_change_password, true)),
        updated_at = NOW()
    WHERE id = v_auth_id;

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

-- 8. Harden rpc_complete_forced_password_change: disallow changing Super Admin password
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

  IF public.is_protected_super_admin_identity(NULL, v_uid, NULL) THEN
    RETURN jsonb_build_object('success', false, 'error', 'SUPER_ADMIN_IMMUTABLE: Super Admin password cannot be changed.');
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

-- 9. Harden rpc_manage_user_status: reject modifying Super Admin status
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
  v_target_role TEXT;
  v_old_status TEXT;
  v_auth_id UUID;
BEGIN
  IF NOT public.is_super_admin_caller() THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED: Only Super Admin can activate or deactivate accounts.');
  END IF;

  IF upper(p_user_type) = 'ADMIN' AND public.is_protected_super_admin_identity(NULL, NULL, p_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'SUPER_ADMIN_IMMUTABLE: Super Admin account status cannot be modified.');
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

    IF public.is_protected_super_admin_identity(NULL, v_auth_id, NULL) THEN
      RETURN jsonb_build_object('success', false, 'error', 'SUPER_ADMIN_IMMUTABLE: Protected Super Admin entry cannot be modified.');
    END IF;

    UPDATE public.staff_accounts
    SET status = CASE WHEN v_norm_status = 'INACTIVE' THEN 'DISABLED' ELSE v_norm_status END,
        updated_at = NOW()
    WHERE id = p_user_id;
  END IF;

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

-- 10. Harden rpc_manage_user_profile: reject modifying Super Admin profile/ID/email/role or promoting to super_admin
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
  v_clean_role TEXT := lower(trim(COALESCE(p_role, '')));
  v_old_role TEXT;
  v_old_mgr_id TEXT;
  v_old_mgr_name TEXT;
  v_new_mgr_id TEXT := NULLIF(trim(COALESCE(p_assigned_manager_id, '')), '');
  v_new_mgr_name TEXT;
  v_staff_auth_id UUID;
BEGIN
  IF NOT public.is_super_admin_caller() THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED: Only Super Admin can modify account profiles.');
  END IF;

  IF v_clean_role IN ('super_admin', 'superadmin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'SUPER_ADMIN_IMMUTABLE: Super Admin role and ID cannot be created or reassigned.');
  END IF;

  IF upper(p_user_type) = 'ADMIN' THEN
    IF public.is_protected_super_admin_identity(NULL, NULL, p_user_id) THEN
      RETURN jsonb_build_object('success', false, 'error', 'SUPER_ADMIN_IMMUTABLE: Super Admin ID, email, and profile are permanently locked.');
    END IF;

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
        role = v_clean_role,
        department = trim(COALESCE(p_department, department)),
        assigned_station = COALESCE(NULLIF(trim(p_assigned_station), ''), assigned_station),
        mobile_number = CASE WHEN p_mobile_number IS NOT NULL THEN NULLIF(trim(p_mobile_number), '') ELSE mobile_number END,
        staff_code = CASE WHEN p_staff_code IS NOT NULL THEN NULLIF(trim(p_staff_code), '') ELSE staff_code END,
        permissions = COALESCE(p_permissions, permissions),
        updated_at = NOW()
    WHERE id = p_user_id;
  ELSE
    SELECT role, assigned_manager_id, assigned_manager_name, auth_user_id
    INTO v_old_role, v_old_mgr_id, v_old_mgr_name, v_staff_auth_id
    FROM public.staff_accounts
    WHERE id = p_user_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Staff user not found');
    END IF;

    IF public.is_protected_super_admin_identity(NULL, v_staff_auth_id, NULL) THEN
      RETURN jsonb_build_object('success', false, 'error', 'SUPER_ADMIN_IMMUTABLE: Protected Super Admin entry cannot be modified.');
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
