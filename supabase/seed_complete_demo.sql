-- =========================================================================
-- Police Lines School & College Faridpur — Reunion Enterprise Database Seed
-- Comprehensive Demonstration Dataset: 40 Students, 13 Staff, ID Cards,
-- Gates, Food Pavilions, Dress Booths, Financial Ledger & Budget
-- =========================================================================

-- Note: All staff accounts are pre-configured with test password: admin@123

DO $$
DECLARE
  v_encrypted_pw TEXT := crypt('admin@123', gen_salt('bf'));
  v_user_uuid UUID;
BEGIN

-- 1. SEED AUTH USERS & ADMIN ACCOUNTS

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@gmail.com') THEN
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud
    ) VALUES (
      '00000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
      'admin@gmail.com', v_encrypted_pw, now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"System Administrator (Testing)"}'::jsonb,
      now(), now(), 'authenticated', 'authenticated'
    );
  END IF;

  INSERT INTO public.admin_accounts (id, auth_user_id, username, full_name, email, role, is_locked, created_at)
  VALUES ('ADM-STF-TEST-ADMIN', '00000000-0000-0000-0000-000000000001'::uuid, 'admin@gmail.com', 'System Administrator (Testing)', 'admin@gmail.com', 'super_admin', false, now())
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

  INSERT INTO public.staff_accounts (id, auth_user_id, full_name, username, email, role, department, permissions, status, assigned_gate, created_at, created_by)
  VALUES ('STF-TEST-ADMIN', '00000000-0000-0000-0000-000000000001'::uuid, 'System Administrator (Testing)', 'admin@gmail.com', 'admin@gmail.com', 'SUPER_ADMIN', 'ALL_SERVICES', '["VIEW","SCAN","VERIFY","APPROVE","REJECT","EXPORT","MANAGE"]'::jsonb, 'ACTIVE', 'All Gates / All Modules', now(), 'SYSTEM_SEED')
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, role = EXCLUDED.role, department = EXCLUDED.department, permissions = EXCLUDED.permissions;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'gate@gmail.com') THEN
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud
    ) VALUES (
      '00000000-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
      'gate@gmail.com', v_encrypted_pw, now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Tariqul Islam (Gate Lead)"}'::jsonb,
      now(), now(), 'authenticated', 'authenticated'
    );
  END IF;

  INSERT INTO public.admin_accounts (id, auth_user_id, username, full_name, email, role, is_locked, created_at)
  VALUES ('ADM-STF-001', '00000000-0000-0000-0000-000000000002'::uuid, 'gate@gmail.com', 'Tariqul Islam (Gate Lead)', 'gate@gmail.com', 'admin', false, now())
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

  INSERT INTO public.staff_accounts (id, auth_user_id, full_name, username, email, role, department, permissions, status, assigned_gate, created_at, created_by)
  VALUES ('STF-001', '00000000-0000-0000-0000-000000000002'::uuid, 'Tariqul Islam (Gate Lead)', 'gate@gmail.com', 'gate@gmail.com', 'GATE_STAFF', 'GATE', '["VIEW","SCAN","VERIFY","APPROVE"]'::jsonb, 'ACTIVE', 'Gate 01 - Main Entrance', now(), 'SYSTEM_SEED')
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, role = EXCLUDED.role, department = EXCLUDED.department, permissions = EXCLUDED.permissions;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'food@gmail.com') THEN
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud
    ) VALUES (
      '00000000-0000-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
      'food@gmail.com', v_encrypted_pw, now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Mohammad Faruk Hossain (Lunch Incharge)"}'::jsonb,
      now(), now(), 'authenticated', 'authenticated'
    );
  END IF;

  INSERT INTO public.admin_accounts (id, auth_user_id, username, full_name, email, role, is_locked, created_at)
  VALUES ('ADM-STF-002', '00000000-0000-0000-0000-000000000003'::uuid, 'food@gmail.com', 'Mohammad Faruk Hossain (Lunch Incharge)', 'food@gmail.com', 'admin', false, now())
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

  INSERT INTO public.staff_accounts (id, auth_user_id, full_name, username, email, role, department, permissions, status, assigned_gate, created_at, created_by)
  VALUES ('STF-002', '00000000-0000-0000-0000-000000000003'::uuid, 'Mohammad Faruk Hossain (Lunch Incharge)', 'food@gmail.com', 'food@gmail.com', 'LUNCH_STAFF', 'LUNCH', '["VIEW","SCAN","VERIFY","APPROVE"]'::jsonb, 'ACTIVE', 'Food Pavilion A (Lunch)', now(), 'SYSTEM_SEED')
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, role = EXCLUDED.role, department = EXCLUDED.department, permissions = EXCLUDED.permissions;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'breakfast@gmail.com') THEN
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud
    ) VALUES (
      '00000000-0000-0000-0000-000000000004'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
      'breakfast@gmail.com', v_encrypted_pw, now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Nasir Uddin (Breakfast Lead)"}'::jsonb,
      now(), now(), 'authenticated', 'authenticated'
    );
  END IF;

  INSERT INTO public.admin_accounts (id, auth_user_id, username, full_name, email, role, is_locked, created_at)
  VALUES ('ADM-STF-003', '00000000-0000-0000-0000-000000000004'::uuid, 'breakfast@gmail.com', 'Nasir Uddin (Breakfast Lead)', 'breakfast@gmail.com', 'admin', false, now())
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

  INSERT INTO public.staff_accounts (id, auth_user_id, full_name, username, email, role, department, permissions, status, assigned_gate, created_at, created_by)
  VALUES ('STF-003', '00000000-0000-0000-0000-000000000004'::uuid, 'Nasir Uddin (Breakfast Lead)', 'breakfast@gmail.com', 'breakfast@gmail.com', 'BREAKFAST_STAFF', 'BREAKFAST', '["VIEW","SCAN","VERIFY","APPROVE"]'::jsonb, 'ACTIVE', 'Food Pavilion B (Breakfast)', now(), 'SYSTEM_SEED')
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, role = EXCLUDED.role, department = EXCLUDED.department, permissions = EXCLUDED.permissions;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'dress@gmail.com') THEN
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud
    ) VALUES (
      '00000000-0000-0000-0000-000000000005'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
      'dress@gmail.com', v_encrypted_pw, now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Jamal Uddin Chowdhury (Kit & T-Shirt)"}'::jsonb,
      now(), now(), 'authenticated', 'authenticated'
    );
  END IF;

  INSERT INTO public.admin_accounts (id, auth_user_id, username, full_name, email, role, is_locked, created_at)
  VALUES ('ADM-STF-004', '00000000-0000-0000-0000-000000000005'::uuid, 'dress@gmail.com', 'Jamal Uddin Chowdhury (Kit & T-Shirt)', 'dress@gmail.com', 'admin', false, now())
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

  INSERT INTO public.staff_accounts (id, auth_user_id, full_name, username, email, role, department, permissions, status, assigned_gate, created_at, created_by)
  VALUES ('STF-004', '00000000-0000-0000-0000-000000000005'::uuid, 'Jamal Uddin Chowdhury (Kit & T-Shirt)', 'dress@gmail.com', 'dress@gmail.com', 'DRESS_STAFF', 'DRESS', '["VIEW","SCAN","VERIFY","APPROVE"]'::jsonb, 'ACTIVE', 'Distribution Booth 01', now(), 'SYSTEM_SEED')
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, role = EXCLUDED.role, department = EXCLUDED.department, permissions = EXCLUDED.permissions;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'finance@gmail.com') THEN
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud
    ) VALUES (
      '00000000-0000-0000-0000-000000000006'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
      'finance@gmail.com', v_encrypted_pw, now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Md. Shafiqul Alam (Finance Secretary)"}'::jsonb,
      now(), now(), 'authenticated', 'authenticated'
    );
  END IF;

  INSERT INTO public.admin_accounts (id, auth_user_id, username, full_name, email, role, is_locked, created_at)
  VALUES ('ADM-STF-005', '00000000-0000-0000-0000-000000000006'::uuid, 'finance@gmail.com', 'Md. Shafiqul Alam (Finance Secretary)', 'finance@gmail.com', 'admin', false, now())
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

  INSERT INTO public.staff_accounts (id, auth_user_id, full_name, username, email, role, department, permissions, status, assigned_gate, created_at, created_by)
  VALUES ('STF-005', '00000000-0000-0000-0000-000000000006'::uuid, 'Md. Shafiqul Alam (Finance Secretary)', 'finance@gmail.com', 'finance@gmail.com', 'FINANCE_STAFF', 'FINANCE', '["VIEW","VERIFY","APPROVE","EXPORT"]'::jsonb, 'ACTIVE', 'Central Accounts Office', now(), 'SYSTEM_SEED')
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, role = EXCLUDED.role, department = EXCLUDED.department, permissions = EXCLUDED.permissions;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'dinner@gmail.com') THEN
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud
    ) VALUES (
      '00000000-0000-0000-0000-000000000007'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
      'dinner@gmail.com', v_encrypted_pw, now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Abdur Rahim (Dinner Incharge)"}'::jsonb,
      now(), now(), 'authenticated', 'authenticated'
    );
  END IF;

  INSERT INTO public.admin_accounts (id, auth_user_id, username, full_name, email, role, is_locked, created_at)
  VALUES ('ADM-STF-006', '00000000-0000-0000-0000-000000000007'::uuid, 'dinner@gmail.com', 'Abdur Rahim (Dinner Incharge)', 'dinner@gmail.com', 'admin', false, now())
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

  INSERT INTO public.staff_accounts (id, auth_user_id, full_name, username, email, role, department, permissions, status, assigned_gate, created_at, created_by)
  VALUES ('STF-006', '00000000-0000-0000-0000-000000000007'::uuid, 'Abdur Rahim (Dinner Incharge)', 'dinner@gmail.com', 'dinner@gmail.com', 'DINNER_STAFF', 'DINNER', '["VIEW","SCAN","VERIFY","APPROVE"]'::jsonb, 'ACTIVE', 'Food Pavilion C (Dinner)', now(), 'SYSTEM_SEED')
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, role = EXCLUDED.role, department = EXCLUDED.department, permissions = EXCLUDED.permissions;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'gate2@gmail.com') THEN
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud
    ) VALUES (
      '00000000-0000-0000-0000-000000000008'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
      'gate2@gmail.com', v_encrypted_pw, now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Tanvir Hasan (Gate 02 Officer)"}'::jsonb,
      now(), now(), 'authenticated', 'authenticated'
    );
  END IF;

  INSERT INTO public.admin_accounts (id, auth_user_id, username, full_name, email, role, is_locked, created_at)
  VALUES ('ADM-STF-007', '00000000-0000-0000-0000-000000000008'::uuid, 'gate2@gmail.com', 'Tanvir Hasan (Gate 02 Officer)', 'gate2@gmail.com', 'admin', false, now())
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

  INSERT INTO public.staff_accounts (id, auth_user_id, full_name, username, email, role, department, permissions, status, assigned_gate, created_at, created_by)
  VALUES ('STF-007', '00000000-0000-0000-0000-000000000008'::uuid, 'Tanvir Hasan (Gate 02 Officer)', 'gate2@gmail.com', 'gate2@gmail.com', 'GATE_STAFF', 'GATE', '["VIEW","SCAN","VERIFY","APPROVE"]'::jsonb, 'ACTIVE', 'Gate 02 - East Campus', now(), 'SYSTEM_SEED')
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, role = EXCLUDED.role, department = EXCLUDED.department, permissions = EXCLUDED.permissions;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'dress2@gmail.com') THEN
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud
    ) VALUES (
      '00000000-0000-0000-0000-000000000009'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
      'dress2@gmail.com', v_encrypted_pw, now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Kazi Rayhan (Distribution Booth 02)"}'::jsonb,
      now(), now(), 'authenticated', 'authenticated'
    );
  END IF;

  INSERT INTO public.admin_accounts (id, auth_user_id, username, full_name, email, role, is_locked, created_at)
  VALUES ('ADM-STF-008', '00000000-0000-0000-0000-000000000009'::uuid, 'dress2@gmail.com', 'Kazi Rayhan (Distribution Booth 02)', 'dress2@gmail.com', 'admin', false, now())
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

  INSERT INTO public.staff_accounts (id, auth_user_id, full_name, username, email, role, department, permissions, status, assigned_gate, created_at, created_by)
  VALUES ('STF-008', '00000000-0000-0000-0000-000000000009'::uuid, 'Kazi Rayhan (Distribution Booth 02)', 'dress2@gmail.com', 'dress2@gmail.com', 'DRESS_STAFF', 'DRESS', '["VIEW","SCAN","VERIFY","APPROVE"]'::jsonb, 'ACTIVE', 'Distribution Booth 02', now(), 'SYSTEM_SEED')
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, role = EXCLUDED.role, department = EXCLUDED.department, permissions = EXCLUDED.permissions;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'supervisor@gmail.com') THEN
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud
    ) VALUES (
      '00000000-0000-0000-0000-000000000010'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
      'supervisor@gmail.com', v_encrypted_pw, now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Engr. Moniruzzaman (Floor Supervisor)"}'::jsonb,
      now(), now(), 'authenticated', 'authenticated'
    );
  END IF;

  INSERT INTO public.admin_accounts (id, auth_user_id, username, full_name, email, role, is_locked, created_at)
  VALUES ('ADM-STF-009', '00000000-0000-0000-0000-000000000010'::uuid, 'supervisor@gmail.com', 'Engr. Moniruzzaman (Floor Supervisor)', 'supervisor@gmail.com', 'super_admin', false, now())
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

  INSERT INTO public.staff_accounts (id, auth_user_id, full_name, username, email, role, department, permissions, status, assigned_gate, created_at, created_by)
  VALUES ('STF-009', '00000000-0000-0000-0000-000000000010'::uuid, 'Engr. Moniruzzaman (Floor Supervisor)', 'supervisor@gmail.com', 'supervisor@gmail.com', 'SUPER_ADMIN', 'ALL_SERVICES', '["VIEW","SCAN","VERIFY","APPROVE","REJECT","EXPORT","MANAGE"]'::jsonb, 'ACTIVE', 'All Gate & Floor Stations', now(), 'SYSTEM_SEED')
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, role = EXCLUDED.role, department = EXCLUDED.department, permissions = EXCLUDED.permissions;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'registration@gmail.com') THEN
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud
    ) VALUES (
      '00000000-0000-0000-0000-000000000011'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
      'registration@gmail.com', v_encrypted_pw, now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Dr. Nusrat Jahan (Registration Lead)"}'::jsonb,
      now(), now(), 'authenticated', 'authenticated'
    );
  END IF;

  INSERT INTO public.admin_accounts (id, auth_user_id, username, full_name, email, role, is_locked, created_at)
  VALUES ('ADM-STF-010', '00000000-0000-0000-0000-000000000011'::uuid, 'registration@gmail.com', 'Dr. Nusrat Jahan (Registration Lead)', 'registration@gmail.com', 'super_admin', false, now())
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

  INSERT INTO public.staff_accounts (id, auth_user_id, full_name, username, email, role, department, permissions, status, assigned_gate, created_at, created_by)
  VALUES ('STF-010', '00000000-0000-0000-0000-000000000011'::uuid, 'Dr. Nusrat Jahan (Registration Lead)', 'registration@gmail.com', 'registration@gmail.com', 'SUPER_ADMIN', 'ALL_SERVICES', '["VIEW","SCAN","VERIFY","APPROVE","EXPORT","MANAGE"]'::jsonb, 'ACTIVE', 'Secretariat Registration Desk', now(), 'SYSTEM_SEED')
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, role = EXCLUDED.role, department = EXCLUDED.department, permissions = EXCLUDED.permissions;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'content@gmail.com') THEN
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud
    ) VALUES (
      '00000000-0000-0000-0000-000000000012'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
      'content@gmail.com', v_encrypted_pw, now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Farhana Yasmin (Souvenir & Media Lead)"}'::jsonb,
      now(), now(), 'authenticated', 'authenticated'
    );
  END IF;

  INSERT INTO public.admin_accounts (id, auth_user_id, username, full_name, email, role, is_locked, created_at)
  VALUES ('ADM-STF-011', '00000000-0000-0000-0000-000000000012'::uuid, 'content@gmail.com', 'Farhana Yasmin (Souvenir & Media Lead)', 'content@gmail.com', 'super_admin', false, now())
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

  INSERT INTO public.staff_accounts (id, auth_user_id, full_name, username, email, role, department, permissions, status, assigned_gate, created_at, created_by)
  VALUES ('STF-011', '00000000-0000-0000-0000-000000000012'::uuid, 'Farhana Yasmin (Souvenir & Media Lead)', 'content@gmail.com', 'content@gmail.com', 'SUPER_ADMIN', 'ALL_SERVICES', '["VIEW","VERIFY","EXPORT","MANAGE"]'::jsonb, 'ACTIVE', 'Media & Public Relations Room', now(), 'SYSTEM_SEED')
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, role = EXCLUDED.role, department = EXCLUDED.department, permissions = EXCLUDED.permissions;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'idcard.staff@gmail.com') THEN
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud
    ) VALUES (
      '00000000-0000-0000-0000-000000000013'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
      'idcard.staff@gmail.com', v_encrypted_pw, now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Kamrul Hasan (ID Card Coordinator)"}'::jsonb,
      now(), now(), 'authenticated', 'authenticated'
    );
  END IF;

  INSERT INTO public.admin_accounts (id, auth_user_id, username, full_name, email, role, is_locked, created_at)
  VALUES ('ADM-STF-012', '00000000-0000-0000-0000-000000000013'::uuid, 'idcard.staff@gmail.com', 'Kamrul Hasan (ID Card Coordinator)', 'idcard.staff@gmail.com', 'super_admin', false, now())
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

  INSERT INTO public.staff_accounts (id, auth_user_id, full_name, username, email, role, department, permissions, status, assigned_gate, created_at, created_by)
  VALUES ('STF-012', '00000000-0000-0000-0000-000000000013'::uuid, 'Kamrul Hasan (ID Card Coordinator)', 'idcard.staff@gmail.com', 'idcard.staff@gmail.com', 'SUPER_ADMIN', 'ALL_SERVICES', '["VIEW","VERIFY","APPROVE","EXPORT","MANAGE"]'::jsonb, 'ACTIVE', 'ID Card Production Center', now(), 'SYSTEM_SEED')
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, role = EXCLUDED.role, department = EXCLUDED.department, permissions = EXCLUDED.permissions;

