import React, { useState, useEffect } from 'react';
import {
  Globe,
  GraduationCap,
  BookOpen,
  HeartHandshake,
  Lock,
  Unlock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  AlertCircle,
  Save,
  Check,
  Shield,
  Sliders,
  RefreshCw,
  CalendarClock,
  PhoneCall,
  Info,
  RotateCcw,
} from 'lucide-react';
import {
  FeeSettings,
  Language,
  ClosureNoticeContent,
  ClosureNoticeTarget,
  GovernanceLoadStatus,
} from '../../types';
import { AppStore, DEFAULT_CLOSURE_NOTICES, normalizeClosureNoticeContent } from '../../services/store';
import { GovernanceSettingsService } from '../../services/governanceSettingsService';
import {
  isGlobalRegistrationOpen,
  isDonationOpen,
} from '../../utils/rules';

interface RegistrationDonationControlPanelProps {
  language?: Language;
  adminName?: string;
  isSuperAdmin?: boolean;
  onSettingsChanged?: (updated: FeeSettings) => void;
}

type SwitchFieldKey =
  | 'registrationOpen'
  | 'alumniRegistrationOpen'
  | 'currentStudentRegistrationOpen'
  | 'donationOpen';

export const RegistrationDonationControlPanel: React.FC<RegistrationDonationControlPanelProps> = ({
  language = 'en',
  adminName = 'Super Admin',
  isSuperAdmin = false,
  onSettingsChanged,
}) => {
  const isBn = language === 'bn';

  const [loadStatus, setLoadStatus] = useState<GovernanceLoadStatus>(
    () => GovernanceSettingsService.getSnapshot().status
  );
  const [loadError, setLoadError] = useState<string | null>(
    () => GovernanceSettingsService.getSnapshot().error
  );
  const [confirmedSettings, setConfirmedSettings] = useState<FeeSettings>(
    () => GovernanceSettingsService.getConfirmedSettings() || AppStore.getFeeSettings()
  );

  // Master & category switches (mirror confirmed Supabase values unless temporarily toggling)
  const [globalOpen, setGlobalOpen] = useState(() => isGlobalRegistrationOpen(confirmedSettings));
  const [alumniOpen, setAlumniOpen] = useState(() => confirmedSettings.alumniRegistrationOpen !== false);
  const [currentOpen, setCurrentOpen] = useState(
    () => confirmedSettings.currentStudentRegistrationOpen !== false
  );
  const [donationOpen, setDonationOpen] = useState(() => isDonationOpen(confirmedSettings));

  // Global notice inputs
  const [closedNoticeEn, setClosedNoticeEn] = useState(
    () =>
      confirmedSettings.closedMessageEn ||
      'Online registration is currently closed. If you need special authorization, please contact the Reunion Secretariat.'
  );
  const [closedNoticeBn, setClosedNoticeBn] = useState(
    () =>
      confirmedSettings.closedMessageBn ||
      'অনলাইন রেজিস্ট্রেশন কার্যক্রম বর্তমানে বন্ধ রয়েছে। জরুরি প্রয়োজনে অনুগ্রহ করে পুনর্মিলনী সচিবালয়ে যোগাযোগ করুন।'
  );

  // Separate structured bilingual closure notices for Alumni, Current Student & Donation
  const [alumniNotice, setAlumniNotice] = useState<ClosureNoticeContent>(() =>
    normalizeClosureNoticeContent(
      confirmedSettings.closureNotices?.alumni,
      DEFAULT_CLOSURE_NOTICES.alumni
    )
  );
  const [currentNotice, setCurrentNotice] = useState<ClosureNoticeContent>(() =>
    normalizeClosureNoticeContent(
      confirmedSettings.closureNotices?.currentStudent,
      DEFAULT_CLOSURE_NOTICES.currentStudent
    )
  );
  const [donationNotice, setDonationNotice] = useState<ClosureNoticeContent>(() =>
    normalizeClosureNoticeContent(
      confirmedSettings.closureNotices?.donation,
      DEFAULT_CLOSURE_NOTICES.donation
    )
  );
  const [activeNoticeEditor, setActiveNoticeEditor] = useState<ClosureNoticeTarget>('alumni');

  // Granular saving & status states
  const [savingSwitch, setSavingSwitch] = useState<SwitchFieldKey | null>(null);
  const [savingGlobalNotice, setSavingGlobalNotice] = useState(false);
  const [savingTargetNotice, setSavingTargetNotice] = useState<ClosureNoticeTarget | null>(null);
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const applyConfirmedSwitches = (s: FeeSettings) => {
    setConfirmedSettings(s);
    setGlobalOpen(isGlobalRegistrationOpen(s));
    setAlumniOpen(s.alumniRegistrationOpen !== false);
    setCurrentOpen(s.currentStudentRegistrationOpen !== false);
    setDonationOpen(isDonationOpen(s));
  };

  const applyAllConfirmedToForm = (s: FeeSettings) => {
    applyConfirmedSwitches(s);
    setClosedNoticeEn(s.closedMessageEn || '');
    setClosedNoticeBn(s.closedMessageBn || '');
    setAlumniNotice(
      normalizeClosureNoticeContent(s.closureNotices?.alumni, DEFAULT_CLOSURE_NOTICES.alumni)
    );
    setCurrentNotice(
      normalizeClosureNoticeContent(
        s.closureNotices?.currentStudent,
        DEFAULT_CLOSURE_NOTICES.currentStudent
      )
    );
    setDonationNotice(
      normalizeClosureNoticeContent(s.closureNotices?.donation, DEFAULT_CLOSURE_NOTICES.donation)
    );
  };

  useEffect(() => {
    let active = true;
    const initialSnap = GovernanceSettingsService.getSnapshot();
    if (initialSnap.status === 'ready' && initialSnap.settings) {
      applyAllConfirmedToForm(initialSnap.settings);
      setLoadStatus('ready');
      setLoadError(null);
    }

    GovernanceSettingsService.fetchFromSupabase().then((snap) => {
      if (!active) return;
      setLoadStatus(snap.status);
      setLoadError(snap.error);
      if (snap.status === 'ready' && snap.settings) {
        applyAllConfirmedToForm(snap.settings);
      }
    });

    const unsub = GovernanceSettingsService.subscribe((snap) => {
      if (!active) return;
      setLoadStatus(snap.status);
      setLoadError(snap.error);
      if (snap.status === 'ready' && snap.settings) {
        // Always update switches from authoritative Realtime DB sync
        applyConfirmedSwitches(snap.settings);
        onSettingsChanged?.(snap.settings);
      }
    });

    return () => {
      active = false;
      unsub();
    };
  }, []);

  const showBanner = (type: 'success' | 'error', message: string) => {
    setFeedbackBanner({ type, message });
    if (type === 'success') {
      setTimeout(() => {
        setFeedbackBanner((cur) => (cur?.message === message ? null : cur));
      }, 4000);
    }
  };

  // Toggle and immediately persist ONLY the toggled switch atomically to Supabase
  const handleToggleSwitch = async (field: SwitchFieldKey) => {
    if (savingSwitch || loadStatus !== 'ready') return;

    const prevMap: Record<SwitchFieldKey, boolean> = {
      registrationOpen: globalOpen,
      alumniRegistrationOpen: alumniOpen,
      currentStudentRegistrationOpen: currentOpen,
      donationOpen,
    };
    const nextValue = !prevMap[field];

    // Optimistic UI update while awaiting Supabase confirmation
    if (field === 'registrationOpen') setGlobalOpen(nextValue);
    if (field === 'alumniRegistrationOpen') setAlumniOpen(nextValue);
    if (field === 'currentStudentRegistrationOpen') setCurrentOpen(nextValue);
    if (field === 'donationOpen') setDonationOpen(nextValue);

    setSavingSwitch(field);
    setFeedbackBanner(null);

    const res = await GovernanceSettingsService.patchSettings(
      { [field]: nextValue } as Partial<FeeSettings>,
      adminName,
      language
    );

    setSavingSwitch(null);

    if (!res.success || !res.settings) {
      // Restore last confirmed switch value on failure
      const fallback = res.settings || confirmedSettings;
      applyConfirmedSwitches(fallback);
      showBanner(
        'error',
        res.error ||
          (isBn
            ? 'সুপাবেজে পরিবর্তন সংরক্ষণ ব্যর্থ হয়েছে। পূর্বের নিশ্চিতকৃত অবস্থা ফিরিয়ে আনা হয়েছে।'
            : 'Failed to save switch change to Supabase. Restored the last confirmed state.')
      );
      return;
    }

    applyConfirmedSwitches(res.settings);
    onSettingsChanged?.(res.settings);
    showBanner(
      'success',
      isBn
        ? 'সুইচ পরিবর্তন সফলভাবে সুপাবেজ ডেটাবেজে সংরক্ষিত ও লাইভ সিঙ্ক হয়েছে।'
        : 'Switch updated in Supabase and synced live across all browsers.'
    );
  };

  // Save ONLY Global Closure Notice
  const handleSaveGlobalNotice = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (savingGlobalNotice || loadStatus !== 'ready') return;
    setSavingGlobalNotice(true);
    setFeedbackBanner(null);

    const patch: Partial<FeeSettings> = {
      closedMessageEn: closedNoticeEn.trim(),
      closedMessageBn: closedNoticeBn.trim(),
    };

    const res = await GovernanceSettingsService.patchSettings(patch, adminName, language);
    setSavingGlobalNotice(false);

    if (!res.success || !res.settings) {
      const fallback = res.settings || confirmedSettings;
      setClosedNoticeEn(fallback.closedMessageEn || '');
      setClosedNoticeBn(fallback.closedMessageBn || '');
      showBanner(
        'error',
        res.error ||
          (isBn
            ? 'গ্লোবাল নোটিশ সংরক্ষণ ব্যর্থ হয়েছে। পূর্বের নোটিশ ফিরিয়ে আনা হয়েছে।'
            : 'Failed to save Global closure notice. Restored last confirmed value.')
      );
      return;
    }

    setConfirmedSettings(res.settings);
    setClosedNoticeEn(res.settings.closedMessageEn || '');
    setClosedNoticeBn(res.settings.closedMessageBn || '');
    onSettingsChanged?.(res.settings);
    showBanner(
      'success',
      isBn
        ? 'গ্লোবাল রেজিস্ট্রেশন বন্ধের নোটিশ সুপাবেজে সংরক্ষিত হয়েছে।'
        : 'Global closure notice saved to Supabase.'
    );
  };

  // Save ONLY the selected target notice (alumni | currentStudent | donation)
  const handleSaveTargetNotice = async (target: ClosureNoticeTarget) => {
    if (savingTargetNotice || loadStatus !== 'ready') return;
    setSavingTargetNotice(target);
    setFeedbackBanner(null);

    const draft =
      target === 'alumni' ? alumniNotice : target === 'currentStudent' ? currentNotice : donationNotice;

    const cleaned: ClosureNoticeContent = {
      titleEn: draft.titleEn.trim(),
      titleBn: draft.titleBn.trim(),
      messageEn: draft.messageEn.trim(),
      messageBn: draft.messageBn.trim(),
      reopenAt: (draft.reopenAt || '').trim(),
      contactInfo: (draft.contactInfo || '').trim(),
      instructionsEn: (draft.instructionsEn || '').trim(),
      instructionsBn: (draft.instructionsBn || '').trim(),
    };

    const baseNotices =
      confirmedSettings.closureNotices || {
        alumni: DEFAULT_CLOSURE_NOTICES.alumni,
        currentStudent: DEFAULT_CLOSURE_NOTICES.currentStudent,
        donation: DEFAULT_CLOSURE_NOTICES.donation,
      };

    const patch: Partial<FeeSettings> = {
      closureNotices: {
        ...baseNotices,
        [target]: cleaned,
      },
      ...(target === 'donation'
        ? {
            donationClosedMessageEn: cleaned.messageEn,
            donationClosedMessageBn: cleaned.messageBn,
          }
        : {}),
    };

    const res = await GovernanceSettingsService.patchSettings(patch, adminName, language);
    setSavingTargetNotice(null);

    if (!res.success || !res.settings) {
      const fallback = res.settings || confirmedSettings;
      const confirmedSlot = normalizeClosureNoticeContent(
        fallback.closureNotices?.[target],
        DEFAULT_CLOSURE_NOTICES[target]
      );
      if (target === 'alumni') setAlumniNotice(confirmedSlot);
      if (target === 'currentStudent') setCurrentNotice(confirmedSlot);
      if (target === 'donation') setDonationNotice(confirmedSlot);
      showBanner(
        'error',
        res.error ||
          (isBn
            ? 'নোটিশ সংরক্ষণ ব্যর্থ হয়েছে। পূর্বের নিশ্চিতকৃত নোটিশ ফিরিয়ে আনা হয়েছে।'
            : 'Failed to save closure notice. Restored last confirmed notice.')
      );
      return;
    }

    setConfirmedSettings(res.settings);
    const updatedSlot = normalizeClosureNoticeContent(
      res.settings.closureNotices?.[target],
      DEFAULT_CLOSURE_NOTICES[target]
    );
    if (target === 'alumni') setAlumniNotice(updatedSlot);
    if (target === 'currentStudent') setCurrentNotice(updatedSlot);
    if (target === 'donation') setDonationNotice(updatedSlot);
    onSettingsChanged?.(res.settings);

    const targetLabel =
      target === 'alumni'
        ? isBn ? 'অ্যালামনাই' : 'Alumni'
        : target === 'currentStudent'
        ? isBn ? 'বর্তমান শিক্ষার্থী' : 'Current Student'
        : isBn ? 'অনুদান' : 'Donation';

    showBanner(
      'success',
      isBn
        ? `${targetLabel} বন্ধকালীন নোটিশ সফলভাবে সুপাবেজে সংরক্ষিত হয়েছে।`
        : `${targetLabel} closure notice saved to Supabase and synced live.`
    );
  };

  // Derived Effective Statuses
  const effectiveAlumniActive = globalOpen && alumniOpen;
  const effectiveCurrentActive = globalOpen && currentOpen;
  const effectiveDonationActive = donationOpen;

  const currentEditorNotice =
    activeNoticeEditor === 'alumni'
      ? alumniNotice
      : activeNoticeEditor === 'currentStudent'
      ? currentNotice
      : donationNotice;

  const setCurrentEditorNotice = (updater: (prev: ClosureNoticeContent) => ClosureNoticeContent) => {
    if (activeNoticeEditor === 'alumni') setAlumniNotice(updater);
    else if (activeNoticeEditor === 'currentStudent') setCurrentNotice(updater);
    else setDonationNotice(updater);
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden transition-all">
      {/* ── TOP HEADER ── */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 px-6 py-5 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400 shrink-0 shadow-inner">
            <Sliders className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
                {isBn
                  ? 'রেজিস্ট্রেশন ও অনুদান নিয়ন্ত্রণ ব্যবস্থাপনা'
                  : 'Registration & Donation Governance Control'}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/30">
                Super Admin
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              {isBn
                ? 'গ্লোবাল ও ক্যাটাগরিভিত্তিক রেজিস্ট্রেশন এবং স্বতন্ত্র অনুদান কার্যক্রমের সুপাবেজ-সিঙ্কড নিয়ন্ত্রণ।'
                : 'Authoritative Supabase-synced switches & bilingual closure notices across all devices.'}
            </p>
          </div>
        </div>

        {/* Quick Live Mode Indicator */}
        <div className="flex items-center gap-2 self-start sm:self-auto bg-slate-950/60 border border-slate-700/60 px-3.5 py-1.5 rounded-xl">
          <span className="text-[11px] font-medium text-slate-300">
            {isBn ? 'লাইভ অবস্থা:' : 'Live Policy:'}
          </span>
          {loadStatus !== 'ready' ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-300">
              <RefreshCw className="w-3 h-3 animate-spin" />
              {loadStatus === 'loading' ? (isBn ? 'লোড হচ্ছে...' : 'Loading...') : isBn ? 'সংযোগ ত্রুটি' : 'Sync Error'}
            </span>
          ) : !globalOpen ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-400">
              <Lock className="w-3 h-3" />
              {isBn ? 'গ্লোবাল নিবন্ধন বন্ধ' : 'Global Reg Closed'}
            </span>
          ) : effectiveAlumniActive && effectiveCurrentActive ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400">
              <CheckCircle2 className="w-3 h-3" />
              {isBn ? 'সকল ক্যাটাগরি চালু' : 'All Categories Active'}
            </span>
          ) : effectiveAlumniActive ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-400">
              <GraduationCap className="w-3 h-3" />
              {isBn ? 'শুধু অ্যালামনাই চালু' : 'Alumni Only'}
            </span>
          ) : effectiveCurrentActive ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-400">
              <BookOpen className="w-3 h-3" />
              {isBn ? 'শুধু বর্তমান ছাত্র চালু' : 'Current Students Only'}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400">
              <AlertTriangle className="w-3 h-3" />
              {isBn ? 'উভয় ক্যাটাগরি বন্ধ' : 'Both Categories Closed'}
            </span>
          )}
        </div>
      </div>

      {/* ── ROLE WARNING IF NOT SUPER ADMIN ── */}
      {!isSuperAdmin && (
        <div className="mx-6 mt-5 p-3.5 bg-amber-50 border border-amber-300 rounded-2xl flex items-start gap-2.5 text-xs text-amber-900">
          <Shield className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <span>
            {isBn
              ? 'সতর্কতা: শুধুমাত্র যাচাইকৃত সুপাবেজ সুপার অ্যাডমিন এই সুইচ ও নোটিশ পরিবর্তন সংরক্ষণ করতে পারবেন।'
              : 'View-only guard: Server verification permits only an authenticated Super Admin session to save governance changes.'}
          </span>
        </div>
      )}

      {/* ── INITIAL LOAD ERROR OR FEEDBACK BANNERS ── */}
      {loadStatus === 'error' && (
        <div className="mx-6 mt-5 p-4 bg-rose-50 border border-rose-300 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-rose-900">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">
                {isBn ? 'সুপাবেজ থেকে সেটিংস লোড করা যায়নি' : 'Failed to load authoritative settings from Supabase'}
              </p>
              <p className="text-[11px] text-rose-700 mt-0.5">{loadError}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => GovernanceSettingsService.fetchFromSupabase()}
            className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{isBn ? 'পুনরায় চেষ্টা করুন' : 'Retry'}</span>
          </button>
        </div>
      )}

      {feedbackBanner && (
        <div
          role={feedbackBanner.type === 'error' ? 'alert' : 'status'}
          className={`mx-6 mt-5 p-3.5 rounded-2xl flex items-center justify-between gap-2.5 text-xs border animate-in fade-in slide-in-from-top-1 ${
            feedbackBanner.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedbackBanner.type === 'success' ? (
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-semibold">{feedbackBanner.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            className="text-[11px] font-bold underline cursor-pointer shrink-0 opacity-75 hover:opacity-100"
          >
            {isBn ? 'বন্ধ করুন' : 'Dismiss'}
          </button>
        </div>
      )}

      <div className="p-6 space-y-6">
        {/* ── SECTION 1: MASTER GLOBAL REGISTRATION SWITCH ── */}
        <div
          className={`p-5 rounded-2xl border-2 transition-all ${
            globalOpen
              ? 'bg-emerald-50/50 border-emerald-300 shadow-xs'
              : 'bg-rose-50/40 border-rose-300 shadow-xs'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-900 text-white">
                  {isBn ? 'মাস্টার সুইচ' : 'Master Switch'}
                </span>
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-indigo-600" />
                  <span>
                    {isBn ? '১. গ্লোবাল অনলাইন রেজিস্ট্রেশন' : '1. Global Online Registration'}
                  </span>
                </h3>
              </div>
              <p className="text-xs text-slate-600 max-w-xl">
                {isBn
                  ? 'বন্ধ করলে সকল নিবন্ধন ক্যাটাগরি, কার্ড ও ফর্ম বন্ধ হয়ে গ্লোবাল নোটিশ দেখাবে। পুনরায় চালু করলে প্রতিটি ক্যাটাগরি তার নিজস্ব সেভ করা অবস্থা অনুযায়ী ফিরে আসবে।'
                  : 'Master control. OFF hides category cards and forms and shows the global closure notice. Turning ON restores each category to its saved state. Saves immediately to Supabase.'}
              </p>
            </div>

            <button
              type="button"
              data-testid="switch-global-registration"
              disabled={loadStatus !== 'ready' || savingSwitch !== null}
              onClick={() => handleToggleSwitch('registrationOpen')}
              className={`px-5 py-3 rounded-2xl font-black text-xs sm:text-sm tracking-wide transition-all cursor-pointer flex items-center gap-2.5 shrink-0 shadow-md disabled:opacity-60 disabled:cursor-not-allowed ${
                globalOpen
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                  : 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20'
              }`}
            >
              {savingSwitch === 'registrationOpen' ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : globalOpen ? (
                <Unlock className="w-4 h-4" />
              ) : (
                <Lock className="w-4 h-4" />
              )}
              <span>
                {globalOpen
                  ? isBn
                    ? 'গ্লোবাল চালু (GLOBAL ON)'
                    : 'GLOBAL REGISTRATION: ON'
                  : isBn
                  ? 'গ্লোবাল বন্ধ (GLOBAL OFF)'
                  : 'GLOBAL REGISTRATION: OFF'}
              </span>
            </button>
          </div>

          <div className="mt-3.5 pt-3 border-t border-slate-200/70 flex items-center gap-2 text-xs">
            <span className="font-semibold text-slate-500">
              {isBn ? 'বর্তমান গ্লোবাল অবস্থা:' : 'Master State:'}
            </span>
            {globalOpen ? (
              <span className="font-bold text-emerald-700 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                {isBn
                  ? 'অনলাইন রেজিস্ট্রেশন সক্রিয় — ক্যাটাগরিভিত্তিক অনুমতি প্রযোজ্য'
                  : 'Active — Individual category switches are in effect'}
              </span>
            ) : (
              <span className="font-bold text-rose-700 flex items-center gap-1">
                <XCircle className="w-3.5 h-3.5" />
                {isBn
                  ? 'অনলাইন রেজিস্ট্রেশন সম্পূর্ণ নিষ্ক্রিয় — গ্লোবাল নোটিশ প্রদর্শিত হচ্ছে'
                  : 'All online registration disabled site-wide'}
              </span>
            )}
          </div>
        </div>

        {/* ── SECTION 2: REGISTRATION CATEGORY CONTROLS (SUB-SWITCHES) ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <span>{isBn ? '২. ক্যাটাগরিভিত্তিক রেজিস্ট্রেশন নিয়ন্ত্রণ' : '2. Category-Specific Registration Controls'}</span>
              <span className="text-[10px] text-slate-400 font-normal">
                ({isBn ? 'গ্লোবাল চালু থাকাকালীন কার্যকর' : 'Active when Global Registration is ON'})
              </span>
            </h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Card A: Alumni Registration */}
            <div
              className={`p-4 rounded-2xl border transition-all ${
                !globalOpen
                  ? 'bg-slate-50 border-slate-200 opacity-70'
                  : alumniOpen
                  ? 'bg-sky-50/50 border-sky-300 shadow-2xs'
                  : 'bg-slate-100/70 border-slate-300'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold">
                      <GraduationCap className="w-4 h-4" />
                    </div>
                    <div>
                      <h5 className="text-xs sm:text-sm font-bold text-slate-900">
                        {isBn ? 'প্রাক্তন শিক্ষার্থী (Alumni)' : 'Alumni Registration'}
                      </h5>
                      <span className="text-[10px] font-semibold text-slate-500">
                        {isBn ? `ফি: ৳ ${confirmedSettings.formerStudentFee}` : `Fee: ৳ ${confirmedSettings.formerStudentFee}`} • 1962 – 2025
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1">
                    {isBn
                      ? 'বন্ধ থাকলে কার্ড দৃশ্যমান থাকবে এবং ক্লিক করলে অ্যালামনাই বন্ধের নোটিশ দেখাবে।'
                      : 'When OFF (while Global ON), card stays clickable and shows Alumni closure notice.'}
                  </p>
                </div>

                <button
                  type="button"
                  data-testid="switch-alumni-registration"
                  disabled={!globalOpen || loadStatus !== 'ready' || savingSwitch !== null}
                  onClick={() => handleToggleSwitch('alumniRegistrationOpen')}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 shrink-0 shadow-2xs disabled:opacity-60 disabled:cursor-not-allowed ${
                    !globalOpen
                      ? 'bg-slate-200 text-slate-500'
                      : alumniOpen
                      ? 'bg-sky-600 hover:bg-sky-700 text-white'
                      : 'bg-slate-400 hover:bg-slate-500 text-white'
                  }`}
                >
                  {savingSwitch === 'alumniRegistrationOpen' ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : alumniOpen && globalOpen ? (
                    <Unlock className="w-3.5 h-3.5" />
                  ) : (
                    <Lock className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {alumniOpen
                      ? isBn
                        ? 'চালু (ON)'
                        : 'ALUMNI: ON'
                      : isBn
                      ? 'বন্ধ (OFF)'
                      : 'ALUMNI: OFF'}
                  </span>
                </button>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                <span className="text-slate-500">{isBn ? 'কার্যকর অবস্থা:' : 'Effective:'}</span>
                {effectiveAlumniActive ? (
                  <span className="font-bold text-sky-700 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-sky-600" />
                    {isBn ? 'নিবন্ধন উন্মুক্ত' : 'Available for Alumni'}
                  </span>
                ) : (
                  <span className="font-bold text-slate-500 flex items-center gap-1">
                    <Lock className="w-3 h-3 text-slate-400" />
                    {!globalOpen
                      ? isBn
                        ? `গ্লোবালে বন্ধ (সংরক্ষিত: ${alumniOpen ? 'ON' : 'OFF'})`
                        : `Blocked by Global (Saved: ${alumniOpen ? 'ON' : 'OFF'})`
                      : isBn
                      ? 'অ্যালামনাই নিবন্ধন বন্ধ'
                      : 'Closed (Notice Shown)'}
                  </span>
                )}
              </div>
            </div>

            {/* Card B: Current Student Registration */}
            <div
              className={`p-4 rounded-2xl border transition-all ${
                !globalOpen
                  ? 'bg-slate-50 border-slate-200 opacity-70'
                  : currentOpen
                  ? 'bg-teal-50/50 border-teal-300 shadow-2xs'
                  : 'bg-slate-100/70 border-slate-300'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center font-bold">
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <div>
                      <h5 className="text-xs sm:text-sm font-bold text-slate-900">
                        {isBn ? 'বর্তমান শিক্ষার্থী (Current Student)' : 'Current Student Registration'}
                      </h5>
                      <span className="text-[10px] font-semibold text-slate-500">
                        {isBn ? `ফি: ৳ ${confirmedSettings.currentStudentFee}` : `Fee: ৳ ${confirmedSettings.currentStudentFee}`} • Class 1 – 12
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1">
                    {isBn
                      ? 'বন্ধ থাকলে কার্ড দৃশ্যমান থাকবে এবং ক্লিক করলে বর্তমান শিক্ষার্থীর বন্ধের নোটিশ দেখাবে।'
                      : 'When OFF (while Global ON), card stays clickable and shows Student closure notice.'}
                  </p>
                </div>

                <button
                  type="button"
                  data-testid="switch-current-registration"
                  disabled={!globalOpen || loadStatus !== 'ready' || savingSwitch !== null}
                  onClick={() => handleToggleSwitch('currentStudentRegistrationOpen')}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 shrink-0 shadow-2xs disabled:opacity-60 disabled:cursor-not-allowed ${
                    !globalOpen
                      ? 'bg-slate-200 text-slate-500'
                      : currentOpen
                      ? 'bg-teal-600 hover:bg-teal-700 text-white'
                      : 'bg-slate-400 hover:bg-slate-500 text-white'
                  }`}
                >
                  {savingSwitch === 'currentStudentRegistrationOpen' ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : currentOpen && globalOpen ? (
                    <Unlock className="w-3.5 h-3.5" />
                  ) : (
                    <Lock className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {currentOpen
                      ? isBn
                        ? 'চালু (ON)'
                        : 'CURRENT: ON'
                      : isBn
                      ? 'বন্ধ (OFF)'
                      : 'CURRENT: OFF'}
                  </span>
                </button>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                <span className="text-slate-500">{isBn ? 'কার্যকর অবস্থা:' : 'Effective:'}</span>
                {effectiveCurrentActive ? (
                  <span className="font-bold text-teal-700 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-teal-600" />
                    {isBn ? 'নিবন্ধন উন্মুক্ত' : 'Available for Students'}
                  </span>
                ) : (
                  <span className="font-bold text-slate-500 flex items-center gap-1">
                    <Lock className="w-3 h-3 text-slate-400" />
                    {!globalOpen
                      ? isBn
                        ? `গ্লোবালে বন্ধ (সংরক্ষিত: ${currentOpen ? 'ON' : 'OFF'})`
                        : `Blocked by Global (Saved: ${currentOpen ? 'ON' : 'OFF'})`
                      : isBn
                      ? 'বর্তমান ছাত্র নিবন্ধন বন্ধ'
                      : 'Closed (Notice Shown)'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── SECTION 3: INDEPENDENT DONATION CONTROL SWITCH ── */}
        <div
          className={`p-5 rounded-2xl border-2 transition-all ${
            donationOpen
              ? 'bg-rose-50/40 border-rose-300 shadow-xs'
              : 'bg-slate-100/70 border-slate-300 shadow-xs'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-rose-900 text-white">
                  {isBn ? 'স্বতন্ত্র আর্থিক অনুদান' : 'Independent Portal'}
                </span>
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <HeartHandshake className="w-4 h-4 text-rose-600" />
                  <span>
                    {isBn ? '৩. সাধারণ ও শুভানুধ্যায়ী অনুদান ব্যবস্থাপনা' : '3. Donation Portal & Contribution Control'}
                  </span>
                </h3>
              </div>
              <p className="text-xs text-slate-600 max-w-xl">
                {isBn
                  ? 'রেজিস্ট্রেশন থেকে সম্পূর্ণ স্বতন্ত্র। অনুদান বন্ধ থাকলে লিংক সচল থাকবে এবং অনুদান ফর্মের বদলে অনুদান বন্ধের নোটিশ প্রদর্শিত হবে ও নতুন চেকআউট বন্ধ থাকবে।'
                  : 'Independent of Global Registration. When OFF, the donation link stays available and displays the Donation closure notice in place of the donation form while blocking new checkout.'}
              </p>
            </div>

            <button
              type="button"
              data-testid="switch-donation"
              disabled={loadStatus !== 'ready' || savingSwitch !== null}
              onClick={() => handleToggleSwitch('donationOpen')}
              className={`px-5 py-3 rounded-2xl font-black text-xs sm:text-sm tracking-wide transition-all cursor-pointer flex items-center gap-2.5 shrink-0 shadow-md disabled:opacity-60 disabled:cursor-not-allowed ${
                donationOpen
                  ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20'
                  : 'bg-slate-500 hover:bg-slate-600 text-white shadow-slate-400/20'
              }`}
            >
              {savingSwitch === 'donationOpen' ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : donationOpen ? (
                <Unlock className="w-4 h-4" />
              ) : (
                <Lock className="w-4 h-4" />
              )}
              <span>
                {donationOpen
                  ? isBn
                    ? 'অনুদান চালু (DONATION ON)'
                    : 'DONATION: ON'
                  : isBn
                  ? 'অনুদান বন্ধ (DONATION OFF)'
                  : 'DONATION: OFF'}
              </span>
            </button>
          </div>

          <div className="mt-3.5 pt-3 border-t border-slate-200/70 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-500">{isBn ? 'অনুদান অবস্থা:' : 'Donation State:'}</span>
              {effectiveDonationActive ? (
                <span className="font-bold text-rose-700 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                  {isBn ? 'অনুদান গ্রহণ চালু রয়েছে' : 'Donations actively accepted'}
                </span>
              ) : (
                <span className="font-bold text-slate-600 flex items-center gap-1">
                  <Lock className="w-3 h-3 text-slate-500" />
                  {isBn ? 'অনুদান ফর্ম বন্ধ — বন্ধের নোটিশ প্রদর্শিত হচ্ছে' : 'Closed (Closure notice displayed)'}
                </span>
              )}
            </div>
            <span className="text-[10px] text-slate-400 italic hidden sm:inline">
              {isBn ? 'রেজিস্ট্রেশনের ওপর নির্ভরশীল নয়' : 'Independent of registration'}
            </span>
          </div>
        </div>

        {/* ── SECTION 4A: GLOBAL CLOSURE NOTICE ── */}
        <form onSubmit={handleSaveGlobalNotice} className="p-4 sm:p-5 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                {isBn ? '৪. গ্লোবাল রেজিস্ট্রেশন বন্ধের নোটিশ (Global Notice)' : '4. Global Registration Closure Notice'}
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {isBn
                  ? 'গ্লোবাল রেজিস্ট্রেশন সুইচ বন্ধ থাকলে হোমপেজ ও রেজিস্ট্রেশন রুটে প্রদর্শিত হবে।'
                  : 'Shown on homepage and direct registration URLs whenever Global Registration is OFF.'}
              </p>
            </div>
            <button
              type="submit"
              disabled={loadStatus !== 'ready' || savingGlobalNotice}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 self-start sm:self-auto"
            >
              {savingGlobalNotice ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5 text-amber-400" />}
              <span>{isBn ? 'গ্লোবাল নোটিশ সেভ করুন' : 'Save Global Notice'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                {isBn ? 'বাংলা বার্তা (Global Closed Notice - BN)' : 'Global Notice (Bengali)'}
              </label>
              <textarea
                rows={2}
                value={closedNoticeBn}
                onChange={(e) => setClosedNoticeBn(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-800 focus:outline-hidden focus:border-indigo-500"
                placeholder="বাংলা নোটিশ লিখুন..."
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                {isBn ? 'ইংরেজি বার্তা (Global Closed Notice - EN)' : 'Global Notice (English)'}
              </label>
              <textarea
                rows={2}
                value={closedNoticeEn}
                onChange={(e) => setClosedNoticeEn(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-800 focus:outline-hidden focus:border-indigo-500"
                placeholder="Enter English global advisory..."
              />
            </div>
          </div>
        </form>

        {/* ── SECTION 4B: PER-TARGET CLOSURE NOTICE EDITORS (ALUMNI, CURRENT STUDENT, DONATION) ── */}
        <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 bg-white space-y-5 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                {isBn
                  ? '৫. ক্যাটাগরি ও অনুদানভিত্তিক কাস্টম নোটিশ সম্পাদক'
                  : '5. Category & Donation Closure Notice Editors'}
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {isBn
                  ? 'প্রতিটি অপশনের জন্য পৃথক শিরোনাম, কারণ, সম্ভাব্য পুনরায় চালুর সময় (তথ্যমূলক), যোগাযোগ এবং নির্দেশনা নির্ধারণ করুন। খালি ঐচ্ছিক ঘর পাবলিক পেজে দেখানো হবে না।'
                  : 'Configure separate bilingual notices for Alumni, Current Student, and Donation. Blank optional fields are omitted from the public page.'}
              </p>
            </div>
          </div>

          {/* Editor Target Selector Tabs */}
          <div className="flex flex-wrap gap-2">
            {(
              [
                {
                  id: 'alumni' as const,
                  labelEn: 'Alumni Closure Notice',
                  labelBn: 'অ্যালামনাই নোটিশ',
                  icon: GraduationCap,
                },
                {
                  id: 'currentStudent' as const,
                  labelEn: 'Current Student Closure Notice',
                  labelBn: 'বর্তমান শিক্ষার্থী নোটিশ',
                  icon: BookOpen,
                },
                {
                  id: 'donation' as const,
                  labelEn: 'Donation Closure Notice',
                  labelBn: 'অনুদান নোটিশ',
                  icon: HeartHandshake,
                },
              ]
            ).map((tab) => {
              const Icon = tab.icon;
              const isSelected = activeNoticeEditor === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  data-testid={`notice-tab-${tab.id}`}
                  onClick={() => setActiveNoticeEditor(tab.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{isBn ? tab.labelBn : tab.labelEn}</span>
                </button>
              );
            })}
          </div>

          {/* Active Notice Editor Form */}
          <div className="space-y-4 p-4 rounded-2xl bg-slate-50/70 border border-slate-200">
            {/* Titles */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  {isBn ? 'নোটিশের শিরোনাম (English) *' : 'Notice Title (English) *'}
                </label>
                <input
                  type="text"
                  data-testid={`notice-title-en-${activeNoticeEditor}`}
                  value={currentEditorNotice.titleEn}
                  onChange={(e) =>
                    setCurrentEditorNotice((prev) => ({ ...prev, titleEn: e.target.value }))
                  }
                  placeholder="e.g. Alumni Registration Is Temporarily Closed"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  {isBn ? 'নোটিশের শিরোনাম (বাংলা)' : 'Notice Title (Bengali)'}
                </label>
                <input
                  type="text"
                  data-testid={`notice-title-bn-${activeNoticeEditor}`}
                  value={currentEditorNotice.titleBn}
                  onChange={(e) =>
                    setCurrentEditorNotice((prev) => ({ ...prev, titleBn: e.target.value }))
                  }
                  placeholder="যেমন: প্রাক্তন শিক্ষার্থী নিবন্ধন সাময়িকভাবে বন্ধ"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Customizable Reason / Message */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  {isBn ? 'বন্ধের কারণ / মূল বার্তা (English) *' : 'Closure Message / Reason (English) *'}
                </label>
                <textarea
                  rows={3}
                  data-testid={`notice-message-en-${activeNoticeEditor}`}
                  value={currentEditorNotice.messageEn}
                  onChange={(e) =>
                    setCurrentEditorNotice((prev) => ({ ...prev, messageEn: e.target.value }))
                  }
                  placeholder="Explain why registration or donation is closed..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  {isBn ? 'বন্ধের কারণ / মূল বার্তা (বাংলা)' : 'Closure Message / Reason (Bengali)'}
                </label>
                <textarea
                  rows={3}
                  data-testid={`notice-message-bn-${activeNoticeEditor}`}
                  value={currentEditorNotice.messageBn}
                  onChange={(e) =>
                    setCurrentEditorNotice((prev) => ({ ...prev, messageBn: e.target.value }))
                  }
                  placeholder="বাংলায় বিস্তারিত বার্তা লিখুন..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Optional Reopening Date/Time & Contact */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                    <CalendarClock className="w-3.5 h-3.5 text-[#0284C7]" />
                    <span>
                      {isBn
                        ? 'সম্ভাব্য পুনরায় চালুর তারিখ ও সময় (ঐচ্ছিক, তথ্যমূলক)'
                        : 'Expected Reopening Date & Time (Optional, informational)'}
                    </span>
                  </label>
                  {currentEditorNotice.reopenAt && (
                    <button
                      type="button"
                      onClick={() => setCurrentEditorNotice((prev) => ({ ...prev, reopenAt: '' }))}
                      className="text-[10px] font-bold text-rose-600 hover:underline cursor-pointer"
                    >
                      {isBn ? 'মুছুন' : 'Clear'}
                    </button>
                  )}
                </div>
                <input
                  type="datetime-local"
                  data-testid={`notice-reopen-${activeNoticeEditor}`}
                  value={currentEditorNotice.reopenAt || ''}
                  onChange={(e) =>
                    setCurrentEditorNotice((prev) => ({ ...prev, reopenAt: e.target.value }))
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:border-indigo-500"
                />
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  {isBn
                    ? 'এটি শুধুমাত্র তথ্যমূলক — সুপার অ্যাডমিন সুইচ চালু করলেই সেবা পুনরায় চালু হবে।'
                    : 'Informational only — service reopens only when the Super Admin switch is turned ON.'}
                </span>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <PhoneCall className="w-3.5 h-3.5 text-emerald-600" />
                  <span>
                    {isBn
                      ? 'যোগাযোগের ফোন নম্বর বা ইমেইল (ঐচ্ছিক)'
                      : 'Contact Phone Number or Email (Optional)'}
                  </span>
                </label>
                <input
                  type="text"
                  data-testid={`notice-contact-${activeNoticeEditor}`}
                  value={currentEditorNotice.contactInfo || ''}
                  onChange={(e) =>
                    setCurrentEditorNotice((prev) => ({ ...prev, contactInfo: e.target.value }))
                  }
                  placeholder="+880 1637-85 7040 / sagarsaha3371@gmail.com"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Optional Additional Instructions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Info className="w-3.5 h-3.5 text-[#0284C7]" />
                  <span>
                    {isBn ? 'অতিরিক্ত নির্দেশনা (English - ঐচ্ছিক)' : 'Additional Instructions (English - Optional)'}
                  </span>
                </label>
                <textarea
                  rows={2}
                  data-testid={`notice-instructions-en-${activeNoticeEditor}`}
                  value={currentEditorNotice.instructionsEn || ''}
                  onChange={(e) =>
                    setCurrentEditorNotice((prev) => ({ ...prev, instructionsEn: e.target.value }))
                  }
                  placeholder="Optional instructions for visitors..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Info className="w-3.5 h-3.5 text-[#0284C7]" />
                  <span>
                    {isBn ? 'অতিরিক্ত নির্দেশনা (বাংলা - ঐচ্ছিক)' : 'Additional Instructions (Bengali - Optional)'}
                  </span>
                </label>
                <textarea
                  rows={2}
                  data-testid={`notice-instructions-bn-${activeNoticeEditor}`}
                  value={currentEditorNotice.instructionsBn || ''}
                  onChange={(e) =>
                    setCurrentEditorNotice((prev) => ({ ...prev, instructionsBn: e.target.value }))
                  }
                  placeholder="দর্শনার্থীদের জন্য অতিরিক্ত নির্দেশনা (ঐচ্ছিক)..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span className="text-[11px] text-slate-500 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  {isBn
                    ? 'শুধুমাত্র এই নির্বাচিত নোটিশটি পারমাণবিকভাবে সুপাবেজে সংরক্ষিত হবে।'
                    : 'Saves only this notice atomically in Supabase without overwriting switches or fee rules.'}
                </span>
              </span>

              <button
                type="button"
                data-testid={`save-notice-${activeNoticeEditor}`}
                disabled={loadStatus !== 'ready' || savingTargetNotice !== null}
                onClick={() => handleSaveTargetNotice(activeNoticeEditor)}
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
              >
                {savingTargetNotice === activeNoticeEditor ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                ) : (
                  <Save className="w-4 h-4 text-amber-400" />
                )}
                <span>
                  {activeNoticeEditor === 'alumni'
                    ? isBn
                      ? 'অ্যালামনাই নোটিশ সংরক্ষণ করুন'
                      : 'Save Alumni Notice'
                    : activeNoticeEditor === 'currentStudent'
                    ? isBn
                      ? 'বর্তমান শিক্ষার্থী নোটিশ সংরক্ষণ করুন'
                      : 'Save Current Student Notice'
                    : isBn
                    ? 'অনুদান নোটিশ সংরক্ষণ করুন'
                    : 'Save Donation Notice'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
