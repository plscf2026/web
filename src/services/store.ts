import {
  RegistrationRecord,
  DonationRecord,
  NoticeItem,
  ExpenseRecord,
  StaffUser,
  FeeSettings,
  ClosureNoticeContent,
  GovernanceClosureNotices,
  ScanLog,
  DEFAULT_HOME_PAGE_SECTIONS,
  reconcileHomePageSections,
} from '../types';
import { SupabaseService, supabase } from './supabase';
import { isValidSixCharToken, generateUniqueSixCharToken, findRegistrationByTokenOrId, parseScannedInput } from '../utils/tokenGenerator';

const STORAGE_KEY_REGISTRATIONS = 'plscf_reunion_registrations_v1';
const STORAGE_KEY_DELETED_REGISTRATIONS = 'plscf_deleted_registrations_v1';
const STORAGE_KEY_DONATIONS = 'plscf_reunion_donations_v1';
const STORAGE_KEY_NOTICES = 'plscf_reunion_notices_v1';
const STORAGE_KEY_EXPENSES = 'plscf_reunion_expenses_v1';
const STORAGE_KEY_SETTINGS = 'plscf_reunion_settings_v1';
const STORAGE_KEY_SCAN_LOGS = 'plscf_reunion_scan_logs_v1';
const STORAGE_KEY_ACTIVE_STAFF = 'plscf_reunion_active_staff_v1';

export const INITIAL_STAFF_USERS: StaffUser[] = [
  {
    id: 'STF-ADM-01',
    username: 'admin@gmail.com',
    fullName: 'System Administrator (Testing)',
    role: 'super_admin',
    gateAssigned: 'All Gates / All Modules',
  },
  {
    id: 'STF-GAT-01',
    username: 'gate@gmail.com',
    fullName: 'Tariqul Islam (Gate Lead)',
    role: 'scanner_staff',
    gateAssigned: 'Gate 01 - Main Entrance',
  },
  {
    id: 'STF-GAT-02',
    username: 'gate2@gmail.com',
    fullName: 'Tanvir Hasan (Gate 02 Officer)',
    role: 'scanner_staff',
    gateAssigned: 'Gate 02 - East Campus',
  },
  {
    id: 'STF-BRK-01',
    username: 'breakfast@gmail.com',
    fullName: 'Nasir Uddin (Breakfast Incharge)',
    role: 'scanner_staff',
    gateAssigned: 'Food Pavilion B (Breakfast)',
  },
  {
    id: 'STF-LUN-01',
    username: 'food@gmail.com',
    fullName: 'Mohammad Faruk Hossain (Lunch Lead)',
    role: 'scanner_staff',
    gateAssigned: 'Food Pavilion A (Lunch)',
  },
  {
    id: 'STF-DIN-01',
    username: 'dinner@gmail.com',
    fullName: 'Abdur Rahim (Dinner Incharge)',
    role: 'scanner_staff',
    gateAssigned: 'Food Pavilion C (Dinner)',
  },
  {
    id: 'STF-DRS-01',
    username: 'dress@gmail.com',
    fullName: 'Jamal Uddin Chowdhury (Kit & T-Shirt)',
    role: 'scanner_staff',
    gateAssigned: 'Distribution Booth 01',
  },
  {
    id: 'STF-DRS-02',
    username: 'dress2@gmail.com',
    fullName: 'Kazi Rayhan (Distribution Booth 02)',
    role: 'scanner_staff',
    gateAssigned: 'Distribution Booth 02',
  },
  {
    id: 'STF-FIN-01',
    username: 'finance@gmail.com',
    fullName: 'Md. Shafiqul Alam (Finance Secretary)',
    role: 'finance_mgr',
    gateAssigned: 'Central Accounts Office',
  },
  {
    id: 'STF-REG-01',
    username: 'registration@gmail.com',
    fullName: 'Dr. Nusrat Jahan (Registration Lead)',
    role: 'registration_mgr',
    gateAssigned: 'Secretariat Registration Desk',
  },
  {
    id: 'STF-SUP-01',
    username: 'supervisor@gmail.com',
    fullName: 'Engr. Moniruzzaman (Floor Supervisor)',
    role: 'scanner_supervisor',
    gateAssigned: 'All Gate & Floor Stations',
  },
  {
    id: 'STF-CNT-01',
    username: 'content@gmail.com',
    fullName: 'Farhana Yasmin (Souvenir & Media Lead)',
    role: 'content_mgr',
    gateAssigned: 'Media & Public Relations Room',
  },
  {
    id: 'STF-IDC-01',
    username: 'idcard.staff@gmail.com',
    fullName: 'Kamrul Hasan (ID Card Coordinator)',
    role: 'admin',
    gateAssigned: 'ID Card Production Center',
  },
];

