import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Phone,
  Mail,
  Shield,
  Heart,
  ArrowUpRight,
  Lock,
  QrCode,
} from 'lucide-react';
import { Language, FeeSettings } from '../types';
import { AboutContactContent } from '../types/aboutContact';
import { AboutContactService } from '../services/aboutContactService';
import { translations } from '../i18n/translations';
import { SupabaseService } from '../services/supabase';
import { AppStore } from '../services/store';
import { isGlobalRegistrationOpen, isDonationOpen } from '../utils/rules';

interface FooterProps {
  language: Language;
  onNavigate: (view: string, replace?: boolean, extraParams?: Record<string, string>) => void;
  feeSettings?: FeeSettings;
}

export const Footer: React.FC<FooterProps> = ({ language, onNavigate, feeSettings: initialFeeSettings }) => {
  const [feeSettings, setFeeSettings] = useState<FeeSettings>(
    () => initialFeeSettings || AppStore.getFeeSettings()
  );
  const [aboutContent, setAboutContent] = useState<AboutContactContent>(() =>
    AboutContactService.getContent()
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
    const unsubAbout = AboutContactService.subscribe((updated) => {
      setAboutContent(updated);
    });
    return () => {
      window.removeEventListener('plscf_fee_settings_updated', handleSync);
      unsubAbout();
    };
  }, []);

  const t = translations[language];

  const handleDirectPortalNav = async (view: string) => {
    try {
      await SupabaseService.terminateAdministrativeSession({ forceLocal: true });
    } catch (_) {}
    onNavigate(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="bg-slate-900 text-slate-300 border-t border-slate-800 pt-14 pb-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 4-Column Navigation & Contact Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
          {/* Col 1: Institution Details */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full overflow-hidden bg-white p-0.5 shadow-md shrink-0 border-2 border-sky-600 flex items-center justify-center">
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
                <span className="text-xs text-sky-400 font-semibold">
                  {language === 'bn' ? 'স্থাপিত: ১৯৬২' : 'Established: 1962'}
                </span>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-slate-400">
              {language === 'bn'
                ? 'ফরিদপুরের ঐতিহ্যবাহী পুলিশ লাইন্স স্কুল অ্যান্ড কলেজের ৬৪ বছর পূর্তি উপলক্ষে আয়োজিত গ্র্যান্ড পুনর্মিলনী ২০২৭। প্রাক্তন ও বর্তমান শিক্ষার্থীদের এক মিলনমেলা।'
                : 'Police Lines School and College, Faridpur celebrates 65 glorious years of academic excellence and character building with Grand Reunion 2027.'}
            </p>

            <div className="pt-2 text-xs flex items-center gap-2 text-sky-400">
              <Shield className="w-4 h-4 text-sky-500" />
              <span>
                {language === 'bn'
                  ? 'সার্বিক পৃষ্ঠপোষকতায়: জেলা পুলিশ প্রশাসন, ফরিদপুর'
                  : 'Patronage: District Police Administration, Faridpur'}
              </span>
            </div>
          </div>

          {/* Col 2: Quick Links */}
          <div>
            <h4 className="text-white font-semibold text-sm uppercase tracking-wider mb-4 border-l-2 border-sky-600 pl-2">
              {language === 'bn' ? 'প্রয়োজনীয় লিংক' : 'Quick Links'}
            </h4>
            <ul className="space-y-2 text-xs">
              {isGlobalRegistrationOpen(feeSettings) && (
                <li>
                  <button
                    type="button"
                    onClick={() => onNavigate('register')}
                    className="hover:text-sky-400 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowUpRight className="w-3 h-3 text-sky-500" />
                    <span>{t.navRegister}</span>
                  </button>
                </li>
              )}
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('find-ticket')}
                  className="hover:text-sky-400 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <ArrowUpRight className="w-3 h-3 text-sky-500" />
                  <span>{t.navFindTicket}</span>
                </button>
              </li>
              {isDonationOpen(feeSettings) && (
                <li>
                  <button
                    type="button"
                    onClick={() => onNavigate('donate')}
                    className="hover:text-sky-400 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowUpRight className="w-3 h-3 text-sky-500" />
                    <span>{t.navDonate}</span>
                  </button>
                </li>
              )}
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('notices')}
                  className="hover:text-sky-400 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <ArrowUpRight className="w-3 h-3 text-sky-500" />
                  <span>{t.navNotices}</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('gallery')}
                  className="hover:text-sky-400 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <ArrowUpRight className="w-3 h-3 text-sky-500" />
                  <span>{t.navGallery}</span>
                </button>
              </li>
            </ul>
          </div>

          {/* Col 3: Event Operations */}
          <div>
            <h4 className="text-white font-semibold text-sm uppercase tracking-wider mb-4 border-l-2 border-sky-500 pl-2">
              {language === 'bn' ? 'অপারেশনাল পোর্টাল' : 'Event Operations'}
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  type="button"
                  onClick={() => handleDirectPortalNav('scanner')}
                  className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-sky-400 w-full transition-colors cursor-pointer"
                  title="All Staff Login (Gate, Food, Kit, Finance & Admin)"
                >
                  <div className="flex items-center gap-2">
                    <QrCode className="w-4 h-4 text-sky-500" />
                    <span className="font-semibold">{t.navScannerPortal}</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-600 text-white font-mono font-bold">
                    All Staff
                  </span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleDirectPortalNav('admin')}
                  className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-sky-600/40 text-sky-100 w-full transition-all cursor-pointer group shadow-xs"
                  title="Exclusive Administrator Access (Single Slot / Supabase Command)"
                >
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-sky-400" />
                    <span className="font-bold">
                      {language === 'bn' ? 'অ্যাডমিন পোর্টাল' : 'Admin Portal'}
                    </span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-600 text-white font-mono font-bold">
                    Admin
                  </span>
                </button>
              </li>
            </ul>

            <div className="mt-4 p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-[11px] text-slate-400">
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
            <h4 className="text-white font-semibold text-sm uppercase tracking-wider mb-4 border-l-2 border-sky-400 pl-2">
              {language === 'bn' ? aboutContent.helpdeskTitleBn : aboutContent.helpdeskTitleEn}
            </h4>
            <div className="space-y-2.5 text-xs text-slate-300">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />
                <span>{language === 'bn' ? aboutContent.addressBn : aboutContent.addressEn}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-sky-400 shrink-0" />
                <span>{language === 'bn' ? aboutContent.helplinePhoneBn : aboutContent.helplinePhoneEn}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-sky-500 shrink-0" />
                <span>{aboutContent.helplineEmail}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            © 2027 {t.institutionName}.{' '}
            {language === 'bn' ? 'সর্বস্বত্ব সংরক্ষিত।' : 'All Rights Reserved.'}
          </div>

          <div className="flex items-center gap-1 text-slate-400">
            <span>{language === 'bn' ? 'ঐতিহ্যের ৬৪ বছর উদ্‌যাপনে' : 'Celebrating 64 Years with'}</span>
            <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500 inline" />
            <span>{language === 'bn' ? 'সকল শিক্ষক ও শিক্ষার্থী' : 'Alumni & Students'}</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
