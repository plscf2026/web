/**
 * International Payment CMS & Settings Service
 * Stores and synchronizes international wire/remittance instructions via
 * Supabase (`system_settings.key = 'international_payment_info'`) and localStorage.
 */

import { supabase } from './supabase';

export const INTERNATIONAL_PAYMENT_STORAGE_KEY = 'plscf_international_payment_info_v1';
export const EVENT_INTERNATIONAL_PAYMENT_UPDATED = 'plscf_international_payment_updated';
const SETTINGS_KEY = 'international_payment_info';

export interface InternationalPaymentInfo {
  isEnabled: boolean;
  badgeEn: string;
  badgeBn: string;
  titleEn: string;
  titleBn: string;
  subtitleEn: string;
  subtitleBn: string;
  eventTitleEn: string;
  eventTitleBn: string;
  bankName: string;
  branchName: string;
  branchAddress: string;
  accountName: string;
  accountNumber: string;
  routingNumber: string;
  swiftCode: string;
  mobileNumber: string;
  contactEmail: string;
  instructionsEn: string;
  instructionsBn: string;
  footerNoteEn: string;
  footerNoteBn: string;
  updatedBy?: string;
  updatedAt?: string;
}

export const DEFAULT_INTERNATIONAL_PAYMENT_INFO: InternationalPaymentInfo = {
  isEnabled: true,
  badgeEn: 'International Remittance & Wire Transfer',
  badgeBn: 'আন্তর্জাতিক পেমেন্ট ও ব্যাংক রেমিট্যান্স',
  titleEn: 'International Payment Details',
  titleBn: 'আন্তর্জাতিক পেমেন্ট তথ্য',
  subtitleEn:
    'For alumni, well-wishers, and donors contributing from outside Bangladesh via international bank transfer or remittance.',
  subtitleBn:
    'বাংলাদেশের বাইরে অবস্থানরত প্রাক্তন শিক্ষার্থী ও শুভাকাঙ্ক্ষীদের জন্য আন্তর্জাতিক ব্যাংক ট্রান্সফার বা রেমিট্যান্সের মাধ্যমে অনুদান ও পেমেন্টের তথ্য।',
  eventTitleEn: 'Police Lines School & College, Faridpur — Grand Reunion 2027 (65 Years Celebration)',
  eventTitleBn: 'পুলিশ লাইন্স স্কুল অ্যান্ড কলেজ, ফরিদপুর — গ্র্যান্ড পুনর্মিলনী ২০২৭ (৬৫ বছর পূর্তি)',
  bankName: 'Sonali Bank PLC',
  branchName: 'Faridpur Corporate Branch',
  branchAddress: 'Faridpur Sadar, Faridpur-7800, Bangladesh',
  accountName: 'PLSCF Reunion Organizing Committee',
  accountNumber: 'Update from Super Admin Portal',
  routingNumber: 'Update from Super Admin Portal',
  swiftCode: 'BSONBDDH',
  mobileNumber: '+880 1637-85 7040 / +880 1309-026240',
  contactEmail: 'sagarsaha3371@gmail.com',
  instructionsEn:
    '1. Use the bank account, routing number, and SWIFT code above for international wire or remittance.\n2. Mention your Full Name, SSC/HSC Batch Year, Mobile/WhatsApp Number, and Purpose (Registration or Donation) in the transfer reference.\n3. After completing the transfer, send a screenshot or bank slip to WhatsApp (+880 1637-85 7040 / +880 1309-026240) or email (sagarsaha3371@gmail.com) for verification and receipt.',
  instructionsBn:
    '১. আন্তর্জাতিক ব্যাংক ট্রান্সফার বা রেমিট্যান্স পাঠাতে উপরের ব্যাংক অ্যাকাউন্ট নম্বর, রাউটিং নম্বর এবং সুইফট কোড ব্যবহার করুন।\n২. ট্রান্সফার রেফারেন্সে আপনার পূর্ণ নাম, ব্যাচ/পাসের সন, মোবাইল/হোয়াটসঅ্যাপ নম্বর এবং উদ্দেশ্য (রেজিস্ট্রেশন বা অনুদান) উল্লেখ করুন।\n৩. লেনদেন সম্পন্ন করার পর নিশ্চিতকরণ ও রসিদের জন্য ট্রান্সফার স্লিপ বা স্ক্রিনশট +880 1637-85 7040 / +880 1309-026240 (WhatsApp) অথবা sagarsaha3371@gmail.com ইমেইলে পাঠান।',
  footerNoteEn:
    'Verified international transfers are recorded in the central reunion financial ledger and receive an official confirmation.',
  footerNoteBn:
    'যাচাইকৃত আন্তর্জাতিক ট্রান্সফারসমূহ কেন্দ্রীয় পুনর্মিলনী আর্থিক লেজারে সংরক্ষণ করা হয় এবং অফিসিয়াল নিশ্চিতকরণ প্রদান করা হয়।',
  updatedBy: 'System Default',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

export function normalizeInternationalPaymentInfo(
  raw: Record<string, any> | null | undefined
): InternationalPaymentInfo {
  const d = DEFAULT_INTERNATIONAL_PAYMENT_INFO;
  if (!raw || typeof raw !== 'object') return { ...d };

  return {
    isEnabled: typeof raw.isEnabled === 'boolean' ? raw.isEnabled : d.isEnabled,
    badgeEn: String(raw.badgeEn ?? d.badgeEn),
    badgeBn: String(raw.badgeBn ?? d.badgeBn),
    titleEn: String(raw.titleEn ?? d.titleEn),
    titleBn: String(raw.titleBn ?? d.titleBn),
    subtitleEn: String(raw.subtitleEn ?? d.subtitleEn),
    subtitleBn: String(raw.subtitleBn ?? d.subtitleBn),
    eventTitleEn: String(raw.eventTitleEn ?? d.eventTitleEn),
    eventTitleBn: String(raw.eventTitleBn ?? d.eventTitleBn),
    bankName: String(raw.bankName ?? d.bankName),
    branchName: String(raw.branchName ?? d.branchName),
    branchAddress: String(raw.branchAddress ?? d.branchAddress),
    accountName: String(raw.accountName ?? d.accountName),
    accountNumber: String(raw.accountNumber ?? d.accountNumber),
    routingNumber: String(raw.routingNumber ?? d.routingNumber),
    swiftCode: String(raw.swiftCode ?? d.swiftCode),
    mobileNumber: String(raw.mobileNumber ?? d.mobileNumber),
    contactEmail: String(raw.contactEmail ?? d.contactEmail),
    instructionsEn: String(raw.instructionsEn ?? d.instructionsEn),
    instructionsBn: String(raw.instructionsBn ?? d.instructionsBn),
    footerNoteEn: String(raw.footerNoteEn ?? d.footerNoteEn),
    footerNoteBn: String(raw.footerNoteBn ?? d.footerNoteBn),
    updatedBy: raw.updatedBy ?? d.updatedBy,
    updatedAt: raw.updatedAt ?? d.updatedAt,
  };
}

type Listener = (info: InternationalPaymentInfo) => void;

export class InternationalPaymentService {
  private static listeners = new Set<Listener>();

  static getInfo(): InternationalPaymentInfo {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(INTERNATIONAL_PAYMENT_STORAGE_KEY);
        if (raw) {
          return normalizeInternationalPaymentInfo(JSON.parse(raw));
        }
      }
    } catch (_) {}
    return { ...DEFAULT_INTERNATIONAL_PAYMENT_INFO };
  }

  static setLocalCache(info: InternationalPaymentInfo, broadcast = true): void {
    const normalized = normalizeInternationalPaymentInfo(info);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(INTERNATIONAL_PAYMENT_STORAGE_KEY, JSON.stringify(normalized));
      }
    } catch (_) {}

    this.listeners.forEach((cb) => {
      try {
        cb(normalized);
      } catch (_) {}
    });

    if (broadcast && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(EVENT_INTERNATIONAL_PAYMENT_UPDATED, { detail: normalized }));
    }
  }

  static subscribe(cb: Listener): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  static async fetchFromSupabase(): Promise<{
    success: boolean;
    data: InternationalPaymentInfo;
    error?: string;
  }> {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('value, updated_at, updated_by')
        .eq('key', SETTINGS_KEY)
        .maybeSingle();

      if (error) {
        return { success: false, data: this.getInfo(), error: error.message };
      }

      if (data?.value && typeof data.value === 'object') {
        const mapped = normalizeInternationalPaymentInfo({
          ...(data.value as Record<string, any>),
          updatedAt: data.updated_at || (data.value as any).updatedAt,
          updatedBy: data.updated_by || (data.value as any).updatedBy,
        });
        this.setLocalCache(mapped, true);
        return { success: true, data: mapped };
      }

      return { success: true, data: this.getInfo() };
    } catch (err: any) {
      return {
        success: false,
        data: this.getInfo(),
        error: err?.message || 'Failed to load international payment settings.',
      };
    }
  }

  static async saveToSupabase(
    info: InternationalPaymentInfo,
    adminName = 'Super Admin'
  ): Promise<{ success: boolean; data: InternationalPaymentInfo; error?: string }> {
    const nowIso = new Date().toISOString();
    const cleaned = normalizeInternationalPaymentInfo({
      ...info,
      updatedBy: adminName,
      updatedAt: nowIso,
    });

    try {
      const { data, error } = await supabase
        .from('system_settings')
        .upsert(
          {
            key: SETTINGS_KEY,
            value: cleaned,
            updated_by: adminName,
            updated_at: nowIso,
          },
          { onConflict: 'key' }
        )
        .select('value, updated_at, updated_by')
        .single();

      if (error) {
        return { success: false, data: cleaned, error: error.message };
      }

      const saved = normalizeInternationalPaymentInfo(
        (data?.value as Record<string, any>) || cleaned
      );
      this.setLocalCache(saved, true);
      return { success: true, data: saved };
    } catch (err: any) {
      return {
        success: false,
        data: cleaned,
        error: err?.message || 'Database save failed.',
      };
    }
  }
}
