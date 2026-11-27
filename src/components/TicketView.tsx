import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  Printer,
  CheckCircle2,
  Calendar,
  MapPin,
  Shirt,
  ShieldCheck,
  Sparkles,
  UserPlus,
  AlertTriangle,
  Clock,
  XCircle,
  Lock,
} from 'lucide-react';
import { RegistrationRecord, Language } from '../types';
import { translations } from '../i18n/translations';
import { formatSafeQrPayload } from '../utils/tokenGenerator';
import { StudentIdCardBadge } from './idcard/StudentIdCardBadge';
import { ParentIdCardBadge } from './idcard/ParentIdCardBadge';
import { IdCardStore } from '../services/idCardStore';
import { AppStore } from '../services/store';
import { isGlobalRegistrationOpen } from '../utils/rules';

interface TicketViewProps {
  registration: RegistrationRecord;
  language: Language;
  onNavigateHome?: () => void;
  onRegisterAnother?: () => void;
  onClose?: () => void;
}

export const TicketView: React.FC<TicketViewProps> = ({
  registration,
  language,
  onNavigateHome,
  onRegisterAnother,
  onClose,
}) => {
  const t = translations[language];
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (qrCanvasRef.current) {
      // Safe identification payload: encodes only token and ID, zero PII
      const qrData = formatSafeQrPayload(registration.qrToken, registration.id);

      QRCode.toCanvas(qrCanvasRef.current, qrData, {
        width: 170,
        margin: 1,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      }).catch((err) => console.error('QR rendering error:', err));
    }
  }, [registration]);

  const handlePrint = () => {
    window.print();
  };

  const isPaid = registration.paymentStatus === 'paid';
  const isManual = Boolean(registration.isManualRegistration);
  const approvalStatus = registration.registrationApprovalStatus || (isManual ? 'pending' : 'approved');
  const isPendingApproval = approvalStatus === 'pending';
  const isRejected = approvalStatus === 'rejected';

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Top Banner */}
      <div className="no-print mb-6 text-center space-y-2">
        <div
          className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold ${
            isPendingApproval
              ? 'bg-amber-100 text-amber-900 border-2 border-amber-300 animate-pulse'
              : isRejected
              ? 'bg-rose-100 text-rose-900 border border-rose-300'
              : isPaid
              ? 'bg-[#E2EEF8] text-[#0284C7] border border-[#0284C7]/30'
              : 'bg-amber-100 text-amber-800 border border-amber-300'
          }`}
        >
          {isPendingApproval ? (
            <Clock className="w-4 h-4 text-amber-600" />
          ) : isRejected ? (
            <XCircle className="w-4 h-4 text-rose-600" />
          ) : isPaid ? (
            <Sparkles className="w-3.5 h-3.5" />
          ) : (
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
          )}
          <span>
            {isPendingApproval
              ? language === 'bn'
                ? '⚠️ ম্যানুয়াল টিকিট — সুপার অ্যাডমিন অনুমোদনের অপেক্ষায় রয়েছে (অযাচাইকৃত)'
                : '⚠️ MANUAL TICKET — PENDING SUPER ADMIN APPROVAL (UNVERIFIED)'
              : isRejected
              ? language === 'bn'
                ? '❌ রেজিস্ট্রেশন বাতিলকৃত — এই টিকিটটি ব্যবহারের অযোগ্য'
                : '❌ REGISTRATION REJECTED — THIS TICKET CANNOT BE USED'
              : isPaid
              ? language === 'bn'
                ? 'অভিনন্দন! আপনার রেজিস্ট্রেশন ও পেমেন্ট সফল হয়েছে'
                : 'Congratulations! Registration & Payment Verified'
              : language === 'bn'
              ? 'পেমেন্ট অসম্পূর্ণ — রেজিস্ট্রেশন ফি পরিশোধের অপেক্ষায়'
              : 'Payment Incomplete — Awaiting Registration Fee Payment'}
          </span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          {isPendingApproval
            ? language === 'bn'
              ? 'অপেক্ষমান টিকিট পাস (অনুমোদন সাপেক্ষ)'
              : 'Pending Approval Ticket Pass'
            : isRejected
            ? language === 'bn'
              ? 'বাতিলকৃত টিকিট পাস'
              : 'Rejected Registration Pass'
            : isPaid
            ? t.ticketHeading
            : language === 'bn'
            ? 'অসম্পূর্ণ রেজিস্ট্রেশন পাস'
            : 'Incomplete Registration Pass'}
        </h1>

        <p className="text-xs sm:text-sm text-slate-600 max-w-xl mx-auto">
          {isPendingApproval
            ? language === 'bn'
              ? 'সুপার অ্যাডমিন অনুমোদন না দেওয়া পর্যন্ত টিকিটটি অযাচাইকৃত থাকবে এবং কিউআর স্ক্যানার কোনো সেবা বা ভেন্যু প্রবেশের অনুমতি দেবে না।'
              : 'Generating this ticket does not mean the student is verified. The QR code remains inactive until approved by the Super Admin.'
            : isRejected
            ? language === 'bn'
              ? 'এই নিবন্ধনটি সুপার অ্যাডমিন দ্বারা বাতিল করা হয়েছে। কিউআর কোড অকার্যকর।'
              : 'This registration has been rejected by Super Admin. Facility and venue entry are denied.'
            : isPaid
            ? t.ticketNotice
            : language === 'bn'
            ? 'পেমেন্ট সম্পন্ন না হওয়া পর্যন্ত ডিজিটাল টিকিট ও আইডি কার্ড প্রবেশ বা কিউআর ভেরিফিকেশনের জন্য বৈধ নয়।'
            : 'Official digital ticket pass and ID card are invalid for event entry or QR verification until payment is completed.'}
        </p>
      </div>

      {/* Action Buttons (Hidden on Print) */}
      <div className="no-print flex flex-wrap items-center justify-center gap-3 mb-8">
        {onRegisterAnother && isGlobalRegistrationOpen(AppStore.getFeeSettings()) && (
          <button
            onClick={onRegisterAnother}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#0284C7] hover:bg-[#0EA5E9] text-white text-xs sm:text-sm font-bold shadow-md shadow-sky-600/30 transition-all cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>{language === 'bn' ? 'নতুন শিক্ষার্থী নিবন্ধন করুন' : 'Register Another Student'}</span>
          </button>
        )}

        {(isPaid || isManual) && (
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#0F172A] hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold shadow-md transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4 text-[#38BDF8]" />
            <span>
              {isPendingApproval
                ? language === 'bn'
                  ? 'কার্ড প্রিন্ট করুন (অনুমোদন অপেক্ষমান)'
                  : 'Print Card (Pending Approval)'
                : t.btnPrintTicket}
            </span>
          </button>
        )}

        {(onNavigateHome || onClose) && (
          <button
            onClick={onNavigateHome || onClose}
            className="px-4 py-2.5 rounded-xl text-slate-600 hover:text-slate-900 text-xs sm:text-sm font-medium transition-colors cursor-pointer"
          >
            {language === 'bn' ? (onClose ? 'বন্ধ করুন' : 'হোমে ফিরুন') : (onClose ? 'Close' : 'Back to Home')}
          </button>
        )}
      </div>

      {/* Official Student ID Card Section */}
      {isPaid ? (
        <>
          <div className="no-print mb-8 bg-gradient-to-br from-slate-900 via-sky-950 to-slate-900 rounded-3xl p-6 text-white shadow-xl border border-sky-800/40">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
              <div className="text-center lg:text-left space-y-2 max-w-md">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/20 text-sky-300 text-xs font-bold border border-sky-400/30">
                  <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
                  <span>
                    {registration.category === 'former'
                      ? language === 'bn'
                        ? 'অফিসিয়াল অ্যালুমনাই মেম্বার আইডি কার্ড'
                        : 'Official Alumni Member ID Card'
                      : language === 'bn'
                      ? 'অফিসিয়াল স্টুডেন্ট আইডি কার্ড'
                      : 'Official Student ID Card'}
                  </span>
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  {registration.category === 'former'
                    ? language === 'bn'
                      ? 'অ্যালুমনাই কার্ড প্রিন্ট বা ডাউনলোড করুন'
                      : 'Print or Download Your Alumni ID Card'
                    : language === 'bn'
                    ? 'আইডি কার্ড প্রিন্ট বা ডাউনলোড করুন'
                    : 'Print or Download Your Student ID Card'}
                </h2>
                <p className="text-xs text-sky-200/80 leading-relaxed">
                  {language === 'bn'
                    ? 'ইভেন্টে প্রবেশের জন্য অফিসিয়াল আইডি কার্ডের ছবি সরাসরি প্রিন্ট করুন অথবা উচ্চমানের PDF ও Photo ডাউনলোড করুন।'
                    : 'Print your official ID card photo directly, or download print-ready PDF and photo image for your mobile gallery.'}
                </p>
              </div>
              <div className="flex-shrink-0">
                <StudentIdCardBadge
                  student={IdCardStore.getOrBuildCardForRegistration(registration)}
                  language={language}
                />
              </div>
            </div>
          </div>

          {/* Parent / Guardian Entry Pass Card Section (If registered with parent) */}
          {registration.hasParent && (
            <div className="no-print mb-8 bg-gradient-to-br from-[#24040F] via-[#450A1A] to-[#24040F] rounded-3xl p-6 text-white shadow-xl border border-amber-500/40">
              <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
                <div className="text-center lg:text-left space-y-2 max-w-md">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-400/30">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                    <span>{language === 'bn' ? 'অফিসিয়াল অভিভাবক পাস' : 'Official Parent / Guardian Pass'}</span>
                  </span>
                  <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    {language === 'bn' ? 'অভিভাবক প্রবেশ পাস কার্ড' : 'Parent / Guardian Entry Pass'}
                  </h2>
                  <p className="text-xs text-amber-200/80 leading-relaxed">
                    {language === 'bn'
                      ? 'শিক্ষার্থীর সাথে ১ জন অভিভাবক প্রবেশের জন্য এই পাসটি ব্যবহার করুন। কার্ডের ছবি প্রিন্ট অথবা ডাউনলোড করুন।'
                      : 'Use this dedicated pass for ONE accompanying parent/guardian. Print or download the pass below.'}
                  </p>
                  <div className="pt-2 text-xs text-amber-300/90 font-mono space-y-1">
                    <div>অভিভাবক / Parent: <span className="font-bold text-white">{registration.parentName || 'N/A'}</span></div>
                    <div>সম্পর্ক / Relation: <span className="font-bold text-white">{registration.parentRelation || 'Guardian'}</span></div>
                    <div>মোবাইল / Phone: <span className="font-bold text-white">{registration.parentPhone || 'N/A'}</span></div>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <ParentIdCardBadge
                    student={IdCardStore.getOrBuildCardForRegistration(registration)}
                    language={language}
                  />
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="no-print mb-8 bg-amber-50 rounded-3xl p-6 border-2 border-amber-300 text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-bold">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>{language === 'bn' ? 'আইডি কার্ড লক করা আছে' : 'ID Card Locked'}</span>
          </div>
          <h3 className="text-lg font-bold text-amber-950">
            {language === 'bn' ? 'পেমেন্ট সম্পন্ন হলে আইডি কার্ড উন্মুক্ত হবে' : 'ID Card unlocked only after payment verification'}
          </h3>
          <p className="text-xs text-amber-800 max-w-md mx-auto">
            {language === 'bn'
              ? 'আপনার নিবন্ধন সম্পন্ন করতে এবং অফিসিয়াল ফটো আইডি কার্ড ডাউনলোড বা প্রিন্ট করতে অনুগ্রহ করে পেমেন্ট সম্পূর্ণ করুন।'
              : 'Please complete your registration fee payment to unlock and print your official Student Photo ID Card.'}
          </p>
        </div>
      )}

      {/* OFFICIAL DIGITAL ENTRY TICKET / BADGE CARD (A4/Print Friendly) */}
      <div className="print-ticket-container bg-white rounded-3xl shadow-xl border-2 border-slate-200 overflow-hidden relative">
        {/* Solid Institutional Navy Top Bar */}
        <div className="h-3 bg-[#0F172A]" />

        {/* Institution Header inside Ticket */}
        <div className="p-6 sm:p-8 border-b border-slate-200 bg-[#F3F4F6]">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full overflow-hidden bg-white p-1 flex items-center justify-center shadow-md border-2 border-[#0284C7] shrink-0">
                <img
                  src="/assets/school_logo.png"
                  alt="Police Lines School & College Faridpur Emblem"
                  className="w-full h-full object-contain rounded-full"
                />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight leading-tight">
                  {t.institutionName}
                </h2>
                <p className="text-xs text-slate-600 font-medium mt-0.5">
                  {t.institutionSubtitle}
                </p>
                <div className="mt-1 flex items-center justify-center sm:justify-start gap-2">
                  <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-[#E2EEF8] text-[#0284C7] uppercase tracking-wider">
                    {t.reunionTitle}
                  </span>
                  <span className="text-xs font-semibold text-[#0284C7]">
                    {t.reunionDates}
                  </span>
                </div>
              </div>
            </div>

            {/* Official Seal / Verified / Pending Badge */}
            <div className="flex flex-col items-center sm:items-end">
              <div
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold shadow-xs ${
                  isPendingApproval
                    ? 'bg-amber-500 text-white'
                    : isRejected
                    ? 'bg-rose-600 text-white'
                    : isPaid
                    ? 'bg-[#0284C7] text-white'
                    : 'bg-amber-500 text-white'
                }`}
              >
                {isPendingApproval ? (
                  <Clock className="w-4 h-4" />
                ) : isRejected ? (
                  <XCircle className="w-4 h-4" />
                ) : isPaid ? (
                  <ShieldCheck className="w-4 h-4" />
                ) : (
                  <AlertTriangle className="w-4 h-4" />
                )}
                <span>
                  {isPendingApproval
                    ? language === 'bn'
                      ? 'অনুমোদনের অপেক্ষায়'
                      : 'PENDING APPROVAL'
                    : isRejected
                    ? language === 'bn'
                      ? 'বাতিলকৃত'
                      : 'REJECTED'
                    : isPaid
                    ? t.ticketVerified
                    : language === 'bn'
                    ? 'পেমেন্ট বাকি'
                    : 'UNPAID / PENDING'}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 mt-1 font-mono">
                {isPendingApproval
                  ? language === 'bn'
                    ? 'সুপার অ্যাডমিন পর্যালোচনায়'
                    : 'AWAITING SUPER ADMIN'
                  : isRejected
                  ? language === 'bn'
                    ? 'প্রবেশাধিকার বাতিল'
                    : 'ENTRY DENIED'
                  : isPaid
                  ? `TXN: ${registration.transactionId || 'CONFIRMED'}`
                  : language === 'bn'
                  ? 'ফি বকেয়া'
                  : 'AWAITING PAYMENT'}
              </span>
            </div>
          </div>
        </div>

        {/* Main Body of Ticket */}
        <div className="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 items-center">
          {/* Col 1: Attendee Photograph & Name */}
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="relative">
              <img
                src={registration.photoUrl}
                alt={registration.fullName}
                className="w-36 h-36 rounded-2xl object-cover border-4 border-[#0284C7] shadow-md bg-slate-100"
              />
              <span className="absolute -bottom-2 -right-2 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-slate-900 text-amber-400 border border-slate-700 shadow-sm">
                {registration.category === 'former'
                  ? language === 'bn'
                    ? 'প্রাক্তন'
                    : 'ALUMNI'
                  : language === 'bn'
                  ? 'বর্তমান'
                  : 'STUDENT'}
              </span>
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-900">
                {registration.fullName}
              </h3>
              {registration.fullNameBn && (
                <p className="text-sm font-medium text-slate-600">
                  {registration.fullNameBn}
                </p>
              )}
              <p className="text-xs font-bold text-[#0284C7] mt-1">
                {registration.batchName}
              </p>
            </div>
          </div>

          {/* Col 2: Credential Details */}
          <div className="space-y-3.5 text-xs text-slate-700 border-y md:border-y-0 md:border-x border-slate-200 py-4 md:py-0 md:px-6">
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">
                {t.ticketRegId}
              </span>
              <span className="text-sm font-black text-slate-900 font-mono tracking-wider">
                {registration.id}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-500 block font-medium">
                  {t.ticketBatch}
                </span>
                <span className="font-bold text-slate-800">
                  {registration.category === 'former'
                    ? registration.passingYear
                    : registration.currentClass}
                </span>
              </div>

              <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-500 block font-medium">
                    {t.ticketTShirt}
                  </span>
                  <span className="font-extrabold text-indigo-700 text-sm">
                    {registration.tShirtSize}
                  </span>
                </div>
                <Shirt className="w-5 h-5 text-indigo-400" />
              </div>
            </div>

            <div className="space-y-1 pt-1">
              <div className="flex items-center gap-2 text-slate-600">
                <Calendar className="w-3.5 h-3.5 text-[#0284C7] shrink-0" />
                <span>{t.ticketDate}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <MapPin className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span>{t.ticketVenue}</span>
              </div>
            </div>
          </div>

          {/* Col 3: Real Scannable QR Code */}
          <div className="flex flex-col items-center text-center space-y-2">
            <div
              className={`p-3 bg-white rounded-2xl shadow-md border-2 inline-block relative ${
                isPendingApproval
                  ? 'border-amber-400 ring-4 ring-amber-100'
                  : isRejected
                  ? 'border-rose-400 opacity-60'
                  : 'border-slate-200'
              }`}
            >
              <canvas
                ref={qrCanvasRef}
                className={`rounded-lg ${
                  isPendingApproval ? 'filter grayscale opacity-30 contrast-75' : ''
                }`}
              />
              {isPendingApproval && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-[1.5px] flex flex-col items-center justify-center rounded-2xl p-2 text-center select-none">
                  <div className="w-10 h-10 rounded-full bg-amber-100 border-2 border-amber-300 flex items-center justify-center mb-1.5 shadow-xs">
                    <Lock className="w-5 h-5 text-amber-800" />
                  </div>
                  <span className="text-[10px] font-black text-amber-950 uppercase tracking-tight">
                    {language === 'bn' ? 'কিউআর নিষ্ক্রিয়' : 'QR INACTIVE'}
                  </span>
                  <span className="text-[8px] text-amber-800 font-bold leading-tight mt-0.5">
                    {language === 'bn' ? 'অনুমোদনের অপেক্ষায়' : 'Awaiting Approval'}
                  </span>
                </div>
              )}
              {isRejected && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-[1px] flex flex-col items-center justify-center rounded-2xl p-2 text-center">
                  <XCircle className="w-8 h-8 text-rose-600 mb-1" />
                  <span className="text-[9px] font-black text-rose-900 uppercase">
                    {language === 'bn' ? 'বাতিল' : 'REJECTED'}
                  </span>
                </div>
              )}
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 rounded-lg border border-amber-300">
              <span className="text-[10px] uppercase font-bold text-amber-700">TOKEN:</span>
              <span className="text-sm font-mono font-black tracking-widest text-amber-950">
                {registration.qrToken}
              </span>
            </div>
            {isPendingApproval ? (
              <div className="flex flex-col items-center gap-1 max-w-[210px] mt-1">
                <span className="text-[11px] text-rose-800 font-black bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-300 shadow-2xs text-center leading-tight">
                  {language === 'bn'
                    ? '⚠️ কিউআর কাজ করছে না — সুপার অ্যাডমিন অনুমোদনের অপেক্ষায়'
                    : '⚠️ QR Code Not Working — Pending Super Admin Approval'}
                </span>
                <span className="text-[9px] text-slate-500 font-medium text-center">
                  {language === 'bn'
                    ? 'সুপার অ্যাডমিন অনুমতি দেওয়ার পর কিউআর সক্রিয় হবে'
                    : 'QR will only become active after Super Admin permission'}
                </span>
              </div>
            ) : isRejected ? (
              <span className="text-[10px] text-rose-800 font-bold bg-rose-100 px-2.5 py-1 rounded-full border border-rose-300">
                {language === 'bn' ? '❌ কিউআর অকার্যকর' : '❌ QR Code Deactivated'}
              </span>
            ) : (
              <span className="text-[10px] text-[#0284C7] font-semibold bg-[#E2EEF8] px-2.5 py-1 rounded-full border border-[#0284C7]/30">
                {language === 'bn' ? 'প্রবেশদ্বার ও সেবায় স্ক্যান করুন' : 'Scan for Entry & Services'}
              </span>
            )}
          </div>
        </div>

        {/* Ticket Footer Tear-Off Notice */}
        <div className="bg-slate-900 text-slate-300 px-6 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px]">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#38BDF8]" />
            <span>
              {language === 'bn'
                ? 'আইডি কার্ড, টি-শার্ট ও ভোজ কুপন ইভেন্ট বুথে এই টিকিট দেখিয়ে সংগ্রহ করুন।'
                : 'Collect your ID badge, T-shirt and banquet kit at Event Desk using this ticket.'}
            </span>
          </div>
          <div className="font-mono text-slate-400 text-[10px]">
            PLSCF-SECURE-EVENT-PASS • 1962-2027
          </div>
        </div>
      </div>
    </div>
  );
};
