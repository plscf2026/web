-- Migration: 20270306000000_meal_scanner_control_and_time_validation.sql
-- Description: Meal Time & Scanner Control System for Breakfast, Lunch, and Dinner
-- Enforces Bangladesh Standard Time (Asia/Dhaka) validation on the backend and provides Realtime sync.

-- 1. CREATE MEAL SCANNER CONTROLS TABLE
CREATE TABLE IF NOT EXISTS public.meal_scanner_controls (
  id TEXT PRIMARY KEY, -- 'breakfast', 'lunch', 'dinner'
  meal_type TEXT NOT NULL UNIQUE,
  start_time TEXT NOT NULL, -- 24h format e.g. '07:00'
  end_time TEXT NOT NULL,   -- 24h format e.g. '10:30'
  mode TEXT NOT NULL DEFAULT 'SCHEDULED', -- 'SCHEDULED', 'MANUAL_ON', 'MANUAL_OFF'
  enabled BOOLEAN NOT NULL DEFAULT true,
  updated_by TEXT DEFAULT 'Super Admin',
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. SEED DEFAULT SCHEDULES IF NOT ALREADY POPULATED
INSERT INTO public.meal_scanner_controls (id, meal_type, start_time, end_time, mode, enabled, updated_by, updated_at)
VALUES
  ('breakfast', 'breakfast', '07:00', '10:30', 'SCHEDULED', true, 'System Default', now()),
  ('lunch', 'lunch', '12:00', '15:30', 'SCHEDULED', true, 'System Default', now()),
  ('dinner', 'dinner', '19:00', '22:00', 'SCHEDULED', true, 'System Default', now())
ON CONFLICT (id) DO UPDATE SET
  updated_at = now();

-- 3. ENABLE ROW LEVEL SECURITY AND PERMISSIVE POLICIES
ALTER TABLE public.meal_scanner_controls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "meal_scanner_controls_select_all" ON public.meal_scanner_controls;
CREATE POLICY "meal_scanner_controls_select_all" ON public.meal_scanner_controls
  FOR SELECT TO anon, authenticated, service_role
  USING (true);

DROP POLICY IF EXISTS "meal_scanner_controls_write_all" ON public.meal_scanner_controls;
CREATE POLICY "meal_scanner_controls_write_all" ON public.meal_scanner_controls
  FOR ALL TO anon, authenticated, service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE public.meal_scanner_controls REPLICA IDENTITY FULL;

-- 4. ADD TO SUPABASE REALTIME PUBLICATION
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.meal_scanner_controls;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
END;
$$;

-- 5. PURE SECURITY DEFINER TIME VALIDATOR (BANGLADESH STANDARD TIME: Asia/Dhaka)
CREATE OR REPLACE FUNCTION public.check_meal_scanner_active(p_meal_type TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_meal TEXT := lower(trim(COALESCE(p_meal_type, '')));
  v_ctrl RECORD;
  v_now_dhaka TIME;
  v_start TIME;
  v_end TIME;
  v_meal_display TEXT;
BEGIN
  IF v_meal NOT IN ('breakfast', 'lunch', 'dinner') THEN
    RETURN jsonb_build_object(
      'is_open', false,
      'status', 'INVALID_MEAL',
      'error', 'Invalid meal type specified: ' || v_meal
    );
  END IF;

  v_meal_display := initcap(v_meal);

  SELECT * INTO v_ctrl
  FROM public.meal_scanner_controls
  WHERE meal_type = v_meal
  LIMIT 1;

  -- Resilient fallback if table row is missing
  IF v_ctrl.id IS NULL THEN
    RETURN jsonb_build_object(
      'is_open', true,
      'status', 'ACTIVE',
      'mode', 'SCHEDULED'
    );
  END IF;

  -- 1. MANUAL OFF or Master Disabled
  IF v_ctrl.mode = 'MANUAL_OFF' OR v_ctrl.enabled IS NOT TRUE THEN
    RETURN jsonb_build_object(
      'is_open', false,
      'status', 'TIMEOUT',
      'error', 'Time Out: ' || v_meal_display || ' scanner is currently disabled by Super Admin.',
      'mode', 'MANUAL_OFF'
    );
  END IF;

  -- 2. MANUAL ON (Admin Force Active)
  IF v_ctrl.mode = 'MANUAL_ON' THEN
    RETURN jsonb_build_object(
      'is_open', true,
      'status', 'ACTIVE',
      'mode', 'MANUAL_ON'
    );
  END IF;

  -- 3. SCHEDULED Mode: Evaluate current time in Asia/Dhaka
  BEGIN
    v_now_dhaka := (timezone('Asia/Dhaka', now()))::time;
    v_start := v_ctrl.start_time::time;
    v_end := v_ctrl.end_time::time;
  EXCEPTION WHEN OTHERS THEN
    -- Fallback if time string format error
    RETURN jsonb_build_object('is_open', true, 'status', 'ACTIVE', 'mode', 'SCHEDULED');
  END;

  IF v_now_dhaka >= v_start AND v_now_dhaka <= v_end THEN
    RETURN jsonb_build_object(
      'is_open', true,
      'status', 'ACTIVE',
      'mode', 'SCHEDULED',
      'start_time', v_ctrl.start_time,
      'end_time', v_ctrl.end_time
    );
  ELSIF v_now_dhaka < v_start THEN
    RETURN jsonb_build_object(
      'is_open', false,
      'status', 'TIMEOUT',
      'error', 'Time Out: ' || v_meal_display || ' distribution starts at ' || to_char(v_start, 'HH12:MI AM') || ' (Bangladesh Time).',
      'mode', 'SCHEDULED',
      'start_time', v_ctrl.start_time,
      'end_time', v_ctrl.end_time
    );
  ELSE
    RETURN jsonb_build_object(
      'is_open', false,
      'status', 'TIMEOUT',
      'error', 'Time Out: ' || v_meal_display || ' distribution closed at ' || to_char(v_end, 'HH12:MI AM') || ' (Bangladesh Time).',
      'mode', 'SCHEDULED',
      'start_time', v_ctrl.start_time,
      'end_time', v_ctrl.end_time
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_meal_scanner_active(TEXT) TO anon, authenticated, service_role;

-- 6. RPC: rpc_update_meal_schedule
CREATE OR REPLACE FUNCTION public.rpc_update_meal_schedule(
  p_meal_type TEXT,
  p_start_time TEXT,
  p_end_time TEXT,
  p_mode TEXT,
  p_enabled BOOLEAN,
  p_updated_by TEXT DEFAULT 'Super Admin'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_meal TEXT := lower(trim(COALESCE(p_meal_type, '')));
  v_mode TEXT := upper(trim(COALESCE(p_mode, 'SCHEDULED')));
  v_res RECORD;
BEGIN
  IF v_meal NOT IN ('breakfast', 'lunch', 'dinner') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid meal type: ' || p_meal_type);
  END IF;

  IF v_mode NOT IN ('SCHEDULED', 'MANUAL_ON', 'MANUAL_OFF') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid scanner mode: ' || p_mode);
  END IF;

  INSERT INTO public.meal_scanner_controls (
    id, meal_type, start_time, end_time, mode, enabled, updated_by, updated_at
  ) VALUES (
    v_meal, v_meal, p_start_time, p_end_time, v_mode, COALESCE(p_enabled, true), COALESCE(p_updated_by, 'Super Admin'), now()
  )
  ON CONFLICT (id) DO UPDATE SET
    start_time = EXCLUDED.start_time,
    end_time = EXCLUDED.end_time,
    mode = EXCLUDED.mode,
    enabled = EXCLUDED.enabled,
    updated_by = EXCLUDED.updated_by,
    updated_at = now()
  RETURNING * INTO v_res;

  RETURN jsonb_build_object(
    'success', true,
    'schedule', row_to_json(v_res)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_update_meal_schedule(TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT) TO anon, authenticated, service_role;

-- 7. RE-ENFORCE TIME OUT CHECK IN GUEST FOOD COLLECTION RPC
CREATE OR REPLACE FUNCTION public.rpc_collect_guest_food(
    p_identifier TEXT,
    p_meal_type TEXT,
    p_token TEXT DEFAULT NULL,
    p_staff_id TEXT DEFAULT 'FOOD_STAFF',
    p_staff_name TEXT DEFAULT 'Food Staff',
    p_counter_id TEXT DEFAULT 'Food Counter 01'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_clean_id TEXT := trim(COALESCE(p_identifier, ''));
    v_clean_tok TEXT := trim(COALESCE(p_token, ''));
    v_clean_meal TEXT := lower(trim(COALESCE(p_meal_type, '')));
    v_card RECORD;
    v_existing RECORD;
    v_col_id TEXT;
    v_time_check JSONB;
BEGIN
    IF v_clean_meal NOT IN ('breakfast', 'lunch', 'dinner') THEN
        RETURN jsonb_build_object('success', false, 'errorType', 'INVALID_MEAL', 'error', 'Invalid meal type. Must be breakfast, lunch, or dinner.');
    END IF;

    -- Backend Time Validation (Requirement 5)
    v_time_check := public.check_meal_scanner_active(v_clean_meal);
    IF (v_time_check->>'is_open')::boolean IS NOT TRUE THEN
        RETURN jsonb_build_object(
            'success', false,
            'errorType', 'TIMEOUT',
            'error', 'Time Out',
            'message', COALESCE(v_time_check->>'error', 'Time Out: Meal distribution is currently closed.')
        );
    END IF;

    -- If p_identifier is a JSON QR string, safely extract id, regNumber, and token
    IF v_clean_id LIKE '{%}' THEN
        BEGIN
            IF (v_clean_id::jsonb)->>'id' IS NOT NULL THEN
                v_clean_id := trim((v_clean_id::jsonb)->>'id');
            ELSIF (v_clean_id::jsonb)->>'regNumber' IS NOT NULL THEN
                v_clean_id := trim((v_clean_id::jsonb)->>'regNumber');
            END IF;
            IF v_clean_tok = '' AND (p_identifier::jsonb)->>'token' IS NOT NULL THEN
                v_clean_tok := trim((p_identifier::jsonb)->>'token');
            END IF;
        EXCEPTION WHEN OTHERS THEN
        END;
    END IF;

    -- Lookup card
    SELECT * INTO v_card
    FROM public.guest_cards
    WHERE upper(id) = upper(v_clean_id)
       OR upper(reg_number) = upper(v_clean_id)
       OR upper(token) = upper(v_clean_id)
       OR (v_clean_tok <> '' AND upper(token) = upper(v_clean_tok))
    LIMIT 1;

    IF v_card.id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'errorType', 'NOT_FOUND',
            'error', 'Guest Pass "' || v_clean_id || '" not found in database.'
        );
    END IF;

    -- Gate Activation Check
    IF v_card.status = 'INACTIVE' OR v_card.is_activated IS NOT TRUE THEN
        RETURN jsonb_build_object(
            'success', false,
            'errorType', 'INACTIVE_CARD',
            'error', 'Guest card has NOT been activated at the Main Gate. Food collection is only permitted after Gate entry.',
            'card', jsonb_build_object('id', v_card.id, 'status', 'INACTIVE')
        );
    END IF;

    IF v_card.status = 'REVOKED' THEN
        RETURN jsonb_build_object('success', false, 'errorType', 'REVOKED', 'error', 'This guest pass is revoked.');
    END IF;

    -- Check if already collected
    SELECT * INTO v_existing
    FROM public.guest_food_collections
    WHERE guest_id = v_card.id AND meal_type = v_clean_meal
    LIMIT 1;

    IF v_existing.id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'errorType', 'ALREADY_COLLECTED',
            'error', 'ALREADY COLLECTED',
            'message', 'ALREADY COLLECTED',
            'collectedAt', v_existing.collected_at,
            'staffName', v_existing.staff_name
        );
    END IF;

    -- Insert atomic collection record
    v_col_id := 'MEAL-' || v_card.id || '-' || v_clean_meal || '-' || to_char(NOW(), 'YYYYMMDDHH24MISS');
    
    INSERT INTO public.guest_food_collections (
        id,
        guest_id,
        token,
        meal_type,
        status,
        collected_at,
        staff_id,
        staff_name,
        counter_id
    ) VALUES (
        v_col_id,
        v_card.id,
        v_card.token,
        v_clean_meal,
        'COLLECTED',
        NOW(),
        p_staff_id,
        p_staff_name,
        p_counter_id
    );

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Guest meal recorded successfully',
        'record', jsonb_build_object(
            'id', v_col_id,
            'guestId', v_card.id,
            'mealType', v_clean_meal,
            'collectedAt', NOW(),
            'status', 'COLLECTED'
        )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_collect_guest_food(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
