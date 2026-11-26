import React from 'react';
import {
  Lock,
  CalendarClock,
  PhoneCall,
  Info,
  ArrowLeft,
  Search,
  HeartHandshake,
} from 'lucide-react';
import { Language } from '../../types';
import { ResolvedClosureNotice } from '../../utils/rules';

interface GovernanceClosureNoticeCardProps {
  notice: ResolvedClosureNotice;
  language: Language;
  badgeText?: string;
  onBackHome?: () => void;
  onFindTicket?: () => void;
  alternateAction?: {
    label: string;
    onClick: () => void;
  };
}

function formatReopenDateTime(raw: string, lang: Language): string {
  const trimmed = raw.trim();
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime()) && /\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    try {
      return parsed.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return trimmed;
    }
  }
  return trimmed;
}

export const GovernanceClosureNoticeCard: React.FC<GovernanceClosureNoticeCardProps> = ({
  notice,
  language,
  badgeText,
  onBackHome,
  onFindTicket,
  alternateAction,
}) => {
  const isBn = language === 'bn';
  const isDonation = notice.target === 'donation';

  const defaultBadge = isDonation
    ? isBn
      ? 'অনুদান পোর্টাল সাময়িকভাবে বন্ধ'
      : 'Donations Paused'
    : notice.target === 'global'
    ? isBn
      ? 'অনলাইন রেজিস্ট্রেশন বন্ধ'
      : 'Registration Closed'
    : notice.target === 'alumni'
    ? isBn
      ? 'অ্যালামনাই নিবন্ধন বন্ধ'
      : 'Alumni Registration Closed'
    : isBn
    ? 'বর্তমান শিক্ষার্থী নিবন্ধন বন্ধ'
    : 'Current Student Registration Closed';

  return (
    <div
      data-testid={`closure-notice-${notice.target}`}
      className="bg-white rounded-3xl border-2 border-amber-300/90 shadow-lg overflow-hidden"
    >
      {/* Top Status Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-6 py-5 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0">
            {isDonation ? <HeartHandshake className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
          </div>
          <div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/30">
              <Lock className="w-3 h-3" />
              <span>{badgeText || defaultBadge}</span>
            </span>
            <h2 className="text-lg sm:text-xl font-black text-white mt-1.5 leading-snug">
              {notice.title}
            </h2>
          </div>
        </div>
      </div>

      {/* Body Content (safe plain text rendering only) */}
      <div className="p-6 sm:p-8 space-y-5">
        <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/70 border border-amber-200 text-slate-800 text-sm leading-relaxed whitespace-pre-line">
          {notice.message}
        </div>

        {(notice.reopenAt || notice.contactInfo) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {notice.reopenAt && (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-3">
                <CalendarClock className="w-5 h-5 text-[#0284C7] shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                    {isBn ? 'সম্ভাব্য পুনরায় চালুর সময় (তথ্যমূলক)' : 'Expected Reopening (Informational)'}
                  </span>
                  <p className="text-sm font-bold text-slate-900 mt-0.5 break-words">
                    {formatReopenDateTime(notice.reopenAt, language)}
                  </p>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    {isBn
                      ? 'কর্তৃপক্ষের অনুমোদন সাপেক্ষে পুনরায় চালু হবে'
                      : 'Service reopens when enabled by administration'}
                  </span>
                </div>
              </div>
            )}

            {notice.contactInfo && (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-3">
                <PhoneCall className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                    {isBn ? 'যোগাযোগ (ফোন বা ইমেইল)' : 'Contact Information'}
                  </span>
                  <p className="text-sm font-bold text-slate-900 mt-0.5 break-words">
                    {notice.contactInfo}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {notice.instructions && (
          <div className="p-4 rounded-2xl bg-sky-50/60 border border-sky-200 flex items-start gap-3">
            <Info className="w-5 h-5 text-[#0284C7] shrink-0 mt-0.5" />
            <div className="min-w-0">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#0284C7] block mb-1">
                {isBn ? 'অতিরিক্ত নির্দেশনা' : 'Additional Instructions'}
              </span>
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line break-words">
                {notice.instructions}
              </p>
            </div>
          </div>
        )}

        {(alternateAction || onBackHome || onFindTicket) && (
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-3">
            {alternateAction && (
              <button
                type="button"
                onClick={alternateAction.onClick}
                className="px-4 py-2.5 rounded-xl bg-[#0284C7] hover:bg-[#0EA5E9] text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
              >
                {alternateAction.label}
              </button>
            )}
            {onFindTicket && (
              <button
                type="button"
                onClick={onFindTicket}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Search className="w-3.5 h-3.5" />
                <span>{isBn ? 'বিদ্যমান টিকিট খুঁজুন' : 'Find Existing Ticket'}</span>
              </button>
            )}
            {onBackHome && (
              <button
                type="button"
                onClick={onBackHome}
                className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{isBn ? 'হোম পেজে ফিরে যান' : 'Return to Home'}</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
