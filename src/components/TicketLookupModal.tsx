import { useState } from 'react';
import { Search, AlertCircle, ArrowRight } from 'lucide-react';
import { RegistrationRecord, Language } from '../types';
import { translations } from '../i18n/translations';
import { SupabaseService } from '../services/supabase';

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
  const [registrationId, setRegistrationId] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [searchError, setSearchError] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [matchedRecord, setMatchedRecord] = useState<RegistrationRecord | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearchError('');
    setMatchedRecord(null);

    if (!registrationId.trim() || !mobileNumber.trim()) return;

    setIsSearching(true);
    try {
      const result = await SupabaseService.lookupVerifiedTicket(
        registrationId.trim(),
        mobileNumber.trim()
      );
      if (result.registration) {
        setMatchedRecord(result.registration);
      } else {
        setSearchError(result.error || t.lookupNotFound);
      }
    } catch (error) {
      console.error('Ticket lookup failed:', error);
      setSearchError(
        language === 'bn'
          ? 'টিকিট খোঁজা যাচ্ছে না। কিছুক্ষণ পরে আবার চেষ্টা করুন।'
          : 'Ticket lookup is temporarily unavailable. Please try again later.'
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
            {t.lookupTitle}
          </h1>
          <p className="text-xs text-slate-600">{t.lookupSubtitle}</p>
        </div>

        <form onSubmit={handleSearch} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="ticket-registration-id">
              {language === 'bn' ? 'রেজিস্ট্রেশন আইডি:' : 'Registration ID:'}
            </label>
            <div className="relative">
              <input
                type="text"
                id="ticket-registration-id"
                value={registrationId}
                onChange={(e) => setRegistrationId(e.target.value)}
                placeholder="PLSCF-2026-F0001"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 focus:outline-hidden"
                required
              />
            </div>
            <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="ticket-mobile-number">
              {language === 'bn' ? 'নিবন্ধিত মোবাইল নম্বর:' : 'Registered mobile number:'}
            </label>
            <input
              type="tel"
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
            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-sm rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <span>{isSearching ? (language === 'bn' ? 'খোঁজা হচ্ছে...' : 'Searching...') : t.btnSearchTicket}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Found Result Card */}
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
    </div>
  );
};
