-- ============================================================================
-- Migration: Dedicated Public Storage Bucket for Organizing Committee Photos
-- Bucket: committee-photos (public read, 5 MB limit, JPG/PNG/WebP)
-- Uploads/updates/deletes permitted only for authenticated Admins / Super Admins.
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'committee-photos',
  'committee-photos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public can read committee photos" ON storage.objects;
CREATE POLICY "Public can read committee photos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'committee-photos');

DROP POLICY IF EXISTS "Admins can upload committee photos" ON storage.objects;
CREATE POLICY "Admins can upload committee photos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'committee-photos'
  AND public.current_admin_role() IS NOT NULL
  AND storage.extension(name) = ANY (ARRAY['jpg', 'jpeg', 'png', 'webp'])
);

DROP POLICY IF EXISTS "Admins can update committee photos" ON storage.objects;
CREATE POLICY "Admins can update committee photos"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'committee-photos'
  AND public.current_admin_role() IS NOT NULL
)
WITH CHECK (
  bucket_id = 'committee-photos'
  AND public.current_admin_role() IS NOT NULL
);

DROP POLICY IF EXISTS "Admins can delete committee photos" ON storage.objects;
CREATE POLICY "Admins can delete committee photos"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'committee-photos'
  AND public.current_admin_role() IS NOT NULL
);