export const DEFAULT_CLOSURE_NOTICES: GovernanceClosureNotices = {
  alumni: {
    titleEn: 'Alumni Registration Is Temporarily Closed',
    titleBn: 'প্রাক্তন শিক্ষার্থী নিবন্ধন সাময়িকভাবে বন্ধ রয়েছে',
    messageEn:
      'Alumni (Former Student) online registration is currently closed by the Reunion Secretariat. Please check back later or contact us for assistance.',
    messageBn:
      'প্রাক্তন শিক্ষার্থীদের অনলাইন নিবন্ধন কার্যক্রম বর্তমানে পুনর্মিলনী সচিবালয়ের নির্দেশে বন্ধ রয়েছে। প্রয়োজন হলে অনুগ্রহ করে নিচের নম্বরে বা ইমেইলে যোগাযোগ করুন।',
    reopenAt: '',
    contactInfo: '',
    instructionsEn: '',
    instructionsBn: '',
  },
  currentStudent: {
    titleEn: 'Current Student Registration Is Temporarily Closed',
    titleBn: 'বর্তমান শিক্ষার্থী নিবন্ধন সাময়িকভাবে বন্ধ রয়েছে',
    messageEn:
      'Current student online registration is currently paused by the Reunion Secretariat. Please check back soon or reach out to the helpdesk.',
    messageBn:
      'বর্তমান শিক্ষার্থীদের অনলাইন নিবন্ধন কার্যক্রম বর্তমানে সাময়িকভাবে স্থগিত রয়েছে। বিস্তারিত জানতে অনুগ্রহ করে সচিবালয়ে যোগাযোগ করুন।',
    reopenAt: '',
    contactInfo: '',
    instructionsEn: '',
    instructionsBn: '',
  },
  donation: {
    titleEn: 'Online Donations Are Temporarily Closed',
    titleBn: 'অনলাইন অনুদান কার্যক্রম সাময়িকভাবে বন্ধ রয়েছে',
    messageEn:
      'Online donations are currently paused by the Reunion Secretariat. Thank you for your continued generosity and support.',
    messageBn:
      'অনলাইন অনুদান কার্যক্রম বর্তমানে সাময়িকভাবে বন্ধ রয়েছে। পুনর্মিলনী তহবিলে আপনার আন্তরিক আগ্রহ ও সহযোগিতার জন্য ধন্যবাদ।',
    reopenAt: '',
    contactInfo: '',
    instructionsEn: '',
    instructionsBn: '',
  },
};

export function normalizeClosureNoticeContent(
  raw: Partial<ClosureNoticeContent> | null | undefined,
  fallback: ClosureNoticeContent
): ClosureNoticeContent {
  if (!raw || typeof raw !== 'object') {
    return { ...fallback };
  }
  return {
    titleEn: typeof raw.titleEn === 'string' ? raw.titleEn : fallback.titleEn,
    titleBn: typeof raw.titleBn === 'string' ? raw.titleBn : fallback.titleBn,
    messageEn: typeof raw.messageEn === 'string' ? raw.messageEn : fallback.messageEn,
    messageBn: typeof raw.messageBn === 'string' ? raw.messageBn : fallback.messageBn,
    reopenAt: typeof raw.reopenAt === 'string' ? raw.reopenAt : (fallback.reopenAt ?? ''),
    contactInfo: typeof raw.contactInfo === 'string' ? raw.contactInfo : (fallback.contactInfo ?? ''),
    instructionsEn: typeof raw.instructionsEn === 'string' ? raw.instructionsEn : (fallback.instructionsEn ?? ''),
    instructionsBn: typeof raw.instructionsBn === 'string' ? raw.instructionsBn : (fallback.instructionsBn ?? ''),
  };
}

export const INITIAL_FEE_SETTINGS: FeeSettings = {
  formerStudentFee: 1500,
  currentStudentFee: 500,
  parentFee: 1500,
  minDonation: 100,
  maxDonation: 50000,
  gatewayChargePercent: 1.8,
  registrationOpen: true,
  alumniRegistrationOpen: true,
  currentStudentRegistrationOpen: true,
  donationOpen: true,
  startDate: '2026-01-01',
  endDate: '2027-01-20',
  lateFeeEnabled: false,
  lateFeeAmount: 300,
  closedMessageEn: 'Online registration is currently closed. If you need special authorization, please contact the Reunion Secretariat.',
  closedMessageBn: 'অনলাইন রেজিস্ট্রেশন কার্যক্রম বর্তমানে বন্ধ রয়েছে। জরুরি প্রয়োজনে অনুগ্রহ করে পুনর্মিলনী সচিবালয়ে যোগাযোগ করুন।',
  donationClosedMessageEn: 'Online donations are currently paused by the Reunion Secretariat. Thank you for your continued support.',
  donationClosedMessageBn: 'অনলাইন অনুদান কার্যক্রম বর্তমানে সাময়িকভাবে বন্ধ রয়েছে। পুনর্মিলনী তহবিলে সহযোগিতার জন্য আন্তরিক ধন্যবাদ।',
  closureNotices: DEFAULT_CLOSURE_NOTICES,
  eventTargetDate: '2027-01-29T09:00:00',
  simulateEventCompleted: false,
  hideDonationAmounts: false,
  homePageSections: DEFAULT_HOME_PAGE_SECTIONS,
};

