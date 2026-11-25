-- ==============================================================================
-- DATABASE MIGRATION: 20270307000000_staff_card_management_and_entitlements.sql
-- POLICE LINES SCHOOL AND COLLEGE, FARIDPUR — GRAND REUNION 2027
-- Dedicated Staff Card Generation, Activation & Meal Entitlement Management System
-- ==============================================================================

-- 1. STAFF CARD BATCHES TABLE
CREATE TABLE IF NOT EXISTS public.staff_card_batches (
    id TEXT PRIMARY KEY,
    batch_name TEXT NOT NULL,
    batch_number INT NOT NULL,
    total_cards INT NOT NULL,
    category TEXT NOT NULL DEFAULT 'EVENT_STAFF',
    created_by TEXT NOT NULL DEFAULT 'SUPER_ADMIN',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. STAFF CARDS TABLE
CREATE TABLE IF NOT EXISTS public.staff_cards (
    id TEXT PRIMARY KEY,
    batch_id TEXT REFERENCES public.staff_card_batches(id) ON DELETE CASCADE,
    reg_number TEXT UNIQUE NOT NULL,
    token TEXT UNIQUE NOT NULL,
    qr_payload TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'EVENT_STAFF',
    status TEXT NOT NULL DEFAULT 'INACTIVE' CHECK (status IN ('INACTIVE', 'ACTIVE', 'REVOKED')),
    is_activated BOOLEAN NOT NULL DEFAULT FALSE,
    staff_name TEXT,
    designation TEXT,
    mobile_number TEXT,
    department TEXT,
    notes TEXT,
    meal_facilities TEXT[] NOT NULL DEFAULT '{}',
    activated_at TIMESTAMPTZ,
    activated_gate TEXT,
    activated_by_staff_id TEXT,
    activated_by_staff_name TEXT,
    revocation_reason TEXT,
    revoked_at TIMESTAMPTZ,
    revoked_by TEXT,
    generation_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. STAFF CARD ACTIVATIONS AUDIT TABLE
CREATE TABLE IF NOT EXISTS public.staff_card_activations (
    id TEXT PRIMARY KEY,
    card_id TEXT NOT NULL REFERENCES public.staff_cards(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    staff_name TEXT,
    designation TEXT,
    meal_facilities TEXT[] NOT NULL DEFAULT '{}',
    operator_id TEXT NOT NULL,
    operator_name TEXT NOT NULL,
    activation_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'ACTIVE'
);

-- 4. STAFF FOOD COLLECTIONS TABLE (ATOMIC PER-MEAL UNIQUENESS)
CREATE TABLE IF NOT EXISTS public.staff_food_collections (
    id TEXT PRIMARY KEY,
    card_id TEXT NOT NULL REFERENCES public.staff_cards(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner')),
    status TEXT NOT NULL DEFAULT 'COLLECTED',
    collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    staff_id TEXT NOT NULL,
    staff_name TEXT NOT NULL,
    counter_id TEXT,
    staff_member_name TEXT,
    CONSTRAINT uq_staff_card_meal UNIQUE (card_id, meal_type)
);

-- Indexes for ultra-low-latency queries
CREATE INDEX IF NOT EXISTS idx_staff_cards_batch_id ON public.staff_cards(batch_id);
CREATE INDEX IF NOT EXISTS idx_staff_cards_token ON public.staff_cards(token);
CREATE INDEX IF NOT EXISTS idx_staff_cards_status ON public.staff_cards(status);
CREATE INDEX IF NOT EXISTS idx_staff_food_card_meal ON public.staff_food_collections(card_id, meal_type);
CREATE INDEX IF NOT EXISTS idx_staff_activations_card_id ON public.staff_card_activations(card_id);

-- Enable Row Level Security
ALTER TABLE public.staff_card_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_card_activations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_food_collections ENABLE ROW LEVEL SECURITY;

-- Permissive policies for client operations
DROP POLICY IF EXISTS "Allow select staff_card_batches" ON public.staff_card_batches;
CREATE POLICY "Allow select staff_card_batches" ON public.staff_card_batches FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Allow all staff_card_batches" ON public.staff_card_batches;
CREATE POLICY "Allow all staff_card_batches" ON public.staff_card_batches FOR ALL TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow select staff_cards" ON public.staff_cards;
CREATE POLICY "Allow select staff_cards" ON public.staff_cards FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Allow all staff_cards" ON public.staff_cards;
CREATE POLICY "Allow all staff_cards" ON public.staff_cards FOR ALL TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow select staff_card_activations" ON public.staff_card_activations;
CREATE POLICY "Allow select staff_card_activations" ON public.staff_card_activations FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Allow all staff_card_activations" ON public.staff_card_activations;
CREATE POLICY "Allow all staff_card_activations" ON public.staff_card_activations FOR ALL TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow select staff_food_collections" ON public.staff_food_collections;
CREATE POLICY "Allow select staff_food_collections" ON public.staff_food_collections FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Allow all staff_food_collections" ON public.staff_food_collections;
CREATE POLICY "Allow all staff_food_collections" ON public.staff_food_collections FOR ALL TO anon, authenticated USING (true);

-- Realtime Publication for live desk sync
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_card_batches;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_cards;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_food_collections;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- RPC 1: BULK STAFF CARD GENERATION
CREATE OR REPLACE FUNCTION public.rpc_generate_staff_card_batch(
    p_count INT,
    p_category TEXT DEFAULT 'EVENT_STAFF',
    p_created_by TEXT DEFAULT 'SUPER_ADMIN',
    p_batch_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_batch_num INT;
    v_batch_id TEXT;
    v_batch_title TEXT;
    v_current_max_id INT;
    v_next_id_num INT;
    v_card_id TEXT;
    v_reg_num TEXT;
    v_token TEXT;
    v_qr_payload TEXT;
    v_chars TEXT := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    v_token_body TEXT;
    v_i INT;
    v_j INT;
    v_rand_idx INT;
    v_inserted_count INT := 0;
BEGIN
    IF p_count < 1 OR p_count > 500 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid count. Must be between 1 and 500.');
    END IF;

    -- Calculate next batch sequence
    SELECT COALESCE(MAX(batch_number), 0) + 1 INTO v_batch_num FROM public.staff_card_batches;
    v_batch_id := 'STF-BATCH-2027-' || LPAD(v_batch_num::TEXT, 3, '0');
    v_batch_title := COALESCE(NULLIF(TRIM(p_batch_name), ''), 'Staff Batch ' || v_batch_num || ' (' || p_category || ')');

    INSERT INTO public.staff_card_batches (id, batch_name, batch_number, total_cards, category, created_by, created_at)
    VALUES (v_batch_id, v_batch_title, v_batch_num, p_count, p_category, p_created_by, NOW());

    -- Find current max sequential STF ID
    SELECT COALESCE(MAX(SUBSTRING(id FROM 'STF-([0-9]+)')::INT), 0) INTO v_current_max_id FROM public.staff_cards;
    v_next_id_num := v_current_max_id + 1;

    FOR v_i IN 1..p_count LOOP
        v_card_id := 'STF-' || LPAD(v_next_id_num::TEXT, 4, '0');
        v_reg_num := 'PLSCF-STF-2027-' || LPAD(v_next_id_num::TEXT, 4, '0');

        -- Generate 6-char cryptographically strong token
        v_token_body := '';
        FOR v_j IN 1..6 LOOP
            v_rand_idx := floor(random() * length(v_chars) + 1)::INT;
            v_token_body := v_token_body || substr(v_chars, v_rand_idx, 1);
        END LOOP;
        v_token := 'STF-' || v_token_body;

        -- Embed zero-PII JSON payload
        v_qr_payload := jsonb_build_object(
            'type', 'STAFF',
            'id', v_card_id,
            'regNumber', v_reg_num,
            'token', v_token,
            'category', p_category,
            'event', 'PLSCF_REUNION_2027'
        )::TEXT;

        INSERT INTO public.staff_cards (
            id, batch_id, reg_number, token, qr_payload, category, status, is_activated,
            staff_name, designation, mobile_number, department, notes, meal_facilities,
            generation_date, created_at, updated_at
        ) VALUES (
            v_card_id, v_batch_id, v_reg_num, v_token, v_qr_payload, p_category, 'INACTIVE', FALSE,
            NULL, NULL, NULL, NULL, NULL, '{}',
            NOW(), NOW(), NOW()
        );

        v_next_id_num := v_next_id_num + 1;
        v_inserted_count := v_inserted_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'batchId', v_batch_id,
        'batchName', v_batch_title,
        'cardsGenerated', v_inserted_count
    );
END;
$$;

-- RPC 2: STAFF CARD ACTIVATION & ENTITLEMENT CONFIGURATION
CREATE OR REPLACE FUNCTION public.rpc_activate_staff_card(
    p_identifier TEXT,
    p_token TEXT DEFAULT NULL,
    p_staff_name TEXT DEFAULT NULL,
    p_designation TEXT DEFAULT NULL,
    p_mobile_number TEXT DEFAULT NULL,
    p_department TEXT DEFAULT NULL,
    p_meal_facilities TEXT[] DEFAULT '{}',
    p_notes TEXT DEFAULT NULL,
    p_activated_by TEXT DEFAULT 'SUPER_ADMIN',
    p_gate_id TEXT DEFAULT 'Main Gate / Admin Desk'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_card RECORD;
    v_act_id TEXT;
BEGIN
    -- Locate staff card by ID, reg_number, or token
    SELECT * INTO v_card FROM public.staff_cards
    WHERE id = p_identifier OR reg_number = p_identifier OR token = p_identifier
       OR (p_token IS NOT NULL AND token = p_token)
    LIMIT 1;

    IF v_card IS NULL THEN
        RETURN jsonb_build_object('success', false, 'errorType', 'CARD_NOT_FOUND', 'error', 'Staff card not found.');
    END IF;

    IF v_card.status = 'REVOKED' THEN
        RETURN jsonb_build_object('success', false, 'errorType', 'CARD_REVOKED', 'error', 'Staff card is REVOKED and cannot be activated.');
    END IF;

    -- Update card to ACTIVE and persist assigned staff info & meal entitlements
    UPDATE public.staff_cards
    SET status = 'ACTIVE',
        is_activated = TRUE,
        staff_name = COALESCE(NULLIF(TRIM(p_staff_name), ''), v_card.staff_name, 'Staff Member'),
        designation = COALESCE(NULLIF(TRIM(p_designation), ''), v_card.designation, 'Event Volunteer'),
        mobile_number = COALESCE(NULLIF(TRIM(p_mobile_number), ''), v_card.mobile_number),
        department = COALESCE(NULLIF(TRIM(p_department), ''), v_card.department, 'Operations'),
        meal_facilities = COALESCE(p_meal_facilities, v_card.meal_facilities, '{}'),
        notes = COALESCE(p_notes, v_card.notes),
        activated_at = COALESCE(v_card.activated_at, NOW()),
        activated_gate = p_gate_id,
        activated_by_staff_name = p_activated_by,
        updated_at = NOW()
    WHERE id = v_card.id;

    -- Record activation in audit log
    v_act_id := 'ACT-STF-' || v_card.id || '-' || EXTRACT(EPOCH FROM NOW())::BIGINT;
    INSERT INTO public.staff_card_activations (
        id, card_id, token, staff_name, designation, meal_facilities,
        operator_id, operator_name, activation_time, status
    ) VALUES (
        v_act_id, v_card.id, v_card.token,
        COALESCE(p_staff_name, v_card.staff_name),
        COALESCE(p_designation, v_card.designation),
        p_meal_facilities,
        p_activated_by, p_activated_by, NOW(), 'ACTIVE'
    ) ON CONFLICT (id) DO NOTHING;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Staff card activated and entitlements configured successfully.',
        'cardId', v_card.id,
        'staffName', COALESCE(p_staff_name, v_card.staff_name),
        'mealFacilities', p_meal_facilities
    );
END;
$$;

-- RPC 3: ATOMIC STAFF FOOD COLLECTION WITH SCHEDULE & ENTITLEMENT VALIDATION
CREATE OR REPLACE FUNCTION public.rpc_collect_staff_food(
    p_identifier TEXT,
    p_meal_type TEXT,
    p_token TEXT DEFAULT NULL,
    p_staff_id TEXT DEFAULT 'FOOD_DESK_01',
    p_staff_name TEXT DEFAULT 'Food Desk Operator',
    p_counter_id TEXT DEFAULT 'Staff Counter'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_card RECORD;
    v_col_id TEXT;
    v_is_active_time BOOLEAN;
    v_meal_lower TEXT := LOWER(TRIM(p_meal_type));
BEGIN
    -- 1. Find Staff Card
    SELECT * INTO v_card FROM public.staff_cards
    WHERE id = p_identifier OR reg_number = p_identifier OR token = p_identifier
       OR (p_token IS NOT NULL AND token = p_token)
    LIMIT 1;

    IF v_card IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'errorType', 'CARD_NOT_FOUND',
            'error', 'Staff card not found.',
            'message', 'No matching staff card record found.'
        );
    END IF;

    -- 2. Card Status Validation (Must be ACTIVE)
    IF v_card.status = 'INACTIVE' OR NOT v_card.is_activated THEN
        RETURN jsonb_build_object(
            'success', false,
            'errorType', 'CARD_NOT_ACTIVATED',
            'error', 'Card Not Activated',
            'message', 'Staff card ' || v_card.id || ' is inactive. The Super Admin must activate this card before meals can be collected.'
        );
    END IF;

    IF v_card.status = 'REVOKED' THEN
        RETURN jsonb_build_object(
            'success', false,
            'errorType', 'CARD_REVOKED',
            'error', 'Card Revoked',
            'message', 'Staff card ' || v_card.id || ' has been revoked. Access denied.'
        );
    END IF;

    -- 3. Entitlement Validation (Check if meal_facilities array contains this meal)
    IF NOT (v_meal_lower = ANY(v_card.meal_facilities)) THEN
        RETURN jsonb_build_object(
            'success', false,
            'errorType', 'MEAL_NOT_ASSIGNED',
            'error', 'Meal Not Assigned',
            'message', 'Staff card ' || v_card.id || ' is not authorized for ' || INITCAP(v_meal_lower) || '.'
        );
    END IF;

    -- 4. Global Meal Time Schedule Validation (Asia/Dhaka)
    SELECT check_meal_scanner_active(v_meal_lower) INTO v_is_active_time;
    IF NOT COALESCE(v_is_active_time, true) THEN
        RETURN jsonb_build_object(
            'success', false,
            'errorType', 'TIMEOUT',
            'error', 'Time Out',
            'message', 'Meal scanning is inactive or the scheduled time has expired for ' || INITCAP(v_meal_lower) || '.'
        );
    END IF;

    -- 5. Duplicate Collection Check
    IF EXISTS (
        SELECT 1 FROM public.staff_food_collections
        WHERE card_id = v_card.id AND meal_type = v_meal_lower
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'errorType', 'ALREADY_COLLECTED',
            'error', 'Already Collected',
            'message', INITCAP(v_meal_lower) || ' has already been claimed for staff card ' || v_card.id || '.'
        );
    END IF;

    -- 6. Insert Collection Record
    v_col_id := 'COL-STF-' || v_card.id || '-' || v_meal_lower;
    INSERT INTO public.staff_food_collections (
        id, card_id, token, meal_type, status, collected_at,
        staff_id, staff_name, counter_id, staff_member_name
    ) VALUES (
        v_col_id, v_card.id, v_card.token, v_meal_lower, 'COLLECTED', NOW(),
        p_staff_id, p_staff_name, p_counter_id, v_card.staff_name
    );

    RETURN jsonb_build_object(
        'success', true,
        'message', INITCAP(v_meal_lower) || ' collection confirmed successfully for ' || COALESCE(v_card.staff_name, v_card.id) || '.',
        'record', jsonb_build_object(
            'id', v_col_id,
            'cardId', v_card.id,
            'mealType', v_meal_lower,
            'staffMemberName', v_card.staff_name,
            'collectedAt', NOW()
        )
    );
END;
$$;
