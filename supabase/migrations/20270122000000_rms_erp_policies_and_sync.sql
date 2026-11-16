-- ============================================================================
-- POLICE LINES SCHOOL & COLLEGE REUNION 2027
-- RMS ERP ACCESS & SYNC POLICIES
-- Migration: 20270122000000_rms_erp_policies_and_sync.sql
-- ============================================================================

-- Ensure authenticated staff and administrators can manage RMS committees
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'rms_committees' AND policyname = 'Staff manage committees'
  ) THEN
    CREATE POLICY "Staff manage committees" ON public.rms_committees
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'rms_announcements' AND policyname = 'Staff manage announcements'
  ) THEN
    CREATE POLICY "Staff manage announcements" ON public.rms_announcements
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;


-- Seed the 12 dynamic committees into rms_committees
INSERT INTO public.rms_committees (
  id, name_en, name_bn, description_en, description_bn, director_id,
  director_name, director_phone, director_email, assistant_director_names,
  assigned_responsibilities, budget_total, budget_allocated, budget_spent,
  is_active, meeting_day, created_at, updated_at
) VALUES
  ('publicity-publication', 'Publicity & Publication', 'প্রচার ও প্রকাশনা উপকমিটি', 'Responsible for souvenirs, press releases, social campaigns, hoardings, and printing collateral.', 'স্মরণিকা প্রকাশনা, প্রেস রিলিজ, সামাজিক যোগাযোগ প্রচার এবং ব্যানার-ফেস্টুন ব্যবস্থাপনা।', 'DIR-PUB-01', 'Ashiqur Rahman', '01712111111', 'publicity@policelines.edu.bd', ARRAY['Tanvir Ahmed'], ARRAY['Souvenir printing', 'Brochures', 'Media press releases'], 300000, 250000, 75000, true, 'Every Tuesday 6:00 PM', NOW(), NOW()),
  ('media-digital', 'Media & Digital Communication', 'মিডিয়া ও ডিজিটাল যোগাযোগ উপকমিটি', 'Manages website, digital broadcasts, live streams, photography, and multimedia assets.', 'ওয়েবসাইট ব্যবস্থাপনা, লাইভ স্ট্রিমিং, ফটোগ্রাফি ও মাল্টিমিডিয়া সমন্বয়।', 'DIR-MED-01', 'Fahim Morshed', '01712222222', 'media@policelines.edu.bd', ARRAY['Nayeem Islam'], ARRAY['Website uptime', 'Live camera stream', 'Social media broadcast'], 250000, 200000, 60000, true, 'Every Wednesday 7:00 PM', NOW(), NOW()),
  ('rally-procession', 'Rally & Procession', 'বর্ণাঢ্য র‍্যালি ও শোভাযাত্রা উপকমিটি', 'Organizes the grand morning alumni procession with festive carriages, bands, and security coordination.', 'বর্ণাঢ্য শোভাযাত্রা, ব্যান্ড পার্টি, ঘোড়ার গাড়ি ও শোভাযাত্রা রুট সমন্বয়।', 'DIR-RAL-01', 'Mahbubur Rahman', '01712333333', 'rally@policelines.edu.bd', ARRAY['Ariful Islam'], ARRAY['Rally route planning', 'Band party booking', 'Police route escort'], 200000, 180000, 40000, true, 'Every Thursday 5:30 PM', NOW(), NOW()),
  ('registration-database', 'Registration & Database', 'রেজিস্ট্রেশন ও ডেটাবেজ উপকমিটি', 'Headed by Sagar. Authoritative for online student intake, student ID verification, PayStation settlement, and QR passes.', 'পরিচালক সাগর। অনলাইন রেজিস্ট্রেশন, স্টুডেন্ট আইডি যাচাই, পেস্টেশন লেনদেন ও ডিজিটাল টিকিট ডেটাবেজ।', 'USR-DIR-REGISTRATION', 'Sagar', '01711000005', 'sagar@policelines.edu.bd', ARRAY['Mustafa Kamal'], ARRAY['Student validation', 'PayStation reconciliation', 'QR generation', 'ID cards'], 400000, 350000, 120000, true, 'Every Monday 6:30 PM', NOW(), NOW()),
  ('finance-accounts', 'Finance & Accounts', 'অর্থ ও হিসাব উপকমিটি', 'Maintains bank accounts, ledger entries, voucher audit, budget allocations, and transparent balance sheets.', 'আয়-ব্যয় অডিট, বাজেট বরাদ্দ, ব্যাংক একাউন্ট ও ভাউচার সমন্বয়।', 'DIR-FIN-01', 'Zahirul Haque', '01712555555', 'finance@policelines.edu.bd', ARRAY['Mizanur Rahman'], ARRAY['Voucher audit', 'Bank reconciliation', 'Budget approvals'], 150000, 120000, 30000, true, 'Every Saturday 11:00 AM', NOW(), NOW()),
  ('sponsorship-partnership', 'Sponsorship & Partnership', 'স্পন্সরশিপ ও পার্টনারশিপ উপকমিটি', 'Corporate outreach, title sponsors, partner stalls, merchandise co-branding, and donation drives.', 'কর্পোরেট স্পন্সরশিপ সংগ্রহ, স্টল বরাদ্দ ও পার্টনারশিপ বেনিফিট তদারকি।', 'DIR-SPO-01', 'Nasir Uddin', '01712666666', 'sponsorship@policelines.edu.bd', ARRAY['Rezaul Karim'], ARRAY['Corporate proposals', 'Sponsor benefit checklist', 'Donation outreach'], 200000, 150000, 45000, true, 'Every Sunday 5:00 PM', NOW(), NOW()),
  ('food-catering', 'Food & Catering', 'আপ্যায়ন ও খাবার উপকমিটি', 'Full hospitality for 10,000+ attendees: breakfast, grand lunch banquet, and evening refreshments.', '১০,০০০+ অংশগ্রহণকারীর সকালের নাস্তা, ঐতিহ্যবাহী গ্র্যান্ড মধ্যাহ্নভোজ ও সান্ধ্যকালীন খাবার ব্যবস্থাপনা।', 'DIR-FOD-01', 'Anisur Rahman', '01712777777', 'catering@policelines.edu.bd', ARRAY['Shahidul Islam'], ARRAY['Caterer contracts', 'Meal tokens', 'Hygiene oversight', 'Buffet flow'], 1500000, 1200000, 450000, true, 'Every Monday 5:00 PM', NOW(), NOW()),
  ('cultural-affairs', 'Cultural Affairs', 'সাংস্কৃতিক বিষয়ক উপকমিটি', 'Coordinates the Jan 28 evening Qawwali, musical band segments, drama, recitation, and sound engineering.', '২৮ জানুয়ারি সান্ধ্যকালীন কাওয়ালি অনুষ্ঠান, ব্যান্ড সঙ্গীত ও সাংস্কৃতিক অনুষ্ঠান সমন্বয়।', 'DIR-CUL-01', 'Farhana Yasmin', '01712888888', 'culture@policelines.edu.bd', ARRAY['Rashed Khan'], ARRAY['Qawwali artist booking', 'Band lineup', 'Sound check schedule'], 600000, 500000, 180000, true, 'Every Tuesday 7:30 PM', NOW(), NOW()),
  ('event-production', 'Event Management & Production', 'ইভেন্ট ম্যানেজমেন্ট ও প্রোডাকশন উপকমিটি', 'Oversees main stage construction, LED walls, acoustic rigging, drone coverage, and master schedule flow.', 'মূল মঞ্চ নির্মাণ, বিশাল এলইডি স্ক্রিন, লাইটিং ও প্রোডাকশন সামগ্রী নিয়ন্ত্রণ।', 'DIR-PRO-01', 'Tariqul Islam', '01712999999', 'production@policelines.edu.bd', ARRAY['Jahangir Alam'], ARRAY['Stage delivery', 'LED screens', 'Acoustic setup', 'Live production'], 800000, 700000, 280000, true, 'Every Wednesday 5:00 PM', NOW(), NOW()),
  ('hospitality-protocol', 'Hospitality & Protocol', 'অতিথি আপ্যায়ন ও প্রটোকল উপকমিটি', 'VIP reception, retired faculty escort, memorabilia kits, guest lounge, and transportation protocol.', 'প্রধান অতিথি, বরেণ্য শিক্ষক ও ভিআইপিদের উষ্ণ সংবর্ধনা, প্রটোকল ও লজিস্টিকস সহায়তা।', 'DIR-HOS-01', 'Nazrul Islam', '01712000001', 'protocol@policelines.edu.bd', ARRAY['Asaduzzaman'], ARRAY['VIP transportation', 'Faculty escort', 'VIP lounge'], 300000, 250000, 65000, true, 'Every Thursday 6:00 PM', NOW(), NOW()),
  ('security-discipline', 'Security & Discipline', 'নিরাপত্তা ও শৃঙ্খলা উপকমিটি', 'Police administration liaison, access gate security, CCTV grid, vehicle parking, and emergency protocols.', 'জেলা পুলিশ প্রশাসন লিয়াজোঁ, প্রবেশপথ নিরাপত্তা, সিসিটিভি নজরদারি ও শৃঙ্খলা রক্ষা।', 'DIR-SEC-01', 'Inspector Golam Mostafa', '01712000002', 'security@policelines.edu.bd', ARRAY['Sub-Inspector Rafiqul Islam'], ARRAY['Gate scanners security', 'CCTV monitoring', 'Parking control'], 350000, 300000, 90000, true, 'Every Friday 4:00 PM', NOW(), NOW()),
  ('venue-decoration', 'Venue & Decoration', 'ভেন্যু প্রস্তুতি ও সাজসজ্জা উপকমিটি', 'Campus illumination, grand entrance arch, alumni photo walls, shamiana canopy, and thematic branding.', 'স্কুল ক্যাম্পাস ও পুলিশ লাইন্স মাঠের আলোকসজ্জা, তোরণ, ফটোজোন ও প্যান্ডেল নির্মাণ।', 'DIR-VEN-01', 'Khaled Saifullah', '01712000003', 'venue@policelines.edu.bd', ARRAY['Sajid Hasan'], ARRAY['Pandal canopy', 'Lighting design', 'Entrance archways'], 500000, 450000, 160000, true, 'Every Saturday 5:30 PM', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
  name_en = EXCLUDED.name_en,
  name_bn = EXCLUDED.name_bn,
  description_en = EXCLUDED.description_en,
  description_bn = EXCLUDED.description_bn,
  director_name = EXCLUDED.director_name,
  director_phone = EXCLUDED.director_phone,
  director_email = EXCLUDED.director_email,
  assistant_director_names = EXCLUDED.assistant_director_names,
  assigned_responsibilities = EXCLUDED.assigned_responsibilities,
  budget_total = EXCLUDED.budget_total,
  budget_allocated = EXCLUDED.budget_allocated,
  budget_spent = EXCLUDED.budget_spent,
  is_active = EXCLUDED.is_active,
  meeting_day = EXCLUDED.meeting_day,
  updated_at = NOW();