END $$;

-- 2. SEED CENTRAL EVENT BUDGET
INSERT INTO public.central_budget (id, academic_year, total_budget, description, updated_at, updated_by)
VALUES ('BUDGET-2026', 2026, 2500000.00, 'Grand Reunion 2026 Authoritative Central Fund', now(), 'Dr. M. A. Kashem (Convenor)')
ON CONFLICT (id) DO UPDATE SET total_budget = EXCLUDED.total_budget;

-- 3. SEED CURRENT STUDENT IDS (40 RECORDS)
INSERT INTO public.current_student_ids (id, student_id, student_name, class_name, academic_year, status, verification_status, used_registration_id, created_at, updated_at)
VALUES ('STU-REC-101', 'PLSC-2026-101', 'Samiul Islam', 'Class 10', '2026', 'ACTIVE', 'USED', 'PLSCF-2026-C2001', now(), now())
ON CONFLICT (student_id) DO UPDATE SET verification_status = EXCLUDED.verification_status, used_registration_id = EXCLUDED.used_registration_id;
INSERT INTO public.current_student_ids (id, student_id, student_name, class_name, academic_year, status, verification_status, used_registration_id, created_at, updated_at)
VALUES ('STU-REC-102', 'PLSC-2026-102', 'Mehedi Hasan', 'Class 10', '2026', 'ACTIVE', 'USED', 'PLSCF-2026-C2004', now(), now())
ON CONFLICT (student_id) DO UPDATE SET verification_status = EXCLUDED.verification_status, used_registration_id = EXCLUDED.used_registration_id;
INSERT INTO public.current_student_ids (id, student_id, student_name, class_name, academic_year, status, verification_status, used_registration_id, created_at, updated_at)
VALUES ('STU-REC-103', 'PLSC-2026-103', 'Fatema Tuj Zohra', 'Class 10', '2026', 'ACTIVE', 'USED', 'PLSCF-2026-C2005', now(), now())
ON CONFLICT (student_id) DO UPDATE SET verification_status = EXCLUDED.verification_status, used_registration_id = EXCLUDED.used_registration_id;
INSERT INTO public.current_student_ids (id, student_id, student_name, class_name, academic_year, status, verification_status, used_registration_id, created_at, updated_at)
VALUES ('STU-REC-104', 'PLSC-2026-104', 'Ayesha Siddiqua', 'Class 12', '2026', 'ACTIVE', 'USED', 'PLSCF-2026-C2002', now(), now())
ON CONFLICT (student_id) DO UPDATE SET verification_status = EXCLUDED.verification_status, used_registration_id = EXCLUDED.used_registration_id;
INSERT INTO public.current_student_ids (id, student_id, student_name, class_name, academic_year, status, verification_status, used_registration_id, created_at, updated_at)
VALUES ('STU-REC-105', 'PLSC-2026-105', 'Nafis Fuad', 'Class 9', '2026', 'ACTIVE', 'AVAILABLE', NULL, now(), now())
ON CONFLICT (student_id) DO UPDATE SET verification_status = EXCLUDED.verification_status, used_registration_id = EXCLUDED.used_registration_id;
INSERT INTO public.current_student_ids (id, student_id, student_name, class_name, academic_year, status, verification_status, used_registration_id, created_at, updated_at)
VALUES ('STU-REC-106', 'PLSC-2026-106', 'Sadia Afrin', 'Class 11', '2026', 'ACTIVE', 'USED', 'PLSCF-2026-C2006', now(), now())
ON CONFLICT (student_id) DO UPDATE SET verification_status = EXCLUDED.verification_status, used_registration_id = EXCLUDED.used_registration_id;
INSERT INTO public.current_student_ids (id, student_id, student_name, class_name, academic_year, status, verification_status, used_registration_id, created_at, updated_at)
VALUES ('STU-REC-107', 'PLSC-2026-107', 'Rifat Hossain', 'Class 11', '2026', 'ACTIVE', 'USED', 'PLSCF-2026-C2007', now(), now())
ON CONFLICT (student_id) DO UPDATE SET verification_status = EXCLUDED.verification_status, used_registration_id = EXCLUDED.used_registration_id;
INSERT INTO public.current_student_ids (id, student_id, student_name, class_name, academic_year, status, verification_status, used_registration_id, created_at, updated_at)
VALUES ('STU-REC-108', 'PLSC-2026-108', 'Nusrat Binte Alam', 'Class 12', '2026', 'ACTIVE', 'USED', 'PLSCF-2026-C2008', now(), now())
ON CONFLICT (student_id) DO UPDATE SET verification_status = EXCLUDED.verification_status, used_registration_id = EXCLUDED.used_registration_id;
INSERT INTO public.current_student_ids (id, student_id, student_name, class_name, academic_year, status, verification_status, used_registration_id, created_at, updated_at)
VALUES ('STU-REC-109', 'PLSC-2026-109', 'Ahsan Habib', 'Class 8', '2026', 'ACTIVE', 'USED', 'PLSCF-2026-C2009', now(), now())
ON CONFLICT (student_id) DO UPDATE SET verification_status = EXCLUDED.verification_status, used_registration_id = EXCLUDED.used_registration_id;
INSERT INTO public.current_student_ids (id, student_id, student_name, class_name, academic_year, status, verification_status, used_registration_id, created_at, updated_at)
VALUES ('STU-REC-110', 'PLSC-2026-110', 'Jannatul Ferdous', 'Class 8', '2026', 'ACTIVE', 'USED', 'PLSCF-2026-C2010', now(), now())
ON CONFLICT (student_id) DO UPDATE SET verification_status = EXCLUDED.verification_status, used_registration_id = EXCLUDED.used_registration_id;
INSERT INTO public.current_student_ids (id, student_id, student_name, class_name, academic_year, status, verification_status, used_registration_id, created_at, updated_at)
VALUES ('STU-REC-111', 'PLSC-2026-111', 'Mahir Faisal', 'Class 7', '2026', 'ACTIVE', 'USED', 'PLSCF-2026-C2011', now(), now())
ON CONFLICT (student_id) DO UPDATE SET verification_status = EXCLUDED.verification_status, used_registration_id = EXCLUDED.used_registration_id;
INSERT INTO public.current_student_ids (id, student_id, student_name, class_name, academic_year, status, verification_status, used_registration_id, created_at, updated_at)
VALUES ('STU-REC-112', 'PLSC-2026-112', 'Samia Sultana', 'Class 7', '2026', 'ACTIVE', 'USED', 'PLSCF-2026-C2012', now(), now())
ON CONFLICT (student_id) DO UPDATE SET verification_status = EXCLUDED.verification_status, used_registration_id = EXCLUDED.used_registration_id;
INSERT INTO public.current_student_ids (id, student_id, student_name, class_name, academic_year, status, verification_status, used_registration_id, created_at, updated_at)
VALUES ('STU-REC-113', 'PLSC-2026-113', 'Ariful Islam', 'Class 6', '2026', 'ACTIVE', 'USED', 'PLSCF-2026-C2013', now(), now())
ON CONFLICT (student_id) DO UPDATE SET verification_status = EXCLUDED.verification_status, used_registration_id = EXCLUDED.used_registration_id;
INSERT INTO public.current_student_ids (id, student_id, student_name, class_name, academic_year, status, verification_status, used_registration_id, created_at, updated_at)
VALUES ('STU-REC-114', 'PLSC-2026-114', 'Tasnim Rahman', 'Class 6', '2026', 'ACTIVE', 'USED', 'PLSCF-2026-C2014', now(), now())
ON CONFLICT (student_id) DO UPDATE SET verification_status = EXCLUDED.verification_status, used_registration_id = EXCLUDED.used_registration_id;
INSERT INTO public.current_student_ids (id, student_id, student_name, class_name, academic_year, status, verification_status, used_registration_id, created_at, updated_at)
VALUES ('STU-REC-115', 'PLSC-2026-115', 'Zayan Al Din', 'Class 9', '2026', 'ACTIVE', 'AVAILABLE', NULL, now(), now())
ON CONFLICT (student_id) DO UPDATE SET verification_status = EXCLUDED.verification_status, used_registration_id = EXCLUDED.used_registration_id;
INSERT INTO public.current_student_ids (id, student_id, student_name, class_name, academic_year, status, verification_status, used_registration_id, created_at, updated_at)
VALUES ('STU-REC-116', 'PLSC-2026-116', 'Tanha Tabassum', 'Class 10', '2026', 'ACTIVE', 'AVAILABLE', NULL, now(), now())
ON CONFLICT (student_id) DO UPDATE SET verification_status = EXCLUDED.verification_status, used_registration_id = EXCLUDED.used_registration_id;
INSERT INTO public.current_student_ids (id, student_id, student_name, class_name, academic_year, status, verification_status, used_registration_id, created_at, updated_at)
VALUES ('STU-REC-117', 'PLSC-2026-117', 'Jawad Ahmed', 'Class 10', '2026', 'ACTIVE', 'AVAILABLE', NULL, now(), now())
ON CONFLICT (student_id) DO UPDATE SET verification_status = EXCLUDED.verification_status, used_registration_id = EXCLUDED.used_registration_id;
INSERT INTO public.current_student_ids (id, student_id, student_name, class_name, academic_year, status, verification_status, used_registration_id, created_at, updated_at)
VALUES ('STU-REC-118', 'PLSC-2026-118', 'Sumaiya Khanam', 'Class 12', '2026', 'ACTIVE', 'AVAILABLE', NULL, now(), now())
ON CONFLICT (student_id) DO UPDATE SET verification_status = EXCLUDED.verification_status, used_registration_id = EXCLUDED.used_registration_id;
INSERT INTO public.current_student_ids (id, student_id, student_name, class_name, academic_year, status, verification_status, used_registration_id, created_at, updated_at)
VALUES ('STU-REC-119', 'PLSC-2026-119', 'Hasibul Hasan', 'Class 11', '2026', 'ACTIVE', 'AVAILABLE', NULL, now(), now())
ON CONFLICT (student_id) DO UPDATE SET verification_status = EXCLUDED.verification_status, used_registration_id = EXCLUDED.used_registration_id;
INSERT INTO public.current_student_ids (id, student_id, student_name, class_name, academic_year, status, verification_status, used_registration_id, created_at, updated_at)
VALUES ('STU-REC-120', 'PLSC-2026-120', 'Nabila Anjum', 'Class 9', '2026', 'ACTIVE', 'AVAILABLE', NULL, now(), now())
ON CONFLICT (student_id) DO UPDATE SET verification_status = EXCLUDED.verification_status, used_registration_id = EXCLUDED.used_registration_id;
INSERT INTO public.current_student_ids (id, student_id, student_name, class_name, academic_year, status, verification_status, used_registration_id, created_at, updated_at)
VALUES ('STU-REC-121', 'PLSC-2026-121', 'Shadman Sakib', 'Class 9', '2026', 'ACTIVE', 'AVAILABLE', NULL, now(), now())
ON CONFLICT (student_id) DO UPDATE SET verification_status = EXCLUDED.verification_status, used_registration_id = EXCLUDED.used_registration_id;
INSERT INTO public.current_student_ids (id, student_id, student_name, class_name, academic_year, status, verification_status, used_registration_id, created_at, updated_at)
VALUES ('STU-REC-122', 'PLSC-2026-122', 'Anika Bushra', 'Class 8', '2026', 'ACTIVE', 'AVAILABLE', NULL, now(), now())
ON CONFLICT (student_id) DO UPDATE SET verification_status = EXCLUDED.verification_status, used_registration_id = EXCLUDED.used_registration_id;
INSERT INTO public.current_student_ids (id, student_id, student_name, class_name, academic_year, status, verification_status, used_registration_id, created_at, updated_at)
VALUES ('STU-REC-123', 'PLSC-2026-123', 'Tahmidul Islam', 'Class 8', '2026', 'ACTIVE', 'AVAILABLE', NULL, now(), now())
ON CONFLICT (student_id) DO UPDATE SET verification_status = EXCLUDED.verification_status, used_registration_id = EXCLUDED.used_registration_id;
INSERT INTO public.current_student_ids (id, student_id, student_name, class_name, academic_year, status, verification_status, used_registration_id, created_at, updated_at)
VALUES ('STU-REC-124', 'PLSC-2026-124', 'Rayhan Mahmud', 'Class 7', '2026', 'ACTIVE', 'AVAILABLE', NULL, now(), now())
ON CONFLICT (student_id) DO UPDATE SET verification_status = EXCLUDED.verification_status, used_registration_id = EXCLUDED.used_registration_id;
INSERT INTO public.current_student_ids (id, student_id, student_name, class_name, academic_year, status, verification_status, used_registration_id, created_at, updated_at)
VALUES ('STU-REC-125', 'PLSC-2026-125', 'Faiza Noor', 'Class 7', '2026', 'ACTIVE', 'AVAILABLE', NULL, now(), now())
ON CONFLICT (student_id) DO UPDATE SET verification_status = EXCLUDED.verification_status, used_registration_id = EXCLUDED.used_registration_id;
INSERT INTO public.current_student_ids (id, student_id, student_name, class_name, academic_year, status, verification_status, used_registration_id, created_at, updated_at)
VALUES ('STU-REC-126', 'PLSC-2026-126', 'Miraz Hossain', 'Class 6', '2026', 'ACTIVE', 'AVAILABLE', NULL, now(), now())
ON CONFLICT (student_id) DO UPDATE SET verification_status = EXCLUDED.verification_status, used_registration_id = EXCLUDED.used_registration_id;
INSERT INTO public.current_student_ids (id, student_id, student_name, class_name, academic_year, status, verification_status, used_registration_id, created_at, updated_at)
VALUES ('STU-REC-127', 'PLSC-2026-127', 'Sabikun Nahar', 'Class 6', '2026', 'ACTIVE', 'AVAILABLE', NULL, now(), now())
ON CONFLICT (student_id) DO UPDATE SET verification_status = EXCLUDED.verification_status, used_registration_id = EXCLUDED.used_registration_id;
INSERT INTO public.current_student_ids (id, student_id, student_name, class_name, academic_year, status, verification_status, used_registration_id, created_at, updated_at)
VALUES ('STU-REC-128', 'PLSC-2026-128', 'Abrar Fahim', 'Class 10', '2026', 'ACTIVE', 'AVAILABLE', NULL, now(), now())
ON CONFLICT (student_id) DO UPDATE SET verification_status = EXCLUDED.verification_status, used_registration_id = EXCLUDED.used_registration_id;
INSERT INTO public.current_student_ids (id, student_id, student_name, class_name, academic_year, status, verification_status, used_registration_id, created_at, updated_at)
VALUES ('STU-REC-129', 'PLSC-2026-129', 'Maliha Mehzabin', 'Class 11', '2026', 'ACTIVE', 'AVAILABLE', NULL, now(), now())
ON CONFLICT (student_id) DO UPDATE SET verification_status = EXCLUDED.verification_status, used_registration_id = EXCLUDED.used_registration_id;
INSERT INTO public.current_student_ids (id, student_id, student_name, class_name, academic_year, status, verification_status, used_registration_id, created_at, updated_at)
VALUES ('STU-REC-130', 'PLSC-2026-130', 'Kazi Imtiaz', 'Class 12', '2026', 'ACTIVE', 'AVAILABLE', NULL, now(), now())
ON CONFLICT (student_id) DO UPDATE SET verification_status = EXCLUDED.verification_status, used_registration_id = EXCLUDED.used_registration_id;
INSERT INTO public.current_student_ids (id, student_id, student_name, class_name, academic_year, status, verification_status, used_registration_id, created_at, updated_at)
VALUES ('STU-REC-131', 'PLSC-2026-131', 'Lamia Haque', 'Class 8', '2026', 'ACTIVE', 'AVAILABLE', NULL, now(), now())
ON CONFLICT (student_id) DO UPDATE SET verification_status = EXCLUDED.verification_status, used_registration_id = EXCLUDED.used_registration_id;
INSERT INTO public.current_student_ids (id, student_id, student_name, class_name, academic_year, status, verification_status, used_registration_id, created_at, updated_at)
VALUES ('STU-REC-132', 'PLSC-2026-132', 'Mashrur Rahman', 'Class 9', '2026', 'ACTIVE', 'AVAILABLE', NULL, now(), now())
ON CONFLICT (student_id) DO UPDATE SET verification_status = EXCLUDED.verification_status, used_registration_id = EXCLUDED.used_registration_id;
INSERT INTO public.current_student_ids (id, student_id, student_name, class_name, academic_year, status, verification_status, used_registration_id, created_at, updated_at)
VALUES ('STU-REC-133', 'PLSC-2026-133', 'Humaira Tasnim', 'Class 7', '2026', 'ACTIVE', 'AVAILABLE', NULL, now(), now())
ON CONFLICT (student_id) DO UPDATE SET verification_status = EXCLUDED.verification_status, used_registration_id = EXCLUDED.used_registration_id;
INSERT INTO public.current_student_ids (id, student_id, student_name, class_name, academic_year, status, verification_status, used_registration_id, created_at, updated_at)
VALUES ('STU-REC-134', 'PLSC-2026-134', 'Zunaid Siddique', 'Class 6', '2026', 'ACTIVE', 'AVAILABLE', NULL, now(), now())
ON CONFLICT (student_id) DO UPDATE SET verification_status = EXCLUDED.verification_status, used_registration_id = EXCLUDED.used_registration_id;
INSERT INTO public.current_student_ids (id, student_id, student_name, class_name, academic_year, status, verification_status, used_registration_id, created_at, updated_at)
VALUES ('STU-REC-135', 'PLSC-2026-135', 'Fabiha Rashid', 'Class 10', '2026', 'ACTIVE', 'AVAILABLE', NULL, now(), now())
ON CONFLICT (student_id) DO UPDATE SET verification_status = EXCLUDED.verification_status, used_registration_id = EXCLUDED.used_registration_id;
INSERT INTO public.current_student_ids (id, student_id, student_name, class_name, academic_year, status, verification_status, used_registration_id, created_at, updated_at)
VALUES ('STU-REC-136', 'PLSC-2026-136', 'Sanzida Parveen', 'Class 11', '2026', 'ACTIVE', 'RESERVED', NULL, now(), now())
ON CONFLICT (student_id) DO UPDATE SET verification_status = EXCLUDED.verification_status, used_registration_id = EXCLUDED.used_registration_id;
INSERT INTO public.current_student_ids (id, student_id, student_name, class_name, academic_year, status, verification_status, used_registration_id, created_at, updated_at)
VALUES ('STU-REC-137', 'PLSC-2026-137', 'Shafin Chowdhury', 'Class 12', '2026', 'ACTIVE', 'RESERVED', NULL, now(), now())
ON CONFLICT (student_id) DO UPDATE SET verification_status = EXCLUDED.verification_status, used_registration_id = EXCLUDED.used_registration_id;
INSERT INTO public.current_student_ids (id, student_id, student_name, class_name, academic_year, status, verification_status, used_registration_id, created_at, updated_at)
VALUES ('STU-REC-138', 'PLSC-2026-138', 'Mehnaz Tabassum', 'Class 9', '2026', 'ACTIVE', 'RESERVED', NULL, now(), now())
ON CONFLICT (student_id) DO UPDATE SET verification_status = EXCLUDED.verification_status, used_registration_id = EXCLUDED.used_registration_id;
INSERT INTO public.current_student_ids (id, student_id, student_name, class_name, academic_year, status, verification_status, used_registration_id, created_at, updated_at)
VALUES ('STU-REC-139', 'PLSC-2026-139', 'Kamran Ahmed (Transferred)', 'Class 10', '2026', 'INACTIVE', 'AVAILABLE', NULL, now(), now())
ON CONFLICT (student_id) DO UPDATE SET verification_status = EXCLUDED.verification_status, used_registration_id = EXCLUDED.used_registration_id;
INSERT INTO public.current_student_ids (id, student_id, student_name, class_name, academic_year, status, verification_status, used_registration_id, created_at, updated_at)
VALUES ('STU-REC-140', 'PLSC-2026-140', 'Rasheda Begum (Inactive)', 'Class 8', '2026', 'INACTIVE', 'AVAILABLE', NULL, now(), now())
ON CONFLICT (student_id) DO UPDATE SET verification_status = EXCLUDED.verification_status, used_registration_id = EXCLUDED.used_registration_id;

