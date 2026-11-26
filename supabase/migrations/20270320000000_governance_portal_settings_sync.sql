-- ============================================================================
-- MIGRATION: 20270320000000_governance_portal_settings_sync.sql
-- PURPOSE:
--   1. Persist Registration & Donation Governance switches and per-category /
--      donation structured bilingual closure notices inside public.system_settings
--      (row key = 'portal_fee_settings').
--   2. Enable Supabase Realtime publication for public.system_settings so open
--      public and admin browsers synchronize immediately across tabs and devices.
--   3. Add public.rpc_get_public_governance_settings() exposing strictly the safe
--      public fields needed by the frontend UI.
--   4. Add public.rpc_update_portal_governance_settings(jsonb, text) enforced for
--      server-verified Super Admin only, performing locked atomic partial JSONB
--      updates so existing payment fields and concurrent edits are preserved.
-- ============================================================================

BEGIN;

-- 1. Enable Supabase Realtime on public.system_settings (idempotent)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'system_settings'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.system_settings;
    END IF;
  END IF;
END $$;

-- 2. Seed missing governance notice & display keys inside portal_fee_settings
--    without overwriting existing authoritative toggle/fee/payment values.
DO $$
DECLARE
  v_default_notices JSONB := jsonb_build_object(
    'alumni', jsonb_build_object(
      'titleEn', 'Alumni Registration Is Temporarily Closed',
      'titleBn', 'প্রাক্তন শিক্ষার্থী নিবন্ধন সাময়িকভাবে বন্ধ রয়েছে',
      'messageEn', 'Alumni (Former Student) online registration is currently closed by the Reunion Secretariat. Please check back later or contact us for assistance.',
      'messageBn', 'প্রাক্তন শিক্ষার্থীদের অনলাইন নিবন্ধন কার্যক্রম বর্তমানে পুনর্মিলনী সচিবালয়ের নির্দেশে বন্ধ রয়েছে। প্রয়োজন হলে অনুগ্রহ করে নিচের নম্বরে বা ইমেইলে যোগাযোগ করুন।',
      'reopenAt', '',
      'contactInfo', '',
      'instructionsEn', '',
      'instructionsBn', ''
    ),
    'currentStudent', jsonb_build_object(
      'titleEn', 'Current Student Registration Is Temporarily Closed',
      'titleBn', 'বর্তমান শিক্ষার্থী নিবন্ধন সাময়িকভাবে বন্ধ রয়েছে',
      'messageEn', 'Current student online registration is currently paused by the Reunion Secretariat. Please check back soon or reach out to the helpdesk.',
      'messageBn', 'বর্তমান শিক্ষার্থীদের অনলাইন নিবন্ধন কার্যক্রম বর্তমানে সাময়িকভাবে স্থগিত রয়েছে। বিস্তারিত জানতে অনুগ্রহ করে সচিবালয়ে যোগাযোগ করুন।',
      'reopenAt', '',
      'contactInfo', '',
      'instructionsEn', '',
      'instructionsBn', ''
    ),
    'donation', jsonb_build_object(
      'titleEn', 'Online Donations Are Temporarily Closed',
      'titleBn', 'অনলাইন অনুদান কার্যক্রম সাময়িকভাবে বন্ধ রয়েছে',
      'messageEn', 'Online donations are currently paused by the Reunion Secretariat. Thank you for your continued generosity and support.',
      'messageBn', 'অনলাইন অনুদান কার্যক্রম বর্তমানে সাময়িকভাবে বন্ধ রয়েছে। পুনর্মিলনী তহবিলে আপনার আন্তরিক আগ্রহ ও সহযোগিতার জন্য ধন্যবাদ।',
      'reopenAt', '',
      'contactInfo', '',
      'instructionsEn', '',
      'instructionsBn', ''
    )
  );
  v_default_sections JSONB := '[
    {"id":"hero","visible":true},
    {"id":"featureCards","visible":true},
    {"id":"pillarsRibbon","visible":true},
    {"id":"countdown","visible":true},
    {"id":"status","visible":true},
    {"id":"fees","visible":true},
    {"id":"financials","visible":true},
    {"id":"notices","visible":true},
    {"id":"gallery","visible":true},
    {"id":"committee","visible":true}
  ]'::jsonb;
  v_existing JSONB;
  v_existing_notices JSONB;
