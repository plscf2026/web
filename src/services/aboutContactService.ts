/**
 * About & Contact Page CMS Service
 * Police Lines School & College, Faridpur — Grand Reunion 2027
 *
 * Persists all About & Contact page edits to Supabase (`about_contact_content`)
 * and broadcasts immediate updates to all connected users via:
 * 1. Supabase Realtime (`postgres_changes` channel)
 * 2. Cross-tab BroadcastChannel (`plscf_about_contact_sync`)
 * 3. In-tab window CustomEvent (`plscf_about_contact_updated`) & listener registry
 * 4. Visibility/focus refresh fallback
 */

import { supabase } from './supabase';
import {
  AboutContactContent,
  AboutObjectiveItem,
  DEFAULT_ABOUT_CONTACT_CONTENT,
} from '../types/aboutContact';

export const ABOUT_CONTACT_STORAGE_KEY = 'plscf_about_contact_content_v1';
export const EVENT_ABOUT_CONTACT_UPDATED = 'plscf_about_contact_updated';
const BROADCAST_CHANNEL_NAME = 'plscf_about_contact_sync';
const SINGLETON_ID = 'singleton';

type ContentListener = (content: AboutContactContent) => void;

function sanitizeObjectives(raw: unknown): AboutObjectiveItem[] {
  if (!Array.isArray(raw)) {
    return DEFAULT_ABOUT_CONTACT_CONTENT.objectives;
  }
  const normalized = raw
    .filter((item): item is Record<string, any> => Boolean(item && typeof item === 'object'))
    .map((item, idx) => ({
      id: String(item.id || `obj-${idx + 1}`),
      titleEn: String(item.titleEn ?? item.title_en ?? ''),
      titleBn: String(item.titleBn ?? item.title_bn ?? ''),
      descriptionEn: String(item.descriptionEn ?? item.description_en ?? ''),
      descriptionBn: String(item.descriptionBn ?? item.description_bn ?? ''),
    }));
  return normalized.length > 0 ? normalized : DEFAULT_ABOUT_CONTACT_CONTENT.objectives;
}

export function rowToAboutContactContent(row: Record<string, any> | null | undefined): AboutContactContent {
  if (!row) return { ...DEFAULT_ABOUT_CONTACT_CONTENT };

  const d = DEFAULT_ABOUT_CONTACT_CONTENT;
  return {
    id: String(row.id || SINGLETON_ID),
    institutionSubtitleEn: String(row.institution_subtitle_en ?? row.institutionSubtitleEn ?? d.institutionSubtitleEn),
    institutionSubtitleBn: String(row.institution_subtitle_bn ?? row.institutionSubtitleBn ?? d.institutionSubtitleBn),
    aboutHeadingEn: String(row.about_heading_en ?? row.aboutHeadingEn ?? d.aboutHeadingEn),
    aboutHeadingBn: String(row.about_heading_bn ?? row.aboutHeadingBn ?? d.aboutHeadingBn),
    taglineEn: String(row.tagline_en ?? row.taglineEn ?? d.taglineEn),
    taglineBn: String(row.tagline_bn ?? row.taglineBn ?? d.taglineBn),

    historyTitleEn: String(row.history_title_en ?? row.historyTitleEn ?? d.historyTitleEn),
    historyTitleBn: String(row.history_title_bn ?? row.historyTitleBn ?? d.historyTitleBn),
    historyContentEn: String(row.history_content_en ?? row.historyContentEn ?? d.historyContentEn),
    historyContentBn: String(row.history_content_bn ?? row.historyContentBn ?? d.historyContentBn),

    locationLabelEn: String(row.location_label_en ?? row.locationLabelEn ?? d.locationLabelEn),
    locationLabelBn: String(row.location_label_bn ?? row.locationLabelBn ?? d.locationLabelBn),
    locationValueEn: String(row.location_value_en ?? row.locationValueEn ?? d.locationValueEn),
    locationValueBn: String(row.location_value_bn ?? row.locationValueBn ?? d.locationValueBn),

    affiliationLabelEn: String(row.affiliation_label_en ?? row.affiliationLabelEn ?? d.affiliationLabelEn),
    affiliationLabelBn: String(row.affiliation_label_bn ?? row.affiliationLabelBn ?? d.affiliationLabelBn),
    affiliationValueEn: String(row.affiliation_value_en ?? row.affiliationValueEn ?? d.affiliationValueEn),
    affiliationValueBn: String(row.affiliation_value_bn ?? row.affiliationValueBn ?? d.affiliationValueBn),

    patronLabelEn: String(row.patron_label_en ?? row.patronLabelEn ?? d.patronLabelEn),
    patronLabelBn: String(row.patron_label_bn ?? row.patronLabelBn ?? d.patronLabelBn),
    patronValueEn: String(row.patron_value_en ?? row.patronValueEn ?? d.patronValueEn),
    patronValueBn: String(row.patron_value_bn ?? row.patronValueBn ?? d.patronValueBn),

    campusImageUrl: String(row.campus_image_url ?? row.campusImageUrl ?? d.campusImageUrl),

    objectivesHeadingEn: String(row.objectives_heading_en ?? row.objectivesHeadingEn ?? d.objectivesHeadingEn),
    objectivesHeadingBn: String(row.objectives_heading_bn ?? row.objectivesHeadingBn ?? d.objectivesHeadingBn),
    objectives: sanitizeObjectives(row.objectives),

    contactBadgeEn: String(row.contact_badge_en ?? row.contactBadgeEn ?? d.contactBadgeEn),
    contactBadgeBn: String(row.contact_badge_bn ?? row.contactBadgeBn ?? d.contactBadgeBn),
    helpdeskTitleEn: String(row.helpdesk_title_en ?? row.helpdeskTitleEn ?? d.helpdeskTitleEn),
    helpdeskTitleBn: String(row.helpdesk_title_bn ?? row.helpdeskTitleBn ?? d.helpdeskTitleBn),
    helpdeskSubtitleEn: String(row.helpdesk_subtitle_en ?? row.helpdeskSubtitleEn ?? d.helpdeskSubtitleEn),
    helpdeskSubtitleBn: String(row.helpdesk_subtitle_bn ?? row.helpdeskSubtitleBn ?? d.helpdeskSubtitleBn),

    addressEn: String(row.address_en ?? row.addressEn ?? d.addressEn),
    addressBn: String(row.address_bn ?? row.addressBn ?? d.addressBn),
    helplinePhoneEn: String(row.helpline_phone_en ?? row.helplinePhoneEn ?? d.helplinePhoneEn),
    helplinePhoneBn: String(row.helpline_phone_bn ?? row.helplinePhoneBn ?? d.helplinePhoneBn),
    helplineEmail: String(row.helpline_email ?? row.helplineEmail ?? d.helplineEmail),
    showInquiryForm:
      typeof row.show_inquiry_form === 'boolean'
        ? row.show_inquiry_form
        : typeof row.showInquiryForm === 'boolean'
        ? row.showInquiryForm
        : d.showInquiryForm,

    updatedBy: row.updated_by ?? row.updatedBy ?? d.updatedBy,
    updatedAt: row.updated_at ?? row.updatedAt ?? d.updatedAt,
  };
}

