-- ==============================================================================
-- DATABASE MIGRATION: 20270304000000_dynamic_guest_pass_and_food_system.sql
-- POLICE LINES SCHOOL AND COLLEGE, FARIDPUR — GRAND REUNION 2027
-- Dynamic Guest Pass & Food Management System (Schema, Constraints & Atomic RPCs)
-- ==============================================================================

-- 1. GUEST CARD BATCHES TABLE
CREATE TABLE IF NOT EXISTS public.guest_card_batches (
    id TEXT PRIMARY KEY,
    batch_name TEXT NOT NULL,
    batch_number INT NOT NULL,
    total_cards INT NOT NULL,
    category TEXT NOT NULL DEFAULT 'HONORARY_GUEST',
    created_by TEXT NOT NULL DEFAULT 'SUPER_ADMIN',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. GUEST CARDS TABLE
CREATE TABLE IF NOT EXISTS public.guest_cards (
    id TEXT PRIMARY KEY,
    batch_id TEXT REFERENCES public.guest_card_batches(id) ON DELETE CASCADE,
    reg_number TEXT UNIQUE NOT NULL,
    token TEXT UNIQUE NOT NULL,
    qr_payload TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'HONORARY_GUEST',
    status TEXT NOT NULL DEFAULT 'INACTIVE' CHECK (status IN ('INACTIVE', 'ACTIVE', 'REVOKED')),
    is_activated BOOLEAN NOT NULL DEFAULT FALSE,
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

-- 3. GUEST GATE ACTIVATIONS LOG TABLE
CREATE TABLE IF NOT EXISTS public.guest_gate_activations (
    id TEXT PRIMARY KEY,
    guest_id TEXT NOT NULL REFERENCES public.guest_cards(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    gate_id TEXT NOT NULL,
    scanner_id TEXT,
    operator_id TEXT NOT NULL,
    operator_name TEXT NOT NULL,
    activation_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'ACTIVE'
);

-- 4. GUEST FOOD COLLECTIONS TABLE (ATOMIC PER-MEAL UNIQUENESS)
CREATE TABLE IF NOT EXISTS public.guest_food_collections (
    id TEXT PRIMARY KEY,
    guest_id TEXT NOT NULL REFERENCES public.guest_cards(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner')),
    status TEXT NOT NULL DEFAULT 'COLLECTED',
    collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    staff_id TEXT NOT NULL,
    staff_name TEXT NOT NULL,
    counter_id TEXT,
    CONSTRAINT uq_guest_meal UNIQUE (guest_id, meal_type)
);

-- Indexes for lightning fast lookups
CREATE INDEX IF NOT EXISTS idx_guest_cards_batch_id ON public.guest_cards(batch_id);
CREATE INDEX IF NOT EXISTS idx_guest_cards_token ON public.guest_cards(token);
CREATE INDEX IF NOT EXISTS idx_guest_cards_status ON public.guest_cards(status);
CREATE INDEX IF NOT EXISTS idx_guest_food_guest_meal ON public.guest_food_collections(guest_id, meal_type);
CREATE INDEX IF NOT EXISTS idx_guest_gate_guest_id ON public.guest_gate_activations(guest_id);

-- Enable Row Level Security
ALTER TABLE public.guest_card_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_gate_activations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_food_collections ENABLE ROW LEVEL SECURITY;

-- Permissive Read/Write policies for operational continuity
DROP POLICY IF EXISTS "Allow select guest_card_batches" ON public.guest_card_batches;
CREATE POLICY "Allow select guest_card_batches" ON public.guest_card_batches FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow all guest_card_batches" ON public.guest_card_batches;
CREATE POLICY "Allow all guest_card_batches" ON public.guest_card_batches FOR ALL TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow select guest_cards" ON public.guest_cards;
CREATE POLICY "Allow select guest_cards" ON public.guest_cards FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow all guest_cards" ON public.guest_cards;
CREATE POLICY "Allow all guest_cards" ON public.guest_cards FOR ALL TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow select guest_gate_activations" ON public.guest_gate_activations;
CREATE POLICY "Allow select guest_gate_activations" ON public.guest_gate_activations FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow all guest_gate_activations" ON public.guest_gate_activations;
CREATE POLICY "Allow all guest_gate_activations" ON public.guest_gate_activations FOR ALL TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow select guest_food_collections" ON public.guest_food_collections;
CREATE POLICY "Allow select guest_food_collections" ON public.guest_food_collections FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow all guest_food_collections" ON public.guest_food_collections;
CREATE POLICY "Allow all guest_food_collections" ON public.guest_food_collections FOR ALL TO anon, authenticated USING (true);

-- ============================================================================
-- 5. RPC: ATOMIC GUEST CARD BATCH GENERATION
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rpc_generate_guest_card_batch(
    p_quantity INT,
    p_category TEXT DEFAULT 'HONORARY_GUEST',
    p_admin_id TEXT DEFAULT 'SUPER_ADMIN',
    p_admin_name TEXT DEFAULT 'Super Administrator'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_qty INT := COALESCE(p_quantity, 10);
    v_cat TEXT := COALESCE(NULLIF(trim(p_category), ''), 'HONORARY_GUEST');
    v_batch_num INT;
    v_batch_id TEXT;
    v_batch_name TEXT;
    v_max_seq INT := 0;
    v_start_seq INT;
    v_end_seq INT;
    v_guest_id TEXT;
    v_reg_no TEXT;
    v_token TEXT;
    v_payload TEXT;
    v_alpha TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    v_rand_part TEXT;
    v_created_cards JSONB := '[]'::jsonb;
    v_card JSONB;
    i INT;
    j INT;
BEGIN
    IF v_qty <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Quantity must be at least 1');
    END IF;

    -- Calculate next batch number
    SELECT COALESCE(MAX(batch_number), 0) + 1 INTO v_batch_num FROM public.guest_card_batches;
    v_batch_id := 'BATCH-2027-' || LPAD(v_batch_num::TEXT, 3, '0');
    v_batch_name := 'Batch #' || v_batch_num || ' (' || v_qty || ' ' || v_cat || ' Passes)';

    -- Calculate maximum existing sequential guest ID number
    SELECT COALESCE(MAX(NULLIF(regexp_replace(id, '^GUEST-0*', '', 'g'), '')::INT), 0)
    INTO v_max_seq
    FROM public.guest_cards
    WHERE id ~ '^GUEST-[0-9]+$';

    v_start_seq := v_max_seq + 1;
    v_end_seq := v_max_seq + v_qty;

    -- Create batch record
    INSERT INTO public.guest_card_batches (
        id,
        batch_name,
        batch_number,
        total_cards,
        category,
        created_by,
        created_at
    ) VALUES (
        v_batch_id,
        v_batch_name,
        v_batch_num,
        v_qty,
        v_cat,
        p_admin_name || ' (' || p_admin_id || ')',
        NOW()
    );

    -- Generate each guest card atomically
    FOR i IN v_start_seq..v_end_seq LOOP
        v_guest_id := 'GUEST-' || LPAD(i::TEXT, 4, '0');
        v_reg_no := 'PLSCF-GST-2027-' || LPAD(i::TEXT, 4, '0');
        
        -- Generate 6-char random unguessable token
        v_rand_part := '';
        FOR j IN 1..6 LOOP
            v_rand_part := v_rand_part || substr(v_alpha, floor(random() * length(v_alpha) + 1)::INT, 1);
        END LOOP;
        v_token := 'GST-' || v_rand_part || '-' || upper(substr(md5(random()::text), 1, 3));

        v_payload := jsonb_build_object(
            'type', 'GUEST',
            'id', v_guest_id,
            'regNumber', v_reg_no,
            'token', v_token,
            'category', v_cat
        )::TEXT;

        INSERT INTO public.guest_cards (
            id,
            batch_id,
            reg_number,
            token,
            qr_payload,
            category,
            status,
            is_activated,
            generation_date,
            created_at,
            updated_at
        ) VALUES (
            v_guest_id,
            v_batch_id,
            v_reg_no,
            v_token,
            v_payload,
            v_cat,
            'INACTIVE',
            FALSE,
            NOW(),
            NOW(),
            NOW()
        );

        v_card := jsonb_build_object(
            'id', v_guest_id,
            'batchId', v_batch_id,
            'regNumber', v_reg_no,
            'token', v_token,
            'qrPayload', v_payload,
            'category', v_cat,
            'status', 'INACTIVE',
            'isActivated', false,
            'generationDate', NOW()
        );
        v_created_cards := v_created_cards || jsonb_build_array(v_card);
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'batchId', v_batch_id,
        'batchName', v_batch_name,
        'batchNumber', v_batch_num,
        'totalCards', v_qty,
        'startId', 'GUEST-' || LPAD(v_start_seq::TEXT, 4, '0'),
        'endId', 'GUEST-' || LPAD(v_end_seq::TEXT, 4, '0'),
        'cards', v_created_cards
    );
END;
$$;

-- ============================================================================
-- 6. RPC: ATOMIC GUEST CARD ACTIVATION AT MAIN GATE
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rpc_activate_guest_card(
    p_identifier TEXT,
    p_token TEXT DEFAULT NULL,
    p_gate_id TEXT DEFAULT 'Main Gate',
    p_scanner_id TEXT DEFAULT NULL,
    p_operator_id TEXT DEFAULT 'GATE_STAFF',
    p_operator_name TEXT DEFAULT 'Gate Staff'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_clean_id TEXT := trim(COALESCE(p_identifier, ''));
    v_clean_tok TEXT := trim(COALESCE(p_token, ''));
    v_card RECORD;
    v_act_id TEXT;
BEGIN
    IF v_clean_id = '' AND v_clean_tok = '' THEN
        RETURN jsonb_build_object('success', false, 'errorType', 'INVALID_INPUT', 'error', 'No guest QR token or ID provided.');
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
            -- Ignore malformed JSON and proceed with literal matching
        END;
    END IF;

    -- Lookup card by ID, Registration Number, or Token
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
            'error', 'Guest Pass "' || v_clean_id || '" not found in database. Please verify the QR code.'
        );
    END IF;

    -- Check if revoked
    IF v_card.status = 'REVOKED' THEN
        RETURN jsonb_build_object(
            'success', false,
            'errorType', 'REVOKED',
            'error', 'Security Alert: This guest pass has been revoked by Super Admin.',
            'revocationReason', v_card.revocation_reason
        );
    END IF;

    -- Check if already active
    IF v_card.status = 'ACTIVE' OR v_card.is_activated IS TRUE THEN
        RETURN jsonb_build_object(
            'success', true,
            'alreadyActive', true,
            'message', 'GUEST CARD IS ALREADY ACTIVE',
            'card', jsonb_build_object(
                'id', v_card.id,
                'regNumber', v_card.reg_number,
                'token', v_card.token,
                'category', v_card.category,
                'status', 'ACTIVE',
                'isActivated', true,
                'activatedAt', v_card.activated_at,
                'activatedGate', v_card.activated_gate,
                'activatedByStaffName', v_card.activated_by_staff_name
            )
        );
    END IF;

    -- Activate immediately
    v_act_id := 'ACT-' || v_card.id || '-' || to_char(NOW(), 'YYYYMMDDHH24MISS');
    
    UPDATE public.guest_cards
    SET status = 'ACTIVE',
        is_activated = TRUE,
        activated_at = NOW(),
        activated_gate = COALESCE(NULLIF(trim(p_gate_id), ''), 'Main Gate 01'),
        activated_by_staff_id = p_operator_id,
        activated_by_staff_name = p_operator_name,
        updated_at = NOW()
    WHERE id = v_card.id;

    INSERT INTO public.guest_gate_activations (
        id,
        guest_id,
        token,
        gate_id,
        scanner_id,
        operator_id,
        operator_name,
        activation_time,
        status
    ) VALUES (
        v_act_id,
        v_card.id,
        v_card.token,
        COALESCE(NULLIF(trim(p_gate_id), ''), 'Main Gate 01'),
        p_scanner_id,
        p_operator_id,
        p_operator_name,
        NOW(),
        'ACTIVE'
    );

    RETURN jsonb_build_object(
        'success', true,
        'alreadyActive', false,
        'message', 'GUEST CARD ACTIVATED SUCCESSFULLY',
        'card', jsonb_build_object(
            'id', v_card.id,
            'regNumber', v_card.reg_number,
            'token', v_card.token,
            'category', v_card.category,
            'status', 'ACTIVE',
            'isActivated', true,
            'activatedAt', NOW(),
            'activatedGate', COALESCE(NULLIF(trim(p_gate_id), ''), 'Main Gate 01'),
            'activatedByStaffName', p_operator_name
        )
    );
END;
$$;

-- ============================================================================
-- 7. RPC: ATOMIC GUEST FOOD COLLECTION
-- ============================================================================
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
BEGIN
    IF v_clean_meal NOT IN ('breakfast', 'lunch', 'dinner') THEN
        RETURN jsonb_build_object('success', false, 'errorType', 'INVALID_MEAL', 'error', 'Invalid meal type. Must be breakfast, lunch, or dinner.');
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
            -- Ignore malformed JSON and proceed with literal matching
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
        'message', 'Food collection confirmed successfully',
        'record', jsonb_build_object(
            'id', v_col_id,
            'guestId', v_card.id,
            'regNumber', v_card.reg_number,
            'mealType', v_clean_meal,
            'status', 'COLLECTED',
            'collectedAt', NOW(),
            'staffName', p_staff_name
        )
    );
END;
$$;

-- ============================================================================
-- 8. RPC: REVOKE GUEST CARD
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rpc_revoke_guest_card(
    p_guest_id TEXT,
    p_reason TEXT,
    p_admin_id TEXT DEFAULT 'SUPER_ADMIN',
    p_admin_name TEXT DEFAULT 'Super Administrator'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    UPDATE public.guest_cards
    SET status = 'REVOKED',
        revocation_reason = COALESCE(NULLIF(trim(p_reason), ''), 'Revoked by administrator'),
        revoked_at = NOW(),
        revoked_by = p_admin_name,
        updated_at = NOW()
    WHERE id = p_guest_id;

    RETURN jsonb_build_object('success', true, 'message', 'Guest card revoked successfully.');
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.rpc_generate_guest_card_batch(INT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_activate_guest_card(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_collect_guest_food(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_revoke_guest_card(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
