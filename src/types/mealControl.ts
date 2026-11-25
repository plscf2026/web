/**
 * Meal Time & Scanner Control System Types & Bangladesh Time Helpers
 * Police Lines School & College, Faridpur — Grand Reunion 2027
 * 
 * Timezone: Asia/Dhaka (UTC+6)
 */

export type MealType = 'breakfast' | 'lunch' | 'dinner';

export type MealScannerMode = 'SCHEDULED' | 'MANUAL_ON' | 'MANUAL_OFF';

export interface SingleMealSchedule {
  mealType: MealType;
  startTime: string; // 24-hour "HH:MM" (e.g. "07:00")
  endTime: string;   // 24-hour "HH:MM" (e.g. "10:30")
  mode: MealScannerMode;
  enabled: boolean;
  updatedBy?: string;
  updatedAt?: string;
}

export interface MealScheduleConfig {
  breakfast: SingleMealSchedule;
  lunch: SingleMealSchedule;
  dinner: SingleMealSchedule;
  timezone: string; // 'Asia/Dhaka'
  lastUpdated: string;
}

export interface MealScannerStatus {
  isOpen: boolean;
  status: 'ACTIVE' | 'TIMEOUT' | 'DISABLED';
  reasonEn: string;
  reasonBn: string;
  mode: MealScannerMode;
  schedule: SingleMealSchedule;
  currentTimeDhaka: string;
  timeString12: string;
}

export const DEFAULT_MEAL_SCHEDULE_CONFIG: MealScheduleConfig = {
  breakfast: {
    mealType: 'breakfast',
    startTime: '07:00',
    endTime: '10:30',
    mode: 'SCHEDULED',
    enabled: true,
    updatedBy: 'System Default',
    updatedAt: new Date().toISOString(),
  },
  lunch: {
    mealType: 'lunch',
    startTime: '12:00',
    endTime: '15:30',
    mode: 'SCHEDULED',
    enabled: true,
    updatedBy: 'System Default',
    updatedAt: new Date().toISOString(),
  },
  dinner: {
    mealType: 'dinner',
    startTime: '19:00',
    endTime: '22:00',
    mode: 'SCHEDULED',
    enabled: true,
    updatedBy: 'System Default',
    updatedAt: new Date().toISOString(),
  },
  timezone: 'Asia/Dhaka',
  lastUpdated: new Date().toISOString(),
};

/**
 * Extract time components in Bangladesh Standard Time (Asia/Dhaka)
 */
export function getDhakaTimeParts(now: Date = new Date()): {
  hours: number;
  minutes: number;
  time24: string;
  time12: string;
} {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dhaka',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);

  const hours = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minutes = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  const time24 = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

  const period = hours >= 12 ? 'PM' : 'AM';
  const h12 = hours % 12 === 0 ? 12 : hours % 12;
  const time12 = `${h12}:${String(minutes).padStart(2, '0')} ${period}`;

  return { hours, minutes, time24, time12 };
}

/**
 * Format 24h "HH:MM" into readable 12h string "H:MM AM/PM"
 */
export function formatTime24to12(time24: string): string {
  if (!time24 || !time24.includes(':')) return time24;
  const [hStr, mStr] = time24.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h) || isNaN(m)) return time24;
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

/**
 * Pure evaluation function for checking meal scanner state
 */
export function evaluateMealScannerStatus(
  mealType: MealType,
  schedule: SingleMealSchedule,
  now: Date = new Date()
): MealScannerStatus {
  const dhaka = getDhakaTimeParts(now);
  const mealNameEn = mealType.charAt(0).toUpperCase() + mealType.slice(1);
  const mealNameBn =
    mealType === 'breakfast' ? 'সকালের নাস্তা' : mealType === 'lunch' ? 'দুপুরের খাবার' : 'রাতের খাবার';

  // 1. Manual OFF or Master Disabled
  if (schedule.mode === 'MANUAL_OFF' || !schedule.enabled) {
    return {
      isOpen: false,
      status: 'TIMEOUT',
      reasonEn: `Time Out: ${mealNameEn} scanner is currently disabled by Super Admin.`,
      reasonBn: `Time Out (সময় শেষ): সুপার অ্যাডমিন কর্তৃক ${mealNameBn} স্ক্যানার বন্ধ রাখা হয়েছে।`,
      mode: 'MANUAL_OFF',
      schedule,
      currentTimeDhaka: dhaka.time24,
      timeString12: dhaka.time12,
    };
  }

  // 2. Manual ON (Admin Override)
  if (schedule.mode === 'MANUAL_ON') {
    return {
      isOpen: true,
      status: 'ACTIVE',
      reasonEn: `Active: Manual override active (Super Admin).`,
      reasonBn: `সক্রিয়: সুপার অ্যাডমিন দ্বারা ম্যানুয়াল চালু করা হয়েছে।`,
      mode: 'MANUAL_ON',
      schedule,
      currentTimeDhaka: dhaka.time24,
      timeString12: dhaka.time12,
    };
  }

  // 3. SCHEDULED Mode: Evaluate current time against start and end
  const current = dhaka.time24;
  const start = schedule.startTime;
  const end = schedule.endTime;

  if (current >= start && current <= end) {
    return {
      isOpen: true,
      status: 'ACTIVE',
      reasonEn: `Active: Scheduled window ${formatTime24to12(start)} – ${formatTime24to12(end)} (BST)`,
      reasonBn: `সক্রিয়: নির্ধারিত সময় ${formatTime24to12(start)} – ${formatTime24to12(end)} (বাংলাদেশ সময়)`,
      mode: 'SCHEDULED',
      schedule,
      currentTimeDhaka: dhaka.time24,
      timeString12: dhaka.time12,
    };
  }

  if (current < start) {
    return {
      isOpen: false,
      status: 'TIMEOUT',
      reasonEn: `Time Out: ${mealNameEn} distribution starts at ${formatTime24to12(start)} Bangladesh Time.`,
      reasonBn: `Time Out (সময় শেষ): ${mealNameBn} বিতরণ শুরু হবে বাংলাদেশ সময় ${formatTime24to12(start)} টায়।`,
      mode: 'SCHEDULED',
      schedule,
      currentTimeDhaka: dhaka.time24,
      timeString12: dhaka.time12,
    };
  }

  return {
    isOpen: false,
    status: 'TIMEOUT',
    reasonEn: `Time Out: ${mealNameEn} distribution closed at ${formatTime24to12(end)} Bangladesh Time.`,
    reasonBn: `Time Out (সময় শেষ): ${mealNameBn} বিতরণের সময় বাংলাদেশ সময় ${formatTime24to12(end)} টায় শেষ হয়েছে।`,
    mode: 'SCHEDULED',
    schedule,
    currentTimeDhaka: dhaka.time24,
    timeString12: dhaka.time12,
  };
}
