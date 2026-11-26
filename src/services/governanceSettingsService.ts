import {
  FeeSettings,
  GovernanceLoadStatus,
  Language,
} from '../types';
import { supabase } from './supabase';
import { AppStore, normalizeFeeSettings } from './store';

export interface GovernanceSettingsSnapshot {
  status: GovernanceLoadStatus;
  settings: FeeSettings | null;
  error: string | null;
  lastSyncedAt: string | null;
}

type GovernanceListener = (snapshot: GovernanceSettingsSnapshot) => void;

const BROADCAST_CHANNEL_NAME = 'plscf_governance_sync_v1';
const SETTINGS_STORAGE_KEY = 'plscf_reunion_settings_v1';
const REALTIME_CHANNEL_NAME = 'portal_fee_settings_live_sync';
const POLL_INTERVAL_MS = 5000;

export class GovernanceSettingsService {
  private static snapshot: GovernanceSettingsSnapshot = {
    status: 'loading',
    settings: null,
    error: null,
    lastSyncedAt: null,
  };
  private static attemptedLoad = false;
  private static listeners = new Set<GovernanceListener>();
  private static realtimeChannel: any = null;
  private static broadcastChannel: BroadcastChannel | null = null;
  private static syncRefCount = 0;
  private static pollTimer: ReturnType<typeof setInterval> | null = null;
  private static inflightFetch: Promise<GovernanceSettingsSnapshot> | null = null;

  static getSnapshot(): GovernanceSettingsSnapshot {
    return { ...this.snapshot };
  }

  static hasAttemptedLoad(): boolean {
    return this.attemptedLoad;
  }

  static getConfirmedSettings(): FeeSettings | null {
    return this.snapshot.settings;
  }

  static subscribe(listener: GovernanceListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private static emit(next: GovernanceSettingsSnapshot, broadcast = false): void {
    this.snapshot = next;
    if (next.status === 'ready' && next.settings) {
      AppStore.saveFeeSettings(next.settings);
    }
    this.listeners.forEach((cb) => {
      try {
        cb({ ...next });
      } catch (_) {}
    });

    if (broadcast && next.status === 'ready' && next.settings && this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({ type: 'GOVERNANCE_UPDATED', payload: next.settings });
      } catch (_) {}
    }
  }

  static async fetchFromSupabase(): Promise<GovernanceSettingsSnapshot> {
    if (this.inflightFetch) {
      return this.inflightFetch;
    }

    this.attemptedLoad = true;
    const isInitialLoad = this.snapshot.settings === null;
    if (isInitialLoad && this.snapshot.status !== 'loading') {
      this.emit({
        ...this.snapshot,
        status: 'loading',
        error: null,
      });
    }

    this.inflightFetch = (async () => {
      try {
        const { data, error } = await supabase.rpc('rpc_get_public_governance_settings');

        if (error) {
          const msg = error.message || 'Unable to load portal governance settings from Supabase.';
          const next: GovernanceSettingsSnapshot = {
            status: this.snapshot.settings ? 'ready' : 'error',
            settings: this.snapshot.settings,
            error: msg,
            lastSyncedAt: this.snapshot.lastSyncedAt,
          };
          this.emit(next, false);
          return next;
        }

        if (!data || typeof data !== 'object' || Array.isArray(data)) {
          const next: GovernanceSettingsSnapshot = {
            status: this.snapshot.settings ? 'ready' : 'error',
            settings: this.snapshot.settings,
            error: 'Authoritative governance configuration returned an invalid payload.',
            lastSyncedAt: this.snapshot.lastSyncedAt,
          };
          this.emit(next, false);
          return next;
        }

        const normalized = normalizeFeeSettings(data as Record<string, any>);
        const next: GovernanceSettingsSnapshot = {
          status: 'ready',
          settings: normalized,
          error: null,
          lastSyncedAt: normalized.updatedAt || new Date().toISOString(),
        };
        this.emit(next, false);
        return next;
      } catch (err: any) {
        const msg = err?.message || 'Network error loading governance settings.';
        const next: GovernanceSettingsSnapshot = {
          status: this.snapshot.settings ? 'ready' : 'error',
          settings: this.snapshot.settings,
          error: msg,
          lastSyncedAt: this.snapshot.lastSyncedAt,
        };
        this.emit(next, false);
        return next;
      } finally {
        this.inflightFetch = null;
      }
    })();

    return this.inflightFetch;
  }

