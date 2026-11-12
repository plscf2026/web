import React from 'react';
import {
  MapPin,
  Phone,
  Mail,
  Shield,
  Heart,
  QrCode,
  ArrowUpRight,
  Lock,
  Key,
  Building,
} from 'lucide-react';
import { Language } from '../types';
import { translations } from '../i18n/translations';

interface FooterProps {
  language: Language;
  onNavigate: (view: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ language, onNavigate }) => {
  const t = translations[language];

  return (
    <footer className="bg-slate-900 text-slate-300 border-t border-slate-800 pt-16 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
          {/* Col 1: Institution Details */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full overflow-hidden bg-white p-0.5 shadow-md shrink-0 border-2 border-amber-400 flex items-center justify-center">
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
                <span className="text-xs text-amber-400 font-semibold">
                  {language === 'bn' ? 'স্থাপিত: ১৯৬২' : 'Established: 1962'}
                </span>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-slate-400">
              {language === 'bn'
                ? 'ফরিদপুরের ঐতিহ্যবাহী পুলিশ লাইন্স স্কুল অ্যান্ড কলেজের ৬৪ বছর পূর্তি উপলক্ষে আয়োজিত গ্র্যান্ড পুনর্মিলনী ২০২৬। প্রাক্তন ও বর্তমান শিক্ষার্থীদের এক মিলনমেলা।'
                : 'Police Lines School and College, Faridpur celebrates 64 glorious years of academic excellence and character building with Grand Reunion 2026.'}
            </p>

            <div className="pt-2 text-xs flex items-center gap-2 text-emerald-400">
              <Shield className="w-4 h-4" />
              <span>
                {language === 'bn'
                  ? 'সার্বিক পৃষ্ঠপোষকতায়: জেলা পুলিশ প্রশাসন, ফরিদপুর'
                  : 'Patronage: District Police Administration, Faridpur'}
              </span>
            </div>
          </div>

          {/* Col 2: Quick Links */}
          <div>
            <h4 className="text-white font-semibold text-sm uppercase tracking-wider mb-4 border-l-2 border-emerald-500 pl-2">
              {language === 'bn' ? 'প্রয়োজনীয় লিংক' : 'Quick Links'}
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  onClick={() => onNavigate('register')}
                  className="hover:text-emerald-400 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <ArrowUpRight className="w-3 h-3 text-emerald-500" />
                  <span>{t.navRegister}</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('find-ticket')}
                  className="hover:text-emerald-400 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <ArrowUpRight className="w-3 h-3 text-emerald-500" />
                  <span>{t.navFindTicket}</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('donate')}
                  className="hover:text-emerald-400 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <ArrowUpRight className="w-3 h-3 text-emerald-500" />
                  <span>{t.navDonate}</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('notices')}
                  className="hover:text-emerald-400 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <ArrowUpRight className="w-3 h-3 text-emerald-500" />
                  <span>{t.navNotices}</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('gallery')}
                  className="hover:text-emerald-400 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <ArrowUpRight className="w-3 h-3 text-emerald-500" />
                  <span>{t.navGallery}</span>
                </button>
              </li>
            </ul>
          </div>

          {/* Col 3: Event Portals */}
          <div>
            <h4 className="text-white font-semibold text-sm uppercase tracking-wider mb-4 border-l-2 border-amber-500 pl-2">
              {language === 'bn' ? 'অপারেশনাল পোর্টাল' : 'Event Operations'}
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  onClick={() => onNavigate('portal')}
                  className="flex items-center justify-between px-3 py-2 rounded-lg bg-emerald-950/90 hover:bg-emerald-900 border border-emerald-600/70 text-emerald-100 w-full transition-all cursor-pointer group shadow-xs"
                  title="Central Organizing Committee RMS Portal"
                >
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                    <span className="font-bold">
                      {language === 'bn' ? 'আরএমএস ইআরপি পোর্টাল' : 'RMS Management ERP'}
                    </span>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-800 text-emerald-200 font-mono font-bold">
                    2027
                  </span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('scanner')}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-amber-300 w-full transition-colors cursor-pointer"
                >
                  <QrCode className="w-4 h-4" />
                  <span>{t.navScannerPortal}</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('admin')}
                  className="flex items-center justify-between px-3 py-2 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700/60 text-emerald-200 w-full transition-all cursor-pointer group shadow-xs"
                  title="Exclusive Administrator Access (Single Slot / Supabase Command)"
                >
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-amber-400 group-hover:text-amber-300" />
                    <span className="font-bold">
                      {language === 'bn' ? 'অ্যাডমিন সাইন-আপ / লগইন' : 'Admin Sign-up / Login'}
                    </span>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-800 text-amber-300 font-mono font-bold">
                    Single Slot
                  </span>
                </button>
              </li>
            </ul>

            <div className="mt-4 p-3 rounded-lg bg-slate-800/60 border border-slate-700/50 text-[11px] text-slate-400">
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
            <h4 className="text-white font-semibold text-sm uppercase tracking-wider mb-4 border-l-2 border-teal-500 pl-2">
              {t.helpdeskTitle}
            </h4>
            <div className="space-y-2.5 text-xs text-slate-300">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>{t.addressText}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{t.helplinePhone}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>{t.helplineEmail}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            © 2026 {t.institutionName}.{' '}
            {language === 'bn' ? 'সর্বস্বত্ব সংরক্ষিত।' : 'All Rights Reserved.'}
          </div>

          {/* Admin link in bottom bar */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => onNavigate('admin')}
              className="text-slate-400 hover:text-amber-400 flex items-center gap-1.5 transition-colors cursor-pointer text-xs"
            >
              <Key className="w-3.5 h-3.5 text-amber-400" />
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
