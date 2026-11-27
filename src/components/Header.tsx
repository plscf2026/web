import { useState, useEffect } from 'react';
import {
  Home,
  UserPlus,
  Globe,
  Menu,
  X,
  HeartHandshake,
  Search,
  Bell,
  Image as ImageIcon,
  Info,
} from 'lucide-react';
import { Language, FeeSettings, GovernanceLoadStatus } from '../types';
import { translations } from '../i18n/translations';
import { AppStore } from '../services/store';
import { isGlobalRegistrationOpen, isDonationOpen } from '../utils/rules';

interface HeaderProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
  activeView: string;
  onNavigate: (view: string) => void;
  feeSettings?: FeeSettings;
  governanceStatus?: GovernanceLoadStatus;
}

export const Header: React.FC<HeaderProps> = ({
  language,
  onLanguageChange,
  activeView,
  onNavigate,
  feeSettings: initialFeeSettings,
  governanceStatus = 'ready',
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [feeSettings, setFeeSettings] = useState<FeeSettings>(
    () => initialFeeSettings || AppStore.getFeeSettings()
  );

  useEffect(() => {
    if (initialFeeSettings) {
      setFeeSettings(initialFeeSettings);
    }
  }, [initialFeeSettings]);

  useEffect(() => {
    const handleSync = (e: any) => {
      if (e.detail) {
        setFeeSettings(e.detail);
      }
    };
    window.addEventListener('plscf_fee_settings_updated', handleSync);
    return () => window.removeEventListener('plscf_fee_settings_updated', handleSync);
  }, []);

  const t = translations[language];

  const handleNav = (view: string) => {
    onNavigate(view);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  interface NavItem {
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    highlight?: boolean;
  }

  const isGovernanceReady = governanceStatus === 'ready';

  const rawNavItems: NavItem[] = [
    { id: 'home', label: t.navHome, icon: Home },
    ...(isGovernanceReady && isGlobalRegistrationOpen(feeSettings)
      ? [{ id: 'register', label: t.navRegister, icon: UserPlus, highlight: true }]
      : []),
    ...(isGovernanceReady
      ? [
          {
            id: 'donate',
            label: isDonationOpen(feeSettings)
              ? t.navDonate
              : language === 'bn'
                ? `${t.navDonate} (বন্ধ)`
                : `${t.navDonate} (Closed)`,
            icon: HeartHandshake,
          },
        ]
      : []),
    { id: 'find-ticket', label: t.navFindTicket, icon: Search },
    { id: 'notices', label: t.navNotices, icon: Bell },
    { id: 'gallery', label: t.navGallery, icon: ImageIcon },
    { id: 'about', label: t.navAbout, icon: Info },
  ];

  const navItems = rawNavItems;

  return (
    <header className="sticky top-0 z-50 bg-[#F0F6FA]/95 backdrop-blur-md border-b border-[#E2EEF8] shadow-xs">
      {/* Institutional Top Prestige Strip (Desktop/Tablet) */}
      <div className="hidden md:block bg-gradient-to-r from-slate-950 via-[#0F172A] to-slate-950 text-slate-300 border-b border-sky-500/20 py-1.5 px-4 sm:px-6 lg:px-8 text-xs font-medium">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="text-sky-300 font-bold">
              {language === 'bn' ? 'ঐতিহ্যের ৬৫ বছর পূর্তি মহোৎসব • ২০২৭' : '65 Years Milestone • Grand Reunion 2027'}
            </span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-400 truncate">
              {language === 'bn' ? 'সার্বিক পৃষ্ঠপোষকতায়: জেলা পুলিশ প্রশাসন, ফরিদপুর' : 'Patronage: District Police Administration, Faridpur'}
            </span>
          </div>
          <div className="flex items-center gap-4 text-slate-400 text-[11px] shrink-0 font-medium">
            <span>📅 {language === 'bn' ? '২৮ - ২৯ জানুয়ারি, ২০২৭' : 'Jan 28 - 29, 2027'}</span>
            <span>📍 {language === 'bn' ? 'স্কুল ও কলেজ ক্যাম্পাস' : 'School Campus, Faridpur'}</span>
          </div>
        </div>
      </div>

      {/* Main Institution Branding Navigation */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between min-h-[4.25rem] py-2 sm:py-0 sm:h-20 gap-2">
          {/* Logo & School Crest */}
          <button
            type="button"
            onClick={() => handleNav('home')}
            aria-label={language === 'bn' ? 'হোম পেজে ফিরুন' : 'Go to home page'}
            className="flex items-center gap-2 sm:gap-3.5 cursor-pointer select-none group min-w-0 text-left bg-transparent border-0 p-0"
          >
            <div className="w-10 h-10 sm:w-13 sm:h-13 rounded-full overflow-hidden bg-white p-0.5 shadow-md group-hover:scale-105 transition-transform duration-200 border-2 border-[#0284C7] ring-2 ring-sky-400/20 shrink-0 flex items-center justify-center">
              <img
                src="/assets/school_logo.png"
                alt="Police Lines School & College Faridpur Crest"
                className="w-full h-full object-contain rounded-full"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/assets/school_logo.jpg';
                }}
              />
            </div>

            <div className="min-w-0 pr-1 sm:pr-3 sm:border-r sm:border-[#E2EEF8]">
              <h1 className="text-[13px] sm:text-base font-extrabold text-[#0F172A] tracking-tight leading-snug group-hover:text-[#0284C7] transition-colors line-clamp-2 sm:line-clamp-none">
                {t.institutionName}
              </h1>
              <p className="text-[10px] sm:text-xs text-[#0284C7] font-semibold italic flex items-center gap-1.5 mt-0.5 truncate">
                <span>{language === 'bn' ? 'স্থাপিত ১৯৬২ • ফরিদপুর' : 'Est. 1962 • Faridpur'}</span>
              </p>
            </div>
          </button>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1.5 xl:gap-2">
            {navItems.map((item) => {
              const isActive = activeView === item.id;
              const IconComponent = item.icon;

              return (
                <button
                  key={item.id}
                  onClick={() => handleNav(item.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#0F172A] text-white shadow-xs'
                      : item.highlight
                      ? 'bg-[#0284C7] text-white hover:bg-[#0EA5E9] shadow-xs hover:shadow-md'
                      : 'text-[#0F172A] hover:text-[#0284C7] hover:bg-[#E2EEF8]'
                  }`}
                >
                  {IconComponent && <IconComponent className="w-3.5 h-3.5" />}
                  <span>{item.label}</span>
                </button>
              );
            })}

            {/* Bilingual Switcher */}
            <button
              onClick={() => onLanguageChange(language === 'en' ? 'bn' : 'en')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#E2EEF8] hover:bg-white text-[#0F172A] border border-[#0284C7]/30 font-bold transition-all shadow-2xs cursor-pointer text-xs ml-1.5 hover:border-[#0284C7]"
              aria-label="Toggle language between Bangla and English"
            >
              <Globe className="w-3.5 h-3.5 text-[#0284C7]" />
              <span>{t.switchLanguage}</span>
            </button>
          </nav>

          {/* Mobile controls (Language toggle & Hamburger) */}
          <div className="flex lg:hidden items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={() => onLanguageChange(language === 'en' ? 'bn' : 'en')}
              className="min-h-[38px] px-2.5 py-1.5 text-xs font-bold rounded-full bg-[#E2EEF8] text-[#0F172A] border border-[#0284C7]/20 cursor-pointer whitespace-nowrap active:scale-95"
            >
              {t.switchLanguage}
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="min-h-[40px] min-w-[40px] flex items-center justify-center p-2 rounded-xl text-[#0F172A] hover:bg-[#E2EEF8] transition-colors cursor-pointer active:scale-95"
              aria-label="Toggle mobile menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-[#F0F6FA] border-b border-[#E2EEF8] px-4 pt-3 pb-8 space-y-2 shadow-xl animate-in slide-in-from-top-2 duration-150 max-h-[calc(100vh-4.5rem)] overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNav(item.id)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-left text-sm font-semibold transition-all cursor-pointer ${
                activeView === item.id
                  ? 'bg-[#0F172A] text-white font-bold shadow-xs'
                  : item.highlight
                  ? 'bg-[#0284C7] text-white font-bold'
                  : 'text-[#0F172A] hover:bg-[#E2EEF8]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {item.icon && <item.icon className="w-4 h-4" />}
                <span>{item.label}</span>
              </div>
              {item.highlight && (
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-white text-[#0284C7] shadow-2xs">
                  {language === 'bn' ? 'যোগ দিন' : 'Join'}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </header>
  );
};
