-- ============================================================================
-- MIGRATION: Dedicated Supabase Storage Bucket for Student Profile Images
-- Bucket Name: student-photos
-- Organizes images by <batch_year>/<student_registration_id>/profile.webp
-- Replaces Base64 strings with clean storage paths in Supabase Database
-- Scales for 10,000+ student registrations with RLS security policies
-- ============================================================================

-- 1. CREATE / CONFIGURE BUCKET: student-photos
-- Public read enabled for CDN edge delivery on event tickets, ID cards, and badges.
-- File size limit: 5MB (compressed on client before upload to <= 150KB).
-- Allowed MIME types: image/jpeg, image/png, image/webp.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'student-photos',
  'student-photos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- 2. ENABLE ROW LEVEL SECURITY (RLS) ON STORAGE.OBJECTS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 2.1 Public Read Access: Anyone can view student profile photos
DROP POLICY IF EXISTS "Public can view student photos" ON storage.objects;
DROP POLICY IF EXISTS "Public read student photos" ON storage.objects;
CREATE POLICY "Public can view student photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'student-photos');

-- 2.2 Upload Policy: Registration attendees & staff can upload valid student photos
DROP POLICY IF EXISTS "Allow student photo uploads" ON storage.objects;
CREATE POLICY "Allow student photo uploads"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'student-photos'
    AND (storage.extension(name) IN ('jpg', 'jpeg', 'png', 'webp'))
  );

-- 2.3 Update Policy: Allow updating existing student photos
DROP POLICY IF EXISTS "Allow student photo updates" ON storage.objects;
CREATE POLICY "Allow student photo updates"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'student-photos')
  WITH CHECK (bucket_id = 'student-photos');

-- 2.4 Delete Policy: Allow deleting student photos
DROP POLICY IF EXISTS "Allow student photo deletes" ON storage.objects;
CREATE POLICY "Allow student photo deletes"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'student-photos');

-- ============================================================================
-- 3. SCHEMA ENHANCEMENT: registrations_2027
-- Store only the image storage path (e.g. 2014/PLSCF-2027-F1042/profile.webp)
-- ============================================================================

ALTER TABLE public.registrations_2027
  ADD COLUMN IF NOT EXISTS photo_storage_path TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS parent_photo_storage_path TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS photo_updated_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS photo_updated_by TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_reg_2027_photo_storage_path
  ON public.registrations_2027 (photo_storage_path);

-- ============================================================================
-- 4. STORED PROCEDURE: rpc_update_student_photo
-- Authoritatively updates student photo storage path and logs audit history
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_update_student_photo(
  p_registration_id TEXT,
  p_storage_path TEXT,
  p_photo_url TEXT,
  p_admin_name TEXT DEFAULT 'Admin'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reg RECORD;
  v_old_path TEXT;
BEGIN
  -- 1. Find target registration
  SELECT * INTO v_reg
  FROM public.registrations_2027
  WHERE id = p_registration_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'REGISTRATION_NOT_FOUND'
    );
  END IF;

  v_old_path := v_reg.photo_storage_path;

  -- 2. Update photo storage path and public url
  UPDATE public.registrations_2027
  SET
    photo_storage_path = p_storage_path,
    photo_url = COALESCE(p_photo_url, photo_url),
    photo_updated_at = NOW(),
    photo_updated_by = p_admin_name
  WHERE id = p_registration_id;

  -- 3. Record audit log entry
  INSERT INTO public.admin_audit_logs (
    id,
    admin_id,
    admin_username,
    admin_role,
    action,
    details,
    checksum,
    created_at
  ) VALUES (
    'AUD-PHT-' || FLOOR(EXTRACT(EPOCH FROM NOW())) || '-' || SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6),
    'ADMIN-ACTION',
    p_admin_name,
    'super_admin',
    'STUDENT_PHOTO_UPDATED',
    jsonb_build_object(
      'registration_id', p_registration_id,
      'old_storage_path', v_old_path,
      'new_storage_path', p_storage_path,
      'updated_by', p_admin_name,
      'bucket', 'student-photos'
    ),
    MD5(p_registration_id || p_storage_path || NOW()::TEXT),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'registration_id', p_registration_id,
    'storage_path', p_storage_path,
    'photo_url', COALESCE(p_photo_url, v_reg.photo_url)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_update_student_photo(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
