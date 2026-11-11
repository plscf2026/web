-- =========================================================================
-- Police Lines School & College Faridpur — Reunion 2026
-- Testing Credentials Seed Script
-- Email / Username: admin@gmail.com
-- Password / Access PIN: admin@123
-- =========================================================================

-- Note: In Supabase Auth, passwords are encrypted with bcrypt.
-- You can either create this user via Supabase Dashboard / Auth API,
-- or run this script in the SQL editor:

DO $$
DECLARE
  v_user_id UUID := 'a0000000-0000-0000-0000-000000000001'::uuid;
  v_encrypted_pw TEXT;
BEGIN
  -- Generate bcrypt hash for 'admin@123'
  v_encrypted_pw := crypt('admin@123', gen_salt('bf'));

  -- 1. Ensure user exists in auth.users
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@gmail.com') THEN
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      role,
      aud
    ) VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000'::uuid,
      'admin@gmail.com',
      v_encrypted_pw,
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"System Administrator"}'::jsonb,
      now(),
      now(),
      'authenticated',
      'authenticated'
    );
  ELSE
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'admin@gmail.com';
    UPDATE auth.users 
    SET encrypted_password = v_encrypted_pw, email_confirmed_at = now()
    WHERE id = v_user_id;
  END IF;

  -- 2. Link to public.admin_accounts (Super Admin slot)
  IF NOT EXISTS (SELECT 1 FROM public.admin_accounts WHERE email = 'admin@gmail.com' OR username = 'admin@gmail.com') THEN
    INSERT INTO public.admin_accounts (
      id,
      auth_user_id,
      username,
      full_name,
      email,
      role,
      is_locked,
      created_at
    ) VALUES (
      'admin-master-001',
      v_user_id,
      'admin@gmail.com',
      'System Administrator (Testing)',
      'admin@gmail.com',
      'super_admin',
      false,
      now()
    ) ON CONFLICT DO NOTHING;
  ELSE
    UPDATE public.admin_accounts
    SET auth_user_id = v_user_id, role = 'super_admin'
    WHERE email = 'admin@gmail.com' OR username = 'admin@gmail.com';
  END IF;

  -- 3. Link to public.staff_accounts (Universal Staff & Scanner Access)
  IF NOT EXISTS (SELECT 1 FROM public.staff_accounts WHERE email = 'admin@gmail.com' OR username = 'admin@gmail.com') THEN
    INSERT INTO public.staff_accounts (
      id,
      auth_user_id,
      full_name,
      username,
      email,
      role,
      status,
      assigned_gate,
      created_at,
      created_by
    ) VALUES (
      'staff-master-001',
      v_user_id,
      'System Administrator (Testing)',
      'admin@gmail.com',
      'admin@gmail.com',
      'SUPER_ADMIN',
      'ACTIVE',
      'All Gates / All Modules',
      now(),
      'SYSTEM_TEST_SEED'
    ) ON CONFLICT DO NOTHING;
  ELSE
    UPDATE public.staff_accounts
    SET auth_user_id = v_user_id, role = 'SUPER_ADMIN', status = 'ACTIVE'
    WHERE email = 'admin@gmail.com' OR username = 'admin@gmail.com';
  END IF;

END $$;