-- 4. SEED 40 REGISTRATIONS (registrations_2026 & registrations_2027)

INSERT INTO public.registrations_2026 (
  id, full_name, full_name_bn, photo_url, mobile_number, email, address,
  category, passing_year, current_class, batch_name, group_or_section, roll_number,
  student_id, t_shirt_size, registration_fee, donation_amount, total_paid,
  payment_status, transaction_id, payment_method, server_verification_signature,
  verification_timestamp, verified_by, registered_at, qr_token, is_tshirt_collected, year
) VALUES (
  'PLSCF-2026-F1001',
  'Tanvir Ahmed',
  'তানভীর আহমেদ',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80',
  '01711223344',
  'tanvir.ahmed@example.com',
  'House 14, Road 3, Faridpur Sadar, Faridpur',
  'former',
  '1998',
  '',
  'SSC 1998',
  '',
  '',
  NULL,
  'XL',
  1500,
  500,
  2000,
  'paid',
  'PST-BK-8821901',
  'bkash',
  'SIG_V2_7A82910F11223344',
  '2026-01-16T10:32:15Z',
  'PAYSTATION_GATEWAY',
  '2026-01-16T10:30:00Z',
  'A7K9M2',
  false,
  2026
)
ON CONFLICT (id) DO UPDATE SET
  payment_status = EXCLUDED.payment_status,
  total_paid = EXCLUDED.total_paid,
  qr_token = EXCLUDED.qr_token,
  is_tshirt_collected = EXCLUDED.is_tshirt_collected;

INSERT INTO public.registrations_2026 (
  id, full_name, full_name_bn, photo_url, mobile_number, email, address,
  category, passing_year, current_class, batch_name, group_or_section, roll_number,
  student_id, t_shirt_size, registration_fee, donation_amount, total_paid,
  payment_status, transaction_id, payment_method, server_verification_signature,
  verification_timestamp, verified_by, registered_at, qr_token, is_tshirt_collected, year
) VALUES (
  'PLSCF-2026-F1002',
  'Dr. Nusrat Jahan',
  'ডা. নুসরাত জাহান',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&auto=format&fit=crop&q=80',
  '01819887766',
  'dr.nusrat@example.com',
  'Medical College Road, Faridpur',
  'former',
  '2005',
  '',
  'SSC 2005',
  '',
  '',
  NULL,
  'M',
  1500,
  1000,
  2500,
  'paid',
  'PST-CRD-9948201',
  'card',
  'SIG_V2_5B91024D9948201',
  '2026-01-18T14:16:30Z',
  'PAYSTATION_GATEWAY',
  '2026-01-18T14:15:00Z',
  'R8W3N5',
  true,
  2026
)
ON CONFLICT (id) DO UPDATE SET
  payment_status = EXCLUDED.payment_status,
  total_paid = EXCLUDED.total_paid,
  qr_token = EXCLUDED.qr_token,
  is_tshirt_collected = EXCLUDED.is_tshirt_collected;

INSERT INTO public.registrations_2026 (
  id, full_name, full_name_bn, photo_url, mobile_number, email, address,
  category, passing_year, current_class, batch_name, group_or_section, roll_number,
  student_id, t_shirt_size, registration_fee, donation_amount, total_paid,
  payment_status, transaction_id, payment_method, server_verification_signature,
  verification_timestamp, verified_by, registered_at, qr_token, is_tshirt_collected, year
) VALUES (
  'PLSCF-2026-F1003',
  'Md. Asaduzzaman',
  'মোঃ আসাদুজ্জামান',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop&q=80',
  '01912345678',
  'asad.zaman@example.com',
  'Goalchamot, Faridpur',
  'former',
  '2012',
  '',
  'SSC 2012',
  '',
  '',
  NULL,
  'L',
  1500,
  0,
  1500,
  'paid',
  'PST-NG-7738192',
  'nagad',
  'SIG_V2_3C88219E7738192',
  '2026-01-20T11:02:10Z',
  'PAYSTATION_GATEWAY',
  '2026-01-20T11:00:00Z',
  'B9F2Q7',
  false,
  2026
)
ON CONFLICT (id) DO UPDATE SET
  payment_status = EXCLUDED.payment_status,
  total_paid = EXCLUDED.total_paid,
  qr_token = EXCLUDED.qr_token,
  is_tshirt_collected = EXCLUDED.is_tshirt_collected;

INSERT INTO public.registrations_2026 (
  id, full_name, full_name_bn, photo_url, mobile_number, email, address,
  category, passing_year, current_class, batch_name, group_or_section, roll_number,
  student_id, t_shirt_size, registration_fee, donation_amount, total_paid,
  payment_status, transaction_id, payment_method, server_verification_signature,
  verification_timestamp, verified_by, registered_at, qr_token, is_tshirt_collected, year
) VALUES (
  'PLSCF-2026-F1004',
  'Kazi Mahfuzur Rahman',
  'কাজী মাহফুজুর রহমান',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300&auto=format&fit=crop&q=80',
  '01713456789',
  'mahfuz.kazi@example.com',
  'Police Lines Housing Area, Faridpur',
  'former',
  '1986',
  '',
  'SSC 1986',
  '',
  '',
  NULL,
  'Oversize 50',
  1500,
  3500,
  5000,
  'paid',
  'PST-RCK-6629103',
  'rocket',
  'SIG_V2_8D19482A6629103',
  '2026-01-22T16:22:45Z',
  'PAYSTATION_GATEWAY',
  '2026-01-22T16:20:00Z',
  'X5H8C3',
  false,
  2026
)
ON CONFLICT (id) DO UPDATE SET
  payment_status = EXCLUDED.payment_status,
  total_paid = EXCLUDED.total_paid,
  qr_token = EXCLUDED.qr_token,
  is_tshirt_collected = EXCLUDED.is_tshirt_collected;