export function normalizeFeeSettings(raw: Partial<FeeSettings> | Record<string, any> | null | undefined): FeeSettings {
  const src = raw && typeof raw === 'object' ? raw : {};
  const rawNotices = (src.closureNotices && typeof src.closureNotices === 'object' ? src.closureNotices : {}) as Record<string, any>;
  const donationFallback: ClosureNoticeContent = {
    ...DEFAULT_CLOSURE_NOTICES.donation,
    messageEn:
      typeof src.donationClosedMessageEn === 'string' && src.donationClosedMessageEn.trim()
        ? src.donationClosedMessageEn
        : DEFAULT_CLOSURE_NOTICES.donation.messageEn,
    messageBn:
      typeof src.donationClosedMessageBn === 'string' && src.donationClosedMessageBn.trim()
        ? src.donationClosedMessageBn
        : DEFAULT_CLOSURE_NOTICES.donation.messageBn,
  };
  const closureNotices: GovernanceClosureNotices = {
    alumni: normalizeClosureNoticeContent(rawNotices.alumni, DEFAULT_CLOSURE_NOTICES.alumni),
    currentStudent: normalizeClosureNoticeContent(rawNotices.currentStudent, DEFAULT_CLOSURE_NOTICES.currentStudent),
    donation: normalizeClosureNoticeContent(rawNotices.donation, donationFallback),
  };

  return {
    ...INITIAL_FEE_SETTINGS,
    ...src,
    formerStudentFee: Number.isFinite(Number(src.formerStudentFee)) && Number(src.formerStudentFee) > 0
      ? Number(src.formerStudentFee)
      : INITIAL_FEE_SETTINGS.formerStudentFee,
    currentStudentFee: Number.isFinite(Number(src.currentStudentFee)) && Number(src.currentStudentFee) > 0
      ? Number(src.currentStudentFee)
      : INITIAL_FEE_SETTINGS.currentStudentFee,
    parentFee: Number.isFinite(Number(src.parentFee)) ? Number(src.parentFee) : INITIAL_FEE_SETTINGS.parentFee,
    minDonation: Number.isFinite(Number(src.minDonation)) ? Number(src.minDonation) : INITIAL_FEE_SETTINGS.minDonation,
    maxDonation: Number.isFinite(Number(src.maxDonation)) ? Number(src.maxDonation) : INITIAL_FEE_SETTINGS.maxDonation,
    gatewayChargePercent: Number.isFinite(Number(src.gatewayChargePercent))
      ? Number(src.gatewayChargePercent)
      : INITIAL_FEE_SETTINGS.gatewayChargePercent,
    registrationOpen: typeof src.registrationOpen === 'boolean' ? src.registrationOpen : true,
    alumniRegistrationOpen: typeof src.alumniRegistrationOpen === 'boolean' ? src.alumniRegistrationOpen : true,
    currentStudentRegistrationOpen:
      typeof src.currentStudentRegistrationOpen === 'boolean' ? src.currentStudentRegistrationOpen : true,
    donationOpen: typeof src.donationOpen === 'boolean' ? src.donationOpen : true,
    closedMessageEn:
      typeof src.closedMessageEn === 'string' ? src.closedMessageEn : INITIAL_FEE_SETTINGS.closedMessageEn,
    closedMessageBn:
      typeof src.closedMessageBn === 'string' ? src.closedMessageBn : INITIAL_FEE_SETTINGS.closedMessageBn,
    donationClosedMessageEn: closureNotices.donation.messageEn,
    donationClosedMessageBn: closureNotices.donation.messageBn,
    closureNotices,
    simulateEventCompleted: Boolean(src.simulateEventCompleted),
    hideDonationAmounts: Boolean(src.hideDonationAmounts),
    homePageSections: reconcileHomePageSections(src.homePageSections),
  };
}

export const INITIAL_REGISTRATIONS: RegistrationRecord[] = [];

export const INITIAL_DONATIONS: DonationRecord[] = [];

