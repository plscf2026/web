import { supabase } from './supabase';

export interface PublicReunionStats {
  totalRegistered: number;
  formerStudents: number;
  currentStudents: number;
  batchesRepresented: number;
  updatedAt: string;
}

export type ReunionStatsLoadStatus = 'loading' | 'ready' | 'error';

export interface ReunionStatsSnapshot {
  status: ReunionStatsLoadStatus;
  stats: PublicReunionStats | null;
  error: string | null;
}

type StatsListener = (snapshot: ReunionStatsSnapshot) => void;

const STATS_POLL_INTERVAL_MS = 15000;

export function normalizePublicReunionStats(raw: unknown): PublicReunionStats | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const obj = raw as Record<string, unknown>;
  const toNonNegInt = (val: unknown): number => {
    const n = Number(val);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  };

  return {
    totalRegistered: toNonNegInt(obj.total_registered ?? obj.totalRegistered),
    formerStudents: toNonNegInt(obj.former_students ?? obj.formerStudents),
    currentStudents: toNonNegInt(obj.current_students ?? obj.currentStudents),
    batchesRepresented: toNonNegInt(obj.batches_represented ?? obj.batchesRepresented),
    updatedAt: typeof obj.updated_at === 'string' ? obj.updated_at : new Date().toISOString(),
  };
}

export class ReunionStatsService {
  private static snapshot: ReunionStatsSnapshot = {
    status: 'loading',
    stats: null,
    error: null,
  };
  private static listeners = new Set<StatsListener>();
  private static inflight: Promise<ReunionStatsSnapshot> | null = null;
  private static syncRefCount = 0;
  private static pollTimer: ReturnType<typeof setInterval> | null = null;

  static getSnapshot(): ReunionStatsSnapshot {
    return { ...this.snapshot };
  }

  static subscribe(listener: StatsListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private static emit(next: ReunionStatsSnapshot): void {
    this.snapshot = next;
    this.listeners.forEach((cb) => {
      try {
        cb({ ...next });
      } catch {
        // Ignore subscriber listener exceptions
      }
    });
  }

  static async fetchFromSupabase(): Promise<ReunionStatsSnapshot> {
    if (this.inflight) {
      return this.inflight;
    }

    if (this.snapshot.stats === null && this.snapshot.status !== 'loading') {
      this.emit({ status: 'loading', stats: null, error: null });
    }

    this.inflight = (async () => {
      try {
        const { data, error } = await supabase.rpc('rpc_get_public_reunion_stats');
        if (error) {
          const next: ReunionStatsSnapshot = {
            status: this.snapshot.stats ? 'ready' : 'error',
            stats: this.snapshot.stats,
            error: error.message || 'Unable to fetch live registration stats from Supabase.',
          };
          this.emit(next);
          return next;
        }

        const parsed = normalizePublicReunionStats(data);
        if (!parsed) {
          const next: ReunionStatsSnapshot = {
            status: this.snapshot.stats ? 'ready' : 'error',
            stats: this.snapshot.stats,
            error: 'Invalid reunion stats payload returned from Supabase.',
          };
          this.emit(next);
          return next;
        }

        const next: ReunionStatsSnapshot = {
          status: 'ready',
          stats: parsed,
          error: null,
        };
        this.emit(next);
        return next;
      } catch (err: any) {
        const next: ReunionStatsSnapshot = {
          status: this.snapshot.stats ? 'ready' : 'error',
          stats: this.snapshot.stats,
          error: err?.message || 'Network error while fetching reunion stats.',
        };
        this.emit(next);
        return next;
      } finally {
        this.inflight = null;
      }
    })();

    return this.inflight;
  }

  static initLiveSync(): () => void {
    this.syncRefCount += 1;
    void this.fetchFromSupabase();

    if (typeof window === 'undefined' || this.syncRefCount > 1) {
      return () => {
        this.syncRefCount = Math.max(0, this.syncRefCount - 1);
      };
    }

    const handleRefresh = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      void this.fetchFromSupabase();
    };

    const handleFocus = () => {
      void this.fetchFromSupabase();
    };

    const handleRegUpdated = () => {
      void this.fetchFromSupabase();
    };

    let bc: BroadcastChannel | null = null;
    if ('BroadcastChannel' in window) {
      try {
        bc = new BroadcastChannel('plscf_realtime_events');
        bc.onmessage = (evt) => {
          if (evt.data?.type === 'plscf_registration_updated') {
            void this.fetchFromSupabase();
          }
        };
      } catch {
        bc = null;
      }
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleRefresh);
    }
    window.addEventListener('focus', handleFocus);
    window.addEventListener('plscf_registration_updated', handleRegUpdated);

    this.pollTimer = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        void this.fetchFromSupabase();
      }
    }, STATS_POLL_INTERVAL_MS);

    return () => {
      this.syncRefCount = Math.max(0, this.syncRefCount - 1);
      if (this.syncRefCount === 0) {
        if (typeof document !== 'undefined') {
          document.removeEventListener('visibilitychange', handleRefresh);
        }
        window.removeEventListener('focus', handleFocus);
        window.removeEventListener('plscf_registration_updated', handleRegUpdated);
        if (bc) {
          try {
            bc.close();
          } catch {}
        }
        if (this.pollTimer) {
          clearInterval(this.pollTimer);
          this.pollTimer = null;
        }
      }
    };
  }
}
