import React, { useState } from 'react';
import {
  History,
  Target,
  MapPin,
  Phone,
  Mail,
  Send,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { Language, ContactInquiry } from '../types';
import { translations } from '../i18n/translations';
import { supabase } from '../services/supabase';

interface AboutContactPageProps {
  language: Language;
}

export const AboutContactPage: React.FC<AboutContactPageProps> = ({ language }) => {
  const t = translations[language];
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [phoneTouched, setPhoneTouched] = useState(false);

  // Exact Bangladeshi 11-digit mobile validation: starts with 01 followed by [3-9] and 8 more digits
  const isPhoneValid = /^01[3-9]\d{8}$/.test(phone.trim());
  const isMessageValid = message.trim().length > 0;
  const isNameValid = name.trim().length > 0;
  const isFormValid = isNameValid && isPhoneValid && isMessageValid;

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow digits to prevent accidental letters
    const val = e.target.value.replace(/[^\d]/g, '').slice(0, 11);
    setPhone(val);
    if (!phoneTouched && val.length > 0) {
      setPhoneTouched(true);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || submitting) return;

    setSubmitting(true);
    const inquiry: ContactInquiry = {
      id: `INQ-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: name.trim(),
      mobileNumber: phone.trim(),
      message: message.trim(),
      createdAt: new Date().toISOString(),
      status: 'NEW',
    };

    // 1. Save locally to localStorage
    try {
      const stored = localStorage.getItem('plscf_contact_inquiries');
      const list: ContactInquiry[] = stored ? JSON.parse(stored) : [];
      list.unshift(inquiry);
      localStorage.setItem('plscf_contact_inquiries', JSON.stringify(list.slice(0, 100)));
    } catch (err) {
      console.warn('Local storage inquiry error:', err);
    }

    // 2. Save to Supabase inquiries table
    try {
      await supabase.from('inquiries').insert({
        id: inquiry.id,
        name: inquiry.name,
        mobile_number: inquiry.mobileNumber,
        message: inquiry.message,
        created_at: inquiry.createdAt,
        status: inquiry.status,
      });
    } catch (err) {
      console.warn('Supabase inquiry insert note:', err);
    }

    setSubmitting(false);
    setFeedbackSent(true);
    setTimeout(() => {
      setName('');
      setPhone('');
      setMessage('');
      setPhoneTouched(false);
      setFeedbackSent(false);
    }, 4500);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-12 space-y-16">
      {/* Institutional Overview & History */}
      <section className="space-y-6">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="flex justify-center mb-2">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-white p-1 shadow-lg border-2 border-[#0284C7] overflow-hidden flex items-center justify-center">
              <img
                src="/assets/school_logo.png"
                alt="Police Lines School & College Faridpur Crest"
                className="w-full h-full object-contain rounded-full"
              />
            </div>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#E2EEF8] text-[#0284C7] text-xs font-bold border border-[#0284C7]/20">
            <img src="/assets/school_logo.png" alt="School Logo" className="w-4 h-4 object-contain rounded-full" />
            <span>{t.institutionSubtitle}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-[#0F172A] tracking-tight">
            {t.aboutHeading}
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            {t.tagline}
          </p>
        </div>

        <div className="bg-white rounded-3xl p-8 sm:p-12 border border-[#E2EEF8] shadow-sm grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-[#0F172A]">
              <History className="w-5 h-5 text-[#0284C7]" />
              <h2 className="text-xl font-bold text-[#0F172A]">{t.historyTitle}</h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {t.historyContent}
            </p>
            <div className="pt-2 text-xs text-slate-500 space-y-1 border-t border-[#E2EEF8]">
              <div>• <strong>Location:</strong> Joyrampur, Faridpur Sadar, Dhaka Division</div>
              <div>• <strong>Affiliation:</strong> Board of Intermediate & Secondary Education, Dhaka</div>
              <div>• <strong>Patron:</strong> Faridpur District Police Force</div>
            </div>
          </div>

          <div className="rounded-2xl overflow-hidden aspect-4/3 shadow-md border border-[#E2EEF8] bg-slate-100">
            <img
              src="https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?w=800&auto=format&fit=crop&q=80"
              alt="Police Lines Campus Grounds"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* Reunion Objectives */}
      <section className="space-y-6">
        <div className="flex items-center gap-2 justify-center">
          <Target className="w-5 h-5 text-[#0284C7]" />
          <h2 className="text-2xl font-black text-[#0F172A]">
            {language === 'bn' ? 'পুনর্মিলনী ২০২৭-এর মূল উদ্দেশ্য' : 'Reunion 2027 Core Objectives'}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl p-6 border border-[#E2EEF8] shadow-xs space-y-2">
            <h3 className="font-bold text-[#0F172A] text-base">
              {language === 'bn' ? '১. প্রাক্তন ও বর্তমানের মেলবন্ধন' : '1. Cross-Generation Network'}
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              {language === 'bn'
                ? '১৯৬২ থেকে ২০২৫ সাল পর্যন্ত সকল ব্যাচের শিক্ষার্থীদের মধ্যে পেশাগত ও ভ্রাতৃত্বপূর্ণ সুসম্পর্ক সৃষ্টি করা।'
                : 'Uniting alumni across civil service, defense, medicine, technology, academia and commerce with current students.'}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-[#E2EEF8] shadow-xs space-y-2">
            <h3 className="font-bold text-[#0F172A] text-base">
              {language === 'bn' ? '২. ক্যাম্পাস ও ল্যাব আধুনিকায়ন' : '2. Campus Modernization'}
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              {language === 'bn'
                ? 'সংগৃহীত অনুদানের মাধ্যমে অত্যাধুনিক বিজ্ঞান গবেষণাগার, স্মার্ট ক্লাসরুম ও কেন্দ্রীয় লাইব্রেরির আধুনিকায়ন।'
                : 'Directing reunion development funds towards modern science laboratories, robotics clubs, and smart classrooms.'}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-[#E2EEF8] shadow-xs space-y-2">
            <h3 className="font-bold text-[#0F172A] text-base">
              {language === 'bn' ? '৩. অসচ্ছল শিক্ষার্থী কল্যাণ তহবিল' : '3. Student Welfare & Trust'}
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              {language === 'bn'
                ? 'মেধাবী অথচ আর্থিক সংকটে থাকা শিক্ষার্থীদের শিক্ষাবৃত্তি ও চিকিৎসা সহায়তা প্রদানে স্থায়ী ট্রাস্ট গঠন।'
                : 'Establishing a perpetual scholarship endowment fund for underprivileged meritorious students.'}
            </p>
          </div>
        </div>
      </section>

      {/* Contact & Secretariat Helpdesk Form */}
      <section className="bg-white rounded-3xl p-8 sm:p-12 border border-[#E2EEF8] shadow-sm grid grid-cols-1 md:grid-cols-2 gap-10">
        <div className="space-y-6">
          <div>
            <span className="text-xs font-bold text-[#0284C7] uppercase tracking-wider block">
              Direct Contact
            </span>
            <h2 className="text-2xl font-black text-[#0F172A] mt-1">{t.helpdeskTitle}</h2>
            <p className="text-xs text-slate-500 mt-1">
              {language === 'bn'
                ? 'যেকোনো জিজ্ঞাসা, টিকিট সংক্রান্ত সমস্যা বা সহায়তার জন্য যোগাযোগ করুন।'
                : 'Reach out to the Reunion secretariat team for queries, gate passes or batch coordination.'}
            </p>
          </div>

          <div className="space-y-4 text-xs text-slate-700">
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-slate-900">Physical Campus Secretariat:</strong>
                <span>{t.addressText}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Phone className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <strong className="block text-slate-900">Helpline Hotlines:</strong>
                <span>{t.helplinePhone}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-[#263B8C] shrink-0" />
              <div>
                <strong className="block text-slate-900">Official Secretariat Email:</strong>
                <span>{t.helplineEmail}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Helpdesk Message Form with Strict Real-time Bangladeshi Mobile Validation */}
        <div className="bg-[#F3F4F6] p-6 rounded-2xl border border-slate-200 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm">
              {language === 'bn' ? 'সচিবালয়ে বার্তা পাঠান' : 'Send Inquiry Message'}
            </h3>
            <span className="text-[11px] text-slate-500 flex items-center gap-1">
              <HelpCircle className="w-3.5 h-3.5" />
              {language === 'bn' ? '১১ ডিজিট ফোন ও বার্তা আবশ্যক' : '11-digit phone & message required'}
            </span>
          </div>

          {feedbackSent ? (
            <div className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-xs flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>
                {language === 'bn'
                  ? 'আপনার বার্তা সফলভাবে সচিবালয়ে জমা হয়েছে। শীঘ্রই যোগাযোগ করা হবে।'
                  : 'Your inquiry has been received. Our team will contact you shortly.'}
              </span>
            </div>
          ) : (
            <form onSubmit={handleSendMessage} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {language === 'bn' ? 'আপনার পূর্ণ নাম' : 'Your Full Name'} <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={language === 'bn' ? 'উদা: মোঃ শহিদুল আলম' : 'e.g. Shahidul Alam'}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#172554] text-slate-900"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-slate-700">
                    {language === 'bn' ? 'বাংলাদেশি মোবাইল নম্বর' : 'Bangladeshi Mobile Number'}{' '}
                    <span className="text-rose-600">*</span>
                  </label>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {phone.length}/11 {language === 'bn' ? 'ডিজিট' : 'digits'}
                  </span>
                </div>

                <input
                  type="tel"
                  value={phone}
                  onChange={handlePhoneChange}
                  onBlur={() => setPhoneTouched(true)}
                  placeholder="017XXXXXXXX"
                  maxLength={11}
                  className={`w-full px-3 py-2 rounded-xl font-mono text-sm bg-white transition-colors focus:outline-none focus:ring-2 ${
                    phoneTouched && !isPhoneValid
                      ? 'border-2 border-rose-500 focus:ring-rose-400 bg-rose-50/30 text-rose-900'
                      : isPhoneValid
                      ? 'border-2 border-emerald-500 focus:ring-emerald-400 text-emerald-900'
                      : 'border border-slate-300 focus:ring-[#172554] text-slate-900'
                  }`}
                  required
                />

                {/* Real-time Validation Error Bar / Feedback */}
                {phoneTouched && !isPhoneValid && (
                  <div className="mt-1.5 p-2 rounded-lg bg-rose-50 border border-rose-300 text-rose-700 text-[11px] flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>
                      {language === 'bn'
                        ? 'অবৈধ নম্বর: বাংলাদেশি নম্বর ০১ দিয়ে শুরু এবং ঠিক ১১ ডিজিট হতে হবে (যেমন: ০১৭১২৩৪৫৬৭৮)।'
                        : 'Invalid number: Bangladeshi mobile number must start with 01 and be exactly 11 digits (e.g., 01712345678).'}
                    </span>
                  </div>
                )}

                {isPhoneValid && (
                  <div className="mt-1.5 p-1.5 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-700 text-[11px] flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                    <span>
                      {language === 'bn'
                        ? 'সঠিক বাংলাদেশি মোবাইল নম্বর যাচাইকৃত।'
                        : 'Valid 11-digit Bangladeshi mobile number.'}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {language === 'bn' ? 'জিজ্ঞাসা / বার্তা' : 'Inquiry / Message'}{' '}
                  <span className="text-rose-600">*</span>
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  placeholder={
                    language === 'bn'
                      ? 'আপনার জিজ্ঞাসা বা বার্তা এখানে বিস্তারিত লিখুন...'
                      : 'Write your question or message in detail...'
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#172554] text-slate-900"
                  required
                />
                {!message.trim() && (
                  <p className="text-[10px] text-slate-500 mt-1">
                    {language === 'bn'
                      ? 'বার্তা অপশনে অবশ্যই কিছু লিখতে হবে।'
                      : 'Message body cannot be empty.'}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={!isFormValid || submitting}
                className={`w-full py-3.5 rounded-full font-bold transition-all flex items-center justify-center gap-2 text-xs sm:text-sm ${
                  isFormValid && !submitting
                    ? 'bg-[#0284C7] hover:bg-[#0EA5E9] text-white cursor-pointer shadow-md shadow-sky-600/30'
                    : 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-70'
                }`}
              >
                <Send className="w-3.5 h-3.5" />
                <span>
                  {submitting
                    ? language === 'bn'
                      ? 'জমা হচ্ছে...'
                      : 'Submitting...'
                    : language === 'bn'
                    ? 'বার্তা পাঠান'
                    : 'Send Message'}
                </span>
              </button>

              {!isFormValid && (
                <p className="text-[10px] text-center text-slate-500">
                  {language === 'bn'
                    ? 'সঠিক নাম, ১১ ডিজিট মোবাইল নম্বর এবং বার্তা দেওয়ার পর বাটন সচল হবে।'
                    : 'Submit button activates once valid name, 11-digit BD mobile, and message are filled.'}
                </p>
              )}
            </form>
          )}
        </div>
      </section>
    </div>
  );
};