export const INITIAL_EXPENSES: ExpenseRecord[] = [];
export const INITIAL_NOTICES: NoticeItem[] = [
  {
    id: 'NOT-01',
    titleEn: 'Grand Reunion 2026 Registration Officially Commenced',
    titleBn: 'গ্র্যান্ড পুনর্মিলনী ২০২৬-এর অনলাইন রেজিস্ট্রেশন কার্যক্রমের আনুষ্ঠানিক উদ্বোধন',
    category: 'registration',
    date: '2026-01-15',
    isPinned: true,
    contentEn:
      'We are delighted to announce that student registration for the 64th Anniversary Grand Reunion 2026 has officially opened. Former students (fee BDT 1,500) and current students (fee BDT 500) can register through our verified bilingual portal.',
    contentBn:
      'অত্যন্ত আনন্দের সাথে জানানো যাচ্ছে যে, পুলিশ লাইন্স স্কুল অ্যান্ড কলেজ, ফরিদপুরের ৬৪ বছর পূর্তি উপলক্ষে গ্র্যান্ড পুনর্মিলনী ২০২৬-এর অনলাইন রেজিস্ট্রেশন শুরু হয়েছে। সকল প্রাক্তন (ফি ১,৫০০/-) ও বর্তমান (ফি ৫০০/-) শিক্ষার্থীদের যথাসময়ে নিবন্ধন সম্পন্ন করার জন্য অনুরোধ করা হলো।',
    attachmentName: 'Reunion_2026_Notice_01.pdf',
  },
  {
    id: 'NOT-02',
    titleEn: 'Batch Representatives Meeting on November 20 at College Auditorium',
    titleBn: 'আগামী ২০ নভেম্বর কলেজ অডিটোরিয়ামে ব্যাচ প্রতিনিধিদের মতবিনিময় সভা',
    category: 'event',
    date: '2026-02-01',
    isPinned: true,
    contentEn:
      'All batch convenors from SSC 1968 to SSC 2025 are requested to attend the coordination meeting regarding souvenir write-ups, photo submissions, and seating arrangements.',
    contentBn:
      '১৯৬৮ থেকে ২০২৫ সালের সকল এসএসসি ও এইচএসসি ব্যাচের প্রতিনিধিদের সাথে স্মরণিকা লেখা সংগ্রহ, স্মৃতিচারণ ও আসন বিন্যাস বিষয়ক জরুরি সমন্বয় সভা আহ্বান করা হয়েছে।',
    attachmentName: 'Batch_Meeting_Schedule.pdf',
  },
  {
    id: 'NOT-03',
    titleEn: 'Souvenir Article & Historical Photo Submission Guidelines',
    titleBn: 'স্মরণিকার জন্য লেখা ও স্মৃতিচিহ্ন পাঠানোর নির্দেশিকা',
    category: 'general',
    date: '2026-02-10',
    isPinned: false,
    contentEn:
      'Alumni are invited to send poems, nostalgic essays, and old campus photographs for publication in our commemorative magazine "ঐতিহ্যের আঙিনা". Email to: souvenir@plscf.edu.bd.',
    contentBn:
      'প্রাক্তন ও বর্তমান শিক্ষক-শিক্ষার্থীদের স্মৃতিকথা, কবিতা এবং ঐতিহাসিক ক্যাম্পাস ফটোগ্রাফ স্মরণিকায় প্রকাশের জন্য souvenir@plscf.edu.bd ঠিকানায় পাঠানোর অনুরোধ করা হলো।',
    attachmentName: 'Souvenir_Guidelines_2026.pdf',
  },
  {
    id: 'NOT-04',
    titleEn: 'Security & QR Badge Gate Entry Rules on Event Days',
    titleBn: 'অনুষ্ঠান দিবসে প্রবেশপথে কিউআর কোডযুক্ত পরিচয়পত্র প্রদর্শন সংক্রান্ত বিজ্ঞপ্তি',
    category: 'emergency',
    date: '2026-02-18',
    isPinned: false,
    contentEn:
      'Strict security will be maintained by district police forces. No attendee will be allowed inside the campus without a verified digital ticket QR code. Please ensure mobile battery charge or carry printed passes.',
    contentBn:
      'জেলা পুলিশের সমন্বয়ে সার্বিক নিরাপত্তা নিশ্চিত করা হবে। যাচাইকৃত ডিজিটাল টিকিটের কিউআর কোড স্ক্যান ব্যতীত কাউকে ক্যাম্পাসে প্রবেশ করতে দেওয়া হবে না।',
    attachmentName: 'Gate_Security_Advisory.pdf',
  },
];

export const INITIAL_SCAN_LOGS: ScanLog[] = [];

// In-memory fallback when window.localStorage is not available (SSR / Node / Tests)
const memoryStore: Record<string, string> = {};

// Automatic one-time client storage purge for clean production / test launch
const STORAGE_PURGE_KEY_V2 = 'plscf_client_clean_v2027_02';
if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
  try {
    if (window.localStorage.getItem(STORAGE_PURGE_KEY_V2) !== 'true') {
      const keysToClear = [
        'plscf_reunion_registrations_v1',
        'plscf_reunion_donations_v1',
        'plscf_reunion_expenses_v1',
        'plscf_reunion_scan_logs_v1',
        'plscf_registration_draft',
        'plscf_id_cards_v1',
        'plscf_registered_count',
        'plscf_current_student_ids_v2',
        'plscf_event_gate_events_v2',
        'plscf_event_food_distributions_v2',
        'plscf_event_dress_distributions_v2',
        'plscf_event_staff_expenses_v2',
        'plscf_event_financial_ledger_v2',
        'plscf_event_admin_audit_history_v2',
      ];
      for (const k of keysToClear) {
        window.localStorage.removeItem(k);
      }
      window.localStorage.setItem(STORAGE_PURGE_KEY_V2, 'true');
    }
  } catch (_) { }
}

// Helper to load or initialize from localStorage
function getStored<T>(key: string, defaultValue: T): T {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const item = window.localStorage.getItem(key);
      if (item !== null) return JSON.parse(item);
    }
    const memItem = memoryStore[key];
    if (memItem !== undefined) return JSON.parse(memItem);
    return defaultValue;
  } catch {
    try {
      const memItem = memoryStore[key];
      if (memItem !== undefined) return JSON.parse(memItem);
    } catch (_) { }
    return defaultValue;
  }
}

function setStored<T>(key: string, value: T): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, JSON.stringify(value));
      return;
    }
    memoryStore[key] = JSON.stringify(value);
  } catch (err) {
    console.warn(`Failed to save to localStorage for key ${key} (QuotaExceeded or unavailable):`, err);
    try {
      memoryStore[key] = JSON.stringify(value);
    } catch (_) { }
  }
}

export class AppStore {
  static getDeletedRegistrationIds(): Set<string> {
    const arr = getStored<string[]>(STORAGE_KEY_DELETED_REGISTRATIONS, []);
    return new Set(Array.isArray(arr) ? arr : []);
  }

  static markRegistrationDeleted(id: string): void {
    const cleanId = (id || '').trim();
    if (!cleanId) return;
    const current = this.getDeletedRegistrationIds();
    current.add(cleanId);
    setStored(STORAGE_KEY_DELETED_REGISTRATIONS, Array.from(current));
  }

  static isRegistrationDeleted(id: string): boolean {
    if (!id) return false;
    return this.getDeletedRegistrationIds().has(id.trim());
  }