INSERT INTO public.registrations_2026 (
  id, full_name, full_name_bn, photo_url, mobile_number, email, address,
  category, passing_year, current_class, batch_name, group_or_section, roll_number,
  student_id, t_shirt_size, registration_fee, donation_amount, total_paid,
  payment_status, transaction_id, payment_method, server_verification_signature,
  verification_timestamp, verified_by, registered_at, qr_token, is_tshirt_collected, year
) VALUES (
  'PLSCF-2026-C2001',
  'Samiul Islam',
  'সামিউল ইসলাম',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300&auto=format&fit=crop&q=80',
  '01301234567',
  'samiul.student@plscf.edu.bd',
  'Jhiltoli, Faridpur',
  'current',
  '',
  'Class 10',
  'Class 10 Section A',
  'Section A',
  '05',
  'PLSC-2026-101',
  'M',
  500,
  0,
  500,
  'paid',
  'PST-BK-5518294',
  'bkash',
  'SIG_V2_9E10294F5518294',
  '2026-01-25T09:41:20Z',
  'PAYSTATION_GATEWAY',
  '2026-01-25T09:40:00Z',
  'C4P8L1',
  false,
  2026
)
ON CONFLICT (id) DO UPDATE SET
  payment_status = EXCLUDED.payment_status,
  total_paid = EXCLUDED.total_paid,
  qr_token = EXCLUDED.qr_token,
  is_tshirt_collected = EXCLUDED.is_tshirt_collected;

INSERT INTO public.registrations_2026 (
  id, full_name, full_name_bn, photo_url, mobile_number, email, address,
  category, passing_year, current_class, batch_name, group_or_section, roll_number,
  student_id, t_shirt_size, registration_fee, donation_amount, total_paid,
  payment_status, transaction_id, payment_method, server_verification_signature,
  verification_timestamp, verified_by, registered_at, qr_token, is_tshirt_collected, year
) VALUES (
  'PLSCF-2026-C2002',
  'Ayesha Siddiqua',
  'আয়েশা সিদ্দিকা',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&auto=format&fit=crop&q=80',
  '01799887711',
  'ayesha.siddiqua@plscf.edu.bd',
  'Aliabad, Faridpur',
  'current',
  '',
  'Class 12',
  'HSC 2026 Science',
  'Science',
  '12',
  'PLSC-2026-104',
  'S',
  500,
  0,
  500,
  'paid',
  'PST-NG-4419205',
  'nagad',
  'SIG_V2_2F88192A4419205',
  '2026-01-26T12:02:10Z',
  'PAYSTATION_GATEWAY',
  '2026-01-26T12:00:00Z',
  'D2M9V6',
  true,
  2026
)
ON CONFLICT (id) DO UPDATE SET
  payment_status = EXCLUDED.payment_status,
  total_paid = EXCLUDED.total_paid,
  qr_token = EXCLUDED.qr_token,
  is_tshirt_collected = EXCLUDED.is_tshirt_collected;

INSERT INTO public.registrations_2026 (
  id, full_name, full_name_bn, photo_url, mobile_number, email, address,
  category, passing_year, current_class, batch_name, group_or_section, roll_number,
  student_id, t_shirt_size, registration_fee, donation_amount, total_paid,
  payment_status, transaction_id, payment_method, server_verification_signature,
  verification_timestamp, verified_by, registered_at, qr_token, is_tshirt_collected, year
) VALUES (
  'PLSCF-2026-F1005',
  'Shafiqul Islam',
  'শফিকুল ইসলাম',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300&auto=format&fit=crop&q=80',
  '01611223344',
  'shafiq.islam@example.com',
  'Bhanga, Faridpur',
  'former',
  '2018',
  '',
  'SSC 2018',
  '',
  '',
  NULL,
  'XXL',
  1500,
  0,
  0,
  'pending',
  '',
  'bkash',
  NULL,
  NULL,
  NULL,
  '2026-02-01T15:30:00Z',
  'E6T1W8',
  false,
  2026
)
ON CONFLICT (id) DO UPDATE SET
  payment_status = EXCLUDED.payment_status,
  total_paid = EXCLUDED.total_paid,
  qr_token = EXCLUDED.qr_token,
  is_tshirt_collected = EXCLUDED.is_tshirt_collected;

INSERT INTO public.registrations_2026 (
  id, full_name, full_name_bn, photo_url, mobile_number, email, address,
  category, passing_year, current_class, batch_name, group_or_section, roll_number,
  student_id, t_shirt_size, registration_fee, donation_amount, total_paid,
  payment_status, transaction_id, payment_method, server_verification_signature,
  verification_timestamp, verified_by, registered_at, qr_token, is_tshirt_collected, year
) VALUES (
  'PLSCF-2026-C2003',
  'Nafis Fuad',
  'নাফিস ফুয়াদ',
  'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=300&auto=format&fit=crop&q=80',
  '01788776655',
  'nafis.fuad@plscf.edu.bd',
  'Ambikapur, Faridpur',
  'current',
  '',
  'Class 9',
  'Class 9 Section B',
  'Section B',
  '21',
  'PLSC-2026-105',
  'L',
  500,
  0,
  0,
  'pending',
  '',
  'bkash',
  NULL,
  NULL,
  NULL,
  '2026-02-02T10:15:00Z',
  'F3Y7K4',
  false,
  2026
)
ON CONFLICT (id) DO UPDATE SET
  payment_status = EXCLUDED.payment_status,
  total_paid = EXCLUDED.total_paid,
  qr_token = EXCLUDED.qr_token,
  is_tshirt_collected = EXCLUDED.is_tshirt_collected;

INSERT INTO public.registrations_2026 (
  id, full_name, full_name_bn, photo_url, mobile_number, email, address,
  category, passing_year, current_class, batch_name, group_or_section, roll_number,
  student_id, t_shirt_size, registration_fee, donation_amount, total_paid,
  payment_status, transaction_id, payment_method, server_verification_signature,
  verification_timestamp, verified_by, registered_at, qr_token, is_tshirt_collected, year
) VALUES (
  'PLSCF-2026-F1006',
  'Engr. Moniruzzaman',
  'প্রকৌ. মনিরুজ্জামান',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80',
  '01711002233',
  'monir.engr@example.com',
  'Alipur, Faridpur Sadar, Faridpur',
  'former',
  '1975',
  '',
  'SSC 1975',
  '',
  '',
  NULL,
  'XL',
  1500,
  50000,
  51500,
  'paid',
  'PST-BK-9910245',
  'bkash',
  'SIG_V2_1A990245F991024',
  '2026-01-10T11:02:40Z',
  'PAYSTATION_GATEWAY',
  '2026-01-10T11:00:00Z',
  'G9Z2N6',
  true,
  2026
)
ON CONFLICT (id) DO UPDATE SET
  payment_status = EXCLUDED.payment_status,
  total_paid = EXCLUDED.total_paid,
  qr_token = EXCLUDED.qr_token,
  is_tshirt_collected = EXCLUDED.is_tshirt_collected;

INSERT INTO public.registrations_2026 (
  id, full_name, full_name_bn, photo_url, mobile_number, email, address,
  category, passing_year, current_class, batch_name, group_or_section, roll_number,
  student_id, t_shirt_size, registration_fee, donation_amount, total_paid,
  payment_status, transaction_id, payment_method, server_verification_signature,
  verification_timestamp, verified_by, registered_at, qr_token, is_tshirt_collected, year
) VALUES (
  'PLSCF-2026-F1007',
  'Advocate Rafiqul Hasan',
  'এডভোকেট রফিকুল হাসান',
  'https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?w=300&auto=format&fit=crop&q=80',
  '01812334455',
  'rafiq.law@example.com',
  'Court Road, Faridpur Sadar',
  'former',
  '1980',
  '',
  'SSC 1980',
  '',
  '',
  NULL,
  'L',
  1500,
  5000,
  6500,
  'paid',
  'PST-NG-6618291',
  'nagad',
  'SIG_V2_2B882910F661829',
  '2026-01-12T14:22:15Z',
  'PAYSTATION_GATEWAY',
  '2026-01-12T14:20:00Z',
  'H4K8J1',
  false,
  2026
)
ON CONFLICT (id) DO UPDATE SET
  payment_status = EXCLUDED.payment_status,
  total_paid = EXCLUDED.total_paid,
  qr_token = EXCLUDED.qr_token,
  is_tshirt_collected = EXCLUDED.is_tshirt_collected;

INSERT INTO public.registrations_2026 (
  id, full_name, full_name_bn, photo_url, mobile_number, email, address,
  category, passing_year, current_class, batch_name, group_or_section, roll_number,
  student_id, t_shirt_size, registration_fee, donation_amount, total_paid,
  payment_status, transaction_id, payment_method, server_verification_signature,
  verification_timestamp, verified_by, registered_at, qr_token, is_tshirt_collected, year
) VALUES (
  'PLSCF-2026-F1008',
  'Prof. Anisur Rahman',
  'অধ্যাপক আনিসুর রহমান',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&auto=format&fit=crop&q=80',
  '01913445566',
  'prof.anis@example.com',
  'College Road, Faridpur',
  'former',
  '1983',
  '',
  'SSC 1983',
  '',
  '',
  NULL,
  'M',
  1500,
  10000,
  11500,
  'paid',
  'PST-RCK-5529104',
  'rocket',
  'SIG_V2_3C771045F552910',
  '2026-01-14T09:12:00Z',
  'PAYSTATION_GATEWAY',
  '2026-01-14T09:10:00Z',
  'J7M3X9',
  true,
  2026
)
ON CONFLICT (id) DO UPDATE SET
  payment_status = EXCLUDED.payment_status,
  total_paid = EXCLUDED.total_paid,
  qr_token = EXCLUDED.qr_token,
  is_tshirt_collected = EXCLUDED.is_tshirt_collected;

INSERT INTO public.registrations_2026 (
  id, full_name, full_name_bn, photo_url, mobile_number, email, address,
  category, passing_year, current_class, batch_name, group_or_section, roll_number,
  student_id, t_shirt_size, registration_fee, donation_amount, total_paid,
  payment_status, transaction_id, payment_method, server_verification_signature,
  verification_timestamp, verified_by, registered_at, qr_token, is_tshirt_collected, year
) VALUES (
  'PLSCF-2026-F1009',
  'Sultana Razia',
  'সুলতানা রাজিয়া',
  'https://images.unsplash.com/photo-1548142813-c348350df52b?w=300&auto=format&fit=crop&q=80',
  '01714556677',
  'razia.s@example.com',
  'Jhiltoli, Faridpur',
  'former',
  '1988',
  '',
  'SSC 1988',
  '',
  '',
  NULL,
  'S',
  1500,
  2000,
  3500,
  'paid',
  'PST-BK-4438192',
  'bkash',
  'SIG_V2_4D661923F443819',
  '2026-01-15T16:47:30Z',
  'PAYSTATION_GATEWAY',
  '2026-01-15T16:45:00Z',
  'K2P6B8',
  false,
  2026
)
ON CONFLICT (id) DO UPDATE SET
  payment_status = EXCLUDED.payment_status,
  total_paid = EXCLUDED.total_paid,
  qr_token = EXCLUDED.qr_token,
  is_tshirt_collected = EXCLUDED.is_tshirt_collected;

INSERT INTO public.registrations_2026 (
  id, full_name, full_name_bn, photo_url, mobile_number, email, address,
  category, passing_year, current_class, batch_name, group_or_section, roll_number,
  student_id, t_shirt_size, registration_fee, donation_amount, total_paid,
  payment_status, transaction_id, payment_method, server_verification_signature,
  verification_timestamp, verified_by, registered_at, qr_token, is_tshirt_collected, year
) VALUES (
  'PLSCF-2026-F1010',
  'Golam Mostafa',
  'গোলাম মোস্তফা',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300&auto=format&fit=crop&q=80',
  '01615667788',
  'g.mostafa@example.com',
  'Madhukhali, Faridpur',
  'former',
  '1991',
  '',
  'SSC 1991',
  '',
  '',
  NULL,
  'XL',
  1500,
  1500,
  3000,
  'paid',
  'PST-CRD-3349105',
  'card',
  'SIG_V2_5E551056F334910',
  '2026-01-17T11:31:45Z',
  'PAYSTATION_GATEWAY',
  '2026-01-17T11:30:00Z',
  'L5R9T3',
  true,
  2026
)
ON CONFLICT (id) DO UPDATE SET
  payment_status = EXCLUDED.payment_status,
  total_paid = EXCLUDED.total_paid,
  qr_token = EXCLUDED.qr_token,
  is_tshirt_collected = EXCLUDED.is_tshirt_collected;

INSERT INTO public.registrations_2026 (
  id, full_name, full_name_bn, photo_url, mobile_number, email, address,
  category, passing_year, current_class, batch_name, group_or_section, roll_number,
  student_id, t_shirt_size, registration_fee, donation_amount, total_paid,
  payment_status, transaction_id, payment_method, server_verification_signature,
  verification_timestamp, verified_by, registered_at, qr_token, is_tshirt_collected, year
) VALUES (
  'PLSCF-2026-F1011',
  'Farhana Yasmin',
  'ফারহানা ইয়াসমিন',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80',
  '01911882244',
  'farhana.y@example.com',
  'Chawkbazar, Faridpur',
  'former',
  '1995',
  '',
  'SSC 1995',
  '',
  '',
  NULL,
  'M',
  1500,
  20000,
  21500,
  'paid',
  'PST-NG-5519203',
  'nagad',
  'SIG_V2_6F442037F551920',
  '2026-01-28T14:32:00Z',
  'PAYSTATION_GATEWAY',
  '2026-01-28T14:30:00Z',
  'M8W2D7',
  true,
  2026
)
ON CONFLICT (id) DO UPDATE SET
  payment_status = EXCLUDED.payment_status,
  total_paid = EXCLUDED.total_paid,
  qr_token = EXCLUDED.qr_token,
  is_tshirt_collected = EXCLUDED.is_tshirt_collected;

INSERT INTO public.registrations_2026 (
  id, full_name, full_name_bn, photo_url, mobile_number, email, address,
  category, passing_year, current_class, batch_name, group_or_section, roll_number,
  student_id, t_shirt_size, registration_fee, donation_amount, total_paid,
  payment_status, transaction_id, payment_method, server_verification_signature,
  verification_timestamp, verified_by, registered_at, qr_token, is_tshirt_collected, year
) VALUES (
  'PLSCF-2026-F1012',
  'Squadron Leader Rashed Khan',
  'স্কোয়াড্রন লিডার রাশেদ খান',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80',
  '01811554433',
  'rashed.khan@example.com',
  'BAF Base Colony, Faridpur',
  'former',
  '2001',
  '',
  'SSC 2001',
  '',
  '',
  NULL,
  'L',
  1500,
  15000,
  16500,
  'paid',
  'PST-CRD-3319024',
  'card',
  'SIG_V2_7A330248F331902',
  '2026-02-05T09:17:10Z',
  'PAYSTATION_GATEWAY',
  '2026-02-05T09:15:00Z',
  'N3X7F4',
  false,
  2026
)
ON CONFLICT (id) DO UPDATE SET
  payment_status = EXCLUDED.payment_status,
  total_paid = EXCLUDED.total_paid,
  qr_token = EXCLUDED.qr_token,
  is_tshirt_collected = EXCLUDED.is_tshirt_collected;

