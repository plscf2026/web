import React from 'react';
import {
  ShieldAlert,
  ArrowRight,
  LogOut,
  Home,
  Lock,
  UserCheck,
} from 'lucide-react';
import { AdminAccount, PortalRole, PORTAL_ROLE_CONFIGS } from '../../types';

interface AccessDeniedGateProps {
  currentAccount: AdminAccount;
  requiredRole?: PortalRole;
  language?: 'en' | 'bn';
  onNavigateAuthorized: () => void;
  onLogoutAndSwitch: () => void;
  onNavigateHome: () => void;
}

export const AccessDeniedGate: React.FC<AccessDeniedGateProps> = ({
  currentAccount,
  requiredRole,
  language = 'en',
  onNavigateAuthorized,
  onLogoutAndSwitch,
  onNavigateHome,
}) => {
  const isBn = language === 'bn';
  const userConfig = PORTAL_ROLE_CONFIGS[currentAccount.role as PortalRole] || PORTAL_ROLE_CONFIGS.admin;
  const targetConfig = requiredRole ? PORTAL_ROLE_CONFIGS[requiredRole] : null;

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4 bg-slate-950 font-satoshi animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-slate-900 border-2 border-rose-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-rose-950/40 relative overflow-hidden">
        {/* Top ambient glow */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-32 bg-rose-600/20 rounded-full blur-3xl pointer-events-none" />

        {/* Header Icon & Title */}
        <div className="flex flex-col items-center text-center space-y-3 mb-6 relative">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border-2 border-rose-500/40 text-rose-500 flex items-center justify-center shadow-lg shadow-rose-500/10">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <span className="px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-400 border border-rose-500/40">
            {isBn ? 'অননুমোদিত প্রবেশাধিকার প্রতিহত' : '403 Forbidden • Role Access Restricted'}
          </span>

          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            {isBn ? 'এই পোর্টালে প্রবেশের অনুমতি নেই' : 'Unauthorized Portal Access'}
          </h2>

          <p className="text-xs sm:text-sm text-slate-400 max-w-md">
            {targetConfig ? (
              isBn ? (
                <>
                  আপনি <strong className="text-white">{targetConfig.titleBn}</strong>-এ প্রবেশের চেষ্টা করছেন, কিন্তু আপনার অ্যাকাউন্টের রোল অনুযায়ী এই পোর্টালে প্রবেশের অনুমতি নেই।
                </>
              ) : (
                <>
                  You attempted to access the <strong className="text-white">{targetConfig.titleEn}</strong>, which is restricted strictly to authorized {targetConfig.badgeLabelEn} members.
                </>
              )
            ) : (
              isBn
                ? 'আপনার অ্যাকাউন্টের রোল অনুযায়ী এই সংরক্ষিত ড্যাশবোর্ড মডিউলে প্রবেশের অনুমতি নেই।'
                : 'Your current account role does not possess the permissions required to view this dashboard.'
            )}
          </p>
        </div>

        {/* Active Identity Badge */}
        <div className="bg-slate-950/70 rounded-2xl p-4 border border-slate-800 space-y-3 mb-6">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-slate-400" />
              <span>{isBn ? 'বর্তমান সক্রিয় অ্যাকাউন্ট' : 'Current Active Account'}</span>
            </span>
            <span className="text-xs font-mono font-bold text-slate-400">
              {currentAccount.username}
            </span>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <span className="text-sm font-bold text-white block">{currentAccount.fullName}</span>
              <span className="text-[11px] text-slate-400">{currentAccount.email}</span>
            </div>

            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">
                {isBn ? 'অ্যাসাইনকৃত ভূমিকা' : 'Assigned Role'}
              </span>
              <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wide bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                {userConfig.badgeLabelEn}
              </span>
            </div>
          </div>
        </div>

        {/* Security Policy Reminder */}
        <div className="bg-rose-950/30 rounded-xl p-3 border border-rose-900/50 text-[11px] text-rose-300 flex items-start gap-2.5 mb-6">
          <Lock className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            {isBn
              ? 'ইউআরএল পরিবর্তন করে অন্য ভূমিকার পোর্টাল বা ড্যাশবোর্ডে প্রবেশ করা নিরাপত্তা নীতিমালা অনুযায়ী সম্পূর্ণ নিষিদ্ধ। সকল অননুমোদিত অ্যাক্সেস প্রচেষ্টা অডিট লগে রেকর্ড করা হয়।'
              : 'Changing URLs to access another role\'s portal is strictly prevented by Supabase Role-Based Access Control (RBAC). All unauthorized access attempts are logged.'}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5">
          <button
            type="button"
            onClick={onNavigateAuthorized}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 cursor-pointer transition-all hover:scale-[1.01]"
          >
            <span>{isBn ? `আমার অনুমোদিত পোর্টালে যান (${userConfig.titleBn})` : `Go to My Authorized Portal (${userConfig.badgeLabelEn})`}</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              onClick={onLogoutAndSwitch}
              className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors border border-slate-700"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-400" />
              <span>{isBn ? 'লগআউট ও অ্যাকাউন্ট পরিবর্তন' : 'Switch Account'}</span>
            </button>

            <button
              type="button"
              onClick={onNavigateHome}
              className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors border border-slate-700"
            >
              <Home className="w-3.5 h-3.5 text-sky-400" />
              <span>{isBn ? 'হোমপেজে ফিরে যান' : 'Return Home'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
