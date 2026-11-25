-- ============================================================================
-- POLICE LINES SCHOOL & COLLEGE, FARIDPUR — GRAND REUNION 2027
-- MIGRATION: 20270308000000_about_contact_content_cms.sql
-- AUTHORITATIVE SCHEMA FOR REALTIME "ABOUT & CONTACT" PAGE CMS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.about_contact_content (
  id TEXT PRIMARY KEY DEFAULT 'singleton',

  -- Header / Overview
  institution_subtitle_en TEXT NOT NULL DEFAULT 'Established in 1962 • Faridpur, Bangladesh',
  institution_subtitle_bn TEXT NOT NULL DEFAULT 'প্রতিষ্ঠিত: ১৯৬২ • ফরিদপুর, বাংলাদেশ',
  about_heading_en TEXT NOT NULL DEFAULT 'About Police Lines School and College, Faridpur',
  about_heading_bn TEXT NOT NULL DEFAULT 'পুলিশ লাইন্স স্কুল অ্যান্ড কলেজ, ফরিদপুর পরিচিতি',
  tagline_en TEXT NOT NULL DEFAULT 'Connecting Generations, Celebrating 65 Years of Excellence',
  tagline_bn TEXT NOT NULL DEFAULT 'প্রজন্মের মেলবন্ধন, গৌরবের ৬৫ বছর উদ্‌যাপন',

  -- History Section
  history_title_en TEXT NOT NULL DEFAULT '64 Years of Knowledge & Discipline (Est. 1962)',
  history_title_bn TEXT NOT NULL DEFAULT 'শিক্ষা ও শৃঙ্খলার ৬৪ বছর (স্থাপিত ১৯৬২)',
  history_content_en TEXT NOT NULL DEFAULT 'Established in 1962 under the patronage of the Faridpur District Police Administration, Police Lines School and College has stood as a bastion of academic excellence, physical discipline, and moral character in the Padma-Ganges basin. For over six decades, our alumni have served Bangladesh with distinction across civil service, armed forces, medicine, engineering, arts, and enterprise.',
  history_content_bn TEXT NOT NULL DEFAULT '১৯৬২ সালে ফরিদপুর জেলা পুলিশ প্রশাসনের উদ্যোগে পদ্মা-কুমার অববাহিকায় প্রতিষ্ঠিত পুলিশ লাইন্স স্কুল অ্যান্ড কলেজ দেশের অন্যতম ঐতিহ্যবাহী শিক্ষা প্রতিষ্ঠান। ছয় দশকেরও বেশি সময় ধরে শৃঙ্খলা, নীতি ও আদর্শ শিক্ষার মাধ্যমে প্রতিষ্ঠানটি তৈরি করেছে দেশসেরা গবেষক, চিকিৎসক, প্রকৌশলী, প্রতিরক্ষা কর্মকর্তা ও প্রাজ্ঞ ব্যক্তিবর্গ।',
  location_label_en TEXT NOT NULL DEFAULT 'Location',
  location_label_bn TEXT NOT NULL DEFAULT 'অবস্থান',
  location_value_en TEXT NOT NULL DEFAULT 'Joyrampur, Faridpur Sadar, Dhaka Division',
  location_value_bn TEXT NOT NULL DEFAULT 'জয়রামপুর, ফরিদপুর সদর, ঢাকা বিভাগ',
  affiliation_label_en TEXT NOT NULL DEFAULT 'Affiliation',
  affiliation_label_bn TEXT NOT NULL DEFAULT 'অধিভুক্তি',
  affiliation_value_en TEXT NOT NULL DEFAULT 'Board of Intermediate & Secondary Education, Dhaka',
  affiliation_value_bn TEXT NOT NULL DEFAULT 'মাধ্যমিক ও উচ্চ মাধ্যমিক শিক্ষা বোর্ড, ঢাকা',
  patron_label_en TEXT NOT NULL DEFAULT 'Patron',
  patron_label_bn TEXT NOT NULL DEFAULT 'পৃষ্ঠপোষক',
  patron_value_en TEXT NOT NULL DEFAULT 'Faridpur District Police Force',
  patron_value_bn TEXT NOT NULL DEFAULT 'ফরিদপুর জেলা পুলিশ প্রশাসন',
  campus_image_url TEXT NOT NULL DEFAULT 'https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?w=800&auto=format&fit=crop&q=80',

  -- Core Objectives Section
  objectives_heading_en TEXT NOT NULL DEFAULT 'Reunion 2027 Core Objectives',
  objectives_heading_bn TEXT NOT NULL DEFAULT 'পুনর্মিলনী ২০২৭-এর মূল উদ্দেশ্য',
  objectives JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Direct Contact & Helpdesk Section
  contact_badge_en TEXT NOT NULL DEFAULT 'Direct Contact',
  contact_badge_bn TEXT NOT NULL DEFAULT 'সরাসরি যোগাযোগ',
  helpdesk_title_en TEXT NOT NULL DEFAULT 'Reunion Secretariat & Helpdesk',
  helpdesk_title_bn TEXT NOT NULL DEFAULT 'পুনর্মিলনী সচিবালয় ও হেল্পডেস্ক',
  helpdesk_subtitle_en TEXT NOT NULL DEFAULT 'Reach out to the Reunion secretariat team for queries, gate passes or batch coordination.',
  helpdesk_subtitle_bn TEXT NOT NULL DEFAULT 'যেকোনো জিজ্ঞাসা, টিকিট সংক্রান্ত সমস্যা বা সহায়তার জন্য যোগাযোগ করুন।',
  address_en TEXT NOT NULL DEFAULT 'Police Lines Road, Joyrampur, Faridpur - 7800, Dhaka Division, Bangladesh',
  address_bn TEXT NOT NULL DEFAULT 'পুলিশ লাইন্স রোড, জয়রামপুর, ফরিদপুর - ৭৮০০, ঢাকা বিভাগ, বাংলাদেশ',
  helpline_phone_en TEXT NOT NULL DEFAULT '+880 1712-345678 / +880 1911-876543',
  helpline_phone_bn TEXT NOT NULL DEFAULT '+৮৮০ ১৭১২-৩৪৫৬৭৮ / +৮৮০ ১৯১১-৮৭৬৫৪৩',
  helpline_email TEXT NOT NULL DEFAULT 'reunion2026@plscf.edu.bd',
  show_inquiry_form BOOLEAN NOT NULL DEFAULT true,

  -- Audit Metadata
  updated_by TEXT DEFAULT 'System Default',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed singleton default row
INSERT INTO public.about_contact_content (
  id,
  objectives
) VALUES (
  'singleton',
  '[
    {
      "id": "obj-1",
      "titleEn": "1. Cross-Generation Network",
      "titleBn": "১. প্রাক্তন ও বর্তমানের মেলবন্ধন",
      "descriptionEn": "Uniting alumni across civil service, defense, medicine, technology, academia and commerce with current students.",
      "descriptionBn": "১৯৬২ থেকে ২০২৫ সাল পর্যন্ত সকল ব্যাচের শিক্ষার্থীদের মধ্যে পেশাগত ও ভ্রাতৃত্বপূর্ণ সুসম্পর্ক সৃষ্টি করা।"
    },
    {
      "id": "obj-2",
      "titleEn": "2. Campus Modernization",
      "titleBn": "২. ক্যাম্পাস ও ল্যাব আধুনিকায়ন",
      "descriptionEn": "Directing reunion development funds towards modern science laboratories, robotics clubs, and smart classrooms.",
      "descriptionBn": "সংগৃহীত অনুদানের মাধ্যমে অত্যাধুনিক বিজ্ঞান গবেষণাগার, স্মার্ট ক্লাসরুম ও কেন্দ্রীয় লাইব্রেরির আধুনিকায়ন।"
    },
    {
      "id": "obj-3",
      "titleEn": "3. Student Welfare & Trust",
      "titleBn": "৩. অসচ্ছল শিক্ষার্থী কল্যাণ তহবিল",
      "descriptionEn": "Establishing a perpetual scholarship endowment fund for underprivileged meritorious students.",
      "descriptionBn": "মেধাবী অথচ আর্থিক সংকটে থাকা শিক্ষার্থীদের শিক্ষাবৃত্তি ও চিকিৎসা সহায়তা প্রদানে স্থায়ী ট্রাস্ট গঠন।"
    }
  ]'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- Row Level Security
ALTER TABLE public.about_contact_content ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "about_contact_content_select_all" ON public.about_contact_content;
CREATE POLICY "about_contact_content_select_all"
  ON public.about_contact_content
  FOR SELECT
  TO anon, authenticated, service_role
  USING (true);

DROP POLICY IF EXISTS "about_contact_content_write_all" ON public.about_contact_content;
CREATE POLICY "about_contact_content_write_all"
  ON public.about_contact_content
  FOR ALL
  TO anon, authenticated, service_role
  USING (true)
  WITH CHECK (true);

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON public.about_contact_content TO anon, authenticated, service_role;

-- Enable full replica identity & Supabase Realtime publication for immediate live sync
ALTER TABLE public.about_contact_content REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.about_contact_content;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
END;
$$;