  static async patchSettings(
    patch: Partial<FeeSettings>,
    actorName = 'Super Admin',
    lang: Language = 'en'
  ): Promise<{
    success: boolean;
    settings: FeeSettings | null;
    error?: string;
  }> {
    const previousConfirmed = this.snapshot.settings;

    try {
      const { data, error } = await supabase.rpc('rpc_update_portal_governance_settings', {
        p_patch: patch,
        p_actor_name: actorName,
      });

      if (error || !data || typeof data !== 'object' || Array.isArray(data)) {
        const rawErr = error?.message || 'Failed to persist governance settings in Supabase.';
        const friendlyErr =
          error?.code === '42501' || /permission denied|only an active super admin|authentication required/i.test(rawErr)
            ? lang === 'bn'
              ? 'অনুমতি নেই: শুধুমাত্র যাচাইকৃত সুপার অ্যাডমিন এই নিয়ন্ত্রণ সেটিংস পরিবর্তন করতে পারবেন।'
              : 'Permission Denied: Only an authenticated Super Admin can update governance settings.'
            : rawErr;

        return {
          success: false,
          settings: previousConfirmed,
          error: friendlyErr,
        };
      }

      const confirmed = normalizeFeeSettings(data as Record<string, any>);
      const next: GovernanceSettingsSnapshot = {
        status: 'ready',
        settings: confirmed,
        error: null,
        lastSyncedAt: confirmed.updatedAt || new Date().toISOString(),
      };
      this.attemptedLoad = true;
      this.emit(next, true);
      return {
        success: true,
        settings: confirmed,
      };
    } catch (err: any) {
      return {
        success: false,
        settings: previousConfirmed,
        error: err?.message || 'Unexpected error saving governance settings.',
      };
    }
  }

  static initRealtimeSync(): () => void {
    this.syncRefCount += 1;

    // Authoritative initial fetch from Supabase
    void this.fetchFromSupabase();

    if (typeof window !== 'undefined') {
      if (!this.broadcastChannel && 'BroadcastChannel' in window) {
        try {
          this.broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
          this.broadcastChannel.onmessage = (event) => {
            if (event.data?.type === 'GOVERNANCE_UPDATED' && event.data.payload) {
              const normalized = normalizeFeeSettings(event.data.payload);
              this.attemptedLoad = true;
              this.emit(
                {
                  status: 'ready',
                  settings: normalized,
                  error: null,
                  lastSyncedAt: normalized.updatedAt || new Date().toISOString(),
                },
                false
              );
            }
          };
        } catch (_) {}
      }
    }

    if (!this.realtimeChannel) {
      try {
        this.realtimeChannel = supabase
          .channel(REALTIME_CHANNEL_NAME)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'system_settings',
              filter: 'key=eq.portal_fee_settings',
            },
            () => {
              // Fetch safe public projection on every realtime DB change
              void this.fetchFromSupabase();
            }
          )
          .subscribe();
      } catch (err) {
        console.warn('[GovernanceSettingsService] Realtime subscription notice:', err);
      }
    }

    const handleVisibilityOrFocus = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        void this.fetchFromSupabase();
      }
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === SETTINGS_STORAGE_KEY && e.newValue) {
        try {
          const parsed = normalizeFeeSettings(JSON.parse(e.newValue));
          this.attemptedLoad = true;
          this.emit(
            {
              status: 'ready',
              settings: parsed,
              error: null,
              lastSyncedAt: parsed.updatedAt || new Date().toISOString(),
            },
            false
          );
        } catch (_) {}
      }
    };

    if (typeof window !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityOrFocus);
      window.addEventListener('focus', handleVisibilityOrFocus);
      window.addEventListener('storage', handleStorage);

      if (!this.pollTimer) {
        this.pollTimer = setInterval(() => {
          if (typeof document === 'undefined' || document.visibilityState === 'visible') {
            void this.fetchFromSupabase();
          }
        }, POLL_INTERVAL_MS);
      }
    }

    return () => {
      if (typeof window !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
        window.removeEventListener('focus', handleVisibilityOrFocus);
        window.removeEventListener('storage', handleStorage);
      }
      this.syncRefCount = Math.max(0, this.syncRefCount - 1);
      if (this.syncRefCount === 0) {
        if (this.pollTimer) {
          clearInterval(this.pollTimer);
          this.pollTimer = null;
        }
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

  /** Test helper to reset in-memory singleton cleanly */
  static __resetForTests(): void {
    this.snapshot = {
      status: 'loading',
      settings: null,
      error: null,
      lastSyncedAt: null,
    };
    this.attemptedLoad = false;
    this.inflightFetch = null;
  }
}
