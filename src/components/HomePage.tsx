import { useState, useEffect, useMemo } from 'react';
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
  RefreshCw,
} from 'lucide-react';
import {
  Language,
  FeeSettings,
  GovernanceLoadStatus,
  RegistrationRecord,
  DonationRecord,
  HomePageSectionId,
  HomePageSectionSetting,
  reconcileHomePageSections,
} from '../types';
import { translations } from '../i18n/translations';
import { AppStore } from '../services/store';
import { SupabaseService, isDevTestBypassAllowed } from '../services/supabase';
import { ReunionStatsService, ReunionStatsSnapshot } from '../services/reunionStatsService';
import { FinancialTransparencyDashboard } from './financials/FinancialTransparencyDashboard';
import { ThankYouCardModal } from './ThankYouCardModal';
import { CommitteeSection } from './committee/CommitteeSection';
import { GovernanceClosureNoticeCard } from './common/GovernanceClosureNoticeCard';
import {
  isGlobalRegistrationOpen,
  isAlumniRegistrationOpen,
  isCurrentStudentRegistrationOpen,
  isDonationOpen,
  getStructuredClosureNotice,
} from '../utils/rules';

interface HomePageProps {
  language: Language;
  feeSettings: FeeSettings;
  onNavigate: (view: string, replace?: boolean, extraParams?: Record<string, string>) => void;
  onSelectTicket?: (reg: RegistrationRecord) => void;
  governanceStatus?: GovernanceLoadStatus;
  governanceError?: string | null;
  onRetryGovernance?: () => void;
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
  governanceStatus = 'ready',
  governanceError = null,
  onRetryGovernance,
}) => {
  const isGovernanceReady = governanceStatus === 'ready';
  const t = translations[language];
  const notices = AppStore.getNotices();
  const homePageSections = useMemo(
    () => reconcileHomePageSections(feeSettings.homePageSections),
    [feeSettings.homePageSections]
  );

  const getHomePageSectionStyle = (sectionId: HomePageSectionId): React.CSSProperties => {
    const index = homePageSections.findIndex((section: HomePageSectionSetting) => section.id === sectionId);
    const section = homePageSections[index];
    return {
      display: section?.visible === false ? 'none' : 'block',
      order: index < 0 ? homePageSections.length : index,
    };
  };

  const [statsSnapshot, setStatsSnapshot] = useState<ReunionStatsSnapshot>(() =>
    ReunionStatsService.getSnapshot()
  );

  useEffect(() => {
    const unsubStats = ReunionStatsService.subscribe((snap) => {
      setStatsSnapshot(snap);
    });
    const cleanupStatsSync = ReunionStatsService.initLiveSync();
    return () => {
      unsubStats();
      cleanupStatsSync();
    };
  }, []);

  const formatStatCount = (val?: number): string => {
    if (statsSnapshot.status === 'loading') return '...';
    if (statsSnapshot.status === 'error' || typeof val !== 'number') return '—';
    return val.toLocaleString();
  };

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
  const [foundDonation, setFoundDonation] = useState<DonationRecord | null>(null);
  const [selectedCardDonation, setSelectedCardDonation] = useState<DonationRecord | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [statusLookupError, setStatusLookupError] = useState('');

  const handleCheckStatus = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setSearchAttempted(true);
    setFoundRegistration(null);
    setFoundDonation(null);
    setStatusLookupError('');

    if (!searchRegId.trim() && !searchMobile.trim()) {
      setStatusLookupError(
        language === 'bn'
          ? 'অনুগ্রহ করে নিবন্ধিত মোবাইল নম্বর অথবা রেজিস্ট্রেশন আইডি দিন।'
          : 'Please enter your Registered Mobile Number OR Registration ID.'
      );
      return;
    }

    setIsCheckingStatus(true);
    try {
      const result = await SupabaseService.lookupVerifiedTicket(
        searchRegId.trim(),
        searchMobile.trim()
      );
      if (result.type === 'donation' && result.donation) {
        setFoundDonation(result.donation);
      } else if (result.registration) {
        setFoundRegistration(result.registration);
      } else if (result.donation) {
        setFoundDonation(result.donation);
      } else {
        setStatusLookupError(result.error || t.statusNotFoundDesc);
      }
    } catch (error) {
      console.error('Registration/Donation status lookup failed:', error);
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
  const globalClosedNotice = getStructuredClosureNotice(feeSettings, 'global', language);
  const closedNotice = globalClosedNotice.message;

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
            alt="Police Lines School and College, Faridpur Campus"
            className="w-full h-full object-cover object-[70%_center] sm:object-center select-none"
            fetchPriority="high"
            decoding="async"
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
                ? 'পুলিশ লাইনস স্কুল অ্যান্ড কলেজ, ফরিদপুর'
                : 'Police Lines School and College, Faridpur'}
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
            {isGovernanceReady && !isGlobalRegistrationOpen(feeSettings) && (
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs sm:text-sm shadow-xs">
                <div className="flex items-center gap-2 font-bold mb-1 text-amber-800">
                  <AlertTriangle className="w-4 h-4" />
                  <span>{globalClosedNotice.title}</span>
                </div>
                <p>{closedNotice}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              {isGovernanceReady && isGlobalRegistrationOpen(feeSettings) && (
                <button
                  onClick={() => onNavigate('register')}
                  className="px-7 py-3.5 rounded-full bg-[#0284C7] hover:bg-[#0EA5E9] text-white font-black text-sm sm:text-base shadow-lg shadow-sky-600/30 hover:shadow-xl transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer flex items-center gap-2 group"
                >
                  <PenLine className="w-4 h-4 text-white" />
                  <span>{language === 'bn' ? 'নিবন্ধন করুন' : 'Register Now'}</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              )}

              {isGovernanceReady && (
                <button
                  onClick={() => onNavigate('donate')}
                  className="px-6 py-3.5 rounded-full bg-[#E2EEF8] hover:bg-white text-[#0F172A] border border-[#0284C7]/30 font-bold text-sm sm:text-base shadow-xs hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer flex items-center gap-2"
                >
                  <HeartHandshake className="w-4 h-4 text-[#0284C7]" />
                  <span>{language === 'bn' ? 'অনুদান / সহায়তা' : 'Contribute / Donate'}</span>
                  {!isDonationOpen(feeSettings) && (
                    <span className="ml-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-black uppercase">
                      {language === 'bn' ? 'বন্ধ' : 'Closed'}
                    </span>
                  )}
                </button>
              )}
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
              <div data-testid="stat-total-registered" className="text-2xl sm:text-3xl font-black text-[#0F172A] leading-tight tabular-nums">
                {formatStatCount(statsSnapshot.stats?.totalRegistered)}
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
              <div data-testid="stat-former-students" className="text-2xl sm:text-3xl font-black text-[#0F172A] leading-tight tabular-nums">
                {formatStatCount(statsSnapshot.stats?.formerStudents)}
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
              <div data-testid="stat-current-students" className="text-2xl sm:text-3xl font-black text-[#0F172A] leading-tight tabular-nums">
                {formatStatCount(statsSnapshot.stats?.currentStudents)}
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
              <div data-testid="stat-batches-represented" className="text-2xl sm:text-3xl font-black text-[#0F172A] leading-tight tabular-nums">
                {formatStatCount(statsSnapshot.stats?.batchesRepresented)}
              </div>
              <div className="text-xs text-slate-600 font-semibold">
                {language === 'bn' ? 'ব্যাচ প্রতিনিধিত্বকারী' : 'Batches Represented'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* THREE MAIN FEATURE CARDS */}
      <section
        className="max-w-6xl mx-auto px-4 sm:px-6 w-full -mt-6"
        style={getHomePageSectionStyle('featureCards')}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                
            loading="lazy"
            decoding="async"/>
              </div>
              <div
                onClick={() => onNavigate('gallery')}
                className="relative flex-1 aspect-square rounded-xl overflow-hidden border border-[#E2EEF8] hover:shadow-md transition-all cursor-pointer group"
              >
                <img
                  src="/assets/homepage/memory_2.jpg"
                  alt="Students Group Memory"
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                
            loading="lazy"
            decoding="async"/>
              </div>
              <div
                onClick={() => onNavigate('gallery')}
                className="relative flex-1 aspect-square rounded-xl overflow-hidden border border-[#E2EEF8] hover:shadow-md transition-all cursor-pointer group"
              >
                <img
                  src="/assets/homepage/memory_3.jpg"
                  alt="School Assembly Memory"
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                
            loading="lazy"
            decoding="async"/>
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
            <div className="p-4 flex-1 flex items-center justify-center">
              <div
                onClick={() => setIsVideoModalOpen(true)}
                className="relative w-full rounded-xl overflow-hidden shadow-xs cursor-pointer group border border-[#E2EEF8]"
              >
                <img
                  src="/assets/homepage/video_thumb.jpg"
                  alt="Reunion Promo Video"
                  className="w-full h-36 sm:h-40 object-cover group-hover:scale-105 transition-transform duration-500"
                
            loading="lazy"
            decoding="async"/>
                {/* Perfectly Centered Play Button */}
                <div className="absolute inset-0 bg-black/35 group-hover:bg-black/25 flex items-center justify-center transition-colors">
                  <div className="w-14 h-14 rounded-full bg-white/95 text-[#0284C7] shadow-2xl flex items-center justify-center transition-all group-hover:scale-110">
                    <Play className="w-7 h-7 fill-current translate-x-0.5" />
                  </div>
                </div>
                {/* Video Info Bottom Overlay */}
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-2.5 flex items-center justify-between text-white text-xs">
                  <span className="font-semibold truncate drop-shadow-xs">PLS Reunion 2027 – Official Promo</span>
                  <span className="bg-[#0F172A]/80 px-1.5 py-0.5 rounded text-[10px] font-mono shrink-0 ml-2">1:57</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BOTTOM NAVY WAVE RIBBON */}
      <section
        className="max-w-6xl mx-auto px-4 sm:px-6 w-full -mt-6"
        style={getHomePageSectionStyle('pillarsRibbon')}
      >
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
            {isGovernanceReady && isGlobalRegistrationOpen(feeSettings) && (
              <button
                onClick={() => onNavigate('register')}
                className="px-6 py-3.5 rounded-full bg-[#0284C7] hover:bg-[#0EA5E9] text-white font-black text-xs sm:text-sm shadow-lg shadow-sky-600/30 transition-all transform hover:scale-105 active:scale-100 cursor-pointer flex items-center gap-2 shrink-0"
              >
                <span>{language === 'bn' ? 'রিইউনিয়ন যাত্রায় যোগ দিন' : 'Join the Reunion Journey'}</span>
                <ArrowRight className="w-4 h-4 text-white" />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Video Modal Preview */}
      {isVideoModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="video-modal-title"
        >
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full overflow-hidden shadow-2xl relative text-white">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h2 id="video-modal-title" className="font-bold text-sm sm:text-base flex items-center gap-2">
                <Play className="w-4 h-4 text-[#fbb03b]" />
                <span>PLS Reunion 2027 – Official Promo</span>
              </h2>
              <button
                onClick={() => setIsVideoModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
                aria-label="Close video modal"
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
                
            loading="lazy"
            decoding="async"/>
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
          <div className="bg-[#0F172A] rounded-3xl p-8 border border-[#0284C7]/40 shadow-2xl text-white text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#0284C7]/20 border border-[#38BDF8]/40 text-[#38BDF8] text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-[#38BDF8]" />
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
                className="px-6 py-3 rounded-full bg-[#0284C7] hover:bg-[#0EA5E9] text-white font-extrabold text-xs sm:text-sm shadow-md transition-all cursor-pointer flex items-center gap-2"
              >
                <Camera className="w-4 h-4" />
                <span>{t.btnViewEventPhotos}</span>
              </button>

              <button
                onClick={() => onNavigate('gallery')}
                className="px-6 py-3 rounded-full bg-[#0F172A] hover:bg-slate-800 text-white border border-slate-700 font-bold text-xs sm:text-sm shadow-md transition-all cursor-pointer flex items-center gap-2"
              >
                <Video className="w-4 h-4" />
                <span>{t.btnWatchVideos}</span>
              </button>

              <button
                onClick={() => onNavigate('notices')}
                className="px-6 py-3 rounded-full bg-[#E2EEF8] hover:bg-white text-[#0F172A] border border-[#0284C7]/30 font-semibold text-xs sm:text-sm transition-all cursor-pointer flex items-center gap-2"
              >
                <FileText className="w-4 h-4 text-[#0284C7]" />
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

          {/* Testing Credentials Banner (Development only) */}
          {isDevTestBypassAllowed() && (
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
          )}

          {/* Verification Form */}
          <form onSubmit={handleCheckStatus} className="grid grid-cols-1 sm:grid-cols-5 gap-3 max-w-2xl mx-auto">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-[#0F172A] mb-1">
                {language === 'bn' ? 'নিবন্ধিত মোবাইল নম্বর' : 'Registered Mobile Number'}
                <span className="text-[10px] text-sky-600 font-semibold ml-1">
                  ({language === 'bn' ? 'যথেষ্ট' : 'Enough'})
                </span>
              </label>
              <input
                type="text"
                value={searchMobile}
                onChange={(e) => setSearchMobile(e.target.value)}
                placeholder={t.inputMobilePlaceholder}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2EEF8] text-xs sm:text-sm font-mono focus:border-[#0284C7] focus:ring-1 focus:ring-[#0284C7] focus:outline-hidden"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-[#0F172A] mb-1">
                {language === 'bn' ? 'অথবা রেজিস্ট্রেশন আইডি / টোকেন' : 'OR Reg ID / Token'}
              </label>
              <input
                type="text"
                value={searchRegId}
                onChange={(e) => setSearchRegId(e.target.value)}
                placeholder={t.inputRegIdPlaceholder}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2EEF8] text-xs sm:text-sm font-mono uppercase focus:border-[#0284C7] focus:ring-1 focus:ring-[#0284C7] focus:outline-hidden"
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

          {/* RESULT CARD IF FOUND (STUDENT REGISTRATION) */}
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

          {/* RESULT CARD IF FOUND (PATRON / DONATION) */}
          {searchAttempted && foundDonation && (
            <div className="p-5 rounded-2xl bg-amber-50/80 border-2 border-amber-500 shadow-md animate-fade-in">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-amber-500/20 text-amber-700 border-2 border-amber-400 flex items-center justify-center shrink-0 shadow-inner">
                    <Award className="w-8 h-8" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-amber-600 text-white">
                        {foundDonation.id}
                      </span>
                      <span className="flex items-center gap-1 text-xs font-bold text-amber-800">
                        <CheckCircle className="w-3.5 h-3.5 text-amber-700" />
                        {language === 'bn' ? 'যাচাইকৃত অনুদাতা' : 'Verified Patron & Donor'}
                      </span>
                    </div>

                    <h4 className="font-extrabold text-[#0F172A] text-base mt-1">
                      {foundDonation.donorName}
                    </h4>

                    <div className="text-xs text-slate-600 mt-0.5 flex flex-wrap gap-2">
                      <span>Token: <strong className="font-mono text-indigo-700">{foundDonation.token || foundDonation.qrToken || 'N/A'}</strong></span>
                      <span>•</span>
                      <span>{foundDonation.purpose}</span>
                      <span>•</span>
                      <span>
                        <strong className="text-[#0284C7] font-bold">
                          ৳{foundDonation.amount.toLocaleString()} BDT
                        </strong>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="w-full sm:w-auto pt-2 sm:pt-0">
                  <button
                    onClick={() => setSelectedCardDonation(foundDonation)}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Award className="w-4 h-4" />
                    <span>{language === 'bn' ? 'থ্যাঙ্ক ইউ কার্ড দেখুন' : 'View Thank You Card'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* RESULT ALERT IF NOT FOUND */}
          {searchAttempted && !foundRegistration && !foundDonation && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-300 text-rose-900 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="font-bold text-xs sm:text-sm text-rose-800">
                  {t.statusNotFoundTitle}
                </h4>
                <p className="text-xs text-rose-700">
                  {statusLookupError || t.statusNotFoundDesc}
                </p>
                {isGovernanceReady && isGlobalRegistrationOpen(feeSettings) && (
                  <div className="pt-2">
                    <button
                      onClick={() => onNavigate('register')}
                      className="text-xs font-bold text-rose-800 underline hover:text-rose-950 cursor-pointer"
                    >
                      {language === 'bn' ? 'নতুন শিক্ষার্থী নিবন্ধন করুন →' : 'Register as New Attendee →'}
                    </button>
                  </div>
                )}
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

        {governanceStatus === 'loading' ? (
          <div className="max-w-2xl mx-auto p-8 bg-white rounded-3xl border border-slate-200 text-center space-y-3 shadow-xs">
            <RefreshCw className="w-7 h-7 text-[#0284C7] animate-spin mx-auto" />
            <h3 className="text-sm font-bold text-slate-900">
              {language === 'bn' ? 'নিবন্ধনের সর্বশেষ অবস্থা যাচাই করা হচ্ছে...' : 'Checking live registration availability...'}
            </h3>
            <p className="text-xs text-slate-500">
              {language === 'bn'
                ? 'অনুগ্রহ করে এক মুহূর্ত অপেক্ষা করুন।'
                : 'Please wait a moment while we load live governance settings.'}
            </p>
          </div>
        ) : governanceStatus === 'error' ? (
          <div className="max-w-2xl mx-auto p-8 bg-white rounded-3xl border border-rose-200 text-center space-y-4 shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900">
                {language === 'bn'
                  ? 'নিবন্ধন সেটিংস লোড করা সম্ভব হয়নি'
                  : 'Unable to Load Registration Status'}
              </h3>
              <p className="text-xs text-slate-600 max-w-md mx-auto">
                {governanceError ||
                  (language === 'bn'
                    ? 'সার্ভারের সাথে সংযোগ স্থাপন করা যায়নি। অনুগ্রহ করে পুনরায় চেষ্টা করুন।'
                    : 'Could not reach the portal settings server. Please retry.')}
              </p>
            </div>
            {onRetryGovernance && (
              <button
                type="button"
                onClick={onRetryGovernance}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{language === 'bn' ? 'পুনরায় চেষ্টা করুন' : 'Retry'}</span>
              </button>
            )}
          </div>
        ) : !isGlobalRegistrationOpen(feeSettings) ? (
          <GovernanceClosureNoticeCard
            notice={globalClosedNotice}
            language={language}
            badgeText={language === 'bn' ? 'নিবন্ধন বন্ধ' : 'Registration Closed'}
            onFindTicket={() => onNavigate('find-ticket')}
          />
        ) : (
          <div className="grid gap-8 max-w-4xl mx-auto grid-cols-1 md:grid-cols-2">
            {/* Former Student Card (always visible & clickable when Global is ON) */}
            {(() => {
              const alumniOpen = isAlumniRegistrationOpen(feeSettings);
              return (
                <div
                  className={`bg-white rounded-3xl p-8 shadow-xl relative overflow-hidden flex flex-col justify-between ${
                    alumniOpen ? 'border-2 border-[#0284C7]' : 'border-2 border-amber-300'
                  }`}
                >
                  <div
                    className={`absolute top-0 right-0 text-white text-[10px] font-black uppercase px-4 py-1 rounded-bl-xl tracking-wider ${
                      alumniOpen ? 'bg-[#0284C7]' : 'bg-amber-600'
                    }`}
                  >
                    {alumniOpen
                      ? language === 'bn'
                        ? 'অ্যালামনাই ক্যাটাগরি'
                        : 'Alumni'
                      : language === 'bn'
                        ? 'সাময়িকভাবে বন্ধ'
                        : 'Temporarily Closed'}
                  </div>

                  <div className="space-y-4">
                    <div>
                      <span className="text-xs font-bold text-[#0284C7] uppercase tracking-wider block">
                        {t.feeFormerTitle}
                      </span>
                      <h3 className="text-3xl font-black text-slate-900 mt-1">
                        ৳ {feeSettings.formerStudentFee} BDT
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">{t.feeFormerSubtitle}</p>
                    </div>

                    <div className="space-y-2.5 text-xs text-slate-700 pt-4 border-t border-slate-100">
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-[#0284C7] shrink-0 mt-0.5" />
                        <span>{t.feeFormerIncludes}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Shirt className="w-4 h-4 text-[#0284C7] shrink-0" />
                        <span>
                          {language === 'bn' ? 'কাস্টম সাইজ টি-শার্ট অন্তর্ভুক্ত' : 'T-shirt Included (S-XXXL)'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Award className="w-4 h-4 text-[#0284C7] shrink-0" />
                        <span>
                          {language === 'bn' ? '৬৪ বছর পূর্তি স্মারক স্মরণিকা' : 'Anniversary Souvenir Magazine'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-8">
                    <button
                      type="button"
                      onClick={() => onNavigate('register', false, { category: 'former' })}
                      className={`w-full py-3.5 rounded-full font-bold text-sm transition-all cursor-pointer flex items-center justify-center gap-2 ${
                        alumniOpen
                          ? 'bg-[#0284C7] hover:bg-[#0EA5E9] text-white shadow-lg shadow-sky-600/30'
                          : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 shadow-xs'
                      }`}
                    >
                      <span>
                        {alumniOpen
                          ? language === 'bn'
                            ? 'প্রাক্তন শিক্ষার্থী নিবন্ধন'
                            : 'Register as Alumni'
                          : language === 'bn'
                            ? 'প্রাক্তন শিক্ষার্থী (বিজ্ঞপ্তি দেখুন)'
                            : 'Alumni Notice & Details'}
                      </span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Current Student Card (always visible & clickable when Global is ON) */}
            {(() => {
              const currentOpen = isCurrentStudentRegistrationOpen(feeSettings);
              return (
                <div
                  className={`bg-white rounded-3xl p-8 shadow-lg relative overflow-hidden flex flex-col justify-between ${
                    currentOpen ? 'border border-[#E2EEF8]' : 'border-2 border-amber-300'
                  }`}
                >
                  {!currentOpen && (
                    <div className="absolute top-0 right-0 bg-amber-600 text-white text-[10px] font-black uppercase px-4 py-1 rounded-bl-xl tracking-wider">
                      {language === 'bn' ? 'সাময়িকভাবে বন্ধ' : 'Temporarily Closed'}
                    </div>
                  )}

                  <div className="space-y-4">
                    <div>
                      <span className="text-xs font-bold text-[#0EA5E9] uppercase tracking-wider block">
                        {t.feeCurrentTitle}
                      </span>
                      <h3 className="text-3xl font-black text-slate-900 mt-1">
                        ৳ {feeSettings.currentStudentFee} BDT
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">{t.feeCurrentSubtitle}</p>
                    </div>

                    <div className="space-y-2.5 text-xs text-slate-700 pt-4 border-t border-slate-100">
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-[#0EA5E9] shrink-0 mt-0.5" />
                        <span>{t.feeCurrentIncludes}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Shirt className="w-4 h-4 text-[#0EA5E9] shrink-0" />
                        <span>
                          {language === 'bn' ? 'পুনর্মিলনী টি-শার্ট অন্তর্ভুক্ত' : 'Reunion T-shirt Included'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-[#0EA5E9] shrink-0" />
                        <span>
                          {language === 'bn' ? 'বিশেষ ছাত্র মধ্যাহ্নভোজ ও কনসার্ট' : 'Student Banquet & Live Concert'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-8">
                    <button
                      type="button"
                      onClick={() => onNavigate('register', false, { category: 'current' })}
                      className={`w-full py-3.5 rounded-full font-bold text-sm transition-all cursor-pointer flex items-center justify-center gap-2 ${
                        currentOpen
                          ? 'bg-[#0F172A] hover:bg-slate-800 text-white shadow-md'
                          : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 shadow-xs'
                      }`}
                    >
                      <span>
                        {currentOpen
                          ? language === 'bn'
                            ? 'বর্তমান শিক্ষার্থী নিবন্ধন'
                            : 'Register as Current Student'
                          : language === 'bn'
                            ? 'বর্তমান শিক্ষার্থী (বিজ্ঞপ্তি দেখুন)'
                            : 'Current Student Notice & Details'}
                      </span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </section>

      {/* ── FINANCIAL TRANSPARENCY DASHBOARD ── */}
      <div style={getHomePageSectionStyle('financials')}>
        <FinancialTransparencyDashboard
          language={language}
          onNavigateDonate={() => onNavigate('donate')}
          feeSettings={feeSettings}
          governanceStatus={governanceStatus}
        />
      </div>

      {/* LATEST NOTICES PREVIEW */}
      <section
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
        style={getHomePageSectionStyle('notices')}
      >
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-[#0284C7]" />
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                {t.noticesHeading}
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">{t.noticesSubtitle}</p>
          </div>

          <button
            onClick={() => onNavigate('notices')}
            className="text-xs font-bold text-[#0284C7] hover:text-[#0EA5E9] flex items-center gap-1 cursor-pointer"
          >
            <span>{language === 'bn' ? 'সকল নোটিশ দেখুন' : 'View All Notices'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {notices.slice(0, 3).map((notice) => (
            <div
              key={notice.id}
              className="bg-white rounded-2xl p-6 border border-[#E2EEF8] shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="px-2.5 py-0.5 rounded-full font-bold uppercase bg-[#E2EEF8] text-[#0284C7]">
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

              <div className="pt-2 border-t border-[#E2EEF8]">
                <button
                  onClick={() => onNavigate('notices')}
                  className="text-xs font-semibold text-[#0284C7] hover:underline flex items-center gap-1 cursor-pointer"
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
                <div className="absolute inset-x-0 bottom-0 bg-[#0F172A]/90 p-3 flex flex-col justify-end border-t border-[#0284C7]/40">
                  <span className="text-[10px] font-bold text-[#38BDF8] uppercase tracking-wider">
                    {item.year}
                  </span>
                  <h4 className="font-bold text-white text-sm">{item.title}</h4>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ORGANIZING COMMITTEE (CMS-driven from CommitteeService) */}
      <div style={getHomePageSectionStyle('committee')}>
        <CommitteeSection language={language} />
      </div>

      {/* Thank You Card Modal for Verified Patron */}
      {selectedCardDonation && (
        <ThankYouCardModal
          donation={selectedCardDonation}
          language={language}
          onClose={() => setSelectedCardDonation(null)}
        />
      )}
    </div>
  );
};
