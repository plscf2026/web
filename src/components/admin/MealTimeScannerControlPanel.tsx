import React, { useState, useEffect } from 'react';
import {
  Clock,
  Coffee,
  Sun,
  Moon,
  Power,
  Save,
  Sliders,
} from 'lucide-react';
import {
  MealType,
  MealScannerMode,
  MealScheduleConfig,
  formatTime24to12,
  getDhakaTimeParts,
} from '../../types/mealControl';
import { MealControlService, EVENT_MEAL_CONTROL_SYNC } from '../../services/mealControlService';
import { Language } from '../../types';

interface MealTimeScannerControlPanelProps {
  language?: Language;
  adminName?: string;
  isCompact?: boolean;
}

export const MealTimeScannerControlPanel: React.FC<MealTimeScannerControlPanelProps> = ({
  language = 'en',
  adminName = 'Super Admin',
  isCompact: _isCompact = false,
}) => {
  const [config, setConfig] = useState<MealScheduleConfig>(() =>
    MealControlService.getScheduleConfig()
  );
  const [currentTimeDhaka, setCurrentTimeDhaka] = useState(() => getDhakaTimeParts());
  const [isSaving, setIsSaving] = useState<Record<MealType, boolean>>({
    breakfast: false,
    lunch: false,
    dinner: false,
  });
  const [saveFeedback, setSaveFeedback] = useState<Record<MealType, string | null>>({
    breakfast: null,
    lunch: null,
    dinner: null,
  });

  // Local draft inputs for time editing
  const [draftTimes, setDraftTimes] = useState<Record<MealType, { startTime: string; endTime: string }>>({
    breakfast: { startTime: config.breakfast.startTime, endTime: config.breakfast.endTime },
    lunch: { startTime: config.lunch.startTime, endTime: config.lunch.endTime },
    dinner: { startTime: config.dinner.startTime, endTime: config.dinner.endTime },
  });

  // Keep live Dhaka time clock ticking every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTimeDhaka(getDhakaTimeParts());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Listen to remote realtime changes or local updates
  useEffect(() => {
    const handleSync = (e: any) => {
      if (e.detail) {
        setConfig(e.detail);
        setDraftTimes({
          breakfast: { startTime: e.detail.breakfast.startTime, endTime: e.detail.breakfast.endTime },
          lunch: { startTime: e.detail.lunch.startTime, endTime: e.detail.lunch.endTime },
          dinner: { startTime: e.detail.dinner.startTime, endTime: e.detail.dinner.endTime },
        });
      }
    };

    window.addEventListener(EVENT_MEAL_CONTROL_SYNC, handleSync);
    // Initialize realtime Supabase listener
    const cleanup = MealControlService.initRealtimeSync();

    return () => {
      window.removeEventListener(EVENT_MEAL_CONTROL_SYNC, handleSync);
      cleanup();
    };
  }, []);

  const handleModeChange = async (meal: MealType, mode: MealScannerMode) => {
    setIsSaving((prev) => ({ ...prev, [meal]: true }));
    try {
      const updated = await MealControlService.setScannerMode(meal, mode, adminName);
      setConfig(updated);
      setSaveFeedback((prev) => ({
        ...prev,
        [meal]: language === 'bn' ? 'মোড সফলভাবে সংরক্ষিত হয়েছে' : 'Mode saved & synced',
      }));
      setTimeout(() => setSaveFeedback((prev) => ({ ...prev, [meal]: null })), 3000);
    } finally {
      setIsSaving((prev) => ({ ...prev, [meal]: false }));
    }
  };

  const handleToggleEnabled = async (meal: MealType) => {
    const currentEnabled = config[meal].enabled;
    setIsSaving((prev) => ({ ...prev, [meal]: true }));
    try {
      const updated = await MealControlService.toggleEnabled(meal, !currentEnabled, adminName);
      setConfig(updated);
      setSaveFeedback((prev) => ({
        ...prev,
        [meal]: !currentEnabled
          ? (language === 'bn' ? 'স্ক্যানার সক্রিয় করা হয়েছে' : 'Scanner Enabled')
          : (language === 'bn' ? 'স্ক্যানার বন্ধ করা হয়েছে' : 'Scanner Disabled'),
      }));
      setTimeout(() => setSaveFeedback((prev) => ({ ...prev, [meal]: null })), 3000);
    } finally {
      setIsSaving((prev) => ({ ...prev, [meal]: false }));
    }
  };

  const handleSaveTiming = async (meal: MealType) => {
    const draft = draftTimes[meal];
    if (!draft.startTime || !draft.endTime) return;

    setIsSaving((prev) => ({ ...prev, [meal]: true }));
    try {
      const updated = await MealControlService.setTiming(
        meal,
        draft.startTime,
        draft.endTime,
        adminName
      );
      setConfig(updated);
      setSaveFeedback((prev) => ({
        ...prev,
        [meal]: language === 'bn' ? 'সময়সূচী ডাটাবেজে সংরক্ষিত হয়েছে' : 'Schedule saved to cloud DB',
      }));
      setTimeout(() => setSaveFeedback((prev) => ({ ...prev, [meal]: null })), 3000);
    } finally {
      setIsSaving((prev) => ({ ...prev, [meal]: false }));
    }
  };

  const MEALS: {
    id: MealType;
    labelEn: string;
    labelBn: string;
    icon: any;
    color: string;
    border: string;
    bgPill: string;
  }[] = [
    {
      id: 'breakfast',
      labelEn: 'Breakfast',
      labelBn: 'সকালের নাস্তা',
      icon: Coffee,
      color: 'text-amber-600',
      border: 'border-amber-200',
      bgPill: 'bg-amber-50 text-amber-900 border-amber-200',
    },
    {
      id: 'lunch',
      labelEn: 'Lunch',
      labelBn: 'দুপুরের খাবার',
      icon: Sun,
      color: 'text-orange-600',
      border: 'border-orange-200',
      bgPill: 'bg-orange-50 text-orange-900 border-orange-200',
    },
    {
      id: 'dinner',
      labelEn: 'Dinner',
      labelBn: 'রাতের খাবার',
      icon: Moon,
      color: 'text-purple-600',
      border: 'border-purple-200',
      bgPill: 'bg-purple-50 text-purple-900 border-purple-200',
    },
  ];

  return (
    <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-6">
      {/* Top Header & Telemetry */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-slate-900 text-sky-400 flex items-center justify-center shrink-0">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 tracking-tight">
                {language === 'bn'
                  ? 'খাবার সময়সূচী ও স্ক্যানার নিয়ন্ত্রণ ব্যবস্থা'
                  : 'Meal Time & Scanner Control System'}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {language === 'bn'
                  ? 'সুপার অ্যাডমিন প্যানেল: ব্রেকফাস্ট, লাঞ্চ ও ডিনারের আলাদা সময়সূচী এবং ৩টি স্ক্যানার মোড'
                  : 'Super Admin: Individual schedules and 3 scanner modes (Scheduled, Manual ON, Manual OFF)'}
              </p>
            </div>
          </div>
        </div>

        {/* Live Bangladesh Time Clock */}
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-2xl bg-slate-900 text-white flex items-center gap-2 border border-slate-800 shadow-xs">
            <Clock className="w-3.5 h-3.5 text-sky-400 animate-pulse shrink-0" />
            <div className="text-left">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block leading-tight">
                Dhaka BST (UTC+6)
              </span>
              <span className="text-xs font-mono font-black text-sky-300">
                {currentTimeDhaka.time12}
              </span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{language === 'bn' ? 'ক্লাউড সিঙ্ক চালু' : 'Cloud DB Live'}</span>
          </div>
        </div>
      </div>

      {/* Grid of 3 Meals */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {MEALS.map((meal) => {
          const schedule = config[meal.id];
          const draft = draftTimes[meal.id];
          const status = MealControlService.evaluateMealStatus(meal.id);
          const Icon = meal.icon;
          const saving = isSaving[meal.id];
          const feedback = saveFeedback[meal.id];

          return (
            <div
              key={meal.id}
              className={`rounded-2xl border p-4 sm:p-5 flex flex-col justify-between space-y-4 transition-all ${
                status.isOpen
                  ? 'bg-gradient-to-b from-white to-emerald-50/20 border-emerald-300/80 shadow-xs ring-1 ring-emerald-500/10'
                  : 'bg-gradient-to-b from-white to-slate-50/40 border-slate-200'
              }`}
            >
              {/* Card Top: Title, Icon, Status & Master Switch */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${meal.bgPill}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900 leading-tight">
                        {language === 'bn' ? meal.labelBn : meal.labelEn}
                      </h4>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {formatTime24to12(schedule.startTime)} – {formatTime24to12(schedule.endTime)}
                      </span>
                    </div>
                  </div>

                  {/* Master Enabled / Disabled Toggle */}
                  <button
                    type="button"
                    onClick={() => handleToggleEnabled(meal.id)}
                    disabled={saving}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black border transition-all cursor-pointer ${
                      schedule.enabled
                        ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                        : 'bg-slate-100 text-slate-500 border-slate-300 hover:bg-slate-200'
                    }`}
                    title="Toggle master scanner enablement"
                  >
                    <Power className="w-3 h-3" />
                    <span>{schedule.enabled ? 'Enabled' : 'Disabled'}</span>
                  </button>
                </div>

                {/* Real-time Status Banner */}
                <div
                  className={`p-2.5 rounded-xl text-xs font-bold flex items-start gap-2 border ${
                    status.isOpen
                      ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                      : status.mode === 'MANUAL_OFF'
                      ? 'bg-rose-50 text-rose-900 border-rose-200'
                      : 'bg-amber-50 text-amber-900 border-amber-200'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full mt-1 shrink-0 ${
                      status.isOpen
                        ? 'bg-emerald-500 animate-pulse'
                        : 'bg-rose-500'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="uppercase text-[10px] tracking-wider font-black">
                        {status.isOpen ? 'ACTIVE' : 'TIME OUT (INACTIVE)'}
                      </span>
                      <span className="text-[9px] font-mono opacity-75">
                        Mode: {schedule.mode}
                      </span>
                    </div>
                    <p className="text-[11px] font-medium leading-tight mt-0.5">
                      {language === 'bn' ? status.reasonBn : status.reasonEn}
                    </p>
                  </div>
                </div>

                {/* 3 Scanner Modes Selector */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block">
                    {language === 'bn' ? 'স্ক্যানার মোড নির্বাচন' : 'Scanner Operating Mode'}
                  </label>
                  <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200 text-center">
                    {[
                      {
                        mode: 'SCHEDULED' as MealScannerMode,
                        label: 'Scheduled',
                        sub: 'Auto Time',
                        activeClass: 'bg-white text-slate-900 shadow-xs font-black border border-slate-200',
                      },
                      {
                        mode: 'MANUAL_ON' as MealScannerMode,
                        label: 'Manual ON',
                        sub: 'Force Open',
                        activeClass: 'bg-emerald-600 text-white shadow-xs font-black',
                      },
                      {
                        mode: 'MANUAL_OFF' as MealScannerMode,
                        label: 'Manual OFF',
                        sub: 'Force Block',
                        activeClass: 'bg-rose-600 text-white shadow-xs font-black',
                      },
                    ].map((item) => (
                      <button
                        key={item.mode}
                        type="button"
                        onClick={() => handleModeChange(meal.id, item.mode)}
                        disabled={saving}
                        className={`py-1.5 px-1 rounded-lg text-xs transition-all cursor-pointer ${
                          schedule.mode === item.mode
                            ? item.activeClass
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 font-semibold'
                        }`}
                      >
                        <span className="block leading-tight text-[11px] font-bold">{item.label}</span>
                        <span className="block text-[9px] opacity-75">{item.sub}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Customizable Time Schedule Inputs */}
                <div className="space-y-2 pt-1 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                      {language === 'bn' ? 'সময়সূচী নির্ধারণ (BST)' : 'Schedule Time (BST)'}
                    </label>
                    <span className="text-[10px] font-mono text-slate-400">
                      {formatTime24to12(draft.startTime)} - {formatTime24to12(draft.endTime)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-slate-400 block mb-0.5">
                        {language === 'bn' ? 'শুরুর সময়' : 'Start Time'}
                      </span>
                      <input
                        type="time"
                        value={draft.startTime}
                        onChange={(e) =>
                          setDraftTimes((prev) => ({
                            ...prev,
                            [meal.id]: { ...prev[meal.id], startTime: e.target.value },
                          }))
                        }
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:border-sky-500 focus:ring-1 focus:ring-sky-200 outline-hidden"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block mb-0.5">
                        {language === 'bn' ? 'শেষের সময়' : 'End Time'}
                      </span>
                      <input
                        type="time"
                        value={draft.endTime}
                        onChange={(e) =>
                          setDraftTimes((prev) => ({
                            ...prev,
                            [meal.id]: { ...prev[meal.id], endTime: e.target.value },
                          }))
                        }
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:border-sky-500 focus:ring-1 focus:ring-sky-200 outline-hidden"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Footer: Save Button & Notice */}
              <div className="pt-3 border-t border-slate-100 space-y-1.5">
                <button
                  type="button"
                  onClick={() => handleSaveTiming(meal.id)}
                  disabled={
                    saving ||
                    (draft.startTime === schedule.startTime && draft.endTime === schedule.endTime)
                  }
                  className={`w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    draft.startTime !== schedule.startTime || draft.endTime !== schedule.endTime
                      ? 'bg-slate-900 hover:bg-slate-800 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>
                    {saving
                      ? (language === 'bn' ? 'সংরক্ষণ হচ্ছে...' : 'Saving to Database...')
                      : (language === 'bn' ? 'সময়সূচী আপডেট করুন' : 'Save Time Schedule')}
                  </span>
                </button>

                {feedback && (
                  <div className="text-[10px] font-bold text-center text-emerald-600 bg-emerald-50 rounded-lg py-1 border border-emerald-200 animate-fade-in">
                    ✓ {feedback}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