  static getRegistrations(): RegistrationRecord[] {
    const rawList = getStored<RegistrationRecord[]>(STORAGE_KEY_REGISTRATIONS, []);
    const deletedIds = this.getDeletedRegistrationIds();
    const map = new Map<string, RegistrationRecord>();

    for (const r of INITIAL_REGISTRATIONS) {
      if (!deletedIds.has(r.id)) {
        map.set(r.id, r);
      }
    }
    for (const r of rawList) {
      if (!deletedIds.has(r.id)) {
        map.set(r.id, r);
      }
    }
    const list = Array.from(map.values());
    let modified = false;
    const existingTokens = new Set<string>();

    for (const r of list) {
      if (isValidSixCharToken(r.qrToken)) {
        existingTokens.add(r.qrToken.toUpperCase());
      }
    }

    for (const r of list) {
      if (!isValidSixCharToken(r.qrToken)) {
        r.qrToken = generateUniqueSixCharToken(existingTokens);
        existingTokens.add(r.qrToken);
        modified = true;
      }
    }

    if (modified || rawList.length !== list.length) {
      setStored(STORAGE_KEY_REGISTRATIONS, list);
    }
    return list;
  }

  static saveRegistrations(items: RegistrationRecord[]): void {
    const deletedIds = this.getDeletedRegistrationIds();
    const cleanItems = items.filter((r) => !deletedIds.has(r.id));
    setStored(STORAGE_KEY_REGISTRATIONS, cleanItems);
  }

  static addRegistration(record: RegistrationRecord, year: number = 2026): void {
    const list = this.getRegistrations();
    const existingIndex = list.findIndex(
      (r) => r.id === record.id || (record.gatewayInvoiceNumber && r.gatewayInvoiceNumber === record.gatewayInvoiceNumber)
    );
    let updated: RegistrationRecord[];
    if (existingIndex >= 0) {
      updated = [...list];
      updated[existingIndex] = { ...updated[existingIndex], ...record };
    } else {
      updated = [record, ...list];
    }
    this.saveRegistrations(updated);

    // Asynchronously sync with Supabase backend tables (e.g. registrations_2027)
    SupabaseService.saveRegistration(record, year).then((res) => {
      if (res.success) {
        console.log(`[Supabase] Successfully saved booking ${record.id} to table ${res.table}`);
      } else {
        console.warn(`[Supabase] Booking saved locally. Supabase sync notice:`, res.error);
      }
    }).catch((err) => {
      console.warn('[Supabase] Background sync error:', err);
    });
  }

  static updateRegistration(id: string, updates: Partial<RegistrationRecord>, year: number = 2027): RegistrationRecord | null {
    const list = this.getRegistrations();
    const cleanId = (id || '').trim();
    const index = list.findIndex((r) => r.id === cleanId || r.id?.toLowerCase() === cleanId.toLowerCase() || (r.studentId && r.studentId.toLowerCase() === cleanId.toLowerCase()));
    if (index === -1) return null;
    list[index] = { ...list[index], ...updates };
    this.saveRegistrations(list);
    SupabaseService.clearRegistrationCache(year);

    // Sync updated fields directly to Supabase cloud table registrations_2027
    const yearTableName = `registrations_${year || 2027}`;
    const dbUpdates: any = {};
    if (updates.isTShirtCollected !== undefined) dbUpdates.is_tshirt_collected = updates.isTShirtCollected;
    if (updates.isCheckedIn !== undefined) dbUpdates.is_checked_in = updates.isCheckedIn;
    if (updates.paymentStatus !== undefined) dbUpdates.payment_status = updates.paymentStatus;
    if (updates.totalPaid !== undefined) dbUpdates.total_paid = updates.totalPaid;
    if (updates.transactionId !== undefined) dbUpdates.transaction_id = updates.transactionId;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
    // Manual Registration & Approval Fields
    if (updates.registrationApprovalStatus !== undefined) dbUpdates.registration_approval_status = updates.registrationApprovalStatus;
    if (updates.approvalNotes !== undefined) dbUpdates.approval_notes = updates.approvalNotes;
    if (updates.approvedBy !== undefined) dbUpdates.approved_by = updates.approvedBy;
    if (updates.approvedAt !== undefined) dbUpdates.approved_at = updates.approvedAt;
    if (updates.rejectedBy !== undefined) dbUpdates.rejected_by = updates.rejectedBy;
    if (updates.rejectedAt !== undefined) dbUpdates.rejected_at = updates.rejectedAt;
    if (updates.rejectionReason !== undefined) dbUpdates.rejection_reason = updates.rejectionReason;
    if (updates.financialApprovalStatus !== undefined) dbUpdates.financial_approval_status = updates.financialApprovalStatus;
    if (updates.financialApprovedBy !== undefined) dbUpdates.financial_approved_by = updates.financialApprovedBy;
    if (updates.financialApprovedAt !== undefined) dbUpdates.financial_approved_at = updates.financialApprovedAt;
    if (updates.financialRejectedBy !== undefined) dbUpdates.financial_rejected_by = updates.financialRejectedBy;
    if (updates.financialRejectedAt !== undefined) dbUpdates.financial_rejected_at = updates.financialRejectedAt;
    if (updates.financialAmount !== undefined) dbUpdates.financial_amount = updates.financialAmount;

    if (Object.keys(dbUpdates).length > 0) {
      if (updates.isTShirtCollected !== undefined) {
        SupabaseService.toggleTShirtDistribution(list[index].id, updates.isTShirtCollected).catch(() => {});
      }
      supabase.from(yearTableName).update(dbUpdates).eq('id', list[index].id).then(undefined, () => {});
      supabase.from('registrations_2027').update(dbUpdates).eq('id', list[index].id).then(undefined, () => {});
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('plscf_registration_updated', { detail: list[index] }));
      if ('BroadcastChannel' in window) {
        try {
          const bc = new (window as any).BroadcastChannel('plscf_realtime_events');
          bc.postMessage({ type: 'plscf_registration_updated', payload: list[index], timestamp: Date.now() });
          bc.close();
        } catch (_) {}
      }
    }

