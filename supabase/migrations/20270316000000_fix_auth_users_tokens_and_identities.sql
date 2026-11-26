-- ============================================================================
-- Migration: Fix Supabase GoTrue Login for Staff & Admin Accounts
-- 1. Backfills empty string '' for nullable token columns on auth.users that
--    cause GoTrue v2 sql.Scan to crash with "Database error querying schema".
-- 2. Backfills missing email provider rows in auth.identities.
-- 3. Hardens rpc_create_system_user and rpc_set_user_password (preserving all
--    Super Admin immutability guards from 20270314) so new/reset accounts
--    always initialize token columns as '' and create auth.identities rows.
-- 4. Adds rpc_resolve_login_email so @username login works cleanly under RLS.
-- ============================================================================

-- 1. Repair existing auth.users rows created via SQL inserts/updates
UPDATE auth.users
SET confirmation_token         = COALESCE(confirmation_token, ''),
    recovery_token             = COALESCE(recovery_token, ''),
    email_change_token_new     = COALESCE(email_change_token_new, ''),
    email_change               = COALESCE(email_change, ''),
    email_change_token_current = COALESCE(email_change_token_current, ''),
    phone_change               = COALESCE(phone_change, ''),
    phone_change_token         = COALESCE(phone_change_token, ''),
    reauthentication_token     = COALESCE(reauthentication_token, ''),
    updated_at                 = NOW()
WHERE confirmation_token IS NULL
   OR recovery_token IS NULL
   OR email_change_token_new IS NULL
   OR email_change IS NULL
   OR email_change_token_current IS NULL
   OR phone_change IS NULL
   OR phone_change_token IS NULL
   OR reauthentication_token IS NULL;

-- 2. Backfill missing email identity rows in auth.identities
INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  u.id,
  jsonb_build_object(
    'sub', u.id::text,
    'email', u.email,
    'email_verified', true,
    'phone_verified', false
  ),
  'email',
  u.id::text,
  NOW(),
  NOW(),
  NOW()
FROM auth.users u
WHERE u.email IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM auth.identities i
    WHERE i.user_id = u.id
      AND i.provider = 'email'
  );

-- 3. Update rpc_create_system_user with non-null tokens + auth.identities creation
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
      SET encrypted_password         = v_encrypted_pw,
          banned_until               = v_banned_until,
          email_confirmed_at         = COALESCE(email_confirmed_at, NOW()),
          confirmation_token         = COALESCE(confirmation_token, ''),
          recovery_token             = COALESCE(recovery_token, ''),
          email_change_token_new     = COALESCE(email_change_token_new, ''),
          email_change               = COALESCE(email_change, ''),
          email_change_token_current = COALESCE(email_change_token_current, ''),
          phone_change               = COALESCE(phone_change, ''),
          phone_change_token         = COALESCE(phone_change_token, ''),
          reauthentication_token     = COALESCE(reauthentication_token, ''),
          raw_user_meta_data         = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
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
        banned_until, confirmation_token, recovery_token, email_change_token_new,
        email_change, email_change_token_current, phone_change, phone_change_token,
        reauthentication_token, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
      ) VALUES (
        v_auth_id,
        '00000000-0000-0000-0000-000000000000'::uuid,
        'authenticated',
        'authenticated',
        v_clean_email,
        v_encrypted_pw,
        NOW(),
        v_banned_until,
        '', '', '', '', '', '', '', '',
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

    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    )
    SELECT
      gen_random_uuid(),
      v_auth_id,
      jsonb_build_object('sub', v_auth_id::text, 'email', v_clean_email, 'email_verified', true, 'phone_verified', false),
      'email',
      v_auth_id::text,
      NOW(),
      NOW(),
      NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM auth.identities i
      WHERE i.user_id = v_auth_id AND i.provider = 'email'
    );
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

-- 4. Update rpc_set_user_password with non-null tokens + auth.identities safety
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
    SET encrypted_password         = v_encrypted_pw,
        email_confirmed_at         = COALESCE(email_confirmed_at, NOW()),
        confirmation_token         = COALESCE(confirmation_token, ''),
        recovery_token             = COALESCE(recovery_token, ''),
        email_change_token_new     = COALESCE(email_change_token_new, ''),
        email_change               = COALESCE(email_change, ''),
        email_change_token_current = COALESCE(email_change_token_current, ''),
        phone_change               = COALESCE(phone_change, ''),
        phone_change_token         = COALESCE(phone_change_token, ''),
        reauthentication_token     = COALESCE(reauthentication_token, ''),
        raw_user_meta_data         = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('must_change_password', COALESCE(p_must_change_password, true)),
        updated_at                 = NOW()
    WHERE id = v_auth_id;

    DELETE FROM auth.sessions WHERE user_id = v_auth_id;
    UPDATE auth.refresh_tokens SET revoked = true WHERE user_id = v_auth_id::text;
  ELSE
    v_auth_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      email_change_token_current, phone_change, phone_change_token, reauthentication_token,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES (
      v_auth_id,
      '00000000-0000-0000-0000-000000000000'::uuid,
      'authenticated',
      'authenticated',
      v_clean_email,
      v_encrypted_pw,
      NOW(),
      '', '', '', '', '', '', '', '',
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('email', v_clean_email, 'must_change_password', COALESCE(p_must_change_password, true)),
      NOW(),
      NOW()
    );
  END IF;

  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
  )
  SELECT
    gen_random_uuid(),
    v_auth_id,
    jsonb_build_object('sub', v_auth_id::text, 'email', v_clean_email, 'email_verified', true, 'phone_verified', false),
    'email',
    v_auth_id::text,
    NOW(),
    NOW(),
    NOW()
  WHERE NOT EXISTS (
    SELECT 1 FROM auth.identities i
    WHERE i.user_id = v_auth_id AND i.provider = 'email'
  );

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

-- 5. Resolve @username to email cleanly during pre-login (since account tables deny anon SELECT)
CREATE OR REPLACE FUNCTION public.rpc_resolve_login_email(
  p_identifier TEXT,
  p_portal TEXT DEFAULT 'staff'
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean TEXT := lower(trim(regexp_replace(COALESCE(p_identifier, ''), '^@+', '')));
  v_email TEXT;
BEGIN
  IF v_clean = '' THEN
    RETURN NULL;
  END IF;

  IF lower(COALESCE(p_portal, 'staff')) = 'admin' THEN
    SELECT email INTO v_email
    FROM public.admin_accounts
    WHERE lower(username) = v_clean
       OR lower(email) = v_clean
    LIMIT 1;
  ELSE
    SELECT email INTO v_email
    FROM public.staff_accounts
    WHERE lower(username) = v_clean
       OR lower(email) = v_clean
    LIMIT 1;

    IF v_email IS NULL THEN
      SELECT email INTO v_email
      FROM public.admin_accounts
      WHERE lower(username) = v_clean
         OR lower(email) = v_clean
      LIMIT 1;
    END IF;
  END IF;

  RETURN NULLIF(trim(COALESCE(v_email, '')), '');
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_resolve_login_email(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_resolve_login_email(TEXT, TEXT) TO anon, authenticated, service_role;
