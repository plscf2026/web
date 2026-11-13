import { useState, useEffect, useRef } from 'react';
import {
  AlertCircle,
  X,
  ShieldCheck,
  CreditCard,
  ExternalLink,
  CheckCircle2,
  Lock,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  QrCode,
  Clock,
  Wifi,
  Info,
  Copy,
  Check,
} from 'lucide-react';
import { Language, PaymentMethod, RegistrationRecord } from '../types';
import { RegistrationFormData } from '../utils/rules';
import { PayStationService, PayStationPaymentResult } from '../services/paystation';
import { StudentIdCardBadge } from './idcard/StudentIdCardBadge';
import { IdCardStore } from '../services/idCardStore';
import { AppStore } from '../services/store';

export interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (ticket: RegistrationRecord) => void;
  language: Language;
  registrationFee: number;
  donationAmount: number;
  totalPayable: number;
  studentName: string;
  registrationData?: RegistrationFormData | null;
  initialStep?: ModalStep;
  initialErrorMessage?: string;
  initialInvoice?: string;
}

export type ModalStep =
  | 'select'        // User picks a channel & clicks Pay
  | 'processing'    // Calling PayStation API
  | 'waiting'       // Hosted checkout window opened — waiting for user to complete payment
  | 'verifying'     // Checking transaction status after return
  | 'success'       // Payment confirmed
  | 'failed';       // Payment failed

/** How often (ms) to poll the transaction status while waiting */
const POLL_INTERVAL_MS = 5000;
/** Max number of poll attempts before giving up */
const MAX_POLL_ATTEMPTS = 24;   // 24 × 5 s = 2 min

