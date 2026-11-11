import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  Printer,
  Mail,
  CheckCircle2,
  Calendar,
  MapPin,
  Shirt,
  ShieldCheck,
  GraduationCap,
  Sparkles,
  X,
} from 'lucide-react';
import { RegistrationRecord, Language } from '../types';
import { translations } from '../i18n/translations';
import { formatSafeQrPayload } from '../utils/tokenGenerator';

interface TicketViewProps {
  registration: RegistrationRecord;
  language: Language;
  onNavigateHome: () => void;
}

export const TicketView: React.FC<TicketViewProps> = ({
  registration,
  language,
  onNavigateHome,
}) => {
  const t = translations[language];
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [emailModalOpen, setEmailModalOpen] = useState(false);

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

  const handleResendEmail = () => {
    setEmailModalOpen(true);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Top Banner */}
      <div className="no-print mb-6 text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>
            {language === 'bn'
              ? 'অভিনন্দন! আপনার রেজিস্ট্রেশন ও পেমেন্ট সফল হয়েছে'
              : 'Congratulations! Registration & Payment Verified'}
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          {t.ticketHeading}
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 max-w-xl mx-auto">
          {t.ticketNotice}
        </p>
      </div>

      {/* Action Buttons (Hidden on Print) */}
      <div className="no-print flex flex-wrap items-center justify-center gap-3 mb-8">
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold shadow-md transition-all cursor-pointer"
        >
          <Printer className="w-4 h-4 text-amber-400" />
          <span>{t.btnPrintTicket}</span>
        </button>

        <button
          onClick={handleResendEmail}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs sm:text-sm font-semibold shadow-xs transition-all cursor-pointer"
        >
          <Mail className="w-4 h-4 text-emerald-600" />
          <span>{t.btnResendEmail}</span>
        </button>

        <button
          onClick={onNavigateHome}
          className="px-4 py-2.5 rounded-xl text-slate-600 hover:text-slate-900 text-xs sm:text-sm font-medium transition-colors cursor-pointer"
        >
          {language === 'bn' ? 'হোমে ফিরুন' : 'Back to Home'}
        </button>
      </div>

      {/* OFFICIAL DIGITAL ENTRY TICKET / BADGE CARD (A4/Print Friendly) */}
      <div className="print-ticket-container bg-white rounded-3xl shadow-xl border-2 border-slate-200 overflow-hidden relative">
        {/* Solid Institutional Navy Top Bar */}
        <div className="h-3 bg-[#172554]" />

        {/* Institution Header inside Ticket */}
        <div className="p-6 sm:p-8 border-b border-slate-200 bg-[#F3F4F6]">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-[#172554] flex items-center justify-center text-white shadow-md border-2 border-[#C5A45D] shrink-0">
                <GraduationCap className="w-8 h-8 text-[#C5A45D]" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight leading-tight">
                  {t.institutionName}
                </h2>
                <p className="text-xs text-slate-600 font-medium mt-0.5">
                  {t.institutionSubtitle}
                </p>
                <div className="mt-1 flex items-center justify-center sm:justify-start gap-2">
                  <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-900 uppercase tracking-wider">
                    {t.reunionTitle}
                  </span>
                  <span className="text-xs font-semibold text-emerald-700">
                    {t.reunionDates}
                  </span>
                </div>
              </div>
            </div>

            {/* Official Seal / Verified Badge */}
            <div className="flex flex-col items-center sm:items-end">
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-600 text-white text-xs font-bold shadow-xs">
                <ShieldCheck className="w-4 h-4" />
                <span>{t.ticketVerified}</span>
              </div>
              <span className="text-[10px] text-slate-400 mt-1 font-mono">
                TXN: {registration.transactionId}
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
                className="w-36 h-36 rounded-2xl object-cover border-4 border-emerald-600 shadow-md bg-slate-100"
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
              <p className="text-xs font-bold text-emerald-800 mt-1">
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
                <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
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
            <div className="p-3 bg-white rounded-2xl shadow-md border-2 border-slate-200 inline-block">
              <canvas ref={qrCanvasRef} className="rounded-lg" />
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 rounded-lg border border-amber-300">
              <span className="text-[10px] uppercase font-bold text-amber-700">TOKEN:</span>
              <span className="text-sm font-mono font-black tracking-widest text-amber-950">
                {registration.qrToken}
              </span>
            </div>
            <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              {language === 'bn' ? 'প্রবেশদ্বার ও সেবায় স্ক্যান করুন' : 'Scan for Entry & Services'}
            </span>
          </div>
        </div>

        {/* Ticket Footer Tear-Off Notice */}
        <div className="bg-slate-900 text-slate-300 px-6 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px]">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>
              {language === 'bn'
                ? 'আইডি কার্ড, টি-শার্ট ও ভোজ কুপন ইভেন্ট বুথে এই টিকিট দেখিয়ে সংগ্রহ করুন।'
                : 'Collect your ID badge, T-shirt and banquet kit at Event Desk using this ticket.'}
            </span>
          </div>
          <div className="font-mono text-slate-400 text-[10px]">
            PLSCF-SECURE-EVENT-PASS • 1962-2026
          </div>
        </div>
      </div>

      {/* Simulated Email Sent Modal */}
      {emailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-semibold">
                  {t.emailModalTitle}
                </span>
              </div>
              <button
                onClick={() => setEmailModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">
                    {language === 'bn' ? 'ইমেইল সফলভাবে পাঠানো হয়েছে!' : 'Email Dispatched Successfully!'}
                  </span>
                  <span>
                    {t.emailModalSubtitle}{' '}
                    <strong className="text-slate-900">{registration.email}</strong>
                  </span>
                </div>
              </div>

              {/* Simulated Email Envelope Preview */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 text-xs space-y-2">
                <div className="text-slate-500 font-mono text-[11px]">
                  <strong>Subject:</strong> [Confirmed] Your Police Lines School & College Reunion 2026 Digital Ticket ({registration.id})
                </div>
                <div className="border-t border-slate-200 pt-2 text-slate-700 leading-relaxed">
                  <p>Dear {registration.fullName},</p>
                  <p className="mt-1">
                    Thank you for registering for the Grand Reunion 2026. Your payment of ৳{registration.totalPaid} has been verified.
                  </p>
                  <ul className="list-disc list-inside mt-2 space-y-0.5 font-medium text-slate-900">
                    <li>Registration ID: {registration.id}</li>
                    <li>T-Shirt Size: {registration.tShirtSize}</li>
                    <li>Venue: Police Lines Campus & Ground, Faridpur</li>
                    <li>Event Date: December 25-26, 2026</li>
                  </ul>
                  <p className="mt-2 text-slate-500 text-[11px]">
                    Attached: Digital_Ticket_{registration.id}.pdf with scannable QR Code.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setEmailModalOpen(false)}
                className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                {language === 'bn' ? 'ঠিক আছে' : 'Got it'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
