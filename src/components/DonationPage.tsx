import React, { useState, useEffect, useMemo } from 'react';
import {
  Heart,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Award,
  AlertCircle,
  Printer,
  CreditCard,
  ArrowRight,
  TrendingUp,
  EyeOff,
  Sparkles,
  Loader2,
  ExternalLink,
  RefreshCw,
  Globe,
} from 'lucide-react';
import { Language, DonationRecord, FeeSettings, GovernanceLoadStatus } from '../types';
import { translations } from '../i18n/translations';
import { AppStore } from '../services/store';
import { SupabaseService } from '../services/supabase';
import { PayStationService } from '../services/paystation';
import { InternationalPaymentInfo, InternationalPaymentService } from '../services/internationalPaymentService';
import { GovernanceSettingsService } from '../services/governanceSettingsService';
import {
  isValidBangladeshiMobile,
  normalizeBangladeshiMobileNumber,
  isDonationOpen,
  getDonationClosedMessage,
  getStructuredClosureNotice,
  calculateGatewayCharge,
} from '../utils/rules';
import { sanitizeInput } from '../utils/security';
import { ThankYouCardBadge } from './ThankYouCardBadge';
import { GovernanceClosureNoticeCard } from './common/GovernanceClosureNoticeCard';

interface DonationPageProps {
  language: Language;
  onNavigate?: (view: string) => void;
  feeSettings?: FeeSettings;
  governanceStatus?: GovernanceLoadStatus;
  governanceError?: string | null;
  onRetryGovernance?: () => void;
}

const PRESET_AMOUNTS = [500, 1000, 2500, 5000, 10000, 25000];

