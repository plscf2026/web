import { useState } from 'react';
import { Search, AlertCircle, ArrowRight, Award, CheckCircle2 } from 'lucide-react';
import { RegistrationRecord, DonationRecord, Language } from '../types';
import { translations } from '../i18n/translations';
import { SupabaseService } from '../services/supabase';
import { ThankYouCardModal } from './ThankYouCardModal';

interface TicketLookupModalProps {
  language: Language;
  onSelectRegistration: (reg: RegistrationRecord) => void;
  onNavigateRegister: () => void;
}

export const TicketLookupModal: React.FC<TicketLookupModalProps> = ({
  language,
  onSelectRegistration,
  onNavigateRegister,
}) => {
  const t = translations[language];
  const isBangla = language === 'bn';
  const [registrationId, setRegistrationId] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [searchError, setSearchError] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [matchedRecord, setMatchedRecord] = useState<RegistrationRecord | null>(null);
  const [matchedDonation, setMatchedDonation] = useState<DonationRecord | null>(null);
  const [showThankYouModal, setShowThankYouModal] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearchError('');
    setMatchedRecord(null);
    setMatchedDonation(null);

    if (!registrationId.trim() || !mobileNumber.trim()) return;

    setIsSearching(true);
    try {
      const result = await SupabaseService.lookupVerifiedTicket(
        registrationId.trim(),
        mobileNumber.trim()
      );
      if (result.type === 'donation' && result.donation) {
        setMatchedDonation(result.donation);
      } else if (result.registration) {
        setMatchedRecord(result.registration);
      } else if (result.donation) {
        setMatchedDonation(result.donation);
      } else {
        setSearchError(result.error || t.lookupNotFound);
      }
    } catch (error) {
      console.error('Ticket & Donation lookup failed:', error);
      setSearchError(
        language === 'bn'
          ? 'টিকিট বা অনুদান কার্ড খোঁজা যাচ্ছে না। কিছুক্ষণ পরে আবার চেষ্টা করুন।'
          : 'Ticket or donation lookup is temporarily unavailable. Please try again later.'
      );
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-12">
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-200 space-y-6">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto shadow-xs">
            <Search className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            {isBangla ? 'টিকিট ও থ্যাঙ্ক ইউ কার্ড যাচাই' : t.lookupTitle}
          </h1>
          <p className="text-xs text-slate-600">
            {isBangla
              ? 'শিক্ষার্থী টিকিট বা অনুদাতার সম্মাননা কার্ড দেখতে আইডি ও মোবাইল নম্বর দিয়ে সার্চ করুন।'
              : 'Search with your Registration ID / Donation ID and Mobile Number to view ticket or Thank You Card.'}
          </p>
        </div>

        {/* Testing Credentials Banner (For quick attendee & donor lookup testing) */}
        <div className="p-3 bg-sky-50 border border-sky-300 text-sky-900 rounded-xl text-xs flex flex-wrap items-center justify-between gap-2 shadow-2xs">
          <div className="flex items-center gap-1.5 font-medium flex-wrap">
            <span className="font-bold text-sky-950">🧪 Quick Test:</span>
            <span className="font-mono bg-white px-2 py-0.5 rounded border border-sky-200 text-sky-800 font-bold">PLSCF-2026-F1001</span>
            <span className="text-slate-400">/</span>
            <span className="font-mono bg-white px-2 py-0.5 rounded border border-sky-200 text-sky-800 font-bold">01712345678</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setRegistrationId('PLSCF-2026-F1001');
              setMobileNumber('01712345678');
            }}
            className="text-[10px] text-sky-800 bg-sky-100 hover:bg-sky-200 px-2.5 py-1 rounded-full font-bold cursor-pointer transition-colors shadow-2xs"
          >
            Auto-fill
          </button>
        </div>

        <form onSubmit={handleSearch} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="ticket-registration-id">
              {isBangla ? 'রেজিস্ট্রেশন বা অনুদান আইডি / টোকেন:' : 'Registration ID / Donation ID / Token:'}
            </label>
            <div className="relative">
              <input
                type="text"
                id="ticket-registration-id"
                value={registrationId}
                onChange={(e) => setRegistrationId(e.target.value)}
                placeholder="PLSCF-2026-F0001 or DON-2027-..."
                className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 focus:outline-hidden"
                required
              />
            </div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 mt-3" htmlFor="ticket-mobile-number">
              {language === 'bn' ? 'নিবন্ধিত মোবাইল নম্বর:' : 'Registered mobile number:'}
            </label>
            <input
              type="tel"
              inputMode="tel"
              id="ticket-mobile-number"
              autoComplete="tel"
              value={mobileNumber}
              onChange={(e) => setMobileNumber(e.target.value)}
              placeholder="01XXXXXXXXX"
              className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 focus:outline-hidden"
              required
            />
          </div>

          {searchError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{searchError}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSearching}
            className="w-full min-h-[44px] py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-sm rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <span>{isSearching ? (language === 'bn' ? 'খোঁজা হচ্ছে...' : 'Searching...') : t.btnSearchTicket}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Found Student Result Card */}
        {matchedRecord && (
          <div className="p-5 rounded-2xl bg-emerald-50 border-2 border-emerald-500 shadow-md space-y-4 animate-in fade-in">
            <div className="flex items-center gap-4">
              <img
                src={matchedRecord.photoUrl}
                alt={matchedRecord.fullName}
                className="w-16 h-16 rounded-xl object-cover border-2 border-emerald-600"
              />
              <div>
                <span className="text-[10px] font-bold uppercase text-emerald-800 bg-emerald-200/60 px-2 py-0.5 rounded-full">
                  {matchedRecord.category} Student
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1">
                  {matchedRecord.fullName}
                </h3>
                <span className="font-mono text-xs text-slate-600 block">
                  {matchedRecord.id} • {matchedRecord.batchName}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-emerald-200 flex justify-between items-center text-xs">
              <span className="text-emerald-900 font-semibold">
                Status: {matchedRecord.paymentStatus.toUpperCase()} (৳{matchedRecord.totalPaid})
              </span>
              <button
                type="button"
                onClick={() => onSelectRegistration(matchedRecord)}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                View & Print Ticket
              </button>
            </div>
          </div>
        )}

        {/* Found Donor Result Card */}
        {matchedDonation && (
          <div className="p-5 rounded-2xl bg-amber-50/80 border-2 border-amber-500 shadow-md space-y-4 animate-in fade-in">
            <div className="flex items-start gap-3.5">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-700 border border-amber-400 flex items-center justify-center shrink-0 shadow-inner">
                <Award className="w-8 h-8" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-black uppercase text-amber-900 bg-amber-200 px-2.5 py-0.5 rounded-full border border-amber-300">
                    {isBangla ? 'অনুদাতা ও শুভাকাঙ্ক্ষী' : 'Honored Patron / Donor'}
                  </span>
                  <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {isBangla ? 'যাচাইকৃত' : 'Verified'}
                  </span>
                </div>
                <h3 className="text-base font-extrabold text-slate-900 mt-1">
                  {matchedDonation.donorName}
                </h3>
                <div className="text-xs text-slate-600 mt-0.5 space-y-0.5">
                  <p className="font-mono text-[11px] text-indigo-800 font-semibold">
                    Ref: {matchedDonation.id} • Token: {matchedDonation.token || matchedDonation.qrToken || 'N/A'}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {matchedDonation.purpose} • ৳{matchedDonation.amount.toLocaleString()} BDT
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-amber-200 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-amber-950 font-bold">
                {isBangla ? 'থ্যাঙ্ক ইউ কার্ড প্রস্তুত' : 'Official Thank You Card Ready'}
              </span>
              <button
                type="button"
                onClick={() => setShowThankYouModal(true)}
                className="px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-extrabold rounded-xl shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Award className="w-4 h-4" />
                <span>{isBangla ? 'থ্যাঙ্ক ইউ কার্ড দেখুন ও ডাউনলোড' : 'View & Download Thank You Card'}</span>
              </button>
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-500">
            {language === 'bn' ? 'এখনো নিবন্ধন করেননি?' : "Haven't registered yet?"}{' '}
            <button
              onClick={onNavigateRegister}
              className="text-emerald-700 font-bold hover:underline cursor-pointer"
            >
              {language === 'bn' ? 'এখনই রেজিস্ট্রেশন করুন' : 'Register Now'}
            </button>
          </p>
        </div>
      </div>

      {/* Thank You Card Modal for Matched Donor */}
      {showThankYouModal && matchedDonation && (
        <ThankYouCardModal
          donation={matchedDonation}
          language={language}
          onClose={() => setShowThankYouModal(false)}
        />
      )}
    </div>
  );
};
