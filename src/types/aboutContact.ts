export interface AboutObjectiveItem {
  id: string;
  titleEn: string;
  titleBn: string;
  descriptionEn: string;
  descriptionBn: string;
}

export interface AboutContactContent {
  id: string;
  // Hero / Overview Header
  institutionSubtitleEn: string;
  institutionSubtitleBn: string;
  aboutHeadingEn: string;
  aboutHeadingBn: string;
  taglineEn: string;
  taglineBn: string;

  // Institutional History Section
  historyTitleEn: string;
  historyTitleBn: string;
  historyContentEn: string;
  historyContentBn: string;
  locationLabelEn: string;
  locationLabelBn: string;
  locationValueEn: string;
  locationValueBn: string;
  affiliationLabelEn: string;
  affiliationLabelBn: string;
  affiliationValueEn: string;
  affiliationValueBn: string;
  patronLabelEn: string;
  patronLabelBn: string;
  patronValueEn: string;
  patronValueBn: string;
  campusImageUrl: string;

  // Core Objectives Section
  objectivesHeadingEn: string;
  objectivesHeadingBn: string;
  objectives: AboutObjectiveItem[];

  // Direct Contact & Secretariat Section
  contactBadgeEn: string;
  contactBadgeBn: string;
  helpdeskTitleEn: string;
  helpdeskTitleBn: string;
  helpdeskSubtitleEn: string;
  helpdeskSubtitleBn: string;
  addressEn: string;
  addressBn: string;
  helplinePhoneEn: string;
  helplinePhoneBn: string;
  helplineEmail: string;
  showInquiryForm: boolean;

  // Metadata
  updatedBy?: string;
  updatedAt?: string;
}

