import {
  RegistrationRecord,
  StudentCategory,
  FeeSettings,
  ExpenseRecord,
  DonationRecord,
  CurrentStudentIdRecord,
  StudentIdVerificationResult,
} from '../types';

/**
 * Validates Bangladeshi mobile phone numbers:
 * Must start with 01 and be followed by valid operator code [3-9]
 * and exactly 8 more digits, making a total of 11 digits.
 * Accepts optional +88 or 88 country code prefix.
 */
export function isValidBangladeshiMobile(phone: string): boolean {
  if (!phone) return false;
  const cleaned = phone.replace(/[\s-]/g, '');
  const bdPhoneRegex = /^(?:\+?88)?01[3-9]\d{8}$/;
  return bdPhoneRegex.test(cleaned);
}

export function normalizeBangladeshiMobileNumber(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('880')) {
    return `0${digits.slice(3)}`;
  }
  if (digits.length === 10 && digits.startsWith('1')) {
    return `0${digits}`;
  }
  return digits;
}

/**
 * Checks whether a student is enrolled below Class 6 (Class 1-5, Play, Nursery, KG, etc.)
 * Supports raw numbers ("1".."5"), Roman numerals ("I".."V"), "Class 4", Bengali digits ("৪"),
 * and early childhood keywords.
 */
export function isStudentBelowClass6(className?: string | null): boolean {
  if (!className) return false;
  const clean = String(className).trim().toLowerCase();

  // Early childhood keywords
  if (/^(play|nursery|kg|kindergarten|pre|shishu|baby|infant)/i.test(clean)) return true;

  // Roman numerals I to V (with or without 'class', 'std', 'grade')
  if (/^(class\s*|std\s*|grade\s*)?(i|ii|iii|iv|v)$/i.test(clean)) return true;

  // Bengali digits ১, ২, ৩, ৪, ৫
  if (/[১-৫]/.test(clean)) return true;

  // Word forms
  if (/\b(one|two|three|four|five)\b/i.test(clean)) return true;

  // Extract number (e.g. '4', 'Class 4', 'Class-4', 'Grade 4', 'Std 4')
  const match = clean.match(/\d+/);
  if (match) {
    const classNum = parseInt(match[0], 10);
    if (classNum >= 1 && classNum <= 5) return true;
  }

  // Explicit fallback list
  return ['play', 'nursery', 'kg', '1', '2', '3', '4', '5', 'class 1', 'class 2', 'class 3', 'class 4', 'class 5'].includes(clean);
}

/**
 * Validates email addresses
 */
export function isValidEmail(email: string): boolean {
  if (!email || email.trim() === '') return true; // Optional: empty email is valid
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, { en: string; bn: string }>;
}

export interface RegistrationFormData {
  fullName: string;
  photoUrl: string;
  photoStoragePath?: string;
  mobileNumber: string;
  email?: string; // Optional: users can register without an email address
  address: string;
  gender?: 'male' | 'female';
  bloodGroup?: string;
  hasParent?: boolean;
  parentName?: string;
  parentAge?: number | string;
  parentPhone?: string;
  parentRelation?: string;
  parentFee?: number;
  parentPhotoUrl?: string;
  parentPhotoStoragePath?: string;
  gatewayCharge?: number;
  category: StudentCategory;
  studentId?: string; // Mandatory for current students
  passingYear?: string; // Mandatory for former students (Graduation / Last Attended Year)
  lastClassAttended?: string; // Optional for former students
  currentClass?: string; // Mandatory for current students
  batchName: string;
  groupOrSection?: string;
  rollNumber?: string;
  tShirtSize: string;
  donationAmount: number;
  termsAccepted: boolean;
}