export const DonationPage: React.FC<DonationPageProps> = ({
  language,
  onNavigate,
  feeSettings: initialFeeSettings,
  governanceStatus = 'ready',
  governanceError = null,
  onRetryGovernance,
}) => {
  const t = translations[language];
  const isBangla = language === 'bn';

  const defaultCauseTitle = isBangla
    ? 'পুনর্মিলনী উন্নয়ন ও কল্যাণ তহবিল'
    : 'Reunion Patronage & Welfare Fund';

  // Form states
  const [selectedAmount, setSelectedAmount] = useState<number>(2500);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [donorName, setDonorName] = useState<string>('');
  const [batchName, setBatchName] = useState<string>('');
  const [mobileNumber, setMobileNumber] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [isAnonymous, setIsAnonymous] = useState<boolean>(false);

  // Processing & Error states
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [completedDonation, setCompletedDonation] = useState<DonationRecord | null>(null);

  // Pending payment verification state
  const [pendingPayment, setPendingPayment] = useState<{
    invoiceNumber: string;
    amount: number;
    paymentUrl?: string;
    donorName?: string;
    mobileNumber?: string;
    email?: string;
    purpose?: string;
  } | null>(() => {
    try {
      const saved = sessionStorage.getItem('plscf_pending_donation');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [isVerifyingPending, setIsVerifyingPending] = useState(false);

  // Live community donations list & fee settings
  const [donationsList, setDonationsList] = useState<DonationRecord[]>([]);
  const [feeSettings, setFeeSettings] = useState<FeeSettings>(
    () => initialFeeSettings || GovernanceSettingsService.getConfirmedSettings() || AppStore.getFeeSettings()
  );
  const [intlPaymentInfo, setIntlPaymentInfo] = useState<InternationalPaymentInfo>(() =>
    InternationalPaymentService.getInfo()
  );

  useEffect(() => {
    if (initialFeeSettings) {
      setFeeSettings(initialFeeSettings);
    }
  }, [initialFeeSettings]);

  useEffect(() => {
    // 1. Initial read from local cache
    setDonationsList(AppStore.getDonations());
    setFeeSettings(initialFeeSettings || GovernanceSettingsService.getConfirmedSettings() || AppStore.getFeeSettings());
    InternationalPaymentService.fetchFromSupabase().catch(() => {});

    // 2. Fetch live from Supabase canonical public.donations
    SupabaseService.fetchDonations().then((res) => {
      if (res.data && res.data.length > 0) {
        setDonationsList(res.data);
        AppStore.saveDonations(res.data);
      }
    }).catch((err) => console.warn('Error fetching live donations from Supabase:', err));

    const handleSync = (e: any) => {
      if (e.detail) setFeeSettings(e.detail);
    };
    window.addEventListener('plscf_fee_settings_updated', handleSync);
    const unsubGov = GovernanceSettingsService.subscribe((snap) => {
      if (snap.status === 'ready' && snap.settings) {
        setFeeSettings(snap.settings);
      }
    });
    const unsubIntl = InternationalPaymentService.subscribe((updated) => {
      setIntlPaymentInfo(updated);
    });
    return () => {
      window.removeEventListener('plscf_fee_settings_updated', handleSync);
      unsubGov();
      unsubIntl();
    };
  }, [completedDonation, initialFeeSettings]);

  // 3. Auto-handle return from PayStation gateway callback
  useEffect(() => {
    const handleReturnCallback = async () => {
      if (typeof window === 'undefined') return;
      const params = new URLSearchParams(window.location.search);
      const invoice = params.get('invoice') || params.get('invoice_number') || sessionStorage.getItem('plscf_returned_donation_invoice');
      const isReturn = params.get('payment_return') === '1' || Boolean(invoice);

      const pendingRaw = sessionStorage.getItem('plscf_pending_donation') || localStorage.getItem('plscf_pending_donation');
      const pendingSession = PayStationService.getPendingSession();
      const pending = pendingRaw
        ? JSON.parse(pendingRaw)
        : (pendingSession && pendingSession.type === 'donation' && pendingSession.donationData
          ? pendingSession.donationData
          : null);
      if (!isReturn || !pending) return;

      try {
        const activeInvoice = invoice || pending.invoiceNumber;
        if (!activeInvoice) return;

        setIsProcessing(true);
        // Clean URL to prevent re-verification loop
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, '', cleanUrl);
        sessionStorage.removeItem('plscf_returned_donation_invoice');

        const verifyRes = await PayStationService.verifyReturnedPayment(activeInvoice, pending.amount);
        if (verifyRes.verified && verifyRes.result) {
          const donation = await PayStationService.completeDonationAfterPayment(
            {
              donorName: pending.donorName,
              mobileNumber: pending.mobileNumber,
              email: pending.email,
              amount: verifyRes.result.amount || pending.amount,
              purpose: pending.purpose,
            },
            verifyRes.result
          );
          setCompletedDonation(donation);
          setDonationsList(AppStore.getDonations());
          sessionStorage.removeItem('plscf_pending_donation');
          localStorage.removeItem('plscf_pending_donation');
          PayStationService.clearPendingSession();
          setPendingPayment(null);
        } else {
          setErrorMessage(verifyRes.error || (isBangla ? 'পেমেন্ট এখনও সম্পন্ন হয়নি।' : 'Payment verification could not be completed.'));
        }
      } catch (err) {
        console.warn('Error handling donation return callback:', err);
      } finally {
        setIsProcessing(false);
      }
    };

    void handleReturnCallback();
  }, []);

  // 4. Background polling for pending payment verification
  useEffect(() => {
    if (!pendingPayment || completedDonation) return;
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      if (attempts > 30) {
        clearInterval(interval);
        return;
      }
      try {
        const verifyRes = await PayStationService.verifyReturnedPayment(
          pendingPayment.invoiceNumber,
          pendingPayment.amount
        );
        if (verifyRes.verified && verifyRes.result) {
          clearInterval(interval);
          const pendingRaw = sessionStorage.getItem('plscf_pending_donation');
          const pending = pendingRaw ? JSON.parse(pendingRaw) : null;
          const donation = await PayStationService.completeDonationAfterPayment(
            {
              donorName: pending?.donorName || pendingPayment.donorName || 'Honored Patron',
              mobileNumber: pending?.mobileNumber || pendingPayment.mobileNumber || '01700000000',
              email: pending?.email || pendingPayment.email || '',
              amount: verifyRes.result.amount || pendingPayment.amount,
              purpose: pending?.purpose || pendingPayment.purpose || 'General Reunion Fund',
            },
            verifyRes.result
          );
          setCompletedDonation(donation);
          setDonationsList(AppStore.getDonations());
          sessionStorage.removeItem('plscf_pending_donation');
          setPendingPayment(null);
        }
      } catch { }
    }, 4000);

    return () => clearInterval(interval);
  }, [pendingPayment, completedDonation]);

  const effectiveAmount = customAmount ? Math.max(10, Number(customAmount) || 0) : selectedAmount;
  const donationGatewayCharge = calculateGatewayCharge(effectiveAmount);
  const donationTotalPayable = Math.round((effectiveAmount + donationGatewayCharge) * 100) / 100;
  const totalRaised = donationsList.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

  // Top 10 Donors sorted by donation amount descending (Donors Hall of Fame)
  const top10Donors = useMemo(() => {
    return [...donationsList]
      .sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0))
      .slice(0, 10);
  }, [donationsList]);

  const handleSelectPreset = (amount: number) => {
    setSelectedAmount(amount);
    setCustomAmount('');
  };

  const handleCustomAmountChange = (val: string) => {
    const cleaned = val.replace(/\D/g, '');
    setCustomAmount(cleaned);
  };

  const handleVerifyPendingDonation = async () => {
    if (!pendingPayment) return;
    setIsVerifyingPending(true);
    setErrorMessage('');
    try {
      const verifyRes = await PayStationService.verifyReturnedPayment(
        pendingPayment.invoiceNumber,
        pendingPayment.amount
      );
      if (verifyRes.verified && verifyRes.result) {
        const pendingRaw = sessionStorage.getItem('plscf_pending_donation');
        const pending = pendingRaw ? JSON.parse(pendingRaw) : null;
        const donation = await PayStationService.completeDonationAfterPayment(
          {
            donorName: pending?.donorName || pendingPayment.donorName || donorName || 'Honored Patron',
            mobileNumber: pending?.mobileNumber || pendingPayment.mobileNumber || mobileNumber || '01700000000',
            email: pending?.email || pendingPayment.email || email,
            amount: verifyRes.result.amount || pendingPayment.amount,
            purpose: pending?.purpose || pendingPayment.purpose || defaultCauseTitle,
          },
          verifyRes.result
        );
        setCompletedDonation(donation);
        setDonationsList(AppStore.getDonations());
        sessionStorage.removeItem('plscf_pending_donation');
        setPendingPayment(null);
      } else {
        setErrorMessage(verifyRes.error || (isBangla ? 'পেমেন্ট এখনও নিশ্চিত হয়নি।' : 'Payment has not been confirmed yet. Please complete it on the gateway.'));
      }
    } catch (e: any) {
      setErrorMessage(e?.message || 'Verification error');
    } finally {
      setIsVerifyingPending(false);
    }
  };

  const handleInitiateDonation = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (governanceStatus !== 'ready') {
      setErrorMessage(
        isBangla
          ? 'অনুদান সেটিংস এখনও লোড হচ্ছে। অনুগ্রহ করে অপেক্ষা করুন।'
          : 'Donation status is still loading. Please wait.'
      );
      return;
    }

    if (!isDonationOpen(feeSettings)) {
      setErrorMessage(getDonationClosedMessage(feeSettings, language));
      return;
    }

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
      const causeTitle = defaultCauseTitle;
      const donorLabel = batchName.trim() ? `${sanitizedDonor} (${sanitizeInput(batchName.trim())})` : sanitizedDonor;
      const finalDonorName = isAnonymous ? `${donorLabel} [Anonymous]` : donorLabel;

      const invoiceNumber = `INV-DON-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

      // Build PayStation callback URL — embeds invoice & total payable for return verification
      const callbackUrl = PayStationService.buildCallbackUrl({
        type: 'donation',
        invoiceNumber,
        amount: donationTotalPayable,
      });

      // Store donor info in sessionStorage & localStorage & service session so we can complete the record after return
      const donationSessionPayload = {
        invoiceNumber,
        amount: donationTotalPayable,
        netDonationAmount: effectiveAmount,
        donorName: finalDonorName,
        mobileNumber: normalizedMobile,
        email: email.trim(),
        purpose: causeTitle,
        paymentMethod: 'paystation' as const,
      };
      try {
        sessionStorage.setItem('plscf_pending_donation', JSON.stringify(donationSessionPayload));
        localStorage.setItem('plscf_pending_donation', JSON.stringify(donationSessionPayload));
        PayStationService.savePendingSession({
          type: 'donation',
          invoiceNumber,
          amount: donationTotalPayable,
          donationData: donationSessionPayload,
          createdAt: new Date().toISOString(),
        });
      } catch { }

      // Create PayStation hosted checkout session (total includes flat 1.8% gateway fee; pay_with_charge=0)
      const createRes = await PayStationService.createPayment({
        invoice_number: invoiceNumber,
        order_type: 'donation',
        donation_amount: effectiveAmount,
        gateway_charge: donationGatewayCharge,
        payment_method: 'paystation',
        return_origin: typeof window !== 'undefined' ? window.location.origin : undefined,
        currency: 'BDT',
        payment_amount: donationTotalPayable,
        pay_with_charge: 0,
        reference: 'Donation: Reunion Welfare Fund',
        cust_name: sanitizedDonor,
        cust_phone: normalizedMobile,
        cust_email: email.trim() || undefined,
        cust_address: 'Faridpur',
        callback_url: callbackUrl,
        checkout_items: JSON.stringify({ type: 'donation', cause: 'general_fund', gatewayCharge: donationGatewayCharge }),
        opt_a: 'donation',
        opt_b: 'general_fund',
      });

      if (!createRes.success) {
        throw new Error(createRes.error || 'Failed to initiate donation payment gateway.');
      }

      if (!createRes.paymentUrl) {
        throw new Error('PayStation did not return a hosted checkout URL.');
      }

      let parsedCheckoutUrl: URL;
      try {
        parsedCheckoutUrl = new URL(createRes.paymentUrl);
      } catch {
        throw new Error('Invalid PayStation hosted checkout URL returned.');
      }

      if (
        parsedCheckoutUrl.protocol !== 'https:' ||
        (parsedCheckoutUrl.hostname !== 'paystation.com.bd' &&
          !parsedCheckoutUrl.hostname.endsWith('.paystation.com.bd'))
      ) {
        throw new Error('Refusing redirect to unverified payment gateway domain.');
      }

      const checkoutUrl = parsedCheckoutUrl.toString();
      const popup = window.open(checkoutUrl, '_blank', 'noopener,noreferrer');
      if (!popup || popup.closed || typeof popup.closed === 'undefined') {
        // Popup was blocked by browser or on mobile device — redirect directly
        window.location.href = checkoutUrl;
        return;
      }

      setPendingPayment({
        invoiceNumber,
        amount: donationTotalPayable,
        paymentUrl: checkoutUrl,
        donorName: finalDonorName,
        mobileNumber: normalizedMobile,
        email: email.trim(),
        purpose: causeTitle,
      });
      setIsProcessing(false);
      return;
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

          {/* Official Vector Thank You Card Badge */}
          <div className="pt-2">
            <ThankYouCardBadge
              cardData={{
                donorName: completedDonation.donorName,
                registrationId: completedDonation.id,
                token: completedDonation.token || completedDonation.qrToken,
                qrToken: completedDonation.qrToken || completedDonation.token,
                mobileNumber: completedDonation.mobileNumber,
                amount: completedDonation.amount,
                purpose: completedDonation.purpose,
                date: completedDonation.date,
              }}
              language={language}
              showActions={true}
            />
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
        /* 3. Main Donation Area */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Loading / Error / Closure Notice / Active Donation Checkout */}
          {governanceStatus === 'loading' ? (
            <div className="lg:col-span-8 bg-white rounded-3xl p-10 border border-slate-200 text-center space-y-3 shadow-sm">
              <RefreshCw className="w-8 h-8 text-[#0284C7] animate-spin mx-auto" />
              <h2 className="text-base font-bold text-slate-900">
                {isBangla ? 'অনুদান পোর্টালের অবস্থা যাচাই করা হচ্ছে...' : 'Checking Donation Portal Status...'}
              </h2>
              <p className="text-xs text-slate-500">
                {isBangla
                  ? 'অনুগ্রহ করে এক মুহূর্ত অপেক্ষা করুন।'
                  : 'Please wait while authoritative donation governance settings load.'}
              </p>
            </div>
          ) : governanceStatus === 'error' ? (
            <div className="lg:col-span-8 bg-white rounded-3xl p-8 border border-rose-200 text-center space-y-4 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-slate-900">
                  {isBangla ? 'অনুদান সেটিংস লোড করা সম্ভব হয়নি' : 'Unable to Load Donation Portal Status'}
                </h2>
                <p className="text-xs text-slate-600 max-w-md mx-auto">
                  {governanceError ||
                    (isBangla
                      ? 'সার্ভারের সাথে সংযোগ স্থাপন করা যায়নি। অনুগ্রহ করে পুনরায় চেষ্টা করুন।'
                      : 'Could not reach the portal settings server. Please retry.')}
                </p>
              </div>
              {onRetryGovernance && (
                <button
                  type="button"
                  onClick={onRetryGovernance}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{isBangla ? 'পুনরায় চেষ্টা করুন' : 'Retry Loading'}</span>
                </button>
              )}
            </div>
          ) : !isDonationOpen(feeSettings) ? (
            <div className="lg:col-span-8">
              <GovernanceClosureNoticeCard
                notice={getStructuredClosureNotice(feeSettings, 'donation', language)}
                language={language}
                badgeText={isBangla ? 'অনুদান বন্ধ' : 'Donations Closed'}
                onBackHome={onNavigate ? () => onNavigate('home') : undefined}
              />
            </div>
          ) : (
          <div className="lg:col-span-8 bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
            {/* 1. Big International Payment Button */}
            {intlPaymentInfo.isEnabled && onNavigate && (
              <div className="pb-5 border-b border-slate-100">
                <button
                  type="button"
                  onClick={() => onNavigate('international-payment')}
                  className="w-full py-4 px-5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white shadow-lg hover:shadow-xl border border-slate-700 transition-all cursor-pointer flex items-center justify-between gap-3 group"
                >
                  <div className="flex items-center gap-3 text-left min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-sky-500/20 text-sky-300 border border-sky-400/30 flex items-center justify-center shrink-0">
                      <Globe className="w-6 h-6" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-sm sm:text-base font-black block tracking-tight">
                        {isBangla ? 'আন্তর্জাতিক পেমেন্ট (প্রবাসী / বিদেশ থেকে)' : 'International Payment'}
                      </span>
                      <span className="text-[11px] text-sky-200/90 block truncate">
                        {isBangla
                          ? 'আন্তর্জাতিক ব্যাংক ট্রান্সফার, রাউটিং, সুইফট ও নির্দেশনা দেখুন'
                          : 'Overseas Bank Transfer, SWIFT, Routing & Transfer Details'}
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-sky-300 shrink-0 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            )}

            {/* 2. Normal Domestic Payment Form */}
            <form onSubmit={handleInitiateDonation} className="space-y-6">

              {/* Step 1: Amount Selector */}
              <div>
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px]">1</span>
                  <span>{isBangla ? 'অনুদানের পরিমাণ নির্বাচন করুন (টাকা) *' : 'Select Donation Amount (BDT) *'}</span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-3">
                  {PRESET_AMOUNTS.map((amt) => {
                    const isSelected = !customAmount && selectedAmount === amt;
                    return (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => handleSelectPreset(amt)}
                        className={`min-h-[44px] py-2.5 px-2 rounded-xl text-xs font-black transition-all cursor-pointer border text-center flex items-center justify-center whitespace-nowrap tabular-nums ${isSelected
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

              {/* Step 2: Donor Details */}
              <div>
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px]">2</span>
                  <span>{isBangla ? 'আপনার তথ্য দিন' : 'Donor Information'}</span>
                </div>

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
                      inputMode="tel"
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
                  <label className="inline-flex items-center gap-2 cursor-pointer select-none">
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

              {/* Step 3: Uniform 1.8% Gateway Charge Summary (PayStation Hosted Checkout) */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                <div className="flex items-center justify-between font-bold text-slate-700 pb-1 border-b border-slate-200">
                  <span className="flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-[#0284C7]" />
                    <span>{isBangla ? 'PayStation চেকআউট সারাংশ' : 'PayStation Checkout Summary'}</span>
                  </span>
                  <span className="text-[11px] font-semibold text-emerald-700">
                    {isBangla ? 'bKash / Nagad / Rocket / কার্ড' : 'bKash / Nagad / Rocket / Cards'}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>{isBangla ? 'অনুদানের পরিমাণ' : 'Donation Amount'}:</span>
                  <span className="font-semibold">৳ {effectiveAmount.toLocaleString('en-US')}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>{isBangla ? 'গেটওয়ে চার্জ (১.৮%)' : 'Gateway Charge (1.8%)'}:</span>
                  <span className="font-semibold text-indigo-700">+ ৳ {donationGatewayCharge.toLocaleString('en-US')}</span>
                </div>
                <div className="flex justify-between text-sm font-black text-slate-900 pt-1.5 border-t border-slate-200">
                  <span>{isBangla ? 'সর্বমোট প্রদেয়' : 'Total Payable'}:</span>
                  <span className="text-[#0284C7]">৳ {donationTotalPayable.toLocaleString('en-US')} BDT</span>
                </div>
              </div>

              {/* Active Pending Payment Card */}
              {pendingPayment && (
                <div className="rounded-2xl border-2 border-amber-300 bg-amber-50/90 p-5 space-y-4 animate-in fade-in shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
                        <span className="text-xs font-black uppercase tracking-wider text-amber-900">
                          {isBangla ? 'পেমেন্ট গেটওয়েতে প্রক্রিয়াধীন' : 'Payment in Progress'}
                        </span>
                      </div>
                      <p className="text-xs text-amber-800">
                        {isBangla
                          ? 'পেমেন্ট গেটওয়েতে লেনদেন সম্পন্ন করে নিচের বাটনে চাপুন অথবা স্বয়ংক্রিয়ভাবে যাচাই হওয়ার অপেক্ষা করুন।'
                          : 'Complete the payment on the opened gateway page and click verify below, or wait for automatic confirmation.'}
                      </p>
                    </div>
                    <span className="font-mono text-xs font-black text-amber-900 bg-amber-200/60 px-2 py-0.5 rounded border border-amber-300 shrink-0">
                      ৳{pendingPayment.amount.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {pendingPayment.paymentUrl && (
                      <a
                        href={pendingPayment.paymentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 text-xs font-bold transition-all shadow-xs"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>{isBangla ? 'গেটওয়ে পেইজ আবার খুলুন' : 'Re-open Payment Page'}</span>
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => handleVerifyPendingDonation()}
                      disabled={isVerifyingPending}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0284C7] hover:bg-[#0EA5E9] text-white text-xs font-black transition-all cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      {isVerifyingPending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5" />
                      )}
                      <span>{isBangla ? 'পেমেন্ট নিশ্চিত ও যাচাই করুন' : 'Verify Payment Status'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        sessionStorage.removeItem('plscf_pending_donation');
                        setPendingPayment(null);
                      }}
                      className="text-xs text-slate-500 hover:text-slate-800 underline ml-auto cursor-pointer"
                    >
                      {isBangla ? 'বাতিল' : 'Cancel'}
                    </button>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {errorMessage && (
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Submit Button */}
              {!isDonationOpen(feeSettings) ? (
                <button
                  type="button"
                  disabled
                  className="w-full py-4 px-6 rounded-full bg-slate-200 text-slate-500 font-extrabold text-base cursor-not-allowed flex items-center justify-center gap-2 border border-slate-300"
                >
                  <Lock className="w-5 h-5 text-slate-400" />
                  <span>{isBangla ? 'অনুদান কার্যক্রম সাময়িকভাবে বন্ধ' : 'Donations Currently Closed'}</span>
                </button>
              ) : (
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
                          ? `৳${donationTotalPayable.toLocaleString('en-US')} অনুদান প্রদান করুন`
                          : `Donate ৳${donationTotalPayable.toLocaleString('en-US')} BDT via PayStation`}
                      </span>
                    </>
                  )}
                </button>
              )}

              <div className="flex items-center justify-center gap-4 text-[11px] text-slate-500 pt-1">
                <span className="flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-[#0284C7]" />
                  <span>256-Bit SSL Encrypted</span>
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#0284C7]" />
                  <span>PayStation Official Verified Gateway</span>
                </span>
              </div>
            </form>
          </div>
          )}

          {/* Right: Verified Donors Roll (Donors Hall of Fame - Top 10) */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-slate-900 text-white rounded-3xl p-6 border border-amber-500/30 shadow-xl space-y-4 relative overflow-hidden">
              {/* Subtle gold decorative glow */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

              <div className="flex items-center justify-between pb-3 border-b border-slate-800 relative z-10">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-400/20 text-amber-400 border border-amber-400/30 flex items-center justify-center shadow-xs">
                    <Award className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black tracking-tight text-white flex items-center gap-1.5">
                      <span>{isBangla ? 'শীর্ষ ১০ অনুদাতা' : 'Donors Hall of Fame'}</span>
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    </h3>
                    <p className="text-[10px] text-slate-400">
                      {isBangla ? 'সর্বোচ্চ অনুদানকারীদের সম্মাননা ফ্রেম' : 'Top 10 Generous Patrons'}
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 font-black border border-amber-400/30">
                  TOP 10
                </span>
              </div>

              <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1 relative z-10">
                {top10Donors.length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 text-center">
                    {isBangla ? 'এখনো কোনো অনুদান জমা হয়নি। প্রথম অনুদাতা হোন!' : 'No donations recorded yet. Be the first patron!'}
                  </p>
                ) : (
                  top10Donors.map((d, i) => {
                    const isRank1 = i === 0;
                    const isRank2 = i === 1;
                    const isRank3 = i === 2;

                    const rankBadgeStyle = isRank1
                      ? 'bg-amber-400/20 text-amber-300 border-amber-400/50'
                      : isRank2
                        ? 'bg-slate-300/20 text-slate-200 border-slate-300/40'
                        : isRank3
                          ? 'bg-amber-700/20 text-amber-400 border-amber-700/40'
                          : 'bg-slate-800 text-slate-400 border-slate-700';

                    const rankIcon = isRank1 ? '🥇' : isRank2 ? '🥈' : isRank3 ? '🥉' : `#${i + 1}`;

                    return (
                      <div
                        key={d.id || i}
                        className={`p-3 rounded-2xl border transition-all flex items-center justify-between text-xs ${isRank1
                          ? 'bg-gradient-to-r from-amber-950/40 to-slate-800/90 border-amber-500/50 shadow-md ring-1 ring-amber-500/20'
                          : 'bg-slate-800/80 border-slate-700/70 hover:border-amber-400/40'
                          }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                          <span
                            className={`w-7 h-7 rounded-xl font-mono text-[11px] font-black flex items-center justify-center shrink-0 border ${rankBadgeStyle}`}
                          >
                            {rankIcon}
                          </span>
                          <div className="min-w-0">
                            <p className="font-bold text-white truncate">
                              {d.donorName.includes('Anonymous')
                                ? (isBangla ? 'শুভাকাঙ্ক্ষী (গোপনীয়)' : 'Anonymous Well-Wisher')
                                : d.donorName}
                            </p>
                            <p className="text-[10px] text-slate-400 truncate mt-0.5">
                              {d.purpose} • {d.date}
                            </p>
                          </div>
                        </div>

                        {/* Amount or Hidden Privacy Mask */}
                        {feeSettings?.hideDonationAmounts ? (
                          <span
                            className="font-mono text-[11px] text-slate-400 bg-slate-900/90 px-2.5 py-1 rounded-lg border border-slate-700 flex items-center gap-1 shrink-0"
                            title={isBangla ? 'অনুদানের পরিমাণ লুকানো রয়েছে' : 'Amount hidden by administration'}
                          >
                            <EyeOff className="w-3 h-3 text-amber-400" />
                            <span>{isBangla ? 'গোপন' : 'Hidden'}</span>
                          </span>
                        ) : (
                          <span className="font-mono font-black text-amber-300 shrink-0 bg-slate-900/80 px-2.5 py-1 rounded-lg border border-amber-500/30 tabular-nums">
                            ৳{Number(d.amount).toLocaleString('en-US')}
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Transparency Note */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 space-y-1">
              <span className="font-bold flex items-center gap-1 text-amber-800">
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
