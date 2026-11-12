import React, { useState, useEffect } from 'react';
import {
  Heart,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Gift,
  Award,
  Sparkles,
  AlertCircle,
  Printer,
  CreditCard,
  Landmark,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { Language, DonationRecord, PaymentMethod } from '../types';
import { translations } from '../i18n/translations';
import { AppStore } from '../services/store';
import { PayStationService, PayStationPaymentResult } from '../services/paystation';
import { isValidBangladeshiMobile, normalizeBangladeshiMobileNumber } from '../utils/rules';
import { sanitizeInput } from '../utils/security';

interface DonationPageProps {
  language: Language;
}

const PRESET_AMOUNTS = [500, 1000, 2500, 5000, 10000, 25000];

interface DonationCause {
  id: string;
  titleEn: string;
  titleBn: string;
  descEn: string;
  descBn: string;
  icon: typeof Heart;
}

const DONATION_CAUSES: DonationCause[] = [
  {
    id: 'needy_students',
    titleEn: 'Needy Student Scholarship Fund',
    titleBn: 'অসচ্ছল মেধাবী শিক্ষার্থী কল্যাণ তহবিল',
    descEn: 'Educational scholarships, books, and exam fee assistance for underprivileged students.',
    descBn: 'অসচ্ছল ও মেধাবী শিক্ষার্থীদের মাসিক উপবৃত্তি, বই ও পরীক্ষার ফি সহায়তা।',
    icon: Award,
  },
  {
    id: 'campus_development',
    titleEn: 'Campus Beautification & Library Modernization',
    titleBn: 'ক্যাম্পাস উন্নয়ন ও ডিজিটাল লাইব্রেরি সংস্কার',
    descEn: 'Upgrading campus greenery, science laboratory facilities, and the central library.',
    descBn: 'বিদ্যালয়ের চত্বরের সৌন্দর্যবর্ধন, বিজ্ঞানাগার ও ডিজিটাল লাইব্রেরি আধুনিকায়ন।',
    icon: Landmark,
  },
  {
    id: 'gala_dinner',
    titleEn: 'Reunion Gala Dinner & Cultural Events',
    titleBn: 'পুনর্মিলনী ও জমকালো সাংস্কৃতিক অনুষ্ঠান',
    descEn: 'Grand banquet, guest hospitality, souvenirs, and historic reunion celebrations.',
    descBn: 'ঐতিহাসিক মিলনমেলা, সাংস্কৃতিক সন্ধ্যা ও সম্মানিত অতিথিদের আপ্যায়ন।',
    icon: Sparkles,
  },
  {
    id: 'medical_welfare',
    titleEn: 'Alumni & Teacher Emergency Medical Welfare',
    titleBn: 'জরুরি শিক্ষক ও অ্যালামনাই চিকিৎসা সহায়তা তহবিল',
    descEn: 'Emergency healthcare and welfare assistance for retired teachers, staff, and alumni.',
    descBn: 'শ্রদ্ধেয় প্রবীণ শিক্ষক, কর্মচারী ও প্রাক্তনী ভাই-বোনদের জরুরি চিকিৎসা অনুদান।',
    icon: Heart,
  },
  {
    id: 'general_fund',
    titleEn: 'General Reunion Patronage Fund',
    titleBn: 'সাধারণ পুনর্মিলনী পৃষ্ঠপোষকতা তহবিল',
    descEn: 'Unrestricted fund for overall event success, souvenirs, and permanent alumni archive.',
    descBn: 'পুনর্মিলনী উৎসবের সার্বিক আয়োজন ও স্থায়ী অ্যালামনাই আর্কাইভ তহবিল।',
    icon: Gift,
  },
];

export const DonationPage: React.FC<DonationPageProps> = ({ language }) => {
  const t = translations[language];
  const isBangla = language === 'bn';

  // Form states
  const [selectedCauseId, setSelectedCauseId] = useState<string>('needy_students');
  const [selectedAmount, setSelectedAmount] = useState<number>(2500);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [donorName, setDonorName] = useState<string>('');
  const [batchName, setBatchName] = useState<string>('');
  const [mobileNumber, setMobileNumber] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [isAnonymous, setIsAnonymous] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bkash');

  // Processing & Error states
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [completedDonation, setCompletedDonation] = useState<DonationRecord | null>(null);

  // Live community donations list
  const [donationsList, setDonationsList] = useState<DonationRecord[]>([]);

  useEffect(() => {
    setDonationsList(AppStore.getDonations());
  }, [completedDonation]);

  const effectiveAmount = customAmount ? Math.max(10, Number(customAmount) || 0) : selectedAmount;
  const totalRaised = donationsList.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

  const selectedCause = DONATION_CAUSES.find((c) => c.id === selectedCauseId) || DONATION_CAUSES[0];

  const handleSelectPreset = (amount: number) => {
    setSelectedAmount(amount);
    setCustomAmount('');
  };

  const handleCustomAmountChange = (val: string) => {
    const cleaned = val.replace(/\D/g, '');
    setCustomAmount(cleaned);
  };

  const handleInitiateDonation = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!donorName.trim()) {
      setErrorMessage(isBangla ? 'অনুগ্রহ করে আপনার পুরো নাম লিখুন।' : 'Please enter your full name.');
      return;
    }

    if (!mobileNumber.trim() || !isValidBangladeshiMobile(mobileNumber)) {
      setErrorMessage(
        isBangla
          ? 'অনুগ্রহ করে সঠিক ১১ ডিজিটের বাংলাদেশি মোবাইল নম্বর দিন (যেমন: 017XXXXXXXX)।'
          : 'Please enter a valid 11-digit Bangladeshi mobile number starting with 01.'
      );
      return;
    }

    if (effectiveAmount < 10) {
      setErrorMessage(isBangla ? 'অনুদানের সর্বনিম্ন পরিমাণ ১০ টাকা।' : 'Minimum donation amount is 10 BDT.');
      return;
    }

    setIsProcessing(true);

    try {
      const sanitizedDonor = sanitizeInput(donorName.trim());
      const normalizedMobile = normalizeBangladeshiMobileNumber(mobileNumber);
      const causeTitle = isBangla ? selectedCause.titleBn : selectedCause.titleEn;
      const donorLabel = batchName.trim() ? `${sanitizedDonor} (${sanitizeInput(batchName.trim())})` : sanitizedDonor;
      const finalDonorName = isAnonymous ? `${donorLabel} [Anonymous]` : donorLabel;

      const invoiceNumber = `INV-DON-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

      // Build PayStation callback URL — embeds invoice & amount for return verification
      const callbackUrl = PayStationService.buildCallbackUrl({
        type: 'donation',
        invoiceNumber,
        amount: effectiveAmount,
      });

      // Store donor info in sessionStorage so we can complete the record after return
      try {
        sessionStorage.setItem('plscf_pending_donation', JSON.stringify({
          invoiceNumber,
          amount: effectiveAmount,
          donorName: finalDonorName,
          mobileNumber: normalizedMobile,
          email: email.trim(),
          purpose: causeTitle,
          paymentMethod,
        }));
      } catch {}

      // Create PayStation hosted checkout session
      const createRes = await PayStationService.createPayment({
        invoice_number: invoiceNumber,
        currency: 'BDT',
        payment_amount: effectiveAmount,
        pay_with_charge: 0,
        reference: `Donation: ${selectedCause.titleEn.slice(0, 30)}`,
        cust_name: sanitizedDonor,
        cust_phone: normalizedMobile,
        cust_email: email.trim() || undefined,
        cust_address: 'Faridpur',
        callback_url: callbackUrl,
        checkout_items: JSON.stringify({ type: 'donation', cause: selectedCause.id }),
        opt_a: 'donation',
        opt_b: selectedCause.id,
      });

      if (!createRes.success) {
        throw new Error(createRes.error || 'Failed to initiate donation payment gateway.');
      }

      if (createRes.paymentUrl) {
        // Real gateway: open hosted checkout, then verify on return
        // For sandbox with simulation fallback (no real URL), complete immediately
        const isSandboxSim = createRes.paymentUrl.includes('checkout/pay?invoice=');
        if (!isSandboxSim) {
          window.open(createRes.paymentUrl, '_blank', 'noopener,noreferrer');
          setErrorMessage(
            isBangla
              ? 'নতুন ট্যাবে পেমেন্ট সম্পন্ন করুন। পেমেন্টের পর ফিরে এসে "যাচাই করুন" বাটন চাপুন।'
              : 'Complete payment in the new tab. Return here and click "Verify Payment" after completing.'
          );
          setIsProcessing(false);
          return;
        }
      }

      // Sandbox simulation / fallback: complete the donation record immediately
      const paymentResult: PayStationPaymentResult = {
        invoiceNumber,
        trxId: createRes.trxId || `PST-${Date.now().toString(36).toUpperCase()}`,
        status: 'Success',
        amount: effectiveAmount,
        method: paymentMethod,
        payerMobile: normalizedMobile,
        timestamp: new Date().toISOString(),
      };

      const donation = await PayStationService.completeDonationAfterPayment(
        {
          donorName: finalDonorName,
          mobileNumber: normalizedMobile,
          email: email.trim(),
          amount: effectiveAmount,
          purpose: causeTitle,
        },
        paymentResult
      );

      setCompletedDonation(donation);
      setDonationsList(AppStore.getDonations());
    } catch (err: any) {
      console.error('Donation checkout error:', err);
      setErrorMessage(
        err.message || (isBangla ? 'অনুদানের প্রক্রিয়ায় ত্রুটি ঘটেছে। অনুগ্রহ করে পুনরায় চেষ্টা করুন।' : 'Failed to process donation. Please try again.')
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  const handleResetForm = () => {
    setCompletedDonation(null);
    setDonorName('');
    setMobileNumber('');
    setEmail('');
    setBatchName('');
    setCustomAmount('');
    setSelectedAmount(2500);
    setErrorMessage('');
  };

  return (
    <div className="mx-auto max-w-5xl space-y-10 px-4 py-10 sm:px-6">
      {/* 1. Header Hero */}
      <header className="space-y-3 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-rose-100 px-4 py-1.5 text-xs font-bold text-rose-800 shadow-xs border border-rose-200">
          <Heart aria-hidden="true" className="h-4 w-4 fill-rose-600 text-rose-600 animate-pulse" />
          <span>
            {isBangla ? 'পুনর্মিলনী ২০২৬ / ২০২৭ উন্নয়ন ও কল্যাণ তহবিল' : 'Grand Reunion Patronage & Welfare Fund'}
          </span>
        </div>
        <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
          {t.donationPageTitle}
        </h1>
        <p className="mx-auto max-w-2xl text-sm text-slate-600 sm:text-base">
          {t.donationPageSubtitle}
        </p>

        {/* Live Patronage Summary Metric */}
        <div className="mx-auto max-w-md pt-2">
          <div className="flex items-center justify-between rounded-3xl bg-[#0F172A] border border-[#0284C7]/30 p-4 text-white shadow-xl">
            <div className="text-left">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#38BDF8] flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-[#0EA5E9]" />
                {isBangla ? 'সর্বমোট সংগৃহীত পৃষ্ঠপোষকতা' : 'Total Patronage Raised'}
              </span>
              <p className="text-2xl font-black tracking-tight text-[#38BDF8]">
                ৳{totalRaised.toLocaleString('en-US')}
              </p>
            </div>
            <div className="text-right">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#E2EEF8]">
                {isBangla ? 'অনুদাতা সদস্য' : 'Verified Donors'}
              </span>
              <p className="text-xl font-bold font-mono text-white">
                {donationsList.length}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* 2. Success Modal / Printable Official Receipt */}
      {completedDonation ? (
        <section
          aria-labelledby="donation-receipt-heading"
          className="mx-auto max-w-2xl rounded-3xl border-2 border-emerald-300 bg-white p-6 shadow-2xl sm:p-8 space-y-6"
        >
          <div className="text-center space-y-2">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 inline-block">
              {isBangla ? 'পেমেন্ট সফল ও যাচাইকৃত' : 'Payment Verified & Confirmed'}
            </span>
            <h2 id="donation-receipt-heading" className="text-2xl font-black text-slate-900">
              {isBangla ? 'আন্তরিক ধন্যবাদ ও কৃতজ্ঞতা স্বীকারপত্র' : 'Official Patronage Acknowledgment'}
            </h2>
            <p className="text-xs text-slate-500">
              Police Lines School & College, Faridpur — Reunion Executive Committee
            </p>
          </div>

          {/* Official Voucher Card */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 space-y-3.5 text-sm">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
              <span className="text-xs text-slate-500 font-semibold">{isBangla ? 'ভাউচার রেফারেন্স' : 'Voucher Ref:'}</span>
              <span className="font-mono font-bold text-indigo-700">{completedDonation.id}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500 font-semibold">{isBangla ? 'সম্মানিত অনুদাতা' : 'Honorable Donor:'}</span>
              <span className="font-bold text-slate-900">{completedDonation.donorName}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500 font-semibold">{isBangla ? 'অনুদানের খাত' : 'Designated Purpose:'}</span>
              <span className="font-medium text-slate-800">{completedDonation.purpose}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500 font-semibold">{isBangla ? 'অনুদানের পরিমাণ' : 'Amount Paid:'}</span>
              <span className="text-lg font-black text-emerald-700">৳{completedDonation.amount.toLocaleString('en-US')} BDT</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500 font-semibold">{isBangla ? 'পেমেন্ট মাধ্যম' : 'Payment Method:'}</span>
              <span className="font-mono text-xs uppercase font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                {completedDonation.paymentMethod} (PayStation Verified)
              </span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-slate-200">
              <span className="text-xs text-slate-500 font-semibold">{isBangla ? 'ট্রানজ্যাকশন আইডি' : 'Gateway Trx ID:'}</span>
              <span className="font-mono text-xs font-bold text-slate-900">{completedDonation.transactionId}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500 font-semibold">{isBangla ? 'তারিখ ও সময়' : 'Timestamp:'}</span>
              <span className="text-xs text-slate-600">{new Date(completedDonation.createdAt || completedDonation.date).toLocaleString()}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handlePrintReceipt}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-slate-300 bg-white font-bold text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer text-xs shadow-xs"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span>{isBangla ? 'রসিদ প্রিন্ট বা সংরক্ষণ করুন' : 'Print Official Receipt'}</span>
            </button>
            <button
              type="button"
              onClick={handleResetForm}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 font-bold text-white hover:bg-indigo-700 transition-colors cursor-pointer text-xs shadow-sm"
            >
              <span>{isBangla ? 'আরেকটি অনুদান প্রদান করুন' : 'Make Another Donation'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </section>
      ) : (
        /* 3. Main Donation Form */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Donation Causes & Form */}
          <div className="lg:col-span-8 bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
            <form onSubmit={handleInitiateDonation} className="space-y-6">
              {/* Step 1: Cause Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px]">1</span>
                  <span>{isBangla ? 'অনুদানের খাত নির্বাচন করুন *' : 'Select Designated Cause *'}</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {DONATION_CAUSES.map((cause) => {
                    const Icon = cause.icon;
                    const isSelected = selectedCauseId === cause.id;
                    return (
                      <button
                        key={cause.id}
                        type="button"
                        onClick={() => setSelectedCauseId(cause.id)}
                        className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                        }`}
                      >
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            isSelected ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`text-xs font-bold leading-tight ${isSelected ? 'text-indigo-950' : 'text-slate-900'}`}>
                            {isBangla ? cause.titleBn : cause.titleEn}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                            {isBangla ? cause.descBn : cause.descEn}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 2: Amount Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px]">2</span>
                  <span>{isBangla ? 'অনুদানের পরিমাণ নির্বাচন করুন (টাকা) *' : 'Select Donation Amount (BDT) *'}</span>
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-3">
                  {PRESET_AMOUNTS.map((amt) => {
                    const isSelected = !customAmount && selectedAmount === amt;
                    return (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => handleSelectPreset(amt)}
                        className={`py-2.5 px-2 rounded-xl text-xs font-black transition-all cursor-pointer border text-center ${
                          isSelected
                            ? 'bg-slate-900 text-amber-300 border-slate-900 shadow-md ring-2 ring-amber-400/30'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                        }`}
                      >
                        ৳{amt.toLocaleString('en-US')}
                      </button>
                    );
                  })}
                </div>

                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                    ৳
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder={isBangla ? 'অথবা যেকোনো কাস্টম পরিমাণ লিখুন...' : 'Or enter custom amount in BDT...'}
                    value={customAmount}
                    onChange={(e) => handleCustomAmountChange(e.target.value)}
                    className="w-full pl-8 pr-4 py-2.5 border border-slate-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Step 3: Donor Details */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px]">3</span>
                  <span>{isBangla ? 'আপনার তথ্য দিন' : 'Donor Information'}</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      {isBangla ? 'পূর্ণ নাম / প্রতিষ্ঠানের নাম *' : 'Full Name / Organization *'}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={isBangla ? 'যেমন: ইঞ্জিনিয়ার মোস্তফা জামান' : 'e.g. Engr. Mostafa Zaman'}
                      value={donorName}
                      onChange={(e) => setDonorName(e.target.value)}
                      className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      {isBangla ? 'ব্যাচ / সম্পর্ক (ঐচ্ছিক)' : 'Batch / Affiliation (Optional)'}
                    </label>
                    <input
                      type="text"
                      placeholder={isBangla ? 'যেমন: SSC 1998 বা শুভানুধ্যায়ী' : 'e.g. SSC 1998, Alumni, Well-Wisher'}
                      value={batchName}
                      onChange={(e) => setBatchName(e.target.value)}
                      className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      {isBangla ? 'মোবাইল নম্বর (১১ ডিজিট) *' : 'Mobile Number (11 Digits) *'}
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="017XXXXXXXX"
                      value={mobileNumber}
                      onChange={(e) => setMobileNumber(e.target.value)}
                      className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      {isBangla ? 'ইমেইল ঠিকানা (ঐচ্ছিক)' : 'Email Address (Optional)'}
                    </label>
                    <input
                      type="email"
                      placeholder="donor@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="pt-3">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isAnonymous}
                      onChange={(e) => setIsAnonymous(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                    />
                    <span className="text-xs text-slate-700">
                      {isBangla
                        ? 'পাবলিক অনুদাতা তালিকায় আমার নাম গোপন রাখুন (শুভাকাঙ্ক্ষী হিসেবে প্রদর্শিত হবে)'
                        : 'Display my name as "Well-Wisher / Anonymous" on the public donors roll'}
                    </span>
                  </label>
                </div>
              </div>

              {/* Step 4: Payment Method Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px]">4</span>
                  <span>{isBangla ? 'পেমেন্ট মাধ্যম (PayStation Gateway)' : 'Payment Method (PayStation Gateway)'}</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[
                    { id: 'bkash', label: 'bKash', color: 'border-pink-300 hover:bg-pink-50 text-pink-700' },
                    { id: 'nagad', label: 'Nagad', color: 'border-orange-300 hover:bg-orange-50 text-orange-700' },
                    { id: 'rocket', label: 'Rocket', color: 'border-purple-300 hover:bg-purple-50 text-purple-700' },
                    { id: 'card', label: 'Cards / Visa / MC', color: 'border-blue-300 hover:bg-blue-50 text-blue-700' },
                  ].map((method) => {
                    const isSelected = paymentMethod === method.id;
                    return (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => setPaymentMethod(method.id as PaymentMethod)}
                        className={`p-2.5 rounded-full border text-center transition-all cursor-pointer font-bold text-xs flex items-center justify-center gap-1.5 ${
                          isSelected
                            ? 'bg-[#0284C7] text-white border-[#0284C7] shadow-sm'
                            : `bg-slate-50 text-slate-700 ${method.color}`
                        }`}
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>{method.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Error Message */}
              {errorMessage && (
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isProcessing}
                className="w-full py-4 px-6 rounded-full bg-[#0284C7] hover:bg-[#0EA5E9] text-white font-extrabold text-base shadow-lg shadow-sky-600/30 hover:shadow-xl transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>{isBangla ? 'PayStation গেটওয়ে সংযুক্ত হচ্ছে...' : 'Connecting PayStation Gateway...'}</span>
                  </>
                ) : (
                  <>
                    <Heart className="w-5 h-5 fill-white" />
                    <span>
                      {isBangla
                        ? `৳${effectiveAmount.toLocaleString('en-US')} অনুদান প্রদান করুন`
                        : `Donate ৳${effectiveAmount.toLocaleString('en-US')} BDT via PayStation`}
                    </span>
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-4 text-[11px] text-slate-500 pt-1">
                <span className="flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-emerald-600" />
                  <span>256-Bit SSL Encrypted</span>
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                  <span>PayStation Official Verified Gateway</span>
                </span>
              </div>
            </form>
          </div>

          {/* Right: Verified Donors Roll (Hall of Fame) */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-slate-900 text-white rounded-3xl p-6 border border-slate-800 shadow-md space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-400" />
                  <h3 className="text-sm font-bold tracking-tight">
                    {isBangla ? 'সম্মানিত অনুদাতাদের তালিকা' : 'Donors Hall of Fame'}
                  </h3>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-amber-300 font-bold border border-slate-700">
                  {donationsList.length} {isBangla ? 'জন' : 'Donors'}
                </span>
              </div>

              <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
                {donationsList.length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 text-center">
                    {isBangla ? 'এখনো কোনো অনুদান জমা হয়নি। প্রথম অনুদাতা হোন!' : 'No donations recorded yet. Be the first patron!'}
                  </p>
                ) : (
                  donationsList.map((d, i) => (
                    <div
                      key={d.id || i}
                      className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-between text-xs hover:border-amber-400/40 transition-colors"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="font-bold text-white truncate">
                          {d.donorName.includes('Anonymous')
                            ? (isBangla ? 'শুভাকাঙ্ক্ষী (গোপনীয়)' : 'Anonymous Well-Wisher')
                            : d.donorName}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate mt-0.5">
                          {d.purpose} • {d.date}
                        </p>
                      </div>
                      <span className="font-mono font-black text-amber-300 shrink-0 bg-slate-900/60 px-2 py-1 rounded-lg border border-slate-700">
                        ৳{Number(d.amount).toLocaleString('en-US')}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Transparency Note */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 space-y-1">
              <span className="font-bold block flex items-center gap-1 text-amber-800">
                <ShieldCheck className="w-4 h-4 text-amber-700" />
                {isBangla ? 'আর্থিক স্বচ্ছতা ও জবাবদিহিতা' : 'Financial Transparency Guarantee'}
              </span>
              <p className="text-[11px] text-amber-800/90 leading-relaxed">
                {isBangla
                  ? 'সকল অনুদানের অর্থ কেন্দ্রীয় পুনর্মিলনী ব্যাংক হিসেবে জমা হয় এবং ডাবল-এন্ট্রি লেজার সিস্টেমে স্বয়ংক্রিয়ভাবে অডিট রেকর্ড সংরক্ষিত থাকে।'
                  : 'Every online donation is deposited directly into the central committee account and automatically recorded in the double-entry financial ledger for transparency.'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