export function aboutContactContentToRow(content: AboutContactContent, adminName = 'Super Admin') {
  return {
    id: SINGLETON_ID,
    institution_subtitle_en: content.institutionSubtitleEn.trim(),
    institution_subtitle_bn: content.institutionSubtitleBn.trim(),
    about_heading_en: content.aboutHeadingEn.trim(),
    about_heading_bn: content.aboutHeadingBn.trim(),
    tagline_en: content.taglineEn.trim(),
    tagline_bn: content.taglineBn.trim(),

    history_title_en: content.historyTitleEn.trim(),
    history_title_bn: content.historyTitleBn.trim(),
    history_content_en: content.historyContentEn.trim(),
    history_content_bn: content.historyContentBn.trim(),

    location_label_en: content.locationLabelEn.trim(),
    location_label_bn: content.locationLabelBn.trim(),
    location_value_en: content.locationValueEn.trim(),
    location_value_bn: content.locationValueBn.trim(),

    affiliation_label_en: content.affiliationLabelEn.trim(),
    affiliation_label_bn: content.affiliationLabelBn.trim(),
    affiliation_value_en: content.affiliationValueEn.trim(),
    affiliation_value_bn: content.affiliationValueBn.trim(),

    patron_label_en: content.patronLabelEn.trim(),
    patron_label_bn: content.patronLabelBn.trim(),
    patron_value_en: content.patronValueEn.trim(),
    patron_value_bn: content.patronValueBn.trim(),

    campus_image_url: content.campusImageUrl.trim() || DEFAULT_ABOUT_CONTACT_CONTENT.campusImageUrl,

    objectives_heading_en: content.objectivesHeadingEn.trim(),
    objectives_heading_bn: content.objectivesHeadingBn.trim(),
    objectives: sanitizeObjectives(content.objectives),

    contact_badge_en: content.contactBadgeEn.trim(),
    contact_badge_bn: content.contactBadgeBn.trim(),
    helpdesk_title_en: content.helpdeskTitleEn.trim(),
    helpdesk_title_bn: content.helpdeskTitleBn.trim(),
    helpdesk_subtitle_en: content.helpdeskSubtitleEn.trim(),
    helpdesk_subtitle_bn: content.helpdeskSubtitleBn.trim(),

    address_en: content.addressEn.trim(),
    address_bn: content.addressBn.trim(),
    helpline_phone_en: content.helplinePhoneEn.trim(),
    helpline_phone_bn: content.helplinePhoneBn.trim(),
    helpline_email: content.helplineEmail.trim(),
    show_inquiry_form: Boolean(content.showInquiryForm),

    updated_by: adminName,
    updated_at: new Date().toISOString(),
  };
}

export class AboutContactService {
  private static cachedContent: AboutContactContent | null = null;
  private static listeners = new Set<ContentListener>();
  private static realtimeChannel: any = null;
  private static broadcastChannel: BroadcastChannel | null = null;
  private static syncRefCount = 0;

