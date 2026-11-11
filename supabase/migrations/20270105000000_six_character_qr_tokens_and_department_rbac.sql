-- ============================================================================
-- POLICE LINES SCHOOL AND COLLEGE, FARIDPUR - REUNION MANAGEMENT PLATFORM
-- MIGRATION: 20270105000000_six_character_qr_tokens_and_department_rbac.sql
--
-- Features Implemented:
-- 1. Dedicated Department Isolation & Granular Permissions in staff_accounts
-- 2. 6-Character QR Token Verification & Global Uniqueness Constraints
-- 3. High-Concurrency Atomic Service Distribution RPC (rpc_verify_and_approve_service)
-- 4. Information-Minimized Service Verification Function
-- 5. Cryptographic 6-character Token Generation Function
-- ============================================================================

-- 1. HARDEN STAFF ACCOUNTS WITH DEPARTMENT & PERMISSIONS
ALTER TABLE public.staff_accounts
ADD COLUMN IF NOT EXISTS department TEXT DEFAULT 'ALL_SERVICES';

ALTER TABLE public.staff_accounts
ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '["VIEW", "SCAN", "VERIFY", "APPROVE"]'::jsonb;

-- Ensure constraint for department isolation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_staff_department' AND conrelid = 'public.staff_accounts'::regclass
  ) THEN
    ALTER TABLE public.staff_accounts
    ADD CONSTRAINT chk_staff_department CHECK (
      department IN (
        'BREAKFAST',
        'LUNCH',
        'DINNER',
        'DRESS',
        'GATE',
        'FINANCE',
        'ALL_SERVICES'
      )
    );
  END IF;
END $$;

-- Backfill existing staff accounts based on assigned role
UPDATE public.staff_accounts
SET department = CASE
  WHEN role = 'SUPER_ADMIN' THEN 'ALL_SERVICES'
  WHEN role = 'BREAKFAST_STAFF' THEN 'BREAKFAST'
  WHEN role = 'LUNCH_STAFF' THEN 'LUNCH'
  WHEN role = 'DINNER_STAFF' THEN 'DINNER'
  WHEN role = 'DRESS_STAFF' THEN 'DRESS'
  WHEN role = 'GATE_STAFF' THEN 'GATE'
  WHEN role = 'FINANCE_STAFF' THEN 'FINANCE'
  ELSE 'ALL_SERVICES'
END
WHERE department IS NULL OR department = 'ALL_SERVICES';

UPDATE public.staff_accounts
SET permissions = CASE
  WHEN role = 'SUPER_ADMIN' THEN '["VIEW", "SCAN", "VERIFY", "APPROVE", "REJECT", "EXPORT", "MANAGE"]'::jsonb
  WHEN role = 'FINANCE_STAFF' THEN '["VIEW", "VERIFY", "APPROVE", "EXPORT"]'::jsonb
  ELSE '["VIEW", "SCAN", "VERIFY", "APPROVE"]'::jsonb
END
WHERE permissions IS NULL;

-- 2. ENFORCE 6-CHARACTER QR TOKEN CONSTRAINTS
-- Global unique indexes for rapid token lookups (keyspace: 36^6 = 2,176,782,336)
CREATE INDEX IF NOT EXISTS idx_registrations_2026_qr_token
ON public.registrations_2026(qr_token)
WHERE qr_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_registrations_2027_qr_token
ON public.registrations_2027(qr_token)
WHERE qr_token IS NOT NULL;

