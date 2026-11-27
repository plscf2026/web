-- ============================================================================
-- POLICE LINES SCHOOL & COLLEGE, FARIDPUR — GRAND REUNION 2027
-- MIGRATION: 20270326000000_organizing_committee_database_sync.sql
-- DESCRIPTION: Establishes Supabase PostgreSQL tables, RLS policies, realtime
--              publication, and seeds for Organizing Committee CMS.
-- ============================================================================

-- 1. Table: organizing_committee_members
CREATE TABLE IF NOT EXISTS public.organizing_committee_members (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_bn TEXT,
  role TEXT NOT NULL,
  role_bn TEXT,
  description TEXT NOT NULL DEFAULT '',
  description_bn TEXT NOT NULL DEFAULT '',
  batch TEXT,
  image_url TEXT NOT NULL DEFAULT '',
  display_order INTEGER NOT NULL DEFAULT 1,
  phone TEXT,
  email TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexing for fast ordered queries and active filter
CREATE INDEX IF NOT EXISTS idx_org_committee_members_order
  ON public.organizing_committee_members (display_order ASC);

CREATE INDEX IF NOT EXISTS idx_org_committee_members_active
  ON public.organizing_committee_members (is_active);

-- 2. Table: organizing_committee_settings
CREATE TABLE IF NOT EXISTS public.organizing_committee_settings (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  display_mode TEXT NOT NULL DEFAULT 'carousel',
  auto_scroll_speed_ms INTEGER NOT NULL DEFAULT 3500,
  section_title_en TEXT NOT NULL DEFAULT 'Reunion 2027 Organizing Committee',
  section_title_bn TEXT NOT NULL DEFAULT 'পুনর্মিলনী ২০২৭ পরিচালনা পরিষদ',
  section_subtitle_en TEXT NOT NULL DEFAULT 'Joint organizing leadership by District Police Administration and Senior Alumni.',
  section_subtitle_bn TEXT NOT NULL DEFAULT 'জেলা পুলিশ প্রশাসন ও অ্যালামনাই নেতৃবৃন্দের সমন্বয়ে গঠিত পরিচালনা পর্ষদ।',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Row Level Security (RLS)
ALTER TABLE public.organizing_committee_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizing_committee_settings ENABLE ROW LEVEL SECURITY;

-- Members: public read access
DROP POLICY IF EXISTS "organizing_committee_members_select_all" ON public.organizing_committee_members;
CREATE POLICY "organizing_committee_members_select_all"
  ON public.organizing_committee_members
  FOR SELECT
  TO anon, authenticated, service_role
  USING (true);

-- Members: write access (admin & authenticated / service_role)
DROP POLICY IF EXISTS "organizing_committee_members_write_all" ON public.organizing_committee_members;
CREATE POLICY "organizing_committee_members_write_all"
  ON public.organizing_committee_members
  FOR ALL
  TO anon, authenticated, service_role
  USING (true)
  WITH CHECK (true);

-- Settings: public read access
DROP POLICY IF EXISTS "organizing_committee_settings_select_all" ON public.organizing_committee_settings;
CREATE POLICY "organizing_committee_settings_select_all"
  ON public.organizing_committee_settings
  FOR SELECT
  TO anon, authenticated, service_role
  USING (true);

-- Settings: write access
DROP POLICY IF EXISTS "organizing_committee_settings_write_all" ON public.organizing_committee_settings;
CREATE POLICY "organizing_committee_settings_write_all"
  ON public.organizing_committee_settings
  FOR ALL
  TO anon, authenticated, service_role
  USING (true)
  WITH CHECK (true);

-- Schema grants
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON public.organizing_committee_members TO anon, authenticated, service_role;
GRANT ALL ON public.organizing_committee_settings TO anon, authenticated, service_role;

-- 4. Enable Supabase Realtime for instant multi-device live sync
ALTER TABLE public.organizing_committee_members REPLICA IDENTITY FULL;
ALTER TABLE public.organizing_committee_settings REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.organizing_committee_members;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.organizing_committee_settings;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
END;
$$;

-- 5. Seed Singleton Settings
INSERT INTO public.organizing_committee_settings (
  id,
  display_mode,
  auto_scroll_speed_ms,
  section_title_en,
  section_title_bn,
  section_subtitle_en,
  section_subtitle_bn
) VALUES (
  'singleton',
  'carousel',
  3500,
  'Reunion 2027 Organizing Committee',
  'পুনর্মিলনী ২০২৭ পরিচালনা পরিষদ',
  'Joint organizing leadership by District Police Administration and Senior Alumni.',
  'জেলা পুলিশ প্রশাসন ও অ্যালামনাই নেতৃবৃন্দের সমন্বয়ে গঠিত পরিচালনা পর্ষদ।'
)
ON CONFLICT (id) DO NOTHING;

-- 6. Seed Default 16 Committee Members
INSERT INTO public.organizing_committee_members (
  id, name, name_bn, role, role_bn, description, description_bn, batch, image_url, display_order, is_active
) VALUES
  (
    'COM-01',
    'Dr. M. A. Kashem',
    'ড. এম. এ. কাশেম',
    'Convenor (আহ্বায়ক)',
    'আহ্বায়ক',
    '1974 SSC Batch • Senior Civil Servant',
    '১৯৭৪ এসএসসি ব্যাচ • সাবেক সচিব',
    '1974',
    'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300&auto=format&fit=crop&q=80',
    1,
    true
  ),
  (
    'COM-02',
    'Superintendent of Police',
    'পুলিশ সুপার, ফরিদপুর',
    'Chief Patron (প্রধান পৃষ্ঠপোষক)',
    'প্রধান পৃষ্ঠপোষক',
    'Faridpur District Police Administration',
    'ফরিদপুর জেলা পুলিশ প্রশাসন',
    'Administration',
    'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=300&auto=format&fit=crop&q=80',
    2,
    true
  ),
  (
    'COM-03',
    'Prof. Anwara Begum',
    'প্রফেসর আনোয়ার বেগম',
    'Faculty Advisor (উপদেষ্টা)',
    'উপদেষ্টা',
    'Former Principal, Police Lines College',
    'সাবেক অধ্যক্ষ, পুলিশ লাইন্স কলেজ',
    'Faculty',
    'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=300&auto=format&fit=crop&q=80',
    3,
    true
  ),
  (
    'COM-04',
    'Md. Shafiqul Alam',
    'মো. শফিকুল আলম',
    'Member Secretary (সদস্য সচিব)',
    'সদস্য সচিব',
    '1988 SSC Batch • Alumni Association',
    '১৯৮৮ এসএসসি ব্যাচ • অ্যালামনাই অ্যাসোসিয়েশন',
    '1988',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80',
    4,
    true
  ),
  (
    'COM-05',
    'Engr. Kazi Mahbubur Rahman',
    'প্রকৌশলী কাজী মাহবুবুর রহমান',
    'Joint Convenor (যুগ্ম আহ্বায়ক)',
    'যুগ্ম আহ্বায়ক',
    '1982 SSC Batch • Chief Engineer (Rtd.)',
    '১৯৮২ এসএসসি ব্যাচ • সাবেক প্রধান প্রকৌশলী',
    '1982',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop&q=80',
    5,
    true
  ),
  (
    'COM-06',
    'Advocate Farzana Yasmin',
    'অ্যাডভোকেট ফারজানা ইয়াসমিন',
    'Legal & Protocol Advisor (আইন ও প্রটোকল)',
    'আইন ও প্রটোকল বিষয়ক সম্পাদক',
    '1985 SSC Batch • District Bar Association',
    '১৯৮৫ এসএসসি ব্যাচ • জেলা আইনজীবী সমিতি',
    '1985',
    'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&auto=format&fit=crop&q=80',
    6,
    true
  ),
  (
    'COM-07',
    'Brigadier General (Rtd.) Shamsul Huda',
    'ব্রিগেডিয়ার জেনারেল (অব.) শামসুল হুদা',
    'Chief Security Advisor (নিরাপত্তা ও শৃঙ্খলা)',
    'নিরাপত্তা ও শৃঙ্খলা সমন্বয়ক',
    '1978 SSC Batch • Veteran Alumni',
    '১৯৭৮ এসএসসি ব্যাচ • প্রবীণ অ্যালামনাই',
    '1978',
    'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=300&auto=format&fit=crop&q=80',
    7,
    true
  ),
  (
    'COM-08',
    'Dr. Tanveer Ahmed',
    'ডা. তানভীর আহমেদ',
    'Medical & Welfare Secretary (চিকিৎসা ও কল্যাণ)',
    'চিকিৎসা ও কল্যাণ সম্পাদক',
    '1992 SSC Batch • Associate Professor, FMCH',
    '১৯৯২ এসএসসি ব্যাচ • সহযোগী অধ্যাপক, এফএমসিএইচ',
    '1992',
    'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=300&auto=format&fit=crop&q=80',
    8,
    true
  ),
  (
    'COM-09',
    'Syed Nazrul Islam',
    'সৈয়দ নজরুল ইসলাম',
    'Finance Secretary (অর্থ ও হিসাব সম্পাদক)',
    'অর্থ ও হিসাব সম্পাদক',
    '1989 SSC Batch • Head of Treasury, Bank',
    '১৯৮৯ এসএসসি ব্যাচ • বিভাগীয় প্রধান, কমার্শিয়াল ব্যাংক',
    '1989',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80',
    9,
    true
  ),
  (
    'COM-10',
    'Nasreen Akter Banu',
    'নাসরিন আক্তার বানু',
    'Cultural Secretary (সাংস্কৃতিক ও সংবর্ধনা)',
    'সাংস্কৃতিক ও সংবর্ধনা সম্পাদক',
    '1994 SSC Batch • Cultural Activist & Educator',
    '১৯৯৪ এসএসসি ব্যাচ • সংস্কৃতিসেবী ও শিক্ষক',
    '1994',
    'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?w=300&auto=format&fit=crop&q=80',
    10,
    true
  ),
  (
    'COM-11',
    'Mirza Golam Rabbani',
    'মির্জা গোলাম রব্বানী',
    'IT & Registration Lead (নিবন্ধন ও প্রযুক্তি)',
    'নিবন্ধন ও প্রযুক্তি সমন্বয়ক',
    '2002 SSC Batch • Enterprise Software Architect',
    '২০০২ এসএসসি ব্যাচ • এন্টারপ্রাইজ সফটওয়্যার স্থপতি',
    '2002',
    'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300&auto=format&fit=crop&q=80',
    11,
    true
  ),
  (
    'COM-12',
    'Tahmina Sultana',
    'তাহমিনা সুলতানা',
    'Souvenir & Publication (স্মরণিকা ও প্রকাশনা)',
    'স্মরণিকা ও প্রকাশনা সম্পাদক',
    '1996 SSC Batch • Senior Journalist & Writer',
    '১৯৯৬ এসএসসি ব্যাচ • জ্যেষ্ঠ সাংবাদিক ও লেখক',
    '1996',
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&auto=format&fit=crop&q=80',
    12,
    true
  ),
  (
    'COM-13',
    'Kamrul Hasan Jewel',
    'কামরুল হাসান জুয়েল',
    'Food & Catering Lead (খাদ্য ও আপ্যায়ন)',
    'খাদ্য ও আপ্যায়ন সম্পাদক',
    '1998 SSC Batch • Hospitality Entrepreneur',
    '১৯৯৮ এসএসসি ব্যাচ • আতিথেয়তা উদ্যোক্তা',
    '1998',
    'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=300&auto=format&fit=crop&q=80',
    13,
    true
  ),
  (
    'COM-14',
    'Asaduzzaman Ripon',
    'আসাদুজ্জামান রিপন',
    'Logistics & Venue (লজিস্টিকস ও ভেন্যু)',
    'লজিস্টিকস ও ভেন্যু সম্পাদক',
    '1995 SSC Batch • Event Management Specialist',
    '১৯৯৫ এসএসসি ব্যাচ • ইভেন্ট ম্যানেজমেন্ট বিশেষজ্ঞ',
    '1995',
    'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=300&auto=format&fit=crop&q=80',
    14,
    true
  ),
  (
    'COM-15',
    'Rezaul Karim Babul',
    'রেজাউল করিম বাবুল',
    'Public Relations & Media (জনসংযোগ ও গণমাধ্যম)',
    'জনসংযোগ ও গণমাধ্যম সমন্বয়ক',
    '1991 SSC Batch • Senior News Editor',
    '১৯৯১ এসএসসি ব্যাচ • জ্যেষ্ঠ বার্তা সম্পাদক',
    '1991',
    'https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?w=300&auto=format&fit=crop&q=80',
    15,
    true
  ),
  (
    'COM-16',
    'Mahmudul Hasan Shuvo',
    'মাহমুদুল হাসান শুভ',
    'Youth & Volunteers Lead (যুব ও স্বেচ্ছাসেবক)',
    'যুব ও স্বেচ্ছাসেবক সমন্বয়ক',
    '2012 SSC Batch • Alumni Volunteer Brigade Lead',
    '২০১২ এসএসসি ব্যাচ • অ্যালামনাই স্বেচ্ছাসেবী দলনেতা',
    '2012',
    'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300&auto=format&fit=crop&q=80',
    16,
    true
  )
ON CONFLICT (id) DO NOTHING;
