import React, { useState, useEffect, useRef } from 'react';
import {
  Save,
  RefreshCw,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Globe,
  History,
  Target,
  Phone,
  MapPin,
  Mail,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Eye,
  Upload,
  Sparkles,
  FileEdit,
  Image as ImageIcon,
  MessageSquare,
} from 'lucide-react';
import { Language } from '../../types';
import {
  AboutContactContent,
  AboutObjectiveItem,
  DEFAULT_ABOUT_CONTACT_CONTENT,
} from '../../types/aboutContact';
import { AboutContactService } from '../../services/aboutContactService';
import { EventStore } from '../../services/eventStore';

interface AboutContactManagementTabProps {
  language: Language;
  adminName?: string;
}

export const AboutContactManagementTab: React.FC<AboutContactManagementTabProps> = ({
  language,
  adminName = 'Super Admin',
}) => {
  const isBn = language === 'bn';

  const [form, setForm] = useState<AboutContactContent>(() => AboutContactService.getContent());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [showPreview, setShowPreview] = useState<boolean>(false);
  const [previewLang, setPreviewLang] = useState<Language>(language);
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  const imageFileInputRef = useRef<HTMLInputElement>(null);

  // Fetch authoritative data from Supabase on mount
  const loadFromDatabase = async (showBanner = false) => {
    setIsLoading(true);
    const res = await AboutContactService.fetchFromSupabase();
    if (res.success) {
      setForm(res.data);
      setIsDirty(false);
      if (showBanner) {
        setStatusBanner({
          type: 'info',
          message: isBn
            ? 'ডাটাবেজ থেকে সর্বশেষ তথ্য লোড করা হয়েছে।'
            : 'Loaded latest About & Contact content from Supabase database.',
        });
      }
    } else if (res.error) {
      setStatusBanner({
        type: 'error',
        message: isBn
          ? `ডাটাবেজ থেকে লোড করতে সমস্যা হয়েছে: ${res.error}`
          : `Database fetch notice: ${res.error}`,
      });
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadFromDatabase(false);
    const cleanup = AboutContactService.initRealtimeSync();
    const unsub = AboutContactService.subscribe((updated) => {
      // Only auto-replace form from external realtime updates when user is not actively editing unsaved changes
      setIsDirty((currentlyDirty) => {
        if (!currentlyDirty) {
          setForm(updated);
        }
        return currentlyDirty;
      });
    });

    return () => {
      unsub();
      cleanup();
    };
  }, []);

  const updateField = <K extends keyof AboutContactContent>(
    key: K,
    value: AboutContactContent[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
    if (statusBanner?.type === 'success') {
      setStatusBanner(null);
    }
  };

  const updateObjective = (
    index: number,
    key: keyof AboutObjectiveItem,
    value: string
  ) => {
    setForm((prev) => {
      const next = [...prev.objectives];
      next[index] = { ...next[index], [key]: value };
      return { ...prev, objectives: next };
    });
    setIsDirty(true);
  };

  const addObjective = () => {
    const nextIdx = form.objectives.length + 1;
    const newItem: AboutObjectiveItem = {
      id: `obj-${Date.now()}`,
      titleEn: `${nextIdx}. New Objective`,
      titleBn: `${nextIdx}. নতুন উদ্দেশ্য`,
      descriptionEn: 'Describe this reunion objective in English...',
      descriptionBn: 'বাংলায় এই পুনর্মিলনীর উদ্দেশ্য লিখুন...',
    };
    updateField('objectives', [...form.objectives, newItem]);
  };

  const removeObjective = (index: number) => {
    if (form.objectives.length <= 1) return;
    updateField(
      'objectives',
      form.objectives.filter((_, i) => i !== index)
    );
  };

  const moveObjective = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= form.objectives.length) return;
    const next = [...form.objectives];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    updateField('objectives', next);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxWidth = 1000;
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const compressed = canvas.toDataURL('image/jpeg', 0.8);
          updateField('campusImageUrl', compressed);
        }
      };
      if (typeof reader.result === 'string') {
        img.src = reader.result;
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSave = async (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    if (isSaving) return;

    setIsSaving(true);
    setStatusBanner(null);

    const res = await AboutContactService.saveContent(form, adminName);

    if (res.success) {
      setForm(res.data);
      setIsDirty(false);
      setStatusBanner({
        type: 'success',
        message: isBn
          ? 'About & Contact পেজের সকল পরিবর্তন ডাটাবেজে সংরক্ষিত হয়েছে এবং সকল ব্যবহারকারীর জন্য তাৎক্ষণিকভাবে লাইভ আপডেট হয়েছে!'
          : 'All About & Contact page changes saved to database and pushed live to all users immediately!',
      });

      try {
        EventStore.recordAuditHistory({
          adminId: 'SUPER_ADMIN_MASTER',
          adminName,
          entityType: 'REGISTRATION',
          entityId: 'ABOUT_CONTACT_CMS',
          action: 'UPDATE_SETTINGS',
          reason: 'Updated About & Contact page content in Supabase CMS',
          newValue: JSON.stringify({
            aboutHeadingEn: res.data.aboutHeadingEn,
            helplinePhoneEn: res.data.helplinePhoneEn,
            helplineEmail: res.data.helplineEmail,
            objectivesCount: res.data.objectives.length,
            updatedBy: adminName,
          }),
        });
      } catch (_) {}
    } else {
      setStatusBanner({
        type: 'error',
        message: isBn
          ? `ডাটাবেজে সংরক্ষণ ব্যর্থ হয়েছে: ${res.error || 'অজানা ত্রুটি'}`
          : `Failed to save to database: ${res.error || 'Unknown error'}`,
      });
    }

    setIsSaving(false);
  };

  const handleResetDefaults = async () => {
    const confirmed = window.confirm(
      isBn
        ? 'আপনি কি About & Contact পেজের সকল তথ্য ডিফল্ট অবস্থায় ফিরিয়ে নিতে চান?'
        : 'Reset all About & Contact page content back to the original institutional defaults and publish to database?'
    );
    if (!confirmed) return;

    setIsResetting(true);
    const res = await AboutContactService.resetToDefault(adminName);
    if (res.success) {
      setForm(res.data);
      setIsDirty(false);
      setStatusBanner({
        type: 'info',
        message: isBn
          ? 'ডিফল্ট তথ্য ডাটাবেজে পুনরায় সংরক্ষণ ও লাইভ করা হয়েছে।'
          : 'Default About & Contact content restored in database and synced live.',
      });
    } else {
      setStatusBanner({
        type: 'error',
        message: res.error || 'Reset failed',
      });
    }
    setIsResetting(false);
  };

  return (
    <div className="space-y-6">
      {/* ── TOP HEADER BAR ── */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-sky-950 rounded-3xl p-6 text-white shadow-md border border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-300 shrink-0">
              <FileEdit className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black tracking-tight text-white">
                  {isBn
                    ? 'About & Contact পেজ লাইভ এডিটর'
                    : 'About & Contact Page Live CMS Editor'}
                </h2>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {isBn ? 'রিয়েলটাইম ডাটাবেজ সিঙ্ক' : 'Realtime DB Sync'}
                </span>
                {isDirty && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-400/30">
                    {isBn ? 'অসংরক্ষিত পরিবর্তন' : 'Unsaved Changes'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                {isBn
                  ? 'এখান থেকে করা যেকোনো পরিবর্তন সরাসরি Supabase ডাটাবেজে সংরক্ষিত হয় এবং সকল ব্যবহারকারীর স্ক্রিনে তাৎক্ষণিকভাবে আপডেট হয়ে যায় (About & Contact পেজ এবং ফুটার সহ)।'
                  : 'All edits save directly to the Supabase database and propagate immediately in real time to every active user viewing About & Contact or the site Footer.'}
              </p>
              {form.updatedAt && (
                <p className="text-[11px] text-slate-400 mt-1.5 font-mono">
                  {isBn ? 'সর্বশেষ আপডেট:' : 'Last saved:'}{' '}
                  {new Date(form.updatedAt).toLocaleString()} ({form.updatedBy || 'Super Admin'})
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
            <button
              type="button"
              onClick={() => setShowPreview((p) => !p)}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer border border-white/15"
            >
              <Eye className="w-3.5 h-3.5 text-sky-300" />
              <span>
                {showPreview
                  ? isBn
                    ? 'প্রিভিউ লুকান'
                    : 'Hide Preview'
                  : isBn
                  ? 'লাইভ প্রিভিউ'
                  : 'Live Preview'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => loadFromDatabase(true)}
              disabled={isLoading}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer border border-white/15 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isBn ? 'রিফ্রেশ' : 'Sync DB'}</span>
            </button>

            <button
              type="button"
              onClick={handleResetDefaults}
              disabled={isResetting || isSaving}
              className="px-3.5 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer border border-rose-400/30 disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{isBn ? 'ডিফল্ট রিসেট' : 'Reset Defaults'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleSave()}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black transition-all shadow-lg shadow-emerald-500/25 flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              <Save className="w-3.5 h-3.5" />
              <span>
                {isSaving
                  ? isBn
                    ? 'সংরক্ষণ হচ্ছে...'
                    : 'Publishing...'
                  : isBn
                  ? 'ডাটাবেজে সেভ ও লাইভ করুন'
                  : 'Save & Publish Live'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* ── STATUS FEEDBACK BANNER ── */}
      {statusBanner && (
        <div
          className={`p-4 rounded-2xl border flex items-center gap-3 text-xs font-semibold ${
            statusBanner.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : statusBanner.type === 'error'
              ? 'bg-rose-50 border-rose-300 text-rose-900'
              : 'bg-sky-50 border-sky-300 text-sky-900'
          }`}
        >
          {statusBanner.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : statusBanner.type === 'error' ? (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          ) : (
            <Sparkles className="w-5 h-5 text-sky-600 shrink-0" />
          )}
          <span>{statusBanner.message}</span>
        </div>
      )}

      {/* ── OPTIONAL LIVE PREVIEW PANEL ── */}
      {showPreview && (
        <div className="bg-slate-50 rounded-3xl p-6 border-2 border-sky-200 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-sky-600" />
              <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                {isBn ? 'প্রিভিউ মোড' : 'Live Page Preview'}
              </span>
            </div>
            <div className="inline-flex rounded-xl bg-white p-1 border border-slate-200">
              <button
                type="button"
                onClick={() => setPreviewLang('en')}
                className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                  previewLang === 'en' ? 'bg-slate-900 text-white' : 'text-slate-600'
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => setPreviewLang('bn')}
                className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                  previewLang === 'bn' ? 'bg-slate-900 text-white' : 'text-slate-600'
                }`}
              >
                বাংলা
              </button>
            </div>
          </div>

          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="inline-block px-3 py-1 rounded-full bg-sky-100 text-sky-800 text-[11px] font-bold">
              {previewLang === 'bn' ? form.institutionSubtitleBn : form.institutionSubtitleEn}
            </span>
            <h3 className="text-xl font-black text-slate-900">
              {previewLang === 'bn' ? form.aboutHeadingBn : form.aboutHeadingEn}
            </h3>
            <p className="text-xs text-slate-600">
              {previewLang === 'bn' ? form.taglineBn : form.taglineEn}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-5 items-center">
            <div className="space-y-2">
              <h4 className="font-bold text-slate-900 text-sm">
                {previewLang === 'bn' ? form.historyTitleBn : form.historyTitleEn}
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                {previewLang === 'bn' ? form.historyContentBn : form.historyContentEn}
              </p>
              <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-100 space-y-0.5">
                <div>
                  • <strong>{previewLang === 'bn' ? form.locationLabelBn : form.locationLabelEn}:</strong>{' '}
                  {previewLang === 'bn' ? form.locationValueBn : form.locationValueEn}
                </div>
                <div>
                  • <strong>{previewLang === 'bn' ? form.affiliationLabelBn : form.affiliationLabelEn}:</strong>{' '}
                  {previewLang === 'bn' ? form.affiliationValueBn : form.affiliationValueEn}
                </div>
                <div>
                  • <strong>{previewLang === 'bn' ? form.patronLabelBn : form.patronLabelEn}:</strong>{' '}
                  {previewLang === 'bn' ? form.patronValueBn : form.patronValueEn}
                </div>
              </div>
            </div>
            <div className="rounded-xl overflow-hidden aspect-4/3 bg-slate-100 border border-slate-200">
              <img
                src={form.campusImageUrl || DEFAULT_ABOUT_CONTACT_CONTENT.campusImageUrl}
                alt="Campus Preview"
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {form.objectives.map((obj) => (
              <div key={obj.id} className="bg-white rounded-xl p-4 border border-slate-200 space-y-1">
                <div className="text-xs font-bold text-slate-900">
                  {previewLang === 'bn' ? obj.titleBn : obj.titleEn}
                </div>
                <p className="text-[11px] text-slate-600">
                  {previewLang === 'bn' ? obj.descriptionBn : obj.descriptionEn}
                </p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-200 text-xs space-y-1.5">
            <div className="font-bold text-slate-900">
              {previewLang === 'bn' ? form.helpdeskTitleBn : form.helpdeskTitleEn}
            </div>
            <div className="text-slate-600">
              {previewLang === 'bn' ? form.addressBn : form.addressEn}
            </div>
            <div className="text-slate-600">
              {previewLang === 'bn' ? form.helplinePhoneBn : form.helplinePhoneEn} • {form.helplineEmail}
            </div>
          </div>
        </div>
      )}

      {/* ── MAIN EDITOR FORM ── */}
      <form onSubmit={handleSave} className="space-y-6">
        {/* SECTION 1: PAGE HEADER & HERO OVERVIEW */}
        <section className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">
                {isBn ? '১. পেজ শিরোনাম ও প্রাতিষ্ঠানিক পরিচিতি' : '1. Page Header & Institution Overview'}
              </h3>
              <p className="text-[11px] text-slate-500">
                {isBn
                  ? 'About & Contact পেজের একদম উপরের ব্যাজ, শিরোনাম এবং ট্যাগলাইন।'
                  : 'Top badge, main page heading, and subtitle displayed at the top of the About & Contact page.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Institution Subtitle (English)
              </label>
              <input
                type="text"
                value={form.institutionSubtitleEn}
                onChange={(e) => updateField('institutionSubtitleEn', e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-hidden"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Institution Subtitle (বাংলা)
              </label>
              <input
                type="text"
                value={form.institutionSubtitleBn}
                onChange={(e) => updateField('institutionSubtitleBn', e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-hidden"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Main Heading (English)
              </label>
              <input
                type="text"
                value={form.aboutHeadingEn}
                onChange={(e) => updateField('aboutHeadingEn', e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-hidden"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Main Heading (বাংলা)
              </label>
              <input
                type="text"
                value={form.aboutHeadingBn}
                onChange={(e) => updateField('aboutHeadingBn', e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-hidden"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Tagline (English)
              </label>
              <input
                type="text"
                value={form.taglineEn}
                onChange={(e) => updateField('taglineEn', e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-hidden"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Tagline (বাংলা)
              </label>
              <input
                type="text"
                value={form.taglineBn}
                onChange={(e) => updateField('taglineBn', e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-hidden"
                required
              />
            </div>
          </div>
        </section>

        {/* SECTION 2: INSTITUTIONAL HISTORY & CAMPUS PHOTO */}
        <section className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">
                {isBn ? '২. প্রতিষ্ঠানের ইতিহাস, তথ্য ও ক্যাম্পাস ছবি' : '2. History Narrative, Key Facts & Campus Photo'}
              </h3>
              <p className="text-[11px] text-slate-500">
                {isBn
                  ? 'ইতিহাসের বিবরণ, অবস্থান, অধিভুক্তি, পৃষ্ঠপোষক এবং ক্যাম্পাসের ছবি পরিবর্তন করুন।'
                  : 'Edit the history card text, institutional metadata lines, and campus photograph.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                History Card Title (English)
              </label>
              <input
                type="text"
                value={form.historyTitleEn}
                onChange={(e) => updateField('historyTitleEn', e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-hidden"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                History Card Title (বাংলা)
              </label>
              <input
                type="text"
                value={form.historyTitleBn}
                onChange={(e) => updateField('historyTitleBn', e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-hidden"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                History Narrative (English)
              </label>
              <textarea
                rows={4}
                value={form.historyContentEn}
                onChange={(e) => updateField('historyContentEn', e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-hidden"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                History Narrative (বাংলা)
              </label>
              <textarea
                rows={4}
                value={form.historyContentBn}
                onChange={(e) => updateField('historyContentBn', e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-hidden"
                required
              />
            </div>
          </div>

          {/* Key Facts Grid */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              {isBn ? 'সংক্ষিপ্ত প্রাতিষ্ঠানিক তথ্য (Bullets)' : 'Institutional Fact Bullets'}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  value={form.locationLabelEn}
                  onChange={(e) => updateField('locationLabelEn', e.target.value)}
                  placeholder="Label (EN)"
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold"
                />
                <input
                  type="text"
                  value={form.locationValueEn}
                  onChange={(e) => updateField('locationValueEn', e.target.value)}
                  placeholder="Value (EN)"
                  className="col-span-2 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  value={form.locationLabelBn}
                  onChange={(e) => updateField('locationLabelBn', e.target.value)}
                  placeholder="লেবেল (বাংলা)"
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold"
                />
                <input
                  type="text"
                  value={form.locationValueBn}
                  onChange={(e) => updateField('locationValueBn', e.target.value)}
                  placeholder="তথ্য (বাংলা)"
                  className="col-span-2 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  value={form.affiliationLabelEn}
                  onChange={(e) => updateField('affiliationLabelEn', e.target.value)}
                  placeholder="Label (EN)"
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold"
                />
                <input
                  type="text"
                  value={form.affiliationValueEn}
                  onChange={(e) => updateField('affiliationValueEn', e.target.value)}
                  placeholder="Value (EN)"
                  className="col-span-2 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  value={form.affiliationLabelBn}
                  onChange={(e) => updateField('affiliationLabelBn', e.target.value)}
                  placeholder="লেবেল (বাংলা)"
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold"
                />
                <input
                  type="text"
                  value={form.affiliationValueBn}
                  onChange={(e) => updateField('affiliationValueBn', e.target.value)}
                  placeholder="তথ্য (বাংলা)"
                  className="col-span-2 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  value={form.patronLabelEn}
                  onChange={(e) => updateField('patronLabelEn', e.target.value)}
                  placeholder="Label (EN)"
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold"
                />
                <input
                  type="text"
                  value={form.patronValueEn}
                  onChange={(e) => updateField('patronValueEn', e.target.value)}
                  placeholder="Value (EN)"
                  className="col-span-2 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  value={form.patronLabelBn}
                  onChange={(e) => updateField('patronLabelBn', e.target.value)}
                  placeholder="লেবেল (বাংলা)"
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold"
                />
                <input
                  type="text"
                  value={form.patronValueBn}
                  onChange={(e) => updateField('patronValueBn', e.target.value)}
                  placeholder="তথ্য (বাংলা)"
                  className="col-span-2 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                />
              </div>
            </div>
          </div>

          {/* Campus Image */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row gap-4 items-center">
            <div className="w-full sm:w-44 aspect-4/3 rounded-xl overflow-hidden bg-slate-200 border border-slate-300 shrink-0">
              {form.campusImageUrl ? (
                <img
                  src={form.campusImageUrl}
                  alt="Campus"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400">
                  <ImageIcon className="w-6 h-6" />
                </div>
              )}
            </div>
            <div className="flex-1 w-full space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                {isBn ? 'ক্যাম্পাস ছবির URL অথবা আপলোড করুন' : 'Campus Feature Image URL or Upload'}
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={form.campusImageUrl}
                  onChange={(e) => updateField('campusImageUrl', e.target.value)}
                  placeholder="https://..."
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-mono"
                />
                <input
                  ref={imageFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => imageFileInputRef.current?.click()}
                  className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{isBn ? 'ছবি আপলোড' : 'Upload Photo'}</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 3: CORE OBJECTIVES */}
        <section className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
                <Target className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">
                  {isBn ? '৩. পুনর্মিলনীর মূল উদ্দেশ্যসমূহ' : '3. Reunion Core Objectives Cards'}
                </h3>
                <p className="text-[11px] text-slate-500">
                  {isBn
                    ? 'কার্ডগুলোর শিরোনাম ও বিবরণ সম্পাদনা করুন অথবা নতুন কার্ড যোগ করুন।'
                    : 'Customize section heading and individual objective cards.'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={addObjective}
              className="px-3.5 py-2 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isBn ? 'নতুন উদ্দেশ্য যোগ করুন' : 'Add Objective Card'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Objectives Section Heading (English)
              </label>
              <input
                type="text"
                value={form.objectivesHeadingEn}
                onChange={(e) => updateField('objectivesHeadingEn', e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Objectives Section Heading (বাংলা)
              </label>
              <input
                type="text"
                value={form.objectivesHeadingBn}
                onChange={(e) => updateField('objectivesHeadingBn', e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs"
                required
              />
            </div>
          </div>

          <div className="space-y-3">
            {form.objectives.map((obj, idx) => (
              <div
                key={obj.id}
                className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-700">
                    {isBn ? `কার্ড #${idx + 1}` : `Objective Card #${idx + 1}`}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveObjective(idx, -1)}
                      disabled={idx === 0}
                      className="p-1 rounded-lg text-slate-500 hover:bg-white disabled:opacity-30 cursor-pointer"
                      aria-label="Move objective up"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveObjective(idx, 1)}
                      disabled={idx === form.objectives.length - 1}
                      className="p-1 rounded-lg text-slate-500 hover:bg-white disabled:opacity-30 cursor-pointer"
                      aria-label="Move objective down"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    {form.objectives.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeObjective(idx)}
                        className="p-1 rounded-lg text-rose-600 hover:bg-rose-100 cursor-pointer"
                        aria-label="Remove objective"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Title (English)
                    </label>
                    <input
                      type="text"
                      value={obj.titleEn}
                      onChange={(e) => updateObjective(idx, 'titleEn', e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Title (বাংলা)
                    </label>
                    <input
                      type="text"
                      value={obj.titleBn}
                      onChange={(e) => updateObjective(idx, 'titleBn', e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Description (English)
                    </label>
                    <textarea
                      rows={2}
                      value={obj.descriptionEn}
                      onChange={(e) => updateObjective(idx, 'descriptionEn', e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Description (বাংলা)
                    </label>
                    <textarea
                      rows={2}
                      value={obj.descriptionBn}
                      onChange={(e) => updateObjective(idx, 'descriptionBn', e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                      required
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 4: SECRETARIAT CONTACT & HELPDESK */}
        <section className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
              <Phone className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">
                {isBn ? '৪. সচিবালয় ও যোগাযোগ তথ্য (পেজ ও ফুটার)' : '4. Direct Contact & Secretariat Details (Page & Footer)'}
              </h3>
              <p className="text-[11px] text-slate-500">
                {isBn
                  ? 'ঠিকানা, হেল্পলাইন ফোন এবং ইমেইল পরিবর্তন করলে About & Contact পেজ এবং ফুটার উভয় স্থানেই আপডেট হবে।'
                  : 'Updating address, helpline numbers, or email automatically updates both the About & Contact page and the global website Footer.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Contact Badge Label (English)
              </label>
              <input
                type="text"
                value={form.contactBadgeEn}
                onChange={(e) => updateField('contactBadgeEn', e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Contact Badge Label (বাংলা)
              </label>
              <input
                type="text"
                value={form.contactBadgeBn}
                onChange={(e) => updateField('contactBadgeBn', e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Secretariat Title (English)
              </label>
              <input
                type="text"
                value={form.helpdeskTitleEn}
                onChange={(e) => updateField('helpdeskTitleEn', e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Secretariat Title (বাংলা)
              </label>
              <input
                type="text"
                value={form.helpdeskTitleBn}
                onChange={(e) => updateField('helpdeskTitleBn', e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Helpdesk Subtitle (English)
              </label>
              <input
                type="text"
                value={form.helpdeskSubtitleEn}
                onChange={(e) => updateField('helpdeskSubtitleEn', e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Helpdesk Subtitle (বাংলা)
              </label>
              <input
                type="text"
                value={form.helpdeskSubtitleBn}
                onChange={(e) => updateField('helpdeskSubtitleBn', e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs"
                required
              />
            </div>

            <div>
              <div className="text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-rose-500" />
                <span>Physical Address (English)</span>
              </div>
              <input
                type="text"
                value={form.addressEn}
                onChange={(e) => updateField('addressEn', e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs"
                required
              />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-rose-500" />
                <span>Physical Address (বাংলা)</span>
              </div>
              <input
                type="text"
                value={form.addressBn}
                onChange={(e) => updateField('addressBn', e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs"
                required
              />
            </div>

            <div>
              <div className="text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-amber-500" />
                <span>Helpline Phone Numbers (English)</span>
              </div>
              <input
                type="text"
                value={form.helplinePhoneEn}
                onChange={(e) => updateField('helplinePhoneEn', e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-mono"
                required
              />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-amber-500" />
                <span>Helpline Phone Numbers (বাংলা)</span>
              </div>
              <input
                type="text"
                value={form.helplinePhoneBn}
                onChange={(e) => updateField('helplinePhoneBn', e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-mono"
                required
              />
            </div>

            <div>
              <div className="text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-sky-500" />
                <span>Official Secretariat Email</span>
              </div>
              <input
                type="email"
                value={form.helplineEmail}
                onChange={(e) => updateField('helplineEmail', e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-mono"
                required
              />
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-2.5">
                <MessageSquare className="w-4 h-4 text-sky-600 shrink-0" />
                <div>
                  <div className="text-xs font-bold text-slate-800">
                    {isBn ? 'পাবলিক বার্তা/জিজ্ঞাসা ফর্ম' : 'Public Inquiry Message Form'}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {isBn
                      ? 'দর্শনার্থীরা সরাসরি সচিবালয়ে বার্তা পাঠাতে পারবেন কিনা'
                      : 'Allow visitors to submit messages via the contact form'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => updateField('showInquiryForm', !form.showInquiryForm)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-colors cursor-pointer ${
                  form.showInquiryForm
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'bg-slate-300 text-slate-700 hover:bg-slate-400'
                }`}
              >
                {form.showInquiryForm ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>
        </section>

        {/* STICKY BOTTOM PUBLISH BAR */}
        <div className="sticky bottom-4 z-20 bg-slate-900/95 backdrop-blur-md text-white rounded-2xl p-4 border border-slate-700 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-300 flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isDirty ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'
              }`}
            />
            <span>
              {isDirty
                ? isBn
                  ? 'আপনার কিছু পরিবর্তন এখনো ডাটাবেজে সংরক্ষণ করা হয়নি।'
                  : 'You have unsaved edits ready to publish to all users.'
                : isBn
                ? 'ডাটাবেজের সাথে সব পরিবর্তন সিঙ্ক করা আছে।'
                : 'All content is synchronized with the live Supabase database.'}
            </span>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            <span>
              {isSaving
                ? isBn
                  ? 'ডাটাবেজে সংরক্ষণ হচ্ছে...'
                  : 'Saving & Syncing Live...'
                : isBn
                ? 'সকল পরিবর্তন সংরক্ষণ ও লাইভ করুন'
                : 'Save Changes & Update All Users Live'}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
};