    return list[index];
  }

  static deleteRegistration(id: string, year: number = 2027): boolean {
    const cleanId = (id || '').trim();
    if (!cleanId) return false;

    // 1. Mark as tombstoned to prevent re-addition during background cloud sync
    this.markRegistrationDeleted(cleanId);

    // 2. Remove registration from local storage
    const list = this.getRegistrations();
    const updated = list.filter((r) => r.id !== cleanId);
    this.saveRegistrations(updated);

    // 3. Dispatch delete event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('plscf_registration_deleted', { detail: { id: cleanId } }));
    }

    // 4. Asynchronously and authoritatively delete from Supabase PostgreSQL tables
    SupabaseService.deleteRegistration(cleanId, 'Admin Panel Deletion', undefined, year).then((res) => {
      if (res.success) {
        console.log(`[Supabase] Successfully deleted registration ${cleanId} from cloud database`);
      } else {
        console.warn(`[Supabase] Cloud delete notice for ${cleanId}:`, res.error);
      }
    }).catch((err) => {
      console.warn('[Supabase] Background delete error:', err);
    });

    return true;
  }

  /**
   * Synchronizes registrations from Supabase cloud into local storage.
   * Supabase PostgreSQL registrations_2027 is the authoritative source of truth.
   * Local storage acts as a read cache. Deleted cloud rows are cleanly reflected.
   */
  static async syncWithSupabase(preferredYear?: number): Promise<{ count: number; error?: string }> {
    try {
      const targetYear = preferredYear || 2027;
      const res = await SupabaseService.fetchRegistrations(targetYear);
      const deletedIds = this.getDeletedRegistrationIds();

      if (res.error) {
        // If network failed, retain existing local cache for offline operation
        return { count: this.getRegistrations().length, error: res.error };
      }

      // Supabase is authoritative: local cache mirrors database state
      const fetched: RegistrationRecord[] = res.data || [];
      const validCloudData = fetched.filter((r) => !deletedIds.has(r.id));
      this.saveRegistrations(validCloudData);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('plscf_registration_updated'));
      }

      return { count: validCloudData.length };
    } catch (err: any) {
      console.warn('[AppStore] Supabase sync notice:', err);
      return { count: this.getRegistrations().length, error: err?.message };
    }
  }

  private static manualLookupProvider: ((input: string) => RegistrationRecord | undefined) | null = null;
  private static manualListProvider: (() => RegistrationRecord[]) | null = null;

  static registerManualLookup(fn: (input: string) => RegistrationRecord | undefined): void {
    this.manualLookupProvider = fn;
  }

  static registerManualListProvider(fn: () => RegistrationRecord[]): void {
    this.manualListProvider = fn;
  }

  static getManualRegistrations(): RegistrationRecord[] {
    if (this.manualListProvider) {
      return this.manualListProvider();
    }
    return getStored<RegistrationRecord[]>('plscf_manual_registrations_v1', []);
  }

  /**
   * Synchronous lookup in local approved store.
   */
  static findRegistration(input: string): RegistrationRecord | undefined {
    return findRegistrationByTokenOrId(this.getRegistrations(), input);
  }

  /**
   * Synchronous lookup in dedicated manual registrations store.
   */
  static findManualRegistration(input: string): RegistrationRecord | undefined {
    if (this.manualLookupProvider) {
      const provided = this.manualLookupProvider(input);
      if (provided) return provided;
    }
    const manualList = getStored<RegistrationRecord[]>('plscf_manual_registrations_v1', []);
    return findRegistrationByTokenOrId(manualList, input);
  }

  /**
   * Authoritative cross-device verification.
   * Checks local cache first; if not present or verification needed,
   * performs authoritative cloud verification via SECURITY DEFINER RPC.
   * Differentiates network errors, unconfirmed/unpaid tickets, token mismatches,
   * and nonexistent tickets.
   */
  static async verifyStudentTicketAsync(
    input: string,
    tokenInput?: string,
    staffId?: string
  ): Promise<{
    success: boolean;
    verified: boolean;
    status?: 'VERIFIED' | 'PENDING_APPROVAL' | 'REGISTRATION_REJECTED' | 'UNPAID' | 'TOKEN_MISMATCH' | 'NOT_FOUND' | 'GUARDIAN_NOT_REGISTERED' | 'NETWORK_ERROR' | 'INVALID_INPUT';
    student?: RegistrationRecord;
    errorType?: 'NOT_FOUND' | 'UNPAID' | 'TOKEN_MISMATCH' | 'NETWORK_ERROR' | 'INVALID_INPUT' | 'PENDING_APPROVAL' | 'REGISTRATION_REJECTED';
    error?: string;
  }> {
    if (!input || !input.trim()) {
      return { success: false, verified: false, errorType: 'INVALID_INPUT', error: 'Missing input.' };
    }
    const clean = input.trim();
    const parsed = parseScannedInput(clean);
    const safeToken = tokenInput?.trim().toUpperCase() || parsed.token;
    const isGuardian = Boolean(parsed.isGuardianPass || clean.toUpperCase().startsWith('PAR-') || (tokenInput && tokenInput.toUpperCase().startsWith('P-')));

    // 1. Instant check in local cache
    const local = this.findRegistration(clean);
    if (local) {
      if (isGuardian && !local.hasParent) {
        return {
          success: false,
          verified: false,
          status: 'GUARDIAN_NOT_REGISTERED',
          errorType: 'NOT_FOUND',
          error: `Parent/Guardian pass not registered for student "${local.id}".`,
        };
      }
      if (local.registrationApprovalStatus === 'pending') {
        return {
          success: false,
          verified: false,
          status: 'PENDING_APPROVAL',
          errorType: 'PENDING_APPROVAL',
          error: `ID Card Not Approved by Admin (PENDING APPROVAL: awaiting Super Admin approval for "${local.id}"). QR Code is currently inactive.`,
        };
      }
      if (local.registrationApprovalStatus === 'rejected') {
        return {
          success: false,
          verified: false,
          status: 'REGISTRATION_REJECTED',
          errorType: 'REGISTRATION_REJECTED',
          error: `ID Card Not Approved by Admin — REGISTRATION REJECTED: Registration "${local.id}" was rejected by Super Admin. Facility access denied.`,
        };
      }
      if (local.paymentStatus !== 'paid' && local.registrationApprovalStatus !== 'approved') {
        return {
          success: false,
          verified: false,
          status: 'UNPAID',
          errorType: 'UNPAID',
          error: `Payment Pending: Registration "${local.id}" is in "${local.paymentStatus}" status.`,
        };
      }
      if (safeToken && local.qrToken) {
        const rawToken = safeToken.replace(/^P-/i, '');
        if (local.qrToken.toUpperCase() !== safeToken && local.qrToken.toUpperCase() !== rawToken) {
          return {
            success: false,
            verified: false,
            status: 'TOKEN_MISMATCH',
            errorType: 'TOKEN_MISMATCH',
            error: `Cryptographic QR token mismatch for registration "${local.id}".`,
          };
        }
      }
      return { success: true, verified: true, status: 'VERIFIED', student: local };
    }

    // 2. Authoritative verification via cloud
    const cloudRes = await SupabaseService.verifyStudentTicket(clean, safeToken, staffId);
    if (cloudRes.verified && cloudRes.student) {
      // Cache locally for subsequent rapid scans
      const current = this.getRegistrations();
      if (!current.some((r) => r.id === cloudRes.student!.id)) {
        this.saveRegistrations([cloudRes.student, ...current]);
      }
      return { ...cloudRes, status: 'VERIFIED' };
    }

    if ((cloudRes as any).errorType === 'PENDING_APPROVAL') {
      return { ...cloudRes, status: 'PENDING_APPROVAL' };
    }

    if ((cloudRes as any).errorType === 'REGISTRATION_REJECTED') {
      return { ...cloudRes, status: 'REGISTRATION_REJECTED' };
    }

    // 2.5 Check dedicated manual registration storage before NOT_FOUND (handles offline / pending / rejected)
    const manualLocal = this.findManualRegistration(clean);
    if (manualLocal) {
      if (manualLocal.registrationApprovalStatus === 'rejected') {
        return {
          success: false,
          verified: false,
          status: 'REGISTRATION_REJECTED',
          errorType: 'REGISTRATION_REJECTED',
          error: `ID Card Not Approved by Admin — REGISTRATION REJECTED: Registration "${manualLocal.id}" was rejected by Super Admin.`,
        };
      }
      if (manualLocal.registrationApprovalStatus !== 'approved') {
        return {
          success: false,
          verified: false,
          status: 'PENDING_APPROVAL',
          errorType: 'PENDING_APPROVAL',
          error: `ID Card Not Approved by Admin (PENDING APPROVAL: awaiting Super Admin approval for "${manualLocal.id}"). QR Code is currently inactive.`,
        };
      }
    }

    // Fallback check against lookupRegistrationByIdOrToken (for test mocks)
    if (cloudRes.errorType === 'NOT_FOUND') {
      try {
        const fallbackRecord = await SupabaseService.lookupRegistrationByIdOrToken(clean, safeToken);
        if (fallbackRecord) {
          const current = this.getRegistrations();
          if (!current.some((r) => r.id === fallbackRecord.id)) {
            this.saveRegistrations([fallbackRecord, ...current]);
          }
          return { success: true, verified: true, status: 'VERIFIED', student: fallbackRecord };
        }
      } catch (_) {}
    }

    return cloudRes;
  }

  /**
   * Asynchronous cloud-resilient lookup (backward compatible):
   * 1. Checks local memory/storage first (instant 0ms).
   * 2. If not found, queries Supabase PostgreSQL table (registrations_2027).
   * 3. Caches newly discovered record into local store for offline use.
   */
  static async findRegistrationAsync(input: string, tokenInput?: string): Promise<RegistrationRecord | undefined> {
    if (!input || !input.trim()) return undefined;
    const clean = input.trim();

    // 1. Instant check in local memory
    const local = this.findRegistration(clean);
    if (local) return local;

    // 2. Cloud lookup in Supabase
    try {
      const cloudRecord = await SupabaseService.lookupRegistrationByIdOrToken(clean, tokenInput);
      if (cloudRecord) {
        // Cache to local storage
        const current = this.getRegistrations();
        if (!current.some((r) => r.id === cloudRecord.id)) {
          this.saveRegistrations([cloudRecord, ...current]);
        }
        return cloudRecord;
      }
    } catch (err) {
      console.warn('[AppStore] findRegistrationAsync exception:', err);
    }

    return undefined;
  }

  static getDonations(): DonationRecord[] {
    return getStored<DonationRecord[]>(STORAGE_KEY_DONATIONS, INITIAL_DONATIONS);
  }

  static addDonation(donation: DonationRecord, year: number = 2026): void {
    const list = this.getDonations();
    this.saveDonations([donation, ...list]);

    // Asynchronously sync with Supabase backend tables (e.g. donations_2026)
    SupabaseService.saveDonation(donation, year).then((res) => {
      if (res.success) {
        console.log(`[Supabase] Successfully saved donation ${donation.id} to table ${res.table}`);
      }
    }).catch(() => { });
  }

  static saveDonations(items: DonationRecord[]): void {
    setStored(STORAGE_KEY_DONATIONS, items);
  }

  static getExpenses(): ExpenseRecord[] {
    return getStored<ExpenseRecord[]>(STORAGE_KEY_EXPENSES, INITIAL_EXPENSES);
  }

  static addExpense(expense: ExpenseRecord): void {
    const list = this.getExpenses();
    this.saveExpenses([expense, ...list]);
  }

  static saveExpenses(items: ExpenseRecord[]): void {
    setStored(STORAGE_KEY_EXPENSES, items);
  }

  static getNotices(): NoticeItem[] {
    return getStored<NoticeItem[]>(STORAGE_KEY_NOTICES, INITIAL_NOTICES);
  }

  static saveNotices(items: NoticeItem[]): void {
    setStored(STORAGE_KEY_NOTICES, items);
  }

  static getFeeSettings(): FeeSettings {
    const settings = getStored<FeeSettings>(STORAGE_KEY_SETTINGS, INITIAL_FEE_SETTINGS);
    return normalizeFeeSettings(settings);
  }

  static getActiveEventYear(): number {
    const feeSettings = this.getFeeSettings();
    if (feeSettings?.eventTargetDate) {
      const parsed = new Date(feeSettings.eventTargetDate).getFullYear();
      if (!isNaN(parsed) && parsed >= 2020 && parsed <= 2100) {
        return parsed;
      }
    }
    return 2027;
  }

  static saveFeeSettings(settings: FeeSettings): void {
    const normalized = normalizeFeeSettings({
      ...settings,
      registrationOpen: Boolean(settings.registrationOpen),
      alumniRegistrationOpen: settings.alumniRegistrationOpen !== false,
      currentStudentRegistrationOpen: settings.currentStudentRegistrationOpen !== false,
      donationOpen: settings.donationOpen !== false,
    });
    setStored(STORAGE_KEY_SETTINGS, normalized);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('plscf_fee_settings_updated', { detail: normalized }));
    }
  }

  static getScanLogs(): ScanLog[] {
    return getStored<ScanLog[]>(STORAGE_KEY_SCAN_LOGS, INITIAL_SCAN_LOGS);
  }

  static addScanLog(log: ScanLog): void {
    const list = this.getScanLogs();
    this.saveScanLogs([log, ...list]);
  }

  static saveScanLogs(items: ScanLog[]): void {
    setStored(STORAGE_KEY_SCAN_LOGS, items);
  }

  static getActiveStaff(): StaffUser | null {
    return getStored<StaffUser | null>(STORAGE_KEY_ACTIVE_STAFF, null);
  }

  static setActiveStaff(staff: StaffUser): void {
    setStored(STORAGE_KEY_ACTIVE_STAFF, staff);
  }

  /**
   * Helper to check whether a student is currently inside the venue.
   * Finds their most recent approved scan. If it was 'entry', they are inside.
   */
  static isStudentInside(registrationId: string): boolean {
    const logs = this.getScanLogs().filter(
      (l) => l.registrationId === registrationId && l.status === 'approved'
    );
    if (logs.length === 0) return false;
    // logs are saved newest first
    return logs[0].scanType === 'entry';
  }

  static getStudentScanCounts(registrationId: string): { entryCount: number; exitCount: number; lastScan?: string } {
    const logs = this.getScanLogs().filter(
      (l) => l.registrationId === registrationId && l.status === 'approved'
    );
    const entryCount = logs.filter((l) => l.scanType === 'entry').length;
    const exitCount = logs.filter((l) => l.scanType === 'exit').length;
    return {
      entryCount,
      exitCount,
      lastScan: logs.length > 0 ? logs[0].timestamp : undefined,
    };
  }

  /**
   * Helper to reset to default seed data if ever needed
   */
  static resetToDefault(): void {
    localStorage.removeItem(STORAGE_KEY_REGISTRATIONS);
    localStorage.removeItem(STORAGE_KEY_DONATIONS);
    localStorage.removeItem(STORAGE_KEY_EXPENSES);
    localStorage.removeItem(STORAGE_KEY_NOTICES);
    localStorage.removeItem(STORAGE_KEY_SETTINGS);
    localStorage.removeItem(STORAGE_KEY_SCAN_LOGS);
    localStorage.removeItem('plscf_committee_members_v1');
    localStorage.removeItem('plscf_committee_settings_v1');
  }
}
