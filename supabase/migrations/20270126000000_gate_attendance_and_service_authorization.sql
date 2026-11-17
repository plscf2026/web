-- Migration: 20270126000000_gate_attendance_and_service_authorization.sql
-- Description: Live Gate Entry/Back Access Control with Concurrency Protection for Food & T-Shirt Distribution

-- 1. Ensure is_checked_in and gate_status columns exist and are indexed on registrations_2027
ALTER TABLE public.registrations_2027
  ADD COLUMN IF NOT EXISTS is_checked_in BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.registrations_2027
  ADD COLUMN IF NOT EXISTS gate_status TEXT NOT NULL DEFAULT 'NOT_ENTERED';

-- Allow 'NOT_ENTERED', 'ENTRY', 'BACK', 'EXIT' in gate_status
DO $$
BEGIN
  ALTER TABLE public.registrations_2027
    DROP CONSTRAINT IF EXISTS registrations_2027_gate_status_check;
  ALTER TABLE public.registrations_2027
    ADD CONSTRAINT registrations_2027_gate_status_check
    CHECK (gate_status IN ('NOT_ENTERED', 'ENTRY', 'BACK', 'EXIT'));
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_registrations_2027_checked_in ON public.registrations_2027(is_checked_in);
CREATE INDEX IF NOT EXISTS idx_registrations_2027_gate_status ON public.registrations_2027(gate_status);

