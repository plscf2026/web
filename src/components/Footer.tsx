import React, { useState, useRef, useEffect } from 'react';
import {
  MapPin,
  Phone,
  Mail,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Heart,
  QrCode,
  ArrowUpRight,
  Lock,
  Key,
  Building,
  Users,
  Landmark,
  Utensils,
  Shirt,
  CreditCard,
  ChevronDown,
  Sparkles,
  Layers,
  CheckCircle2,
} from 'lucide-react';
import { Language } from '../types';
import { translations } from '../i18n/translations';

interface FooterProps {
  language: Language;
  onNavigate: (view: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ language, onNavigate }) => {
  const t = translations[language];

  // State for the interactive Staff popover / dropdown
  const [isStaffOpen, setIsStaffOpen] = useState(false);
  const staffMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (staffMenuRef.current && !staffMenuRef.current.contains(event.target as Node)) {
        setIsStaffOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsStaffOpen(false);
      }
    };

    if (isStaffOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isStaffOpen]);

  // Executive Role Navigation Handler (Roles 1-4)
  const handleSelectExecutiveRole = (
    role: 'super_admin' | 'admin' | 'reg_mgr' | 'finance_mgr'
  ) => {
    setIsStaffOpen(false);
    if (role === 'super_admin') {
      sessionStorage.setItem('plscf_admin_active_tab', 'masterOverview');
      sessionStorage.setItem('plscf_admin_prefill_user', 'admin@gmail.com');
      sessionStorage.setItem('plscf_admin_auto_login', 'true');
    } else if (role === 'admin') {
      sessionStorage.setItem('plscf_admin_active_tab', 'allBookings');
      sessionStorage.setItem('plscf_admin_prefill_user', 'admin@gmail.com');
      sessionStorage.setItem('plscf_admin_auto_login', 'true');
    } else if (role === 'reg_mgr') {
      sessionStorage.setItem('plscf_admin_active_tab', 'studentIds');
      sessionStorage.setItem('plscf_admin_prefill_user', 'registration@gmail.com');
      sessionStorage.setItem('plscf_admin_auto_login', 'true');
    } else if (role === 'finance_mgr') {
      sessionStorage.setItem('plscf_admin_active_tab', 'budgetManagement');
      sessionStorage.setItem('plscf_admin_prefill_user', 'finance@gmail.com');
      sessionStorage.setItem('plscf_admin_auto_login', 'true');
    }
    onNavigate('admin');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Staff Station Navigation Handler (Role 5 stations)
  const handleSelectStaffStation = (
    station: 'gate' | 'meal' | 'dress' | 'card' | 'committee'
  ) => {
    setIsStaffOpen(false);
    if (station === 'gate') {
      sessionStorage.setItem('plscf_scanner_module', 'gate_scanner');
      sessionStorage.setItem('plscf_scanner_prefill_user', 'gate@gmail.com');
      sessionStorage.setItem('plscf_scanner_auto_login', 'true');
      onNavigate('scanner');
    } else if (station === 'meal') {
      sessionStorage.setItem('plscf_scanner_module', 'food_lunch');
      sessionStorage.setItem('plscf_scanner_prefill_user', 'food@gmail.com');
      sessionStorage.setItem('plscf_scanner_auto_login', 'true');
      onNavigate('scanner');
    } else if (station === 'dress') {
      sessionStorage.setItem('plscf_scanner_module', 'dress_distribution');
      sessionStorage.setItem('plscf_scanner_prefill_user', 'dress@gmail.com');
      sessionStorage.setItem('plscf_scanner_auto_login', 'true');
      onNavigate('scanner');
    } else if (station === 'card') {
      sessionStorage.setItem('plscf_admin_active_tab', 'idCardManagement');
      sessionStorage.setItem('plscf_admin_prefill_user', 'idcard.staff@gmail.com');
      sessionStorage.setItem('plscf_admin_auto_login', 'true');
      onNavigate('admin');
    } else if (station === 'committee') {
      onNavigate('portal');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="bg-[#0B132B] text-slate-300 border-t border-[#1E293B] pt-14 pb-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 4-Column Navigation & Contact Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
          {/* Col 1: Institution Details */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full overflow-hidden bg-white p-0.5 shadow-md shrink-0 border-2 border-[#0284C7] flex items-center justify-center">
                <img
                  src="/assets/school_logo.png"
                  alt="Police Lines School & College Emblem"
                  className="w-full h-full object-contain rounded-full"
                />
              </div>
              <div>
                <h3 className="font-bold text-white text-base leading-tight">
                  {t.institutionName}
                </h3>
                <span className="text-xs text-[#38BDF8] font-semibold">
                  {language === 'bn' ? 'স্থাপিত: ১৯৬২' : 'Established: 1962'}
                </span>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-slate-400">
              {language === 'bn'
                ? 'ফরিদপুরের ঐতিহ্যবাহী পুলিশ লাইন্স স্কুল অ্যান্ড কলেজের ৬৪ বছর পূর্তি উপলক্ষে আয়োজিত গ্র্যান্ড পুনর্মিলনী ২০২৭। প্রাক্তন ও বর্তমান শিক্ষার্থীদের এক মিলনমেলা।'
                : 'Police Lines School and College, Faridpur celebrates 65 glorious years of academic excellence and character building with Grand Reunion 2027.'}
            </p>

            <div className="pt-2 text-xs flex items-center gap-2 text-[#38BDF8]">
              <Shield className="w-4 h-4 text-[#0EA5E9]" />
              <span>
                {language === 'bn'
                  ? 'সার্বিক পৃষ্ঠপোষকতায়: জেলা পুলিশ প্রশাসন, ফরিদপুর'
                  : 'Patronage: District Police Administration, Faridpur'}
              </span>
            </div>
          </div>

          {/* Col 2: Quick Links */}
          <div>
            <h4 className="text-white font-semibold text-sm uppercase tracking-wider mb-4 border-l-2 border-[#0284C7] pl-2">
              {language === 'bn' ? 'প্রয়োজনীয় লিংক' : 'Quick Links'}
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  onClick={() => onNavigate('register')}
                  className="hover:text-[#38BDF8] transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <ArrowUpRight className="w-3 h-3 text-[#0EA5E9]" />
                  <span>{t.navRegister}</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('find-ticket')}
                  className="hover:text-[#38BDF8] transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <ArrowUpRight className="w-3 h-3 text-[#0EA5E9]" />
                  <span>{t.navFindTicket}</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('donate')}
                  className="hover:text-[#38BDF8] transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <ArrowUpRight className="w-3 h-3 text-[#0EA5E9]" />
                  <span>{t.navDonate}</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('notices')}
                  className="hover:text-[#38BDF8] transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <ArrowUpRight className="w-3 h-3 text-[#0EA5E9]" />
                  <span>{t.navNotices}</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('gallery')}
                  className="hover:text-[#38BDF8] transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <ArrowUpRight className="w-3 h-3 text-[#0EA5E9]" />
                  <span>{t.navGallery}</span>
                </button>
              </li>
            </ul>
          </div>

          {/* Col 3: Event Operations */}
          <div>
            <h4 className="text-white font-semibold text-sm uppercase tracking-wider mb-4 border-l-2 border-[#0EA5E9] pl-2">
              {language === 'bn' ? 'অপারেশনাল পোর্টাল' : 'Event Operations'}
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  onClick={() => onNavigate('portal')}
                  className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#0F172A] hover:bg-[#1E293B] border border-[#0284C7]/60 text-white w-full transition-all cursor-pointer group shadow-xs"
                  title="Central Organizing Committee RMS Portal"
                >
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4 text-[#38BDF8] group-hover:scale-110 transition-transform" />
                    <span className="font-bold">
                      {language === 'bn' ? 'আরএমএস ইআরপি পোর্টাল' : 'RMS Management ERP'}
                    </span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#0284C7] text-white font-mono font-bold">
                    2027
                  </span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('scanner')}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#0F172A] hover:bg-[#1E293B] border border-[#1E293B] text-[#38BDF8] w-full transition-colors cursor-pointer"
                >
                  <QrCode className="w-4 h-4 text-[#0EA5E9]" />
                  <span>{t.navScannerPortal}</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('admin')}
                  className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#0F172A] hover:bg-[#1E293B] border border-[#0284C7]/40 text-[#E2EEF8] w-full transition-all cursor-pointer group shadow-xs"
                  title="Exclusive Administrator Access (Single Slot / Supabase Command)"
                >
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-[#38BDF8]" />
                    <span className="font-bold">
                      {language === 'bn' ? 'অ্যাডমিন সাইন-আপ / লগইন' : 'Admin Sign-up / Login'}
                    </span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#0284C7] text-white font-mono font-bold">
                    Single Slot
                  </span>
                </button>
              </li>
            </ul>

            <div className="mt-4 p-3 rounded-xl bg-[#0F172A]/80 border border-[#1E293B] text-[11px] text-slate-400">
              <span className="font-semibold text-white block mb-1">
                {language === 'bn' ? 'নিরাপত্তা বার্তা' : 'Security Notice'}
              </span>
              {language === 'bn'
                ? 'অনুষ্ঠান প্রাঙ্গণে প্রবেশের জন্য কিউআর কোডযুক্ত পরিচয়পত্র ও ডিজিটাল টিকিট প্রদর্শন বাধ্যতামূলক।'
                : 'QR code verification is strictly required at all entrance gates for physical access.'}
            </div>
          </div>

          {/* Col 4: Secretariat Contact */}
          <div>
            <h4 className="text-white font-semibold text-sm uppercase tracking-wider mb-4 border-l-2 border-[#38BDF8] pl-2">
              {t.helpdeskTitle}
            </h4>
            <div className="space-y-2.5 text-xs text-slate-300">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-[#0EA5E9] shrink-0 mt-0.5" />
                <span>{t.addressText}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-[#38BDF8] shrink-0" />
                <span>{t.helplinePhone}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#0EA5E9] shrink-0" />
                <span>{t.helplineEmail}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* MASTER ROLE-BASED ACCESS CONTROL (RBAC) SMART CONSOLE   */}
        {/* ======================================================== */}
        <section
          aria-label="Master Role-Based Access Control"
          className="my-8 pt-8 border-t border-slate-800/80"
        >
          <div className="bg-gradient-to-r from-[#0F172A] via-[#111C38] to-[#0F172A] rounded-2xl border border-[#1E293B] p-5 sm:p-6 shadow-2xl relative">
            {/* Header: Title, Subtitle, Dev Credentials Hint */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5 border-b border-slate-800/70 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#0284C7]/20 border border-[#0EA5E9]/40 flex items-center justify-center text-[#38BDF8] shadow-inner">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm sm:text-base font-extrabold text-white tracking-wide flex items-center gap-2">
                      <span>
                        {language === 'bn'
                          ? 'মাস্টার রোল-বেসড এক্সেস কন্ট্রোল (RBAC)'
                          : 'Master Role-Based Access Control (RBAC)'}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold bg-[#0284C7]/20 text-[#38BDF8] px-2 py-0.5 rounded-full border border-[#0284C7]/40">
                        <Sparkles className="w-3 h-3 text-[#38BDF8]" />
                        Console
                      </span>
                    </h4>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {language === 'bn'
                      ? 'অনুমোদিত প্রশাসনিক ও অপারেশনাল রোল এক্সেস • সরাসরি ড্যাশবোর্ড ও স্টেশন সুইচিং'
                      : 'Privileged Administration & Operational Field Stations • One-click role switching'}
                  </p>
                </div>
              </div>

              {/* Dev Test Credentials Tag */}
              <div className="flex items-center gap-2 flex-wrap text-xs text-slate-400">
                <span className="text-[11px] bg-slate-900/90 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono flex items-center gap-1.5 shadow-xs">
                  <Key className="w-3 h-3 text-amber-400" />
                  <span className="text-slate-400">Test PIN:</span>
                  <strong className="text-amber-300 font-bold">admin@123</strong>
                </span>
                <span className="text-[11px] bg-emerald-950/60 text-emerald-300 px-2.5 py-1 rounded-lg border border-emerald-800/50 font-mono flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>Single-Slot Secured</span>
                </span>
              </div>
            </div>

            {/* Smart RBAC Button Grid: 4 Executive Roles + 1 Smart Staff Button */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 relative">
              {/* 1. Super Admin */}
              <button
                type="button"
                onClick={() => handleSelectExecutiveRole('super_admin')}
                className="group flex flex-col justify-between p-3.5 rounded-xl bg-slate-900/90 hover:bg-slate-800/90 border border-purple-500/30 hover:border-purple-400 transition-all text-left cursor-pointer shadow-md hover:shadow-purple-950/40"
                title="Super Admin • Master Overview & Root DB Control"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300 group-hover:scale-105 transition-transform">
                      <ShieldAlert className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-mono font-bold text-purple-300 bg-purple-950/60 px-1.5 py-0.5 rounded border border-purple-800/60">
                      1
                    </span>
                  </div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-purple-300/80 bg-purple-900/30 px-2 py-0.5 rounded-full border border-purple-800/40">
                    Root L1
                  </span>
                </div>
                <div>
                  <h5 className="text-xs font-bold text-white group-hover:text-purple-200 transition-colors">
                    {language === 'bn' ? '১. সুপার অ্যাডমিন' : '1. Super Admin'}
                  </h5>
                  <p className="text-[11px] text-slate-400 leading-tight mt-0.5">
                    {language === 'bn' ? 'মাস্টার ওভারভিউ ও সিস্টেম অডিট' : 'Master Overview & System DB'}
                  </p>
                </div>
              </button>

              {/* 2. Admin */}
              <button
                type="button"
                onClick={() => handleSelectExecutiveRole('admin')}
                className="group flex flex-col justify-between p-3.5 rounded-xl bg-slate-900/90 hover:bg-slate-800/90 border border-sky-500/30 hover:border-sky-400 transition-all text-left cursor-pointer shadow-md hover:shadow-sky-950/40"
                title="Admin • All Bookings, Registry & Fee Settings"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-[#38BDF8] group-hover:scale-105 transition-transform">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-mono font-bold text-[#38BDF8] bg-sky-950/60 px-1.5 py-0.5 rounded border border-sky-800/60">
                      2
                    </span>
                  </div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-sky-300/80 bg-sky-900/30 px-2 py-0.5 rounded-full border border-sky-800/40">
                    Admin L2
                  </span>
                </div>
                <div>
                  <h5 className="text-xs font-bold text-white group-hover:text-sky-200 transition-colors">
                    {language === 'bn' ? '২. অ্যাডমিন' : '2. Admin'}
                  </h5>
                  <p className="text-[11px] text-slate-400 leading-tight mt-0.5">
                    {language === 'bn' ? 'সকল বুকিং, রেজিস্ট্রেশন ও নোটিশ' : 'All Bookings & Supabase DB'}
                  </p>
                </div>
              </button>

              {/* 3. Reg Manager */}
              <button
                type="button"
                onClick={() => handleSelectExecutiveRole('reg_mgr')}
                className="group flex flex-col justify-between p-3.5 rounded-xl bg-slate-900/90 hover:bg-slate-800/90 border border-emerald-500/30 hover:border-emerald-400 transition-all text-left cursor-pointer shadow-md hover:shadow-emerald-950/40"
                title="Registration Manager • Student ID Verification & Approval"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300 group-hover:scale-105 transition-transform">
                      <Users className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-mono font-bold text-emerald-300 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/60">
                      3
                    </span>
                  </div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-300/80 bg-emerald-900/30 px-2 py-0.5 rounded-full border border-emerald-800/40">
                    Reg L3
                  </span>
                </div>
                <div>
                  <h5 className="text-xs font-bold text-white group-hover:text-emerald-200 transition-colors">
                    {language === 'bn' ? '৩. রেজি. ম্যানেজার' : '3. Reg Manager'}
                  </h5>
                  <p className="text-[11px] text-slate-400 leading-tight mt-0.5">
                    {language === 'bn' ? 'স্টুডেন্ট আইডি ও যাচাইকরণ' : 'Student ID & Verification'}
                  </p>
                </div>
              </button>

              {/* 4. Finance Mgr */}
              <button
                type="button"
                onClick={() => handleSelectExecutiveRole('finance_mgr')}
                className="group flex flex-col justify-between p-3.5 rounded-xl bg-slate-900/90 hover:bg-slate-800/90 border border-amber-500/30 hover:border-amber-400 transition-all text-left cursor-pointer shadow-md hover:shadow-amber-950/40"
                title="Finance Manager • Budget Allocation & Expense Vouchers"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 group-hover:scale-105 transition-transform">
                      <Landmark className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-mono font-bold text-amber-300 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/60">
                      4
                    </span>
                  </div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-amber-300/80 bg-amber-900/30 px-2 py-0.5 rounded-full border border-amber-800/40">
                    Finance L4
                  </span>
                </div>
                <div>
                  <h5 className="text-xs font-bold text-white group-hover:text-amber-200 transition-colors">
                    {language === 'bn' ? '৪. ফাইন্যান্স ম্যানেজার' : '4. Finance Mgr'}
                  </h5>
                  <p className="text-[11px] text-slate-400 leading-tight mt-0.5">
                    {language === 'bn' ? 'বাজেট, ভাউচার ও ব্যয় অডিট' : 'Budget, Vouchers & Accounts'}
                  </p>
                </div>
              </button>

              {/* 5. Smart Staff Button with Expandable Popover / Dropdown */}
              <div className="relative" ref={staffMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsStaffOpen((prev) => !prev)}
                  aria-expanded={isStaffOpen}
                  aria-haspopup="true"
                  className={`w-full h-full group flex flex-col justify-between p-3.5 rounded-xl transition-all text-left cursor-pointer shadow-md ${
                    isStaffOpen
                      ? 'bg-rose-950/70 border-2 border-rose-400 shadow-rose-950/50'
                      : 'bg-slate-900/90 hover:bg-slate-800/90 border border-rose-500/30 hover:border-rose-400 hover:shadow-rose-950/40'
                  }`}
                  title="Staff Stations • Click to select Gate, Meal, Dress, Card Manager, or Committee Dir"
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-300 group-hover:scale-105 transition-transform">
                        <QrCode className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-mono font-bold text-rose-300 bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-800/60">
                        5
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-rose-300/90 bg-rose-900/40 px-2 py-0.5 rounded-full border border-rose-800/50">
                        5 Stations
                      </span>
                      <ChevronDown
                        className={`w-3.5 h-3.5 text-rose-400 transition-transform duration-200 ${
                          isStaffOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </div>
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-white group-hover:text-rose-200 transition-colors flex items-center justify-between">
                      <span>{language === 'bn' ? '৫. ফিল্ড স্টাফ' : '5. Staff'}</span>
                      <span className="text-[10px] text-rose-300/80 font-mono">
                        {isStaffOpen ? '▲ Close' : '▼ Open'}
                      </span>
                    </h5>
                    <p className="text-[11px] text-slate-400 leading-tight mt-0.5">
                      {language === 'bn'
                        ? 'গেট, মিল, ড্রেস, কার্ড ও কমিটি'
                        : 'Gate, Meal, Dress, Card, Dir'}
                    </p>
                  </div>
                </button>

                {/* Smart Popover for the 5 Staff Stations */}
                {isStaffOpen && (
                  <div className="absolute right-0 sm:right-auto sm:left-0 lg:right-0 lg:left-auto bottom-full mb-3 w-80 sm:w-96 bg-[#0B132B] border-2 border-rose-500/60 rounded-2xl shadow-2xl p-3.5 z-50 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-xl">
                    <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-800">
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-rose-400" />
                        <span className="text-xs font-bold text-white uppercase tracking-wider">
                          {language === 'bn' ? 'অপারেশনাল স্টাফ স্টেশন (৫টি)' : 'Operational Staff Stations (5)'}
                        </span>
                      </div>
                      <span className="text-[10px] text-rose-300 font-mono bg-rose-950/80 px-2 py-0.5 rounded border border-rose-800/60 font-bold">
                        ONE-CLICK DISPATCH
                      </span>
                    </div>

                    <div className="space-y-2">
                      {/* Station 1: Gate Staff */}
                      <button
                        type="button"
                        onClick={() => handleSelectStaffStation('gate')}
                        className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-900/90 hover:bg-emerald-950/40 border border-slate-800 hover:border-emerald-500/50 text-left transition-colors cursor-pointer group"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 group-hover:scale-105 transition-transform">
                            <QrCode className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white group-hover:text-emerald-300">
                              {language === 'bn' ? 'গেট স্টাফ (Gate Staff)' : 'Gate Staff'}
                            </div>
                            <div className="text-[11px] text-slate-400 leading-tight">
                              Gate 01 & 02 QR Scanner Desk
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/60 font-semibold">
                          gate@gmail.com
                        </span>
                      </button>

                      {/* Station 2: Meal Staff */}
                      <button
                        type="button"
                        onClick={() => handleSelectStaffStation('meal')}
                        className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-900/90 hover:bg-orange-950/40 border border-slate-800 hover:border-orange-500/50 text-left transition-colors cursor-pointer group"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400 shrink-0 group-hover:scale-105 transition-transform">
                            <Utensils className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white group-hover:text-orange-300">
                              {language === 'bn' ? 'মিল স্টাফ (Meal Staff)' : 'Meal Staff'}
                            </div>
                            <div className="text-[11px] text-slate-400 leading-tight">
                              Breakfast, Lunch & Dinner Pavilions
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono text-orange-400 bg-orange-950/80 px-2 py-0.5 rounded border border-orange-800/60 font-semibold">
                          food@gmail.com
                        </span>
                      </button>

                      {/* Station 3: Dress Staff */}
                      <button
                        type="button"
                        onClick={() => handleSelectStaffStation('dress')}
                        className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-900/90 hover:bg-sky-950/40 border border-slate-800 hover:border-sky-500/50 text-left transition-colors cursor-pointer group"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-[#38BDF8] shrink-0 group-hover:scale-105 transition-transform">
                            <Shirt className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white group-hover:text-sky-300">
                              {language === 'bn' ? 'ড্রেস স্টাফ (Dress Staff)' : 'Dress Staff'}
                            </div>
                            <div className="text-[11px] text-slate-400 leading-tight">
                              Kit Bag & T-Shirt Distribution Booth
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono text-sky-400 bg-sky-950/80 px-2 py-0.5 rounded border border-sky-800/60 font-semibold">
                          dress@gmail.com
                        </span>
                      </button>

                      {/* Station 4: Card Manager */}
                      <button
                        type="button"
                        onClick={() => handleSelectStaffStation('card')}
                        className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-900/90 hover:bg-indigo-950/40 border border-slate-800 hover:border-indigo-500/50 text-left transition-colors cursor-pointer group"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0 group-hover:scale-105 transition-transform">
                            <CreditCard className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white group-hover:text-indigo-300">
                              {language === 'bn' ? 'কার্ড ম্যানেজার (Card Manager)' : 'Card Manager'}
                            </div>
                            <div className="text-[11px] text-slate-400 leading-tight">
                              Student ID Production & Batch PVC Print
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono text-indigo-400 bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-800/60 font-semibold">
                          idcard.staff
                        </span>
                      </button>

                      {/* Station 5: Committee Dir */}
                      <button
                        type="button"
                        onClick={() => handleSelectStaffStation('committee')}
                        className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-900/90 hover:bg-purple-950/40 border border-slate-800 hover:border-purple-500/50 text-left transition-colors cursor-pointer group"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400 shrink-0 group-hover:scale-105 transition-transform">
                            <Building className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white group-hover:text-purple-300">
                              {language === 'bn' ? 'কমিটি ডিরেক্টর (Committee Dir)' : 'Committee Dir'}
                            </div>
                            <div className="text-[11px] text-slate-400 leading-tight">
                              Central RMS Directorate ERP Portal
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono text-purple-400 bg-purple-950/80 px-2 py-0.5 rounded border border-purple-800/60 font-semibold">
                          director ERP
                        </span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Bottom Bar */}
        <div className="pt-6 border-t border-[#1E293B] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            © 2027 {t.institutionName}.{' '}
            {language === 'bn' ? 'সর্বস্বত্ব সংরক্ষিত।' : 'All Rights Reserved.'}
          </div>

          {/* Admin link in bottom bar */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => onNavigate('admin')}
              className="text-slate-400 hover:text-[#38BDF8] flex items-center gap-1.5 transition-colors cursor-pointer text-xs"
            >
              <Key className="w-3.5 h-3.5 text-[#0EA5E9]" />
              <span>
                {language === 'bn' ? 'অ্যাডমিন পোর্টাল (লগইন/সাইন-আপ)' : 'Admin Portal (Login / Sign-up)'}
              </span>
            </button>

            <span className="text-slate-700">•</span>

            <div className="flex items-center gap-1 text-slate-400">
              <span>{language === 'bn' ? 'ঐতিহ্যের ৬৪ বছর উদ্‌যাপনে' : 'Celebrating 64 Years with'}</span>
              <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500 inline" />
              <span>{language === 'bn' ? 'সকল শিক্ষক ও শিক্ষার্থী' : 'Alumni & Students'}</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};
