-- ==============================================================================
-- DATABASE MIGRATION: 20270202000000_centralized_user_access_management.sql
-- POLICE LINES SCHOOL AND COLLEGE, FARIDPUR — GRAND REUNION 2027
-- Centralized Role-Based User Management & Security Administration Engine
-- ==============================================================================

-- 1. Ensure required columns on admin_accounts
ALTER TABLE public.admin_accounts 
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ACTIVE',
    ADD COLUMN IF NOT EXISTS department TEXT DEFAULT 'CENTRAL_ADMIN',
    ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '["VIEW", "VERIFY", "APPROVE", "EXPORT", "MANAGE"]'::jsonb,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Ensure required columns on staff_accounts
ALTER TABLE public.staff_accounts 
    ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS department TEXT DEFAULT 'GATE',
    ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '["VIEW", "SCAN", "VERIFY", "APPROVE"]'::jsonb,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 3. UNIFIED USER DISCOVERY RPC: rpc_get_unified_system_users
CREATE OR REPLACE FUNCTION public.rpc_get_unified_system_users()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_users JSONB;
BEGIN
    WITH admin_list AS (
        SELECT 
            a.id,
            'ADMIN' AS user_type,
            a.full_name,
            a.username,
            a.email,
            a.role,
            CASE 
                WHEN lower(a.role) IN ('super_admin', 'superadmin') THEN 'SUPER_ADMIN'
                WHEN lower(a.role) = 'admin' THEN 'ADMIN'
                WHEN lower(a.role) IN ('finance_manager', 'finance') THEN 'FINANCE'
                WHEN lower(a.role) IN ('moderator', 'registration_officer', 'committee_member') THEN 'MANAGER'
                ELSE 'CUSTOM'
            END AS role_category,
            COALESCE(a.department, 'CENTRAL_ADMIN') AS department,
            CASE 
                WHEN upper(COALESCE(a.status, '')) IN ('SUSPENDED', 'SUSPEND') THEN 'SUSPENDED'
                WHEN a.is_locked IS TRUE OR upper(COALESCE(a.status, '')) IN ('INACTIVE', 'DISABLED') THEN 'INACTIVE'
                ELSE 'ACTIVE'
            END AS status,
            'Super Admin Command Center' AS assigned_station,
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
            s.role,
            CASE 
                WHEN upper(s.role) IN ('SUPER_ADMIN', 'SUPERADMIN') THEN 'SUPER_ADMIN'
                WHEN upper(s.role) IN ('ADMIN') THEN 'ADMIN'
                WHEN upper(s.role) IN ('FINANCE_STAFF', 'FINANCE') THEN 'FINANCE'
                WHEN upper(s.role) IN ('GATE_STAFF', 'BREAKFAST_STAFF', 'LUNCH_STAFF', 'DINNER_STAFF', 'DRESS_STAFF', 'STATION_STAFF') THEN 'STAFF'
                WHEN upper(s.role) IN ('MANAGER', 'COORDINATOR', 'INCHARGE') THEN 'MANAGER'
                ELSE 'CUSTOM'
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

GRANT EXECUTE ON FUNCTION public.rpc_get_unified_system_users() TO anon, authenticated, service_role;

-- 4. ATOMIC USER STATUS MANAGEMENT (ACTIVATE / DEACTIVATE / SUSPEND / RESTORE)
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
BEGIN
    v_norm_status := upper(trim(COALESCE(p_new_status, 'ACTIVE')));
    IF v_norm_status NOT IN ('ACTIVE', 'INACTIVE', 'SUSPENDED') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid status: ' || p_new_status);
    END IF;

    -- Safety Check: Protect Super Admin privileges (Cannot deactivate the last active super admin)
    IF upper(p_user_type) = 'ADMIN' THEN
        SELECT role, status INTO v_target_role, v_old_status
        FROM public.admin_accounts
        WHERE id = p_user_id;

        IF NOT FOUND THEN
            RETURN jsonb_build_object('success', false, 'error', 'Admin user not found');
        END IF;

        IF lower(v_target_role) = 'super_admin' AND v_norm_status <> 'ACTIVE' THEN
            SELECT count(*) INTO v_active_super_admins
            FROM public.admin_accounts
            WHERE lower(role) = 'super_admin' AND (status = 'ACTIVE' OR status IS NULL);

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
        SELECT role, status INTO v_target_role, v_old_status
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

    -- Record Immutable Audit Trail
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

GRANT EXECUTE ON FUNCTION public.rpc_manage_user_status(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

-- 5. ATOMIC USER PROFILE UPDATE (EDIT / CHANGE ROLE / ASSIGN PERMISSIONS)
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
    p_reason TEXT DEFAULT 'Profile updated by Super Admin'
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
BEGIN
    IF upper(p_user_type) = 'ADMIN' THEN
        SELECT role INTO v_old_role FROM public.admin_accounts WHERE id = p_user_id;
        IF NOT FOUND THEN
            RETURN jsonb_build_object('success', false, 'error', 'Admin user not found');
        END IF;

        -- Check duplicate username/email in admin_accounts
        IF EXISTS (SELECT 1 FROM public.admin_accounts WHERE id <> p_user_id AND (lower(username) = v_clean_username OR lower(email) = v_clean_email)) THEN
            RETURN jsonb_build_object('success', false, 'error', 'Username or email already in use by another admin.');
        END IF;

        UPDATE public.admin_accounts
        SET full_name = trim(COALESCE(p_full_name, full_name)),
            username = v_clean_username,
            email = v_clean_email,
            role = lower(trim(COALESCE(p_role, role))),
            department = trim(COALESCE(p_department, department)),
            permissions = COALESCE(p_permissions, permissions),
            updated_at = NOW()
        WHERE id = p_user_id;

    ELSE
        SELECT role INTO v_old_role FROM public.staff_accounts WHERE id = p_user_id;
        IF NOT FOUND THEN
            RETURN jsonb_build_object('success', false, 'error', 'Staff user not found');
        END IF;

        IF EXISTS (SELECT 1 FROM public.staff_accounts WHERE id <> p_user_id AND (lower(username) = v_clean_username OR lower(email) = v_clean_email)) THEN
            RETURN jsonb_build_object('success', false, 'error', 'Username or email already in use by another staff member.');
        END IF;

        UPDATE public.staff_accounts
        SET full_name = trim(COALESCE(p_full_name, full_name)),
            username = v_clean_username,
            email = v_clean_email,
            role = upper(trim(COALESCE(p_role, role))),
            department = trim(COALESCE(p_department, department)),
            assigned_gate = trim(COALESCE(p_assigned_station, assigned_gate)),
            permissions = COALESCE(p_permissions, permissions),
            updated_at = NOW()
        WHERE id = p_user_id;
    END IF;

    -- Record Immutable Audit Trail
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

    RETURN jsonb_build_object(
        'success', true,
        'userId', p_user_id,
        'updatedRole', p_role
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_manage_user_profile(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

-- 6. ATOMIC USER CREATION RPC
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
BEGIN
    IF v_clean_username = '' OR v_clean_email = '' OR trim(COALESCE(p_full_name, '')) = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Full Name, Username, and Email are required.');
    END IF;

    IF upper(p_user_type) = 'ADMIN' THEN
        IF EXISTS (SELECT 1 FROM public.admin_accounts WHERE lower(username) = v_clean_username OR lower(email) = v_clean_email) THEN
            RETURN jsonb_build_object('success', false, 'error', 'An admin account with this username or email already exists.');
        END IF;

        v_new_id := 'ADMIN-' || substr(gen_random_uuid()::text, 1, 8);

        INSERT INTO public.admin_accounts (
            id, full_name, username, email, role, department, permissions, status, is_locked, auth_user_id, created_at
        ) VALUES (
            v_new_id,
            trim(p_full_name),
            v_clean_username,
            v_clean_email,
            lower(trim(COALESCE(p_role, 'admin'))),
            trim(COALESCE(p_department, 'CENTRAL_ADMIN')),
            COALESCE(p_permissions, '["VIEW", "VERIFY", "APPROVE", "EXPORT", "MANAGE"]'::jsonb),
            'ACTIVE',
            false,
            p_auth_user_id,
            NOW()
        );

    ELSE
        IF EXISTS (SELECT 1 FROM public.staff_accounts WHERE lower(username) = v_clean_username OR lower(email) = v_clean_email) THEN
            RETURN jsonb_build_object('success', false, 'error', 'A staff account with this username or email already exists.');
        END IF;

        v_new_id := 'STF-' || substr(gen_random_uuid()::text, 1, 6);

        INSERT INTO public.staff_accounts (
            id, full_name, username, email, role, department, assigned_gate, permissions, status, created_by, auth_user_id, created_at
        ) VALUES (
            v_new_id,
            trim(p_full_name),
            v_clean_username,
            v_clean_email,
            upper(trim(COALESCE(p_role, 'GATE_STAFF'))),
            trim(COALESCE(p_department, 'OPERATIONS')),
            trim(COALESCE(p_assigned_station, 'Main Station')),
            COALESCE(p_permissions, '["VIEW", "SCAN", "VERIFY", "APPROVE"]'::jsonb),
            'ACTIVE',
            p_admin_id,
            p_auth_user_id,
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
        'role', p_role
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_create_system_user(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, UUID, TEXT, TEXT) TO anon, authenticated, service_role;