export const DEFAULT_ABOUT_CONTACT_CONTENT: AboutContactContent = {
  id: 'singleton',
  institutionSubtitleEn: 'Established in 1962 • Faridpur, Bangladesh',
  institutionSubtitleBn: 'প্রতিষ্ঠিত: ১৯৬২ • ফরিদপুর, বাংলাদেশ',
  aboutHeadingEn: 'About Police Lines School and College, Faridpur',
  aboutHeadingBn: 'পুলিশ লাইন্স স্কুল অ্যান্ড কলেজ, ফরিদপুর পরিচিতি',
  taglineEn: 'Connecting Generations, Celebrating 65 Years of Excellence',
  taglineBn: 'প্রজন্মের মেলবন্ধন, গৌরবের ৬৫ বছর উদ্‌যাপন',

  historyTitleEn: '65 Years of Knowledge & Discipline (Est. 1962)',
  historyTitleBn: 'শিক্ষা ও শৃঙ্খলার ৬৫ বছর (স্থাপিত ১৯৬২)',
  historyContentEn:
    'Established in 1962 under the patronage of the Faridpur District Police Administration, Police Lines School and College has stood as a bastion of academic excellence, physical discipline, and moral character in the Padma-Ganges basin. For over six decades, our alumni have served Bangladesh with distinction across civil service, armed forces, medicine, engineering, arts, and enterprise.',
  historyContentBn:
    '১৯৬২ সালে ফরিদপুর জেলা পুলিশ প্রশাসনের উদ্যোগে পদ্মা-কুমার অববাহিকায় প্রতিষ্ঠিত পুলিশ লাইন্স স্কুল অ্যান্ড কলেজ দেশের অন্যতম ঐতিহ্যবাহী শিক্ষা প্রতিষ্ঠান। ছয় দশকেরও বেশি সময় ধরে শৃঙ্খলা, নীতি ও আদর্শ শিক্ষার মাধ্যমে প্রতিষ্ঠানটি তৈরি করেছে দেশসেরা গবেষক, চিকিৎসক, প্রকৌশলী, প্রতিরক্ষা কর্মকর্তা ও প্রাজ্ঞ ব্যক্তিবর্গ।',

  locationLabelEn: 'Location',
  locationLabelBn: 'অবস্থান',
  locationValueEn: 'Police Lines area in Kamlapur, Faridpur Sadar, Faridpur-7800',
  locationValueBn: 'পুলিশ লাইনস এলাকা, কমলাপুর, ফরিদপুর সদর, ফরিদপুর-৭৮০০',
  affiliationLabelEn: 'Affiliation',
  affiliationLabelBn: 'অধিভুক্তি',
  affiliationValueEn: 'Board of Intermediate & Secondary Education, Dhaka',
  affiliationValueBn: 'মাধ্যমিক ও উচ্চ মাধ্যমিক শিক্ষা বোর্ড, ঢাকা',
  patronLabelEn: 'Patron',
  patronLabelBn: 'পৃষ্ঠপোষক',
  patronValueEn: 'Faridpur District Police Force',
  patronValueBn: 'ফরিদপুর জেলা পুলিশ প্রশাসন',
  campusImageUrl:
    'https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?w=800&auto=format&fit=crop&q=80',

  objectivesHeadingEn: 'Reunion 2027 Core Objectives',
  objectivesHeadingBn: 'পুনর্মিলনী ২০২৭-এর মূল উদ্দেশ্য',
  objectives: [
    {
      id: 'obj-1',
      titleEn: '1. Cross-Generation Network',
      titleBn: '১. প্রাক্তন ও বর্তমানের মেলবন্ধন',
      descriptionEn:
        'Uniting alumni across civil service, defense, medicine, technology, academia and commerce with current students.',
      descriptionBn:
        '১৯৬২ থেকে ২০২৫ সাল পর্যন্ত সকল ব্যাচের শিক্ষার্থীদের মধ্যে পেশাগত ও ভ্রাতৃত্বপূর্ণ সুসম্পর্ক সৃষ্টি করা।',
    },
    {
      id: 'obj-2',
      titleEn: '2. Campus Modernization',
      titleBn: '২. ক্যাম্পাস ও ল্যাব আধুনিকায়ন',
      descriptionEn:
        'Directing reunion development funds towards modern science laboratories, robotics clubs, and smart classrooms.',
      descriptionBn:
        'সংগৃহীত অনুদানের মাধ্যমে অত্যাধুনিক বিজ্ঞান গবেষণাগার, স্মার্ট ক্লাসরুম ও কেন্দ্রীয় লাইব্রেরির আধুনিকায়ন।',
    },
    {
      id: 'obj-3',
      titleEn: '3. Student Welfare & Trust',
      titleBn: '৩. অসচ্ছল শিক্ষার্থী কল্যাণ তহবিল',
      descriptionEn:
        'Establishing a perpetual scholarship endowment fund for underprivileged meritorious students.',
      descriptionBn:
        'মেধাবী অথচ আর্থিক সংকটে থাকা শিক্ষার্থীদের শিক্ষাবৃত্তি ও চিকিৎসা সহায়তা প্রদানে স্থায়ী ট্রাস্ট গঠন।',
    },
  ],

  contactBadgeEn: 'Direct Contact',
  contactBadgeBn: 'সরাসরি যোগাযোগ',
  helpdeskTitleEn: 'Reunion Secretariat & Helpdesk',
  helpdeskTitleBn: 'পুনর্মিলনী সচিবালয় ও হেল্পডেস্ক',
  helpdeskSubtitleEn:
    'Reach out to the Reunion secretariat team for queries, gate passes or batch coordination.',
  helpdeskSubtitleBn:
    'যেকোনো জিজ্ঞাসা, টিকিট সংক্রান্ত সমস্যা বা সহায়তার জন্য যোগাযোগ করুন।',
  addressEn: 'Police Lines area in Kamlapur, Faridpur Sadar, Faridpur-7800',
  addressBn: 'পুলিশ লাইনস এলাকা, কমলাপুর, ফরিদপুর সদর, ফরিদপুর-৭৮০০',
  helplinePhoneEn: '+880 1637-85 7040 / +880 1309-026240',
  helplinePhoneBn: '+৮৮০ ১৬৩৭-৮৫ ৭০৪০ / +৮৮০ ১৩০৯-০২৬২৪০',
  helplineEmail: 'sagarsaha3371@gmail.com',
  showInquiryForm: true,
  updatedBy: 'System Default',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
