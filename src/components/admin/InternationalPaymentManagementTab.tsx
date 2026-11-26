import React, { useEffect, useState } from 'react';
import {
  Globe,
  Save,
  RefreshCw,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Landmark,
  Phone,
  Mail,
  FileText,
  Calendar,
} from 'lucide-react';
import { Language } from '../../types';
import {
  DEFAULT_INTERNATIONAL_PAYMENT_INFO,
  InternationalPaymentInfo,
  InternationalPaymentService,
} from '../../services/internationalPaymentService';

interface InternationalPaymentManagementTabProps {
  language: Language;
  adminName?: string;
}

export const InternationalPaymentManagementTab: React.FC<
  InternationalPaymentManagementTabProps
> = ({ language, adminName = 'Super Admin' }) => {
  const isBn = language === 'bn';
  const [form, setForm] = useState<InternationalPaymentInfo>(() =>
    InternationalPaymentService.getInfo()
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(
    null
  );

  const loadFromDb = async (showNotice = false) => {
    setIsLoading(true);
    const res = await InternationalPaymentService.fetchFromSupabase();
    if (res.success) {
      setForm(res.data);
      if (showNotice) {
        setBanner({
          type: 'info',
          message: isBn
            ? 'ডাটাবেজ থেকে সর্বশেষ আন্তর্জাতিক পেমেন্ট তথ্য লোড করা হয়েছে।'
            : 'Loaded latest International Payment settings from Supabase.',
        });
      }
    } else if (res.error) {
      setBanner({ type: 'error', message: res.error });
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadFromDb(false);
  }, []);

  const updateField = <K extends keyof InternationalPaymentInfo>(
    key: K,
    value: InternationalPaymentInfo[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setBanner(null);
    const res = await InternationalPaymentService.saveToSupabase(form, adminName);
    if (res.success) {
      setForm(res.data);
      setBanner({
        type: 'success',
        message: isBn
          ? 'আন্তর্জাতিক পেমেন্ট পেজ সফলভাবে সুপাবেজ ডাটাবেজে সংরক্ষিত ও প্রকাশিত হয়েছে।'
          : 'International Payment page details saved to Supabase and updated live!',
      });
    } else {
      setBanner({
        type: 'error',
        message: res.error || 'Failed to save International Payment settings.',
      });
    }
    setIsSaving(false);
  };

  const handleReset = async () => {
    if (
      !confirm(
        isBn
          ? 'আপনি কি ডিফল্ট আন্তর্জাতিক পেমেন্ট তথ্যে ফিরে যেতে চান?'
          : 'Reset all International Payment page fields back to defaults?'
      )
    ) {
      return;
    }
    setIsSaving(true);
    const res = await InternationalPaymentService.saveToSupabase(
      { ...DEFAULT_INTERNATIONAL_PAYMENT_INFO },
      adminName
    );
    if (res.success) {
      setForm(res.data);
      setBanner({
        type: 'info',
        message: isBn ? 'ডিফল্ট তথ্য পুনরুদ্ধার করা হয়েছে।' : 'Reset to default template.',
      });
    } else if (res.error) {
      setBanner({ type: 'error', message: res.error });
    }
    setIsSaving(false);
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Header Controls */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl bg-sky-100 text-[#0284C7] flex items-center justify-center shrink-0">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">
              {isBn
                ? 'আন্তর্জাতিক পেমেন্ট পেজ ম্যানেজমেন্ট'
                : 'International Payment Page Editor'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isBn
                ? 'ডোনেশন পেজের আন্তর্জাতিক পেমেন্ট বাটনে ক্লিক করলে ভিজিটররা যে ব্যাংক, রাউটিং, মোবাইল ও নির্দেশনা পেজ দেখবে তা এখান থেকে এডিট করুন।'
                : 'Edit the standalone International Payment page shown when visitors click the International Payment button on the Donation page.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => loadFromDb(true)}
            disabled={isLoading || isSaving}
            className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isBn ? 'ডাটাবেজ রিফ্রেশ' : 'Reload DB'}</span>
          </button>

          <button
            type="button"
            onClick={handleReset}
            disabled={isSaving}
            className="px-3 py-2 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{isBn ? 'ডিফল্ট' : 'Reset'}</span>
          </button>

          <button
            type="submit"
            disabled={isSaving}
            className="px-4 py-2 rounded-xl bg-[#0284C7] hover:bg-[#0EA5E9] text-white text-xs font-bold shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? (isBn ? 'সংরক্ষণ হচ্ছে...' : 'Saving...') : isBn ? 'সেভ ও পাবলিশ' : 'Save & Publish'}</span>
          </button>
        </div>
      </div>

      {banner && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-semibold flex items-center gap-2 ${
            banner.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : banner.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-sky-50 border-sky-200 text-sky-800'
          }`}
        >
          {banner.type === 'error' ? (
            <AlertCircle className="w-4 h-4 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          )}
          <span>{banner.message}</span>
        </div>
      )}

      {/* Visibility & Header Content */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-2xs">
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#0284C7]" />
            <h3 className="text-sm font-bold text-slate-900">
              {isBn ? 'শিরোনাম, ইভেন্ট ও পরিচিতি বার্তা' : 'Header, Event Title & Intro Message'}
            </h3>
          </div>
          <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isEnabled}
              onChange={(e) => updateField('isEnabled', e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-[#0284C7]"
            />
            <span>{isBn ? 'ডোনেশন পেজে বাটন প্রদর্শন করুন' : 'Show International Payment Button'}</span>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Badge (English)</label>
            <input
              type="text"
              value={form.badgeEn}
              onChange={(e) => updateField('badgeEn', e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Badge (Bangla)</label>
            <input
              type="text"
              value={form.badgeBn}
              onChange={(e) => updateField('badgeBn', e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Page Title (English)</label>
            <input
              type="text"
              value={form.titleEn}
              onChange={(e) => updateField('titleEn', e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Page Title (Bangla)</label>
            <input
              type="text"
              value={form.titleBn}
              onChange={(e) => updateField('titleBn', e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Event Name Banner (English)</label>
            <input
              type="text"
              value={form.eventTitleEn}
              onChange={(e) => updateField('eventTitleEn', e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Event Name Banner (Bangla)</label>
            <input
              type="text"
              value={form.eventTitleBn}
              onChange={(e) => updateField('eventTitleBn', e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Welcome Message (English)</label>
            <textarea
              rows={2}
              value={form.subtitleEn}
              onChange={(e) => updateField('subtitleEn', e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Welcome Message (Bangla)</label>
            <textarea
              rows={2}
              value={form.subtitleBn}
              onChange={(e) => updateField('subtitleBn', e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Bank & Contact Fields */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-2xs">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <Landmark className="w-4 h-4 text-[#0284C7]" />
          <h3 className="text-sm font-bold text-slate-900">
            {isBn ? 'ব্যাংক, রাউটিং, সুইফট ও যোগাযোগ তথ্য' : 'Bank Account, Routing, SWIFT & Contact Details'}
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Bank Name</label>
            <input
              type="text"
              value={form.bankName}
              onChange={(e) => updateField('bankName', e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Branch Name</label>
            <input
              type="text"
              value={form.branchName}
              onChange={(e) => updateField('branchName', e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Branch Address</label>
            <input
              type="text"
              value={form.branchAddress}
              onChange={(e) => updateField('branchAddress', e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Account Name</label>
            <input
              type="text"
              value={form.accountName}
              onChange={(e) => updateField('accountName', e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Bank Account Number</label>
            <input
              type="text"
              value={form.accountNumber}
              onChange={(e) => updateField('accountNumber', e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Routing Number</label>
            <input
              type="text"
              value={form.routingNumber}
              onChange={(e) => updateField('routingNumber', e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">SWIFT / BIC Code</label>
            <input
              type="text"
              value={form.swiftCode}
              onChange={(e) => updateField('swiftCode', e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
              <Phone className="w-3.5 h-3.5 text-[#0284C7]" />
              <span>Mobile / WhatsApp Number</span>
            </label>
            <input
              type="text"
              value={form.mobileNumber}
              onChange={(e) => updateField('mobileNumber', e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
              <Mail className="w-3.5 h-3.5 text-[#0284C7]" />
              <span>Contact Email Address</span>
            </label>
            <input
              type="email"
              value={form.contactEmail}
              onChange={(e) => updateField('contactEmail', e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Written Instructions & Footer Note */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-2xs">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <FileText className="w-4 h-4 text-[#0284C7]" />
          <h3 className="text-sm font-bold text-slate-900">
            {isBn ? 'লিখিত নির্দেশনা ও অতিরিক্ত নোট' : 'Written Instructions & Confirmation Note'}
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">
              Written Instructions (English, one step per line)
            </label>
            <textarea
              rows={5}
              value={form.instructionsEn}
              onChange={(e) => updateField('instructionsEn', e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs leading-relaxed"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">
              Written Instructions (Bangla, one step per line)
            </label>
            <textarea
              rows={5}
              value={form.instructionsBn}
              onChange={(e) => updateField('instructionsBn', e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs leading-relaxed"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Footer Note (English)</label>
            <textarea
              rows={2}
              value={form.footerNoteEn}
              onChange={(e) => updateField('footerNoteEn', e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Footer Note (Bangla)</label>
            <textarea
              rows={2}
              value={form.footerNoteBn}
              onChange={(e) => updateField('footerNoteBn', e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
            />
          </div>
        </div>
      </div>
    </form>
  );
};