BEGIN
  SELECT value INTO v_existing
  FROM public.system_settings
  WHERE key = 'portal_fee_settings'
  FOR UPDATE;

  IF v_existing IS NULL THEN
    INSERT INTO public.system_settings (key, value, description, updated_by)
    VALUES (
      'portal_fee_settings',
      jsonb_build_object(
        'formerStudentFee', 1500,
        'currentStudentFee', 500,
        'parentFee', 500,
        'minDonation', 100,
        'maxDonation', 50000,
        'maxTotalPayable', 100000,
        'maxGatewayCharge', 75,
        'gatewayChargePercent', 1.8,
        'paymentEnabled', true,
        'registrationOpen', true,
        'alumniRegistrationOpen', true,
        'currentStudentRegistrationOpen', true,
        'donationOpen', true,
        'closedMessageEn', 'Online registration is currently closed. If you need special authorization, please contact the Reunion Secretariat.',
        'closedMessageBn', 'অনলাইন রেজিস্ট্রেশন কার্যক্রম বর্তমানে বন্ধ রয়েছে। জরুরি প্রয়োজনে অনুগ্রহ করে পুনর্মিলনী সচিবালয়ে যোগাযোগ করুন।',
        'donationClosedMessageEn', 'Online donations are currently paused by the Reunion Secretariat. Thank you for your continued support.',
        'donationClosedMessageBn', 'অনলাইন অনুদান কার্যক্রম বর্তমানে সাময়িকভাবে বন্ধ রয়েছে। পুনর্মিলনী তহবিলে সহযোগিতার জন্য আন্তরিক ধন্যবাদ।',
        'closureNotices', v_default_notices,
        'eventTargetDate', '2027-01-29T09:00:00',
        'simulateEventCompleted', false,
        'hideDonationAmounts', false,
        'startDate', '2026-01-01',
        'endDate', '2027-01-20',
        'lateFeeEnabled', false,
        'lateFeeAmount', 300,
        'homePageSections', v_default_sections
      ),
      'Authoritative portal fee, switch, and closure notice configuration.',
      'GOVERNANCE-SYNC-MIGRATION'
    );
  ELSE
    v_existing_notices := COALESCE(v_existing->'closureNotices', '{}'::jsonb);
    UPDATE public.system_settings
    SET value =
      jsonb_build_object(
        'closedMessageEn', COALESCE(NULLIF(v_existing->>'closedMessageEn', ''), 'Online registration is currently closed. If you need special authorization, please contact the Reunion Secretariat.'),
        'closedMessageBn', COALESCE(NULLIF(v_existing->>'closedMessageBn', ''), 'অনলাইন রেজিস্ট্রেশন কার্যক্রম বর্তমানে বন্ধ রয়েছে। জরুরি প্রয়োজনে অনুগ্রহ করে পুনর্মিলনী সচিবালয়ে যোগাযোগ করুন।'),
        'donationClosedMessageEn', COALESCE(NULLIF(v_existing->>'donationClosedMessageEn', ''), 'Online donations are currently paused by the Reunion Secretariat. Thank you for your continued support.'),
        'donationClosedMessageBn', COALESCE(NULLIF(v_existing->>'donationClosedMessageBn', ''), 'অনলাইন অনুদান কার্যক্রম বর্তমানে সাময়িকভাবে বন্ধ রয়েছে। পুনর্মিলনী তহবিলে সহযোগিতার জন্য আন্তরিক ধন্যবাদ।'),
        'eventTargetDate', COALESCE(NULLIF(v_existing->>'eventTargetDate', ''), '2027-01-29T09:00:00'),
        'simulateEventCompleted', COALESCE((v_existing->>'simulateEventCompleted')::boolean, false),
        'hideDonationAmounts', COALESCE((v_existing->>'hideDonationAmounts')::boolean, false),
        'startDate', COALESCE(NULLIF(v_existing->>'startDate', ''), '2026-01-01'),
        'endDate', COALESCE(NULLIF(v_existing->>'endDate', ''), '2027-01-20'),
        'lateFeeEnabled', COALESCE((v_existing->>'lateFeeEnabled')::boolean, false),
        'lateFeeAmount', COALESCE((v_existing->>'lateFeeAmount')::numeric, 300),
        'homePageSections', COALESCE(v_existing->'homePageSections', v_default_sections),
        'closureNotices', jsonb_build_object(
          'alumni', (v_default_notices->'alumni') || COALESCE(v_existing_notices->'alumni', '{}'::jsonb),
          'currentStudent', (v_default_notices->'currentStudent') || COALESCE(v_existing_notices->'currentStudent', '{}'::jsonb),
          'donation', (v_default_notices->'donation') || COALESCE(v_existing_notices->'donation', '{}'::jsonb)
        )
      )
      || v_existing
      || jsonb_build_object(
        'closureNotices', jsonb_build_object(
          'alumni', (v_default_notices->'alumni') || COALESCE(v_existing_notices->'alumni', '{}'::jsonb),
          'currentStudent', (v_default_notices->'currentStudent') || COALESCE(v_existing_notices->'currentStudent', '{}'::jsonb),
          'donation', (v_default_notices->'donation') || COALESCE(v_existing_notices->'donation', '{}'::jsonb)
        )
      ),
      updated_at = NOW()
    WHERE key = 'portal_fee_settings';
  END IF;
