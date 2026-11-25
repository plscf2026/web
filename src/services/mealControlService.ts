/**
 * Meal Time & Scanner Control System Service
 * Police Lines School & College, Faridpur — Grand Reunion 2027
 * 
 * Manages Breakfast, Lunch, and Dinner time windows, 3 scanner modes
 * (SCHEDULED, MANUAL_ON, MANUAL_OFF), automatic activation/deactivation,
 * and real-time database synchronization with Supabase.
 */

import { supabase } from './supabase';
import {
  MealType,
  MealScannerMode,
  SingleMealSchedule,
  MealScheduleConfig,
  MealScannerStatus,
  DEFAULT_MEAL_SCHEDULE_CONFIG,
  evaluateMealScannerStatus,
} from '../types/mealControl';

const STORAGE_KEY = 'plscf_meal_scanner_controls_v1';
export const EVENT_MEAL_CONTROL_SYNC = 'plscf_meal_control_sync';

export class MealControlService {
  private static cachedConfig: MealScheduleConfig | null = null;
  private static realtimeSubscription: any = null;

  /**
   * Synchronously retrieve current meal configuration
   */
  static getScheduleConfig(): MealScheduleConfig {
    if (this.cachedConfig) {
      return this.cachedConfig;
    }

    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.breakfast && parsed.lunch && parsed.dinner) {
            this.cachedConfig = {
              ...DEFAULT_MEAL_SCHEDULE_CONFIG,
              ...parsed,
            };
            return this.cachedConfig!;
          }
        }
      } catch (err) {
        console.warn('[MealControlService] Failed to read from localStorage:', err);
      }
    }

    this.cachedConfig = { ...DEFAULT_MEAL_SCHEDULE_CONFIG };
    return this.cachedConfig;
  }

  /**
   * Retrieve single meal schedule
   */
  static getSingleSchedule(mealType: MealType): SingleMealSchedule {
    const config = this.getScheduleConfig();
    return config[mealType] || DEFAULT_MEAL_SCHEDULE_CONFIG[mealType];
  }

  /**
   * Save configuration to local storage and broadcast to components
   */
  static saveScheduleConfig(config: MealScheduleConfig): void {
    this.cachedConfig = config;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
        window.dispatchEvent(
          new CustomEvent(EVENT_MEAL_CONTROL_SYNC, { detail: config })
        );
      } catch (err) {
        console.warn('[MealControlService] Failed to persist to localStorage:', err);
      }
    }
  }

  /**
   * Evaluate whether a meal scanner is currently active or timed out
   */
  static evaluateMealStatus(
    mealType: MealType,
    now: Date = new Date()
  ): MealScannerStatus {
    const schedule = this.getSingleSchedule(mealType);
    return evaluateMealScannerStatus(mealType, schedule, now);
  }

  /**
   * Quick boolean check: is the meal scanner open?
   */
  static isMealScannerOpen(mealType: MealType, now: Date = new Date()): boolean {
    const status = this.evaluateMealStatus(mealType, now);
    return status.isOpen;
  }

  /**
   * Update schedule for a single meal and immediately sync to Supabase
   */
  static async updateSchedule(
    mealType: MealType,
    updates: Partial<SingleMealSchedule>,
    adminName: string = 'Super Admin'
  ): Promise<MealScheduleConfig> {
    const current = this.getScheduleConfig();
    const existing = current[mealType];

    const updatedMeal: SingleMealSchedule = {
      ...existing,
      ...updates,
      updatedBy: adminName,
      updatedAt: new Date().toISOString(),
    };

    const newConfig: MealScheduleConfig = {
      ...current,
      [mealType]: updatedMeal,
      lastUpdated: new Date().toISOString(),
    };

    // 1. Immediately update local state
    this.saveScheduleConfig(newConfig);

    // 2. Persist to Supabase Database
    try {
      // Direct upsert to table
      const { error: upsertErr } = await supabase.from('meal_scanner_controls').upsert({
        id: mealType,
        meal_type: mealType,
        start_time: updatedMeal.startTime,
        end_time: updatedMeal.endTime,
        mode: updatedMeal.mode,
        enabled: updatedMeal.enabled,
        updated_by: adminName,
        updated_at: updatedMeal.updatedAt,
      });

      if (upsertErr) {
        console.warn('[MealControlService] Supabase upsert notice:', upsertErr.message);
      }
    } catch (e) {
      console.warn('[MealControlService] Cloud sync error, local state preserved:', e);
    }

    return newConfig;
  }

  /**
   * Set scanner mode for a meal: SCHEDULED | MANUAL_ON | MANUAL_OFF
   */
  static async setScannerMode(
    mealType: MealType,
    mode: MealScannerMode,
    adminName: string = 'Super Admin'
  ): Promise<MealScheduleConfig> {
    return this.updateSchedule(mealType, { mode }, adminName);
  }

  /**
   * Set custom start and end times for a meal
   */
  static async setTiming(
    mealType: MealType,
    startTime: string,
    endTime: string,
    adminName: string = 'Super Admin'
  ): Promise<MealScheduleConfig> {
    return this.updateSchedule(mealType, { startTime, endTime }, adminName);
  }

  /**
   * Toggle master enabled/disabled state for a meal
   */
  static async toggleEnabled(
    mealType: MealType,
    enabled: boolean,
    adminName: string = 'Super Admin'
  ): Promise<MealScheduleConfig> {
    return this.updateSchedule(mealType, { enabled }, adminName);
  }

  /**
   * Synchronize from Supabase cloud table into local cache
   */
  static async syncWithSupabase(): Promise<MealScheduleConfig> {
    try {
      const { data, error } = await supabase
        .from('meal_scanner_controls')
        .select('*');

      if (!error && data && data.length > 0) {
        const current = this.getScheduleConfig();
        const updatedConfig: MealScheduleConfig = { ...current };

        for (const row of data) {
          const m = row.meal_type as MealType;
          if (m === 'breakfast' || m === 'lunch' || m === 'dinner') {
            updatedConfig[m] = {
              mealType: m,
              startTime: row.start_time || current[m].startTime,
              endTime: row.end_time || current[m].endTime,
              mode: (row.mode as MealScannerMode) || current[m].mode,
              enabled: row.enabled !== undefined ? Boolean(row.enabled) : current[m].enabled,
              updatedBy: row.updated_by || current[m].updatedBy,
              updatedAt: row.updated_at || current[m].updatedAt,
            };
          }
        }

        updatedConfig.lastUpdated = new Date().toISOString();
        this.saveScheduleConfig(updatedConfig);
        return updatedConfig;
      }
    } catch (err) {
      console.warn('[MealControlService] syncWithSupabase notice:', err);
    }

    return this.getScheduleConfig();
  }

  /**
   * Subscribe to Supabase Realtime channel so changes reflect on all devices instantly
   */
  static initRealtimeSync(): () => void {
    if (this.realtimeSubscription) {
      return () => {};
    }

    // Trigger initial cloud sync
    this.syncWithSupabase().catch(() => {});

    try {
      this.realtimeSubscription = supabase
        .channel('meal_scanner_controls_channel')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'meal_scanner_controls' },
          (payload) => {
            const newRow = payload.new as any;
            if (newRow && newRow.meal_type) {
              const m = newRow.meal_type as MealType;
              if (m === 'breakfast' || m === 'lunch' || m === 'dinner') {
                const current = this.getScheduleConfig();
                const updated: MealScheduleConfig = {
                  ...current,
                  [m]: {
                    mealType: m,
                    startTime: newRow.start_time || current[m].startTime,
                    endTime: newRow.end_time || current[m].endTime,
                    mode: (newRow.mode as MealScannerMode) || current[m].mode,
                    enabled: newRow.enabled !== undefined ? Boolean(newRow.enabled) : current[m].enabled,
                    updatedBy: newRow.updated_by || current[m].updatedBy,
                    updatedAt: newRow.updated_at || current[m].updatedAt,
                  },
                  lastUpdated: new Date().toISOString(),
                };
                this.saveScheduleConfig(updated);
              }
            }
          }
        )
        .subscribe();

      return () => {
        if (this.realtimeSubscription) {
          supabase.removeChannel(this.realtimeSubscription);
          this.realtimeSubscription = null;
        }
      };
    } catch (err) {
      console.warn('[MealControlService] Realtime subscription init notice:', err);
      return () => {};
    }
  }
}
