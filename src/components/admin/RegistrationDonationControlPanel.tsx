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
  Save,
  Check,
  Shield,
  Sliders,
} from 'lucide-react';
import { FeeSettings, Language } from '../../types';
import { AppStore } from '../../services/store';
import { EventStore } from '../../services/eventStore';
import {
  isGlobalRegistrationOpen,
  isDonationOpen,
} from '../../utils/rules';

interface RegistrationDonationControlPanelProps {
  language?: Language;
  adminName?: string;
  onSettingsChanged?: (updated: FeeSettings) => void;
}

export const RegistrationDonationControlPanel: React.FC<RegistrationDonationControlPanelProps> = ({
  language = 'en',
  adminName = 'Super Admin',
  onSettingsChanged,
}) => {
  const [settings, setSettings] = useState<FeeSettings>(() => AppStore.getFeeSettings());

  // Input states
  const [globalOpen, setGlobalOpen] = useState(() => isGlobalRegistrationOpen(settings));
  const [alumniOpen, setAlumniOpen] = useState(() => settings.alumniRegistrationOpen !== false);
  const [currentOpen, setCurrentOpen] = useState(() => settings.currentStudentRegistrationOpen !== false);
  const [donationOpen, setDonationOpen] = useState(() => isDonationOpen(settings));

  // Custom advisory messages
  const [closedNoticeEn, setClosedNoticeEn] = useState(
    () =>
      settings.closedMessageEn ||
      'Online registration is currently closed. If you need special authorization, please contact the Reunion Secretariat.'
  );
  const [closedNoticeBn, setClosedNoticeBn] = useState(
    () =>
      settings.closedMessageBn ||
      'অনলাইন রেজিস্ট্রেশন কার্যক্রম বর্তমানে বন্ধ রয়েছে। জরুরি প্রয়োজনে অনুগ্রহ করে পুনর্মিলনী সচিবালয়ে যোগাযোগ করুন।'
  );
  const [donationNoticeEn, setDonationNoticeEn] = useState(
    () =>
      settings.donationClosedMessageEn ||
      'Online donations are currently paused by the Reunion Secretariat. Thank you for your continued support.'
  );
  const [donationNoticeBn, setDonationNoticeBn] = useState(
    () =>
      settings.donationClosedMessageBn ||
      'অনলাইন অনুদান কার্যক্রম বর্তমানে সাময়িকভাবে বন্ধ রয়েছে। পুনর্মিলনী তহবিলে সহযোগিতার জন্য আন্তরিক ধন্যবাদ।'
  );

  const [isSaving, setIsSaving] = useState(false);
  const [successNotice, setSuccessNotice] = useState(false);

  // Synchronize on external changes
  useEffect(() => {
    const handleSync = (e: any) => {
      if (e.detail) {
        const s: FeeSettings = e.detail;
        setSettings(s);
        setGlobalOpen(isGlobalRegistrationOpen(s));
        setAlumniOpen(s.alumniRegistrationOpen !== false);
        setCurrentOpen(s.currentStudentRegistrationOpen !== false);
        setDonationOpen(isDonationOpen(s));
      }
    };
    window.addEventListener('plscf_fee_settings_updated', handleSync);
    return () => window.removeEventListener('plscf_fee_settings_updated', handleSync);
  }, []);

  const handleSave = async (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);

    const updated: FeeSettings = {
      ...settings,
      registrationOpen: Boolean(globalOpen),
      alumniRegistrationOpen: Boolean(alumniOpen),
      currentStudentRegistrationOpen: Boolean(currentOpen),
      donationOpen: Boolean(donationOpen),
      closedMessageEn: closedNoticeEn.trim(),
      closedMessageBn: closedNoticeBn.trim(),
      donationClosedMessageEn: donationNoticeEn.trim(),
      donationClosedMessageBn: donationNoticeBn.trim(),
    };

    AppStore.saveFeeSettings(updated);
    setSettings(updated);
    onSettingsChanged?.(updated);

    // Audit Trail
    try {
      EventStore.recordAuditHistory({
        adminId: 'SUPER_ADMIN_MASTER',
        adminName,
        entityType: 'REGISTRATION',
        entityId: 'REGISTRATION_DONATION_GOVERNANCE',
        action: 'UPDATE_SETTINGS',
        reason: `Global=${globalOpen ? 'OPEN' : 'CLOSED'}, Alumni=${alumniOpen ? 'ON' : 'OFF'}, Student=${currentOpen ? 'ON' : 'OFF'}, Donation=${donationOpen ? 'ON' : 'OFF'}`,
        newValue: JSON.stringify({
          globalRegistration: globalOpen ? 'OPEN' : 'CLOSED',
          alumniRegistration: alumniOpen ? 'ENABLED' : 'DISABLED',
          currentStudentRegistration: currentOpen ? 'ENABLED' : 'DISABLED',
          donation: donationOpen ? 'ENABLED' : 'DISABLED',
          updatedBy: adminName,
        }),
      });
    } catch (_) {}

    setIsSaving(false);
    setSuccessNotice(true);
    setTimeout(() => setSuccessNotice(false), 3500);
  };

  const isBn = language === 'bn';

  // Derived Effective Statuses
  const effectiveAlumniActive = globalOpen && alumniOpen;
  const effectiveCurrentActive = globalOpen && currentOpen;
  const effectiveDonationActive = donationOpen;

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden transition-all">
      {/* ── TOP HEADER ── */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 px-6 py-5 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400 shrink-0 shadow-inner">
            <Sliders className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
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
                ? 'গ্লোবাল ও ক্যাটাগরিভিত্তিক রেজিস্ট্রেশন এবং স্বতন্ত্র অনুদান কার্যক্রমের রিয়েলটাইম নিয়ন্ত্রণ।'
                : 'Centralized switches for Global Registration, Alumni, Current Students, and Independent Donations.'}
            </p>
          </div>
        </div>

        {/* Quick Live Mode Indicator */}
        <div className="flex items-center gap-2 self-start sm:self-auto bg-slate-950/60 border border-slate-700/60 px-3.5 py-1.5 rounded-xl">
          <span className="text-[11px] font-medium text-slate-300">
            {isBn ? 'লাইভ অবস্থা:' : 'Live Policy:'}
          </span>
          {!globalOpen ? (
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

      {/* ── SUCCESS BANNER ── */}
      {successNotice && (
        <div className="mx-6 mt-5 p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2.5 text-xs text-emerald-900 animate-in fade-in slide-in-from-top-1">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-semibold">
            {isBn
              ? 'নিয়ন্ত্রণ সেটিংস সফলভাবে সংরক্ষিত হয়েছে এবং ওয়েবসাইটে তাৎক্ষণিকভাবে কার্যকর হয়েছে!'
              : 'Governance settings saved successfully and live-enforced across all website portals!'}
          </span>
        </div>
      )}

      <form onSubmit={handleSave} className="p-6 space-y-6">
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
                  ? 'গ্লোবাল সুইচটি বন্ধ করলে ওয়েবসাইটের সকল নিবন্ধন ক্যাটাগরি ও ফর্ম তাৎক্ষণিক বন্ধ হয়ে যাবে। এটি চালু থাকলে নিচে নির্ধারিত ক্যাটাগরিগুলো কার্যকর হবে।'
                  : 'Master control. When OFF, all registration categories and application processes are strictly disabled site-wide. When ON, only individually enabled categories below are available.'}
              </p>
            </div>

            {/* Global Switch Button */}
            <button
              type="button"
              onClick={() => setGlobalOpen(!globalOpen)}
              className={`px-5 py-3 rounded-2xl font-black text-xs sm:text-sm tracking-wide transition-all cursor-pointer flex items-center gap-2.5 shrink-0 shadow-md transform hover:scale-[1.02] active:scale-95 ${
                globalOpen
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                  : 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20'
              }`}
            >
              {globalOpen ? (
                <>
                  <Unlock className="w-4 h-4" />
                  <span>{isBn ? 'গ্লোবাল চালু (GLOBAL ON)' : 'GLOBAL REGISTRATION: ON'}</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>{isBn ? 'গ্লোবাল বন্ধ (GLOBAL OFF)' : 'GLOBAL REGISTRATION: OFF'}</span>
                </>
              )}
            </button>
          </div>

          {/* Master Status Feedback */}
          <div className="mt-3.5 pt-3 border-t border-slate-200/70 flex items-center gap-2 text-xs">
            <span className="font-semibold text-slate-500">
              {isBn ? 'বর্তমান গ্লোবাল অবস্থা:' : 'Master State:'}
            </span>
            {globalOpen ? (
              <span className="font-bold text-emerald-700 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                {isBn
                  ? 'অনলাইন রেজিস্ট্রেশন সক্রিয় — ক্যাটাগরিভিত্তিক অনুমতি প্রযোজ্য'
                  : 'Active — Sub-category permissions are in effect'}
              </span>
            ) : (
              <span className="font-bold text-rose-700 flex items-center gap-1">
                <XCircle className="w-3.5 h-3.5" />
                {isBn
                  ? 'অনলাইন রেজিস্ট্রেশন সম্পূর্ণ নিষ্ক্রিয় — সকল ক্যাটাগরি সাইটব্যাপী বন্ধ'
                  : 'All registration processes completely disabled site-wide'}
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
                ({isBn ? 'গ্লোবাল চালু থাকাকালীন প্রযোজ্য' : 'Active when Global Registration is ON'})
              </span>
            </h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Card A: Alumni Registration */}
            <div
              className={`p-4 rounded-2xl border transition-all ${
                !globalOpen
                  ? 'bg-slate-50 border-slate-200 opacity-60'
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
                        {isBn ? 'ফি: ৳ ১,৫০০' : 'Fee: ৳ 1,500'} • 1962 – 2025
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1">
                    {isBn
                      ? 'প্রাক্তন শিক্ষার্থীদের অনলাইন নিবন্ধন কার্ড ও আবেদন ফর্ম চালু বা বন্ধ রাখুন।'
                      : 'Controls Alumni registration card, entry buttons, and application form.'}
                  </p>
                </div>

                {/* Alumni Toggle Button */}
                <button
                  type="button"
                  disabled={!globalOpen}
                  onClick={() => setAlumniOpen(!alumniOpen)}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 shrink-0 shadow-2xs ${
                    !globalOpen
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : alumniOpen
                      ? 'bg-sky-600 hover:bg-sky-700 text-white'
                      : 'bg-slate-300 hover:bg-slate-400 text-slate-700'
                  }`}
                >
                  {alumniOpen && globalOpen ? (
                    <>
                      <Unlock className="w-3.5 h-3.5" />
                      <span>{isBn ? 'চালু (ON)' : 'ALUMNI: ON'}</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-3.5 h-3.5" />
                      <span>{isBn ? 'বন্ধ (OFF)' : 'ALUMNI: OFF'}</span>
                    </>
                  )}
                </button>
              </div>

              {/* Live Badge Status */}
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
                        ? 'গ্লোবাল সুইচে বন্ধ'
                        : 'Blocked by Global Switch'
                      : isBn
                      ? 'অ্যালামনাই নিবন্ধন বন্ধ'
                      : 'Disabled for Alumni'}
                  </span>
                )}
              </div>
            </div>

            {/* Card B: Current Student Registration */}
            <div
              className={`p-4 rounded-2xl border transition-all ${
                !globalOpen
                  ? 'bg-slate-50 border-slate-200 opacity-60'
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
                        {isBn ? 'ফি: ৳ ৫০০' : 'Fee: ৳ 500'} • Class 1 – 12
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1">
                    {isBn
                      ? 'বর্তমান শিক্ষার্থীদের অনলাইন নিবন্ধন কার্ড ও ভেরিফায়েড আবেদন ফর্ম চালু বা বন্ধ রাখুন।'
                      : 'Controls Current Student registration card, entry buttons, and verified form.'}
                  </p>
                </div>

                {/* Current Student Toggle Button */}
                <button
                  type="button"
                  disabled={!globalOpen}
                  onClick={() => setCurrentOpen(!currentOpen)}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 shrink-0 shadow-2xs ${
                    !globalOpen
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : currentOpen
                      ? 'bg-teal-600 hover:bg-teal-700 text-white'
                      : 'bg-slate-300 hover:bg-slate-400 text-slate-700'
                  }`}
                >
                  {currentOpen && globalOpen ? (
                    <>
                      <Unlock className="w-3.5 h-3.5" />
                      <span>{isBn ? 'চালু (ON)' : 'CURRENT: ON'}</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-3.5 h-3.5" />
                      <span>{isBn ? 'বন্ধ (OFF)' : 'CURRENT: OFF'}</span>
                    </>
                  )}
                </button>
              </div>

              {/* Live Badge Status */}
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
                        ? 'গ্লোবাল সুইচে বন্ধ'
                        : 'Blocked by Global Switch'
                      : isBn
                      ? 'বর্তমান ছাত্র নিবন্ধন বন্ধ'
                      : 'Disabled for Students'}
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
                  ? 'এই সুইচটি রেজিস্ট্রেশন থেকে সম্পূর্ণ স্বতন্ত্র। অনুদান বন্ধ করলে ওয়েবসাইটের ডোনেশন পৃষ্ঠা, লিঙ্ক, বাটন এবং পেমেন্ট গেটওয়েতে অনুদান সংক্রান্ত কার্যক্রম সাময়িক স্থগিত থাকবে।'
                  : 'Independent of registration. When OFF, all donation-related functionality, forms, links, buttons, and gateway payment processing are disabled across the website.'}
              </p>
            </div>

            {/* Donation Switch Button */}
            <button
              type="button"
              onClick={() => setDonationOpen(!donationOpen)}
              className={`px-5 py-3 rounded-2xl font-black text-xs sm:text-sm tracking-wide transition-all cursor-pointer flex items-center gap-2.5 shrink-0 shadow-md transform hover:scale-[1.02] active:scale-95 ${
                donationOpen
                  ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20'
                  : 'bg-slate-400 hover:bg-slate-500 text-white shadow-slate-400/20'
              }`}
            >
              {donationOpen ? (
                <>
                  <Unlock className="w-4 h-4" />
                  <span>{isBn ? 'অনুদান চালু (DONATION ON)' : 'DONATION: ON'}</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>{isBn ? 'অনুদান বন্ধ (DONATION OFF)' : 'DONATION: OFF'}</span>
                </>
              )}
            </button>
          </div>

          {/* Donation Status Feedback */}
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
                  {isBn ? 'অনুদান পোর্টাল সাময়িক স্থগিত' : 'Donation functionality disabled site-wide'}
                </span>
              )}
            </div>
            <span className="text-[10px] text-slate-400 italic hidden sm:inline">
              {isBn ? 'রেজিস্ট্রেশনের ওপর নির্ভরশীল নয়' : 'Independent of registration'}
            </span>
          </div>
        </div>

        {/* ── SECTION 4: CLOSED ADVISORY NOTICES ── */}
        <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-4">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              {isBn ? '৪. বন্ধকালীন নোটিশ বার্তা (Advisory Notices)' : '4. Closed Advisory Notices'}
            </h4>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {isBn
                ? 'রেজিস্ট্রেশন বা অনুদান বন্ধ থাকা অবস্থায় ব্যবহারকারীদের প্রদর্শিত বার্তা কনফিগার করুন।'
                : 'Configure public notices displayed when registration or donations are closed.'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Registration Closed Notice */}
            <div className="space-y-2">
              <label className="block text-[11px] font-bold text-slate-700">
                {isBn ? 'রেজিস্ট্রেশন বন্ধ নোটিশ (বাংলা)' : 'Registration Closed Notice (Bengali)'}
              </label>
              <textarea
                rows={2}
                value={closedNoticeBn}
                onChange={(e) => setClosedNoticeBn(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-800 focus:outline-hidden focus:border-indigo-500"
                placeholder="বাংলা নোটিশ লিখুন..."
              />

              <label className="block text-[11px] font-bold text-slate-700 mt-2">
                {isBn ? 'রেজিস্ট্রেশন বন্ধ নোটিশ (English)' : 'Registration Closed Notice (English)'}
              </label>
              <textarea
                rows={2}
                value={closedNoticeEn}
                onChange={(e) => setClosedNoticeEn(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-800 focus:outline-hidden focus:border-indigo-500"
                placeholder="Enter English advisory..."
              />
            </div>

            {/* Donation Paused Notice */}
            <div className="space-y-2">
              <label className="block text-[11px] font-bold text-slate-700">
                {isBn ? 'অনুদান বন্ধ নোটিশ (বাংলা)' : 'Donation Closed Notice (Bengali)'}
              </label>
              <textarea
                rows={2}
                value={donationNoticeBn}
                onChange={(e) => setDonationNoticeBn(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-800 focus:outline-hidden focus:border-indigo-500"
                placeholder="অনুদান বন্ধ বার্তা লিখুন..."
              />

              <label className="block text-[11px] font-bold text-slate-700 mt-2">
                {isBn ? 'অনুদান বন্ধ নোটিশ (English)' : 'Donation Closed Notice (English)'}
              </label>
              <textarea
                rows={2}
                value={donationNoticeEn}
                onChange={(e) => setDonationNoticeEn(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-800 focus:outline-hidden focus:border-indigo-500"
                placeholder="Enter English donation notice..."
              />
            </div>
          </div>
        </div>

        {/* ── ACTION FOOTER ── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-3 border-t border-slate-200">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-slate-400" />
            <span>
              {isBn
                ? 'সকল পরিবর্তন তাৎক্ষণিক লোকাল ক্যাশ ও কেন্দ্রীয় ডেটাবেসে সিঙ্ক হবে।'
                : 'All changes take immediate effect site-wide and persist to database.'}
            </span>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4 text-amber-400" />
            <span>
              {isSaving
                ? isBn
                  ? 'সংরক্ষণ হচ্ছে...'
                  : 'Saving...'
                : isBn
                ? 'নিয়ন্ত্রণ সেটিংস সংরক্ষণ করুন'
                : 'Save Governance Controls'}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
};
