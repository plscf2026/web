-- Migration: 20270301000000_remove_rms_and_committee_tables.sql
-- Description: Completely drop all Committee, RMS, and Planning portal database tables and policies.

DROP TABLE IF EXISTS public.rms_task_comments CASCADE;
DROP TABLE IF EXISTS public.rms_tasks CASCADE;
DROP TABLE IF EXISTS public.rms_committee_members CASCADE;
DROP TABLE IF EXISTS public.rms_budget_requests CASCADE;
DROP TABLE IF EXISTS public.rms_expenses CASCADE;
DROP TABLE IF EXISTS public.rms_income_transactions CASCADE;
DROP TABLE IF EXISTS public.rms_sponsors CASCADE;
DROP TABLE IF EXISTS public.rms_documents CASCADE;
DROP TABLE IF EXISTS public.rms_meetings CASCADE;
DROP TABLE IF EXISTS public.rms_announcements CASCADE;
DROP TABLE IF EXISTS public.rms_volunteers CASCADE;
DROP TABLE IF EXISTS public.rms_event_incidents CASCADE;
DROP TABLE IF EXISTS public.rms_weekly_reports CASCADE;
DROP TABLE IF EXISTS public.rms_audit_logs CASCADE;
DROP TABLE IF EXISTS public.rms_committees CASCADE;