INSERT INTO public.registrations_2026 (
  id, full_name, full_name_bn, photo_url, mobile_number, email, address,
  category, passing_year, current_class, batch_name, group_or_section, roll_number,
  student_id, t_shirt_size, registration_fee, donation_amount, total_paid,
  payment_status, transaction_id, payment_method, server_verification_signature,
  verification_timestamp, verified_by, registered_at, qr_token, is_tshirt_collected, year
) VALUES (
  'PLSCF-2026-F1013',
  'Nahid Sultana',
  'নাহিদ সুলতানা',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&auto=format&fit=crop&q=80',
  '01716778899',
  'nahid.s@example.com',
  'Guhho Laxmipur, Faridpur',
  'former',
  '2003',
  '',
  'SSC 2003',
  '',
  '',
  NULL,
  'S',
  1500,
  500,
  2000,
  'paid',
  'PST-BK-2259106',
  'bkash',
  'SIG_V2_8B221069F225910',
  '2026-01-29T10:21:50Z',
  'PAYSTATION_GATEWAY',
  '2026-01-29T10:20:00Z',
  'P6Y1H9',
  false,
  2026
)
ON CONFLICT (id) DO UPDATE SET
  payment_status = EXCLUDED.payment_status,
  total_paid = EXCLUDED.total_paid,
  qr_token = EXCLUDED.qr_token,
  is_tshirt_collected = EXCLUDED.is_tshirt_collected;

INSERT INTO public.registrations_2026 (
  id, full_name, full_name_bn, photo_url, mobile_number, email, address,
  category, passing_year, current_class, batch_name, group_or_section, roll_number,
  student_id, t_shirt_size, registration_fee, donation_amount, total_paid,
  payment_status, transaction_id, payment_method, server_verification_signature,
  verification_timestamp, verified_by, registered_at, qr_token, is_tshirt_collected, year
) VALUES (
  'PLSCF-2026-F1014',
  'Zubair Hossain',
  'জুবায়ের হোসেন',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop&q=80',
  '01517889900',
  'zubair.h@example.com',
  'Boalmari, Faridpur',
  'former',
  '2006',
  '',
  'SSC 2006',
  '',
  '',
  NULL,
  'XXL',
  1500,
  0,
  1500,
  'paid',
  'PST-UP-1168297',
  'rocket',
  'SIG_V2_9C112970F116829',
  '2026-01-30T13:42:00Z',
  'PAYSTATION_GATEWAY',
  '2026-01-30T13:40:00Z',
  'Q4B8J2',
  true,
  2026
)
ON CONFLICT (id) DO UPDATE SET
  payment_status = EXCLUDED.payment_status,
  total_paid = EXCLUDED.total_paid,
  qr_token = EXCLUDED.qr_token,
  is_tshirt_collected = EXCLUDED.is_tshirt_collected;

INSERT INTO public.registrations_2026 (
  id, full_name, full_name_bn, photo_url, mobile_number, email, address,
  category, passing_year, current_class, batch_name, group_or_section, roll_number,
  student_id, t_shirt_size, registration_fee, donation_amount, total_paid,
  payment_status, transaction_id, payment_method, server_verification_signature,
  verification_timestamp, verified_by, registered_at, qr_token, is_tshirt_collected, year
) VALUES (
  'PLSCF-2026-F1015',
  'Mahbuba Akter',
  'মাহবুবা আক্তার',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&auto=format&fit=crop&q=80',
  '01818990011',
  'mahbuba.a@example.com',
  'Kamlapur, Faridpur',
  'former',
  '2008',
  '',
  'SSC 2008',
  '',
  '',
  NULL,
  'M',
  1500,
  1000,
  2500,
  'paid',
  'PST-BK-9978198',
  'bkash',
  'SIG_V2_0D991981F997819',
  '2026-01-31T15:16:30Z',
  'PAYSTATION_GATEWAY',
  '2026-01-31T15:15:00Z',
  'R9C3K7',
  true,
  2026
)
ON CONFLICT (id) DO UPDATE SET
  payment_status = EXCLUDED.payment_status,
  total_paid = EXCLUDED.total_paid,
  qr_token = EXCLUDED.qr_token,
  is_tshirt_collected = EXCLUDED.is_tshirt_collected;

INSERT INTO public.registrations_2026 (
  id, full_name, full_name_bn, photo_url, mobile_number, email, address,
  category, passing_year, current_class, batch_name, group_or_section, roll_number,
  student_id, t_shirt_size, registration_fee, donation_amount, total_paid,
  payment_status, transaction_id, payment_method, server_verification_signature,
  verification_timestamp, verified_by, registered_at, qr_token, is_tshirt_collected, year
) VALUES (
  'PLSCF-2026-F1016',
  'Tanzeem Morshed',
  'তানজীম মোরশেদ',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300&auto=format&fit=crop&q=80',
  '01719001122',
  'tanzeem.m@example.com',
  'Ambikapur, Faridpur',
  'former',
  '2010',
  '',
  'SSC 2010',
  '',
  '',
  NULL,
  'XL',
  1500,
  0,
  1500,
  'paid',
  'PST-NG-8889109',
  'nagad',
  'SIG_V2_1E881092F888910',
  '2026-02-01T09:31:45Z',
  'PAYSTATION_GATEWAY',
  '2026-02-01T09:30:00Z',
  'S2D7M5',
  false,
  2026
)
ON CONFLICT (id) DO UPDATE SET
  payment_status = EXCLUDED.payment_status,
  total_paid = EXCLUDED.total_paid,
  qr_token = EXCLUDED.qr_token,
  is_tshirt_collected = EXCLUDED.is_tshirt_collected;

INSERT INTO public.registrations_2026 (
  id, full_name, full_name_bn, photo_url, mobile_number, email, address,
  category, passing_year, current_class, batch_name, group_or_section, roll_number,
  student_id, t_shirt_size, registration_fee, donation_amount, total_paid,
  payment_status, transaction_id, payment_method, server_verification_signature,
  verification_timestamp, verified_by, registered_at, qr_token, is_tshirt_collected, year
) VALUES (
  'PLSCF-2026-F1017',
  'Shahriar Kabir',
  'শাহরিয়ার কবির',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300&auto=format&fit=crop&q=80',
  '01620112233',
  'shahriar.k@example.com',
  'Tepakhola, Faridpur',
  'former',
  '2013',
  '',
  'SSC 2013',
  '',
  '',
  NULL,
  'L',
  1500,
  500,
  2000,
  'paid',
  'PST-RCK-7798201',
  'rocket',
  'SIG_V2_2F772013F779820',
  '2026-02-02T12:01:50Z',
  'PAYSTATION_GATEWAY',
  '2026-02-02T12:00:00Z',
  'T8F2N4',
  true,
  2026
)
ON CONFLICT (id) DO UPDATE SET
  payment_status = EXCLUDED.payment_status,
  total_paid = EXCLUDED.total_paid,
  qr_token = EXCLUDED.qr_token,
  is_tshirt_collected = EXCLUDED.is_tshirt_collected;

INSERT INTO public.registrations_2026 (
  id, full_name, full_name_bn, photo_url, mobile_number, email, address,
  category, passing_year, current_class, batch_name, group_or_section, roll_number,
  student_id, t_shirt_size, registration_fee, donation_amount, total_paid,
  payment_status, transaction_id, payment_method, server_verification_signature,
  verification_timestamp, verified_by, registered_at, qr_token, is_tshirt_collected, year
) VALUES (
  'PLSCF-2026-F1018',
  'Sabrina Sharmin',
  'সাবরিনা শারমিন',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&auto=format&fit=crop&q=80',
  '01921223344',
  'sabrina.s@example.com',
  'Sreepur, Faridpur',
  'former',
  '2014',
  '',
  'SSC 2014',
  '',
  '',
  NULL,
  'S',
  1500,
  0,
  1500,
  'paid',
  'PST-BK-6609102',
  'bkash',
  'SIG_V2_3A661024F660910',
  '2026-02-03T14:12:00Z',
  'PAYSTATION_GATEWAY',
  '2026-02-03T14:10:00Z',
  'U5G9P1',
  true,
  2026
)
ON CONFLICT (id) DO UPDATE SET
  payment_status = EXCLUDED.payment_status,
  total_paid = EXCLUDED.total_paid,
  qr_token = EXCLUDED.qr_token,
  is_tshirt_collected = EXCLUDED.is_tshirt_collected;

INSERT INTO public.registrations_2026 (
  id, full_name, full_name_bn, photo_url, mobile_number, email, address,
  category, passing_year, current_class, batch_name, group_or_section, roll_number,
  student_id, t_shirt_size, registration_fee, donation_amount, total_paid,
  payment_status, transaction_id, payment_method, server_verification_signature,
  verification_timestamp, verified_by, registered_at, qr_token, is_tshirt_collected, year
) VALUES (
  'PLSCF-2026-F1019',
  'Md. Al-Amin',
  'মোঃ আল-আমিন',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300&auto=format&fit=crop&q=80',
  '01722334455',
  'alamin.m@example.com',
  'Sadarpur, Faridpur',
  'former',
  '2016',
  '',
  'SSC 2016',
  '',
  '',
  NULL,
  'M',
  1500,
  500,
  2000,
  'paid',
  'PST-NG-5518203',
  'nagad',
  'SIG_V2_4B552035F551820',
  '2026-02-04T16:26:40Z',
  'PAYSTATION_GATEWAY',
  '2026-02-04T16:25:00Z',
  'V3H6R8',
  false,
  2026
)
ON CONFLICT (id) DO UPDATE SET
  payment_status = EXCLUDED.payment_status,
  total_paid = EXCLUDED.total_paid,
  qr_token = EXCLUDED.qr_token,
  is_tshirt_collected = EXCLUDED.is_tshirt_collected;

INSERT INTO public.registrations_2026 (
  id, full_name, full_name_bn, photo_url, mobile_number, email, address,
  category, passing_year, current_class, batch_name, group_or_section, roll_number,
  student_id, t_shirt_size, registration_fee, donation_amount, total_paid,
  payment_status, transaction_id, payment_method, server_verification_signature,
  verification_timestamp, verified_by, registered_at, qr_token, is_tshirt_collected, year
) VALUES (
  'PLSCF-2026-F1020',
  'Tahsin Mahmud',
  'তাহসিন মাহমুদ',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80',
  '01823445566',
  'tahsin.m@example.com',
  'Charbhadrasan, Faridpur',
  'former',
  '2019',
  '',
  'SSC 2019',
  '',
  '',
  NULL,
  'L',
  1500,
  0,
  1500,
  'paid',
  'PST-CRD-4429104',
  'card',
  'SIG_V2_5C441046F442910',
  '2026-02-05T10:47:00Z',
  'PAYSTATION_GATEWAY',
  '2026-02-05T10:45:00Z',
  'W7J1T2',
  false,
  2026
)
ON CONFLICT (id) DO UPDATE SET
  payment_status = EXCLUDED.payment_status,
  total_paid = EXCLUDED.total_paid,
  qr_token = EXCLUDED.qr_token,
  is_tshirt_collected = EXCLUDED.is_tshirt_collected;

INSERT INTO public.registrations_2026 (
  id, full_name, full_name_bn, photo_url, mobile_number, email, address,
  category, passing_year, current_class, batch_name, group_or_section, roll_number,
  student_id, t_shirt_size, registration_fee, donation_amount, total_paid,
  payment_status, transaction_id, payment_method, server_verification_signature,
  verification_timestamp, verified_by, registered_at, qr_token, is_tshirt_collected, year
) VALUES (
  'PLSCF-2026-F1021',
  'Fariha Tasnim',
  'ফারিহা তাসনিম',
  'https://images.unsplash.com/photo-1548142813-c348350df52b?w=300&auto=format&fit=crop&q=80',
  '01524556677',
  'fariha.t@example.com',
  'Goalchamot, Faridpur',
  'former',
  '2021',
  '',
  'SSC 2021',
  '',
  '',
  NULL,
  'S',
  1500,
  500,
  2000,
  'paid',
  'PST-BK-3338205',
  'bkash',
  'SIG_V2_6D332057F333820',
  '2026-02-06T11:16:30Z',
  'PAYSTATION_GATEWAY',
  '2026-02-06T11:15:00Z',
  'X2K5V9',
  true,
  2026
)
ON CONFLICT (id) DO UPDATE SET
  payment_status = EXCLUDED.payment_status,
  total_paid = EXCLUDED.total_paid,
  qr_token = EXCLUDED.qr_token,
  is_tshirt_collected = EXCLUDED.is_tshirt_collected;

INSERT INTO public.registrations_2026 (
  id, full_name, full_name_bn, photo_url, mobile_number, email, address,
  category, passing_year, current_class, batch_name, group_or_section, roll_number,
  student_id, t_shirt_size, registration_fee, donation_amount, total_paid,
  payment_status, transaction_id, payment_method, server_verification_signature,
  verification_timestamp, verified_by, registered_at, qr_token, is_tshirt_collected, year
) VALUES (
  'PLSCF-2026-F1022',
  'Shakil Ahmed',
  'শাকিল আহমেদ',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop&q=80',
  '01325667788',
  'shakil.a@example.com',
  'Nagarkanda, Faridpur',
  'former',
  '2022',
  '',
  'SSC 2022',
  '',
  '',
  NULL,
  'XL',
  1500,
  0,
  1500,
  'paid',
  'PST-UP-2249106',
  'rocket',
  'SIG_V2_7E221068F224910',
  '2026-02-07T13:52:10Z',
  'PAYSTATION_GATEWAY',
  '2026-02-07T13:50:00Z',
  'Y8M4W3',
  false,
  2026
)
ON CONFLICT (id) DO UPDATE SET
  payment_status = EXCLUDED.payment_status,
  total_paid = EXCLUDED.total_paid,
  qr_token = EXCLUDED.qr_token,
  is_tshirt_collected = EXCLUDED.is_tshirt_collected;

