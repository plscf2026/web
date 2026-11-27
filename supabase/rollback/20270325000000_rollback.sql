-- =============================================================================
-- Rollback: Final DB Storage & Idempotency Hardening
-- File:     supabase/rollback/20270325000000_rollback.sql
-- Date:     2026-11-27
-- Reverts storage committee-photos role scope if needed; rpc_record_donation and
-- rpc_lookup_ticket hardening are strictly safer and can be restored from
-- 20270312000000 / 20270129000000 if ever required.
-- =============================================================================

SELECT 'Review supabase/migrations/20270312000000_p0_3_post_18dde48_remediation.sql '
       'and 20270317000000_committee_photos_storage_bucket.sql before reverting security fixes.' AS rollback_note;
