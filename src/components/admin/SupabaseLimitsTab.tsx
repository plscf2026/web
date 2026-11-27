import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Crown,
  Database,
  ExternalLink,
  FlaskConical,
  HardDrive,
  Radio,
  RefreshCw,
  Server,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react';
import { Language } from '../../types';
import { SUPABASE_PROJECT_ID } from '../../services/supabase';
import {
  EvaluatedQuotaMetric,
  QuotaSeverity,
  SUPABASE_DASHBOARD_USAGE_URL,
  SUPABASE_PLAN_SPECS,
  SupabaseLimitsService,
  SupabaseLimitsSnapshot,
  SupabasePlanTier,
  formatBytes,
  formatNumberCompact,
} from '../../services/supabaseLimitsService';

interface SupabaseLimitsTabProps {
  language: Language;
  adminName?: string;
}

const getSeverityTheme = (severity: QuotaSeverity) => {
  switch (severity) {
    case 'critical':
      return {
        cardBorder: 'border-rose-300 ring-2 ring-rose-500/20 bg-rose-50/40',
        badge: 'bg-rose-600 text-white border-rose-700 animate-pulse',
        barBg: 'bg-rose-100',
        barFill: 'bg-gradient-to-r from-rose-500 to-red-600',
        text: 'text-rose-700',
        iconWrap: 'bg-rose-100 text-rose-700 border-rose-200',
        labelEn: 'RED ALERT',
        labelBn: 'রেড অ্যালার্ট',
      };
    case 'warning':
      return {
        cardBorder: 'border-amber-300 ring-1 ring-amber-400/25 bg-amber-50/35',
        badge: 'bg-amber-500 text-slate-950 border-amber-600',
        barBg: 'bg-amber-100',
        barFill: 'bg-gradient-to-r from-amber-400 to-orange-500',
        text: 'text-amber-800',
        iconWrap: 'bg-amber-100 text-amber-700 border-amber-200',
        labelEn: 'WARNING',
        labelBn: 'সতর্কতা',
      };
    default:
      return {
        cardBorder: 'border-slate-200/90 bg-white',
        badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        barBg: 'bg-slate-100',
        barFill: 'bg-gradient-to-r from-sky-500 to-emerald-500',
        text: 'text-emerald-700',
        iconWrap: 'bg-sky-50 text-sky-600 border-sky-200',
        labelEn: 'HEALTHY',
        labelBn: 'নিরাপদ',
      };
  }
};

const getMetricIcon = (id: EvaluatedQuotaMetric['id']) => {
  switch (id) {
    case 'database_size':
      return Database;
    case 'storage_size':
    case 'max_upload_file':
      return HardDrive;
    case 'auth_mau':
      return Users;
    case 'db_connections':
      return Activity;
    case 'inactivity_pause':
    default:
      return Clock;
  }
};