INSERT INTO public.registrations_2026 (
  id, full_name, full_name_bn, photo_url, mobile_number, email, address,
  category, passing_year, current_class, batch_name, group_or_section, roll_number,
  student_id, t_shirt_size, registration_fee, donation_amount, total_paid,
  payment_status, transaction_id, payment_method, server_verification_signature,
  verification_timestamp, verified_by, registered_at, qr_token, is_tshirt_collected, year
) VALUES (
  'PLSCF-2026-F1023',
  'Israt Jahan Eva',
  'ইসরাত জাহান ইভা',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80',
  '01726778899',
  'israt.eva@example.com',
  'Alipur, Faridpur',
  'former',
  '2023',
  '',
  'SSC 2023',
  '',
  '',
  NULL,
  'M',
  1500,
  1000,
  2500,
  'paid',
  'PST-NG-1158207',
  'nagad',
  'SIG_V2_8F112079F115820',
  '2026-02-08T15:42:00Z',
  'PAYSTATION_GATEWAY',
  '2026-02-08T15:40:00Z',
  'Z1N7X6',
  false,
  2026
)
ON CONFLICT (id) DO UPDATE SET
  payment_status = EXCLUDED.payment_status,
  total_paid = EXCLUDED.total_paid,
  qr_token = EXCLUDED.qr_token,
  is_tshirt_collected = EXCLUDED.is_tshirt_collected;

INSERT INTO public.registrations_2026 (
  id, full_name, full_name_bn, photo_url, mobile_number, email, address,
  category, passing_year, current_class, batch_name, group_or_section, roll_number,
  student_id, t_shirt_size, registration_fee, donation_amount, total_paid,
  payment_status, transaction_id, payment_method, server_verification_signature,
  verification_timestamp, verified_by, registered_at, qr_token, is_tshirt_collected, year
) VALUES (
  'PLSCF-2026-F1024',
  'Towhidul Islam',
  'তৌহিদুল ইসলাম',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300&auto=format&fit=crop&q=80',
  '01827889900',
  'towhid.i@example.com',
  'Bhanga, Faridpur',
  'former',
  '2024',
  '',
  'SSC 2024',
  '',
  '',
  NULL,
  'L',
  1500,
  0,
  0,
  'pending',
  '',
  'bkash',
  NULL,
  NULL,
  NULL,
  '2026-02-09T09:20:00Z',
  'A3P9B5',
  false,
  2026
)
ON CONFLICT (id) DO UPDATE SET
  payment_status = EXCLUDED.payment_status,
  total_paid = EXCLUDED.total_paid,
  qr_token = EXCLUDED.qr_token,
  is_tshirt_collected = EXCLUDED.is_tshirt_collected;

INSERT INTO public.registrations_2026 (
  id, full_name, full_name_bn, photo_url, mobile_number, email, address,
  category, passing_year, current_class, batch_name, group_or_section, roll_number,
  student_id, t_shirt_size, registration_fee, donation_amount, total_paid,
  payment_status, transaction_id, payment_method, server_verification_signature,
  verification_timestamp, verified_by, registered_at, qr_token, is_tshirt_collected, year
) VALUES (
  'PLSCF-2026-F1025',
  'Kamrul Ahsan',
  'কামরুল আহসান',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80',
  '01728990011',
  'kamrul.a@example.com',
  'Housing Estate, Faridpur',
  'former',
  '1972',
  '',
  'SSC 1972',
  '',
  '',
  NULL,
  'Oversize 50',
  1500,
  25000,
  26500,
  'paid',
  'PST-BK-9968208',
  'bkash',
  'SIG_V2_9A992080F996820',
  '2026-01-11T10:02:15Z',
  'PAYSTATION_GATEWAY',
  '2026-01-11T10:00:00Z',
  'B6R2C8',
  true,
  2026
)
ON CONFLICT (id) DO UPDATE SET
  payment_status = EXCLUDED.payment_status,
  total_paid = EXCLUDED.total_paid,
  qr_token = EXCLUDED.qr_token,
  is_tshirt_collected = EXCLUDED.is_tshirt_collected;

INSERT INTO public.registrations_2026 (
  id, full_name, full_name_bn, photo_url, mobile_number, email, address,
  category, passing_year, current_class, batch_name, group_or_section, roll_number,
  student_id, t_shirt_size, registration_fee, donation_amount, total_paid,
  payment_status, transaction_id, payment_method, server_verification_signature,
  verification_timestamp, verified_by, registered_at, qr_token, is_tshirt_collected, year
) VALUES (
  'PLSCF-2026-C2004',
  'Mehedi Hasan',
  'মেহেদী হাসান',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300&auto=format&fit=crop&q=80',
  '01929001122',
  'mehedi.h@plscf.edu.bd',
  'Police Lines Staff Quarter, Faridpur',
  'current',
  '',
  'Class 10',
  'Class 10 Section B',
  'Section B',
  '08',
  'PLSC-2026-102',
  'L',
  500,
  0,
  500,
  'paid',
  'PST-RCK-8859101',
  'rocket',
  'SIG_V2_1B881012F885910',
  '2026-01-27T08:31:40Z',
  'PAYSTATION_GATEWAY',
  '2026-01-27T08:30:00Z',
  'C9T4D1',
  false,
  2026
)
ON CONFLICT (id) DO UPDATE SET
  payment_status = EXCLUDED.payment_status,
  total_paid = EXCLUDED.total_paid,
  qr_token = EXCLUDED.qr_token,
  is_tshirt_collected = EXCLUDED.is_tshirt_collected;

INSERT INTO public.registrations_2026 (
  id, full_name, full_name_bn, photo_url, mobile_number, email, address,
  category, passing_year, current_class, batch_name, group_or_section, roll_number,
  student_id, t_shirt_size, registration_fee, donation_amount, total_paid,
  payment_status, transaction_id, payment_method, server_verification_signature,
  verification_timestamp, verified_by, registered_at, qr_token, is_tshirt_collected, year
) VALUES (
  'PLSCF-2026-C2005',
  'Fatema Tuj Zohra',
  'ফাতেমা তুজ জোহরা',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&auto=format&fit=crop&q=80',
  '01730112233',
  'fatema.z@plscf.edu.bd',
  'Goalchamot, Faridpur',
  'current',
  '',
  'Class 10',
  'Class 10 Section A',
  'Section A',
  '03',
  'PLSC-2026-103',
  'S',
  500,
  0,
  500,
  'paid',
  'PST-BK-7748202',
  'bkash',
  'SIG_V2_2C772023F774820',
  '2026-01-27T11:46:50Z',
  'PAYSTATION_GATEWAY',
  '2026-01-27T11:45:00Z',
  'D2V8E7',
  true,
  2026
)
ON CONFLICT (id) DO UPDATE SET
  payment_status = EXCLUDED.payment_status,
  total_paid = EXCLUDED.total_paid,
  qr_token = EXCLUDED.qr_token,
  is_tshirt_collected = EXCLUDED.is_tshirt_collected;

INSERT INTO public.registrations_2026 (
  id, full_name, full_name_bn, photo_url, mobile_number, email, address,
  category, passing_year, current_class, batch_name, group_or_section, roll_number,
  student_id, t_shirt_size, registration_fee, donation_amount, total_paid,
  payment_status, transaction_id, payment_method, server_verification_signature,
  verification_timestamp, verified_by, registered_at, qr_token, is_tshirt_collected, year
) VALUES (
  'PLSCF-2026-C2006',
  'Sadia Afrin',
  'সাদিয়া আফরিন',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&auto=format&fit=crop&q=80',
  '01831223344',
  'sadia.a@plscf.edu.bd',
  'Alipur, Faridpur',
  'current',
  '',
  'Class 11',
  'HSC 2027 Science',
  'Science',
  '15',
  'PLSC-2026-106',
  'M',
  500,
  0,
  500,
  'paid',
  'PST-NG-6639103',
  'nagad',
  'SIG_V2_3D661034F663910',
  '2026-01-28T10:16:30Z',
  'PAYSTATION_GATEWAY',
  '2026-01-28T10:15:00Z',
  'E5W1F9',
  true,
  2026
)
ON CONFLICT (id) DO UPDATE SET
  payment_status = EXCLUDED.payment_status,
  total_paid = EXCLUDED.total_paid,
  qr_token = EXCLUDED.qr_token,
  is_tshirt_collected = EXCLUDED.is_tshirt_collected;

INSERT INTO public.registrations_2026 (
  id, full_name, full_name_bn, photo_url, mobile_number, email, address,
  category, passing_year, current_class, batch_name, group_or_section, roll_number,
  student_id, t_shirt_size, registration_fee, donation_amount, total_paid,
  payment_status, transaction_id, payment_method, server_verification_signature,
  verification_timestamp, verified_by, registered_at, qr_token, is_tshirt_collected, year
) VALUES (
  'PLSCF-2026-C2007',
  'Rifat Hossain',
  'রিফাত হোসেন',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300&auto=format&fit=crop&q=80',
  '01632334455',
  'rifat.h@plscf.edu.bd',
  'Tepakhola, Faridpur',
  'current',
  '',
  'Class 11',
  'HSC 2027 Commerce',
  'Commerce',
  '09',
  'PLSC-2026-107',
  'XL',
  500,
  0,
  500,
  'paid',
  'PST-CRD-5528204',
  'card',
  'SIG_V2_4E552045F552820',
  '2026-01-29T14:01:45Z',
  'PAYSTATION_GATEWAY',
  '2026-01-29T14:00:00Z',
  'F8X3G2',
  false,
  2026
)
ON CONFLICT (id) DO UPDATE SET
  payment_status = EXCLUDED.payment_status,
  total_paid = EXCLUDED.total_paid,
  qr_token = EXCLUDED.qr_token,
  is_tshirt_collected = EXCLUDED.is_tshirt_collected;

INSERT INTO public.registrations_2026 (
  id, full_name, full_name_bn, photo_url, mobile_number, email, address,
  category, passing_year, current_class, batch_name, group_or_section, roll_number,
  student_id, t_shirt_size, registration_fee, donation_amount, total_paid,
  payment_status, transaction_id, payment_method, server_verification_signature,
  verification_timestamp, verified_by, registered_at, qr_token, is_tshirt_collected, year
) VALUES (
  'PLSCF-2026-C2008',
  'Nusrat Binte Alam',
  'নুসরাত বিনতে আলম',
  'https://images.unsplash.com/photo-1548142813-c348350df52b?w=300&auto=format&fit=crop&q=80',
  '01933445566',
  'nusrat.b@plscf.edu.bd',
  'Court Road, Faridpur',
  'current',
  '',
  'Class 12',
  'HSC 2026 Humanities',
  'Humanities',
  '02',
  'PLSC-2026-108',
  'S',
  500,
  0,
  500,
  'paid',
  'PST-BK-4419105',
  'bkash',
  'SIG_V2_5F441056F441910',
  '2026-01-30T09:41:30Z',
  'PAYSTATION_GATEWAY',
  '2026-01-30T09:40:00Z',
  'G1Y7H4',
  false,
  2026
)
ON CONFLICT (id) DO UPDATE SET
  payment_status = EXCLUDED.payment_status,
  total_paid = EXCLUDED.total_paid,
  qr_token = EXCLUDED.qr_token,
  is_tshirt_collected = EXCLUDED.is_tshirt_collected;

INSERT INTO public.registrations_2026 (
  id, full_name, full_name_bn, photo_url, mobile_number, email, address,
  category, passing_year, current_class, batch_name, group_or_section, roll_number,
  student_id, t_shirt_size, registration_fee, donation_amount, total_paid,
  payment_status, transaction_id, payment_method, server_verification_signature,
  verification_timestamp, verified_by, registered_at, qr_token, is_tshirt_collected, year
) VALUES (
  'PLSCF-2026-C2009',
  'Ahsan Habib',
  'আহসান হাবীব',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop&q=80',
  '01734556677',
  'ahsan.h@plscf.edu.bd',
  'Chawkbazar, Faridpur',
  'current',
  '',
  'Class 8',
  'Class 8 Section A',
  'Section A',
  '11',
  'PLSC-2026-109',
  'M',
  500,
  0,
  500,
  'paid',
  'PST-NG-3308206',
  'nagad',
  'SIG_V2_6A332067F330820',
  '2026-01-31T12:21:40Z',
  'PAYSTATION_GATEWAY',
  '2026-01-31T12:20:00Z',
  'H4Z2J6',
  true,
  2026
)
ON CONFLICT (id) DO UPDATE SET
  payment_status = EXCLUDED.payment_status,
  total_paid = EXCLUDED.total_paid,
  qr_token = EXCLUDED.qr_token,
  is_tshirt_collected = EXCLUDED.is_tshirt_collected;

INSERT INTO public.registrations_2026 (
  id, full_name, full_name_bn, photo_url, mobile_number, email, address,
  category, passing_year, current_class, batch_name, group_or_section, roll_number,
  student_id, t_shirt_size, registration_fee, donation_amount, total_paid,
  payment_status, transaction_id, payment_method, server_verification_signature,
  verification_timestamp, verified_by, registered_at, qr_token, is_tshirt_collected, year
) VALUES (
  'PLSCF-2026-C2010',
  'Jannatul Ferdous',
  'জান্নাতুল ফেরদৌস',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&auto=format&fit=crop&q=80',
  '01835667788',
  'jannat.f@plscf.edu.bd',
  'Sreepur, Faridpur',
  'current',
  '',
  'Class 8',
  'Class 8 Section B',
  'Section B',
  '07',
  'PLSC-2026-110',
  'S',
  500,
  0,
  500,
  'paid',
  'PST-RCK-2299107',
  'rocket',
  'SIG_V2_7B221078F229910',
  '2026-02-01T14:11:55Z',
  'PAYSTATION_GATEWAY',
  '2026-02-01T14:10:00Z',
  'J7A8K3',
  true,
  2026
)
ON CONFLICT (id) DO UPDATE SET
  payment_status = EXCLUDED.payment_status,
  total_paid = EXCLUDED.total_paid,
  qr_token = EXCLUDED.qr_token,
  is_tshirt_collected = EXCLUDED.is_tshirt_collected;

INSERT INTO public.registrations_2026 (
  id, full_name, full_name_bn, photo_url, mobile_number, email, address,
  category, passing_year, current_class, batch_name, group_or_section, roll_number,
  student_id, t_shirt_size, registration_fee, donation_amount, total_paid,
  payment_status, transaction_id, payment_method, server_verification_signature,
  verification_timestamp, verified_by, registered_at, qr_token, is_tshirt_collected, year
) VALUES (
  'PLSCF-2026-C2011',
  'Mahir Faisal',
  'মাহির ফয়সাল',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300&auto=format&fit=crop&q=80',
  '01536778899',
  'mahir.f@plscf.edu.bd',
  'Guhho Laxmipur, Faridpur',
  'current',
  '',
  'Class 7',
  'Class 7 Section A',
  'Section A',
  '14',
  'PLSC-2026-111',
  'S',
  500,
  0,
  500,
  'paid',
  'PST-BK-1188208',
  'bkash',
  'SIG_V2_8C112089F118820',
  '2026-02-02T16:31:40Z',
  'PAYSTATION_GATEWAY',
  '2026-02-02T16:30:00Z',
  'K1B3L7',
  false,
  2026
)
ON CONFLICT (id) DO UPDATE SET
  payment_status = EXCLUDED.payment_status,
  total_paid = EXCLUDED.total_paid,
  qr_token = EXCLUDED.qr_token,
  is_tshirt_collected = EXCLUDED.is_tshirt_collected;

