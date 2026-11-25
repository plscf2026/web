-- ============================================================================
-- MIGRATION: Harden Student Photos Storage RLS (Eliminate Broad SELECT Policies)
-- Bucket: student-photos (public = true for CDN image delivery)
--
-- Why:
--   Public buckets serve CDN URLs (/storage/v1/object/public/student-photos/...)
--   directly without requiring any SELECT policy on storage.objects.
--   Broad SELECT policies ("Public can view student photos" and the catch-all
--   "Admins have full storage management" FOR ALL USING (true)) allowed clients
--   to call .list() and enumerate all files in the bucket.
--
-- Fix:
--   1. Drop broad SELECT / UPDATE / DELETE policies on student-photos and drop
--      the wildcard FOR ALL policy across storage.objects.
--   2. Keep INSERT-only upload policy for public registrations (extension-checked).
--   3. Scope payment-receipts (private bucket) management strictly to verified
--      admins and active staff via current_admin_role() / current_event_staff_role().
--   4. Scope student-photos UPDATE/DELETE policies strictly to verified admins
--      and active staff (no broad SELECT policy on student-photos).
-- ============================================================================

-- 1. Remove overly broad policies on storage.objects
DROP POLICY IF EXISTS "Public can view student photos" ON storage.objects;
DROP POLICY IF EXISTS "Public read student photos" ON storage.objects;
DROP POLICY IF EXISTS "Public can update student photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow student photo updates" ON storage.objects;
DROP POLICY IF EXISTS "Allow student photo deletes" ON storage.objects;
DROP POLICY IF EXISTS "Admins have full storage management" ON storage.objects;

-- 2. Ensure INSERT-only public upload policy for student-photos
DROP POLICY IF EXISTS "Public can upload registration photo" ON storage.objects;
DROP POLICY IF EXISTS "Allow student photo uploads" ON storage.objects;
CREATE POLICY "Public can upload registration photo"
  ON storage.objects FOR INSERT
  TO public
  WITH CHECK (
    bucket_id = 'student-photos'
    AND (storage.extension(name) IN ('jpg', 'jpeg', 'png', 'webp'))
  );

-- 3. Scoped admin/staff management on private payment-receipts bucket
DROP POLICY IF EXISTS "Admins manage payment receipts" ON storage.objects;
CREATE POLICY "Admins manage payment receipts"
  ON storage.objects FOR ALL
  TO authenticated
  USING (
    bucket_id = 'payment-receipts'
    AND (public.current_admin_role() IS NOT NULL OR public.current_event_staff_role() IS NOT NULL)
  )
  WITH CHECK (
    bucket_id = 'payment-receipts'
    AND (public.current_admin_role() IS NOT NULL OR public.current_event_staff_role() IS NOT NULL)
  );

-- 4. Scoped admin/staff UPDATE and DELETE on student-photos (no broad SELECT)
DROP POLICY IF EXISTS "Admins update student photos" ON storage.objects;
CREATE POLICY "Admins update student photos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'student-photos'
    AND (public.current_admin_role() IS NOT NULL OR public.current_event_staff_role() IS NOT NULL)
  )
  WITH CHECK (
    bucket_id = 'student-photos'
    AND (public.current_admin_role() IS NOT NULL OR public.current_event_staff_role() IS NOT NULL)
  );

DROP POLICY IF EXISTS "Admins delete student photos" ON storage.objects;
CREATE POLICY "Admins delete student photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'student-photos'
    AND (public.current_admin_role() IS NOT NULL OR public.current_event_staff_role() IS NOT NULL)
  );