  static subscribe(listener: ContentListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private static notify(content: AboutContactContent) {
    this.listeners.forEach((fn) => {
      try {
        fn(content);
      } catch (_) {}
    });
    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new CustomEvent(EVENT_ABOUT_CONTACT_UPDATED, { detail: content }));
      } catch (_) {}
    }
  }

  static getContent(): AboutContactContent {
    if (this.cachedContent) {
      return this.cachedContent;
    }

    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem(ABOUT_CONTACT_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          const normalized = rowToAboutContactContent(parsed);
          this.cachedContent = normalized;
          return normalized;
        }
      } catch (_) {}
    }

    this.cachedContent = { ...DEFAULT_ABOUT_CONTACT_CONTENT };
    return this.cachedContent;
  }

  static setLocalCache(content: AboutContactContent, broadcast = true): void {
    const normalized = rowToAboutContactContent(content);
    this.cachedContent = normalized;

    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(ABOUT_CONTACT_STORAGE_KEY, JSON.stringify(normalized));
      } catch (_) {}

      if (broadcast && this.broadcastChannel) {
        try {
          this.broadcastChannel.postMessage({ type: 'UPDATED', payload: normalized });
        } catch (_) {}
      }
    }

    this.notify(normalized);
  }

  static async fetchFromSupabase(): Promise<{
    success: boolean;
    data: AboutContactContent;
    error?: string;
  }> {
    try {
      const { data, error } = await supabase
        .from('about_contact_content')
        .select('*')
        .eq('id', SINGLETON_ID)
        .maybeSingle();

      if (error) {
        return {
          success: false,
          data: this.getContent(),
          error: error.message,
        };
      }

      if (data) {
        const mapped = rowToAboutContactContent(data);
        this.setLocalCache(mapped, false);
        return { success: true, data: mapped };
      }

      // If row does not exist yet in DB, keep current defaults
      return { success: true, data: this.getContent() };
    } catch (err: any) {
      return {
        success: false,
        data: this.getContent(),
        error: err?.message || 'Failed to fetch About & Contact content',
      };
    }
  }

  static async saveContent(
    content: AboutContactContent,
    adminName = 'Super Admin'
  ): Promise<{ success: boolean; data: AboutContactContent; error?: string }> {
    const dbRow = aboutContactContentToRow(content, adminName);

    try {
      const { data, error } = await supabase
        .from('about_contact_content')
        .upsert(dbRow, { onConflict: 'id' })
        .select('*')
        .single();

      if (error) {
        return {
          success: false,
          data: rowToAboutContactContent(dbRow),
          error: error.message,
        };
      }

      const saved = rowToAboutContactContent(data || dbRow);
      this.setLocalCache(saved, true);
      return { success: true, data: saved };
    } catch (err: any) {
      return {
        success: false,
        data: rowToAboutContactContent(dbRow),
        error: err?.message || 'Database save failed',
      };
    }
  }

  static async resetToDefault(
    adminName = 'Super Admin'
  ): Promise<{ success: boolean; data: AboutContactContent; error?: string }> {
    return this.saveContent({ ...DEFAULT_ABOUT_CONTACT_CONTENT }, adminName);
  }

  static initRealtimeSync(): () => void {
    this.syncRefCount += 1;

    // Always pull fresh DB state
    this.fetchFromSupabase().catch(() => {});

    if (typeof window !== 'undefined') {
      if (!this.broadcastChannel && 'BroadcastChannel' in window) {
        try {
          this.broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
          this.broadcastChannel.onmessage = (event) => {
            if (event.data?.type === 'UPDATED' && event.data.payload) {
              this.setLocalCache(event.data.payload, false);
            }
          };
        } catch (_) {}
      }
    }

    if (!this.realtimeChannel) {
      try {
        this.realtimeChannel = supabase
          .channel('about_contact_content_realtime')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'about_contact_content',
              filter: `id=eq.${SINGLETON_ID}`,
            },
            (payload) => {
              const row = payload.new as Record<string, any> | undefined;
              if (row && Object.keys(row).length > 0) {
                const updated = rowToAboutContactContent(row);
                this.setLocalCache(updated, false);
              }
            }
          )
          .subscribe();
      } catch (err) {
        console.warn('[AboutContactService] Realtime subscription notice:', err);
      }
    }

    const handleVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        this.fetchFromSupabase().catch(() => {});
      }
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === ABOUT_CONTACT_STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          this.cachedContent = rowToAboutContactContent(parsed);
          this.notify(this.cachedContent);
        } catch (_) {}
      }
    };

    if (typeof window !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibility);
      window.addEventListener('storage', handleStorage);
    }

    return () => {
      if (typeof window !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibility);
        window.removeEventListener('storage', handleStorage);
      }
      this.syncRefCount = Math.max(0, this.syncRefCount - 1);
      if (this.syncRefCount === 0) {
        if (this.realtimeChannel) {
          try {
            supabase.removeChannel(this.realtimeChannel);
          } catch (_) {}
          this.realtimeChannel = null;
        }
        if (this.broadcastChannel) {
          try {
            this.broadcastChannel.close();
          } catch (_) {}
          this.broadcastChannel = null;
        }
      }
    };
  }
}
