-- ==============================================================================
-- DATABASE MIGRATION: 20270203000000_direct_password_management.sql
-- POLICE LINES SCHOOL AND COLLEGE, FARIDPUR — GRAND REUNION 2027
-- Direct Password Setting & Credential Management Engine for Super Admins
-- ==============================================================================

-- 1. DIRECT PASSWORD SETTING RPC
CREATE OR REPLACE FUNCTION public.rpc_set_user_password(
    p_email TEXT,
    p_new_password TEXT,
    p_admin_id TEXT DEFAULT 'SUPER_ADMIN',
    p_admin_name TEXT DEFAULT 'Super Administrator'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_clean_email TEXT := lower(trim(COALESCE(p_email, '')));
    v_auth_id UUID;
    v_salt TEXT;
    v_encrypted_pw TEXT;
BEGIN
    IF v_clean_email = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Valid email address is required.');
    END IF;

    IF length(COALESCE(p_new_password, '')) < 6 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Password must be at least 6 characters long.');
    END IF;

    -- Generate blowfish hash
    v_encrypted_pw := crypt(p_new_password, gen_salt('bf', 10));

    -- Check if user exists in auth.users
    SELECT id INTO v_auth_id FROM auth.users WHERE lower(email) = v_clean_email LIMIT 1;

    IF v_auth_id IS NOT NULL THEN
        -- Update existing auth.users password
        UPDATE auth.users
        SET encrypted_password = v_encrypted_pw,
            updated_at = NOW()
        WHERE id = v_auth_id;
    ELSE
        -- Create new auth.users record
        v_auth_id := gen_random_uuid();
        INSERT INTO auth.users (
            id,
            instance_id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at
        ) VALUES (
            v_auth_id,
            '00000000-0000-0000-0000-000000000000'::uuid,
            'authenticated',
            'authenticated',
            v_clean_email,
            v_encrypted_pw,
            NOW(),
            '{"provider":"email","providers":["email"]}'::jsonb,
            jsonb_build_object('email', v_clean_email),
            NOW(),
            NOW()
        );
    END IF;

    -- Ensure auth_user_id is synced in admin_accounts
    UPDATE public.admin_accounts
    SET auth_user_id = v_auth_id,
        updated_at = NOW()
    WHERE lower(email) = v_clean_email AND (auth_user_id IS NULL OR auth_user_id != v_auth_id);

    -- Ensure auth_user_id is synced in staff_accounts
    UPDATE public.staff_accounts
    SET auth_user_id = v_auth_id,
        updated_at = NOW()
    WHERE lower(email) = v_clean_email AND (auth_user_id IS NULL OR auth_user_id != v_auth_id);

    -- Insert Audit Trail
    INSERT INTO public.admin_audit_logs (
        id, admin_id, admin_username, admin_role, action, target_type, target_id, details, created_at
    ) VALUES (
        'AUD-PW-' || EXTRACT(EPOCH FROM NOW())::BIGINT || '-' || floor(random() * 900 + 100)::INT,
        p_admin_id,
        p_admin_name,
        'super_admin',
        'ADMIN_PASSWORD_RESET',
        'user_credentials',
        v_clean_email,
        'Direct password update performed by ' || p_admin_name || ' for user ' || v_clean_email,
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'email', v_clean_email,
        'authUserId', v_auth_id,
        'message', 'Password successfully updated in Supabase Auth.'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_set_user_password(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

-- 2. UPDATE rpc_create_system_user TO HANDLE DIRECT PASSWORD CREATION
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
    p_admin_name TEXT DEFAULT 'Super Administrator'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_clean_username TEXT := lower(trim(COALESCE(p_username, '')));
    v_clean_email TEXT := lower(trim(COALESCE(p_email, '')));
    v_new_id TEXT;
    v_auth_id UUID := p_auth_user_id;
    v_encrypted_pw TEXT;
BEGIN
    IF v_clean_username = '' OR v_clean_email = '' OR trim(COALESCE(p_full_name, '')) = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Full Name, Username, and Email are required.');
    END IF;

    -- Check duplicate username in admin_accounts
    IF EXISTS (SELECT 1 FROM public.admin_accounts WHERE lower(username) = v_clean_username) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Username "' || p_username || '" is already registered.');
    END IF;

    -- Check duplicate username in staff_accounts
    IF EXISTS (SELECT 1 FROM public.staff_accounts WHERE lower(username) = v_clean_username) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Username "' || p_username || '" is already registered.');
    END IF;

    -- Check duplicate email in admin_accounts
    IF EXISTS (SELECT 1 FROM public.admin_accounts WHERE lower(email) = v_clean_email) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Email "' || p_email || '" is already registered.');
    END IF;

    -- Check duplicate email in staff_accounts
    IF EXISTS (SELECT 1 FROM public.staff_accounts WHERE lower(email) = v_clean_email) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Email "' || p_email || '" is already registered.');
    END IF;

    -- If initial password is provided, provision in auth.users
    IF p_initial_password IS NOT NULL AND length(trim(p_initial_password)) >= 6 THEN
        v_encrypted_pw := crypt(trim(p_initial_password), gen_salt('bf', 10));
        
        -- Check if user already exists in auth.users
        SELECT id INTO v_auth_id FROM auth.users WHERE lower(email) = v_clean_email LIMIT 1;
        
        IF v_auth_id IS NOT NULL THEN
            UPDATE auth.users
            SET encrypted_password = v_encrypted_pw,
                updated_at = NOW()
            WHERE id = v_auth_id;
        ELSE
            v_auth_id := gen_random_uuid();
            INSERT INTO auth.users (
                id,
                instance_id,
                aud,
                role,
                email,
                encrypted_password,
                email_confirmed_at,
                raw_app_meta_data,
                raw_user_meta_data,
                created_at,
                updated_at
            ) VALUES (
                v_auth_id,
                '00000000-0000-0000-0000-000000000000'::uuid,
                'authenticated',
                'authenticated',
                v_clean_email,
                v_encrypted_pw,
                NOW(),
                '{"provider":"email","providers":["email"]}'::jsonb,
                jsonb_build_object('full_name', p_full_name, 'email', v_clean_email),
                NOW(),
                NOW()
            );
        END IF;
    END IF;

    IF upper(p_user_type) = 'ADMIN' THEN
        v_new_id := 'ADM-' || to_char(NOW(), 'YYMM') || '-' || floor(random() * 9000 + 1000)::INT;
        INSERT INTO public.admin_accounts (
            id,
            username,
            full_name,
            email,
            role,
            status,
            department,
            permissions,
            auth_user_id,
            created_at,
            updated_at
        ) VALUES (
            v_new_id,
            v_clean_username,
            trim(p_full_name),
            v_clean_email,
            lower(trim(p_role)),
            'ACTIVE',
            COALESCE(p_department, 'CENTRAL_ADMIN'),
            COALESCE(p_permissions, '["VIEW", "VERIFY", "APPROVE", "EXPORT", "MANAGE"]'::jsonb),
            v_auth_id,
            NOW(),
            NOW()
        );
    ELSE
        v_new_id := 'STF-' || to_char(NOW(), 'YYMM') || '-' || floor(random() * 9000 + 1000)::INT;
        INSERT INTO public.staff_accounts (
            id,
            username,
            full_name,
            email,
            role,
            status,
            department,
            assigned_gate,
            permissions,
            auth_user_id,
            created_by,
            created_at,
            updated_at
        ) VALUES (
            v_new_id,
            v_clean_username,
            trim(p_full_name),
            v_clean_email,
            upper(trim(p_role)),
            'ACTIVE',
            COALESCE(p_department, 'GATE'),
            p_assigned_station,
            COALESCE(p_permissions, '["VIEW", "SCAN", "VERIFY", "APPROVE"]'::jsonb),
            v_auth_id,
            p_admin_name,
            NOW(),
            NOW()
        );
    END IF;

    -- Record Audit Log
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
        'Created new ' || p_user_type || ' account ' || v_new_id || ' for ' || p_full_name || ' with role ' || p_role,
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'userId', v_new_id,
        'userType', p_user_type,
        'fullName', p_full_name,
        'role', p_role,
        'authUserId', v_auth_id
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_create_system_user(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, UUID, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
