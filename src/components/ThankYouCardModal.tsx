import React from 'react';
import { X, Award } from 'lucide-react';
import { Language, DonationRecord } from '../types';
import { ThankYouCardBadge } from './ThankYouCardBadge';
import { ThankYouCardData } from '../utils/thankYouCardGenerator';

interface ThankYouCardModalProps {
  donation: DonationRecord;
  language?: Language;
  onClose: () => void;
}

export const ThankYouCardModal: React.FC<ThankYouCardModalProps> = ({
  donation,
  language = 'en',
  onClose,
}) => {
  const isBangla = language === 'bn';

  const cardData: ThankYouCardData = {
    donorName: donation.donorName,
    registrationId: donation.id,
    token: donation.token || donation.qrToken || donation.transactionId?.slice(-6).toUpperCase(),
    qrToken: donation.token || donation.qrToken,
    mobileNumber: donation.mobileNumber,
    amount: donation.amount,
    purpose: donation.purpose,
    date: donation.date,
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="thank-you-card-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
    >
      <div className="relative w-full max-w-lg bg-slate-900 border border-amber-600/50 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/90">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <h3 id="thank-you-card-title" className="text-base font-bold text-white leading-tight">
                {isBangla ? 'সম্মাননা ও কৃতজ্ঞতা স্মারক কার্ড' : 'Official Patron Thank You Card'}
              </h3>
              <p className="text-[11px] text-amber-300 font-mono">
                {donation.id} {donation.amount ? `• ৳${donation.amount.toLocaleString()}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex flex-col items-center justify-center bg-slate-950/60">
          <ThankYouCardBadge
            cardData={cardData}
            language={language}
            showActions={true}
          />
        </div>
      </div>
    </div>
  );
};
