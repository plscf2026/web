CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.ticket_lookup_rate_limits (
  subject_hash TEXT PRIMARY KEY,
  window_started_at TIMESTAMPTZ NOT NULL,
  attempt_count INTEGER NOT NULL CHECK (attempt_count > 0)
);

REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE private.ticket_lookup_rate_limits FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.consume_ticket_lookup_rate_limit(
  p_subject_hash TEXT,
  p_max_attempts INTEGER DEFAULT 5,
  p_window_seconds INTEGER DEFAULT 60
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  request_allowed BOOLEAN;
BEGIN
  IF p_subject_hash IS NULL OR length(p_subject_hash) <> 64
     OR p_max_attempts < 1 OR p_max_attempts > 20
     OR p_window_seconds < 1 OR p_window_seconds > 3600 THEN
    RETURN FALSE;
  END IF;

  INSERT INTO private.ticket_lookup_rate_limits AS rate_limits (
    subject_hash,
    window_started_at,
    attempt_count
  )
  VALUES (p_subject_hash, now(), 1)
  ON CONFLICT (subject_hash) DO UPDATE
  SET
    attempt_count = CASE
      WHEN rate_limits.window_started_at
        <= now() - make_interval(secs => p_window_seconds)
      THEN 1
      ELSE rate_limits.attempt_count + 1
    END,
    window_started_at = CASE
      WHEN rate_limits.window_started_at
        <= now() - make_interval(secs => p_window_seconds)
      THEN now()
      ELSE rate_limits.window_started_at
    END
  RETURNING attempt_count <= p_max_attempts INTO request_allowed;

  DELETE FROM private.ticket_lookup_rate_limits
  WHERE window_started_at < now() - INTERVAL '1 day';

  RETURN request_allowed;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_ticket_lookup_rate_limit(TEXT, INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_ticket_lookup_rate_limit(TEXT, INTEGER, INTEGER)
  TO service_role;
