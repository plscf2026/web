-- ============================================================================
-- Migration: 20270321000000_public_reunion_stats_rpc.sql
-- Purpose: Expose privacy-safe aggregate registration counts to the public
--          Homepage Floating Stats Bar directly from Supabase `registrations_2027`
--          without exposing any student PII or allowing direct table SELECT by anon.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_get_public_reunion_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_registered INTEGER := 0;
  v_former_students INTEGER := 0;
  v_current_students INTEGER := 0;
  v_batches_represented INTEGER := 0;
BEGIN
  SELECT
    COUNT(*)::integer,
    COUNT(*) FILTER (WHERE lower(trim(COALESCE(category, ''))) = 'former')::integer,
    COUNT(*) FILTER (WHERE lower(trim(COALESCE(category, ''))) = 'current')::integer,
    COUNT(DISTINCT batch_key)::integer
  INTO
    v_total_registered,
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

  RETURN jsonb_build_object(
    'total_registered', COALESCE(v_total_registered, 0),
    'former_students', COALESCE(v_former_students, 0),
    'current_students', COALESCE(v_current_students, 0),
    'batches_represented', COALESCE(v_batches_represented, 0),
    'updated_at', NOW()
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_get_public_reunion_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_get_public_reunion_stats() TO anon, authenticated, service_role;