export const SupabaseLimitsTab: React.FC<SupabaseLimitsTabProps> = ({
  language,
  adminName = 'Super Administrator',
}) => {
  const isBn = language === 'bn';
  const [snapshot, setSnapshot] = useState<SupabaseLimitsSnapshot>(() =>
    SupabaseLimitsService.getSnapshot()
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [showThresholdPanel, setShowThresholdPanel] = useState(false);

  const [warnInput, setWarnInput] = useState<number>(70);
  const [critInput, setCritInput] = useState<number>(85);
  const [refreshSecInput, setRefreshSecInput] = useState<number>(30);

  useEffect(() => {
    const unsubscribe = SupabaseLimitsService.subscribe((next) => {
      setSnapshot(next);
      if (next.telemetry?.monitorConfig) {
        setWarnInput(next.telemetry.monitorConfig.warningThresholdPercent || 70);
        setCritInput(next.telemetry.monitorConfig.criticalThresholdPercent || 85);
        setRefreshSecInput(next.telemetry.monitorConfig.autoRefreshSeconds || 30);
      }
    });
    const stopSync = SupabaseLimitsService.initRealtimeSync();
    return () => {
      unsubscribe();
      stopSync();
    };
  }, []);

  const telemetry = snapshot.telemetry;
  const evaluation = snapshot.evaluation;
  const activePlan: SupabasePlanTier =
    evaluation?.activePlan || telemetry?.monitorConfig?.activePlan || 'free';
  const alertSummary = evaluation?.alertSummary;

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await SupabaseLimitsService.fetchTelemetry();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handlePlanSwitch = async (nextPlan: SupabasePlanTier) => {
    if (isSavingConfig) return;
    setIsSavingConfig(true);
    setSaveFeedback(null);
    const res = await SupabaseLimitsService.updateMonitorConfig(
      { activePlan: nextPlan },
      adminName,
      language
    );
    setIsSavingConfig(false);
    if (res.success) {
      setSaveFeedback({
        type: 'success',
        message: isBn
          ? `সক্রিয় প্ল্যান "${nextPlan === 'pro' ? 'Paid Pro ($২৫/মাস)' : 'Free ($০/মাস)'}" সংরক্ষণ করা হয়েছে।`
          : `Active plan monitor switched to ${nextPlan === 'pro' ? 'Paid Pro ($25/mo)' : 'Free ($0/mo)'}.`,
      });
    } else {
      setSaveFeedback({
        type: 'error',
        message: res.error || (isBn ? 'সেটিংস সেভ করা যায়নি।' : 'Could not update plan preference.'),
      });
    }
  };

  const handleSaveThresholds = async (e: React.FormEvent) => {
    e.preventDefault();
    if (critInput <= warnInput) {
      setSaveFeedback({
        type: 'error',
        message: isBn
          ? 'রেড অ্যালার্ট % অবশ্যই ওয়ার্নিং %-এর চেয়ে বেশি হতে হবে।'
          : 'Red Alert threshold % must be higher than Warning threshold %.',
      });
      return;
    }

    setIsSavingConfig(true);
    setSaveFeedback(null);
    const res = await SupabaseLimitsService.updateMonitorConfig(
      {
        warningThresholdPercent: warnInput,
        criticalThresholdPercent: critInput,
        autoRefreshSeconds: refreshSecInput,
      },
      adminName,
      language
    );
    setIsSavingConfig(false);
    if (res.success) {
      setSaveFeedback({
        type: 'success',
        message: isBn
          ? 'অ্যালার্ট থ্রেশহোল্ড ও রিফ্রেশ সময় সফলভাবে সেভ হয়েছে।'
          : 'Alert thresholds & live refresh cadence saved.',
      });
      setShowThresholdPanel(false);
    } else {
      setSaveFeedback({
        type: 'error',
        message: res.error || (isBn ? 'সেভ করতে সমস্যা হয়েছে।' : 'Failed to save thresholds.'),
      });
    }
  };

  const toggleAlertSimulation = () => {
    SupabaseLimitsService.setSimulatedRedAlert(!snapshot.simulateRedAlert);
  };

  const realtimeStatusLabel = (() => {
    switch (snapshot.realtimeState) {
      case 'SUBSCRIBED':
        return isBn ? 'লাইভ রিয়েলটাইম সক্রিয়' : 'LIVE REALTIME CONNECTED';
      case 'CONNECTING':
        return isBn ? 'রিয়েলটাইম কানেক্ট হচ্ছে...' : 'CONNECTING REALTIME...';
      case 'POLLING_FALLBACK':
        return isBn ? 'অটো-সিঙ্ক পোলিং চালু' : 'AUTO-POLL SYNC ACTIVE';
      default:
        return isBn ? 'অফলাইন' : 'OFFLINE';
    }
  })();

  const formattedLastSync = snapshot.lastSyncedAt
    ? new Date(snapshot.lastSyncedAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '—';

  return (
    <div className="space-y-6">
      {/* ================================================================ */}
      {/* 1. CRITICAL / WARNING RED ALERT BANNER (ALWAYS AT TOP WHEN NEAR LIMIT) */}
      {/* ================================================================ */}
      {alertSummary && alertSummary.hasAnyWarningOrAlert && (
        <div
          role="alert"
          className={`rounded-3xl p-5 sm:p-6 shadow-xl border-2 transition-all ${
            alertSummary.hasRedAlert
              ? 'bg-gradient-to-r from-rose-700 via-red-600 to-rose-700 text-white border-rose-300 shadow-rose-500/30'
              : 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 text-slate-950 border-amber-200 shadow-amber-500/20'
          }`}
        >
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5 min-w-0">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
                  alertSummary.hasRedAlert
                    ? 'bg-white/15 border-white/30 text-white animate-pulse'
                    : 'bg-slate-950/10 border-slate-950/20 text-slate-950'
                }`}
              >
                {alertSummary.hasRedAlert ? (
                  <AlertOctagon className="w-6 h-6" />
                ) : (
                  <AlertTriangle className="w-6 h-6" />
                )}
              </div>

              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black tracking-wider uppercase ${
                      alertSummary.hasRedAlert
                        ? 'bg-white text-rose-700'
                        : 'bg-slate-950 text-amber-300'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        alertSummary.hasRedAlert ? 'bg-rose-600 animate-ping' : 'bg-amber-400'
                      }`}
                    />
                    {alertSummary.hasRedAlert
                      ? isBn
                        ? `রেড অ্যালার্ট (${alertSummary.highestPercent}% পূর্ণ)`
                        : `CRITICAL RED ALERT (${alertSummary.highestPercent}% USED)`
                      : isBn
                      ? `সতর্কতা (${alertSummary.highestPercent}% পূর্ণ)`
                      : `CAPACITY WARNING (${alertSummary.highestPercent}% USED)`}
                  </span>

                  {alertSummary.isSimulation && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-950/30 border border-white/25 text-white">
                      <FlaskConical className="w-3 h-3" />
                      {isBn ? 'টেস্ট সিমুলেশন মোড' : 'ALERT PREVIEW SIMULATION'}
                    </span>
                  )}
                </div>

                <h2 className="text-base sm:text-lg font-black leading-snug break-words">
                  {isBn ? alertSummary.headlineBn : alertSummary.headlineEn}
                </h2>
                <p
                  className={`text-xs sm:text-sm leading-relaxed ${
                    alertSummary.hasRedAlert ? 'text-rose-100' : 'text-slate-900 font-medium'
                  }`}
                >
                  {isBn ? alertSummary.recommendationBn : alertSummary.recommendationEn}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0 w-full lg:w-auto justify-end">
              {alertSummary.isSimulation && (
                <button
                  type="button"
                  onClick={toggleAlertSimulation}
                  className="px-3.5 py-2.5 min-h-[44px] rounded-xl text-xs font-bold bg-white/15 hover:bg-white/25 text-white border border-white/30 transition-colors cursor-pointer"
                >
                  {isBn ? 'সিমুলেশন বন্ধ করুন' : 'Exit Alert Preview'}
                </button>
              )}
              <a
                href={SUPABASE_DASHBOARD_USAGE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-xl text-xs font-black transition-all shadow-md ${
                  alertSummary.hasRedAlert
                    ? 'bg-white text-rose-700 hover:bg-rose-50'
                    : 'bg-slate-950 text-white hover:bg-slate-800'
                }`}
              >
                <span>{isBn ? 'Supabase আপগ্রেড / বিলিং দেখুন' : 'Open Supabase Billing & Upgrade'}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* 2. TOP DARK OBSIDIAN TELEMETRY COMMAND DECK                      */}
      {/* ================================================================ */}
      <div className="bg-[#0F172A] text-white rounded-3xl p-5 sm:p-7 shadow-xl border border-slate-800 space-y-5">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold tracking-wide">
                <Radio className="w-3 h-3 animate-pulse" />
                {realtimeStatusLabel}
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30 text-[11px] font-mono">
                Project: {SUPABASE_PROJECT_ID}
              </span>
              {telemetry?.postgresVersion && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-[11px] font-mono">
                  Postgres {telemetry.postgresVersion}
                </span>
              )}
            </div>

            <h2 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2.5">
              <Server className="w-6 h-6 text-sky-400 shrink-0" />
              <span>
                {isBn
                  ? 'সুপাবেস ব্যাকএন্ড ব্যবহার ও প্ল্যান লিমিট মনিটর'
                  : 'Supabase Backend Usage & Plan Limits Monitor'}
              </span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-3xl">
              {isBn
                ? 'ফ্রি ($০) ও পেইড প্রো ($২৫) প্ল্যানের তুলনা, লাইভ ডাটাবেস/স্টোরেজ ব্যবহার এবং লিমিট শেষ হওয়ার আগে অটোমেটিক রেড অ্যালার্ট।'
                : 'Live PostgreSQL, Storage, Auth MAU & connection telemetry comparing Free ($0/mo) and Paid Pro ($25/mo) limits with automatic Red Alerts.'}
            </p>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto justify-start xl:justify-end">
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 min-h-[44px] rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-60 text-white text-xs font-bold transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isBn ? 'লাইভ রিফ্রেশ' : 'Refresh Now'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowThresholdPanel((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 min-h-[44px] rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                showThresholdPanel
                  ? 'bg-white text-slate-900 border-white'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>{isBn ? 'অ্যালার্ট সেটিংস' : 'Alert Thresholds'}</span>
            </button>

            <button
              type="button"
              onClick={toggleAlertSimulation}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 min-h-[44px] rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                snapshot.simulateRedAlert
                  ? 'bg-rose-600 text-white border-rose-400 animate-pulse'
                  : 'bg-slate-800 hover:bg-slate-700 text-rose-300 border-rose-500/40'
              }`}
              title={
                isBn
                  ? 'ডাটাবেস পরিবর্তন না করেই রেড অ্যালার্ট কেমন দেখায় তা টেস্ট করুন'
                  : 'Preview how the Red Alert banner behaves without altering live database data'
              }
            >
              <FlaskConical className="w-3.5 h-3.5" />
              <span>
                {snapshot.simulateRedAlert
                  ? isBn
                    ? 'টেস্ট অ্যালার্ট বন্ধ'
                    : 'Stop Preview'
                  : isBn
                  ? 'রেড অ্যালার্ট টেস্ট'
                  : 'Test Red Alert'}
              </span>
            </button>

            <a
              href={SUPABASE_DASHBOARD_USAGE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 min-h-[44px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors"
            >
              <span>{isBn ? 'Supabase ড্যাশবোর্ড' : 'Supabase Billing'}</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-sky-400" />
            </a>
          </div>
        </div>

        {/* Active Plan Switcher & Sync Bar */}
        <div className="pt-4 border-t border-slate-800 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1">
              {isBn ? 'সক্রিয় প্ল্যান নির্বাচন:' : 'Active Plan Target:'}
            </span>
            <div className="inline-flex rounded-xl bg-slate-900 p-1 border border-slate-700">
              <button
                type="button"
                disabled={isSavingConfig}
                onClick={() => handlePlanSwitch('free')}
                className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activePlan === 'free'
                    ? 'bg-sky-500 text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>{SUPABASE_PLAN_SPECS.free[isBn ? 'nameBn' : 'nameEn']}</span>
              </button>
              <button
                type="button"
                disabled={isSavingConfig}
                onClick={() => handlePlanSwitch('pro')}
                className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activePlan === 'pro'
                    ? 'bg-amber-400 text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Crown className="w-3.5 h-3.5" />
                <span>{SUPABASE_PLAN_SPECS.pro[isBn ? 'nameBn' : 'nameEn']}</span>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-sky-400" />
              <span>
                {isBn ? 'শেষ সিঙ্ক:' : 'Last Synced:'} <strong className="text-white">{formattedLastSync}</strong>
              </span>
            </span>
            <span className="text-slate-600">•</span>
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>
                {isBn ? 'রিয়েলটাইম ইভেন্ট:' : 'Live Events:'}{' '}
                <strong className="text-emerald-300">{snapshot.realtimeEventsCount}</strong>
                {snapshot.lastEventTable ? ` (${snapshot.lastEventTable})` : ''}
              </span>
            </span>
            <span className="text-slate-600">•</span>
            <span>
              {isBn ? 'সতর্কতা:' : 'Alerts:'}{' '}
              <strong className="text-amber-300">{warnInput}%</strong> /{' '}
              <strong className="text-rose-400">{critInput}% Red</strong>
            </span>
          </div>
        </div>

        {/* Collapsible Threshold Settings Form */}
        {showThresholdPanel && (
          <form
            onSubmit={handleSaveThresholds}
            className="bg-slate-900/90 border border-slate-700 rounded-2xl p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-4 gap-4 items-end"
          >
            <div>
              <label className="block text-[11px] font-bold text-amber-300 uppercase tracking-wide mb-1.5">
                {isBn ? 'ওয়ার্নিং অ্যালার্ট (%)' : 'Warning Threshold (%)'}
              </label>
              <input
                type="number"
                min={50}
                max={90}
                value={warnInput}
                onChange={(e) => setWarnInput(Number(e.target.value))}
                className="w-full px-3 py-2.5 min-h-[44px] rounded-xl bg-slate-800 border border-slate-600 text-white text-sm font-bold focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-rose-300 uppercase tracking-wide mb-1.5">
                {isBn ? 'রেড অ্যালার্ট (%)' : 'Critical Red Alert (%)'}
              </label>
              <input
                type="number"
                min={55}
                max={99}
                value={critInput}
                onChange={(e) => setCritInput(Number(e.target.value))}
                className="w-full px-3 py-2.5 min-h-[44px] rounded-xl bg-slate-800 border border-slate-600 text-white text-sm font-bold focus:outline-none focus:border-rose-400"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-sky-300 uppercase tracking-wide mb-1.5">
                {isBn ? 'অটো-রিফ্রেশ (সেকেন্ড)' : 'Auto-Refresh (Seconds)'}
              </label>
              <select
                value={refreshSecInput}
                onChange={(e) => setRefreshSecInput(Number(e.target.value))}
                className="w-full px-3 py-2.5 min-h-[44px] rounded-xl bg-slate-800 border border-slate-600 text-white text-sm font-bold focus:outline-none focus:border-sky-400"
              >
                <option value={10}>10s (Ultra Live)</option>
                <option value={20}>20s</option>
                <option value={30}>30s (Recommended)</option>
                <option value={60}>60s</option>
                <option value={120}>120s</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={isSavingConfig}
              className="w-full px-4 py-2.5 min-h-[44px] rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-slate-950 text-xs font-black transition-colors cursor-pointer"
            >
              {isSavingConfig
                ? isBn
                  ? 'সংরক্ষণ হচ্ছে...'
                  : 'Saving...'
                : isBn
                ? 'সেটিংস সেভ করুন'
                : 'Save Alert Settings'}
            </button>
          </form>
        )}

        {saveFeedback && (
          <div
            className={`px-4 py-3 rounded-2xl text-xs font-semibold border flex items-center gap-2 ${
              saveFeedback.type === 'success'
                ? 'bg-emerald-500/15 text-emerald-200 border-emerald-500/40'
                : 'bg-rose-500/20 text-rose-200 border-rose-500/40'
            }`}
          >
            {saveFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{saveFeedback.message}</span>
          </div>
        )}
      </div>

      {/* ================================================================ */}
      {/* 3. LOADING / MIGRATION OR AUTH ERROR GUIDANCE                    */}
      {/* ================================================================ */}
      {snapshot.status === 'loading' && !telemetry && (
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm flex flex-col items-center justify-center gap-3 text-center">
          <RefreshCw className="w-8 h-8 text-sky-600 animate-spin" />
          <p className="text-sm font-bold text-slate-800">
            {isBn
              ? 'সুপাবেস থেকে লাইভ ডাটাবেস ও স্টোরেজ টেলিমেট্রি লোড হচ্ছে...'
              : 'Loading live PostgreSQL & Storage telemetry from Supabase...'}
          </p>
        </div>
      )}

      {snapshot.status === 'error' && !telemetry && (
        <div className="bg-amber-50 border border-amber-300 rounded-3xl p-6 space-y-3">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-6 h-6 text-amber-700 shrink-0 mt-0.5" />
            <div className="space-y-1.5">
              <h3 className="text-base font-black text-amber-950">
                {snapshot.migrationMissing
                  ? isBn
                    ? 'ব্যাকএন্ড টেলিমেট্রি SQL মাইগ্রেশন এখনো রান করা হয়নি'
                    : 'Supabase Telemetry Migration Needed in Live Database'
                  : snapshot.permissionDenied
                  ? isBn
                    ? 'সুপার অ্যাডমিন Supabase Auth সেশন যাচাই প্রয়োজন'
                    : 'Verified Super Admin Supabase Auth Session Required'
                  : isBn
                  ? 'লাইভ টেলিমেট্রি লোড করা যায়নি'
                  : 'Unable to Fetch Live Telemetry'}
              </h3>
              <p className="text-xs sm:text-sm text-amber-900">
                {snapshot.migrationMissing
                  ? isBn
                    ? 'সুপাবেস SQL Editor-এ গিয়ে supabase/migrations/20270324000000_supabase_usage_telemetry_rpc.sql ফাইলটি রান করলেই লাইভ ডাটাবেস ও স্টোরেজ মিটার চালু হয়ে যাবে। নিচে ফ্রি ও পেইড প্ল্যানের পূর্ণ লিমিট তালিকা দেখতে পাবেন।'
                    : 'Run supabase/migrations/20270324000000_supabase_usage_telemetry_rpc.sql in Supabase SQL Editor to activate live Postgres, Storage & MAU meters. Both Free and Pro plan quotas are shown below for reference.'
                  : snapshot.error}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* 4. LIVE METERED QUOTA CARDS (SHOWING FREE + PRO HEADROOM)        */}
      {/* ================================================================ */}
      {evaluation && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {evaluation.metrics.map((metric) => {
            const theme = getSeverityTheme(metric.severity);
            const Icon = getMetricIcon(metric.id);
            const barWidth = Math.min(100, Math.max(metric.activePercent > 0 ? 3 : 0, metric.activePercent));

            return (
              <div
                key={metric.id}
                className={`rounded-3xl p-5 border shadow-sm transition-all flex flex-col justify-between gap-4 ${theme.cardBorder}`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 ${theme.iconWrap}`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-black text-slate-900 leading-tight">
                          {isBn ? metric.titleBn : metric.titleEn}
                        </h3>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                          {isBn ? metric.sublabelBn : metric.sublabelEn}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded-full border shrink-0 ${theme.badge}`}
                    >
                      {isBn ? theme.labelBn : theme.labelEn}
                    </span>
                  </div>

                  {/* Primary Live Reading */}
                  <div className="flex items-baseline justify-between gap-2">
                    <div>
                      <span className="text-2xl font-black text-slate-900 tracking-tight">
                        {metric.usedLabel}
                      </span>
                      <span className="text-xs font-semibold text-slate-500 ml-1.5">
                        / {metric.activeLimitLabel}
                      </span>
                    </div>
                    <span className={`text-sm font-black ${theme.text}`}>
                      {metric.activePercent.toFixed(1)}%
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className={`w-full h-3 rounded-full overflow-hidden ${theme.barBg}`}>
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${theme.barFill}`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>

                {/* Free vs Pro Comparison Pills on Every Card */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="grid grid-cols-2 gap-2">
                    <div
                      className={`rounded-xl px-2.5 py-2 border text-[11px] ${
                        activePlan === 'free'
                          ? 'bg-sky-50 border-sky-300 text-sky-950 font-bold'
                          : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="uppercase tracking-wide text-[9px] font-black text-sky-700">
                          FREE LIMIT
                        </span>
                        <span className="font-mono text-[10px]">{metric.freePercent.toFixed(1)}%</span>
                      </div>
                      <div className="font-bold mt-0.5 truncate">{metric.freeLimitLabel}</div>
                    </div>

                    <div
                      className={`rounded-xl px-2.5 py-2 border text-[11px] ${
                        activePlan === 'pro'
                          ? 'bg-amber-50 border-amber-300 text-amber-950 font-bold'
                          : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="uppercase tracking-wide text-[9px] font-black text-amber-700">
                          PRO ($25) LIMIT
                        </span>
                        <span className="font-mono text-[10px]">{metric.proPercent.toFixed(1)}%</span>
                      </div>
                      <div className="font-bold mt-0.5 truncate">{metric.proLimitLabel}</div>
                    </div>
                  </div>

                  {(metric.overageHintEn || metric.overageHintBn) && (
                    <p className="text-[11px] text-slate-500 leading-snug">
                      {isBn ? metric.overageHintBn : metric.overageHintEn}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ================================================================ */}
      {/* 5. COMPLETE FREE PLAN vs PAID PRO PLAN COMPARISON TABLE          */}
      {/* ================================================================ */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/70">
          <div>
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-sky-600" />
              <span>
                {isBn
                  ? 'সম্পূর্ণ ফ্রি বনাম পেইড প্রো প্ল্যান লিমিট তুলনা'
                  : 'Complete Free Plan vs Paid Pro Plan Quotas'}
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {isBn
                ? 'SQL ও স্টোরেজ মেট্রিক লাইভ গণনা করা হয়; ইগ্রেস ও Edge কল লিমিট সরাসরি Supabase Billing-এ দেখুন।'
                : 'Postgres & Storage quotas update live; Bandwidth/Edge Function totals link directly to your Supabase Billing meter.'}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-slate-900 text-white self-start sm:self-center">
            {isBn ? 'সক্রিয় টার্গেট:' : 'Monitoring:'}{' '}
            {activePlan === 'pro' ? 'PRO ($25/mo)' : 'FREE ($0/mo)'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[680px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-black uppercase tracking-wider text-slate-500">
                <th className="py-3 px-5">{isBn ? 'সুপাবেস ফিচার / কোটা' : 'Supabase Quota'}</th>
                <th className="py-3 px-4">{isBn ? 'বর্তমান ব্যবহার (লাইভ)' : 'Current Usage'}</th>
                <th
                  className={`py-3 px-4 ${
                    activePlan === 'free' ? 'bg-sky-50/70 text-sky-900' : ''
                  }`}
                >
                  {isBn ? 'ফ্রি প্ল্যান ($০/মাস)' : 'Free Plan ($0/mo)'}
                </th>
                <th
                  className={`py-3 px-4 ${
                    activePlan === 'pro' ? 'bg-amber-50/70 text-amber-900' : ''
                  }`}
                >
                  {isBn ? 'পেইড প্রো ($২৫/মাস)' : 'Paid Pro ($25/mo)'}
                </th>
                <th className="py-3 px-4 text-right">{isBn ? 'স্ট্যাটাস' : 'Status'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {(evaluation?.comparisonRows || [
                {
                  key: 'db',
                  featureEn: 'PostgreSQL Database Size',
                  featureBn: 'ডাটাবেস স্টোরেজ',
                  currentUsageLabelEn: 'Pending telemetry RPC',
                  currentUsageLabelBn: 'টেলিমেট্রি পেন্ডিং',
                  freeLimitEn: '500 MB',
                  freeLimitBn: '৫০০ MB',
                  proLimitEn: '8 GB included ($0.125/GB)',
                  proLimitBn: '৮ GB ($০.১২৫/GB)',
                  isDirectlyMetered: true,
                  activePercent: null,
                  severity: 'healthy' as QuotaSeverity,
                },
                {
                  key: 'st',
                  featureEn: 'File Storage Buckets',
                  featureBn: 'ফাইল স্টোরেজ',
                  currentUsageLabelEn: 'Pending telemetry RPC',
                  currentUsageLabelBn: 'টেলিমেট্রি পেন্ডিং',
                  freeLimitEn: '1 GB (50 MB/file)',
                  freeLimitBn: '১ GB (৫০ MB/ফাইল)',
                  proLimitEn: '100 GB (50 GB/file)',
                  proLimitBn: '১০০ GB (৫০ GB/ফাইল)',
                  isDirectlyMetered: true,
                  activePercent: null,
                  severity: 'healthy' as QuotaSeverity,
                },
                {
                  key: 'eg',
                  featureEn: 'Egress / Bandwidth',
                  featureBn: 'ব্যান্ডউইথ / ইগ্রেস',
                  currentUsageLabelEn: 'Check Supabase Billing',
                  currentUsageLabelBn: 'Billing-এ দেখুন',
                  freeLimitEn: '5 GB + 5 GB cached',
                  freeLimitBn: '৫ GB + ৫ GB ক্যাশড',
                  proLimitEn: '250 GB included',
                  proLimitBn: '২৫০ GB অন্তর্ভুক্ত',
                  isDirectlyMetered: false,
                  activePercent: null,
                  severity: 'healthy' as QuotaSeverity,
                },
                {
                  key: 'au',
                  featureEn: 'Auth MAUs (Monthly Active Users)',
                  featureBn: 'Auth MAU লিমিট',
                  currentUsageLabelEn: 'Pending telemetry RPC',
                  currentUsageLabelBn: 'টেলিমেট্রি পেন্ডিং',
                  freeLimitEn: '50,000 MAU',
                  freeLimitBn: '৫০,০০০ MAU',
                  proLimitEn: '100,000 MAU',
                  proLimitBn: '১,০০,০০০ MAU',
                  isDirectlyMetered: true,
                  activePercent: null,
                  severity: 'healthy' as QuotaSeverity,
                },
                {
                  key: 'fn',
                  featureEn: 'Edge Function Invocations',
                  featureBn: 'Edge Function কল',
                  currentUsageLabelEn: 'Check Supabase Billing',
                  currentUsageLabelBn: 'Billing-এ দেখুন',
                  freeLimitEn: '500,000 / mo',
                  freeLimitBn: '৫,০০,০০০ / মাস',
                  proLimitEn: '2,000,000 / mo',
                  proLimitBn: '২০,০০,০০০ / মাস',
                  isDirectlyMetered: false,
                  activePercent: null,
                  severity: 'healthy' as QuotaSeverity,
                },
              ]).map((row) => {
                const rowTheme = getSeverityTheme(row.severity);
                return (
                  <tr key={row.key} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-5 font-bold text-slate-900">
                      <div className="flex items-center gap-2">
                        <span>{isBn ? row.featureBn : row.featureEn}</span>
                        {row.isDirectlyMetered ? (
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                            SQL LIVE
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                            PLATFORM
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-800">
                      {isBn ? row.currentUsageLabelBn : row.currentUsageLabelEn}
                    </td>
                    <td
                      className={`py-3.5 px-4 font-semibold ${
                        activePlan === 'free'
                          ? 'bg-sky-50/40 text-sky-950 font-bold'
                          : 'text-slate-600'
                      }`}
                    >
                      {isBn ? row.freeLimitBn : row.freeLimitEn}
                    </td>
                    <td
                      className={`py-3.5 px-4 font-semibold ${
                        activePlan === 'pro'
                          ? 'bg-amber-50/40 text-amber-950 font-bold'
                          : 'text-slate-600'
                      }`}
                    >
                      {isBn ? row.proLimitBn : row.proLimitEn}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black border ${rowTheme.badge}`}
                      >
                        {isBn ? rowTheme.labelBn : rowTheme.labelEn}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================================================================ */}
      {/* 6. DEEP STORAGE & DATABASE TABLE BREAKDOWN                       */}
      {/* ================================================================ */}
      {telemetry && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Postgres Tables */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Database className="w-4 h-4 text-sky-600" />
                <span>
                  {isBn ? 'সর্ববৃহৎ ডাটাবেস টেবিলসমূহ' : 'Largest PostgreSQL Tables'}
                </span>
              </h3>
              <span className="text-xs font-bold text-slate-500">
                {formatBytes(telemetry.database.sizeBytes)} total DB
              </span>
            </div>

            <div className="space-y-2.5">
              {telemetry.database.topTables.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">
                  {isBn ? 'কোনো টেবিল তথ্য পাওয়া যায়নি' : 'No table size stats returned'}
                </p>
              ) : (
                telemetry.database.topTables.map((tbl) => {
                  const pctOfDb =
                    telemetry.database.sizeBytes > 0
                      ? Math.min(100, (tbl.totalBytes / telemetry.database.sizeBytes) * 100)
                      : 0;
                  return (
                    <div
                      key={tbl.tableName}
                      className="rounded-2xl border border-slate-100 bg-slate-50/60 p-3 space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-mono font-bold text-slate-900 truncate">
                          public.{tbl.tableName}
                        </span>
                        <span className="font-black text-slate-800 shrink-0">
                          {formatBytes(tbl.totalBytes)}
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-sky-500"
                          style={{ width: `${Math.max(2, pctOfDb)}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>~{formatNumberCompact(tbl.estimatedRows)} rows</span>
                        <span>
                          Heap {formatBytes(tbl.heapBytes)} · Indexes {formatBytes(tbl.indexBytes)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Storage Buckets & Live Activity Velocity */}
          <div className="space-y-6">
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-emerald-600" />
                  <span>{isBn ? 'স্টোরেজ বাকেটসমূহ' : 'Storage Buckets Breakdown'}</span>
                </h3>
                <span className="text-xs font-bold text-slate-500">
                  {formatNumberCompact(telemetry.storage.fileCount)} files ·{' '}
                  {formatBytes(telemetry.storage.totalBytes)}
                </span>
              </div>

              <div className="space-y-2.5">
                {telemetry.storage.buckets.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 text-center">
                    {isBn ? 'কোনো স্টোরেজ বাকেট পাওয়া যায়নি' : 'No storage buckets detected'}
                  </p>
                ) : (
                  telemetry.storage.buckets.map((bucket) => (
                    <div
                      key={bucket.bucketId}
                      className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-900 truncate">
                            {bucket.bucketName}
                          </span>
                          <span
                            className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${
                              bucket.isPublic
                                ? 'bg-sky-50 text-sky-700 border-sky-200'
                                : 'bg-slate-200 text-slate-700 border-slate-300'
                            }`}
                          >
                            {bucket.isPublic ? 'PUBLIC' : 'PRIVATE'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {formatNumberCompact(bucket.fileCount)} files · Max file:{' '}
                          {formatBytes(bucket.maxFileBytes)}
                        </p>
                      </div>
                      <span className="text-xs font-black text-slate-900 shrink-0">
                        {formatBytes(bucket.totalBytes)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Live 24h Traffic Pulse */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-5 sm:p-6 space-y-3">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-600" />
                <span>{isBn ? 'গত ২৪ ঘণ্টা ও লাইভ অ্যাক্টিভিটি' : '24h & Total Backend Activity'}</span>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3">
                  <div className="text-slate-500 font-semibold">Registrations</div>
                  <div className="text-lg font-black text-slate-900 mt-0.5">
                    {formatNumberCompact(telemetry.activity.registrationsTotal)}
                  </div>
                  <div className="text-[11px] text-emerald-700 font-bold">
                    +{telemetry.activity.registrations24h} in 24h
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3">
                  <div className="text-slate-500 font-semibold">Donations</div>
                  <div className="text-lg font-black text-slate-900 mt-0.5">
                    {formatNumberCompact(telemetry.activity.donationsTotal)}
                  </div>
                  <div className="text-[11px] text-emerald-700 font-bold">
                    +{telemetry.activity.donations24h} in 24h
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3">
                  <div className="text-slate-500 font-semibold">PayStation IPNs</div>
                  <div className="text-lg font-black text-slate-900 mt-0.5">
                    {formatNumberCompact(telemetry.activity.ipnLogsTotal)}
                  </div>
                  <div className="text-[11px] text-sky-700 font-bold">
                    +{telemetry.activity.ipnLogs24h} in 24h ({telemetry.activity.ipnLogs30d}/30d)
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3">
                  <div className="text-slate-500 font-semibold">Pending Orders</div>
                  <div className="text-lg font-black text-slate-900 mt-0.5">
                    {formatNumberCompact(telemetry.activity.pendingOrdersTotal)}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    +{telemetry.activity.pendingOrders24h} in 24h
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3">
                  <div className="text-slate-500 font-semibold">Student ID Whitelist</div>
                  <div className="text-lg font-black text-slate-900 mt-0.5">
                    {formatNumberCompact(telemetry.activity.currentStudentIdsTotal)}
                  </div>
                  <div className="text-[11px] text-slate-500">Eligible IDs</div>
                </div>
                <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3">
                  <div className="text-slate-500 font-semibold">Audit Trail Logs</div>
                  <div className="text-lg font-black text-slate-900 mt-0.5">
                    {formatNumberCompact(telemetry.activity.auditLogsTotal)}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {telemetry.activity.auditLogs30d} in 30d
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
