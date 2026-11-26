import React, { useEffect, useState } from 'react';
import {
  Globe,
  Landmark,
  Copy,
  Check,
  Phone,
  Mail,
  ArrowLeft,
  ShieldCheck,
  FileText,
  Calendar,
} from 'lucide-react';
import { Language } from '../types';
import {
  InternationalPaymentInfo,
  InternationalPaymentService,
} from '../services/internationalPaymentService';

interface InternationalPaymentPageProps {
  language: Language;
  onNavigate?: (view: string) => void;
}

export const InternationalPaymentPage: React.FC<InternationalPaymentPageProps> = ({
  language,
  onNavigate,
}) => {
  const isBn = language === 'bn';
  const [info, setInfo] = useState<InternationalPaymentInfo>(() =>
    InternationalPaymentService.getInfo()
  );
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    InternationalPaymentService.fetchFromSupabase().catch(() => {});
    const unsub = InternationalPaymentService.subscribe((updated) => {
      setInfo(updated);
    });
    return unsub;
  }, []);

  const handleCopy = (field: string, value: string) => {
    if (!value) return;
    navigator.clipboard?.writeText(value).catch(() => {});
    setCopiedField(field);
    setTimeout(() => setCopiedField((cur) => (cur === field ? null : cur)), 2000);
  };

  const bankFields = [
    {
      key: 'bankName',
      label: isBn ? 'ব্যাংকের নাম' : 'Bank Name',
      value: info.bankName,
      mono: false,
    },
    {
      key: 'branchName',
      label: isBn ? 'শাখার নাম ও ঠিকানা' : 'Branch & Address',
      value: [info.branchName, info.branchAddress].filter(Boolean).join(' — '),
      mono: false,
    },
    {
      key: 'accountName',
      label: isBn ? 'অ্যাকাউন্টের নাম' : 'Account Name',
      value: info.accountName,
      mono: false,
    },
    {
      key: 'accountNumber',
      label: isBn ? 'ব্যাংক অ্যাকাউন্ট নম্বর' : 'Bank Account Number',
      value: info.accountNumber,
      mono: true,
    },
    {
      key: 'routingNumber',
      label: isBn ? 'রাউটিং নম্বর' : 'Routing Number',
      value: info.routingNumber,
      mono: true,
    },
    {
      key: 'swiftCode',
      label: isBn ? 'সুইফট / বিআইসি কোড' : 'SWIFT / BIC Code',
      value: info.swiftCode,
      mono: true,
    },
  ].filter((f) => f.value.trim().length > 0);

  const instructionLines = (isBn ? info.instructionsBn : info.instructionsEn)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      {/* Back Button */}
      {onNavigate && (
        <button
          type="button"
          onClick={() => onNavigate('donate')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white hover:bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 shadow-2xs transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-[#0284C7]" />
          <span>{isBn ? 'ডোনেশন পেজে ফিরে যান' : 'Back to Donation Page'}</span>
        </button>
      )}

      {/* Hero Header Card */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-sky-950 text-white rounded-3xl p-6 sm:p-8 border border-sky-500/30 shadow-xl space-y-4 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-sky-500/15 blur-3xl pointer-events-none" />
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-500/20 border border-sky-400/30 text-sky-200 text-xs font-bold">
          <Globe className="w-4 h-4 text-sky-300" />
          <span>{isBn ? info.badgeBn : info.badgeEn}</span>
        </div>

        <div className="space-y-2 relative z-10">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            {isBn ? info.titleBn : info.titleEn}
          </h1>
          <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
            {isBn ? info.subtitleBn : info.subtitleEn}
          </p>
        </div>

        <div className="pt-2 border-t border-white/10 flex items-center gap-2 text-xs text-amber-300 font-semibold relative z-10">
          <Calendar className="w-4 h-4 shrink-0" />
          <span>{isBn ? info.eventTitleBn : info.eventTitleEn}</span>
        </div>
      </div>

      {/* Bank Account Details Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-[#E2EEF8] shadow-md space-y-5">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
          <div className="w-10 h-10 rounded-2xl bg-sky-50 text-[#0284C7] border border-sky-100 flex items-center justify-center shrink-0">
            <Landmark className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900">
              {isBn ? 'ব্যাংক ও রেমিট্যান্স অ্যাকাউন্টের তথ্য' : 'Official Bank & Wire Transfer Details'}
            </h2>
            <p className="text-xs text-slate-500">
              {isBn ? 'কপি করতে পাশে থাকা বাটনে ক্লিক করুন' : 'Click the copy button beside any field'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {bankFields.map((item) => (
            <div
              key={item.key}
              className="p-3.5 rounded-2xl bg-slate-50/90 border border-slate-200/80 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                  {item.label}
                </span>
                <span
                  className={`text-sm font-bold text-slate-900 break-words block mt-0.5 ${
                    item.mono ? 'font-mono' : ''
                  }`}
                >
                  {item.value}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(item.key, item.value)}
                className="p-2 rounded-xl bg-white hover:bg-sky-50 border border-slate-200 text-slate-600 hover:text-[#0284C7] transition-colors shrink-0 cursor-pointer"
                title={isBn ? 'কপি করুন' : 'Copy'}
              >
                {copiedField === item.key ? (
                  <Check className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Contact & Receipt Submission Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-[#E2EEF8] shadow-md grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-4 rounded-2xl bg-sky-50/60 border border-sky-100 flex items-center justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <Phone className="w-5 h-5 text-[#0284C7] shrink-0 mt-0.5" />
            <div className="min-w-0">
              <span className="text-xs font-bold text-slate-600 block">
                {isBn ? 'মোবাইল / হোয়াটসঅ্যাপ হেল্পলাইন' : 'Mobile / WhatsApp Number'}
              </span>
              <span className="text-sm font-black text-slate-900 font-mono break-all block mt-0.5">
                {info.mobileNumber}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleCopy('mobileNumber', info.mobileNumber)}
            className="p-2 rounded-xl bg-white hover:bg-sky-100 border border-sky-200 text-[#0284C7] shrink-0 cursor-pointer"
            title={isBn ? 'কপি করুন' : 'Copy'}
          >
            {copiedField === 'mobileNumber' ? (
              <Check className="w-4 h-4 text-emerald-600" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>
        </div>

        <div className="p-4 rounded-2xl bg-sky-50/60 border border-sky-100 flex items-center justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <Mail className="w-5 h-5 text-[#0284C7] shrink-0 mt-0.5" />
            <div className="min-w-0">
              <span className="text-xs font-bold text-slate-600 block">
                {isBn ? 'অফিসিয়াল ইমেইল ঠিকানা' : 'Official Email Address'}
              </span>
              <a
                href={`mailto:${info.contactEmail}`}
                className="text-sm font-black text-[#0284C7] hover:underline break-all block mt-0.5"
              >
                {info.contactEmail}
              </a>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleCopy('contactEmail', info.contactEmail)}
            className="p-2 rounded-xl bg-white hover:bg-sky-100 border border-sky-200 text-[#0284C7] shrink-0 cursor-pointer"
            title={isBn ? 'কপি করুন' : 'Copy'}
          >
            {copiedField === 'contactEmail' ? (
              <Check className="w-4 h-4 text-emerald-600" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Written Payment Instructions */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-[#E2EEF8] shadow-md space-y-4">
        <div className="flex items-center gap-2 text-slate-900">
          <FileText className="w-5 h-5 text-[#0284C7]" />
          <h3 className="text-base font-black">
            {isBn ? 'পেমেন্ট প্রেরণ ও নিশ্চিতকরণ নির্দেশনা' : 'Transfer Instructions & Confirmation'}
          </h3>
        </div>
        <div className="space-y-2.5 text-sm text-slate-700 leading-relaxed">
          {instructionLines.map((line, i) => (
            <p key={i} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              {line}
            </p>
          ))}
        </div>

        {(isBn ? info.footerNoteBn : info.footerNoteEn) && (
          <div className="p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200 text-xs text-emerald-900 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{isBn ? info.footerNoteBn : info.footerNoteEn}</span>
          </div>
        )}
      </div>
    </div>
  );
};
