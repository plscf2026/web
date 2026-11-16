import React from 'react';
import {
  Crown,
  Shield,
  UserCheck,
  DollarSign,
  UserPlus,
  Users,
  ArrowRight,
  ShieldCheck,
  Lock,
  ArrowLeft,
  Globe,
  Sparkles,
} from 'lucide-react';
import {
  PortalRole,
  PORTAL_ROLE_CONFIGS,
  Language,
} from '../../types';

interface RoleDirectoryPortalProps {
  language?: Language;
  onLanguageChange?: (lang: Language) => void;
  onSelectRole: (role: PortalRole) => void;
  onNavigateHome: () => void;
}

export const RoleDirectoryPortal: React.FC<RoleDirectoryPortalProps> = ({
  language = 'en',
  onLanguageChange,
  onSelectRole,
  onNavigateHome,
}) => {
  const isBn = language === 'bn';

  const roles: PortalRole[] = [
    'super_admin',
    'admin',
    'moderator',
    'finance_manager',
    'registration_officer',
    'committee_member',
  ];

  const getRoleIcon = (role: PortalRole) => {
    switch (role) {
      case 'super_admin':
        return <Crown className="w-6 h-6 text-amber-400" />;
      case 'admin':
        return <Shield className="w-6 h-6 text-blue-400" />;
      case 'moderator':
        return <UserCheck className="w-6 h-6 text-emerald-400" />;
      case 'finance_manager':
        return <DollarSign className="w-6 h-6 text-amber-500" />;
      case 'registration_officer':
        return <UserPlus className="w-6 h-6 text-sky-400" />;
      case 'committee_member':
        return <Users className="w-6 h-6 text-purple-400" />;
      default:
        return <Shield className="w-6 h-6" />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 font-satoshi text-slate-100 p-4 sm:p-6 lg:p-10 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-0 left-1/3 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header */}
      <header className="max-w-7xl mx-auto flex items-center justify-between pb-8 border-b border-slate-800/80 relative z-10">
        <button
          type="button"
          onClick={onNavigateHome}
          className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{isBn ? 'মূল ওয়েবসাইটে ফিরে যান' : 'Back to Main Site'}</span>
        </button>

        <div className="flex items-center gap-3">
          {onLanguageChange && (
            <button
              type="button"
              onClick={() => onLanguageChange(language === 'en' ? 'bn' : 'en')}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-white px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-colors cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5 text-sky-400" />
              <span>{isBn ? 'English' : 'বাংলা'}</span>
            </button>
          )}

          <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 bg-emerald-950/40 px-3 py-1.5 rounded-xl border border-emerald-800/50">
            <ShieldCheck className="w-4 h-4" />
            <span className="hidden sm:inline">Role-Based Access Control (RBAC)</span>
          </div>
        </div>
      </header>

      {/* Hero Title Section */}
      <section className="max-w-4xl mx-auto text-center py-12 space-y-4 relative z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-widest bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
          <Sparkles className="w-3.5 h-3.5" />
          <span>{isBn ? 'অফিসিয়াল অ্যাডমিনিস্ট্রেশন ও স্টাফ পোর্টাল' : 'Official Administration & Staff Portals'}</span>
        </div>

        <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight">
          {isBn
            ? 'প্রতিটি ভূমিকার জন্য স্বতন্ত্র ও সুরক্ষিত লগইন পোর্টাল'
            : 'Separate Login Portals for Every User Role'}
        </h1>

        <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
          {isBn
            ? 'প্রতিটি ব্যবহারকারী রোলের নিজস্ব ব্রান্ডিং, সুনির্দিষ্ট শিরোনাম ও ইউআরএল রয়েছে। আপনার নির্ধারিত পোর্টাল নির্বাচন করে প্রবেশ করুন।'
            : 'Each user role has a unique login page with its own branding, portal title, and identity. Select your authorized portal to sign in.'}
        </p>
      </section>

      {/* 6 Portal Cards Grid */}
      <main className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10 pb-16">
        {roles.map((r) => {
          const cfg = PORTAL_ROLE_CONFIGS[r];
          return (
            <div
              key={r}
              className="bg-slate-900/80 backdrop-blur-md rounded-3xl border border-slate-800 hover:border-slate-700 p-6 flex flex-col justify-between transition-all hover:scale-[1.01] hover:shadow-2xl hover:shadow-black/60 group relative overflow-hidden"
            >
              {/* Subtle top role accent line */}
              <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${cfg.themeColor === 'amber' ? 'from-amber-500 to-yellow-500' : cfg.themeColor === 'blue' ? 'from-blue-600 to-indigo-600' : cfg.themeColor === 'emerald' ? 'from-emerald-500 to-teal-500' : cfg.themeColor === 'cyan' ? 'from-sky-500 to-cyan-500' : 'from-purple-500 to-violet-500'}`} />

              <div className="space-y-4">
                {/* Header with Icon and Badge */}
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shadow-xs">
                    {getRoleIcon(r)}
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/5 text-slate-300 border border-white/10 font-mono">
                    /{cfg.slug}
                  </span>
                </div>

                {/* Role Badge & Portal Title */}
                <div>
                  <span className={`text-[10px] font-black uppercase tracking-widest ${cfg.accentText} block mb-1`}>
                    {cfg.badgeLabelEn}
                  </span>
                  <h2 className="text-base sm:text-lg font-black text-white group-hover:text-amber-400 transition-colors leading-snug">
                    {isBn ? cfg.titleBn : cfg.titleEn}
                  </h2>
                </div>

                {/* Tagline & Description */}
                <p className="text-xs text-slate-300 font-medium">
                  {isBn ? cfg.taglineBn : cfg.taglineEn}
                </p>
                <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">
                  {isBn ? cfg.descriptionBn : cfg.descriptionEn}
                </p>
              </div>

              {/* Action Button */}
              <div className="pt-6 border-t border-slate-800/80 mt-6">
                <button
                  type="button"
                  onClick={() => onSelectRole(r)}
                  className={`w-full py-2.5 px-4 rounded-xl ${cfg.accentButton} text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md group-hover:scale-[1.02]`}
                >
                  <span>{isBn ? `${cfg.badgeLabelEn.replace(' PORTAL', '')} পোর্টালে প্রবেশ` : `Enter ${cfg.badgeLabelEn.replace(' PORTAL', '')} Portal`}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </main>

      {/* Security Footer Note */}
      <footer className="max-w-4xl mx-auto text-center border-t border-slate-800/80 pt-8 pb-4 text-xs text-slate-500 space-y-1 relative z-10">
        <p className="flex items-center justify-center gap-1.5 font-medium">
          <Lock className="w-3.5 h-3.5 text-slate-400" />
          <span>{isBn ? 'পুলিশ লাইন্স স্কুল অ্যান্ড কলেজ, ফরিদপুর • আইটি ও সিকিউরিটি সেল' : 'Police Lines School & College, Faridpur • IT & Security Cell'}</span>
        </p>
        <p className="text-[11px] text-slate-600">
          Strict Role-Based Authorization enforced via Supabase backend authentication.
        </p>
      </footer>
    </div>
  );
};