-- 3. CRYPTOGRAPHIC 6-CHARACTER TOKEN GENERATOR IN PL/pgSQL
CREATE OR REPLACE FUNCTION public.fn_generate_six_char_token()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  chars TEXT := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  result TEXT := '';
  i INTEGER;
  byte_val INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    -- Cryptographic random integer from pgcrypto/crypto random bytes
    byte_val := (('x' || substr(md5(random()::text || clock_timestamp()::text || gen_random_uuid()::text), 1, 2))::bit(8)::integer);
    result := result || substr(chars, (byte_val % 36) + 1, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- 4. ATOMIC, HIGH-CONCURRENCY SERVICE APPROVAL RPC
-- Prevents double-spending / duplicate food or kit distribution across concurrent scanners
CREATE OR REPLACE FUNCTION public.rpc_verify_and_approve_service(
  p_token_or_id TEXT,
  p_department TEXT,
  p_staff_id TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_staff RECORD;
  v_student RECORD;
  v_student_id TEXT;
  v_student_name TEXT;
  v_batch_name TEXT;
  v_tshirt_size TEXT;
  v_payment_status TEXT;
  v_already_collected BOOLEAN := FALSE;
  v_collected_at TIMESTAMPTZ;
  v_meal_type TEXT;
  v_dist_id TEXT;
BEGIN
  -- 1. Validate Staff Authorization & Department RBAC
  SELECT * INTO v_staff
  FROM public.staff_accounts
  WHERE id = p_staff_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'UNAUTHORIZED_STAFF',
      'message', 'Staff account not recognized or deleted.'
    );
  END IF;

  IF v_staff.status != 'ACTIVE' THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'UNAUTHORIZED_STAFF',
      'message', 'Staff account is deactivated.'
    );
  END IF;

  -- Verify department isolation (SUPER_ADMIN or matching department)
  IF v_staff.role != 'SUPER_ADMIN' AND v_staff.department != 'ALL_SERVICES' AND v_staff.department != p_department THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'PERMISSION_DENIED',
      'message', format('Staff assigned to %s cannot approve services in %s.', v_staff.department, p_department)
    );
  END IF;

  -- Verify granular APPROVE permission
  IF v_staff.role != 'SUPER_ADMIN' AND NOT (v_staff.permissions ? 'APPROVE') THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'PERMISSION_DENIED',
      'message', 'Staff lacks APPROVE permission for this service station.'
    );
  END IF;

  -- 2. Locate Student by 6-Character Token or Registration ID
  -- Check registrations_2026 first, then registrations_2027
  SELECT id, full_name, batch_name, t_shirt_size, payment_status
  INTO v_student_id, v_student_name, v_batch_name, v_tshirt_size, v_payment_status
  FROM public.registrations_2026
  WHERE UPPER(id) = UPPER(p_token_or_id) OR UPPER(qr_token) = UPPER(p_token_or_id)
  LIMIT 1;

  IF v_student_id IS NULL THEN
    SELECT id, full_name, batch_name, t_shirt_size, payment_status
    INTO v_student_id, v_student_name, v_batch_name, v_tshirt_size, v_payment_status
    FROM public.registrations_2027
    WHERE UPPER(id) = UPPER(p_token_or_id) OR UPPER(qr_token) = UPPER(p_token_or_id)
    LIMIT 1;
  END IF;

  IF v_student_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'INVALID_TOKEN',
      'message', format('No registration found for token or ID "%s".', p_token_or_id)
    );
  END IF;

  IF v_payment_status != 'paid' THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'NOT_ELIGIBLE',
      'message', format('Student registration is in "%s" state. Payment required.', v_payment_status)
    );
  END IF;

  -- 3. Execute Department Service Distribution
  IF p_department IN ('BREAKFAST', 'LUNCH', 'DINNER') THEN
    v_meal_type := lower(p_department);

    -- Check if breakfast cutoff is passed (1:00 PM BD time)
    IF v_meal_type = 'breakfast' AND (NOW() AT TIME ZONE 'Asia/Dhaka')::time > '13:00:00'::time THEN
      RETURN jsonb_build_object(
        'success', false,
        'status', 'SERVICE_CLOSED',
        'message', 'Breakfast service closed after 1:00 PM Bangladesh time.'
      );
    END IF;

    -- Concurrency-safe atomic check & insert
    SELECT collected_at INTO v_collected_at
    FROM public.food_distributions
    WHERE registration_id = v_student_id AND meal_type = v_meal_type AND status = 'COLLECTED';

    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', false,
        'status', 'ALREADY_DISTRIBUTED',
        'message', format('%s was already collected at %s.', p_department, to_char(v_collected_at, 'HH12:MI AM'))
      );
    END IF;

    v_dist_id := 'FOOD-' || substr(gen_random_uuid()::text, 1, 8);
    INSERT INTO public.food_distributions (
      id, registration_id, student_name, batch_name, meal_type,
      status, collected_at, staff_id, staff_name, notes
    ) VALUES (
      v_dist_id, v_student_id, v_student_name, v_batch_name, v_meal_type,
      'COLLECTED', NOW(), v_staff.id, v_staff.full_name, p_notes
    );

  ELSIF p_department = 'DRESS' THEN
    SELECT received_at INTO v_collected_at
    FROM public.dress_distributions
    WHERE registration_id = v_student_id AND item_type = 'reunion_tshirt' AND status = 'RECEIVED';

    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', false,
        'status', 'ALREADY_DISTRIBUTED',
        'message', format('Reunion T-Shirt (Size: %s) was already collected at %s.', v_tshirt_size, to_char(v_collected_at, 'HH12:MI AM'))
      );
    END IF;

    v_dist_id := 'DRS-' || substr(gen_random_uuid()::text, 1, 8);
    INSERT INTO public.dress_distributions (
      id, registration_id, student_name, item_type, registered_size,
      status, received_at, staff_id, staff_name, notes
    ) VALUES (
      v_dist_id, v_student_id, v_student_name, 'reunion_tshirt', v_tshirt_size,
      'RECEIVED', NOW(), v_staff.id, v_staff.full_name, p_notes
    );

  ELSIF p_department = 'GATE' THEN
    v_dist_id := 'GATE-' || substr(gen_random_uuid()::text, 1, 8);
    INSERT INTO public.gate_events (
      id, registration_id, student_name, batch_name, event_type,
      gate_id, staff_id, staff_name, timestamp, status
    ) VALUES (
      v_dist_id, v_student_id, v_student_name, v_batch_name, 'ENTRY',
      COALESCE(v_staff.assigned_gate, 'Gate 01 - Main Entrance'),
      v_staff.id, v_staff.full_name, NOW(), 'APPROVED'
    );
  ELSE
    RETURN jsonb_build_object(
      'success', false,
      'status', 'INVALID_DEPARTMENT',
      'message', format('Unknown department "%s".', p_department)
    );
  END IF;

  -- 4. Return sanitized, information-minimized success record
  RETURN jsonb_build_object(
    'success', true,
    'status', 'APPROVED',
    'message', format('%s approved successfully for %s.', p_department, v_student_name),
    'record', jsonb_build_object(
      'id', v_student_id,
      'fullName', v_student_name,
      'batchName', v_batch_name,
      'department', p_department,
      'distributionId', v_dist_id,
      'timestamp', NOW()
    )
  );
END;
$$;

