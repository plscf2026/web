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

interface PaymentModalProps {
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
}

type ModalStep =
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
  const invoiceRef = useRef(`PLSCF26-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`);
  const amountRef  = useRef(totalPayable);

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

  // ── Finalize after confirmed payment ────────────────────────────────────

  const finalizeRegistration = async (payment: PayStationPaymentResult) => {
    if (!registrationData) return;
    setStep('verifying');
    setProcessingStep(isBangla ? 'ডিজিটাল টিকিট তৈরি হচ্ছে...' : 'Generating secure digital ticket...');
    try {
      const ticket = await PayStationService.completeRegistrationAfterPayment(
        registrationData,
        payment
      );
      setTransactionSummary(payment);
      setCompletedTicket(ticket);
      setStep('success');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Ticket generation failed.');
      setStep('failed');
    }
  };

  // ── Hosted checkout launch (real gateway) ───────────────────────────────

  const handlePayStationHostedCheckout = async () => {
    if (!registrationData) {
      setErrorMessage(isBangla ? 'নিবন্ধন ডেটা অনুপস্থিত।' : 'Registration data missing.');
      return;
    }

    setStep('processing');
    setErrorMessage('');
    setProcessingStep(isBangla ? 'PayStation পেমেন্ট সেশন তৈরি হচ্ছে...' : 'Creating PayStation payment session...');

    try {
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
        }),
        opt_a: registrationData.category,
        opt_b: registrationData.batchName || '',
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

  // ── Sandbox direct simulation (dev only) ────────────────────────────────

  const handleSandboxSimulation = async () => {
    if (!registrationData) {
      setErrorMessage(isBangla ? 'নিবন্ধন ডেটা অনুপস্থিত।' : 'Registration data missing.');
      return;
    }

    setStep('processing');
    setErrorMessage('');
    setProcessingStep(isBangla ? 'PayStation Sandbox সিমুলেশন চলছে...' : 'Running PayStation Sandbox simulation...');

    try {
      await new Promise((r) => setTimeout(r, 1000));

      // Create payment session (gets sandbox URL)
      const createRes = await PayStationService.createPayment({
        invoice_number: invoiceRef.current,
        currency: 'BDT',
        payment_amount: totalPayable,
        pay_with_charge: 0,
        reference: 'SANDBOX-TEST',
        cust_name: studentName,
        cust_phone: registrationData.mobileNumber,
        cust_email: registrationData.email || undefined,
        cust_address: registrationData.address || 'Faridpur',
        callback_url: PayStationService.buildCallbackUrl({
          type: 'registration',
          invoiceNumber: invoiceRef.current,
          amount: totalPayable,
        }),
      });

      setProcessingStep(isBangla ? 'পেমেন্ট যাচাই করা হচ্ছে...' : 'Verifying simulated payment...');
      await new Promise((r) => setTimeout(r, 800));

      const simTrxId =
        createRes.trxId ||
        `PST-SBX-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

      const paymentResult: PayStationPaymentResult = {
        invoiceNumber: invoiceRef.current,
        trxId: simTrxId,
        status: 'Success',
        amount: totalPayable,
        method: selectedMethod,
        payerMobile: registrationData.mobileNumber,
        timestamp: new Date().toISOString(),
      };

      setProcessingStep(isBangla ? 'ডিজিটাল টিকিট তৈরি হচ্ছে...' : 'Generating secure ticket...');
      await finalizeRegistration(paymentResult);
    } catch (err: any) {
      console.error('[PayStation] Simulation error:', err);
      setErrorMessage(err.message || 'Simulation failed.');
      setStep('failed');
    }
  };

  // ── Manual verification after returning from checkout ───────────────────

  const handleManualVerify = async () => {
    setStep('verifying');
    setProcessingStep(isBangla ? 'পেমেন্ট স্ট্যাটাস যাচাই করা হচ্ছে...' : 'Verifying payment status...');
    try {
      const verifyRes = await PayStationService.verifyReturnedPayment(
        invoiceRef.current,
        amountRef.current
      );
      if (verifyRes.verified && verifyRes.result) {
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

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
      <section
        aria-labelledby="paystation-modal-title"
        aria-modal="true"
        className="relative w-full max-w-lg rounded-3xl border border-slate-700 bg-white p-6 sm:p-7 shadow-2xl overflow-hidden"
        role="dialog"
      >
        {/* Background ambient */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-sky-100 rounded-full filter blur-3xl opacity-60 pointer-events-none -mr-20 -mt-20" />

        {/* Close — only when not mid-transaction */}
        {step !== 'processing' && step !== 'verifying' && (
          <button
            aria-label={isBangla ? 'বন্ধ করুন' : 'Close'}
            className="absolute right-4 top-4 rounded-full p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            onClick={onClose}
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        )}

        {/* ── SUCCESS ── */}
        {step === 'success' && completedTicket && transactionSummary ? (
          <div className="space-y-5 py-2">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {isBangla ? 'পেমেন্ট সফলভাবে সম্পন্ন!' : 'Payment Verified & Confirmed!'}
              </h2>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {isBangla
                  ? 'আপনার নিবন্ধন ও ডিজিটাল টিকিট প্রস্তুত। প্রবেশ গেটে QR কোড দেখান।'
                  : 'Your registration is confirmed. Present the QR code at the entry gate.'}
              </p>
            </div>

            {/* Receipt */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-2.5">
              <div className="flex justify-between items-center text-slate-600">
                <span>{isBangla ? 'ট্রানজেকশন আইডি' : 'Transaction ID'}:</span>
                <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                  {transactionSummary.trxId}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>{isBangla ? 'ইনভয়েস নম্বর' : 'Invoice Number'}:</span>
                <span className="font-mono text-slate-700">{transactionSummary.invoiceNumber}</span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>{isBangla ? 'নিবন্ধন আইডি' : 'Registration ID'}:</span>
                <span className="font-mono font-bold text-slate-900">{completedTicket.id}</span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>{isBangla ? 'পেমেন্ট পদ্ধতি' : 'Payment Method'}:</span>
                <span className="font-bold text-slate-800 uppercase">
                  {transactionSummary.rawResponse?.payment_method || transactionSummary.method} (PayStation)
                </span>
              </div>
              {transactionSummary.payerMobile && (
                <div className="flex justify-between items-center text-slate-600">
                  <span>{isBangla ? 'পেয়ারের মোবাইল' : 'Payer Mobile'}:</span>
                  <span className="font-mono text-slate-700">{transactionSummary.payerMobile}</span>
                </div>
              )}
              <div className="flex justify-between items-center border-t border-slate-200 pt-2 text-sm font-black text-slate-900">
                <span>{isBangla ? 'পরিশোধিত পরিমাণ' : 'Total Paid'}:</span>
                <span className="text-emerald-700">৳ {transactionSummary.amount.toLocaleString()} BDT</span>
              </div>
            </div>

            <button
              onClick={() => {
                if (onSuccess && completedTicket) onSuccess(completedTicket);
                else onClose();
              }}
              className="w-full py-4 rounded-2xl bg-[#0F172A] hover:bg-[#1E293B] text-white font-bold text-sm shadow-xl transition-all cursor-pointer flex items-center justify-center gap-2 group"
            >
              <QrCode className="w-5 h-5 text-sky-400 group-hover:scale-110 transition-transform" />
              <span>{isBangla ? 'ডিজিটাল টিকিট দেখুন' : 'View Digital Ticket Pass'}</span>
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
                <span className="font-bold">৳ {totalPayable.toLocaleString()} BDT</span>
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
                  invoiceRef.current = `PLSCF26-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
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
                {isBangla ? 'পেমেন্ট ব্যর্থ হয়েছে' : 'Payment Failed'}
              </h2>
              <p className="text-xs text-rose-700 max-w-xs mx-auto">{errorMessage}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setStep('select');
                setErrorMessage('');
                setPollCount(0);
                invoiceRef.current = `PLSCF26-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
              }}
              className="w-full py-3 rounded-2xl bg-slate-900 hover:bg-slate-700 text-white font-bold text-sm cursor-pointer transition"
            >
              {isBangla ? 'আবার চেষ্টা করুন' : 'Try Again'}
            </button>
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
              <label className="block text-xs font-bold text-slate-700 mb-2">
                {isBangla ? 'পেমেন্ট মাধ্যম নির্বাচন করুন' : 'Select Payment Channel'}:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PAYMENT_METHODS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedMethod(item.id)}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                      selectedMethod === item.id
                        ? `${item.color} bg-white shadow-sm ring-2 ring-sky-500`
                        : `border-slate-200 text-slate-600 hover:border-slate-400 ${item.bg}`
                    }`}
                  >
                    <span>{item.name}</span>
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5">
                {isBangla
                  ? 'PayStation চেকআউট পেজে নির্বাচিত মাধ্যমে পেমেন্ট সম্পন্ন করুন। Upay, Visa ও Mastercard-ও সমর্থিত।'
                  : 'Complete payment on the PayStation checkout page. Upay, Visa & Mastercard also supported.'}
              </p>
            </div>

            {/* Sandbox Testing Guide Card — Explains "The input wallet is not eligible" */}
            {config.isSandbox && (
              <div className="p-3.5 rounded-2xl bg-amber-50/90 border border-amber-300 text-xs space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-amber-900">
                  <Info className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    {isBangla ? 'স্যান্ডবক্স টেস্ট মোড — পরীক্ষার নির্দেশিকা' : 'Sandbox Test Wallet Guide'}
                  </span>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  {isBangla ? (
                    <>
                      <strong>সতর্কতা:</strong> বিকাশ/নগদে আপনার <strong>ব্যক্তিগত মোবাইল নম্বর দিবেন না</strong> (দিলে <em>&quot;The input wallet is not eligible&quot;</em> দেখায়)। নিচের টেস্ট অ্যাকাউন্ট ব্যবহার করুন:
                    </>
                  ) : (
                    <>
                      <strong>Notice:</strong> Do <strong>NOT</strong> enter your real phone number (it triggers <em>&quot;The input wallet is not eligible&quot;</em>). Use official sandbox test credentials:
                    </>
                  )}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5 font-mono text-[11px]">
                  {/* bKash Test Wallet */}
                  <div className="bg-white p-2.5 rounded-xl border border-amber-200 flex items-center justify-between shadow-2xs">
                    <div>
                      <span className="text-[9px] uppercase font-bold text-pink-600 tracking-wider block font-sans">
                        bKash Test Wallet
                      </span>
                      <span className="font-bold text-slate-900 text-xs">01770618575</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText('01770618575');
                        setCopiedField('bkash');
                        setTimeout(() => setCopiedField(''), 2000);
                      }}
                      className="text-[10px] px-2 py-1 rounded-lg bg-pink-50 hover:bg-pink-100 text-pink-700 font-sans font-bold cursor-pointer flex items-center gap-1 border border-pink-200 transition"
                    >
                      {copiedField === 'bkash' ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>{isBangla ? 'কপি হয়েছে' : 'Copied'}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-pink-600" />
                          <span>{isBangla ? 'কপি' : 'Copy'}</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* OTP & PIN */}
                  <div className="bg-white p-2.5 rounded-xl border border-amber-200 space-y-1 shadow-2xs text-[11px]">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-slate-500 font-sans font-semibold">Test OTP:</span>
                      <span className="font-bold text-slate-900 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                        123456
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-slate-500 font-sans font-semibold">Test PIN:</span>
                      <span className="font-bold text-slate-900 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                        12121
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-[10px] text-amber-700 font-sans flex items-center justify-between pt-0.5">
                  <span>{isBangla ? 'বিকল্প টেস্ট নম্বর:' : 'Alt test numbers:'} 01770618576, 01929918378</span>
                  <span className="font-bold text-amber-900">Sandbox Mode</span>
                </div>
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
              {/* Primary: Real PayStation hosted checkout */}
              <button
                type="button"
                onClick={handlePayStationHostedCheckout}
                className="w-full py-4 rounded-2xl bg-[#0F172A] hover:bg-[#1E293B] text-white font-bold text-xs sm:text-sm uppercase tracking-wider shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4 text-sky-400" />
                <span>
                  {isBangla
                    ? `PayStation-এ ৳${totalPayable.toLocaleString()} পে করুন`
                    : `Pay ৳${totalPayable.toLocaleString()} via PayStation`}
                </span>
                <ExternalLink className="w-3.5 h-3.5 opacity-60" />
              </button>

              {/* Sandbox simulation (only in sandbox/dev mode) */}
              {config.isSandbox && (
                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={handleSandboxSimulation}
                    className="text-xs text-amber-700 hover:text-amber-900 font-semibold underline cursor-pointer inline-flex items-center gap-1"
                  >
                    <span>
                      {isBangla ? 'Sandbox সিমুলেশন (টেস্ট মোড)' : 'Simulate Sandbox Payment (Test Mode)'}
                    </span>
                  </button>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {isBangla
                      ? 'শুধুমাত্র ডেভেলপমেন্ট পরীক্ষার জন্য'
                      : 'For development testing only — no real money moved'}
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="text-center text-[10px] text-slate-400 flex items-center justify-center gap-2 pt-1 border-t border-slate-100 flex-wrap">
              <span>Merchant ID: {config.merchantId}</span>
              <span>•</span>
              <span>bKash · Nagad · Rocket · Upay · Visa · Mastercard</span>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
