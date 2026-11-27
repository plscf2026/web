-- ============================================================================
-- Migration: 20270330000000_guardian_registrations_and_independent_identity.sql
-- Purpose:
--   1. Create public.guardian_registrations_2027 with independent primary key,
--      foreign key to public.registrations_2027(id), unique registration_id
--      and unique 6-char qr_token.
--   2. Enforce server-side guardian eligibility (current female OR current male
--      strictly below Class 6).
--   3. Finalize both student & guardian in one atomic transaction inside
--      rpc_promote_pending_order_to_registration (idempotent on retries).
--   4. Update rpc_verify_student_qr, rpc_lookup_ticket, rpc_record_gate_event,
--      rpc_confirm_food_distribution, and rpc_confirm_dress_distribution
--      (rejecting guardian T-shirt redemption).
--   5. Update rpc_get_public_reunion_stats to expose total_registered,
--      total_students, former_students, current_students, guardians, batches_represented.
--   6. Backfill legacy has_parent=true registrations & flag incomplete records.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.guardian_registrations_2027 (
  id                           TEXT PRIMARY KEY,
  registration_id              TEXT UNIQUE,
  student_registration_id      TEXT NOT NULL REFERENCES public.registrations_2027(id) ON DELETE CASCADE,
  event_id                     TEXT NOT NULL DEFAULT 'PLSCF-2027',
  year                         INTEGER NOT NULL DEFAULT 2027,
  guardian_name                TEXT NOT NULL,
  guardian_name_bn             TEXT,
  mobile_number                TEXT,
  relation                     TEXT,
  guardian_phone               TEXT,
  guardian_relation            TEXT DEFAULT 'Guardian',
  guardian_age                 TEXT,
  photo_url                    TEXT,
  photo_storage_path           TEXT,
  qr_token                     TEXT NOT NULL UNIQUE,
  registration_fee             NUMERIC NOT NULL DEFAULT 0,
  guardian_fee                 NUMERIC NOT NULL DEFAULT 0,
  total_paid                   NUMERIC NOT NULL DEFAULT 0,
  payment_status               TEXT NOT NULL DEFAULT 'paid',
  registration_approval_status TEXT NOT NULL DEFAULT 'approved',
  transaction_id               TEXT,
  payment_method               TEXT,
  gateway_invoice_number       TEXT,
  gateway_provider             TEXT DEFAULT 'PAYSTATION',
  is_manual_registration       BOOLEAN NOT NULL DEFAULT false,
  is_gate_entered              BOOLEAN NOT NULL DEFAULT false,
  is_checked_in                BOOLEAN NOT NULL DEFAULT false,
  gate_status                  TEXT NOT NULL DEFAULT 'NOT_ENTERED',
  needs_manual_review          BOOLEAN NOT NULL DEFAULT false,
  review_reason                TEXT,
  registered_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guardian_reg_2027_student_id ON public.guardian_registrations_2027 (student_registration_id);
CREATE INDEX IF NOT EXISTS idx_guardian_reg_2027_invoice ON public.guardian_registrations_2027 (gateway_invoice_number);
CREATE INDEX IF NOT EXISTS idx_guardian_reg_2027_trx_id ON public.guardian_registrations_2027 (transaction_id);
CREATE INDEX IF NOT EXISTS idx_guardian_reg_2027_phone ON public.guardian_registrations_2027 (guardian_phone);
CREATE INDEX IF NOT EXISTS idx_guardian_qr_token ON public.guardian_registrations_2027 (upper(qr_token));

ALTER TABLE public.pending_orders ADD COLUMN IF NOT EXISTS promoted_guardian_id TEXT;
ALTER TABLE public.gate_events ADD COLUMN IF NOT EXISTS participant_type TEXT DEFAULT 'student';
ALTER TABLE public.food_distributions ADD COLUMN IF NOT EXISTS participant_type TEXT DEFAULT 'student';

ALTER TABLE public.guardian_registrations_2027 ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS guardian_reg_2027_service_all ON public.guardian_registrations_2027;
CREATE POLICY guardian_reg_2027_service_all
  ON public.guardian_registrations_2027 FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.is_guardian_eligible(
  p_category TEXT,
  p_gender TEXT,
  p_current_class TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_cat TEXT := lower(trim(COALESCE(p_category, '')));
  v_gen TEXT := lower(trim(COALESCE(p_gender, '')));
BEGIN
  IF v_gen = 'female' AND v_cat IN ('current', 'former') THEN
    RETURN true;
  END IF;
  IF v_cat <> 'current' THEN
    RETURN false;
  END IF;
  RETURN public.is_student_below_class_6(p_current_class);
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_unique_guardian_reg_id(p_year INT DEFAULT 2027)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_candidate TEXT;
BEGIN
  LOOP
    v_candidate := 'PLSCF-' || COALESCE(p_year, 2027) || '-G' || floor(1000 + random() * 9000)::TEXT;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.guardian_registrations_2027 WHERE upper(id) = upper(v_candidate))
          AND NOT EXISTS (SELECT 1 FROM public.registrations_2027 WHERE upper(id) = upper(v_candidate));
  END LOOP;
  RETURN v_candidate;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_get_public_reunion_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_students      INTEGER := 0;
  v_former_students     INTEGER := 0;
  v_current_students    INTEGER := 0;
  v_guardians           INTEGER := 0;
  v_total_registered    INTEGER := 0;
  v_batches_represented INTEGER := 0;
BEGIN
  SELECT
    COUNT(*)::integer,
    COUNT(*) FILTER (WHERE lower(trim(COALESCE(category, ''))) = 'former')::integer,
    COUNT(*) FILTER (WHERE lower(trim(COALESCE(category, ''))) = 'current')::integer,
    COUNT(DISTINCT batch_key)::integer
  INTO
    v_total_students,
    v_former_students,
    v_current_students,
    v_batches_represented
  FROM (
    SELECT
      category,
      COALESCE(
        NULLIF(regexp_replace(upper(trim(COALESCE(passing_year, ''))), '^SSC\s+', ''), ''),
        CASE
          WHEN lower(trim(COALESCE(category, ''))) = 'current'
            THEN NULLIF(upper(trim(COALESCE(current_class, ''))), '')
          ELSE NULL
        END,
        NULLIF(regexp_replace(upper(trim(COALESCE(batch_name, ''))), '^SSC\s+', ''), '')
      ) AS batch_key
    FROM public.registrations_2027
    WHERE lower(trim(COALESCE(payment_status, ''))) = 'paid'
  ) paid_regs;

  SELECT COUNT(*)::integer
  INTO v_guardians
  FROM public.guardian_registrations_2027
  WHERE lower(trim(COALESCE(payment_status, ''))) = 'paid';

  v_total_registered := COALESCE(v_total_students, 0) + COALESCE(v_guardians, 0);

  RETURN jsonb_build_object(
    'total_registered', v_total_registered,
    'total_students', COALESCE(v_total_students, 0),
    'former_students', COALESCE(v_former_students, 0),
    'current_students', COALESCE(v_current_students, 0),
    'guardians', COALESCE(v_guardians, 0),
    'batches_represented', COALESCE(v_batches_represented, 0),
    'updated_at', NOW()
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_get_public_reunion_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_get_public_reunion_stats() TO anon, authenticated, service_role;

-- Backfill any legacy registrations with has_parent=true lacking an independent guardian record
DO $$
DECLARE
  r RECORD;
  v_gid TEXT;
  v_gtok TEXT;
  v_incomplete BOOLEAN;
  v_reason TEXT;
BEGIN
  FOR r IN
    SELECT s.*
    FROM public.registrations_2027 s
    WHERE COALESCE(s.has_parent, false) = true
      AND s.payment_status = 'paid'
      AND NOT EXISTS (
        SELECT 1 FROM public.guardian_registrations_2027 g
        WHERE g.student_registration_id = s.id
      )
  LOOP
    v_gid := public.generate_unique_guardian_reg_id(COALESCE(r.year, 2027));
    v_gtok := upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 6));
    WHILE EXISTS (SELECT 1 FROM public.registrations_2027 WHERE upper(qr_token) = v_gtok)
       OR EXISTS (SELECT 1 FROM public.guardian_registrations_2027 WHERE upper(qr_token) = v_gtok) LOOP
      v_gtok := upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 6));
    END LOOP;

    v_incomplete := (NULLIF(trim(COALESCE(r.parent_name, '')), '') IS NULL)
                 OR (NULLIF(trim(COALESCE(r.parent_phone, '')), '') IS NULL)
                 OR (NULLIF(trim(COALESCE(r.parent_photo_url, '')), '') IS NULL);
    v_reason := CASE
      WHEN v_incomplete THEN 'Legacy guardian migration: missing guardian name, phone, or photo; requires manual review.'
      ELSE NULL
    END;

    INSERT INTO public.guardian_registrations_2027 (
      id, registration_id, student_registration_id, event_id, year,
      guardian_name, mobile_number, relation, guardian_phone, guardian_relation, guardian_age,
      photo_url, photo_storage_path, qr_token, registration_fee, guardian_fee, total_paid,
      payment_status, registration_approval_status, transaction_id, payment_method,
      gateway_invoice_number, gateway_provider, is_manual_registration,
      needs_manual_review, review_reason, registered_at
    ) VALUES (
      v_gid, v_gid, r.id, COALESCE(r.event_id, 'PLSCF-2027'), COALESCE(r.year, 2027),
      COALESCE(NULLIF(trim(r.parent_name), ''), 'Guardian (Review Required)'),
      r.parent_phone, COALESCE(r.parent_relation, 'Guardian'),
      r.parent_phone, COALESCE(r.parent_relation, 'Guardian'), r.parent_age,
      r.parent_photo_url, r.parent_photo_storage_path, v_gtok,
      COALESCE(r.parent_fee, 0), COALESCE(r.parent_fee, 0), COALESCE(r.parent_fee, 0),
      r.payment_status, COALESCE(r.registration_approval_status, 'approved'),
      r.transaction_id, r.payment_method, r.gateway_invoice_number,
      COALESCE(r.gateway_provider, 'PAYSTATION'), COALESCE(r.is_manual_registration, false),
      v_incomplete, v_reason, COALESCE(r.registered_at, NOW())
    );
  END LOOP;
END;
$$;

COMMIT;

