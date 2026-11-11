CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.admin_accounts
  ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.staff_accounts
  ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS uq_admin_accounts_auth_user_id
  ON public.admin_accounts(auth_user_id)
  WHERE auth_user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_accounts_auth_user_id
  ON public.staff_accounts(auth_user_id)
  WHERE auth_user_id IS NOT NULL;

ALTER TABLE public.admin_accounts DROP COLUMN IF EXISTS password_hash;
ALTER TABLE public.staff_accounts DROP COLUMN IF EXISTS password_hash;

ALTER TABLE public.registrations_2026
  DROP CONSTRAINT IF EXISTS registrations_2026_t_shirt_size_check;
ALTER TABLE public.registrations_2026
  ADD CONSTRAINT registrations_2026_t_shirt_size_check
  CHECK (t_shirt_size IN ('S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'Oversize 50'));

ALTER TABLE public.dress_distributions
  DROP CONSTRAINT IF EXISTS dress_distributions_registered_size_check;
ALTER TABLE public.dress_distributions
  ADD CONSTRAINT dress_distributions_registered_size_check
  CHECK (registered_size IN ('XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'Oversize 50'));

CREATE OR REPLACE FUNCTION public.current_admin_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT role
  FROM public.admin_accounts
  WHERE auth_user_id = auth.uid()
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_event_staff_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT role
  FROM public.staff_accounts
  WHERE auth_user_id = auth.uid()
    AND status = 'ACTIVE'
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.current_admin_role() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_event_staff_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_admin_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_event_staff_role() TO authenticated, service_role;

ALTER TABLE public.admin_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  table_record RECORD;
  policy_record RECORD;
  has_duplicates BOOLEAN;
  index_name TEXT;
BEGIN
  FOR table_record IN
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND (table_name = 'registrations' OR table_name ~ '^registrations_[0-9]{4}$')
  LOOP
    EXECUTE format(
      'SELECT EXISTS (
         SELECT 1
         FROM public.%I
         WHERE mobile_number IS NOT NULL AND mobile_number <> ''''
         GROUP BY CASE
           WHEN regexp_replace(mobile_number, ''[^0-9]'', '''', ''g'') LIKE ''880%''
             THEN ''0'' || substr(regexp_replace(mobile_number, ''[^0-9]'', '''', ''g''), 4)
           ELSE regexp_replace(mobile_number, ''[^0-9]'', '''', ''g'')
         END
         HAVING count(*) > 1
       )',
      table_record.table_name
    ) INTO has_duplicates;

    IF has_duplicates THEN
      RAISE EXCEPTION 'Duplicate mobile numbers must be resolved in % before applying the unique registration rule.', table_record.table_name;
    END IF;

    index_name := left('uq_' || table_record.table_name || '_mobile_normalized', 63);
    EXECUTE format(
      'CREATE UNIQUE INDEX IF NOT EXISTS %I ON public.%I (
         (CASE
           WHEN regexp_replace(mobile_number, ''[^0-9]'', '''', ''g'') LIKE ''880%''
             THEN ''0'' || substr(regexp_replace(mobile_number, ''[^0-9]'', '''', ''g''), 4)
           ELSE regexp_replace(mobile_number, ''[^0-9]'', '''', ''g'')
         END)
       ) WHERE mobile_number IS NOT NULL AND mobile_number <> ''''',
      index_name,
      table_record.table_name
    );

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_record.table_name);
    FOR policy_record IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = table_record.table_name
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', policy_record.policyname, table_record.table_name);
    END LOOP;

    EXECUTE format(
      'CREATE POLICY registration_insert_pending ON public.%I
       FOR INSERT TO anon, authenticated
       WITH CHECK (
         payment_status = ''pending''
         AND total_paid = 0
         AND transaction_id IS NULL
         AND payment_method IS NULL
         AND server_verification_signature IS NULL
         AND verification_timestamp IS NULL
         AND verified_by IS NULL
         AND is_checked_in = false
         AND is_tshirt_collected = false
       )',
      table_record.table_name
    );
    EXECUTE format(
      'CREATE POLICY registration_staff_read ON public.%I
       FOR SELECT TO authenticated
       USING (
         public.current_admin_role() = ''super_admin''
         OR public.current_event_staff_role() IN (
           ''SUPER_ADMIN'', ''GATE_STAFF'', ''BREAKFAST_STAFF'',
           ''LUNCH_STAFF'', ''DINNER_STAFF'', ''DRESS_STAFF''
         )
       )',
      table_record.table_name
    );
    EXECUTE format(
      'CREATE POLICY registration_admin_update ON public.%I
       FOR UPDATE TO authenticated
       USING (public.current_admin_role() = ''super_admin'')
       WITH CHECK (public.current_admin_role() = ''super_admin'')',
      table_record.table_name
    );
    EXECUTE format(
      'CREATE POLICY registration_admin_delete ON public.%I
       FOR DELETE TO authenticated
       USING (public.current_admin_role() = ''super_admin'')',
      table_record.table_name
    );
  END LOOP;
END;
$$;

DO $$
DECLARE
  table_record RECORD;
  policy_record RECORD;
BEGIN
  FOR table_record IN
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND (table_name = 'donations' OR table_name ~ '^donations_[0-9]{4}$')
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_record.table_name);
    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN payment_status SET DEFAULT ''pending''',
      table_record.table_name
    );
    FOR policy_record IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = table_record.table_name
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', policy_record.policyname, table_record.table_name);
    END LOOP;
    EXECUTE format(
      'CREATE POLICY donation_admin_read ON public.%I
       FOR SELECT TO authenticated
       USING (public.current_admin_role() = ''super_admin'')',
      table_record.table_name
    );
    EXECUTE format(
      'CREATE POLICY donation_admin_update ON public.%I
       FOR UPDATE TO authenticated
       USING (public.current_admin_role() = ''super_admin'')
       WITH CHECK (public.current_admin_role() = ''super_admin'')',
      table_record.table_name
    );
    EXECUTE format(
      'CREATE POLICY donation_admin_delete ON public.%I
       FOR DELETE TO authenticated
       USING (public.current_admin_role() = ''super_admin'')',
      table_record.table_name
    );
  END LOOP;
END;
$$;

DO $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'admin_accounts', 'admin_audit_logs', 'staff_accounts',
        'food_distributions', 'gate_events', 'dress_distributions',
        'central_budget', 'staff_allocations', 'staff_expenses',
        'financial_ledger', 'admin_audit_history', 'scanner_logs'
      )
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', policy_record.policyname, policy_record.tablename);
  END LOOP;
END;
$$;

CREATE POLICY admin_profile_read_own
  ON public.admin_accounts FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());

CREATE POLICY admin_audit_read_admin
  ON public.admin_audit_logs FOR SELECT TO authenticated
  USING (public.current_admin_role() = 'super_admin');

CREATE POLICY staff_profile_read_own_or_admin
  ON public.staff_accounts FOR SELECT TO authenticated
  USING (
    auth_user_id = auth.uid()
    OR public.current_admin_role() = 'super_admin'
  );
CREATE POLICY staff_profile_admin_insert
  ON public.staff_accounts FOR INSERT TO authenticated
  WITH CHECK (public.current_admin_role() = 'super_admin');
CREATE POLICY staff_profile_admin_update
  ON public.staff_accounts FOR UPDATE TO authenticated
  USING (public.current_admin_role() = 'super_admin')
  WITH CHECK (public.current_admin_role() = 'super_admin');
CREATE POLICY staff_profile_admin_delete
  ON public.staff_accounts FOR DELETE TO authenticated
  USING (public.current_admin_role() = 'super_admin');

CREATE POLICY food_staff_insert
  ON public.food_distributions FOR INSERT TO authenticated
  WITH CHECK (
    (
      public.current_admin_role() = 'super_admin'
      OR public.current_event_staff_role() = CASE meal_type
        WHEN 'breakfast' THEN 'BREAKFAST_STAFF'
        WHEN 'lunch' THEN 'LUNCH_STAFF'
        WHEN 'dinner' THEN 'DINNER_STAFF'
      END
    )
    AND (
      meal_type <> 'breakfast'
      OR timezone('Asia/Dhaka', now())::time < TIME '13:00'
    )
  );
CREATE POLICY food_staff_read
  ON public.food_distributions FOR SELECT TO authenticated
  USING (
    public.current_admin_role() = 'super_admin'
    OR public.current_event_staff_role() IN ('BREAKFAST_STAFF', 'LUNCH_STAFF', 'DINNER_STAFF')
  );
CREATE POLICY food_admin_update
  ON public.food_distributions FOR UPDATE TO authenticated
  USING (public.current_admin_role() = 'super_admin')
  WITH CHECK (public.current_admin_role() = 'super_admin');

CREATE POLICY gate_staff_insert
  ON public.gate_events FOR INSERT TO authenticated
  WITH CHECK (
    public.current_admin_role() = 'super_admin'
    OR public.current_event_staff_role() = 'GATE_STAFF'
  );
CREATE POLICY gate_staff_read
  ON public.gate_events FOR SELECT TO authenticated
  USING (
    public.current_admin_role() = 'super_admin'
    OR public.current_event_staff_role() = 'GATE_STAFF'
  );

CREATE POLICY dress_staff_insert
  ON public.dress_distributions FOR INSERT TO authenticated
  WITH CHECK (
    public.current_admin_role() = 'super_admin'
    OR public.current_event_staff_role() = 'DRESS_STAFF'
  );
CREATE POLICY dress_staff_read
  ON public.dress_distributions FOR SELECT TO authenticated
  USING (
    public.current_admin_role() = 'super_admin'
    OR public.current_event_staff_role() = 'DRESS_STAFF'
  );

CREATE POLICY budget_admin_read
  ON public.central_budget FOR SELECT TO authenticated
  USING (public.current_admin_role() = 'super_admin');
CREATE POLICY budget_admin_write
  ON public.central_budget FOR ALL TO authenticated
  USING (public.current_admin_role() = 'super_admin')
  WITH CHECK (public.current_admin_role() = 'super_admin');

CREATE POLICY allocation_finance_read
  ON public.staff_allocations FOR SELECT TO authenticated
  USING (
    public.current_admin_role() = 'super_admin'
    OR public.current_event_staff_role() = 'FINANCE_STAFF'
  );
CREATE POLICY allocation_admin_write
  ON public.staff_allocations FOR ALL TO authenticated
  USING (public.current_admin_role() = 'super_admin')
  WITH CHECK (public.current_admin_role() = 'super_admin');

CREATE POLICY expenses_finance_read
  ON public.staff_expenses FOR SELECT TO authenticated
  USING (
    public.current_admin_role() = 'super_admin'
    OR public.current_event_staff_role() = 'FINANCE_STAFF'
  );
CREATE POLICY expenses_staff_insert
  ON public.staff_expenses FOR INSERT TO authenticated
  WITH CHECK (
    amount > 0
    AND (
      public.current_admin_role() = 'super_admin'
      OR public.current_event_staff_role() = 'FINANCE_STAFF'
    )
  );
CREATE POLICY expenses_admin_update
  ON public.staff_expenses FOR UPDATE TO authenticated
  USING (public.current_admin_role() = 'super_admin')
  WITH CHECK (public.current_admin_role() = 'super_admin');

CREATE POLICY ledger_finance_read
  ON public.financial_ledger FOR SELECT TO authenticated
  USING (
    public.current_admin_role() = 'super_admin'
    OR public.current_event_staff_role() = 'FINANCE_STAFF'
  );
CREATE POLICY ledger_admin_insert
  ON public.financial_ledger FOR INSERT TO authenticated
  WITH CHECK (public.current_admin_role() = 'super_admin');

CREATE POLICY audit_history_admin_read
  ON public.admin_audit_history FOR SELECT TO authenticated
  USING (public.current_admin_role() = 'super_admin');
CREATE POLICY audit_history_admin_insert
  ON public.admin_audit_history FOR INSERT TO authenticated
  WITH CHECK (public.current_admin_role() = 'super_admin');

CREATE POLICY scanner_logs_staff_insert
  ON public.scanner_logs FOR INSERT TO authenticated
  WITH CHECK (public.current_event_staff_role() IN ('SUPER_ADMIN', 'GATE_STAFF'));
CREATE POLICY scanner_logs_admin_read
  ON public.scanner_logs FOR SELECT TO authenticated
  USING (
    public.current_admin_role() = 'super_admin'
    OR public.current_event_staff_role() = 'SUPER_ADMIN'
  );

REVOKE ALL ON FUNCTION public.rpc_verify_payment(TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_verify_payment(TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT)
  TO service_role;
REVOKE ALL ON FUNCTION public.rpc_secure_ticket_lookup(TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_secure_ticket_lookup(TEXT, TEXT)
  TO service_role;
REVOKE ALL ON FUNCTION public.get_staff_remaining_balance(TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_staff_remaining_balance(TEXT)
  TO service_role;