-- 2. Ensure gate_events allows 'ENTRY', 'BACK', 'EXIT'
DO $$
BEGIN
  ALTER TABLE public.gate_events
    DROP CONSTRAINT IF EXISTS gate_events_event_type_check;
  ALTER TABLE public.gate_events
    ADD CONSTRAINT gate_events_event_type_check
    CHECK (event_type IN ('ENTRY', 'EXIT', 'BACK'));
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- 3. DEDICATED SECURITY DEFINER RPC: rpc_toggle_gate_attendance
CREATE OR REPLACE FUNCTION public.rpc_toggle_gate_attendance(
  p_reg_id TEXT,
  p_is_inside BOOLEAN,
  p_staff_id TEXT DEFAULT 'ADMIN',
  p_staff_name TEXT DEFAULT 'Admin',
  p_gate_id TEXT DEFAULT 'Gate 01 - Main Entrance'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARATION
DECLARE
  v_reg RECORD;
  v_event_id TEXT;
  v_event_type TEXT;
BEGIN
  -- 1. Validate student exists in registrations_2027 with row locking
  SELECT id, full_name, batch_name, photo_url, payment_status, is_checked_in, gate_status
  INTO v_reg
  FROM public.registrations_2027
  WHERE id = p_reg_id OR student_id = p_reg_id
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND', 'message', 'Student registration not found: ' || p_reg_id);
  END IF;

  v_event_type := CASE WHEN p_is_inside THEN 'ENTRY' ELSE 'BACK' END;
  v_event_id := 'GATE-' || floor(extract(epoch from now()) * 1000)::text || '-' || floor(random() * 900 + 100)::text;

  -- 2. Atomically update registrations_2027 check-in flag and gate_status
  UPDATE public.registrations_2027
  SET is_checked_in = p_is_inside,
      gate_status = v_event_type
  WHERE id = v_reg.id;

  -- 3. Insert into gate_events log (audit trail preserved)
  INSERT INTO public.gate_events (
    id, registration_id, student_name, batch_name, photo_url,
    event_type, gate_id, staff_id, staff_name, timestamp, status
  ) VALUES (
    v_event_id,
    v_reg.id,
    v_reg.full_name,
    COALESCE(v_reg.batch_name, 'General'),
    v_reg.photo_url,
    v_event_type,
    COALESCE(p_gate_id, 'Gate 01 - Main Entrance'),
    COALESCE(p_staff_id, 'ADMIN'),
    COALESCE(p_staff_name, 'Admin'),
    NOW(),
    'APPROVED'
  );

  RETURN jsonb_build_object(
    'success', true,
    'registration_id', v_reg.id,
    'is_inside', p_is_inside,
    'gate_status', v_event_type,
    'event_id', v_event_id,
    'event_type', v_event_type
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_toggle_gate_attendance(TEXT, BOOLEAN, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

-- 4. CONCURRENCY-SAFE GATE CONFIRMATION RPC: rpc_confirm_gate_event
CREATE OR REPLACE FUNCTION public.rpc_confirm_gate_event(
  p_registration_id TEXT,
  p_event_type TEXT,
  p_gate_id TEXT,
  p_staff_id TEXT,
  p_staff_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_student RECORD;
  v_last_event RECORD;
  v_new_event_id TEXT;
  v_is_inside BOOLEAN;
  v_norm_type TEXT;
BEGIN
  -- Normalize event type: map EXIT to BACK for canonical prompt state
  v_norm_type := CASE WHEN upper(trim(p_event_type)) IN ('BACK', 'EXIT') THEN 'BACK' ELSE 'ENTRY' END;

  -- 1. Validate registration exists and lock row to prevent race conditions
  SELECT id, full_name, batch_name, photo_url, payment_status, is_checked_in, gate_status
  INTO v_student
  FROM public.registrations_2027
  WHERE id = p_registration_id OR student_id = p_registration_id
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'STUDENT_NOT_FOUND', 'message', 'Student registration not found.');
  END IF;

  IF v_student.payment_status <> 'paid' THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNPAID_REGISTRATION', 'message', 'Student registration is not paid.');
  END IF;

  -- 2. Concurrency-safe state check: inspect latest approved gate event with FOR UPDATE
  SELECT event_type, status INTO v_last_event
  FROM public.gate_events
  WHERE registration_id = v_student.id
    AND status = 'APPROVED'
  ORDER BY timestamp DESC
  LIMIT 1
  FOR UPDATE;

  v_is_inside := FOUND AND (v_last_event.event_type = 'ENTRY');
  IF NOT FOUND THEN
    v_is_inside := (v_student.is_checked_in IS TRUE);
  END IF;

  IF v_norm_type = 'ENTRY' AND v_is_inside THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'DUPLICATE_ENTRY',
      'message', 'DUPLICATE ENTRY ALERT: Student is already marked as INSIDE the venue!'
    );
  END IF;

  IF v_norm_type = 'BACK' AND NOT v_is_inside THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'EXIT_MISMATCH',
      'message', 'EXIT MISMATCH ALERT: Student does not have an active entry record!'
    );
  END IF;

  -- 3. Atomic event insertion
  v_new_event_id := 'GATE-' || EXTRACT(EPOCH FROM NOW())::BIGINT || '-' || floor(random() * 1000)::INT;

  INSERT INTO public.gate_events (
    id, registration_id, student_name, batch_name, photo_url,
    event_type, gate_id, staff_id, staff_name, timestamp, status
  ) VALUES (
    v_new_event_id, v_student.id, v_student.full_name, v_student.batch_name,
    v_student.photo_url, v_norm_type, COALESCE(p_gate_id, 'Main Gate'),
    COALESCE(p_staff_id, 'GATE_STAFF'), COALESCE(p_staff_name, 'Gate Staff'), NOW(), 'APPROVED'
  );

  -- 4. Atomically synchronize attendance flag and gate status
  UPDATE public.registrations_2027
  SET is_checked_in = (v_norm_type = 'ENTRY'),
      gate_status = v_norm_type
  WHERE id = v_student.id;

  RETURN jsonb_build_object(
    'success', true,
    'event_id', v_new_event_id,
    'event_type', v_norm_type,
    'gate_status', v_norm_type,
    'student_name', v_student.full_name,
    'batch_name', v_student.batch_name,
    'is_inside', (v_norm_type = 'ENTRY')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_confirm_gate_event(TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

-- 5. REINFORCE FOOD DISTRIBUTION WITH MANDATORY SERVER-SIDE GATE CHECK & CONCURRENCY LOCK
CREATE OR REPLACE FUNCTION public.rpc_confirm_food_distribution(
  p_registration_id TEXT,
  p_meal_type TEXT,
  p_staff_id TEXT,
  p_staff_name TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_student RECORD;
  v_last_gate RECORD;
  v_already_collected RECORD;
  v_record_id TEXT;
  v_is_inside BOOLEAN;
  v_gate_status TEXT;
BEGIN
  -- 1. Validate student payment status and gate entrance status with row locking
  SELECT id, full_name, batch_name, payment_status, is_checked_in, gate_status
  INTO v_student
  FROM public.registrations_2027
  WHERE id = p_registration_id OR student_id = p_registration_id
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND', 'message', 'Student registration not found.');
  END IF;

  IF v_student.payment_status <> 'paid' THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNPAID', 'message', 'Student registration is not paid.');
  END IF;

  -- Concurrency-safe: check latest gate event with lock to prevent race conditions during exit
  SELECT event_type, status INTO v_last_gate
  FROM public.gate_events
  WHERE registration_id = v_student.id
    AND status = 'APPROVED'
  ORDER BY timestamp DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    IF v_last_gate.event_type = 'ENTRY' THEN
      v_gate_status := 'ENTRY';
      v_is_inside := TRUE;
    ELSE
      v_gate_status := 'BACK';
      v_is_inside := FALSE;
    END IF;
  ELSE
    IF v_student.is_checked_in IS TRUE THEN
      v_gate_status := 'ENTRY';
      v_is_inside := TRUE;
    ELSE
      v_gate_status := COALESCE(v_student.gate_status, 'NOT_ENTERED');
      v_is_inside := FALSE;
    END IF;
  END IF;

  -- ACCESS CONTROL CHECK 1: If student is BACK (exited), immediately reject with RED error
  IF v_gate_status = 'BACK' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'BACK_TO_THE_GATE',
      'gate_status', 'BACK',
      'title', 'BACK TO THE GATE',
      'message', 'Student has exited the event. Food collection is not allowed. Please ask the student to enter through the gate first.'
    );
  END IF;

  -- ACCESS CONTROL CHECK 2: If student has not entered yet
  IF NOT v_is_inside OR v_gate_status = 'NOT_ENTERED' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'NOT_ENTERED',
      'gate_status', 'NOT_ENTERED',
      'title', 'GATE ENTRY REQUIRED',
      'message', 'Student has not entered the event. Please complete gate entry first.'
    );
  END IF;

  -- 2. Atomic check for existing meal collection (prevents duplicate meals)
  SELECT id, collected_at INTO v_already_collected
  FROM public.food_distributions
  WHERE registration_id = v_student.id
    AND meal_type = lower(trim(p_meal_type))
    AND status = 'COLLECTED'
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'ALREADY_COLLECTED',
      'message', format('Meal %s already collected at %s', upper(p_meal_type), v_already_collected.collected_at)
    );
  END IF;

  -- 3. Insert food distribution record
  v_record_id := 'FOOD-' || EXTRACT(EPOCH FROM NOW())::BIGINT || '-' || floor(random() * 1000)::INT;

  INSERT INTO public.food_distributions (
    id, registration_id, student_name, batch_name, meal_type,
    status, collected_at, staff_id, staff_name, notes
  ) VALUES (
    v_record_id, v_student.id, v_student.full_name, v_student.batch_name,
    lower(trim(p_meal_type)), 'COLLECTED', NOW(), p_staff_id, p_staff_name, p_notes
  );

  RETURN jsonb_build_object(
    'success', true,
    'record_id', v_record_id,
    'meal_type', p_meal_type,
    'student_name', v_student.full_name,
    'batch_name', v_student.batch_name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_confirm_food_distribution(TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

-- 6. REINFORCE DRESS DISTRIBUTION WITH MANDATORY SERVER-SIDE GATE CHECK & ONE-TIME RULE
CREATE OR REPLACE FUNCTION public.rpc_confirm_dress_distribution(
  p_registration_id TEXT,
  p_staff_id TEXT,
  p_staff_name TEXT,
  p_issued_size TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_student RECORD;
  v_last_gate RECORD;
  v_dist_id TEXT;
  v_is_inside BOOLEAN;
  v_gate_status TEXT;
BEGIN
  -- 1. Validate student payment status and gate entrance status with row locking
  SELECT id, full_name, batch_name, t_shirt_size, payment_status, is_checked_in, is_t_shirt_collected, gate_status
  INTO v_student
  FROM public.registrations_2027
  WHERE id = p_registration_id OR student_id = p_registration_id
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND', 'message', 'Student registration not found.');
  END IF;

  IF v_student.payment_status <> 'paid' THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNPAID', 'message', 'Registration is not paid.');
  END IF;

  -- Concurrency-safe: check latest gate event with lock
  SELECT event_type, status INTO v_last_gate
  FROM public.gate_events
  WHERE registration_id = v_student.id
    AND status = 'APPROVED'
  ORDER BY timestamp DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    IF v_last_gate.event_type = 'ENTRY' THEN
      v_gate_status := 'ENTRY';
      v_is_inside := TRUE;
    ELSE
      v_gate_status := 'BACK';
      v_is_inside := FALSE;
    END IF;
  ELSE
    IF v_student.is_checked_in IS TRUE THEN
      v_gate_status := 'ENTRY';
      v_is_inside := TRUE;
    ELSE
      v_gate_status := COALESCE(v_student.gate_status, 'NOT_ENTERED');
      v_is_inside := FALSE;
    END IF;
  END IF;

  -- ACCESS CONTROL CHECK 1: If student is BACK (exited), immediately reject with RED error
  IF v_gate_status = 'BACK' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'BACK_TO_THE_GATE',
      'gate_status', 'BACK',
      'title', 'BACK TO THE GATE',
      'message', 'Student has exited the event. T-shirt collection is currently blocked. Please ask the student to enter through the gate first.'
    );
  END IF;

  -- ACCESS CONTROL CHECK 2: If student has not entered yet
  IF NOT v_is_inside OR v_gate_status = 'NOT_ENTERED' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'NOT_ENTERED',
      'gate_status', 'NOT_ENTERED',
      'title', 'GATE ENTRY REQUIRED',
      'message', 'Student has not entered the event. Please complete gate entry first.'
    );
  END IF;

  -- 2. One-Time Rule: A student must receive only one T-shirt per registration, even after multiple gate re-entries
  IF v_student.is_t_shirt_collected IS TRUE THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALREADY_COLLECTED', 'message', 'T-Shirt / Dress has already been collected.');
  END IF;

  -- Atomically mark collected on registration
  UPDATE public.registrations_2027
  SET is_t_shirt_collected = true
  WHERE id = v_student.id;

  -- 3. Insert dress distribution log
  v_dist_id := 'DRESS-' || EXTRACT(EPOCH FROM NOW())::BIGINT || '-' || floor(random() * 1000)::INT;

  IF to_regclass('public.dress_distributions') IS NOT NULL THEN
    INSERT INTO public.dress_distributions (
      id, registration_id, student_name, item_type, registered_size,
      status, received_at, staff_id, staff_name, notes
    ) VALUES (
      v_dist_id, v_student.id, v_student.full_name, 'reunion_tshirt',
      COALESCE(p_issued_size, v_student.t_shirt_size, 'L'),
      'RECEIVED', NOW(), p_staff_id, p_staff_name, p_notes
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'registration_id', v_student.id,
    'student_name', v_student.full_name,
    'issued_size', COALESCE(p_issued_size, v_student.t_shirt_size)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_confirm_dress_distribution(TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
