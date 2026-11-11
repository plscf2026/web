import { useState, useEffect } from 'react';
import {
  GraduationCap,
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
      {/* HERO SECTION */}
      <section
        className="relative overflow-hidden bg-sky-100 text-slate-900 pt-10 pb-20 px-4 sm:px-6 lg:px-8 border-b-4 border-sky-300"
        style={getHomePageSectionStyle('hero')}
      >
        <div className="max-w-7xl mx-auto relative z-10 text-center space-y-6">
          {/* Institution Crest Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-sky-200 text-slate-700 text-xs font-semibold shadow-xs">
            <GraduationCap className="w-4 h-4 text-sky-700" />
            <span>{t.institutionSubtitle}</span>
            <span className="w-1 h-1 rounded-full bg-sky-400" />
            <span className="text-sky-800 font-bold">1962 - 2027</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-tight max-w-4xl mx-auto">
            {t.institutionName}
          </h1>

          <div className="text-xl sm:text-3xl font-extrabold text-sky-800 tracking-wide">
            {t.reunionTitle}
          </div>

          <p className="text-sm sm:text-base text-slate-700 max-w-2xl mx-auto font-normal leading-relaxed">
            {t.heroSubheading}
          </p>

          {/* Event Date & Venue Bar */}
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs sm:text-sm text-slate-700 font-semibold pt-2">
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-sky-200">
              <Calendar className="w-4 h-4 text-sky-700" />
              <span>{t.reunionDates}</span>
            </div>
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-sky-200">
              <MapPin className="w-4 h-4 text-sky-700" />
              <span>{t.venue}</span>
            </div>
          </div>

          {/* SECTION 1: REGISTRATION STATUS BADGE (OPEN / CLOSED) */}
          <div className="pt-2 flex justify-center">
            {feeSettings.registrationOpen ? (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs sm:text-sm font-bold shadow-xs">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                </span>
                <span>{t.regStatusOpenBadge}</span>
                {feeSettings.endDate && (
                  <span className="text-emerald-700 font-normal border-l border-emerald-300 pl-2">
                    {t.regDeadlinePrefix} {feeSettings.endDate}
                  </span>
                )}
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-rose-100 border border-rose-300 text-rose-800 text-xs sm:text-sm font-bold shadow-xs">
                <Lock className="w-4 h-4 text-rose-700" />
                <span>{t.regStatusClosedBadge}</span>
              </div>
            )}
          </div>

          {/* If registration closed: show advisory banner */}
          {!feeSettings.registrationOpen && (
            <div className="max-w-2xl mx-auto p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs sm:text-sm text-center shadow-xs">
              <div className="flex items-center justify-center gap-2 font-bold mb-1 text-amber-800">
                <AlertTriangle className="w-4 h-4" />
                <span>{language === 'bn' ? 'জরুরি প্রশাসনিক বিজ্ঞপ্তি' : 'Official Administrative Notice'}</span>
              </div>
              <p>{closedNotice}</p>
            </div>
          )}

          {/* Primary Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            {feeSettings.registrationOpen ? (
              <button
                onClick={() => onNavigate('register')}
                className="px-8 py-4 rounded-2xl bg-sky-700 hover:bg-sky-800 text-white font-black text-sm sm:text-base shadow-lg shadow-sky-700/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer flex items-center gap-2"
              >
                <span>{t.btnRegisterNow}</span>
                <ArrowRight className="w-5 h-5 text-white" />
              </button>
            ) : (
              <button
                disabled
                className="px-8 py-4 rounded-2xl bg-slate-800 text-slate-400 font-bold text-sm sm:text-base border border-slate-700 cursor-not-allowed flex items-center gap-2 opacity-80"
                title={closedNotice}
              >
                <Lock className="w-4 h-4 text-slate-500" />
                <span>{t.btnRegistrationClosed}</span>
              </button>
            )}

            <button
              onClick={() => onNavigate('donate')}
              className="px-6 py-4 rounded-2xl bg-white hover:bg-sky-50 text-slate-700 border border-sky-200 font-bold text-sm sm:text-base shadow-sm transition-all hover:-translate-y-0.5 cursor-pointer flex items-center gap-2"
            >
              <HeartHandshake className="w-5 h-5 text-rose-400" />
              <span>{t.btnMakeDonation}</span>
            </button>

            <button
              onClick={() => {
                const el = document.getElementById('check-status-section');
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth' });
                } else {
                  onNavigate('find-ticket');
                }
              }}
              className="px-5 py-4 rounded-2xl bg-transparent hover:bg-white text-slate-700 hover:text-sky-800 text-xs sm:text-sm font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Search className="w-4 h-4 text-sky-700" />
              <span>{t.checkStatusHeading}</span>
            </button>
          </div>

          {/* LIVE REGISTRATION STATISTICS */}
          <div className="pt-6 max-w-4xl mx-auto">
            <div className="bg-slate-900/80 backdrop-blur-md rounded-3xl p-6 border border-slate-800 shadow-2xl grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <span className="text-2xl sm:text-3xl font-black text-amber-300 block">
                  {paidCount}
                </span>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  {t.statTotalRegistered}
                </span>
              </div>

              <div>
                <span className="text-2xl sm:text-3xl font-black text-emerald-400 block">
                  {formerCount}
                </span>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  {t.statFormerStudents}
                </span>
              </div>

              <div>
                <span className="text-2xl sm:text-3xl font-black text-teal-300 block">
                  {currentCount}
                </span>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  {t.statCurrentStudents}
                </span>
              </div>

              <div>
                <span className="text-2xl sm:text-3xl font-black text-white block">
                  50+
                </span>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  {t.statBatches}
                </span>
              </div>
            </div>
            <p className="text-[11px] text-emerald-300 font-semibold mt-3 text-center">
              {t.statGoalProgress}
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 2 & 3: COUNTDOWN TIMER / POST-EVENT CELEBRATION */}
      <section
        className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-20"
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
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xl space-y-6">
            <div className="text-center space-y-1">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#172554] uppercase tracking-wider">
                <Clock className="w-4 h-4 text-[#263B8C]" />
                <span>{t.countdownHeading}</span>
              </div>
              <p className="text-xs text-slate-500">{t.countdownSubtitle}</p>
            </div>

            {/* Countdown Solid Cards */}
            <div className="grid grid-cols-4 gap-2 sm:gap-4 max-w-2xl mx-auto text-center">
              {/* Days */}
              <div className="bg-[#172554] text-white rounded-2xl p-3 sm:p-5 shadow-md border border-blue-900">
                <span className="text-2xl sm:text-4xl md:text-5xl font-black text-[#C5A45D] block tabular-nums">
                  {String(timeLeft.days).padStart(2, '0')}
                </span>
                <span className="text-[10px] sm:text-xs font-bold text-slate-300 uppercase tracking-wider mt-1 block">
                  {t.daysLabel}
                </span>
              </div>

              {/* Hours */}
              <div className="bg-[#172554] text-white rounded-2xl p-3 sm:p-5 shadow-md border border-blue-900">
                <span className="text-2xl sm:text-4xl md:text-5xl font-black text-blue-300 block tabular-nums">
                  {String(timeLeft.hours).padStart(2, '0')}
                </span>
                <span className="text-[10px] sm:text-xs font-bold text-slate-300 uppercase tracking-wider mt-1 block">
                  {t.hoursLabel}
                </span>
              </div>

              {/* Minutes */}
              <div className="bg-[#172554] text-white rounded-2xl p-3 sm:p-5 shadow-md border border-blue-900">
                <span className="text-2xl sm:text-4xl md:text-5xl font-black text-cyan-300 block tabular-nums">
                  {String(timeLeft.minutes).padStart(2, '0')}
                </span>
                <span className="text-[10px] sm:text-xs font-bold text-slate-300 uppercase tracking-wider mt-1 block">
                  {t.minutesLabel}
                </span>
              </div>

              {/* Seconds */}
              <div className="bg-[#172554] text-white rounded-2xl p-3 sm:p-5 shadow-md border border-blue-900">
                <span className="text-2xl sm:text-4xl md:text-5xl font-black text-amber-300 block tabular-nums">
                  {String(timeLeft.seconds).padStart(2, '0')}
                </span>
                <span className="text-[10px] sm:text-xs font-bold text-slate-300 uppercase tracking-wider mt-1 block">
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
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xl space-y-6">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
              <Search className="w-3.5 h-3.5" />
              <span>{language === 'bn' ? 'অনলাইন যাচাইকরণ সেবা' : 'Online Verification Portal'}</span>
            </div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              {t.checkStatusHeading}
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              {t.checkStatusSubtitle}
            </p>
          </div>

          {/* Verification Form */}
          <form onSubmit={handleCheckStatus} className="grid grid-cols-1 sm:grid-cols-5 gap-3 max-w-2xl mx-auto">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {t.inputRegIdLabel}
              </label>
              <input
                type="text"
                value={searchRegId}
                onChange={(e) => setSearchRegId(e.target.value)}
                placeholder={t.inputRegIdPlaceholder}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-mono uppercase focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 focus:outline-hidden"
                required
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {t.inputMobileLabel}
              </label>
              <input
                type="text"
                value={searchMobile}
                onChange={(e) => setSearchMobile(e.target.value)}
                placeholder={t.inputMobilePlaceholder}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-mono focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 focus:outline-hidden"
                required
              />
            </div>

            <div className="sm:col-span-1 flex items-end">
              <button
                type="submit"
                disabled={isCheckingStatus}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs sm:text-sm shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Search className="w-4 h-4" />
                <span>{isCheckingStatus ? (language === 'bn' ? 'যাচাই হচ্ছে...' : 'Checking...') : t.btnCheckStatus}</span>
              </button>
            </div>
          </form>

          {/* RESULT CARD IF FOUND */}
          {searchAttempted && foundRegistration && (
            <div className="p-5 rounded-2xl bg-emerald-50 border-2 border-emerald-500 shadow-md animate-fade-in">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <img
                    src={foundRegistration.photoUrl}
                    alt={foundRegistration.fullName}
                    className="w-16 h-16 rounded-xl object-cover border-2 border-white shadow-sm"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-700 text-white">
                        {foundRegistration.id}
                      </span>
                      <span className="flex items-center gap-1 text-xs font-bold text-emerald-800">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                        {t.statusFoundTitle}
                      </span>
                    </div>

                    <h4 className="font-extrabold text-slate-900 text-base mt-1">
                      {foundRegistration.fullName}
                    </h4>

                    <div className="text-xs text-slate-600 mt-0.5 flex flex-wrap gap-2">
                      <span>{foundRegistration.batchName}</span>
                      <span>•</span>
                      <span>{t.statusTShirtLabel} <strong className="text-slate-800">{foundRegistration.tShirtSize}</strong></span>
                      <span>•</span>
                      <span>
                        {t.statusPaymentStatusLabel}{' '}
                        <strong className="text-emerald-700 uppercase">
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
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
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
