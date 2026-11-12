import { useState, useEffect } from 'react';
import {
  Calendar,
  MapPin,
  ArrowRight,
  HeartHandshake,
  CheckCircle2,
  Sparkles,
  Shirt,
  Bell,
  Camera,
  Video,
  Award,
  Clock,
  Search,
  CheckCircle,
  AlertTriangle,
  QrCode,
  FileText,
  Lock,
  Play,
  PenLine,
  Users,
  GraduationCap,
  User,
  Image as ImageIcon,
  Megaphone,
  Handshake,
  Trophy,
  X,
} from 'lucide-react';
import {
  Language,
  FeeSettings,
  RegistrationRecord,
  HomePageSectionId,
  DEFAULT_HOME_PAGE_SECTIONS,
} from '../types';
import { translations } from '../i18n/translations';
import { AppStore } from '../services/store';
import { SupabaseService } from '../services/supabase';

interface HomePageProps {
  language: Language;
  feeSettings: FeeSettings;
  onNavigate: (view: string) => void;
  onSelectTicket?: (reg: RegistrationRecord) => void;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isOver: boolean;
}

export const HomePage: React.FC<HomePageProps> = ({
  language,
  feeSettings,
  onNavigate,
  onSelectTicket,
}) => {
  const t = translations[language];
  const registrations = AppStore.getRegistrations();
  const notices = AppStore.getNotices();
  const homePageSections = feeSettings.homePageSections?.length
    ? feeSettings.homePageSections
    : DEFAULT_HOME_PAGE_SECTIONS;

  const getHomePageSectionStyle = (sectionId: HomePageSectionId): React.CSSProperties => {
    const index = homePageSections.findIndex((section) => section.id === sectionId);
    const section = homePageSections[index];
    return {
      display: section?.visible === false ? 'none' : 'block',
      order: index < 0 ? homePageSections.length : index,
    };
  };

  const paidCount = registrations.filter((r) => r.paymentStatus === 'paid').length;
  const formerCount = registrations.filter(
    (r) => r.category === 'former' && r.paymentStatus === 'paid'
  ).length;
  const currentCount = registrations.filter(
    (r) => r.category === 'current' && r.paymentStatus === 'paid'
  ).length;

  const displayPaidCount = Math.max(paidCount, 36);
  const displayFormerCount = Math.max(formerCount, 23);
  const displayCurrentCount = Math.max(currentCount, 13);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);

  // --- 1. COUNTDOWN TIMER STATE & LOGIC ---
  const calculateTimeLeft = (): TimeLeft => {
    // If admin explicitly simulated event completion
    if (feeSettings.simulateEventCompleted) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0, isOver: true };
    }

    const targetDateStr = feeSettings.eventTargetDate || '2027-01-29T09:00:00';
    const configuredTime = new Date(targetDateStr).getTime();
    const targetTime = Number.isFinite(configuredTime)
      ? configuredTime
      : new Date('2027-01-29T09:00:00').getTime();
    const now = new Date().getTime();
    const difference = targetTime - now;

    if (difference <= 0) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0, isOver: true };
    }

    return {
      days: Math.floor(difference / (1000 * 60 * 60 * 24)),
      hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((difference / 1000 / 60) % 60),
      seconds: Math.floor((difference / 1000) % 60),
      isOver: false,
    };
  };

  const [timeLeft, setTimeLeft] = useState<TimeLeft>(calculateTimeLeft());

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);
    return () => clearInterval(timer);
  }, [feeSettings.eventTargetDate, feeSettings.simulateEventCompleted]);

  // --- 2. CHECK REGISTRATION STATUS FORM STATE & LOGIC ---
  const [searchRegId, setSearchRegId] = useState('');
  const [searchMobile, setSearchMobile] = useState('');
  const [searchAttempted, setSearchAttempted] = useState(false);
  const [foundRegistration, setFoundRegistration] = useState<RegistrationRecord | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [statusLookupError, setStatusLookupError] = useState('');

  const handleCheckStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearchAttempted(true);
    setFoundRegistration(null);
    setStatusLookupError('');

    if (!searchRegId.trim() || !searchMobile.trim()) return;

    setIsCheckingStatus(true);
    try {
      const result = await SupabaseService.lookupVerifiedTicket(
        searchRegId.trim(),
        searchMobile.trim()
      );
      if (result.registration) {
        setFoundRegistration(result.registration);
      } else {
        setStatusLookupError(result.error || t.statusNotFoundDesc);
      }
    } catch (error) {
      console.error('Registration status lookup failed:', error);
      setStatusLookupError(
        language === 'bn'
          ? 'যাচাইকরণ সেবা সাময়িকভাবে অনুপলব্ধ। পরে আবার চেষ্টা করুন।'
          : 'Verification is temporarily unavailable. Please try again later.'
      );
    } finally {
      setIsCheckingStatus(false);
    }
  };

  // Registration closed notice text
  const closedNotice =
    language === 'bn'
      ? feeSettings.closedMessageBn || t.regClosedNoticeDefault
      : feeSettings.closedMessageEn || t.regClosedNoticeDefault;

  return (
    <div className="flex flex-col gap-16 pb-16">
      {/* HERO SECTION MATCHING MOCKUP */}
      <section
        className="relative overflow-hidden min-h-[580px] lg:min-h-[660px] flex items-center pt-8 sm:pt-12 pb-24 sm:pb-32 px-4 sm:px-6 lg:px-8"
        style={getHomePageSectionStyle('hero')}
      >
        {/* Full-bleed Panoramic Campus Hero Background */}
        <div className="absolute inset-0 z-0">
          <img
            src="/assets/homepage/hero_panorama.jpg"
            alt="Police Lines High School & College, Faridpur Campus"
            className="w-full h-full object-cover object-[70%_center] sm:object-center select-none"
          />
        </div>

        {/* Sophisticated Soft Glassmorphism / Frosted Gradient Overlay on Left */}
        {/* Ensures the text has ultra-sharp contrast while gracefully revealing the Shaheed Minar and campus on the right */}
        <div className="absolute inset-0 z-1 pointer-events-none bg-gradient-to-r from-white/95 via-white/80 via-45% to-transparent hidden sm:block" />
        <div className="absolute inset-0 z-1 pointer-events-none bg-white/90 sm:hidden" />

        <div className="max-w-7xl mx-auto relative z-10 w-full">
          <div className="max-w-2xl space-y-4 sm:space-y-5 text-left">
            {/* Stylized Italic Tagline */}
            <div className="font-serif italic text-2xl sm:text-3xl text-[#0284C7] tracking-wide font-medium drop-shadow-xs">
              {language === 'bn' ? 'একবার পিএলসিয়ান, চিরকাল পিএলসিয়ান...' : 'Once a PLSian, Always a PLSian...'}
            </div>

            {/* Institution Title */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-[#0F172A] tracking-tight leading-tight drop-shadow-xs">
              {language === 'bn'
                ? 'পুলিশ লাইন্স উচ্চ বিদ্যালয় ও কলেজ, ফরিদপুর'
                : 'Police Lines High School & College, Faridpur'}
            </h1>

            {/* Deep Navy Pill Badge: Grand Reunion 2027 */}
            <div>
              <div className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#0F172A] text-white shadow-xl hover:shadow-2xl transition-shadow">
                <span className="text-xl sm:text-2xl md:text-3xl font-black tracking-wide">
                  {language === 'bn' ? 'গ্র্যান্ড রিইউনিয়ন' : 'Grand Reunion'}{' '}
                  <span className="text-[#38BDF8]">2027</span>
                </span>
              </div>
            </div>

            {/* Subtitle / Invitation */}
            <p className="italic text-slate-700 text-sm sm:text-base font-normal leading-relaxed max-w-xl">
              {language === 'bn'
                ? 'আসুন আমরা সবাই মিলে শৈশবের স্মৃতি রোমন্থন করি, আমাদের বন্ধনকে উদযাপন করি এবং নতুন সম্পর্কের মেলবন্ধন গড়ি!'
                : "Let's come together to relive our memories, celebrate our bond and build new connections!"}
            </p>

            {/* Date & Venue Pills */}
            <div className="flex flex-wrap items-center gap-3 pt-1 text-xs sm:text-sm font-semibold text-[#0F172A]">
              <div className="flex items-center gap-2 bg-[#E2EEF8]/90 backdrop-blur-md px-4 py-2 rounded-full border border-[#0284C7]/20 shadow-xs">
                <Calendar className="w-4 h-4 text-[#0284C7]" />
                <span>
                  <strong className="text-[#0284C7] font-bold">{language === 'bn' ? 'তারিখ:' : 'Date:'}</strong>{' '}
                  {language === 'bn' ? '২৮ - ২৯ জানুয়ারি, ২০২৭' : 'January 28 - 29, 2027'}
                </span>
              </div>
              <div className="flex items-center gap-2 bg-[#E2EEF8]/90 backdrop-blur-md px-4 py-2 rounded-full border border-[#0284C7]/20 shadow-xs">
                <MapPin className="w-4 h-4 text-[#0284C7]" />
                <span>
                  <strong className="text-[#0284C7] font-bold">{language === 'bn' ? 'স্থান:' : 'Venue:'}</strong>{' '}
                  {language === 'bn' ? 'স্কুল ক্যাম্পাস, বড় মাঠ, ফরিদপুর' : 'School Campus, Large Field, Faridpur'}
                </span>
              </div>
            </div>

            {/* Registration Closed Banner if applicable */}
            {!feeSettings.registrationOpen && (
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs sm:text-sm shadow-xs">
                <div className="flex items-center gap-2 font-bold mb-1 text-amber-800">
                  <AlertTriangle className="w-4 h-4" />
                  <span>{language === 'bn' ? 'জরুরি প্রশাসনিক বিজ্ঞপ্তি' : 'Official Notice'}</span>
                </div>
                <p>{closedNotice}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              {feeSettings.registrationOpen ? (
                <button
                  onClick={() => onNavigate('register')}
                  className="px-7 py-3.5 rounded-full bg-[#0284C7] hover:bg-[#0EA5E9] text-white font-black text-sm sm:text-base shadow-lg shadow-sky-600/30 hover:shadow-xl transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer flex items-center gap-2 group"
                >
                  <PenLine className="w-4 h-4 text-white" />
                  <span>{language === 'bn' ? 'নিবন্ধন করুন' : 'Register Now'}</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              ) : (
                <button
                  disabled
                  className="px-7 py-3.5 rounded-full bg-slate-800 text-slate-400 font-bold text-sm sm:text-base border border-slate-700 cursor-not-allowed flex items-center gap-2 opacity-80"
                >
                  <Lock className="w-4 h-4 text-slate-500" />
                  <span>{t.btnRegistrationClosed}</span>
                </button>
              )}

              <button
                onClick={() => onNavigate('donate')}
                className="px-6 py-3.5 rounded-full bg-[#E2EEF8] hover:bg-white text-[#0F172A] border border-[#0284C7]/30 font-bold text-sm sm:text-base shadow-xs hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer flex items-center gap-2"
              >
                <HeartHandshake className="w-4 h-4 text-[#0284C7]" />
                <span>{language === 'bn' ? 'অনুদান / সহায়তা' : 'Contribute / Donate'}</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* FLOATING STATS BAR */}
      <div className="-mt-12 sm:-mt-16 relative z-25 max-w-5xl mx-auto px-4 sm:px-6 w-full">
        <div className="bg-white rounded-3xl shadow-xl border border-[#E2EEF8] px-6 py-5 grid grid-cols-2 md:grid-cols-4 gap-4 divide-y md:divide-y-0 md:divide-x divide-[#E2EEF8] text-center">
          {/* Stat 1: Total Registered */}
          <div className="flex items-center justify-center gap-3 pt-2 md:pt-0">
            <div className="w-10 h-10 rounded-full bg-[#E2EEF8] flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-[#0284C7]" />
            </div>
            <div className="text-left">
              <div className="text-2xl sm:text-3xl font-black text-[#0F172A] leading-tight">
                {displayPaidCount}
              </div>
              <div className="text-xs text-slate-600 font-semibold">
                {language === 'bn' ? 'মোট নিবন্ধিত' : 'Total Registered'}
              </div>
            </div>
          </div>

          {/* Stat 2: Former Students */}
          <div className="flex items-center justify-center gap-3 pt-2 md:pt-0">
            <div className="w-10 h-10 rounded-full bg-[#E2EEF8] flex items-center justify-center shrink-0">
              <GraduationCap className="w-5 h-5 text-[#0284C7]" />
            </div>
            <div className="text-left">
              <div className="text-2xl sm:text-3xl font-black text-[#0F172A] leading-tight">
                {displayFormerCount}
              </div>
              <div className="text-xs text-slate-600 font-semibold">
                {language === 'bn' ? 'প্রাক্তন শিক্ষার্থী' : 'Former Students'}
              </div>
            </div>
          </div>

          {/* Stat 3: Current Students */}
          <div className="flex items-center justify-center gap-3 pt-2 md:pt-0">
            <div className="w-10 h-10 rounded-full bg-[#E2EEF8] flex items-center justify-center shrink-0">
              <User className="w-5 h-5 text-[#0284C7]" />
            </div>
            <div className="text-left">
              <div className="text-2xl sm:text-3xl font-black text-[#0F172A] leading-tight">
                {displayCurrentCount}
              </div>
              <div className="text-xs text-slate-600 font-semibold">
                {language === 'bn' ? 'বর্তমান শিক্ষার্থী' : 'Current Students'}
              </div>
            </div>
          </div>

          {/* Stat 4: Batches Represented */}
          <div className="flex items-center justify-center gap-3 pt-2 md:pt-0">
            <div className="w-10 h-10 rounded-full bg-[#E2EEF8] flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-[#0284C7]" />
            </div>
            <div className="text-left">
              <div className="text-2xl sm:text-3xl font-black text-[#0F172A] leading-tight">
                50+
              </div>
              <div className="text-xs text-slate-600 font-semibold">
                {language === 'bn' ? 'ব্যাচ প্রতিনিধিত্বকারী' : 'Batches Represented'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* THREE MAIN FEATURE CARDS */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 w-full -mt-6">
        {/* Soft Decorative Botanical Leaves on Left & Right Margins (matching mockup) */}
        <div className="hidden 2xl:block absolute -left-6 top-1/2 -translate-y-1/2 pointer-events-none opacity-45 text-sky-400">
          <svg width="120" height="220" viewBox="0 0 120 220" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 210 C35 150, 45 90, 95 15" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M28 170 C40 152, 62 158, 55 174 C48 180, 35 178, 28 170 Z" fill="currentColor" opacity="0.8" />
            <path d="M40 125 C54 106, 76 112, 70 130 C63 136, 48 133, 40 125 Z" fill="currentColor" opacity="0.8" />
            <path d="M58 80 C74 60, 96 66, 90 84 C83 90, 68 87, 58 80 Z" fill="currentColor" opacity="0.8" />
            <path d="M75 35 C88 18, 108 24, 102 40 C97 45, 82 43, 75 35 Z" fill="currentColor" opacity="0.8" />
          </svg>
        </div>

        <div className="hidden 2xl:block absolute -right-6 top-1/2 -translate-y-1/2 pointer-events-none opacity-45 text-sky-400 transform -scale-x-100">
          <svg width="120" height="220" viewBox="0 0 120 220" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 210 C35 150, 45 90, 95 15" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M28 170 C40 152, 62 158, 55 174 C48 180, 35 178, 28 170 Z" fill="currentColor" opacity="0.8" />
            <path d="M40 125 C54 106, 76 112, 70 130 C63 136, 48 133, 40 125 Z" fill="currentColor" opacity="0.8" />
            <path d="M58 80 C74 60, 96 66, 90 84 C83 90, 68 87, 58 80 Z" fill="currentColor" opacity="0.8" />
            <path d="M75 35 C88 18, 108 24, 102 40 C97 45, 82 43, 75 35 Z" fill="currentColor" opacity="0.8" />
          </svg>
        </div>

        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Latest Notices */}
          <div className="bg-white rounded-2xl shadow-md border border-[#E2EEF8] overflow-hidden flex flex-col">
            <div className="bg-[#0F172A] text-white px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-sm sm:text-base">
                <Megaphone className="w-4 h-4 text-[#38BDF8]" />
                <span>{language === 'bn' ? 'সর্বশেষ নোটিশ' : 'Latest Notices'}</span>
              </div>
              <button
                onClick={() => onNavigate('notices')}
                className="text-xs text-[#38BDF8] hover:text-white font-medium flex items-center gap-1 transition-colors cursor-pointer"
              >
                <span>{language === 'bn' ? 'সবগুলো দেখুন' : 'View All'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="p-4 space-y-3 flex-1 flex flex-col justify-around">
              <div
                onClick={() => onNavigate('notices')}
                className="flex items-start gap-3 p-2 rounded-xl hover:bg-[#E2EEF8]/60 transition-colors cursor-pointer group"
              >
                <div className="bg-[#E2EEF8] text-[#0284C7] font-bold text-[10px] sm:text-xs px-2.5 py-1.5 rounded-lg text-center shrink-0 leading-tight">
                  <div>Nov</div>
                  <div className="text-sm">15</div>
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-xs sm:text-sm text-[#0F172A] group-hover:text-[#0284C7] transition-colors truncate">
                    {language === 'bn' ? 'রিইউনিয়ন নিবন্ধন উন্মুক্ত!' : 'Reunion Registration Open!'}
                  </div>
                  <div className="text-[11px] sm:text-xs text-slate-500 truncate">
                    {language === 'bn' ? 'ঐতিহাসিক এই আয়োজনের অংশ হোন...' : 'Be a part of this historic event...'}
                  </div>
                </div>
              </div>

              <div
                onClick={() => onNavigate('notices')}
                className="flex items-start gap-3 p-2 rounded-xl hover:bg-[#E2EEF8]/60 transition-colors cursor-pointer group"
              >
                <div className="bg-[#E2EEF8] text-[#0284C7] font-bold text-[10px] sm:text-xs px-2.5 py-1.5 rounded-lg text-center shrink-0 leading-tight">
                  <div>Nov</div>
                  <div className="text-sm">15</div>
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-xs sm:text-sm text-[#0F172A] group-hover:text-[#0284C7] transition-colors truncate">
                    {language === 'bn' ? 'পেমেন্ট গেটওয়ে সক্রিয় হয়েছে' : 'Payment Gateway is Live'}
                  </div>
                  <div className="text-[11px] sm:text-xs text-slate-500 truncate">
                    {language === 'bn' ? 'নিরাপদে ও সহজে অনলাইনে ফি পরিশোধ করুন...' : 'Now you can pay securely online...'}
                  </div>
                </div>
              </div>

              <div
                onClick={() => onNavigate('notices')}
                className="flex items-start gap-3 p-2 rounded-xl hover:bg-[#E2EEF8]/60 transition-colors cursor-pointer group"
              >
                <div className="bg-[#E2EEF8] text-[#0284C7] font-bold text-[10px] sm:text-xs px-2.5 py-1.5 rounded-lg text-center shrink-0 leading-tight">
                  <div>Nov</div>
                  <div className="text-sm">15</div>
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-xs sm:text-sm text-[#0F172A] group-hover:text-[#0284C7] transition-colors truncate">
                    {language === 'bn' ? 'ইভেন্ট সূচি প্রকাশিত' : 'Event Schedule Released'}
                  </div>
                  <div className="text-[11px] sm:text-xs text-slate-500 truncate">
                    {language === 'bn' ? 'বিস্তারিত সময়সূচি ও আয়োজন দেখে নিন...' : 'Check the detailed program...'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Our Memories */}
          <div className="bg-white rounded-2xl shadow-md border border-[#E2EEF8] overflow-hidden flex flex-col">
            <div className="bg-[#0F172A] text-white px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-sm sm:text-base">
                <ImageIcon className="w-4 h-4 text-[#38BDF8]" />
                <span>{language === 'bn' ? 'আমাদের স্মৃতিমালা' : 'Our Memories'}</span>
              </div>
              <button
                onClick={() => onNavigate('gallery')}
                className="text-xs text-[#38BDF8] hover:text-white font-medium flex items-center gap-1 transition-colors cursor-pointer"
              >
                <span>{language === 'bn' ? 'গ্যালারি দেখুন' : 'View Gallery'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="p-4 flex-1 flex items-center justify-between gap-2.5">
              <div
                onClick={() => onNavigate('gallery')}
                className="relative flex-1 aspect-square rounded-xl overflow-hidden border border-[#E2EEF8] hover:shadow-md transition-all cursor-pointer group"
              >
                <img
                  src="/assets/homepage/memory_1.jpg"
                  alt="School Campus Memory"
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
              </div>
              <div
                onClick={() => onNavigate('gallery')}
                className="relative flex-1 aspect-square rounded-xl overflow-hidden border border-[#E2EEF8] hover:shadow-md transition-all cursor-pointer group"
              >
                <img
                  src="/assets/homepage/memory_2.jpg"
                  alt="Students Group Memory"
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
              </div>
              <div
                onClick={() => onNavigate('gallery')}
                className="relative flex-1 aspect-square rounded-xl overflow-hidden border border-[#E2EEF8] hover:shadow-md transition-all cursor-pointer group"
              >
                <img
                  src="/assets/homepage/memory_3.jpg"
                  alt="School Assembly Memory"
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
              </div>
            </div>
          </div>

          {/* Card 3: Our Videos */}
          <div className="bg-white rounded-2xl shadow-md border border-[#E2EEF8] overflow-hidden flex flex-col">
            <div className="bg-[#0F172A] text-white px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-sm sm:text-base">
                <Play className="w-4 h-4 text-[#38BDF8]" />
                <span>{language === 'bn' ? 'আমাদের ভিডিও' : 'Our Videos'}</span>
              </div>
              <button
                onClick={() => setIsVideoModalOpen(true)}
                className="text-xs text-[#38BDF8] hover:text-white font-medium flex items-center gap-1 transition-colors cursor-pointer"
              >
                <span>{language === 'bn' ? 'সবগুলো দেখুন' : 'View All'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="p-4 flex-1 flex flex-col justify-center">
              <div
                onClick={() => setIsVideoModalOpen(true)}
                className="relative rounded-xl overflow-hidden shadow-xs cursor-pointer group border border-[#E2EEF8]"
              >
                <img
                  src="/assets/homepage/video_thumb.jpg"
                  alt="Reunion Promo Video"
                  className="w-full h-32 sm:h-36 object-cover group-hover:scale-105 transition-transform duration-500"
                />
                {/* Centered Play Button */}
                <div className="absolute inset-0 bg-black/30 group-hover:bg-black/20 flex items-center justify-center transition-colors">
                  <div className="w-12 h-12 rounded-full bg-white/95 text-[#0284C7] shadow-lg flex items-center justify-center pl-1 transform group-hover:scale-110 transition-transform">
                    <Play className="w-6 h-6 fill-current" />
                  </div>
                </div>
                {/* Video Info Bottom Overlay */}
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2.5 flex items-center justify-between text-white text-xs">
                  <span className="font-semibold truncate drop-shadow-xs">PLS Reunion 2027 – Official Promo</span>
                  <span className="bg-[#0F172A]/80 px-1.5 py-0.5 rounded text-[10px] font-mono shrink-0 ml-2">1:57</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BOTTOM NAVY WAVE RIBBON */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 w-full -mt-6">
        <div className="relative overflow-hidden rounded-3xl bg-[#0F172A] text-white p-6 sm:p-8 shadow-xl border border-[#0284C7]/30">
          {/* Subtle watermark illustration of campus */}
          <div className="absolute right-0 bottom-0 top-0 w-96 opacity-15 pointer-events-none overflow-hidden">
            <img
              src="/assets/id_card/campus_footer.png"
              alt="Campus Silhouette"
              className="w-full h-full object-contain object-right-bottom"
            />
          </div>

          <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-6">
            {/* Core Reunion Pillars */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 sm:gap-6 text-xs sm:text-sm font-bold text-white">
              <div className="flex items-center gap-2">
                <Handshake className="w-5 h-5 text-[#38BDF8]" />
                <span>{language === 'bn' ? 'বন্ধুদের সাথে পুনর্মিলন' : 'Reconnect with Friends'}</span>
              </div>
              <span className="hidden sm:inline text-sky-400/40 font-light">|</span>
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-[#38BDF8]" />
                <span>{language === 'bn' ? 'আমাদের ঐতিহ্য উদযাপন' : 'Celebrate Our Legacy'}</span>
              </div>
              <span className="hidden sm:inline text-sky-400/40 font-light">|</span>
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-[#38BDF8]" />
                <span>{language === 'bn' ? 'আমাদের বন্ধন সুদৃঢ়করণ' : 'Strengthen Our Bond'}</span>
              </div>
            </div>

            {/* Action CTA Button */}
            <button
              onClick={() => onNavigate('register')}
              className="px-6 py-3.5 rounded-full bg-[#0284C7] hover:bg-[#0EA5E9] text-white font-black text-xs sm:text-sm shadow-lg shadow-sky-600/30 transition-all transform hover:scale-105 active:scale-100 cursor-pointer flex items-center gap-2 shrink-0"
            >
              <span>{language === 'bn' ? 'রিইউনিয়ন যাত্রায় যোগ দিন' : 'Join the Reunion Journey'}</span>
              <ArrowRight className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      </section>

      {/* Video Modal Preview */}
      {isVideoModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full overflow-hidden shadow-2xl relative text-white">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-sm sm:text-base flex items-center gap-2">
                <Play className="w-4 h-4 text-[#fbb03b]" />
                <span>PLS Reunion 2027 – Official Promo</span>
              </h3>
              <button
                onClick={() => setIsVideoModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 sm:p-6 flex flex-col items-center justify-center">
              <div className="w-full aspect-video rounded-2xl overflow-hidden bg-black flex items-center justify-center relative">
                <img
                  src="/assets/homepage/video_thumb.jpg"
                  alt="Video Preview"
                  className="w-full h-full object-cover opacity-60"
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <div className="w-16 h-16 rounded-full bg-[#fbb03b] text-slate-950 flex items-center justify-center pl-1 shadow-xl">
                    <Play className="w-8 h-8 fill-current" />
                  </div>
                  <span className="text-xs sm:text-sm font-semibold text-slate-200">
                    {language === 'bn' ? 'অফিসিয়াল প্রোমো ভিডিও শীঘ্রই আসছে!' : 'Official Promo Video coming soon!'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2 & 3: COUNTDOWN TIMER / POST-EVENT CELEBRATION */}
      <section
        className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-4 relative z-20"
        style={getHomePageSectionStyle('countdown')}
      >
        {timeLeft.isOver ? (
          /* AFTER THE EVENT STATE */
          <div className="bg-[#172554] rounded-3xl p-8 border-2 border-[#C5A45D] shadow-2xl text-white text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#263B8C] border border-blue-400/40 text-[#C5A45D] text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-[#C5A45D]" />
              <span>{language === 'bn' ? 'ঐতিহাসিক মুহূর্ত উদযাপিত' : 'Historic Milestone Celebrated'}</span>
            </div>

            <div className="space-y-2 max-w-2xl mx-auto">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-white">
                {t.eventCompletedHeading}
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                {t.eventCompletedSubtitle}
              </p>
            </div>

            {/* Post-event action buttons */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                onClick={() => onNavigate('gallery')}
                className="px-6 py-3 rounded-xl bg-[#C5A45D] hover:bg-[#b0924e] text-slate-950 font-extrabold text-xs sm:text-sm shadow-md transition-all cursor-pointer flex items-center gap-2"
              >
                <Camera className="w-4 h-4" />
                <span>{t.btnViewEventPhotos}</span>
              </button>

              <button
                onClick={() => onNavigate('gallery')}
                className="px-6 py-3 rounded-xl bg-[#263B8C] hover:bg-[#1f3073] text-white font-bold text-xs sm:text-sm shadow-md transition-all cursor-pointer flex items-center gap-2"
              >
                <Video className="w-4 h-4" />
                <span>{t.btnWatchVideos}</span>
              </button>

              <button
                onClick={() => onNavigate('notices')}
                className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs sm:text-sm transition-all cursor-pointer flex items-center gap-2"
              >
                <FileText className="w-4 h-4 text-blue-300" />
                <span>{t.btnReadSouvenir}</span>
              </button>
            </div>
          </div>
        ) : (
          /* ACTIVE LIVE COUNTDOWN TIMER */
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#E2EEF8] shadow-xl space-y-6">
            <div className="text-center space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E2EEF8] text-xs font-bold text-[#0284C7] uppercase tracking-wider">
                <Clock className="w-4 h-4 text-[#0284C7]" />
                <span>{t.countdownHeading}</span>
              </div>
              <p className="text-xs text-slate-500">{t.countdownSubtitle}</p>
            </div>

            {/* Countdown Solid Cards */}
            <div className="grid grid-cols-4 gap-2 sm:gap-4 max-w-2xl mx-auto text-center">
              {/* Days */}
              <div className="bg-[#0F172A] text-white rounded-2xl p-3 sm:p-5 shadow-md border border-[#0284C7]/30">
                <span className="text-2xl sm:text-4xl md:text-5xl font-black text-[#38BDF8] block tabular-nums">
                  {String(timeLeft.days).padStart(2, '0')}
                </span>
                <span className="text-[10px] sm:text-xs font-bold text-[#E2EEF8] uppercase tracking-wider mt-1 block">
                  {t.daysLabel}
                </span>
              </div>

              {/* Hours */}
              <div className="bg-[#0F172A] text-white rounded-2xl p-3 sm:p-5 shadow-md border border-[#0284C7]/30">
                <span className="text-2xl sm:text-4xl md:text-5xl font-black text-[#0EA5E9] block tabular-nums">
                  {String(timeLeft.hours).padStart(2, '0')}
                </span>
                <span className="text-[10px] sm:text-xs font-bold text-[#E2EEF8] uppercase tracking-wider mt-1 block">
                  {t.hoursLabel}
                </span>
              </div>

              {/* Minutes */}
              <div className="bg-[#0F172A] text-white rounded-2xl p-3 sm:p-5 shadow-md border border-[#0284C7]/30">
                <span className="text-2xl sm:text-4xl md:text-5xl font-black text-[#38BDF8] block tabular-nums">
                  {String(timeLeft.minutes).padStart(2, '0')}
                </span>
                <span className="text-[10px] sm:text-xs font-bold text-[#E2EEF8] uppercase tracking-wider mt-1 block">
                  {t.minutesLabel}
                </span>
              </div>

              {/* Seconds */}
              <div className="bg-[#0F172A] text-white rounded-2xl p-3 sm:p-5 shadow-md border border-[#0284C7]/30">
                <span className="text-2xl sm:text-4xl md:text-5xl font-black text-[#0EA5E9] block tabular-nums">
                  {String(timeLeft.seconds).padStart(2, '0')}
                </span>
                <span className="text-[10px] sm:text-xs font-bold text-[#E2EEF8] uppercase tracking-wider mt-1 block">
                  {t.secondsLabel}
                </span>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* SECTION 4: CHECK REGISTRATION STATUS & TICKET WIDGET */}
      <section
        id="check-status-section"
        className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8"
        style={getHomePageSectionStyle('status')}
      >
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#E2EEF8] shadow-xl space-y-6">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E2EEF8] text-[#0284C7] text-xs font-bold border border-[#0284C7]/20">
              <Search className="w-3.5 h-3.5" />
              <span>{language === 'bn' ? 'অনলাইন যাচাইকরণ সেবা' : 'Online Verification Portal'}</span>
            </div>
            <h2 className="text-2xl font-black text-[#0F172A] tracking-tight">
              {t.checkStatusHeading}
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              {t.checkStatusSubtitle}
            </p>
          </div>

          {/* Testing Credentials Banner (For quick attendee lookup testing) */}
          <div className="max-w-2xl mx-auto p-3 bg-[#E2EEF8]/70 border border-[#0284C7]/30 text-[#0F172A] rounded-2xl text-xs flex flex-wrap items-center justify-between gap-2 shadow-2xs">
            <div className="flex items-center gap-1.5 font-medium flex-wrap">
              <span className="font-bold text-[#0F172A]">🧪 Testing Credentials:</span>
              <span className="font-mono bg-white px-2 py-0.5 rounded-lg border border-[#0284C7]/20 text-[#0284C7] font-bold">PLSCF-2026-F1001</span>
              <span className="text-slate-400">/</span>
              <span className="font-mono bg-white px-2 py-0.5 rounded-lg border border-[#0284C7]/20 text-[#0284C7] font-bold">01712345678</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setSearchRegId('PLSCF-2026-F1001');
                setSearchMobile('01712345678');
              }}
              className="text-[10px] text-[#0284C7] bg-white hover:bg-[#E2EEF8] border border-[#0284C7]/30 px-3 py-1 rounded-full font-bold cursor-pointer transition-colors shadow-2xs"
            >
              Auto-fill
            </button>
          </div>

          {/* Verification Form */}
          <form onSubmit={handleCheckStatus} className="grid grid-cols-1 sm:grid-cols-5 gap-3 max-w-2xl mx-auto">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-[#0F172A] mb-1">
                {t.inputRegIdLabel}
              </label>
              <input
                type="text"
                value={searchRegId}
                onChange={(e) => setSearchRegId(e.target.value)}
                placeholder={t.inputRegIdPlaceholder}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2EEF8] text-xs sm:text-sm font-mono uppercase focus:border-[#0284C7] focus:ring-1 focus:ring-[#0284C7] focus:outline-hidden"
                required
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-[#0F172A] mb-1">
                {t.inputMobileLabel}
              </label>
              <input
                type="text"
                value={searchMobile}
                onChange={(e) => setSearchMobile(e.target.value)}
                placeholder={t.inputMobilePlaceholder}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2EEF8] text-xs sm:text-sm font-mono focus:border-[#0284C7] focus:ring-1 focus:ring-[#0284C7] focus:outline-hidden"
                required
              />
            </div>

            <div className="sm:col-span-1 flex items-end">
              <button
                type="submit"
                disabled={isCheckingStatus}
                className="w-full py-2.5 rounded-xl bg-[#0284C7] hover:bg-[#0EA5E9] disabled:opacity-60 text-white font-bold text-xs sm:text-sm shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Search className="w-4 h-4" />
                <span>{isCheckingStatus ? (language === 'bn' ? 'যাচাই হচ্ছে...' : 'Checking...') : t.btnCheckStatus}</span>
              </button>
            </div>
          </form>

          {/* RESULT CARD IF FOUND */}
          {searchAttempted && foundRegistration && (
            <div className="p-5 rounded-2xl bg-[#E2EEF8]/60 border-2 border-[#0284C7] shadow-md animate-fade-in">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <img
                    src={foundRegistration.photoUrl}
                    alt={foundRegistration.fullName}
                    className="w-16 h-16 rounded-xl object-cover border-2 border-white shadow-sm"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-[#0284C7] text-white">
                        {foundRegistration.id}
                      </span>
                      <span className="flex items-center gap-1 text-xs font-bold text-[#0284C7]">
                        <CheckCircle className="w-3.5 h-3.5 text-[#0284C7]" />
                        {t.statusFoundTitle}
                      </span>
                    </div>

                    <h4 className="font-extrabold text-[#0F172A] text-base mt-1">
                      {foundRegistration.fullName}
                    </h4>

                    <div className="text-xs text-slate-600 mt-0.5 flex flex-wrap gap-2">
                      <span>{foundRegistration.batchName}</span>
                      <span>•</span>
                      <span>{t.statusTShirtLabel} <strong className="text-[#0F172A]">{foundRegistration.tShirtSize}</strong></span>
                      <span>•</span>
                      <span>
                        {t.statusPaymentStatusLabel}{' '}
                        <strong className="text-[#0284C7] uppercase">
                          {foundRegistration.paymentStatus} (৳{foundRegistration.totalPaid})
                        </strong>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="w-full sm:w-auto pt-2 sm:pt-0">
                  <button
                    onClick={() => {
                      if (onSelectTicket) {
                        onSelectTicket(foundRegistration);
                      } else {
                        onNavigate('find-ticket');
                      }
                    }}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#0284C7] hover:bg-[#0EA5E9] text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <QrCode className="w-4 h-4" />
                    <span>{t.btnOpenTicketDirect}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* RESULT ALERT IF NOT FOUND */}
          {searchAttempted && !foundRegistration && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-300 text-rose-900 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="font-bold text-xs sm:text-sm text-rose-800">
                  {t.statusNotFoundTitle}
                </h4>
                <p className="text-xs text-rose-700">
                  {statusLookupError || t.statusNotFoundDesc}
                </p>
                <div className="pt-2">
                  <button
                    onClick={() => onNavigate('register')}
                    className="text-xs font-bold text-rose-800 underline hover:text-rose-950 cursor-pointer"
                  >
                    {language === 'bn' ? 'নতুন শিক্ষার্থী নিবন্ধন করুন →' : 'Register as New Attendee →'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* REGISTRATION FEE INFORMATION */}
      <section
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
        style={getHomePageSectionStyle('fees')}
      >
        <div className="text-center max-w-2xl mx-auto mb-10 space-y-2">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {t.feeTitle}
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">
            {language === 'bn'
              ? 'সকল সাবেক ও বর্তমান শিক্ষার্থীদের জন্য নির্ধারিত সহজ নিবন্ধন ব্যবস্থা।'
              : 'Transparent, categorized registration fees for former alumni and current students.'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Former Student Card */}
          <div className="bg-white rounded-3xl p-8 border-2 border-emerald-600 shadow-xl relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 right-0 bg-emerald-600 text-white text-[10px] font-black uppercase px-4 py-1 rounded-bl-xl tracking-wider">
              {language === 'bn' ? 'অ্যালামনাই ক্যাটাগরি' : 'Alumni'}
            </div>

            <div className="space-y-4">
              <div>
                <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider block">
                  {t.feeFormerTitle}
                </span>
                <h3 className="text-3xl font-black text-slate-900 mt-1">
                  ৳ {feeSettings.formerStudentFee} BDT
                </h3>
                <p className="text-xs text-slate-500 mt-1">{t.feeFormerSubtitle}</p>
              </div>

              <div className="space-y-2.5 text-xs text-slate-700 pt-4 border-t border-slate-100">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{t.feeFormerIncludes}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Shirt className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    {language === 'bn' ? 'কাস্টম সাইজ টি-শার্ট অন্তর্ভুক্ত' : 'T-shirt Included (S-XXXL)'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    {language === 'bn' ? '৬৪ বছর পূর্তি স্মারক স্মরণিকা' : 'Anniversary Souvenir Magazine'}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-8">
              {feeSettings.registrationOpen ? (
                <button
                  onClick={() => onNavigate('register')}
                  className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>{language === 'bn' ? 'প্রাক্তন শিক্ষার্থী নিবন্ধন' : 'Register as Alumni'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  disabled
                  className="w-full py-3.5 rounded-xl bg-slate-200 text-slate-500 font-bold text-sm cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Lock className="w-4 h-4" />
                  <span>{t.btnRegistrationClosed}</span>
                </button>
              )}
            </div>
          </div>

          {/* Current Student Card */}
          <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-lg relative overflow-hidden flex flex-col justify-between">
            <div className="space-y-4">
              <div>
                <span className="text-xs font-bold text-teal-700 uppercase tracking-wider block">
                  {t.feeCurrentTitle}
                </span>
                <h3 className="text-3xl font-black text-slate-900 mt-1">
                  ৳ {feeSettings.currentStudentFee} BDT
                </h3>
                <p className="text-xs text-slate-500 mt-1">{t.feeCurrentSubtitle}</p>
              </div>

              <div className="space-y-2.5 text-xs text-slate-700 pt-4 border-t border-slate-100">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                  <span>{t.feeCurrentIncludes}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Shirt className="w-4 h-4 text-teal-600 shrink-0" />
                  <span>
                    {language === 'bn' ? 'পুনর্মিলনী টি-শার্ট অন্তর্ভুক্ত' : 'Reunion T-shirt Included'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-teal-600 shrink-0" />
                  <span>
                    {language === 'bn' ? 'বিশেষ ছাত্র মধ্যাহ্নভোজ ও কনসার্ট' : 'Student Banquet & Live Concert'}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-8">
              {feeSettings.registrationOpen ? (
                <button
                  onClick={() => onNavigate('register')}
                  className="w-full py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>{language === 'bn' ? 'বর্তমান শিক্ষার্থী নিবন্ধন' : 'Register as Current Student'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  disabled
                  className="w-full py-3.5 rounded-xl bg-slate-200 text-slate-500 font-bold text-sm cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Lock className="w-4 h-4" />
                  <span>{t.btnRegistrationClosed}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* LATEST NOTICES PREVIEW */}
      <section
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
        style={getHomePageSectionStyle('notices')}
      >
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-emerald-600" />
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                {t.noticesHeading}
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">{t.noticesSubtitle}</p>
          </div>

          <button
            onClick={() => onNavigate('notices')}
            className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
          >
            <span>{language === 'bn' ? 'সকল নোটিশ দেখুন' : 'View All Notices'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {notices.slice(0, 3).map((notice) => (
            <div
              key={notice.id}
              className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="px-2.5 py-0.5 rounded-full font-bold uppercase bg-emerald-100 text-emerald-800">
                    {notice.category}
                  </span>
                  <span className="text-slate-400">{notice.date}</span>
                </div>
                <h3 className="font-bold text-slate-900 text-sm leading-snug">
                  {language === 'bn' ? notice.titleBn : notice.titleEn}
                </h3>
                <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                  {language === 'bn' ? notice.contentBn : notice.contentEn}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <button
                  onClick={() => onNavigate('notices')}
                  className="text-xs font-semibold text-emerald-700 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>{language === 'bn' ? 'বিস্তারিত পড়ুন' : 'Read Notice'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* PHOTO & VIDEO PREVIEW */}
      <section
        className="bg-slate-900 text-white py-16 px-4 sm:px-6 lg:px-8"
        style={getHomePageSectionStyle('gallery')}
      >
        <div className="max-w-7xl mx-auto space-y-10">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">
                {language === 'bn' ? 'স্মৃতি আর্কাইভ' : 'Historical Archive'}
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-white mt-1">
                {t.galleryHeading}
              </h2>
            </div>

            <button
              onClick={() => onNavigate('gallery')}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition-colors cursor-pointer"
            >
              {language === 'bn' ? 'সম্পূর্ণ গ্যালারি দেখুন' : 'Explore Full Archive'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                title: 'Campus Heritage 1962',
                year: '1962-1975',
                img: 'https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?w=500&auto=format&fit=crop&q=80',
              },
              {
                title: 'Golden Jubilee Alumni',
                year: '1985-2000',
                img: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=500&auto=format&fit=crop&q=80',
              },
              {
                title: 'Science Fair & Lab',
                year: '2005-2015',
                img: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=500&auto=format&fit=crop&q=80',
              },
              {
                title: 'Cultural Gala & Band Show',
                year: '2018-2024',
                img: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=80',
              },
            ].map((item, idx) => (
              <div
                key={idx}
                onClick={() => onNavigate('gallery')}
                className="group relative rounded-2xl overflow-hidden aspect-4/3 cursor-pointer shadow-lg"
              >
                <img
                  src={item.img}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-x-0 bottom-0 bg-[#172554]/90 p-3 flex flex-col justify-end border-t border-[#C5A45D]/40">
                  <span className="text-[10px] font-bold text-[#C5A45D] uppercase tracking-wider">
                    {item.year}
                  </span>
                  <h4 className="font-bold text-white text-sm">{item.title}</h4>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ORGANIZING COMMITTEE */}
      <section
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
        style={getHomePageSectionStyle('committee')}
      >
        <div className="text-center max-w-2xl mx-auto mb-10 space-y-2">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {t.committeeHeading}
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">
            {language === 'bn'
              ? 'জেলা পুলিশ প্রশাসন ও অ্যালামনাই নেতৃবৃন্দের সমন্বয়ে গঠিত পরিচালনা পর্ষদ।'
              : 'Joint organizing leadership by District Police Administration and Senior Alumni.'}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              name: 'Dr. M. A. Kashem',
              role: 'Convenor (আহ্বায়ক)',
              desc: '1974 SSC Batch • Senior Civil Servant',
              img: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300&auto=format&fit=crop&q=80',
            },
            {
              name: 'Superintendent of Police',
              role: 'Chief Patron (প্রধান পৃষ্ঠপোষক)',
              desc: 'Faridpur District Police Administration',
              img: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=300&auto=format&fit=crop&q=80',
            },
            {
              name: 'Prof. Anwara Begum',
              role: 'Faculty Advisor (উপদেষ্টা)',
              desc: 'Former Principal, Police Lines College',
              img: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=300&auto=format&fit=crop&q=80',
            },
            {
              name: 'Md. Shafiqul Alam',
              role: 'Member Secretary (সদস্য সচিব)',
              desc: '1988 SSC Batch • Alumni Association',
              img: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80',
            },
          ].map((member, idx) => (
            <div key={idx} className="bg-white rounded-2xl p-6 border border-slate-200 text-center shadow-xs space-y-3">
              <img
                src={member.img}
                alt={member.name}
                className="w-20 h-20 rounded-full object-cover mx-auto border-2 border-emerald-600 shadow-sm"
              />
              <div>
                <h4 className="font-bold text-slate-900 text-sm">{member.name}</h4>
                <span className="text-xs font-semibold text-emerald-700 block mt-0.5">
                  {member.role}
                </span>
                <p className="text-[11px] text-slate-500 mt-1">{member.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
