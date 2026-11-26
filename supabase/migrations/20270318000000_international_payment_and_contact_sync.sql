-- ============================================================================
-- Migration: Update Contact Details to Kamlapur/Faridpur-7800, 65 Years, &
-- Enable Public Read + Seed for International Payment Page CMS Settings
-- ============================================================================

-- 1. Update system_settings public read RLS so visitors can read international_payment_info
DROP POLICY IF EXISTS "system_settings_public_read_safe" ON public.system_settings;
CREATE POLICY "system_settings_public_read_safe"
ON public.system_settings
FOR SELECT
USING (key IN ('portal_fee_settings', 'international_payment_info'));

-- 2. Seed initial international_payment_info if not yet present (never overwrite edits)
INSERT INTO public.system_settings (key, value, updated_by, updated_at)
VALUES (
  'international_payment_info',
  jsonb_build_object(
    'isEnabled', true,
    'badgeEn', 'International Remittance & Wire Transfer',
    'badgeBn', 'আন্তর্জাতিক পেমেন্ট ও ব্যাংক রেমিট্যান্স',
    'titleEn', 'International Payment Details',
    'titleBn', 'আন্তর্জাতিক পেমেন্ট তথ্য',
    'subtitleEn', 'For alumni, well-wishers, and donors contributing from outside Bangladesh via international bank transfer or remittance.',
    'subtitleBn', 'বাংলাদেশের বাইরে অবস্থানরত প্রাক্তন শিক্ষার্থী ও শুভাকাঙ্ক্ষীদের জন্য আন্তর্জাতিক ব্যাংক ট্রান্সফার বা রেমিট্যান্সের মাধ্যমে অনুদান ও পেমেন্টের তথ্য।',
    'eventTitleEn', 'Police Lines School & College, Faridpur — Grand Reunion 2027 (65 Years Celebration)',
    'eventTitleBn', 'পুলিশ লাইন্স স্কুল অ্যান্ড কলেজ, ফরিদপুর — গ্র্যান্ড পুনর্মিলনী ২০২৭ (৬৫ বছর পূর্তি)',
    'bankName', 'Sonali Bank PLC',
    'branchName', 'Faridpur Corporate Branch',
    'branchAddress', 'Faridpur Sadar, Faridpur-7800, Bangladesh',
    'accountName', 'PLSCF Reunion Organizing Committee',
    'accountNumber', 'Update from Super Admin Portal',
    'routingNumber', 'Update from Super Admin Portal',
    'swiftCode', 'BSONBDDH',
    'mobileNumber', '+880 1637-85 7040 / +880 1309-026240',
    'contactEmail', 'sagarsaha3371@gmail.com',
    'instructionsEn', E'1. Use the bank account, routing number, and SWIFT code above for international wire or remittance.\n2. Mention your Full Name, SSC/HSC Batch Year, Mobile/WhatsApp Number, and Purpose (Registration or Donation) in the transfer reference.\n3. After completing the transfer, send a screenshot or bank slip to WhatsApp (+880 1637-85 7040 / +880 1309-026240) or email (sagarsaha3371@gmail.com) for verification and receipt.',
    'instructionsBn', E'১. আন্তর্জাতিক ব্যাংক ট্রান্সফার বা রেমিট্যান্স পাঠাতে উপরের ব্যাংক অ্যাকাউন্ট নম্বর, রাউটিং নম্বর এবং সুইফট কোড ব্যবহার করুন।\n২. ট্রান্সফার রেফারেন্সে আপনার পূর্ণ নাম, ব্যাচ/পাসের সন, মোবাইল/হোয়াটসঅ্যাপ নম্বর এবং উদ্দেশ্য (রেজিস্ট্রেশন বা অনুদান) উল্লেখ করুন।\n৩. লেনদেন সম্পন্ন করার পর নিশ্চিতকরণ ও রসিদের জন্য ট্রান্সফার স্লিপ বা স্ক্রিনশট +880 1637-85 7040 / +880 1309-026240 (WhatsApp) অথবা sagarsaha3371@gmail.com ইমেইলে পাঠান।',
    'footerNoteEn', 'Verified international transfers are recorded in the central reunion financial ledger and receive an official confirmation.',
    'footerNoteBn', 'যাচাইকৃত আন্তর্জাতিক ট্রান্সফারসমূহ কেন্দ্রীয় পুনর্মিলনী আর্থিক লেজারে সংরক্ষণ করা হয় এবং অফিসিয়াল নিশ্চিতকরণ প্রদান করা হয়।',
    'updatedBy', 'System Seed',
    'updatedAt', NOW()
  ),
  'System Migration',
  NOW()
)
ON CONFLICT (key) DO NOTHING;

-- 3. Sync official Kamlapur address, 65 Years title, phone numbers & sagarsaha3371@gmail.com in about_contact_content
UPDATE public.about_contact_content
SET history_title_en   = '65 Years of Knowledge & Discipline (Est. 1962)',
    history_title_bn   = 'শিক্ষা ও শৃঙ্খলার ৬৫ বছর (স্থাপিত ১৯৬২)',
    location_value_en  = 'Police Lines area in Kamlapur, Faridpur Sadar, Faridpur-7800',
    location_value_bn  = 'পুলিশ লাইনস এলাকা, কমলাপুর, ফরিদপুর সদর, ফরিদপুর-৭৮০০',
    address_en         = 'Police Lines area in Kamlapur, Faridpur Sadar, Faridpur-7800',
    address_bn         = 'পুলিশ লাইনস এলাকা, কমলাপুর, ফরিদপুর সদর, ফরিদপুর-৭৮০০',
    helpline_phone_en  = '+880 1637-85 7040 / +880 1309-026240',
    helpline_phone_bn  = '+৮৮০ ১৬৩৭-৮৫ ৭০৪০ / +৮৮০ ১৩০৯-০২৬২৪০',
    helpline_email     = 'sagarsaha3371@gmail.com',
    updated_at         = NOW()
WHERE id = 'singleton';