INSERT INTO public.registrations_2026 (
  id, full_name, full_name_bn, photo_url, mobile_number, email, address,
  category, passing_year, current_class, batch_name, group_or_section, roll_number,
  student_id, t_shirt_size, registration_fee, donation_amount, total_paid,
  payment_status, transaction_id, payment_method, server_verification_signature,
  verification_timestamp, verified_by, registered_at, qr_token, is_tshirt_collected, year
) VALUES (
  'PLSCF-2026-C2012',
  'Samia Sultana',
  'সামিয়া সুলতানা',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&auto=format&fit=crop&q=80',
  '01337889900',
  'samia.s@plscf.edu.bd',
  'Kamlapur, Faridpur',
  'current',
  '',
  'Class 7',
  'Class 7 Section B',
  'Section B',
  '04',
  'PLSC-2026-112',
  'S',
  500,
  0,
  500,
  'paid',
  'PST-UP-9979109',
  'rocket',
  'SIG_V2_9D991090F997910',
  '2026-02-03T11:01:25Z',
  'PAYSTATION_GATEWAY',
  '2026-02-03T11:00:00Z',
  'L4C9M2',
  false,
  2026
)
ON CONFLICT (id) DO UPDATE SET
  payment_status = EXCLUDED.payment_status,
  total_paid = EXCLUDED.total_paid,
  qr_token = EXCLUDED.qr_token,
  is_tshirt_collected = EXCLUDED.is_tshirt_collected;

INSERT INTO public.registrations_2026 (
  id, full_name, full_name_bn, photo_url, mobile_number, email, address,
  category, passing_year, current_class, batch_name, group_or_section, roll_number,
  student_id, t_shirt_size, registration_fee, donation_amount, total_paid,
  payment_status, transaction_id, payment_method, server_verification_signature,
  verification_timestamp, verified_by, registered_at, qr_token, is_tshirt_collected, year
) VALUES (
  'PLSCF-2026-C2013',
  'Ariful Islam',
  'আরিফুল ইসলাম',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80',
  '01738990011',
  'ariful.i@plscf.edu.bd',
  'Jhiltoli, Faridpur',
  'current',
  '',
  'Class 6',
  'Class 6 Section A',
  'Section A',
  '18',
  'PLSC-2026-113',
  'S',
  500,
  0,
  500,
  'paid',
  'PST-BK-8868201',
  'bkash',
  'SIG_V2_0E882011F886820',
  '2026-02-04T13:41:50Z',
  'PAYSTATION_GATEWAY',
  '2026-02-04T13:40:00Z',
  'M7D2N8',
  false,
  2026
)
ON CONFLICT (id) DO UPDATE SET
  payment_status = EXCLUDED.payment_status,
  total_paid = EXCLUDED.total_paid,
  qr_token = EXCLUDED.qr_token,
  is_tshirt_collected = EXCLUDED.is_tshirt_collected;

INSERT INTO public.registrations_2026 (
  id, full_name, full_name_bn, photo_url, mobile_number, email, address,
  category, passing_year, current_class, batch_name, group_or_section, roll_number,
  student_id, t_shirt_size, registration_fee, donation_amount, total_paid,
  payment_status, transaction_id, payment_method, server_verification_signature,
  verification_timestamp, verified_by, registered_at, qr_token, is_tshirt_collected, year
) VALUES (
  'PLSCF-2026-C2014',
  'Tasnim Rahman',
  'তাসনিম রহমান',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&auto=format&fit=crop&q=80',
  '01839001122',
  'tasnim.r@plscf.edu.bd',
  'Ambikapur, Faridpur',
  'current',
  '',
  'Class 6',
  'Class 6 Section B',
  'Section B',
  '06',
  'PLSC-2026-114',
  'S',
  500,
  0,
  500,
  'paid',
  'PST-NG-7759102',
  'nagad',
  'SIG_V2_1F771022F775910',
  '2026-02-05T15:21:40Z',
  'PAYSTATION_GATEWAY',
  '2026-02-05T15:20:00Z',
  'N1E6P4',
  true,
  2026
)
ON CONFLICT (id) DO UPDATE SET
  payment_status = EXCLUDED.payment_status,
  total_paid = EXCLUDED.total_paid,
  qr_token = EXCLUDED.qr_token,
  is_tshirt_collected = EXCLUDED.is_tshirt_collected;

INSERT INTO public.registrations_2026 (
  id, full_name, full_name_bn, photo_url, mobile_number, email, address,
  category, passing_year, current_class, batch_name, group_or_section, roll_number,
  student_id, t_shirt_size, registration_fee, donation_amount, total_paid,
  payment_status, transaction_id, payment_method, server_verification_signature,
  verification_timestamp, verified_by, registered_at, qr_token, is_tshirt_collected, year
) VALUES (
  'PLSCF-2026-C2015',
  'Zayan Al Din',
  'জায়ান আল দিন',
  'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=300&auto=format&fit=crop&q=80',
  '01940112233',
  'zayan.d@plscf.edu.bd',
  'Madhukhali, Faridpur',
  'current',
  '',
  'Class 9',
  'Class 9 Section A',
  'Section A',
  '25',
  'PLSC-2026-115',
  'M',
  500,
  0,
  0,
  'pending',
  '',
  'bkash',
  NULL,
  NULL,
  NULL,
  '2026-02-06T10:30:00Z',
  'P4F1R9',
  false,
  2026
)
ON CONFLICT (id) DO UPDATE SET
  payment_status = EXCLUDED.payment_status,
  total_paid = EXCLUDED.total_paid,
  qr_token = EXCLUDED.qr_token,
  is_tshirt_collected = EXCLUDED.is_tshirt_collected;