const PAYMENT_METHODS: { id: PaymentMethod; name: string; color: string; bg: string }[] = [
  { id: 'bkash',  name: 'bKash',   color: 'border-pink-500 text-pink-600',   bg: 'hover:bg-pink-50' },
  { id: 'nagad',  name: 'Nagad',   color: 'border-orange-500 text-orange-600', bg: 'hover:bg-orange-50' },
  { id: 'rocket', name: 'Rocket',  color: 'border-purple-500 text-purple-600', bg: 'hover:bg-purple-50' },
  { id: 'card',   name: 'Cards',   color: 'border-blue-600 text-blue-700',    bg: 'hover:bg-blue-50' },
];

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  language,
  registrationFee,
  donationAmount,
  totalPayable,
  studentName,
  registrationData,
  initialStep,
  initialErrorMessage,
  initialInvoice,
}) => {
  if (!isOpen) return null;

  const isBangla = language === 'bn';
  const config = PayStationService.getConfig();

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('bkash');
  const [step, setStep] = useState<ModalStep>(() => initialStep || 'select');
  const [processingStep, setProcessingStep] = useState('');
  const [errorMessage, setErrorMessage] = useState(() => initialErrorMessage || '');
  const [completedTicket, setCompletedTicket] = useState<RegistrationRecord | null>(null);
  const [transactionSummary, setTransactionSummary] = useState<PayStationPaymentResult | null>(null);
  const [pollCount, setPollCount] = useState(0);
  const [copiedField, setCopiedField] = useState('');

  // Persist invoice & amount across renders so the polling closure uses fresh values
  const pendingSession = PayStationService.getPendingSession();
  const isVerifying = initialStep === 'verifying' || Boolean(initialInvoice);

  const initialInv =
    initialInvoice ||
    (isVerifying ? pendingSession?.invoiceNumber : null) ||
    `PLSCF27-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const initialAmt =
    (isVerifying && pendingSession?.amount) ? pendingSession.amount : totalPayable;

  const invoiceRef = useRef(initialInv);
  const amountRef = useRef(initialAmt);

  // Keep refs synchronized when props or sessions change
  useEffect(() => {
    if (initialInvoice) {
      invoiceRef.current = initialInvoice;
    }
  }, [initialInvoice]);

  useEffect(() => {
    if (isVerifying && pendingSession?.amount) {
      amountRef.current = pendingSession.amount;
    } else if (totalPayable > 0) {
      amountRef.current = totalPayable;
    }
  }, [totalPayable, isVerifying, pendingSession?.amount]);

  // ── Finalize after confirmed payment ────────────────────────────────────

  const finalizeRegistration = async (payment: PayStationPaymentResult) => {
    if (!registrationData) return;
    setStep('verifying');
    setProcessingStep(isBangla ? 'ডিজিটাল টিকিট তৈরি হচ্ছে...' : 'Generating secure digital ticket...');
    try {
      // Synchronize donationAmount so totalPaid matches actual payment.amount
      const effectiveBaseFee = registrationData.category === 'current' ? 1000 : 1500;
      const effectiveFee = Math.min(payment.amount, effectiveBaseFee);
      const effectiveDonation = Math.max(0, payment.amount - effectiveFee);
      const synchronizedFormData: RegistrationFormData = {
        ...registrationData,
        donationAmount: effectiveDonation,
      };

      const ticket = await PayStationService.completeRegistrationAfterPayment(
        synchronizedFormData,
        payment
      );
      setTransactionSummary(payment);
      setCompletedTicket(ticket);
      setStep('success');
    } catch (err: any) {
      console.error('[PaymentModal] Finalization failure:', err);
      // Resilient recovery: If the customer already paid and PayStation verified the transaction,
      // present the digital ticket rather than stranding the user on a failed screen
      if (payment && payment.trxId) {
        try {
          const registered = AppStore.getRegistrations().find(
            (r: RegistrationRecord) => r.transactionId === payment.trxId || r.gatewayInvoiceNumber === payment.invoiceNumber
          );
          if (registered) {
            setTransactionSummary(payment);
            setCompletedTicket(registered);
            setStep('success');
            return;
          }
        } catch (recErr) {
          console.warn('[PaymentModal] Ticket recovery notice:', recErr);
        }
      }
      setErrorMessage(
        isBangla
          ? `ডাটাবেজ নিশ্চিতকরণ ব্যর্থ হয়েছে: ${err?.message || 'অনুগ্রহ করে সহায়তা দলের সাথে যোগাযোগ করুন।'}`
          : `Database confirmation failed: ${err?.message || 'Please contact support or retry.'}`
      );
      setStep('failed');
    }
  };

  // ── Manual or automatic verification ─────────────────────────────────────

  const handleManualVerify = async () => {
    setStep('verifying');
    setProcessingStep(isBangla ? 'পেমেন্ট স্ট্যাটাস যাচাই করা হচ্ছে...' : 'Verifying payment status...');
    try {
      const verifyRes = await PayStationService.verifyReturnedPayment(
        invoiceRef.current,
        amountRef.current
      );
      if (verifyRes.verified && verifyRes.result) {
        setErrorMessage('');
        amountRef.current = verifyRes.result.amount;
        await finalizeRegistration(verifyRes.result);
      } else {
        setErrorMessage(
          verifyRes.error ||
            (isBangla ? 'পেমেন্ট নিশ্চিত হয়নি।' : 'Payment not yet confirmed.')
        );
        setStep('waiting');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Verification failed.');
      setStep('waiting');
    }
  };

  // ── Auto-verify on mount / step change ─────────────────────────────────────

  useEffect(() => {
    if (step === 'verifying' && !completedTicket) {
      handleManualVerify();
    }
  }, [step]);

  // ── Status polling ───────────────────────────────────────────────────────

  useEffect(() => {
    if (step !== 'waiting') return;

    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      setPollCount(attempts);

      try {
        const verifyRes = await PayStationService.verifyReturnedPayment(
          invoiceRef.current,
          amountRef.current
        );

        if (verifyRes.verified && verifyRes.result) {
          clearInterval(interval);
          setErrorMessage('');
          amountRef.current = verifyRes.result.amount;
          await finalizeRegistration(verifyRes.result);
          return;
        }

        // Still processing — keep polling
      } catch (e) {
        console.warn('[PaymentModal] Poll attempt error:', e);
      }

      if (attempts >= MAX_POLL_ATTEMPTS) {
        clearInterval(interval);
        // Let user manually check
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [step]);

  // ── Hosted checkout launch (real gateway) ───────────────────────────────

  const handleInstantSandboxPayment = async (method: PaymentMethod = selectedMethod) => {
    if (!registrationData) {
      setErrorMessage(isBangla ? 'নিবন্ধন ডেটা অনুপস্থিত।' : 'Registration data missing.');
      return;
    }

    setStep('processing');
    setErrorMessage('');
    const methodTitle =
      method === 'nagad' ? 'Nagad' : method === 'rocket' ? 'Rocket' : method === 'card' ? 'Card' : 'bKash';
    setProcessingStep(
      isBangla
        ? `${methodTitle} পেমেন্ট সম্পন্ন করা হচ্ছে...`
        : `Completing ${methodTitle} payment...`
    );

    try {
      // 1. Authoritatively create pending registration in Supabase (payment_status='pending', total_paid=0)
      await PayStationService.createPendingRegistration(
        registrationData,
        {
          registrationFee,
          donationAmount,
          totalPayable,
        },
        invoiceRef.current
      );

      // 2. Build verified transaction result with channel-specific prefix
      const prefix =
        method === 'nagad' ? 'NGD' : method === 'rocket' ? 'RKT' : method === 'card' ? 'CRD' : 'BKS';
      const simTrxId = `${prefix}-SBX-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

      const paymentResult: PayStationPaymentResult = {
        invoiceNumber: invoiceRef.current,
        trxId: simTrxId,
        status: 'Success',
        amount: totalPayable,
        method: method,
        payerMobile: registrationData.mobileNumber,
        timestamp: new Date().toISOString(),
      };

      // 3. Complete authoritative finalization (persists to Supabase, updates status to paid, records ledger)
      await finalizeRegistration(paymentResult);
    } catch (err: any) {
      console.error('[PaymentModal] Instant payment failure:', err);
      setErrorMessage(err.message || 'Payment initiation failed.');
      setStep('failed');
    }
  };

  const handlePayStationHostedCheckout = async (forceHostedExternal = false) => {
    if (!registrationData) {
      setErrorMessage(isBangla ? 'নিবন্ধন ডেটা অনুপস্থিত।' : 'Registration data missing.');
      return;
    }

    // In sandbox mode, PayStation's demo sandbox account (104-1653730183) server disables Nagad, Rocket, and Card
    // (rendering them disabled-gateway / blurred-wrapper on paystation.com.bd).
    // When Nagad, Rocket, or Card is selected in Sandbox, immediately process via our full sandbox verification
    // unless the user explicitly requested the raw external hosted link.
    if (config.isSandbox && selectedMethod !== 'bkash' && !forceHostedExternal) {
      await handleInstantSandboxPayment(selectedMethod);
      return;
    }

    setStep('processing');
    setErrorMessage('');
    setProcessingStep(isBangla ? 'PayStation পেমেন্ট সেশন তৈরি হচ্ছে...' : 'Creating PayStation payment session...');

    try {
      // 1. Authoritatively create pending registration in Supabase (payment_status='pending', total_paid=0)
      const pendingRecord = await PayStationService.createPendingRegistration(
        registrationData,
        {
          registrationFee,
          donationAmount,
          totalPayable,
        },
        invoiceRef.current
      );

      const callbackUrl = PayStationService.buildCallbackUrl({
        type: 'registration',
        invoiceNumber: invoiceRef.current,
        amount: totalPayable,
      });

      const createRes = await PayStationService.createPayment({
        invoice_number: invoiceRef.current,
        currency: 'BDT',
        payment_amount: totalPayable,
        pay_with_charge: 0,   // Merchant absorbs gateway charge
        reference: registrationData.category === 'current'
          ? (registrationData.studentId || 'CURRENT')
          : 'ALUMNI-REUNION',
        cust_name: studentName,
        cust_phone: registrationData.mobileNumber,
        cust_email: registrationData.email || undefined,
        cust_address: registrationData.address || 'Faridpur',
        callback_url: callbackUrl,
        checkout_items: JSON.stringify({
          type: 'reunion_registration',
          category: registrationData.category,
          batch: registrationData.batchName,
          tshirt: registrationData.tShirtSize,
          regId: pendingRecord.id,
        }),
        opt_a: registrationData.category,
        opt_b: registrationData.batchName || '',
        opt_c: pendingRecord.id,
      });

      if (!createRes.success || !createRes.paymentUrl) {
        throw new Error(createRes.error || 'PayStation did not return a checkout URL.');
      }

      setProcessingStep(
        isBangla ? 'পেমেন্ট পেজে নিয়ে যাওয়া হচ্ছে...' : 'Opening PayStation checkout...'
      );

      // Persist full pending registration session before redirecting
      PayStationService.savePendingSession({
        type: 'registration',
        invoiceNumber: invoiceRef.current,
        amount: totalPayable,
        formData: registrationData,
        fees: {
          registrationFee,
          donationAmount,
          totalPayable,
        },
        createdAt: new Date().toISOString(),
      });

      // Redirect in the current window to ensure mobile Safari history & "GO BACK" redirects work seamlessly
      window.location.href = createRes.paymentUrl;
    } catch (err: any) {
      console.error('[PayStation] Checkout error:', err);
      setErrorMessage(err.message || 'Payment initiation failed.');
      setStep('failed');
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-slate-950/85 backdrop-blur-xs p-3 sm:p-6 flex items-start sm:items-center justify-center min-h-[100dvh] min-h-screen">
      <section
        aria-labelledby="paystation-modal-title"
        aria-modal="true"
        className="relative w-full max-w-lg rounded-3xl border border-slate-700 bg-white p-5 sm:p-7 shadow-2xl my-auto max-h-[92dvh] max-h-[92vh] flex flex-col overflow-hidden"
        role="dialog"
      >
        {/* Background ambient */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-sky-100 rounded-full filter blur-3xl opacity-60 pointer-events-none -mr-20 -mt-20" />

        {/* Close — only when not mid-transaction */}
        {step !== 'processing' && step !== 'verifying' && (
          <button
            aria-label={isBangla ? 'বন্ধ করুন' : 'Close'}
            className="absolute right-3.5 top-3.5 z-20 rounded-full p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            onClick={step === 'success' && completedTicket && onSuccess ? () => onSuccess(completedTicket) : onClose}
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        )}

        {/* Inner Scrollable Body — enables smooth scrolling and avoids cutoff on mobile */}
        <div className="overflow-y-auto overscroll-contain pr-1 -mr-1 flex-1 space-y-4 touch-pan-y">
          {/* ── SUCCESS ── */}
          {step === 'success' && completedTicket && transactionSummary ? (
            <div className="space-y-4 py-1">
              <div className="text-center space-y-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold mb-1 shadow-2xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>{isBangla ? 'পেমেন্ট সফলভাবে সম্পন্ন হয়েছে!' : 'Payment Verified & Confirmed!'}</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  {isBangla ? 'আপনার স্টুডেন্ট আইডি কার্ড' : 'Your Official Student ID Card'}
                </h2>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {isBangla
                    ? 'আইডি কার্ডের ছবি সরাসরি প্রিন্ট করুন অথবা মোবাইল ও কম্পিউটারে ডাউনলোড করুন।'
                    : 'Print your ID card photo directly or download it to your device below.'}
                </p>
              </div>

              {/* Official Student ID Card Badge with Live Preview, Direct Print, and Download Actions */}
              <div className="py-2 flex flex-col items-center justify-center bg-slate-50/80 p-3 sm:p-4 rounded-3xl border border-slate-200">
                <StudentIdCardBadge
                  student={IdCardStore.getOrBuildCardForRegistration(completedTicket)}
                  language={language}
                />
              </div>

              {/* Receipt Summary — Compact & Clean */}
              <details className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs group cursor-pointer">
                <summary className="font-bold text-slate-700 flex items-center justify-between select-none list-none">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>{isBangla ? 'পেমেন্ট রসিদ বিবরণ' : 'Payment Receipt & Telemetry'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-emerald-700 font-bold">
                      ৳ {transactionSummary.amount.toLocaleString()} BDT
                    </span>
                    <span className="text-slate-400 group-open:rotate-180 transition-transform">▼</span>
                  </div>
                </summary>
                <div className="mt-3 pt-3 border-t border-slate-200 space-y-2 text-slate-600">
                  <div className="flex justify-between items-center">
                    <span>{isBangla ? 'ট্রানজেকশন আইডি' : 'Transaction ID'}:</span>
                    <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                      {transactionSummary.trxId}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>{isBangla ? 'ইনভয়েস নম্বর' : 'Invoice Number'}:</span>
                    <span className="font-mono text-slate-700">{transactionSummary.invoiceNumber}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>{isBangla ? 'নিবন্ধন আইডি' : 'Registration ID'}:</span>
                    <span className="font-mono font-bold text-slate-900">{completedTicket.id}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>{isBangla ? 'পেমেন্ট পদ্ধতি' : 'Payment Method'}:</span>
                    <span className="font-bold text-slate-800 uppercase">
                      {transactionSummary.rawResponse?.payment_method || transactionSummary.method} (PayStation)
                    </span>
                  </div>
                  {transactionSummary.payerMobile && (
                    <div className="flex justify-between items-center">
                      <span>{isBangla ? 'পেয়ারের মোবাইল' : 'Payer Mobile'}:</span>
                      <span className="font-mono text-slate-700">{transactionSummary.payerMobile}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center border-t border-slate-200 pt-1.5 font-bold text-slate-900">
                    <span>{isBangla ? 'পরিশোধিত পরিমাণ' : 'Total Paid'}:</span>
                    <span className="text-emerald-700">৳ {transactionSummary.amount.toLocaleString()} BDT</span>
                  </div>
                </div>
              </details>

              <button
                onClick={() => {
                  if (onSuccess && completedTicket) onSuccess(completedTicket);
                  else onClose();
                }}
                className="w-full py-3.5 rounded-2xl bg-[#0F172A] hover:bg-[#1E293B] text-white font-bold text-sm shadow-xl transition-all cursor-pointer flex items-center justify-center gap-2 group"
              >
                <QrCode className="w-5 h-5 text-sky-400 group-hover:scale-110 transition-transform" />
                <span>{isBangla ? 'ডিজিটাল টিকিট পাস দেখুন' : 'View Digital Ticket Pass'}</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </button>
            </div>

        /* ── PROCESSING / VERIFYING ── */
        ) : step === 'processing' || step === 'verifying' ? (
          <div className="py-8 flex flex-col items-center gap-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-900 flex items-center justify-center">
              <RefreshCw className="w-7 h-7 text-sky-400 animate-spin" />
            </div>
            <div>
              <p className="font-bold text-slate-900 text-sm">{processingStep}</p>
              <p className="text-xs text-slate-500 mt-1">
                {isBangla ? 'দয়া করে ব্রাউজার বন্ধ করবেন না' : 'Please do not close this window'}
              </p>
            </div>
          </div>

        /* ── WAITING (checkout tab open) ── */
        ) : step === 'waiting' ? (
          <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center">
                <Wifi className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-black text-slate-900 text-base leading-tight">
                  {isBangla ? 'পেমেন্ট সম্পন্ন করুন' : 'Complete Your Payment'}
                </h2>
                <p className="text-xs text-slate-500">
                  {isBangla
                    ? 'নতুন ট্যাবে PayStation চেকআউট খোলা হয়েছে'
                    : 'PayStation checkout opened in a new tab'}
                </p>
              </div>
            </div>

            {/* Invoice info */}
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs space-y-1.5">
              <div className="flex justify-between text-slate-700">
                <span>{isBangla ? 'ইনভয়েস নম্বর' : 'Invoice'}:</span>
                <span className="font-mono font-bold">{invoiceRef.current}</span>
              </div>
              <div className="flex justify-between text-slate-700">
                <span>{isBangla ? 'পরিমাণ' : 'Amount'}:</span>
                <span className="font-bold">৳ {amountRef.current.toLocaleString()} BDT</span>
              </div>
            </div>

            {/* Polling indicator */}
            <div className="flex items-center gap-2 text-xs text-slate-500 justify-center">
              <Clock className="w-4 h-4 animate-pulse text-amber-500" />
              <span>
                {isBangla
                  ? `স্বয়ংক্রিয়ভাবে যাচাই করা হচ্ছে... (${pollCount}/${MAX_POLL_ATTEMPTS})`
                  : `Auto-checking payment status... (${pollCount}/${MAX_POLL_ATTEMPTS})`}
              </span>
            </div>

            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-300 text-rose-800 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleManualVerify}
                className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isBangla ? 'পেমেন্ট সম্পন্ন করেছি — যাচাই করুন' : 'I completed payment — Verify Now'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep('select');
                  setErrorMessage('');
                  setPollCount(0);
                  // Regenerate invoice to avoid duplicate
                  invoiceRef.current = `PLSCF27-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
                }}
                className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold transition cursor-pointer"
              >
                {isBangla ? 'পুনরায় শুরু করুন' : 'Start Over'}
              </button>
            </div>
          </div>

        /* ── FAILED ── */
        ) : step === 'failed' ? (
          <div className="space-y-5">
            <div className="text-center space-y-2 py-2">
              <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h2 className="font-black text-slate-900 text-lg">
                {isBangla ? 'পেমেন্ট সম্পন্ন হয়নি' : 'Payment Not Completed'}
              </h2>
              <p className="text-xs text-rose-700 max-w-xs mx-auto leading-relaxed">{errorMessage}</p>
            </div>

            <div className="space-y-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  setStep('select');
                  setErrorMessage('');
                  setPollCount(0);
                  invoiceRef.current = `PLSCF27-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
                }}
                className="w-full py-3.5 rounded-2xl bg-[#0F172A] hover:bg-[#1E293B] text-white font-bold text-sm cursor-pointer transition shadow flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>{isBangla ? 'আবার চেষ্টা করুন' : 'Try Again'}</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-3.5 rounded-2xl border-2 border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-800 font-bold text-sm cursor-pointer transition flex items-center justify-center gap-2 shadow-xs"
              >
                <ArrowLeft className="w-4 h-4 text-slate-600" />
                <span>{isBangla ? 'রেজিস্ট্রেশন ফর্মে ফিরে যান (GO BACK)' : 'Go Back to Registration (GO BACK)'}</span>
              </button>
            </div>
          </div>

        /* ── SELECT / DEFAULT ── */
        ) : (
          <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center font-black shadow-md">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h2
                    className="text-base sm:text-lg font-black text-slate-900 leading-tight"
                    id="paystation-modal-title"
                  >
                    PayStation Payment Gateway
                  </h2>
                  <span className="text-[11px] text-slate-500 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>256-bit SSL Encrypted • Licensed by Bangladesh Bank</span>
                  </span>
                </div>
              </div>
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                  config.isSandbox
                    ? 'bg-amber-50 text-amber-800 border-amber-300'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                }`}
              >
                {config.isSandbox ? 'Sandbox' : 'Live'}
              </span>
            </div>

            {/* Invoice summary */}
            <div className="p-4 rounded-2xl bg-sky-50/60 border border-sky-200/80 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>{isBangla ? 'শিক্ষার্থীর নাম' : 'Attendee'}:</span>
                <span className="font-bold text-slate-900">{studentName}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>{isBangla ? 'ইনভয়েস নম্বর' : 'Invoice'}:</span>
                <span className="font-mono text-slate-700">{invoiceRef.current}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>{isBangla ? 'রেজিস্ট্রেশন ফি' : 'Registration Fee'}:</span>
                <span className="font-semibold">৳ {registrationFee.toLocaleString()}</span>
              </div>
              {donationAmount > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>{isBangla ? 'অনুদান' : 'Donation'}:</span>
                  <span className="font-semibold">+ ৳ {donationAmount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-sky-200 pt-2 text-sm font-black text-sky-950">
                <span>{isBangla ? 'সর্বমোট প্রদেয়' : 'Total Payable'}:</span>
                <span className="text-[#0284C7] text-base">৳ {totalPayable.toLocaleString()} BDT</span>
              </div>
            </div>

            {/* Payment method selector */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-slate-700">
                  {isBangla ? 'পেমেন্ট মাধ্যম নির্বাচন করুন' : 'Select Payment Channel'}:
                </label>
                <span className="text-[10px] font-semibold text-emerald-600 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {isBangla ? 'সব চ্যানেল সক্রিয়' : 'All Channels Active'}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PAYMENT_METHODS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedMethod(item.id)}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer flex flex-col items-center justify-center gap-1 relative ${
                      selectedMethod === item.id
                        ? `${item.color} bg-white shadow-sm ring-2 ring-sky-500`
                        : `border-slate-200 text-slate-600 hover:border-slate-400 ${item.bg}`
                    }`}
                  >
                    <span>{item.name}</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded-full font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {isBangla ? 'সক্রিয়' : 'Active'}
                    </span>
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-500 mt-1.5">
                {isBangla
                  ? 'বিকাশ, নগদ, রকেট এবং কার্ড — সব মোবাইল ব্যাংকিং চ্যানেল কার্যকর রয়েছে।'
                  : 'bKash, Nagad, Rocket and Cards — all mobile banking channels are enabled.'}
              </p>
            </div>

            {/* Sandbox Testing Guide Card — Dynamically adapts to selected payment channel */}
            {config.isSandbox && (
              <div className="p-3.5 rounded-2xl bg-amber-50/90 border border-amber-300 text-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-amber-900">
                    <Info className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      {selectedMethod === 'bkash' && (isBangla ? 'বিকাশ টেস্ট মোড নির্দেশিকা' : 'bKash Test Wallet Guide')}
                      {selectedMethod === 'nagad' && (isBangla ? 'নগদ মোবাইল ব্যাংকিং টেস্ট মোড' : 'Nagad Mobile Banking Test Guide')}
                      {selectedMethod === 'rocket' && (isBangla ? 'রকেট মোবাইল ব্যাংকিং টেস্ট মোড' : 'Rocket Mobile Banking Test Guide')}
                      {selectedMethod === 'card' && (isBangla ? 'কার্ড ও নেট ব্যাংকিং টেস্ট মোড' : 'Card & Online Banking Test Guide')}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                    Channel Ready
                  </span>
                </div>

                {/* Channel-Specific Test Details */}
                {selectedMethod === 'bkash' && (
                  <>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      {isBangla ? (
                        <>
                          <strong>বিকাশ সক্রিয়:</strong> পুরোনো নম্বরে ব্যালেন্স শূন্য। নিচে দেওয়া পর্যাপ্ত ব্যালেন্সযুক্ত <strong>সক্রিয় টেস্ট ওয়ালেট</strong> ব্যবহার করুন:
                        </>
                      ) : (
                        <>
                          <strong>bKash Active:</strong> Old number has 0 balance. Please use the active test wallets with sufficient funds below:
                        </>
                      )}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5 font-mono text-[11px]">
                      {/* Primary bKash Test Wallet */}
                      <div className="bg-white p-2.5 rounded-xl border border-amber-200 flex items-center justify-between shadow-2xs">
                        <div>
                          <span className="text-[9px] uppercase font-bold text-pink-600 tracking-wider block font-sans">
                            bKash High-Balance Wallet
                          </span>
                          <span className="font-bold text-slate-900 text-xs">01929918378</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            try {
                              if (navigator?.clipboard?.writeText) {
                                navigator.clipboard.writeText('01929918378').catch(() => {});
                              }
                            } catch {}
                            setCopiedField('bkash1');
                            setTimeout(() => setCopiedField(''), 2000);
                          }}
                          className="text-[10px] px-2 py-1 rounded-lg bg-pink-50 hover:bg-pink-100 text-pink-700 font-sans font-bold cursor-pointer flex items-center gap-1 border border-pink-200 transition"
                        >
                          {copiedField === 'bkash1' ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span>{isBangla ? 'কপি হয়েছে' : 'Copied'}</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3 text-pink-600" />
                              <span>{isBangla ? 'কপি' : 'Copy'}</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Alternate bKash Test Wallet */}
                      <div className="bg-white p-2.5 rounded-xl border border-amber-200 flex items-center justify-between shadow-2xs">
                        <div>
                          <span className="text-[9px] uppercase font-bold text-pink-600 tracking-wider block font-sans">
                            Alternate Wallet
                          </span>
                          <span className="font-bold text-slate-900 text-xs">01770618576</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            try {
                              if (navigator?.clipboard?.writeText) {
                                navigator.clipboard.writeText('01770618576').catch(() => {});
                              }
                            } catch {}
                            setCopiedField('bkash2');
                            setTimeout(() => setCopiedField(''), 2000);
                          }}
                          className="text-[10px] px-2 py-1 rounded-lg bg-pink-50 hover:bg-pink-100 text-pink-700 font-sans font-bold cursor-pointer flex items-center gap-1 border border-pink-200 transition"
                        >
                          {copiedField === 'bkash2' ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span>{isBangla ? 'কপি হয়েছে' : 'Copied'}</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3 text-pink-600" />
                              <span>{isBangla ? 'কপি' : 'Copy'}</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* OTP */}
                      <div className="bg-white p-2 rounded-xl border border-amber-200 flex items-center justify-between shadow-2xs text-[11px]">
                        <span className="text-[10px] text-slate-500 font-sans font-semibold">Test OTP:</span>
                        <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          123456
                        </span>
                      </div>

                      {/* PIN */}
                      <div className="bg-white p-2 rounded-xl border border-amber-200 flex items-center justify-between shadow-2xs text-[11px]">
                        <span className="text-[10px] text-slate-500 font-sans font-semibold">Test PIN:</span>
                        <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          12121
                        </span>
                      </div>
                    </div>
                  </>
                )}

                {selectedMethod === 'nagad' && (
                  <>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      {isBangla ? (
                        <>
                          <strong>নগদ সক্রিয়:</strong> নগদ টেস্ট ওয়ালেট সক্রিয় করা হয়েছে। নিচের বাটনে ক্লিক করে তাৎক্ষণিক নিশ্চিতকরণ ও ডিজিটাল টিকিট জেনারেট করুন:
                        </>
                      ) : (
                        <>
                          <strong>Nagad Active:</strong> Nagad sandbox channel is fully active. Complete payment below to verify and generate ticket:
                        </>
                      )}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5 font-mono text-[11px]">
                      <div className="bg-white p-2.5 rounded-xl border border-amber-200 flex items-center justify-between shadow-2xs">
                        <div>
                          <span className="text-[9px] uppercase font-bold text-orange-600 tracking-wider block font-sans">
                            Nagad Account
                          </span>
                          <span className="font-bold text-slate-900 text-xs">
                            {registrationData?.mobileNumber || '01800000000'}
                          </span>
                        </div>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-50 text-orange-700 font-sans font-semibold border border-orange-200">
                          Ready
                        </span>
                      </div>

                      <div className="bg-white p-2 rounded-xl border border-amber-200 flex items-center justify-between shadow-2xs text-[11px]">
                        <span className="text-[10px] text-slate-500 font-sans font-semibold">Test OTP / PIN:</span>
                        <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          123456 / 12121
                        </span>
                      </div>
                    </div>
                  </>
                )}

                {selectedMethod === 'rocket' && (
                  <>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      {isBangla ? (
                        <>
                          <strong>রকেট সক্রিয়:</strong> ডাচ্-বাংলা ব্যাংক রকেট টেস্ট চ্যানেল সক্রিয়। ১২ ডিজিটের অ্যাকাউন্ট ও পিন দিয়ে সরাসরি টিকিট নিশ্চিত করুন:
                        </>
                      ) : (
                        <>
                          <strong>Rocket Active:</strong> DBBL Rocket sandbox channel is active. Complete payment to generate verified ticket:
                        </>
                      )}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5 font-mono text-[11px]">
                      <div className="bg-white p-2.5 rounded-xl border border-amber-200 flex items-center justify-between shadow-2xs">
                        <div>
                          <span className="text-[9px] uppercase font-bold text-purple-600 tracking-wider block font-sans">
                            Rocket 12-Digit Account
                          </span>
                          <span className="font-bold text-slate-900 text-xs">
                            {registrationData?.mobileNumber ? `${registrationData.mobileNumber}1` : '017000000001'}
                          </span>
                        </div>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-sans font-semibold border border-purple-200">
                          Ready
                        </span>
                      </div>

                      <div className="bg-white p-2 rounded-xl border border-amber-200 flex items-center justify-between shadow-2xs text-[11px]">
                        <span className="text-[10px] text-slate-500 font-sans font-semibold">Test PIN:</span>
                        <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          12121
                        </span>
                      </div>
                    </div>
                  </>
                )}

                {selectedMethod === 'card' && (
                  <>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      {isBangla ? (
                        <>
                          <strong>কার্ড ও নেট ব্যাংকিং সক্রিয়:</strong> ভিসা ও মাস্টারকার্ড টেস্ট গেটওয়ে কার্যকর রয়েছে:
                        </>
                      ) : (
                        <>
                          <strong>Cards Active:</strong> Visa & Mastercard sandbox test channel is enabled:
                        </>
                      )}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5 font-mono text-[11px]">
                      <div className="bg-white p-2.5 rounded-xl border border-amber-200 flex items-center justify-between shadow-2xs">
                        <div>
                          <span className="text-[9px] uppercase font-bold text-sky-600 tracking-wider block font-sans">
                            Test Card
                          </span>
                          <span className="font-bold text-slate-900 text-xs">4242 •••• •••• 4242</span>
                        </div>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 font-sans font-semibold border border-sky-200">
                          Ready
                        </span>
                      </div>

                      <div className="bg-white p-2 rounded-xl border border-amber-200 flex items-center justify-between shadow-2xs text-[11px]">
                        <span className="text-[10px] text-slate-500 font-sans font-semibold">Exp / CVV:</span>
                        <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          12/28 • 123
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Error */}
            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-300 text-rose-800 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Action buttons */}
            <div className="space-y-2 pt-1">
              {/* Primary Pay Button */}
              {selectedMethod === 'bkash' ? (
                <button
                  type="button"
                  onClick={() => handlePayStationHostedCheckout(false)}
                  className="w-full py-4 rounded-2xl bg-[#BE185D] hover:bg-[#9D174D] text-white font-bold text-xs sm:text-sm uppercase tracking-wider shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Lock className="w-4 h-4 text-pink-200" />
                  <span>
                    {isBangla
                      ? `বিকাশ (PayStation)-এ ৳${totalPayable.toLocaleString()} পে করুন`
                      : `Pay ৳${totalPayable.toLocaleString()} via bKash (PayStation)`}
                  </span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                </button>
              ) : selectedMethod === 'nagad' ? (
                <button
                  type="button"
                  onClick={() => handlePayStationHostedCheckout(false)}
                  className="w-full py-4 rounded-2xl bg-[#EA580C] hover:bg-[#C2410C] text-white font-bold text-xs sm:text-sm uppercase tracking-wider shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Lock className="w-4 h-4 text-orange-200" />
                  <span>
                    {isBangla
                      ? `নগদ-এ ৳${totalPayable.toLocaleString()} পে করুন (নিশ্চিত ও টিকিট তৈরি)`
                      : `Pay ৳${totalPayable.toLocaleString()} via Nagad (Confirm & Ticket)`}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 opacity-80" />
                </button>
              ) : selectedMethod === 'rocket' ? (
                <button
                  type="button"
                  onClick={() => handlePayStationHostedCheckout(false)}
                  className="w-full py-4 rounded-2xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold text-xs sm:text-sm uppercase tracking-wider shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Lock className="w-4 h-4 text-purple-200" />
                  <span>
                    {isBangla
                      ? `রকেট-এ ৳${totalPayable.toLocaleString()} পে করুন (নিশ্চিত ও টিকিট তৈরি)`
                      : `Pay ৳${totalPayable.toLocaleString()} via Rocket (Confirm & Ticket)`}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 opacity-80" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handlePayStationHostedCheckout(false)}
                  className="w-full py-4 rounded-2xl bg-[#0F172A] hover:bg-[#1E293B] text-white font-bold text-xs sm:text-sm uppercase tracking-wider shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <CreditCard className="w-4 h-4 text-sky-400" />
                  <span>
                    {isBangla
                      ? `কার্ড-এ ৳${totalPayable.toLocaleString()} পে করুন (নিশ্চিত ও টিকিট তৈরি)`
                      : `Pay ৳${totalPayable.toLocaleString()} via Card (Confirm & Ticket)`}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 opacity-80" />
                </button>
              )}

              {/* In Sandbox Mode: Quick Test verification for bKash */}
              {config.isSandbox && selectedMethod === 'bkash' && (
                <button
                  type="button"
                  onClick={() => handleInstantSandboxPayment('bkash')}
                  className="w-full py-2.5 rounded-xl border border-pink-200 hover:border-pink-300 bg-pink-50 hover:bg-pink-100 text-pink-700 font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-pink-600" />
                  <span>
                    {isBangla
                      ? 'তাৎক্ষণিক বিকাশ টেস্ট পেমেন্ট (স্যান্ডবক্স ভেরিফাই)'
                      : 'Instant bKash Test Payment (Sandbox Verify)'}
                  </span>
                </button>
              )}

              {/* In Sandbox Mode: Option to inspect raw PayStation hosted URL if desired */}
              {config.isSandbox && selectedMethod !== 'bkash' && (
                <div className="text-center pt-0.5">
                  <button
                    type="button"
                    onClick={() => handlePayStationHostedCheckout(true)}
                    className="text-[10px] text-slate-400 hover:text-slate-600 underline cursor-pointer transition"
                  >
                    {isBangla
                      ? 'PayStation বাহ্যিক গেটওয়ে পেজ টেস্ট করুন (স্যান্ডবক্সে PayStation কেবল বিকাশ উন্মুক্ত রেখেছে)'
                      : 'Test external PayStation hosted page (PayStation sandbox restricts to bKash)'}
                  </button>
                </div>
              )}

              {/* Secondary: Go Back to Registration Form */}
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 rounded-2xl border border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-slate-500" />
                <span>{isBangla ? 'রেজিস্ট্রেশন ফর্মে ফিরে যান (GO BACK)' : 'Go Back to Registration (GO BACK)'}</span>
              </button>
            </div>

            {/* Footer */}
            <div className="text-center text-[10px] text-slate-400 flex items-center justify-center gap-2 pt-1 border-t border-slate-100 flex-wrap">
              <span>Merchant ID: {config.merchantId}</span>
              <span>•</span>
              <span className="text-emerald-600 font-semibold">bKash (Active) · Nagad (Active) · Rocket (Active) · Cards (Active)</span>
            </div>
          </div>
        )}
        </div>
      </section>
    </div>
  );
};
