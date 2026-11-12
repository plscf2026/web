import { useState } from 'react';
import {
  Home,
  UserPlus,
  QrCode,
  Globe,
  Menu,
  X,
  HeartHandshake,
  Search,
  Bell,
  Image as ImageIcon,
  Info,
  Building,
} from 'lucide-react';
import { Language } from '../types';
import { translations } from '../i18n/translations';

interface HeaderProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
  activeView: string;
  onNavigate: (view: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  language,
  onLanguageChange,
  activeView,
  onNavigate,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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

  const navItems: NavItem[] = [
    { id: 'home', label: t.navHome, icon: Home },
    { id: 'register', label: t.navRegister, icon: UserPlus, highlight: true },
    { id: 'donate', label: t.navDonate, icon: HeartHandshake },
    { id: 'find-ticket', label: t.navFindTicket, icon: Search },
    { id: 'notices', label: t.navNotices, icon: Bell },
    { id: 'gallery', label: t.navGallery, icon: ImageIcon },
    { id: 'about', label: t.navAbout, icon: Info },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
      {/* Top emergency announcement & quick portals bar */}
      <div className="bg-sky-950 text-sky-50 text-xs py-1.5 px-3 sm:px-4 border-b border-sky-900">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-1.5">
          <div className="flex items-center gap-2 max-w-full overflow-hidden">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white uppercase shrink-0 tracking-wide">
              {language === 'bn' ? 'অফিসিয়াল' : 'OFFICIAL'}
            </span>
            <span className="font-semibold text-[11px] sm:text-xs truncate">
              {language === 'bn'
                ? 'পুলিশ লাইন্স উচ্চ বিদ্যালয় ও কলেজ, ফরিদপুর পুনর্মিলনী ২০২৭ • ২৮-২৯ জানুয়ারি ২০২৭'
                : 'Police Lines High School & College, Faridpur Reunion 2027 • Jan 28-29, 2027'}
            </span>
          </div>

          <div className="flex items-center justify-center gap-2 sm:gap-3 text-[11px] w-full md:w-auto">
            {/* RMS ERP Management Portal Button */}
            <button
              onClick={() => handleNav('portal')}
              className={`flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold transition-all shadow-xs cursor-pointer ${
                activeView === 'portal'
                  ? 'bg-rose-500 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
              title="Central Organizing Committee ERP Portal"
            >
              <Building className="w-3.5 h-3.5" />
              <span>{language === 'bn' ? 'আরএমএস পোর্টাল' : 'RMS Portal'}</span>
            </button>

            {/* Quick Scanner Portal Switcher */}
            <button
              onClick={() => handleNav('scanner')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                activeView === 'scanner'
                  ? 'bg-amber-400 text-slate-900 font-bold'
                  : 'bg-sky-800 hover:bg-sky-700 text-sky-50 border border-sky-700'
              }`}
              title="QR Scanner Gate Portal"
            >
              <QrCode className="w-3 h-3 text-amber-400" />
              <span>{t.navScannerPortal}</span>
            </button>

            {/* Bilingual Switcher */}
            <button
              onClick={() => onLanguageChange(language === 'en' ? 'bn' : 'en')}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold transition-all shadow-2xs cursor-pointer text-[11px]"
              aria-label="Toggle language between Bangla and English"
            >
              <Globe className="w-3 h-3" />
              <span>{t.switchLanguage}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Institution Branding Navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-18 sm:h-20">
          {/* Logo & School Crest */}
          <div
            onClick={() => handleNav('home')}
            className="flex items-center gap-2.5 sm:gap-3.5 cursor-pointer select-none group min-w-0"
          >
            <div className="w-11 h-11 sm:w-13 sm:h-13 rounded-full overflow-hidden bg-white p-0.5 shadow-md group-hover:scale-105 transition-transform duration-200 border-2 border-amber-400 shrink-0 flex items-center justify-center">
              <img
                src="/assets/school_logo.png"
                alt="Police Lines School & College Faridpur Crest"
                className="w-full h-full object-contain rounded-full"
              />
            </div>

            <div className="min-w-0 pr-3 border-r border-slate-200">
              <h1 className="text-xs sm:text-base font-extrabold text-slate-900 tracking-tight leading-tight group-hover:text-sky-700 transition-colors">
                {t.institutionName}
              </h1>
              <p className="text-[10px] sm:text-xs text-slate-500 font-semibold italic flex items-center gap-1.5 mt-0.5">
                <span>{language === 'bn' ? 'স্থাপিত ১৯৬২ • ফরিদপুর' : 'Est. 1962 • Faridpur'}</span>
              </p>
            </div>
          </div>

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
                      ? 'bg-[#104a88] text-white shadow-xs'
                      : 'text-slate-800 hover:text-sky-900 hover:bg-slate-100'
                  }`}
                >
                  {IconComponent && <IconComponent className="w-3.5 h-3.5" />}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Mobile hamburger button */}
          <div className="flex lg:hidden items-center gap-2">
            <button
              onClick={() => onLanguageChange(language === 'en' ? 'bn' : 'en')}
              className="px-2.5 py-1 text-xs font-bold rounded-md bg-amber-400 text-slate-900 cursor-pointer"
            >
              {t.switchLanguage}
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-700 hover:bg-slate-100 cursor-pointer"
              aria-label="Toggle mobile menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-white border-b border-slate-200 px-4 pt-2 pb-6 space-y-2 shadow-xl animate-in slide-in-from-top-2 duration-150">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNav(item.id)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-left text-sm font-medium cursor-pointer ${
                activeView === item.id
                  ? 'bg-sky-50 text-sky-800 font-semibold'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2">
                {item.icon && <item.icon className="w-4 h-4 text-sky-700" />}
                <span>{item.label}</span>
              </div>
              {item.highlight && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-sky-700 text-white">
                  Join
                </span>
              )}
            </button>
          ))}

          <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
            <button
              onClick={() => handleNav('scanner')}
              className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 cursor-pointer"
            >
              <QrCode className="w-4 h-4 text-amber-600" />
              <span>{t.navScannerPortal}</span>
            </button>
            {/* Scanner portal for gate staff */}
          </div>
        </div>
      )}
    </header>
  );
};