export function validateRegistrationData(data: RegistrationFormData): ValidationResult {
  const errors: Record<string, { en: string; bn: string }> = {};

  if (!data.fullName || data.fullName.trim().length < 2) {
    errors.fullName = {
      en: 'Full name is required (minimum 2 characters)',
      bn: 'পূর্ণ নাম আবশ্যক (কমপক্ষে ২ অক্ষর)',
    };
  }

  if (!data.photoUrl || data.photoUrl.trim().length === 0) {
    errors.photoUrl = {
      en: 'Profile photograph is required for identity verification',
      bn: 'পরিচয় যাচাইয়ের জন্য প্রোফাইল ছবি আপলোড করা আবশ্যক',
    };
  }

  if (!data.mobileNumber || !isValidBangladeshiMobile(data.mobileNumber)) {
    errors.mobileNumber = {
      en: 'Please enter a valid 11-digit Bangladeshi mobile number starting with 01 (e.g. 017XXXXXXXX)',
      bn: 'অনুগ্রহ করে ০১ দিয়ে শুরু হওয়া সঠিক ১১ ডিজিটের বাংলাদেশি মোবাইল নম্বর দিন (যেমন: ০১৭XXXXXXXX)',
    };
  }

  // Email is OPTIONAL: only validate format if provided
  if (data.email && data.email.trim().length > 0) {
    if (!isValidEmail(data.email)) {
      errors.email = {
        en: 'Please enter a valid email address (e.g. name@example.com) or leave blank',
        bn: 'অনুগ্রহ করে একটি সঠিক ইমেইল ঠিকানা দিন অথবা ফাঁকা রাখুন',
      };
    }
  }

  // Blood group validation
  if (!data.bloodGroup || data.bloodGroup.trim().length === 0) {
    errors.bloodGroup = {
      en: 'Please select your blood group',
      bn: 'অনুগ্রহ করে আপনার রক্তের গ্রুপ নির্বাচন করুন',
    };
  }

  // Accompanying Parent validation (if enabled)
  if (data.hasParent) {
    if (!data.parentName || data.parentName.trim().length < 2) {
      errors.parentName = {
        en: 'Parent / Guardian full name is required (minimum 2 characters)',
        bn: 'অভিভাবকের পূর্ণ নাম আবশ্যক (কমপক্ষে ২ অক্ষর)',
      };
    }
    if (!data.parentPhotoUrl || data.parentPhotoUrl.trim().length === 0) {
      errors.parentPhotoUrl = {
        en: 'Parent / Guardian portrait photograph is required',
        bn: 'অভিভাবকের ছবি আপলোড করা আবশ্যক',
      };
    }
    if (!data.parentAge || String(data.parentAge).trim().length === 0) {
      errors.parentAge = {
        en: 'Parent / Guardian age is required',
        bn: 'অভিভাবকের বয়স উল্লেখ করা আবশ্যক',
      };
    }
    if (!data.parentPhone || !isValidBangladeshiMobile(data.parentPhone)) {
      errors.parentPhone = {
        en: 'Please enter a valid 11-digit mobile number for parent/guardian',
        bn: 'অভিভাবকের জন্য সঠিক ১১ ডিজিটের মোবাইল নম্বর প্রদান করুন',
      };
    }
    const ALLOWED_PARENT_RELATIONS = ['guardian', 'father', 'mother', 'sister', 'brother'];
    if (
      !data.parentRelation ||
      !ALLOWED_PARENT_RELATIONS.includes(data.parentRelation.trim().toLowerCase())
    ) {
      errors.parentRelation = {
        en: 'Please select relation with student (Guardian, Father, Mother, Sister, or Brother)',
        bn: 'শিক্ষার্থীর সাথে সম্পর্ক নির্বাচন করুন (অভিভাবক, পিতা, মাতা, বোন, বা ভাই)',
      };
    }
  }

  if (data.category === 'former') {
    if (!data.passingYear || data.passingYear.trim().length === 0) {
      errors.passingYear = {
        en: 'Graduation / Last Attended Year is required for former students',
        bn: 'প্রাক্তন শিক্ষার্থীদের জন্য পাস বা অধ্যয়নের শেষ বছর উল্লেখ করা আবশ্যক',
      };
    }
  } else if (data.category === 'current') {
    if (!data.studentId || data.studentId.trim().length === 0) {
      errors.studentId = {
        en: 'Student ID is mandatory for current students',
        bn: 'বর্তমান শিক্ষার্থীদের জন্য স্টুডেন্ট আইডি প্রদান আবশ্যক',
      };
    }
    if (!data.currentClass || data.currentClass.trim().length === 0) {
      errors.currentClass = {
        en: 'Current class is required for current students',
        bn: 'বর্তমান শিক্ষার্থীদের জন্য বর্তমান শ্রেণি উল্লেখ করা আবশ্যক',
      };
    }
  }

  if (!data.tShirtSize) {
    errors.tShirtSize = {
      en: 'Please select your T-shirt size',
      bn: 'অনুগ্রহ করে আপনার টি-শার্টের সাইজ নির্বাচন করুন',
    };
  }

  if (!data.termsAccepted) {
    errors.termsAccepted = {
      en: 'You must agree to the event policies and terms',
      bn: 'আপনাকে পুনর্মিলনী নীতি ও শর্তাবলীতে সম্মত হতে হবে',
    };
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Pure validation rule for Student ID Verification against administrative records
 */
export function verifyStudentIdAgainstRecords(
  studentId: string,
  records: CurrentStudentIdRecord[]
): StudentIdVerificationResult {
  const cleanId = (studentId || '').trim().toUpperCase();
  if (!cleanId) {
    return {
      success: false,
      status: 'NOT_FOUND',
      messageEn: 'Please enter a valid Student ID.',
      messageBn: 'অনুগ্রহ করে একটি সঠিক স্টুডেন্ট আইডি প্রদান করুন।',
    };
  }

  const match = records.find((r) => r.studentId.trim().toUpperCase() === cleanId);
  if (!match) {
    return {
      success: false,
      status: 'NOT_FOUND',
      messageEn: 'Student ID Not Found. Please check your ID or contact the Help Desk.',
      messageBn: 'স্টুডেন্ট আইডি খুঁজে পাওয়া যায়নি। অনুগ্রহ করে আপনার আইডি যাচাই করুন অথবা হেল্পডেস্কে যোগাযোগ করুন।',
    };
  }

  if (match.status === 'INACTIVE') {
    return {
      success: false,
      status: 'INACTIVE',
      messageEn: 'This Student ID Is Currently Inactive. Please contact the Help Desk.',
      messageBn: 'এই স্টুডেন্ট আইডিটি বর্তমানে নিষ্ক্রিয়। অনুগ্রহ করে হেল্পডেস্কে যোগাযোগ করুন।',
    };
  }

  if (match.verificationStatus === 'USED') {
    return {
      success: false,
      status: 'ALREADY_USED',
      messageEn: 'This Student ID Is Already Taken.',
      messageBn: 'এই স্টুডেন্ট আইডিটি দিয়ে ইতোমধ্যে সফলভাবে নিবন্ধন সম্পন্ন হয়েছে।',
    };
  }

  if (match.verificationStatus === 'RESERVED') {
    // If reservation has not expired yet
    if (match.reservedUntil && new Date(match.reservedUntil).getTime() > Date.now()) {
      return {
        success: false,
        status: 'RESERVED',
        messageEn: 'This Student ID Is Currently Reserved for an active registration session.',
        messageBn: 'এই স্টুডেন্ট আইডিটির জন্য বর্তমানে একটি পেমেন্ট সেশন চলমান রয়েছে। অনুগ্রহ করে কিছুক্ষণ অপেক্ষা করুন।',
      };
    }
  }

  return {
    success: true,
    status: 'AVAILABLE',
    messageEn: 'Student ID Verified Successfully',
    messageBn: 'স্টুডেন্ট আইডি সফলভাবে যাচাই সম্পন্ন হয়েছে',
    record: {
      studentId: match.studentId,
      studentName: match.studentName,
      className: match.className,
      academicYear: match.academicYear,
      phone: (match as any).phone || undefined,
    },
  };
}

export function calculateTotalFee(
  category: StudentCategory,
  feeSettings: FeeSettings,
  donationAmount: number = 0,
  hasParent: boolean = false
): { registrationFee: number; parentFee: number; donationAmount: number; totalPayable: number } {
  const baseFee = category === 'former' ? feeSettings.formerStudentFee : feeSettings.currentStudentFee;
  const validDonation = Math.max(0, Number(donationAmount) || 0);
  const parentFee = hasParent ? 1500 : 0;
  return {
    registrationFee: baseFee,
    parentFee,
    donationAmount: validDonation,
    totalPayable: baseFee + parentFee + validDonation,
  };
}

/**
 * Uniform Payment Gateway Service Charge:
 * Flat 1.8% added to total payable for every online payment.
 */
export const UNIFORM_GATEWAY_CHARGE_RATE = 0.018;

export function getGatewayChargeRate(_method?: string): number {
  return UNIFORM_GATEWAY_CHARGE_RATE;
}

export function calculateGatewayCharge(amount: number, _method: string = 'paystation'): number {
  const validAmount = Math.max(0, Number(amount) || 0);
  return Math.round(validAmount * UNIFORM_GATEWAY_CHARGE_RATE * 100) / 100;
}

export interface GateScanValidationResult {
  allowed: boolean;
  code: 'APPROVED' | 'UNPAID' | 'CANCELLED' | 'ALREADY_INSIDE' | 'NOT_INSIDE' | 'INVALID_TICKET';
  reasonEn: string;
  reasonBn: string;
}

/**
 * Gate entry and exit verification rule engine:
 * - Prevents duplicate entry without an exit
 * - Prevents duplicate exit without an entry
 * - Blocks unpaid or cancelled registrations
 */
export function verifyGateScan(
  registration: RegistrationRecord | undefined | null,
  isCurrentlyInside: boolean,
  requestedScanType: 'entry' | 'exit'
): GateScanValidationResult {
  if (!registration) {
    return {
      allowed: false,
      code: 'INVALID_TICKET',
      reasonEn: 'Ticket not found or invalid QR token',
      reasonBn: 'টিকিট খুঁজে পাওয়া যায়নি অথবা অবৈধ কিউআর টোকেন',
    };
  }

  if (registration.paymentStatus !== 'paid') {
    return {
      allowed: false,
      code: 'UNPAID',
      reasonEn: `Registration payment status is ${registration.paymentStatus.toUpperCase()}. Entry denied.`,
      reasonBn: `রেজিস্ট্রেশন ফি পরিশোধ করা হয়নি (${registration.paymentStatus})। প্রবেশ নিষেধ।`,
    };
  }

  if (requestedScanType === 'entry') {
    if (isCurrentlyInside) {
      return {
        allowed: false,
        code: 'ALREADY_INSIDE',
        reasonEn: 'Duplicate Entry Alert: This student is already marked as INSIDE the venue!',
        reasonBn: 'দ্বৈত প্রবেশ সতর্কতা: শিক্ষার্থী ইতোমধ্যে ক্যাম্পাসে প্রবেশ করেছেন!',
      };
    }
    return {
      allowed: true,
      code: 'APPROVED',
      reasonEn: 'Entry Approved: Welcome to Reunion 2026!',
      reasonBn: 'প্রবেশ অনুমোদিত: পুনর্মিলনী ২০২৬-এ স্বাগতম!',
    };
  } else {
    // requestedScanType === 'exit'
    if (!isCurrentlyInside) {
      return {
        allowed: false,
        code: 'NOT_INSIDE',
        reasonEn: 'Exit Mismatch Alert: No active entry scan found for this student!',
        reasonBn: 'প্রস্থান অসঙ্গতি: এই শিক্ষার্থীর জন্য কোনো পূর্ববর্তী সক্রিয় প্রবেশ রেকর্ড নেই!',
      };
    }
    return {
      allowed: true,
      code: 'APPROVED',
      reasonEn: 'Exit Approved: Logged successfully.',
      reasonBn: 'প্রস্থান অনুমোদিত: সফলভাবে রেকর্ড করা হয়েছে।',
    };
  }
}

/**
 * Financial calculation helper
 */
export function calculateFinancialSummary(
  registrations: RegistrationRecord[],
  donations: DonationRecord[],
  expenses: ExpenseRecord[],
  options?: { excludeDemo?: boolean }
) {
  const effectiveRegistrations =
    options?.excludeDemo !== false
      ? registrations.filter((r) => !r.isDemo)
      : registrations;
  const paidRegistrations = effectiveRegistrations.filter((r) => r.paymentStatus === 'paid');
  const totalRegistrationRevenue = paidRegistrations.reduce((acc, r) => acc + r.registrationFee, 0);
  const registrationDonations = paidRegistrations.reduce((acc, r) => acc + (r.donationAmount || 0), 0);
  const independentDonations = donations.reduce((acc, d) => acc + d.amount, 0);
  const totalDonations = registrationDonations + independentDonations;

  const totalIncome = totalRegistrationRevenue + totalDonations;
  const totalExpenses = expenses.reduce((acc, e) => acc + e.amount, 0);
  const remainingBalance = totalIncome - totalExpenses;

  return {
    paidRegistrationsCount: paidRegistrations.length,
    formerStudentsCount: paidRegistrations.filter((r) => r.category === 'former').length,
    currentStudentsCount: paidRegistrations.filter((r) => r.category === 'current').length,
    totalRegistrationRevenue,
    totalDonations,
    totalIncome,
    totalExpenses,
    remainingBalance,
  };
}

export function generateRegistrationId(category: StudentCategory, index: number): string {
  const prefix = category === 'former' ? 'PLSCF-26F' : 'PLSCF-26C';
  const num = (index + 1001).toString();
  return `${prefix}${num}`;
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Registration & Donation Availability Governance Helpers
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Master Global Registration check.
 * When OFF, all registration categories and registration processes are strictly disabled.
 */
export function isGlobalRegistrationOpen(settings?: FeeSettings | null): boolean {
  if (!settings) return false;
  return Boolean(settings.registrationOpen);
}

/**
 * Alumni (Former Student) Registration check.
 * Requires Global Registration to be ON and alumniRegistrationOpen to not be false.
 */
export function isAlumniRegistrationOpen(settings?: FeeSettings | null): boolean {
  if (!isGlobalRegistrationOpen(settings)) return false;
  return settings?.alumniRegistrationOpen !== false;
}

/**
 * Current Student Registration check.
 * Requires Global Registration to be ON and currentStudentRegistrationOpen to not be false.
 */
export function isCurrentStudentRegistrationOpen(settings?: FeeSettings | null): boolean {
  if (!isGlobalRegistrationOpen(settings)) return false;
  return settings?.currentStudentRegistrationOpen !== false;
}

/**
 * Category-specific Registration check ('former' or 'current').
 */
export function isCategoryRegistrationOpen(
  category: StudentCategory,
  settings?: FeeSettings | null
): boolean {
  if (!isGlobalRegistrationOpen(settings)) return false;
  if (category === 'former') return isAlumniRegistrationOpen(settings);
  if (category === 'current') return isCurrentStudentRegistrationOpen(settings);
  return false;
}

/**
 * Independent Donation check.
 * Completely independent of registration settings.
 */
export function isDonationOpen(settings?: FeeSettings | null): boolean {
  if (!settings) return false;
  return settings.donationOpen !== false;
}

/**
 * Returns user-friendly status message when a registration category is closed.
 */
export function getRegistrationClosedMessage(
  settings: FeeSettings | null | undefined,
  category: StudentCategory | 'global',
  lang: 'en' | 'bn' = 'en'
): string {
  if (!settings || !isGlobalRegistrationOpen(settings)) {
    if (lang === 'bn') {
      return (
        settings?.closedMessageBn ||
        'অনলাইন রেজিস্ট্রেশন কার্যক্রম বর্তমানে বন্ধ রয়েছে। জরুরি প্রয়োজনে অনুগ্রহ করে পুনর্মিলনী সচিবালয়ে যোগাযোগ করুন।'
      );
    }
    return (
      settings?.closedMessageEn ||
      'Online registration is currently closed. If you need special authorization, please contact the Reunion Secretariat.'
    );
  }

  if (category === 'former' && !isAlumniRegistrationOpen(settings)) {
    return lang === 'bn'
      ? 'প্রাক্তন শিক্ষার্থী (অ্যালামনাই) রেজিস্ট্রেশন কার্যক্রম বর্তমানে বন্ধ রয়েছে।'
      : 'Alumni (Former Student) registration is currently closed.';
  }

  if (category === 'current' && !isCurrentStudentRegistrationOpen(settings)) {
    return lang === 'bn'
      ? 'বর্তমান শিক্ষার্থী রেজিস্ট্রেশন কার্যক্রম বর্তমানে বন্ধ রয়েছে।'
      : 'Current Student registration is currently closed.';
  }

  return '';
}

/**
 * Returns user-friendly status message when donation is closed.
 */
export function getDonationClosedMessage(
  settings: FeeSettings | null | undefined,
  lang: 'en' | 'bn' = 'en'
): string {
  const custom =
    lang === 'bn'
      ? settings?.closureNotices?.donation?.messageBn || settings?.donationClosedMessageBn
      : settings?.closureNotices?.donation?.messageEn || settings?.donationClosedMessageEn;
  if (custom && custom.trim()) {
    return custom.trim();
  }
  if (lang === 'bn') {
    return 'অনলাইন অনুদান কার্যক্রম বর্তমানে সাময়িকভাবে বন্ধ রয়েছে। পুনর্মিলনী তহবিলে সহযোগিতার জন্য আন্তরিক ধন্যবাদ।';
  }
  return 'Online donations are currently paused by the Reunion Secretariat. Thank you for your continued support.';
}

export interface ResolvedClosureNotice {
  target: 'global' | 'alumni' | 'currentStudent' | 'donation';
  title: string;
  message: string;
  reopenAt?: string;
  contactInfo?: string;
  instructions?: string;
}

/**
 * Resolves safe plain-text closure notice content for UI rendering, omitting any blank optional fields.
 */
export function getStructuredClosureNotice(
  settings: FeeSettings | null | undefined,
  target: 'global' | 'alumni' | 'currentStudent' | 'donation',
  lang: 'en' | 'bn' = 'en'
): ResolvedClosureNotice {
  const isBn = lang === 'bn';

  if (target === 'global') {
    return {
      target: 'global',
      title: isBn
        ? 'অনলাইন রেজিস্ট্রেশন কার্যক্রম সাময়িকভাবে বন্ধ রয়েছে'
        : 'Online Registration Is Currently Closed',
      message: getRegistrationClosedMessage(settings, 'global', lang),
    };
  }

  const slot = settings?.closureNotices?.[target];
  const fallbackTitle =
    target === 'alumni'
      ? isBn
        ? 'প্রাক্তন শিক্ষার্থী নিবন্ধন সাময়িকভাবে বন্ধ রয়েছে'
        : 'Alumni Registration Is Temporarily Closed'
      : target === 'currentStudent'
      ? isBn
        ? 'বর্তমান শিক্ষার্থী নিবন্ধন সাময়িকভাবে বন্ধ রয়েছে'
        : 'Current Student Registration Is Temporarily Closed'
      : isBn
      ? 'অনলাইন অনুদান কার্যক্রম সাময়িকভাবে বন্ধ রয়েছে'
      : 'Online Donations Are Temporarily Closed';

  const fallbackMessage =
    target === 'donation'
      ? getDonationClosedMessage(settings, lang)
      : getRegistrationClosedMessage(settings, target === 'alumni' ? 'former' : 'current', lang);

  const title = (isBn ? slot?.titleBn : slot?.titleEn)?.trim() || fallbackTitle;
  const message = (isBn ? slot?.messageBn : slot?.messageEn)?.trim() || fallbackMessage;
  const reopenAt = slot?.reopenAt?.trim() || undefined;
  const contactInfo = slot?.contactInfo?.trim() || undefined;
  const instructions = (isBn ? slot?.instructionsBn : slot?.instructionsEn)?.trim() || undefined;

  return {
    target,
    title,
    message,
    reopenAt,
    contactInfo,
    instructions,
  };
}
