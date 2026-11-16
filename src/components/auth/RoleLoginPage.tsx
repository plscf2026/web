import React, { useState } from 'react';
import {
  Crown,
  Shield,
  UserCheck,
  DollarSign,
  UserPlus,
  Users,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ArrowRight,
  ShieldAlert,
  ArrowLeft,
  Globe,
  Sparkles,
} from 'lucide-react';
import {
  PortalRole,
  PORTAL_ROLE_CONFIGS,
  getPortalConfigByRole,
  Language,
  AdminAccount,
} from '../../types';
import { SupabaseService, isDevTestBypassAllowed } from '../../services/supabase';

interface RoleLoginPageProps {
  role: PortalRole;
  language?: Language;
  currentAccount?: AdminAccount;
  onLanguageChange?: (lang: Language) => void;
  onLoginSuccess: (account: AdminAccount) => void;
  onSwitchPortal: (targetRole: PortalRole) => void;
  onNavigateHome: () => void;
  onNavigateAuthorized?: () => void;
}

export const RoleLoginPage: React.FC<RoleLoginPageProps> = ({
  role,
  language = 'en',
  currentAccount,
  onLanguageChange,
  onLoginSuccess,
  onSwitchPortal,
  onNavigateHome,
  onNavigateAuthorized,
}) => {
  const isBn = language === 'bn';
  const config = getPortalConfigByRole(role);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const isDevBypass = isDevTestBypassAllowed();

  // Dynamic Icon selector
  const renderRoleIcon = () => {
    switch (config.iconName) {
      case 'Crown':
        return <Crown className="w-8 h-8" />;
      case 'Shield':
        return <Shield className="w-8 h-8" />;
      case 'UserCheck':
        return <UserCheck className="w-8 h-8" />;
      case 'DollarSign':
        return <DollarSign className="w-8 h-8" />;
      case 'UserPlus':
        return <UserPlus className="w-8 h-8" />;
      case 'Users':
        return <Users className="w-8 h-8" />;
      default:
        return <Shield className="w-8 h-8" />;
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!username.trim() || !password) {
      setErrorMessage(
        isBn
          ? 'দয়া করে ইউজারনেম এবং পাসওয়ার্ড প্রদান করুন।'
          : 'Please enter your username/email and password.'
      );
      return;
    }

    setIsLoading(true);

    try {
      const res = await SupabaseService.loginAdmin(username.trim(), password, role);

      if (res.success && res.account) {
        onLoginSuccess(res.account);
      } else {
        setErrorMessage(
          res.error ||
            (isBn
              ? 'ভুল তথ্য অথবা এই পোর্টালে আপনার প্রবেশের অনুমতি নেই।'
              : 'Invalid credentials or unauthorized role for this portal.')
        );
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickPrefill = () => {
    setUsername(config.demoCredentials.email);
    setPassword(config.demoCredentials.password);
  };

  const allRoles: PortalRole[] = [
    'super_admin',
    'admin',
    'moderator',
    'finance_manager',
    'registration_officer',
    'committee_member',
  ];

  return (
    <div className={`min-h-screen flex flex-col justify-between bg-gradient-to-br ${config.bgGradient} font-satoshi text-slate-100 selection:bg-amber-500 selection:text-slate-950 p-4 sm:p-6 lg:p-8 relative overflow-hidden`}>
      {/* Background ambient lighting */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Bar */}
      <header className="max-w-6xl w-full mx-auto flex items-center justify-between pb-6 border-b border-white/10 z-10">
        <button
          type="button"
          onClick={onNavigateHome}
          className="flex items-center gap-2 text-xs font-bold text-slate-300 hover:text-white px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{isBn ? 'মূল ওয়েবসাইটে ফিরে যান' : 'Back to Main Site'}</span>
        </button>

        <div className="flex items-center gap-3">
          {onLanguageChange && (
            <button
              type="button"
              onClick={() => onLanguageChange(language === 'en' ? 'bn' : 'en')}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-white px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5 text-sky-400" />
              <span>{isBn ? 'English' : 'বাংলা'}</span>
            </button>
          )}

          <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono text-slate-400 bg-white/5 px-3 py-1.5 rounded-xl border border-white/10">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Supabase Auth Secure RBAC</span>
          </div>
        </div>
      </header>

      {/* Main Login Card Container */}
      <main className="max-w-md w-full mx-auto my-auto py-8 z-10">
        <div className="bg-slate-900/90 backdrop-blur-xl rounded-3xl border border-white/15 p-6 sm:p-8 shadow-2xl shadow-black/80 space-y-6 relative overflow-hidden">
          {/* Institution Header & Role Crest */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center p-1 rounded-2xl bg-white/5 border border-white/10 mb-1">
              <div className="w-14 h-14 rounded-xl overflow-hidden bg-white p-1 shadow-md border border-white/20 flex items-center justify-center">
                <img
                  src="/assets/school_logo.png"
                  alt="Police Lines School & College Faridpur Crest"
                  className="w-full h-full object-contain"
                />
              </div>
            </div>

            {/* School Name */}
            <p className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">
              {isBn
                ? 'পুলিশ লাইন্স স্কুল অ্যান্ড কলেজ, ফরিদপুর • পুনর্মিলনী ২০২৭'
                : 'Police Lines School & College, Faridpur • Reunion 2027'}
            </p>

            {/* Role Badge */}
            <div>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-white/10 ${config.accentText} border border-white/15 shadow-xs`}>
                {renderRoleIcon()}
                <span>{isBn ? config.badgeLabelBn : config.badgeLabelEn}</span>
              </span>
            </div>

            {/* Exact Prominent Portal Title */}
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-snug">
              {isBn ? config.titleBn : config.titleEn}
            </h1>

            {/* Tagline */}
            <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
              {isBn ? config.taglineBn : config.taglineEn}
            </p>
          </div>

          {/* Error Message Alert */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-start gap-2.5 animate-in fade-in duration-150">
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span className="leading-snug">{errorMessage}</span>
            </div>
          )}

          {/* Current Signed-In Session Switcher Notice */}
          {currentAccount && (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 animate-in fade-in duration-150">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0 animate-pulse" />
                <span className="truncate">
                  {isBn ? 'বর্তমানে সাইন ইন করা:' : 'Signed in as:'}{' '}
                  <strong className="text-white font-mono">{currentAccount.email}</strong>{' '}
                  <span className="text-amber-400 font-bold uppercase text-[10px]">({currentAccount.role})</span>
                </span>
              </div>
              {onNavigateAuthorized && (
                <button
                  type="button"
                  onClick={onNavigateAuthorized}
                  className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-[11px] shrink-0 cursor-pointer transition-colors border border-white/10"
                >
                  {isBn ? 'ড্যাশবোর্ডে ফিরে যান →' : 'My Dashboard →'}
                </button>
              )}
            </div>
          )}

          {/* Dev Quick Test Fill Button */}
          {isDevBypass && (
            <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between text-xs">
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>{isBn ? 'টেস্টিং ক্রেডেনশিয়াল:' : 'Testing credentials available'}</span>
              </span>
              <button
                type="button"
                onClick={handleQuickPrefill}
                className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-[11px] cursor-pointer transition-colors"
              >
                {isBn ? 'অটো-ফিল' : 'Auto Fill'}
              </button>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                {isBn ? 'ইউজারনেম বা ইমেইল' : 'Username / Authorized Email'}
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={config.demoCredentials.email}
                  className="w-full bg-slate-950/70 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-hidden focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                {isBn ? 'সিকিউর পাসওয়ার্ড' : 'Secure Password'}
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-slate-950/70 border border-slate-700/80 rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-hidden focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer p-1"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-3 rounded-xl ${config.accentButton} flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer shadow-lg disabled:opacity-50 disabled:pointer-events-none mt-2`}
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                  <span>{isBn ? 'অনুমোদন যাচাই হচ্ছে...' : 'Verifying Credentials...'}</span>
                </>
              ) : (
                <>
                  <span>{isBn ? 'পোর্টালে প্রবেশ করুন' : 'Sign In to Portal'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Security Notice */}
          <div className="pt-2 border-t border-white/10 text-center">
            <p className="text-[10px] text-slate-500 font-medium">
              {isBn
                ? 'অনুমোদিত সদস্য ব্যতীত প্রবেশ সম্পূর্ণ নিষিদ্ধ। সকল প্রমাণীকরণ প্রচেষ্টা রেকর্ড করা হয়।'
                : 'Restricted government & institution system. Unauthorized login attempts are strictly prohibited and recorded.'}
            </p>
          </div>
        </div>
      </main>

      {/* Portal Switcher Grid Footer */}
      <footer className="max-w-6xl w-full mx-auto pt-6 border-t border-white/10 z-10 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            {isBn ? 'অন্যান্য ভূমিকা ভিত্তিক পোর্টালসমূহ:' : 'Switch to Other Role Portals:'}
          </span>
          <span className="text-[10px] text-slate-500">
            {isBn ? 'প্রতিটি রোলের নিজস্ব সুনির্দিষ্ট ইউআরএল ও ইন্টারফেস রয়েছে' : 'Each role has a unique branded URL & security context'}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {allRoles.map((r) => {
            const roleConf = PORTAL_ROLE_CONFIGS[r];
            const isCurrent = r === role;
            return (
              <button
                key={r}
                type="button"
                onClick={() => onSwitchPortal(r)}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  isCurrent
                    ? 'bg-white/15 border-white/30 text-white ring-1 ring-white/20'
                    : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className="text-[10px] font-black uppercase tracking-wider block truncate">
                  {roleConf.badgeLabelEn}
                </span>
                <span className="text-[11px] font-bold text-white block truncate mt-0.5">
                  {isBn ? roleConf.titleBn.split(' ').slice(-2).join(' ') : roleConf.badgeLabelEn.replace(' PORTAL', '')}
                </span>
              </button>
            );
          })}
        </div>
      </footer>
    </div>
  );
};
