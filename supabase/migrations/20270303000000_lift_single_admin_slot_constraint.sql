-- ==============================================================================
-- DATABASE MIGRATION: 20270303000000_lift_single_admin_slot_constraint.sql
-- POLICE LINES SCHOOL AND COLLEGE, FARIDPUR — GRAND REUNION 2027
-- Lift single admin slot constraint to enable role-based administrative accounts
-- ==============================================================================

-- Drop the legacy trigger that blocked creating secondary administrative accounts
DROP TRIGGER IF EXISTS trg_enforce_single_admin_slot ON public.admin_accounts;

-- Drop the associated trigger function
DROP FUNCTION IF EXISTS public.check_single_admin_slot();