-- 5. SEED GATE EVENTS
INSERT INTO public.gate_events (id, registration_id, student_name, batch_name, photo_url, event_type, gate_id, scanner_id, staff_id, staff_name, timestamp, status)
VALUES ('GATE-EVT-001', 'PLSCF-2026-F1001', 'Tanvir Ahmed', 'SSC 1998', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80', 'ENTRY', 'Gate 01 - Main Entrance', 'SCAN-GATE-01', 'STF-001', 'Tariqul Islam (Gate Lead)', '2026-02-15T08:15:22Z', 'APPROVED')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.gate_events (id, registration_id, student_name, batch_name, photo_url, event_type, gate_id, scanner_id, staff_id, staff_name, timestamp, status)
VALUES ('GATE-EVT-002', 'PLSCF-2026-F1002', 'Dr. Nusrat Jahan', 'SSC 2005', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&auto=format&fit=crop&q=80', 'ENTRY', 'Gate 01 - Main Entrance', 'SCAN-GATE-01', 'STF-001', 'Tariqul Islam (Gate Lead)', '2026-02-15T08:24:45Z', 'APPROVED')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.gate_events (id, registration_id, student_name, batch_name, photo_url, event_type, gate_id, scanner_id, staff_id, staff_name, timestamp, status)
VALUES ('GATE-EVT-003', 'PLSCF-2026-F1003', 'Md. Asaduzzaman', 'SSC 2012', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop&q=80', 'ENTRY', 'Gate 02 - East Gate', 'SCAN-GATE-02', 'STF-007', 'Tanvir Hasan (Gate 02 Officer)', '2026-02-15T08:35:10Z', 'APPROVED')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.gate_events (id, registration_id, student_name, batch_name, photo_url, event_type, gate_id, scanner_id, staff_id, staff_name, timestamp, status)
VALUES ('GATE-EVT-004', 'PLSCF-2026-C2002', 'Ayesha Siddiqua', 'HSC 2026 Science', 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&auto=format&fit=crop&q=80', 'ENTRY', 'Gate 01 - Main Entrance', 'SCAN-GATE-01', 'STF-001', 'Tariqul Islam (Gate Lead)', '2026-02-15T08:42:10Z', 'APPROVED')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.gate_events (id, registration_id, student_name, batch_name, photo_url, event_type, gate_id, scanner_id, staff_id, staff_name, timestamp, status)
VALUES ('GATE-EVT-005', 'PLSCF-2026-F1004', 'Kazi Mahfuzur Rahman', 'SSC 1986', 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300&auto=format&fit=crop&q=80', 'ENTRY', 'Gate 01 - Main Entrance', 'SCAN-GATE-01', 'STF-001', 'Tariqul Islam (Gate Lead)', '2026-02-15T08:50:30Z', 'APPROVED')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.gate_events (id, registration_id, student_name, batch_name, photo_url, event_type, gate_id, scanner_id, staff_id, staff_name, timestamp, status)
VALUES ('GATE-EVT-006', 'PLSCF-2026-C2001', 'Samiul Islam', 'Class 10 Section A', 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300&auto=format&fit=crop&q=80', 'ENTRY', 'Gate 02 - East Gate', 'SCAN-GATE-02', 'STF-007', 'Tanvir Hasan (Gate 02 Officer)', '2026-02-15T08:55:00Z', 'APPROVED')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.gate_events (id, registration_id, student_name, batch_name, photo_url, event_type, gate_id, scanner_id, staff_id, staff_name, timestamp, status)
VALUES ('GATE-EVT-007', 'PLSCF-2026-F1006', 'Engr. Moniruzzaman', 'SSC 1975', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80', 'ENTRY', 'Gate 01 - Main Entrance', 'SCAN-GATE-01', 'STF-001', 'Tariqul Islam (Gate Lead)', '2026-02-15T09:05:15Z', 'APPROVED')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.gate_events (id, registration_id, student_name, batch_name, photo_url, event_type, gate_id, scanner_id, staff_id, staff_name, timestamp, status)
VALUES ('GATE-EVT-008', 'PLSCF-2026-F1008', 'Prof. Anisur Rahman', 'SSC 1983', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&auto=format&fit=crop&q=80', 'ENTRY', 'Gate 01 - Main Entrance', 'SCAN-GATE-01', 'STF-001', 'Tariqul Islam (Gate Lead)', '2026-02-15T09:12:40Z', 'APPROVED')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.gate_events (id, registration_id, student_name, batch_name, photo_url, event_type, gate_id, scanner_id, staff_id, staff_name, timestamp, status)
VALUES ('GATE-EVT-009', 'PLSCF-2026-F1010', 'Golam Mostafa', 'SSC 1991', 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300&auto=format&fit=crop&q=80', 'ENTRY', 'Gate 02 - East Gate', 'SCAN-GATE-02', 'STF-007', 'Tanvir Hasan (Gate 02 Officer)', '2026-02-15T09:20:10Z', 'APPROVED')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.gate_events (id, registration_id, student_name, batch_name, photo_url, event_type, gate_id, scanner_id, staff_id, staff_name, timestamp, status)
VALUES ('GATE-EVT-010', 'PLSCF-2026-F1011', 'Farhana Yasmin', 'SSC 1995', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80', 'ENTRY', 'Gate 01 - Main Entrance', 'SCAN-GATE-01', 'STF-001', 'Tariqul Islam (Gate Lead)', '2026-02-15T09:30:00Z', 'APPROVED')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.gate_events (id, registration_id, student_name, batch_name, photo_url, event_type, gate_id, scanner_id, staff_id, staff_name, timestamp, status)
VALUES ('GATE-EVT-011', 'PLSCF-2026-F1001', 'Tanvir Ahmed', 'SSC 1998', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80', 'EXIT', 'Gate 01 - Main Entrance', 'SCAN-GATE-01', 'STF-001', 'Tariqul Islam (Gate Lead)', '2026-02-15T12:30:00Z', 'APPROVED')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.gate_events (id, registration_id, student_name, batch_name, photo_url, event_type, gate_id, scanner_id, staff_id, staff_name, timestamp, status)
VALUES ('GATE-EVT-012', 'PLSCF-2026-F1001', 'Tanvir Ahmed', 'SSC 1998', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80', 'ENTRY', 'Gate 01 - Main Entrance', 'SCAN-GATE-01', 'STF-001', 'Tariqul Islam (Gate Lead)', '2026-02-15T12:55:00Z', 'APPROVED')
ON CONFLICT (id) DO NOTHING;

-- 6. SEED FOOD DISTRIBUTIONS
INSERT INTO public.food_distributions (id, registration_id, student_name, batch_name, meal_type, status, collected_at, staff_id, staff_name, notes)
VALUES ('FOOD-DIST-001', 'PLSCF-2026-F1001', 'Tanvir Ahmed', 'SSC 1998', 'breakfast', 'COLLECTED', '2026-02-15T08:30:15Z', 'STF-003', 'Nasir Uddin (Breakfast Lead)', 'Breakfast packet verified')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.food_distributions (id, registration_id, student_name, batch_name, meal_type, status, collected_at, staff_id, staff_name, notes)
VALUES ('FOOD-DIST-002', 'PLSCF-2026-F1002', 'Dr. Nusrat Jahan', 'SSC 2005', 'breakfast', 'COLLECTED', '2026-02-15T08:40:00Z', 'STF-003', 'Nasir Uddin (Breakfast Lead)', '')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.food_distributions (id, registration_id, student_name, batch_name, meal_type, status, collected_at, staff_id, staff_name, notes)
VALUES ('FOOD-DIST-003', 'PLSCF-2026-C2002', 'Ayesha Siddiqua', 'HSC 2026 Science', 'breakfast', 'COLLECTED', '2026-02-15T08:52:10Z', 'STF-003', 'Nasir Uddin (Breakfast Lead)', '')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.food_distributions (id, registration_id, student_name, batch_name, meal_type, status, collected_at, staff_id, staff_name, notes)
VALUES ('FOOD-DIST-004', 'PLSCF-2026-F1001', 'Tanvir Ahmed', 'SSC 1998', 'lunch', 'COLLECTED', '2026-02-15T13:05:40Z', 'STF-002', 'Mohammad Faruk Hossain (Lunch Incharge)', 'Buffet token redeemed')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.food_distributions (id, registration_id, student_name, batch_name, meal_type, status, collected_at, staff_id, staff_name, notes)
VALUES ('FOOD-DIST-005', 'PLSCF-2026-F1002', 'Dr. Nusrat Jahan', 'SSC 2005', 'lunch', 'COLLECTED', '2026-02-15T13:12:00Z', 'STF-002', 'Mohammad Faruk Hossain (Lunch Incharge)', '')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.food_distributions (id, registration_id, student_name, batch_name, meal_type, status, collected_at, staff_id, staff_name, notes)
VALUES ('FOOD-DIST-006', 'PLSCF-2026-F1004', 'Kazi Mahfuzur Rahman', 'SSC 1986', 'breakfast', 'COLLECTED', '2026-02-15T09:00:15Z', 'STF-003', 'Nasir Uddin (Breakfast Lead)', '')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.food_distributions (id, registration_id, student_name, batch_name, meal_type, status, collected_at, staff_id, staff_name, notes)
VALUES ('FOOD-DIST-007', 'PLSCF-2026-F1006', 'Engr. Moniruzzaman', 'SSC 1975', 'breakfast', 'COLLECTED', '2026-02-15T09:15:00Z', 'STF-003', 'Nasir Uddin (Breakfast Lead)', '')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.food_distributions (id, registration_id, student_name, batch_name, meal_type, status, collected_at, staff_id, staff_name, notes)
VALUES ('FOOD-DIST-008', 'PLSCF-2026-F1008', 'Prof. Anisur Rahman', 'SSC 1983', 'lunch', 'COLLECTED', '2026-02-15T13:25:30Z', 'STF-002', 'Mohammad Faruk Hossain (Lunch Incharge)', '')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.food_distributions (id, registration_id, student_name, batch_name, meal_type, status, collected_at, staff_id, staff_name, notes)
VALUES ('FOOD-DIST-009', 'PLSCF-2026-F1010', 'Golam Mostafa', 'SSC 1991', 'lunch', 'COLLECTED', '2026-02-15T13:30:10Z', 'STF-002', 'Mohammad Faruk Hossain (Lunch Incharge)', '')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.food_distributions (id, registration_id, student_name, batch_name, meal_type, status, collected_at, staff_id, staff_name, notes)
VALUES ('FOOD-DIST-010', 'PLSCF-2026-F1011', 'Farhana Yasmin', 'SSC 1995', 'lunch', 'COLLECTED', '2026-02-15T13:40:00Z', 'STF-002', 'Mohammad Faruk Hossain (Lunch Incharge)', '')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.food_distributions (id, registration_id, student_name, batch_name, meal_type, status, collected_at, staff_id, staff_name, notes)
VALUES ('FOOD-DIST-011', 'PLSCF-2026-F1006', 'Engr. Moniruzzaman', 'SSC 1975', 'dinner', 'COLLECTED', '2026-02-15T19:30:00Z', 'STF-006', 'Abdur Rahim (Dinner Incharge)', 'VIP Dinner pass redeemed')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.food_distributions (id, registration_id, student_name, batch_name, meal_type, status, collected_at, staff_id, staff_name, notes)
VALUES ('FOOD-DIST-012', 'PLSCF-2026-F1008', 'Prof. Anisur Rahman', 'SSC 1983', 'dinner', 'COLLECTED', '2026-02-15T19:45:00Z', 'STF-006', 'Abdur Rahim (Dinner Incharge)', '')
ON CONFLICT (id) DO NOTHING;

-- 7. SEED DRESS DISTRIBUTIONS
INSERT INTO public.dress_distributions (id, registration_id, student_name, item_type, registered_size, status, received_at, staff_id, staff_name, notes)
VALUES ('DRS-DIST-001', 'PLSCF-2026-F1002', 'Dr. Nusrat Jahan', 'reunion_tshirt', 'M', 'RECEIVED', '2026-02-15T08:20:00Z', 'STF-004', 'Jamal Uddin Chowdhury (Kit & T-Shirt)', 'Kits & Souvenir Bag delivered')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.dress_distributions (id, registration_id, student_name, item_type, registered_size, status, received_at, staff_id, staff_name, notes)
VALUES ('DRS-DIST-002', 'PLSCF-2026-C2002', 'Ayesha Siddiqua', 'reunion_tshirt', 'S', 'RECEIVED', '2026-02-15T08:45:00Z', 'STF-004', 'Jamal Uddin Chowdhury (Kit & T-Shirt)', 'Verified against current student registration')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.dress_distributions (id, registration_id, student_name, item_type, registered_size, status, received_at, staff_id, staff_name, notes)
VALUES ('DRS-DIST-003', 'PLSCF-2026-F1006', 'Engr. Moniruzzaman', 'reunion_tshirt', 'XL', 'RECEIVED', '2026-02-15T09:10:00Z', 'STF-004', 'Jamal Uddin Chowdhury (Kit & T-Shirt)', '')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.dress_distributions (id, registration_id, student_name, item_type, registered_size, status, received_at, staff_id, staff_name, notes)
VALUES ('DRS-DIST-004', 'PLSCF-2026-F1008', 'Prof. Anisur Rahman', 'reunion_tshirt', 'M', 'RECEIVED', '2026-02-15T09:20:00Z', 'STF-004', 'Jamal Uddin Chowdhury (Kit & T-Shirt)', '')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.dress_distributions (id, registration_id, student_name, item_type, registered_size, status, received_at, staff_id, staff_name, notes)
VALUES ('DRS-DIST-005', 'PLSCF-2026-F1010', 'Golam Mostafa', 'reunion_tshirt', 'XL', 'RECEIVED', '2026-02-15T09:35:00Z', 'STF-008', 'Kazi Rayhan (Distribution Booth 02)', '')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.dress_distributions (id, registration_id, student_name, item_type, registered_size, status, received_at, staff_id, staff_name, notes)
VALUES ('DRS-DIST-006', 'PLSCF-2026-F1011', 'Farhana Yasmin', 'reunion_tshirt', 'M', 'RECEIVED', '2026-02-15T09:45:00Z', 'STF-008', 'Kazi Rayhan (Distribution Booth 02)', '')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.dress_distributions (id, registration_id, student_name, item_type, registered_size, status, received_at, staff_id, staff_name, notes)
VALUES ('DRS-DIST-007', 'PLSCF-2026-F1014', 'Zubair Hossain', 'reunion_tshirt', 'XXL', 'RECEIVED', '2026-02-15T10:05:00Z', 'STF-008', 'Kazi Rayhan (Distribution Booth 02)', '')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.dress_distributions (id, registration_id, student_name, item_type, registered_size, status, received_at, staff_id, staff_name, notes)
VALUES ('DRS-DIST-008', 'PLSCF-2026-F1015', 'Mahbuba Akter', 'reunion_tshirt', 'M', 'RECEIVED', '2026-02-15T10:20:00Z', 'STF-004', 'Jamal Uddin Chowdhury (Kit & T-Shirt)', '')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.dress_distributions (id, registration_id, student_name, item_type, registered_size, status, received_at, staff_id, staff_name, notes)
VALUES ('DRS-DIST-009', 'PLSCF-2026-C2005', 'Fatema Tuj Zohra', 'reunion_tshirt', 'S', 'RECEIVED', '2026-02-15T10:40:00Z', 'STF-004', 'Jamal Uddin Chowdhury (Kit & T-Shirt)', '')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.dress_distributions (id, registration_id, student_name, item_type, registered_size, status, received_at, staff_id, staff_name, notes)
VALUES ('DRS-DIST-010', 'PLSCF-2026-C2006', 'Sadia Afrin', 'reunion_tshirt', 'M', 'RECEIVED', '2026-02-15T10:55:00Z', 'STF-008', 'Kazi Rayhan (Distribution Booth 02)', '')
ON CONFLICT (id) DO NOTHING;

-- 8. SEED STAFF ALLOCATIONS & EXPENSES
INSERT INTO public.staff_allocations (id, staff_id, staff_name, allocated_amount, academic_year, status, allocated_at, allocated_by, notes)
VALUES ('ALC-001', 'STF-005', 'Md. Shafiqul Alam (Finance Secretary)', 150000, 2026, 'ACTIVE', '2026-01-10T10:00:00Z', 'SUPER_ADMIN', 'Treasury operations, vendor settlements, and emergency liquidity')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.staff_allocations (id, staff_id, staff_name, allocated_amount, academic_year, status, allocated_at, allocated_by, notes)
VALUES ('ALC-002', 'STF-004', 'Jamal Uddin Chowdhury (Kit & T-Shirt)', 100000, 2026, 'ACTIVE', '2026-01-12T11:00:00Z', 'SUPER_ADMIN', 'T-shirt logistics, packaging, and kit distribution booth setup')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.staff_allocations (id, staff_id, staff_name, allocated_amount, academic_year, status, allocated_at, allocated_by, notes)
VALUES ('ALC-003', 'STF-003', 'Nasir Uddin (Breakfast Lead)', 40000, 2026, 'ACTIVE', '2026-01-15T09:00:00Z', 'SUPER_ADMIN', 'Breakfast mineral water, morning refreshments procurement')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.staff_allocations (id, staff_id, staff_name, allocated_amount, academic_year, status, allocated_at, allocated_by, notes)
VALUES ('ALC-004', 'STF-002', 'Mohammad Faruk Hossain (Lunch Incharge)', 120000, 2026, 'ACTIVE', '2026-01-18T10:00:00Z', 'SUPER_ADMIN', 'Grand Buffet catering booking, serving personnel & disposable ware')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.staff_allocations (id, staff_id, staff_name, allocated_amount, academic_year, status, allocated_at, allocated_by, notes)
VALUES ('ALC-005', 'STF-006', 'Abdur Rahim (Dinner Incharge)', 60000, 2026, 'ACTIVE', '2026-01-20T11:00:00Z', 'SUPER_ADMIN', 'Evening cultural show buffet and tea session logistics')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.staff_allocations (id, staff_id, staff_name, allocated_amount, academic_year, status, allocated_at, allocated_by, notes)
VALUES ('ALC-006', 'STF-001', 'Tariqul Islam (Gate Lead)', 30000, 2026, 'ACTIVE', '2026-01-22T09:30:00Z', 'SUPER_ADMIN', 'Gate metal detectors, barricades, and wireless QR scanners')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.staff_expenses (id, staff_id, staff_name, amount, category, description, expense_date, expense_time, vendor_name, status, approved_by, approved_at, created_at)
VALUES ('EXP-2026-01', 'STF-005', 'Md. Shafiqul Alam (Finance Secretary)', 50000, 'Stage & Sound Fabrication', 'Advance payment for main sound setup and lighting rig', '2026-01-20', '11:30', 'Faridpur Acoustic Engineering', 'APPROVED', 'Dr. M. A. Kashem (Convenor)', '2026-01-20T14:00:00Z', '2026-01-20T11:30:00Z')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.staff_expenses (id, staff_id, staff_name, amount, category, description, expense_date, expense_time, vendor_name, status, approved_by, approved_at, created_at)
VALUES ('EXP-2026-02', 'STF-004', 'Jamal Uddin Chowdhury (Kit & T-Shirt)', 35000, 'T-Shirt Packaging & Badges', 'Cotton fabric inspection and packaging box advance', '2026-01-25', '15:00', 'Bengal Knitwear Faridpur', 'APPROVED', 'Dr. M. A. Kashem (Convenor)', '2026-01-25T16:00:00Z', '2026-01-25T15:00:00Z')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.staff_expenses (id, staff_id, staff_name, amount, category, description, expense_date, expense_time, vendor_name, status, approved_by, approved_at, created_at)
VALUES ('EXP-2026-03', 'STF-003', 'Nasir Uddin (Breakfast Lead)', 8000, 'Mineral Water Jars', 'Advance booking for 200 high-grade filtered water dispensers', '2026-02-01', '09:00', 'Padma Pure Water Co.', 'APPROVED', 'Md. Shafiqul Alam (Finance)', '2026-02-01T11:00:00Z', '2026-02-01T09:00:00Z')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.staff_expenses (id, staff_id, staff_name, amount, category, description, expense_date, expense_time, vendor_name, status, approved_by, approved_at, created_at)
VALUES ('EXP-2026-04', 'STF-002', 'Mohammad Faruk Hossain (Lunch Incharge)', 45000, 'Buffet Crockery & Disposable Box', 'Procurement of eco-friendly cutlery and lunch boxes', '2026-02-03', '14:20', 'Faridpur Catering Supplies Ltd.', 'APPROVED', 'Md. Shafiqul Alam (Finance)', '2026-02-03T16:00:00Z', '2026-02-03T14:20:00Z')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.staff_expenses (id, staff_id, staff_name, amount, category, description, expense_date, expense_time, vendor_name, status, approved_by, approved_at, created_at)
VALUES ('EXP-2026-05', 'STF-001', 'Tariqul Islam (Gate Lead)', 12000, 'Gate Signage & Canopy', 'Weatherproof entrance arches and scanner stands', '2026-02-04', '10:00', 'Modern Sign & Print', 'APPROVED', 'Md. Shafiqul Alam (Finance)', '2026-02-04T12:00:00Z', '2026-02-04T10:00:00Z')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.staff_expenses (id, staff_id, staff_name, amount, category, description, expense_date, expense_time, vendor_name, status, approved_by, approved_at, created_at)
VALUES ('EXP-2026-06', 'STF-006', 'Abdur Rahim (Dinner Incharge)', 15000, 'Evening Snacks & Tea', 'Traditional sweets and high tea logistics', '2026-02-05', '16:00', 'Faridpur Sweet Bakery', 'SUBMITTED', NULL, NULL, '2026-02-05T16:00:00Z')
ON CONFLICT (id) DO NOTHING;

-- 9. SEED FINANCIAL LEDGER
INSERT INTO public.financial_ledger (id, staff_id, transaction_type, amount, reference_id, description, created_at, created_by)
VALUES ('LDG-001', 'STF-007', 'ALLOCATION', 150000, 'ALC-001', 'Central budget allocation to Finance Secretary', '2026-01-10T10:00:00Z', 'SUPER_ADMIN')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.financial_ledger (id, staff_id, transaction_type, amount, reference_id, description, created_at, created_by)
VALUES ('LDG-002', 'STF-006', 'ALLOCATION', 100000, 'ALC-002', 'Central budget allocation to Logistics Incharge', '2026-01-12T11:00:00Z', 'SUPER_ADMIN')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.financial_ledger (id, staff_id, transaction_type, amount, reference_id, description, created_at, created_by)
VALUES ('LDG-003', 'STF-003', 'ALLOCATION', 30000, 'ALC-003', 'Central budget allocation to Breakfast Counter', '2026-01-15T09:00:00Z', 'SUPER_ADMIN')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.financial_ledger (id, staff_id, transaction_type, amount, reference_id, description, created_at, created_by)
VALUES ('LDG-004', 'STF-007', 'EXPENSE', 50000, 'EXP-2026-01', 'Stage & Sound Fabrication advance payment', '2026-01-20T14:00:00Z', 'STF-007')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.financial_ledger (id, staff_id, transaction_type, amount, reference_id, description, created_at, created_by)
VALUES ('LDG-005', 'STF-006', 'EXPENSE', 35000, 'EXP-2026-02', 'T-Shirt Packaging & Badges payment', '2026-01-25T16:00:00Z', 'STF-006')
ON CONFLICT (id) DO NOTHING;
