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
 * Starts with optional +88 or 88, then 01[3-9] and 8 more digits (exact 11 digits without country code).
 */
export function isValidBangladeshiMobile(phone: string): boolean {
  if (!phone) return false;
  const cleaned = phone.replace(/[\s-]/g, '');
  const bdPhoneRegex = /^(?:\+?88)?01[3-9]\d{8}$/;
  return bdPhoneRegex.test(cleaned);
}

export function normalizeBangladeshiMobileNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.startsWith('880') ? `0${digits.slice(3)}` : digits;
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
  mobileNumber: string;
  email?: string; // Optional: users can register without an email address
  address: string;
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
    },
  };
}

export function calculateTotalFee(
  category: StudentCategory,
  feeSettings: FeeSettings,
  donationAmount: number = 0
): { registrationFee: number; donationAmount: number; totalPayable: number } {
  const baseFee = category === 'former' ? feeSettings.formerStudentFee : feeSettings.currentStudentFee;
  const validDonation = Math.max(0, Number(donationAmount) || 0);
  return {
    registrationFee: baseFee,
    donationAmount: validDonation,
    totalPayable: baseFee + validDonation,
  };
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
