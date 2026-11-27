/**
 * Committee Service
 * Manages Organizing Committee members and carousel/grid display settings.
 * Synchronizes with Supabase PostgreSQL tables (`organizing_committee_members`, `organizing_committee_settings`),
 * Supabase Realtime channel, cross-tab BroadcastChannel, and fallback local caching.
 */

import { CommitteeMember, CommitteeSettings } from '../types';
import { supabase } from './supabase';
import {
  compressStudentPhoto,
  validateStudentImage,
  PhotoUploadResult,
} from './studentPhotoStorageService';

export const COMMITTEE_PHOTOS_BUCKET = 'committee-photos';
export const COMMITTEE_MEMBERS_TABLE = 'organizing_committee_members';
export const COMMITTEE_SETTINGS_TABLE = 'organizing_committee_settings';

export function buildCommitteePhotoStoragePath(
  memberIdOrName?: string,
  extension: string = 'webp'
): string {
  const cleanSlug = (memberIdOrName || 'member')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'member';
  const ext = extension.replace(/^\./, '').toLowerCase() || 'webp';
  return `members/${cleanSlug}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
}

const STORAGE_KEY_MEMBERS = 'plscf_committee_members_v1';
const STORAGE_KEY_SETTINGS = 'plscf_committee_settings_v1';
const DATA_FILE_URL = '/data/committee_members.json';
const BROADCAST_CHANNEL_NAME = 'plscf_committee_sync';

export const DEFAULT_COMMITTEE_SETTINGS: CommitteeSettings = {
  displayMode: 'carousel',
  autoScrollSpeedMs: 3500,
  sectionTitleEn: 'Reunion 2027 Organizing Committee',
  sectionTitleBn: 'পুনর্মিলনী ২০২৭ পরিচালনা পরিষদ',
  sectionSubtitleEn: 'Joint organizing leadership by District Police Administration and Senior Alumni.',
  sectionSubtitleBn: 'জেলা পুলিশ প্রশাসন ও অ্যালামনাই নেতৃবৃন্দের সমন্বয়ে গঠিত পরিচালনা পর্ষদ।',
};

export const DEFAULT_COMMITTEE_MEMBERS: CommitteeMember[] = [
  {
    id: 'COM-01',
    name: 'Dr. M. A. Kashem',
    nameBn: 'ড. এম. এ. কাশেম',
    role: 'Convenor (আহ্বায়ক)',
    roleBn: 'আহ্বায়ক',
    desc: '1974 SSC Batch • Senior Civil Servant',
    descBn: '১৯৭৪ এসএসসি ব্যাচ • সাবেক সচিব',
    batch: '1974',
    img: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300&auto=format&fit=crop&q=80',
    order: 1,
    isActive: true,
  },
  {
    id: 'COM-02',
    name: 'Superintendent of Police',
    nameBn: 'পুলিশ সুপার, ফরিদপুর',
    role: 'Chief Patron (প্রধান পৃষ্ঠপোষক)',
    roleBn: 'প্রধান পৃষ্ঠপোষক',
    desc: 'Faridpur District Police Administration',
    descBn: 'ফরিদপুর জেলা পুলিশ প্রশাসন',
    batch: 'Administration',
    img: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=300&auto=format&fit=crop&q=80',
    order: 2,
    isActive: true,
  },
  {
    id: 'COM-03',
    name: 'Prof. Anwara Begum',
    nameBn: 'প্রফেসর আনোয়ার বেগম',
    role: 'Faculty Advisor (উপদেষ্টা)',
    roleBn: 'উপদেষ্টা',
    desc: 'Former Principal, Police Lines College',
    descBn: 'সাবেক অধ্যক্ষ, পুলিশ লাইন্স কলেজ',
    batch: 'Faculty',
    img: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=300&auto=format&fit=crop&q=80',
    order: 3,
    isActive: true,
  },
  {
    id: 'COM-04',
    name: 'Md. Shafiqul Alam',
    nameBn: 'মো. শফিকুল আলম',
    role: 'Member Secretary (সদস্য সচিব)',
    roleBn: 'সদস্য সচিব',
    desc: '1988 SSC Batch • Alumni Association',
    descBn: '১৯৮৮ এসএসসি ব্যাচ • অ্যালামনাই অ্যাসোসিয়েশন',
    batch: '1988',
    img: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80',
    order: 4,
    isActive: true,
  },
  {
    id: 'COM-05',
    name: 'Engr. Kazi Mahbubur Rahman',
    nameBn: 'প্রকৌশলী কাজী মাহবুবুর রহমান',
    role: 'Joint Convenor (যুগ্ম আহ্বায়ক)',
    roleBn: 'যুগ্ম আহ্বায়ক',
    desc: '1982 SSC Batch • Chief Engineer (Rtd.)',
    descBn: '১৯৮২ এসএসসি ব্যাচ • সাবেক প্রধান প্রকৌশলী',
    batch: '1982',
    img: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop&q=80',
    order: 5,
    isActive: true,
  },
  {
    id: 'COM-06',
    name: 'Advocate Farzana Yasmin',
    nameBn: 'অ্যাডভোকেট ফারজানা ইয়াসমিন',
    role: 'Legal & Protocol Advisor (আইন ও প্রটোকল)',
    roleBn: 'আইন ও প্রটোকল বিষয়ক সম্পাদক',
    desc: '1985 SSC Batch • District Bar Association',
    descBn: '১৯৮৫ এসএসসি ব্যাচ • জেলা আইনজীবী সমিতি',
    batch: '1985',
    img: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&auto=format&fit=crop&q=80',
    order: 6,
    isActive: true,
  },
  {
    id: 'COM-07',
    name: 'Brigadier General (Rtd.) Shamsul Huda',
    nameBn: 'ব্রিগেডিয়ার জেনারেল (অব.) শামসুল হুদা',
    role: 'Chief Security Advisor (নিরাপত্তা ও শৃঙ্খলা)',
    roleBn: 'নিরাপত্তা ও শৃঙ্খলা সমন্বয়ক',
    desc: '1978 SSC Batch • Veteran Alumni',
    descBn: '১৯৭৮ এসএসসি ব্যাচ • প্রবীণ অ্যালামনাই',
    batch: '1978',
    img: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=300&auto=format&fit=crop&q=80',
    order: 7,
    isActive: true,
  },
  {
    id: 'COM-08',
    name: 'Dr. Tanveer Ahmed',
    nameBn: 'ডা. তানভীর আহমেদ',
    role: 'Medical & Welfare Secretary (চিকিৎসা ও কল্যাণ)',
    roleBn: 'চিকিৎসা ও কল্যাণ সম্পাদক',
    desc: '1992 SSC Batch • Associate Professor, FMCH',
    descBn: '১৯৯২ এসএসসি ব্যাচ • সহযোগী অধ্যাপক, এফএমসিএইচ',
    batch: '1992',
    img: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=300&auto=format&fit=crop&q=80',
    order: 8,
    isActive: true,
  },
  {
    id: 'COM-09',
    name: 'Syed Nazrul Islam',
    nameBn: 'সৈয়দ নজরুল ইসলাম',
    role: 'Finance Secretary (অর্থ ও হিসাব সম্পাদক)',
    roleBn: 'অর্থ ও হিসাব সম্পাদক',
    desc: '1989 SSC Batch • Head of Treasury, Bank',
    descBn: '১৯৮৯ এসএসসি ব্যাচ • বিভাগীয় প্রধান, কমার্শিয়াল ব্যাংক',
    batch: '1989',
    img: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80',
    order: 9,
    isActive: true,
  },
  {
    id: 'COM-10',
    name: 'Nasreen Akter Banu',
    nameBn: 'নাসরিন আক্তার বানু',
    role: 'Cultural Secretary (সাংস্কৃতিক ও সংবর্ধনা)',
    roleBn: 'সাংস্কৃতিক ও সংবর্ধনা সম্পাদক',
    desc: '1994 SSC Batch • Cultural Activist & Educator',
    descBn: '১৯৯৪ এসএসসি ব্যাচ • সংস্কৃতিসেবী ও শিক্ষক',
    batch: '1994',
    img: 'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?w=300&auto=format&fit=crop&q=80',
    order: 10,
    isActive: true,
  },
  {
    id: 'COM-11',
    name: 'Mirza Golam Rabbani',
    nameBn: 'মির্জা গোলাম রব্বানী',
    role: 'IT & Registration Lead (নিবন্ধন ও প্রযুক্তি)',
    roleBn: 'নিবন্ধন ও প্রযুক্তি সমন্বয়ক',
    desc: '2002 SSC Batch • Enterprise Software Architect',
    descBn: '২০০২ এসএসসি ব্যাচ • এন্টারপ্রাইজ সফটওয়্যার স্থপতি',
    batch: '2002',
    img: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300&auto=format&fit=crop&q=80',
    order: 11,
    isActive: true,
  },
  {
    id: 'COM-12',
    name: 'Tahmina Sultana',
    nameBn: 'তাহমিনা সুলতানা',
    role: 'Souvenir & Publication (স্মরণিকা ও প্রকাশনা)',
    roleBn: 'স্মরণিকা ও প্রকাশনা সম্পাদক',
    desc: '1996 SSC Batch • Senior Journalist & Writer',
    descBn: '১৯৯৬ এসএসসি ব্যাচ • জ্যেষ্ঠ সাংবাদিক ও লেখক',
    batch: '1996',
    img: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&auto=format&fit=crop&q=80',
    order: 12,
    isActive: true,
  },
  {
    id: 'COM-13',
    name: 'Kamrul Hasan Jewel',
    nameBn: 'কামরুল হাসান জুয়েল',
    role: 'Food & Catering Lead (খাদ্য ও আপ্যায়ন)',
    roleBn: 'খাদ্য ও আপ্যায়ন সম্পাদক',
    desc: '1998 SSC Batch • Hospitality Entrepreneur',
    descBn: '১৯৯৮ এসএসসি ব্যাচ • আতিথেয়তা উদ্যোক্তা',
    batch: '1998',
    img: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=300&auto=format&fit=crop&q=80',
    order: 13,
    isActive: true,
  },
  {
    id: 'COM-14',
    name: 'Asaduzzaman Ripon',
    nameBn: 'আসাদুজ্জামান রিপন',
    role: 'Logistics & Venue (লজিস্টিকস ও ভেন্যু)',
    roleBn: 'লজিস্টিকস ও ভেন্যু সম্পাদক',
    desc: '1995 SSC Batch • Event Management Specialist',
    descBn: '১৯৯৫ এসএসসি ব্যাচ • ইভেন্ট ম্যানেজমেন্ট বিশেষজ্ঞ',
    batch: '1995',
    img: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=300&auto=format&fit=crop&q=80',
    order: 14,
    isActive: true,
  },
  {
    id: 'COM-15',
    name: 'Rezaul Karim Babul',
    nameBn: 'রেজাউল করিম বাবুল',
    role: 'Public Relations & Media (জনসংযোগ ও গণমাধ্যম)',
    roleBn: 'জনসংযোগ ও গণমাধ্যম সমন্বয়ক',
    desc: '1991 SSC Batch • Senior News Editor',
    descBn: '১৯৯১ এসএসসি ব্যাচ • জ্যেষ্ঠ বার্তা সম্পাদক',
    batch: '1991',
    img: 'https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?w=300&auto=format&fit=crop&q=80',
    order: 15,
    isActive: true,
  },
  {
    id: 'COM-16',
    name: 'Mahmudul Hasan Shuvo',
    nameBn: 'মাহমুদুল হাসান শুভ',
    role: 'Youth & Volunteers Lead (যুব ও স্বেচ্ছাসেবক)',
    roleBn: 'যুব ও স্বেচ্ছাসেবক সমন্বয়ক',
    desc: '2012 SSC Batch • Alumni Volunteer Brigade Lead',
    descBn: '২০১২ এসএসসি ব্যাচ • অ্যালামনাই স্বেচ্ছাসেবী দলনেতা',
    batch: '2012',
    img: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300&auto=format&fit=crop&q=80',
    order: 16,
    isActive: true,
  },
];

// Helper: Convert CommitteeMember to database row
export function memberToRow(m: CommitteeMember): Record<string, any> {
  return {
    id: m.id,
    name: m.name,
    name_bn: m.nameBn || null,
    role: m.role,
    role_bn: m.roleBn || null,
    description: m.desc || '',
    description_bn: m.descBn || null,
    batch: m.batch || null,
    image_url: m.img || '',
    display_order: m.order !== undefined ? m.order : 1,
    phone: m.phone || null,
    email: m.email || null,
    is_active: m.isActive !== false,
    updated_at: new Date().toISOString(),
  };
}

// Helper: Convert database row to CommitteeMember
export function rowToMember(r: Record<string, any>): CommitteeMember {
  return {
    id: String(r.id),
    name: String(r.name || ''),
    nameBn: r.name_bn ? String(r.name_bn) : undefined,
    role: String(r.role || ''),
    roleBn: r.role_bn ? String(r.role_bn) : undefined,
    desc: String(r.description || ''),
    descBn: r.description_bn ? String(r.description_bn) : undefined,
    batch: r.batch ? String(r.batch) : undefined,
    img: String(r.image_url || ''),
    order: Number(r.display_order ?? 1),
    phone: r.phone ? String(r.phone) : undefined,
    email: r.email ? String(r.email) : undefined,
    isActive: r.is_active !== false,
    createdAt: r.created_at ? String(r.created_at) : undefined,
    updatedAt: r.updated_at ? String(r.updated_at) : undefined,
  };
}

// Helper: Convert settings to database row
export function settingsToRow(s: CommitteeSettings): Record<string, any> {
  return {
    id: 'singleton',
    display_mode: s.displayMode || 'carousel',
    auto_scroll_speed_ms: s.autoScrollSpeedMs || 3500,
    section_title_en: s.sectionTitleEn || DEFAULT_COMMITTEE_SETTINGS.sectionTitleEn,
    section_title_bn: s.sectionTitleBn || DEFAULT_COMMITTEE_SETTINGS.sectionTitleBn,
    section_subtitle_en: s.sectionSubtitleEn || DEFAULT_COMMITTEE_SETTINGS.sectionSubtitleEn,
    section_subtitle_bn: s.sectionSubtitleBn || DEFAULT_COMMITTEE_SETTINGS.sectionSubtitleBn,
    updated_at: new Date().toISOString(),
  };
}

// Helper: Convert database row to settings
export function rowToSettings(r: Record<string, any>): CommitteeSettings {
  return {
    displayMode: (r.display_mode === 'grid' ? 'grid' : 'carousel') as 'carousel' | 'grid',
    autoScrollSpeedMs: Number(r.auto_scroll_speed_ms || 3500),
    sectionTitleEn: String(r.section_title_en || DEFAULT_COMMITTEE_SETTINGS.sectionTitleEn),
    sectionTitleBn: String(r.section_title_bn || DEFAULT_COMMITTEE_SETTINGS.sectionTitleBn),
    sectionSubtitleEn: String(r.section_subtitle_en || DEFAULT_COMMITTEE_SETTINGS.sectionSubtitleEn),
    sectionSubtitleBn: String(r.section_subtitle_bn || DEFAULT_COMMITTEE_SETTINGS.sectionSubtitleBn),
  };
}

// In-memory fallback
const memoryStore: Record<string, string> = {};

function getLocalStore<T>(key: string, defaultValue: T): T {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const item = window.localStorage.getItem(key);
      if (!item) return defaultValue;
      return JSON.parse(item);
    }
    const item = memoryStore[key];
    if (!item) return defaultValue;
    return JSON.parse(item);
  } catch {
    return defaultValue;
  }
}

function setLocalStore<T>(key: string, value: T): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, JSON.stringify(value));
      return;
    }
    memoryStore[key] = JSON.stringify(value);
  } catch {
    try {
      memoryStore[key] = JSON.stringify(value);
    } catch (_) {}
  }
}

// Broadcast Channel for Instant Cross-Tab Sync
let broadcastChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    broadcastChannel.onmessage = (event) => {
      if (event.data?.type === 'MEMBERS_UPDATED' && Array.isArray(event.data.payload)) {
        setLocalStore(STORAGE_KEY_MEMBERS, event.data.payload);
        window.dispatchEvent(new CustomEvent('plscf_committee_updated', { detail: event.data.payload }));
      } else if (event.data?.type === 'SETTINGS_UPDATED' && event.data.payload) {
        setLocalStore(STORAGE_KEY_SETTINGS, event.data.payload);
        window.dispatchEvent(new CustomEvent('plscf_committee_settings_updated', { detail: event.data.payload }));
      }
    };
  } catch (_) {}
}

let realtimeSubscribed = false;
function ensureRealtimeSubscription() {
  if (realtimeSubscribed || typeof window === 'undefined') return;
  try {
    supabase
      .channel('organizing_committee_realtime_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: COMMITTEE_MEMBERS_TABLE }, async () => {
        const fresh = await CommitteeService.fetchFromSupabase();
        if (fresh.success && fresh.data.length > 0) {
          CommitteeService.saveMembersLocallyAndNotify(fresh.data, false);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: COMMITTEE_SETTINGS_TABLE }, async () => {
        const freshSettings = await CommitteeService.fetchSettingsFromSupabase();
        if (freshSettings.success && freshSettings.data) {
          CommitteeService.saveSettingsLocallyAndNotify(freshSettings.data, false);
        }
      })
      .subscribe();
    realtimeSubscribed = true;
  } catch (_) {}
}

export class CommitteeService {
  /**
   * Returns current committee members sorted by order (synchronous read from memory/local store).
   */
  static getMembers(): CommitteeMember[] {
    const members = getLocalStore<CommitteeMember[]>(STORAGE_KEY_MEMBERS, []);
    if (Array.isArray(members) && members.length > 0) {
      return [...members].sort((a, b) => (a.order || 0) - (b.order || 0));
    }
    // Return default 16 members
    return [...DEFAULT_COMMITTEE_MEMBERS].sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  /**
   * Direct fetch of all committee members from Supabase table.
   */
  static async fetchFromSupabase(): Promise<{ success: boolean; data: CommitteeMember[]; error?: string }> {
    try {
      const { data, error } = await supabase
        .from(COMMITTEE_MEMBERS_TABLE)
        .select('*')
        .order('display_order', { ascending: true });

      if (error) {
        return { success: false, data: this.getMembers(), error: error.message };
      }

      if (Array.isArray(data) && data.length > 0) {
        const mapped = data.map(rowToMember).sort((a, b) => (a.order || 0) - (b.order || 0));
        return { success: true, data: mapped };
      }

      return { success: true, data: [] };
    } catch (err: any) {
      return { success: false, data: this.getMembers(), error: err?.message || 'Database query failed' };
    }
  }

  /**
   * Direct fetch of committee settings from Supabase table.
   */
  static async fetchSettingsFromSupabase(): Promise<{ success: boolean; data: CommitteeSettings; error?: string }> {
    try {
      const { data, error } = await supabase
        .from(COMMITTEE_SETTINGS_TABLE)
        .select('*')
        .eq('id', 'singleton')
        .maybeSingle();

      if (error) {
        return { success: false, data: this.getSettings(), error: error.message };
      }

      if (data) {
        const mapped = rowToSettings(data);
        return { success: true, data: mapped };
      }

      return { success: true, data: this.getSettings() };
    } catch (err: any) {
      return { success: false, data: this.getSettings(), error: err?.message || 'Failed to fetch settings' };
    }
  }

  /**
   * Asynchronously loads members from Supabase database.
   * If remote table is populated, syncs to local store.
   * If remote table is empty but local store has custom edits, auto-syncs local edits to Supabase.
   * Otherwise falls back to hosted JSON or default members.
   */
  static async loadMembers(): Promise<CommitteeMember[]> {
    ensureRealtimeSubscription();

    // 1. Try querying Supabase database
    try {
      const remote = await this.fetchFromSupabase();
      if (remote.success && remote.data.length > 0) {
        this.saveMembersLocallyAndNotify(remote.data, false);
        return remote.data;
      }

      // If database returned 0 rows, check if local store has customized members (e.g. from user edit)
      const local = getLocalStore<CommitteeMember[]>(STORAGE_KEY_MEMBERS, []);
      if (Array.isArray(local) && local.length > 0) {
        // Auto-seed local customized roster to Supabase
        await this.syncRosterToDatabase(local);
        return [...local].sort((a, b) => (a.order || 0) - (b.order || 0));
      }
    } catch (_) {}

    // 2. Try fetching from hosted public data file (/data/committee_members.json)
    try {
      if (typeof fetch !== 'undefined') {
        const resp = await fetch(DATA_FILE_URL);
        if (resp.ok) {
          const data: CommitteeMember[] = await resp.json();
          if (Array.isArray(data) && data.length > 0) {
            this.saveMembers(data);
            return [...data].sort((a, b) => (a.order || 0) - (b.order || 0));
          }
        }
      }
    } catch (_) {}

    // 3. Fallback to default 16 members
    this.saveMembers(DEFAULT_COMMITTEE_MEMBERS);
    return [...DEFAULT_COMMITTEE_MEMBERS].sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  /**
   * Saves members locally and dispatches events without re-triggering broadcast loops.
   */
  static saveMembersLocallyAndNotify(members: CommitteeMember[], broadcast = true): void {
    const sorted = [...members].sort((a, b) => (a.order || 0) - (b.order || 0));
    setLocalStore(STORAGE_KEY_MEMBERS, sorted);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('plscf_committee_updated', { detail: sorted }));

      if (broadcast && broadcastChannel) {
        try {
          broadcastChannel.postMessage({ type: 'MEMBERS_UPDATED', payload: sorted });
        } catch (_) {}
      }
    }
  }

  /**
   * Saves members locally and asynchronously syncs to Supabase.
   */
  static saveMembers(members: CommitteeMember[]): void {
    this.saveMembersLocallyAndNotify(members, true);
    // Background database sync
    this.syncRosterToDatabase(members).catch((err) => {
      console.warn('Background Supabase committee sync notice:', err);
    });
  }

  /**
   * Adds a new member, saves to local store, and upserts to Supabase database.
   */
  static addMember(member: Partial<CommitteeMember>): CommitteeMember {
    const current = this.getMembers();
    const newId = member.id || `COM-${Date.now().toString().slice(-4)}`;
    const maxOrder = current.reduce((max, m) => Math.max(max, m.order || 0), 0);
    const newMember: CommitteeMember = {
      ...member,
      id: newId,
      name: member.name || '',
      role: member.role || '',
      desc: member.desc || '',
      img: member.img || '',
      order: member.order !== undefined ? member.order : maxOrder + 1,
      isActive: member.isActive !== false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const updated = [...current, newMember];
    this.saveMembersLocallyAndNotify(updated, true);

    // Asynchronously upsert to Supabase
    (async () => {
      try {
        const { error } = await supabase
          .from(COMMITTEE_MEMBERS_TABLE)
          .upsert(memberToRow(newMember), { onConflict: 'id' });
        if (error) console.error('Failed to add committee member to Supabase:', error.message);
      } catch (err: any) {
        console.error('Exception adding committee member to Supabase:', err);
      }
    })();

    return newMember;
  }

  /**
   * Updates an existing member, saves locally, and upserts to Supabase database.
   */
  static updateMember(id: string, updates: Partial<CommitteeMember>): CommitteeMember | null {
    const current = this.getMembers();
    const idx = current.findIndex((m) => m.id === id);
    if (idx === -1) return null;
    current[idx] = {
      ...current[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.saveMembersLocallyAndNotify(current, true);

    // Asynchronously upsert to Supabase
    (async () => {
      try {
        const { error } = await supabase
          .from(COMMITTEE_MEMBERS_TABLE)
          .upsert(memberToRow(current[idx]), { onConflict: 'id' });
        if (error) console.error('Failed to update committee member in Supabase:', error.message);
      } catch (err: any) {
        console.error('Exception updating committee member in Supabase:', err);
      }
    })();

    return current[idx];
  }

  /**
   * Deletes a member locally and from Supabase database.
   */
  static deleteMember(id: string): boolean {
    const current = this.getMembers();
    const filtered = current.filter((m) => m.id !== id);
    if (filtered.length === current.length) return false;
    this.saveMembersLocallyAndNotify(filtered, true);

    // Asynchronously delete from Supabase
    (async () => {
      try {
        const { error } = await supabase
          .from(COMMITTEE_MEMBERS_TABLE)
          .delete()
          .eq('id', id);
        if (error) console.error('Failed to delete committee member from Supabase:', error.message);
      } catch (err: any) {
        console.error('Exception deleting committee member from Supabase:', err);
      }
    })();

    return true;
  }

  /**
   * Reorders member upwards or downwards and updates orders in Supabase database.
   */
  static reorderMember(id: string, direction: 'up' | 'down'): boolean {
    const current = this.getMembers();
    const idx = current.findIndex((m) => m.id === id);
    if (idx === -1) return false;

    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= current.length) return false;

    // Swap positions
    const temp = current[idx];
    current[idx] = current[targetIdx];
    current[targetIdx] = temp;

    // Renumber orders sequentially
    current.forEach((m, i) => {
      m.order = i + 1;
    });

    this.saveMembersLocallyAndNotify(current, true);

    // Asynchronously update all orders in Supabase
    (async () => {
      try {
        const rows = current.map(memberToRow);
        const { error } = await supabase
          .from(COMMITTEE_MEMBERS_TABLE)
          .upsert(rows, { onConflict: 'id' });
        if (error) console.error('Failed to sync reordered committee members to Supabase:', error.message);
      } catch (err: any) {
        console.error('Exception reordering committee members in Supabase:', err);
      }
    })();

    return true;
  }

  /**
   * Resets committee members to the initial 16 seed members and resets Supabase table.
   */
  static resetToDefault(): CommitteeMember[] {
    const fresh = JSON.parse(JSON.stringify(DEFAULT_COMMITTEE_MEMBERS));
    this.saveMembersLocallyAndNotify(fresh, true);

    // Asynchronously reset Supabase table
    (async () => {
      try {
        await supabase.from(COMMITTEE_MEMBERS_TABLE).delete().neq('id', 'NONE');
        const rows = fresh.map(memberToRow);
        await supabase.from(COMMITTEE_MEMBERS_TABLE).upsert(rows, { onConflict: 'id' });
      } catch (err) {
        console.error('Exception resetting committee members in Supabase:', err);
      }
    })();

    return fresh;
  }

  /**
   * Returns committee display settings.
   */
  static getSettings(): CommitteeSettings {
    const saved = getLocalStore<Partial<CommitteeSettings>>(STORAGE_KEY_SETTINGS, {});
    return {
      ...DEFAULT_COMMITTEE_SETTINGS,
      ...saved,
    };
  }

  /**
   * Saves settings locally and dispatches events.
   */
  static saveSettingsLocallyAndNotify(settings: CommitteeSettings, broadcast = true): void {
    setLocalStore(STORAGE_KEY_SETTINGS, settings);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('plscf_committee_settings_updated', { detail: settings }));

      if (broadcast && broadcastChannel) {
        try {
          broadcastChannel.postMessage({ type: 'SETTINGS_UPDATED', payload: settings });
        } catch (_) {}
      }
    }
  }

  /**
   * Saves committee display settings and upserts to Supabase database.
   */
  static saveSettings(settings: Partial<CommitteeSettings>): CommitteeSettings {
    const current = this.getSettings();
    const updated: CommitteeSettings = { ...current, ...settings };
    this.saveSettingsLocallyAndNotify(updated, true);

    // Asynchronously upsert to Supabase
    (async () => {
      try {
        const { error } = await supabase
          .from(COMMITTEE_SETTINGS_TABLE)
          .upsert(settingsToRow(updated), { onConflict: 'id' });
        if (error) console.error('Failed to save committee settings to Supabase:', error.message);
      } catch (err: any) {
        console.error('Exception saving committee settings to Supabase:', err);
      }
    })();

    return updated;
  }

  /**
   * Force-syncs the entire roster into Supabase PostgreSQL database.
   */
  static async syncRosterToDatabase(members: CommitteeMember[]): Promise<{ success: boolean; error?: string }> {
    try {
      const rows = members.map(memberToRow);
      const { error: upsertErr } = await supabase
        .from(COMMITTEE_MEMBERS_TABLE)
        .upsert(rows, { onConflict: 'id' });

      if (upsertErr) {
        return { success: false, error: upsertErr.message };
      }

      // Cleanup any deleted IDs from Supabase
      const keepIds = members.map((m) => m.id);
      if (keepIds.length > 0) {
        const { data: remoteRows } = await supabase
          .from(COMMITTEE_MEMBERS_TABLE)
          .select('id');
        if (Array.isArray(remoteRows)) {
          const toDelete = remoteRows.filter((r) => !keepIds.includes(r.id)).map((r) => r.id);
          if (toDelete.length > 0) {
            await supabase.from(COMMITTEE_MEMBERS_TABLE).delete().in('id', toDelete);
          }
        }
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Database synchronization failed' };
    }
  }

  /**
   * Validates, compresses, and uploads a committee member photo to Supabase Storage.
   */
  static async uploadMemberPhoto(
    file: File | Blob,
    memberIdOrName?: string
  ): Promise<PhotoUploadResult> {
    try {
      const validation = await validateStudentImage(file);
      if (!validation.valid) {
        return {
          success: false,
          storagePath: '',
          publicUrl: '',
          error: validation.error || 'Invalid image file.',
        };
      }

      const compressed = await compressStudentPhoto(file, {
        maxDimension: 800,
        maxBytes: 150 * 1024,
        preferredMime: 'image/webp',
      });
      const extension = compressed.mimeType.includes('webp')
        ? 'webp'
        : compressed.mimeType.includes('png')
        ? 'png'
        : 'jpg';
      const storagePath = buildCommitteePhotoStoragePath(memberIdOrName, extension);

      const { error } = await supabase.storage
        .from(COMMITTEE_PHOTOS_BUCKET)
        .upload(storagePath, compressed.blob, {
          contentType: compressed.mimeType,
          upsert: false,
          cacheControl: '31536000',
        });

      if (error) {
        return {
          success: false,
          storagePath: '',
          publicUrl: '',
          error: error.message || 'Failed to upload photo to Supabase Storage.',
        };
      }

      const { data: pub } = supabase.storage
        .from(COMMITTEE_PHOTOS_BUCKET)
        .getPublicUrl(storagePath);

      return {
        success: true,
        storagePath,
        publicUrl: pub?.publicUrl || '',
        sizeBytes: compressed.sizeBytes,
      };
    } catch (err: any) {
      return {
        success: false,
        storagePath: '',
        publicUrl: '',
        error: err?.message || 'Unexpected error uploading committee photo.',
      };
    }
  }
}
