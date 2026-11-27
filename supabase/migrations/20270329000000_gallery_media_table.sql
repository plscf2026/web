-- =============================================================================
-- Migration: Create gallery_media table for Photo Gallery & Video Memories CMS
-- Date: 2027-03-29
-- Purpose: Persist gallery CRUD operations from Super Admin CMS to Supabase
-- =============================================================================

BEGIN;

-- ── 1. CREATE gallery_media TABLE ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gallery_media (
  id            TEXT        PRIMARY KEY,
  type          TEXT        NOT NULL DEFAULT 'photo' CHECK (type IN ('photo','video')),
  title_en      TEXT        NOT NULL DEFAULT '',
  title_bn      TEXT        NOT NULL DEFAULT '',
  album         TEXT        NOT NULL DEFAULT 'heritage',
  year          TEXT        NOT NULL DEFAULT '2026',
  thumbnail     TEXT        NOT NULL DEFAULT '',
  video_url     TEXT,
  description_en TEXT       NOT NULL DEFAULT '',
  description_bn TEXT       NOT NULL DEFAULT '',
  sort_order    INTEGER     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 2. UPDATED_AT TRIGGER ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_gallery_media_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gallery_media_updated_at ON public.gallery_media;
CREATE TRIGGER trg_gallery_media_updated_at
  BEFORE UPDATE ON public.gallery_media
  FOR EACH ROW EXECUTE FUNCTION public.set_gallery_media_updated_at();

-- ── 3. INDEXES ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_gallery_media_album      ON public.gallery_media (album);
CREATE INDEX IF NOT EXISTS idx_gallery_media_type       ON public.gallery_media (type);
CREATE INDEX IF NOT EXISTS idx_gallery_media_sort_order ON public.gallery_media (sort_order);

-- ── 4. ROW LEVEL SECURITY ─────────────────────────────────────────────────────
ALTER TABLE public.gallery_media ENABLE ROW LEVEL SECURITY;

-- Public can read gallery (anon + authenticated)
DROP POLICY IF EXISTS gallery_media_anon_read ON public.gallery_media;
CREATE POLICY gallery_media_anon_read
  ON public.gallery_media FOR SELECT
  USING (true);

-- Only authenticated service role can insert/update/delete
-- (Admin CMS uses service_role key via Supabase Edge; anon reads only)
DROP POLICY IF EXISTS gallery_media_service_write ON public.gallery_media;
CREATE POLICY gallery_media_service_write
  ON public.gallery_media FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to manage gallery (admin panel uses anon key with admin session)
DROP POLICY IF EXISTS gallery_media_auth_write ON public.gallery_media;
CREATE POLICY gallery_media_auth_write
  ON public.gallery_media FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow anon to upsert (admin panel currently runs as anon with admin credentials in app layer)
DROP POLICY IF EXISTS gallery_media_anon_write ON public.gallery_media;
CREATE POLICY gallery_media_anon_write
  ON public.gallery_media FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- ── 5. SEED DEFAULT 8 MEDIA ITEMS ─────────────────────────────────────────────
INSERT INTO public.gallery_media
  (id, type, title_en, title_bn, album, year, thumbnail, video_url, description_en, description_bn, sort_order)
VALUES
  ('M1','photo',
   'Founding Batch of Police Lines High School (1962)',
   'বিদ্যালয় প্রতিষ্ঠার উদ্বোধনী ব্যাচ ও শিক্ষকবৃন্দ (১৯৬২)',
   'heritage','1962',
   'https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?w=800&auto=format&fit=crop&q=80',
   NULL,
   'The historic first gathering of students and teachers under the banyan tree of Faridpur Police Ground.',
   'ফরিদপুর পুলিশ লাইন্স মাঠে প্রতিষ্ঠিত বিদ্যালয়ের প্রথম শিক্ষক ও শিক্ষার্থী সমাবেশের ঐতিহাসিক মুহূর্ত।',
   1),
  ('M2','photo',
   'SSC 1978 Batch Celebration',
   'এসএসসি ১৯৭৮ ব্যাচের বিদায় সংবর্ধনা',
   'heritage','1978',
   'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&auto=format&fit=crop&q=80',
   NULL,
   'Memorable batch photo of SSC 1978 after academic board triumph.',
   'বোর্ড পরীক্ষায় অভাবনীয় সাফল্যের পর ১৯৭৮ সালের এসএসসি ব্যাচ।',
   2),
  ('M3','photo',
   'Silver Jubilee Celebration (1987)',
   'রজত জয়ন্তী উদ্‌যাপন (১৯৮৭)',
   'alumni','1987',
   'https://images.unsplash.com/photo-1511578314322-379afb476865?w=800&auto=format&fit=crop&q=80',
   NULL,
   '25 years celebration gala held at the central district stadium.',
   '২৫ বছর পূর্তিতে আয়োজিত বর্ণাঢ্য রজত জয়ন্তী উৎসব।',
   3),
  ('M4','photo',
   'Science Lab & Robotic Fair',
   'বিজ্ঞান মেলা ও ল্যাবরেটরি প্রদর্শনী',
   'modern','2016',
   'https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=800&auto=format&fit=crop&q=80',
   NULL,
   'Innovative science projects built by high school students.',
   'শিক্ষার্থীদের উদ্ভাবনী বিজ্ঞান ও রোবোটিক্স প্রকল্প প্রদর্শনী।',
   4),
  ('M5','video',
   'Historic Reunion Documentary: 64 Years of Legacy',
   'ঐতিহাসিক প্রামাণ্যচিত্র: গৌরবের ৬৪ বছর',
   'cultural','2026',
   'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&auto=format&fit=crop&q=80',
   'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
   'Documentary recounting the transformation from a police school to a premier college.',
   'বিদ্যালয় প্রতিষ্ঠার ইতিহাস ও দেশসেরা প্রতিষ্ঠানে রূপান্তরের গল্প।',
   5),
  ('M6','video',
   'Teacher Interviews: Golden Memories of Faridpur',
   'গুরুজনদের স্মৃতিকথা: প্রবীণ শিক্ষকদের স্মৃতিচারণ',
   'cultural','2025',
   'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=800&auto=format&fit=crop&q=80',
   'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
   'Heartwarming interviews with former headmasters and senior faculty.',
   'প্রাক্তন প্রধান শিক্ষক ও বর্ষীয়ান শিক্ষকদের আন্তরিক সাক্ষাৎকার।',
   6),
  ('M7','photo',
   'Modern Academic Building & Campus Grounds',
   'আধুনিক একাডেমিক ভবন ও সবুজ প্রাঙ্গণ',
   'campus','2024',
   'https://images.unsplash.com/photo-1562774053-701939374585?w=800&auto=format&fit=crop&q=80',
   NULL,
   'Aerial view of the renovated high school and college facilities in Joyrampur, Faridpur.',
   'জয়রামপুরে অবস্থিত দৃষ্টিনন্দন বহুতল কলেজ ভবন ও খেলার মাঠ।',
   7),
  ('M8','photo',
   'Annual Sports Parade & Police March Past',
   'বার্ষিক ক্রীড়া প্রতিযোগিতা ও বর্ণাঢ্য মার্চপাস্ট',
   'campus','2023',
   'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=800&auto=format&fit=crop&q=80',
   NULL,
   'Cadet drill and athletic sprint finals on sports day.',
   'শৃঙ্খলাপরায়ণ প্যারেড ও ক্রীড়া প্রতিযোগিতার রোমাঞ্চকর মুহূর্ত।',
   8)
ON CONFLICT (id) DO NOTHING;

COMMIT;