END $$;

-- 3. Safe Public Read Projection RPC (returns ONLY fields public UI needs)
CREATE OR REPLACE FUNCTION public.rpc_get_public_governance_settings()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row RECORD;
  v_val JSONB;
BEGIN
  SELECT value, updated_at, updated_by
  INTO v_row
  FROM public.system_settings
  WHERE key = 'portal_fee_settings';

  IF NOT FOUND OR v_row.value IS NULL OR jsonb_typeof(v_row.value) <> 'object' THEN
    RAISE EXCEPTION 'portal_fee_settings is unavailable' USING ERRCODE = 'P0002';
  END IF;

  v_val := v_row.value;

  RETURN jsonb_build_object(
    'registrationOpen', COALESCE((v_val->>'registrationOpen')::boolean, false),
    'alumniRegistrationOpen', COALESCE((v_val->>'alumniRegistrationOpen')::boolean, false),
    'currentStudentRegistrationOpen', COALESCE((v_val->>'currentStudentRegistrationOpen')::boolean, false),
    'donationOpen', COALESCE((v_val->>'donationOpen')::boolean, false),
    'formerStudentFee', COALESCE((v_val->>'formerStudentFee')::numeric, 1500),
    'currentStudentFee', COALESCE((v_val->>'currentStudentFee')::numeric, 500),
    'parentFee', COALESCE((v_val->>'parentFee')::numeric, 500),
    'minDonation', COALESCE((v_val->>'minDonation')::numeric, 100),
    'maxDonation', COALESCE((v_val->>'maxDonation')::numeric, 50000),
    'gatewayChargePercent', COALESCE((v_val->>'gatewayChargePercent')::numeric, 1.8),
    'closedMessageEn', COALESCE(v_val->>'closedMessageEn', 'Online registration is currently closed. If you need special authorization, please contact the Reunion Secretariat.'),
    'closedMessageBn', COALESCE(v_val->>'closedMessageBn', 'অনলাইন রেজিস্ট্রেশন কার্যক্রম বর্তমানে বন্ধ রয়েছে। জরুরি প্রয়োজনে অনুগ্রহ করে পুনর্মিলনী সচিবালয়ে যোগাযোগ করুন।'),
    'donationClosedMessageEn', COALESCE(v_val->>'donationClosedMessageEn', 'Online donations are currently paused by the Reunion Secretariat. Thank you for your continued support.'),
    'donationClosedMessageBn', COALESCE(v_val->>'donationClosedMessageBn', 'অনলাইন অনুদান কার্যক্রম বর্তমানে সাময়িকভাবে বন্ধ রয়েছে। পুনর্মিলনী তহবিলে সহযোগিতার জন্য আন্তরিক ধন্যবাদ।'),
    'closureNotices', v_val->'closureNotices',
    'eventTargetDate', COALESCE(v_val->>'eventTargetDate', '2027-01-29T09:00:00'),
    'simulateEventCompleted', COALESCE((v_val->>'simulateEventCompleted')::boolean, false),
    'hideDonationAmounts', COALESCE((v_val->>'hideDonationAmounts')::boolean, false),
    'homePageSections', v_val->'homePageSections',
    'startDate', COALESCE(v_val->>'startDate', '2026-01-01'),
    'endDate', COALESCE(v_val->>'endDate', '2027-01-20'),
    'lateFeeEnabled', COALESCE((v_val->>'lateFeeEnabled')::boolean, false),
    'lateFeeAmount', COALESCE((v_val->>'lateFeeAmount')::numeric, 300),
    'updatedAt', v_row.updated_at,
    'updatedBy', v_row.updated_by
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_get_public_governance_settings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_get_public_governance_settings() TO anon, authenticated, service_role;

-- 4. Server-Verified Super Admin Atomic Partial Update RPC
CREATE OR REPLACE FUNCTION public.rpc_update_portal_governance_settings(
  p_patch JSONB,
  p_actor_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_admin           RECORD;
  v_current         JSONB;
  v_next            JSONB;
  v_notices         JSONB;
  v_patch_notices   JSONB;
  v_target_key      TEXT;
  v_target_patch    JSONB;
  v_actor_id        TEXT;
  v_actor_name      TEXT;
  v_former_fee      NUMERIC;
  v_current_fee     NUMERIC;
  v_late_fee        NUMERIC;
BEGIN
  -- Strict Server-Side Super Admin Verification (cannot be spoofed from client)
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required: only an authenticated Super Admin may modify governance settings.'
      USING ERRCODE = '42501';
  END IF;

  SELECT id, full_name, username, role, status, is_locked
  INTO v_admin
  FROM public.admin_accounts
  WHERE auth_user_id = auth.uid()
  LIMIT 1;

  IF NOT FOUND
     OR v_admin.is_locked IS TRUE
     OR (v_admin.status IS NOT NULL AND upper(v_admin.status) <> 'ACTIVE')
     OR lower(trim(COALESCE(v_admin.role, ''))) <> 'super_admin' THEN
    RAISE EXCEPTION 'Permission denied: only an active Super Admin may modify governance settings.'
      USING ERRCODE = '42501';
  END IF;

  IF p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object' THEN
    RAISE EXCEPTION 'Governance settings patch must be a JSON object.'
      USING ERRCODE = '22023';
  END IF;

  -- Lock authoritative row for atomic update
  SELECT value INTO v_current
  FROM public.system_settings
  WHERE key = 'portal_fee_settings'
  FOR UPDATE;

  IF v_current IS NULL OR jsonb_typeof(v_current) <> 'object' THEN
    RAISE EXCEPTION 'portal_fee_settings row is missing from system_settings.'
      USING ERRCODE = 'P0002';
  END IF;

  v_next := v_current;

  -- Booleans: 4 primary governance toggles + optional UI toggles
  IF p_patch ? 'registrationOpen' THEN
    IF jsonb_typeof(p_patch->'registrationOpen') <> 'boolean' THEN
      RAISE EXCEPTION 'registrationOpen must be a boolean.' USING ERRCODE = '22023';
    END IF;
    v_next := jsonb_set(v_next, '{registrationOpen}', p_patch->'registrationOpen', true);
  END IF;

  IF p_patch ? 'alumniRegistrationOpen' THEN
    IF jsonb_typeof(p_patch->'alumniRegistrationOpen') <> 'boolean' THEN
      RAISE EXCEPTION 'alumniRegistrationOpen must be a boolean.' USING ERRCODE = '22023';
    END IF;
    v_next := jsonb_set(v_next, '{alumniRegistrationOpen}', p_patch->'alumniRegistrationOpen', true);
  END IF;

  IF p_patch ? 'currentStudentRegistrationOpen' THEN
    IF jsonb_typeof(p_patch->'currentStudentRegistrationOpen') <> 'boolean' THEN
      RAISE EXCEPTION 'currentStudentRegistrationOpen must be a boolean.' USING ERRCODE = '22023';
    END IF;
    v_next := jsonb_set(v_next, '{currentStudentRegistrationOpen}', p_patch->'currentStudentRegistrationOpen', true);
  END IF;

  IF p_patch ? 'donationOpen' THEN
    IF jsonb_typeof(p_patch->'donationOpen') <> 'boolean' THEN
      RAISE EXCEPTION 'donationOpen must be a boolean.' USING ERRCODE = '22023';
    END IF;
    v_next := jsonb_set(v_next, '{donationOpen}', p_patch->'donationOpen', true);
  END IF;

  IF p_patch ? 'simulateEventCompleted' THEN
    IF jsonb_typeof(p_patch->'simulateEventCompleted') <> 'boolean' THEN
      RAISE EXCEPTION 'simulateEventCompleted must be a boolean.' USING ERRCODE = '22023';
    END IF;
    v_next := jsonb_set(v_next, '{simulateEventCompleted}', p_patch->'simulateEventCompleted', true);
  END IF;

  IF p_patch ? 'hideDonationAmounts' THEN
    IF jsonb_typeof(p_patch->'hideDonationAmounts') <> 'boolean' THEN
      RAISE EXCEPTION 'hideDonationAmounts must be a boolean.' USING ERRCODE = '22023';
    END IF;
    v_next := jsonb_set(v_next, '{hideDonationAmounts}', p_patch->'hideDonationAmounts', true);
  END IF;

  IF p_patch ? 'lateFeeEnabled' THEN
    IF jsonb_typeof(p_patch->'lateFeeEnabled') <> 'boolean' THEN
      RAISE EXCEPTION 'lateFeeEnabled must be a boolean.' USING ERRCODE = '22023';
    END IF;
    v_next := jsonb_set(v_next, '{lateFeeEnabled}', p_patch->'lateFeeEnabled', true);
  END IF;

  -- Global & legacy advisory strings
  IF p_patch ? 'closedMessageEn' THEN
    v_next := jsonb_set(v_next, '{closedMessageEn}', to_jsonb(left(trim(COALESCE(p_patch->>'closedMessageEn', '')), 2000)), true);
  END IF;
  IF p_patch ? 'closedMessageBn' THEN
    v_next := jsonb_set(v_next, '{closedMessageBn}', to_jsonb(left(trim(COALESCE(p_patch->>'closedMessageBn', '')), 2000)), true);
  END IF;
  IF p_patch ? 'donationClosedMessageEn' THEN
    v_next := jsonb_set(v_next, '{donationClosedMessageEn}', to_jsonb(left(trim(COALESCE(p_patch->>'donationClosedMessageEn', '')), 2000)), true);
  END IF;
  IF p_patch ? 'donationClosedMessageBn' THEN
    v_next := jsonb_set(v_next, '{donationClosedMessageBn}', to_jsonb(left(trim(COALESCE(p_patch->>'donationClosedMessageBn', '')), 2000)), true);
  END IF;

  -- Per-category & donation structured closure notices (atomic merge per target key)
  IF p_patch ? 'closureNotices' THEN
    IF jsonb_typeof(p_patch->'closureNotices') <> 'object' THEN
      RAISE EXCEPTION 'closureNotices must be a JSON object.' USING ERRCODE = '22023';
    END IF;
    v_notices := COALESCE(v_next->'closureNotices', '{}'::jsonb);
    v_patch_notices := p_patch->'closureNotices';

    FOREACH v_target_key IN ARRAY ARRAY['alumni', 'currentStudent', 'donation']
    LOOP
      IF v_patch_notices ? v_target_key THEN
        IF jsonb_typeof(v_patch_notices->v_target_key) <> 'object' THEN
          RAISE EXCEPTION 'closureNotices.% must be a JSON object.', v_target_key USING ERRCODE = '22023';
        END IF;
        v_target_patch := v_patch_notices->v_target_key;
        v_notices := jsonb_set(
          v_notices,
          ARRAY[v_target_key],
          COALESCE(v_notices->v_target_key, '{}'::jsonb) || jsonb_build_object(
            'titleEn', left(trim(COALESCE(v_target_patch->>'titleEn', v_notices->v_target_key->>'titleEn', '')), 300),
            'titleBn', left(trim(COALESCE(v_target_patch->>'titleBn', v_notices->v_target_key->>'titleBn', '')), 300),
            'messageEn', left(trim(COALESCE(v_target_patch->>'messageEn', v_notices->v_target_key->>'messageEn', '')), 2000),
            'messageBn', left(trim(COALESCE(v_target_patch->>'messageBn', v_notices->v_target_key->>'messageBn', '')), 2000),
            'reopenAt', left(trim(COALESCE(v_target_patch->>'reopenAt', v_notices->v_target_key->>'reopenAt', '')), 120),
            'contactInfo', left(trim(COALESCE(v_target_patch->>'contactInfo', v_notices->v_target_key->>'contactInfo', '')), 250),
            'instructionsEn', left(trim(COALESCE(v_target_patch->>'instructionsEn', v_notices->v_target_key->>'instructionsEn', '')), 2000),
            'instructionsBn', left(trim(COALESCE(v_target_patch->>'instructionsBn', v_notices->v_target_key->>'instructionsBn', '')), 2000)
          ),
          true
        );

        -- Keep legacy donationClosedMessage* synchronized when donation notice message updates
        IF v_target_key = 'donation' THEN
          IF NULLIF(trim(COALESCE(v_target_patch->>'messageEn', '')), '') IS NOT NULL THEN
            v_next := jsonb_set(v_next, '{donationClosedMessageEn}', to_jsonb(left(trim(v_target_patch->>'messageEn'), 2000)), true);
          END IF;
          IF NULLIF(trim(COALESCE(v_target_patch->>'messageBn', '')), '') IS NOT NULL THEN
            v_next := jsonb_set(v_next, '{donationClosedMessageBn}', to_jsonb(left(trim(v_target_patch->>'messageBn'), 2000)), true);
          END IF;
        END IF;
      END IF;
    END LOOP;

    v_next := jsonb_set(v_next, '{closureNotices}', v_notices, true);
  END IF;

  -- Legacy fee/schedule/layout display fields (only updated if explicitly supplied)
  IF p_patch ? 'formerStudentFee' THEN
    v_former_fee := (p_patch->>'formerStudentFee')::numeric;
    IF v_former_fee IS NULL OR v_former_fee <= 0 OR v_former_fee > 100000 THEN
      RAISE EXCEPTION 'formerStudentFee must be between 1 and 100000.' USING ERRCODE = '22023';
    END IF;
    v_next := jsonb_set(v_next, '{formerStudentFee}', to_jsonb(v_former_fee), true);
  END IF;

  IF p_patch ? 'currentStudentFee' THEN
    v_current_fee := (p_patch->>'currentStudentFee')::numeric;
    IF v_current_fee IS NULL OR v_current_fee <= 0 OR v_current_fee > 100000 THEN
      RAISE EXCEPTION 'currentStudentFee must be between 1 and 100000.' USING ERRCODE = '22023';
    END IF;
    v_next := jsonb_set(v_next, '{currentStudentFee}', to_jsonb(v_current_fee), true);
  END IF;

  IF p_patch ? 'lateFeeAmount' THEN
    v_late_fee := (p_patch->>'lateFeeAmount')::numeric;
    IF v_late_fee IS NULL OR v_late_fee < 0 OR v_late_fee > 50000 THEN
      RAISE EXCEPTION 'lateFeeAmount must be between 0 and 50000.' USING ERRCODE = '22023';
    END IF;
    v_next := jsonb_set(v_next, '{lateFeeAmount}', to_jsonb(v_late_fee), true);
  END IF;

  IF p_patch ? 'eventTargetDate' THEN
    v_next := jsonb_set(v_next, '{eventTargetDate}', to_jsonb(left(trim(COALESCE(p_patch->>'eventTargetDate', '')), 64)), true);
  END IF;
  IF p_patch ? 'endDate' THEN
    v_next := jsonb_set(v_next, '{endDate}', to_jsonb(left(trim(COALESCE(p_patch->>'endDate', '')), 64)), true);
  END IF;
  IF p_patch ? 'startDate' THEN
    v_next := jsonb_set(v_next, '{startDate}', to_jsonb(left(trim(COALESCE(p_patch->>'startDate', '')), 64)), true);
  END IF;
  IF p_patch ? 'homePageSections' THEN
    IF jsonb_typeof(p_patch->'homePageSections') <> 'array' THEN
      RAISE EXCEPTION 'homePageSections must be an array.' USING ERRCODE = '22023';
    END IF;
    v_next := jsonb_set(v_next, '{homePageSections}', p_patch->'homePageSections', true);
  END IF;

  v_actor_id := COALESCE(v_admin.id, auth.uid()::text);
  v_actor_name := COALESCE(NULLIF(trim(COALESCE(p_actor_name, '')), ''), v_admin.full_name, v_admin.username, 'Super Administrator');

  UPDATE public.system_settings
  SET value = v_next,
      updated_at = NOW(),
      updated_by = v_actor_name
  WHERE key = 'portal_fee_settings';

  -- Server-side atomic governance audit entry (best effort if constraint/columns differ)
  BEGIN
    INSERT INTO public.admin_audit_history (
      admin_id,
      admin_name,
      entity_type,
      entity_id,
      action,
      previous_value,
      new_value,
      reason,
      "timestamp"
    ) VALUES (
      v_actor_id,
      v_actor_name,
      'REGISTRATION',
      'PORTAL_FEE_SETTINGS',
      'UPDATE_GOVERNANCE_SETTINGS',
      jsonb_build_object(
        'registrationOpen', v_current->'registrationOpen',
        'alumniRegistrationOpen', v_current->'alumniRegistrationOpen',
        'currentStudentRegistrationOpen', v_current->'currentStudentRegistrationOpen',
        'donationOpen', v_current->'donationOpen'
      )::text,
      jsonb_build_object(
        'registrationOpen', v_next->'registrationOpen',
        'alumniRegistrationOpen', v_next->'alumniRegistrationOpen',
        'currentStudentRegistrationOpen', v_next->'currentStudentRegistrationOpen',
        'donationOpen', v_next->'donationOpen'
      )::text,
      'Super Admin atomic governance patch',
      NOW()
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN public.rpc_get_public_governance_settings();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_update_portal_governance_settings(JSONB, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_update_portal_governance_settings(JSONB, TEXT) TO authenticated, service_role;

COMMIT;
