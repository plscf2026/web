import { useState, useEffect, useRef } from 'react';
import {
  AlertCircle,
  X,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  QrCode,
  Clock,
  Wifi,
  UserPlus,
} from 'lucide-react';
import { Language, RegistrationRecord } from '../types';
import { RegistrationFormData, calculateGatewayCharge } from '../utils/rules';
import { PayStationService, PayStationPaymentResult } from '../services/paystation';
import { StudentIdCardBadge } from './idcard/StudentIdCardBadge';
import { ParentIdCardBadge } from './idcard/ParentIdCardBadge';
import { IdCardStore } from '../services/idCardStore';
import { AppStore } from '../services/store';
import { StudentPhotoStorageService, isBase64DataUrl, extractStoragePathFromPublicUrl } from '../services/studentPhotoStorageService';

export interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (ticket: RegistrationRecord, targetView?: 'register' | 'ticket') => void;
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
  | 'processing'    // Calling PayStation API & redirecting immediately
  | 'waiting'       // Hosted checkout window opened — waiting for user to complete payment
  | 'verifying'     // Checking transaction status after return
  | 'success'       // Payment confirmed
  | 'failed';       // Payment failed

/** How often (ms) to poll the transaction status while waiting */
const POLL_INTERVAL_MS = 5000;
/** Max number of poll attempts before giving up */
const MAX_POLL_ATTEMPTS = 24;   // 24 × 5 s = 2 min

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  language,
  registrationFee,
  donationAmount,
  totalPayable: _totalPayable,
  studentName,
  registrationData,
  initialStep,
  initialErrorMessage,
  initialInvoice,
}) => {
  const isBangla = language === 'bn';

  const [step, setStep] = useState<ModalStep>(() => initialStep || 'processing');
  const [processingStep, setProcessingStep] = useState(() =>
    language === 'bn' ? 'PayStation চেকআউট পেজে নিয়ে যাওয়া হচ্ছে...' : 'Redirecting to PayStation checkout...'
  );
  const [errorMessage, setErrorMessage] = useState(() => initialErrorMessage || '');
  const [completedTicket, setCompletedTicket] = useState<RegistrationRecord | null>(null);
  const [transactionSummary, setTransactionSummary] = useState<PayStationPaymentResult | null>(null);
  const [activeCardTab, setActiveCardTab] = useState<'student' | 'parent'>('student');
  const [pollCount, setPollCount] = useState(0);

  // Uniform 1.8% gateway charge added on top of every payment subtotal
  const configuredParentFee = AppStore.getFeeSettings().parentFee ?? 500;
  const parentFee = registrationData?.hasParent ? (registrationData.parentFee ?? configuredParentFee) : 0;
  const subtotal = registrationFee + parentFee + donationAmount;
  const gatewayCharge = calculateGatewayCharge(subtotal);
  const finalTotalPayable = Math.round((subtotal + gatewayCharge) * 100) / 100;

  // Persist invoice & amount across renders so the polling closure uses fresh values
  const pendingSession = PayStationService.getPendingSession();
  const isVerifying = initialStep === 'verifying' || Boolean(initialInvoice);

  const initialInv =
    initialInvoice ||
    (isVerifying ? pendingSession?.invoiceNumber : null) ||
    `PLSCF27-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const initialAmt =
    (isVerifying && pendingSession?.amount) ? pendingSession.amount : finalTotalPayable;

  const invoiceRef = useRef(initialInv);
  const amountRef = useRef(initialAmt);
  const isFinalizingRef = useRef(false);
  const hasAutoStartedRef = useRef(false);

  // Keep refs synchronized when props or sessions change
  useEffect(() => {
    if (initialInvoice) {
      invoiceRef.current = initialInvoice;
    }
  }, [initialInvoice]);

  useEffect(() => {
    if (isVerifying && pendingSession?.amount) {
      amountRef.current = pendingSession.amount;
    } else {
      amountRef.current = finalTotalPayable;
    }
  }, [finalTotalPayable, isVerifying, pendingSession?.amount]);

  // ── Finalize after confirmed payment ────────────────────────────────────

  const finalizeRegistration = async (payment: PayStationPaymentResult) => {
    if (!registrationData) return;
    if (isFinalizingRef.current || completedTicket) {
      console.log('[PaymentModal] Finalization already in progress or completed, ignoring re-entrant call.');
      return;
    }
    isFinalizingRef.current = true;
    setStep('processing');
    setProcessingStep(isBangla ? 'ডিজিটাল টিকিট তৈরি হচ্ছে...' : 'Generating secure digital ticket...');
    try {
      // Recover net donation after backing out the uniform 1.8% gateway charge
      const feeSettings = AppStore.getFeeSettings();
      const effectiveBaseFee =
        registrationData.category === 'current'
          ? feeSettings.currentStudentFee
          : feeSettings.formerStudentFee;
      const currentParentFee = registrationData.hasParent ? (registrationData.parentFee ?? (feeSettings.parentFee ?? 500)) : 0;
      const currentSubtotal = effectiveBaseFee + currentParentFee;
      const impliedSubtotal = Math.round((payment.amount / 1.018) * 100) / 100;
      const effectiveCharge = Math.max(0, Math.round((payment.amount - impliedSubtotal) * 100) / 100);
      const effectiveDonation = Math.max(0, Math.round((impliedSubtotal - currentSubtotal) * 100) / 100);
      const synchronizedFormData: RegistrationFormData = {
        ...registrationData,
        parentFee: currentParentFee,
        gatewayCharge: effectiveCharge,
        donationAmount: effectiveDonation,
      };

      const ticket = await PayStationService.completeRegistrationAfterPayment(
        synchronizedFormData,
        payment
      );
      try {
        localStorage.removeItem('plscf_registration_draft');
        PayStationService.clearPendingSession();
      } catch {}
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
    } finally {
      isFinalizingRef.current = false;
    }
  };

  // ── Manual or automatic verification ─────────────────────────────────────

  const handleManualVerify = async () => {
    if (isFinalizingRef.current || completedTicket) return;
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
    if (!isOpen || step !== 'verifying' || completedTicket || isFinalizingRef.current) return;
    handleManualVerify();
  }, [isOpen, step]);

  // ── Status polling ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!isOpen || step !== 'waiting') return;

    let attempts = 0;
    const interval = setInterval(async () => {
      if (isFinalizingRef.current || completedTicket) {
        clearInterval(interval);
        return;
      }
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

  const handlePayStationHostedCheckout = async () => {
    if (!registrationData) {
      setErrorMessage(isBangla ? 'নিবন্ধন ডেটা অনুপস্থিত।' : 'Registration data missing.');
      setStep('failed');
      return;
    }
    if (isFinalizingRef.current || completedTicket) return;

    setStep('processing');
    setErrorMessage('');
    setProcessingStep(isBangla ? 'PayStation পেমেন্ট সেশন তৈরি হচ্ছে...' : 'Creating PayStation payment session...');

    try {
      const currentCharge = calculateGatewayCharge(subtotal);
      const chargeAmount = Math.round((subtotal + currentCharge) * 100) / 100;
      amountRef.current = chargeAmount;

      const enrichedFormData: RegistrationFormData = {
        ...registrationData,
        parentFee,
        gatewayCharge: currentCharge,
      };

      const reusableRegId =
        pendingSession?.invoiceNumber === invoiceRef.current &&
        pendingSession?.formData?.category === enrichedFormData.category
          ? pendingSession.registrationId
          : undefined;

      // 1. Authoritatively create pending session & upload photos prior to pending_orders persistence
      const pendingRecord = await PayStationService.createPendingRegistration(
        enrichedFormData,
        {
          registrationFee,
          donationAmount,
          parentFee,
          gatewayCharge: currentCharge,
          totalPayable: chargeAmount,
        },
        invoiceRef.current,
        reusableRegId
      );

      let persistedPhotoUrl = enrichedFormData.photoUrl;
      let persistedPhotoPath = enrichedFormData.photoStoragePath || extractStoragePathFromPublicUrl(persistedPhotoUrl) || null;
      if (persistedPhotoUrl && isBase64DataUrl(persistedPhotoUrl)) {
        try {
          const uploadRes = await StudentPhotoStorageService.uploadStudentPhoto({
            fileOrDataUrl: persistedPhotoUrl,
            registrationId: pendingRecord.id,
            batchYear: enrichedFormData.passingYear,
            category: enrichedFormData.category,
            currentClass: enrichedFormData.currentClass,
            isParent: false,
          });
          if (uploadRes.success && uploadRes.storagePath) {
            persistedPhotoPath = uploadRes.storagePath;
            persistedPhotoUrl = uploadRes.publicUrl;
          }
        } catch (photoErr) {
          console.warn('[PaymentModal] Pre-checkout student photo upload warning:', photoErr);
        }
      }

      let persistedParentPhotoUrl = enrichedFormData.parentPhotoUrl || null;
      let persistedParentPhotoPath =
        enrichedFormData.parentPhotoStoragePath ||
        (persistedParentPhotoUrl ? extractStoragePathFromPublicUrl(persistedParentPhotoUrl) : null) ||
        null;
      if (persistedParentPhotoUrl && isBase64DataUrl(persistedParentPhotoUrl)) {
        try {
          const pUploadRes = await StudentPhotoStorageService.uploadStudentPhoto({
            fileOrDataUrl: persistedParentPhotoUrl,
            registrationId: pendingRecord.id,
            batchYear: enrichedFormData.passingYear,
            category: enrichedFormData.category,
            currentClass: enrichedFormData.currentClass,
            isParent: true,
          });
          if (pUploadRes.success && pUploadRes.storagePath) {
            persistedParentPhotoPath = pUploadRes.storagePath;
            persistedParentPhotoUrl = pUploadRes.publicUrl;
          }
        } catch (pPhotoErr) {
          console.warn('[PaymentModal] Pre-checkout parent photo upload warning:', pPhotoErr);
        }
      }

      const hydratedFormData: RegistrationFormData = {
        ...enrichedFormData,
        photoUrl: persistedPhotoUrl,
        photoStoragePath: persistedPhotoPath || undefined,
        parentPhotoUrl: persistedParentPhotoUrl || undefined,
        parentPhotoStoragePath: persistedParentPhotoPath || undefined,
      };

      const callbackUrl = PayStationService.buildCallbackUrl({
        type: 'registration',
        invoiceNumber: invoiceRef.current,
        amount: chargeAmount,
      });

      const activeYear = (hydratedFormData as any).year || AppStore.getActiveEventYear() || 2027;
      const createRes = await PayStationService.createPayment({
        invoice_number: invoiceRef.current,
        order_type: 'registration',
        category: registrationData.category,
        has_parent: Boolean(registrationData.hasParent),
        donation_amount: donationAmount,
        payment_method: 'paystation',
        student_id: registrationData.studentId || null,
        registration_id: pendingRecord.id,
        qr_token: pendingRecord.qrToken,
        year: activeYear,
        form_data: {
          registrationId: pendingRecord.id,
          qrToken: pendingRecord.qrToken,
          year: activeYear,
          fullName: hydratedFormData.fullName,
          mobileNumber: hydratedFormData.mobileNumber,
          email: hydratedFormData.email || null,
          address: hydratedFormData.address,
          gender: hydratedFormData.gender || 'male',
          bloodGroup: hydratedFormData.bloodGroup || null,
          photoUrl: persistedPhotoUrl,
          photoStoragePath: persistedPhotoPath,
          category: hydratedFormData.category,
          studentId: hydratedFormData.studentId || null,
          passingYear: hydratedFormData.passingYear || null,
          lastClassAttended: hydratedFormData.lastClassAttended || null,
          currentClass: hydratedFormData.currentClass || null,
          batchName: hydratedFormData.batchName,
          groupOrSection: hydratedFormData.groupOrSection || null,
          rollNumber: hydratedFormData.rollNumber || null,
          tShirtSize: hydratedFormData.tShirtSize,
          hasParent: Boolean(hydratedFormData.hasParent),
          parentName: hydratedFormData.parentName || null,
          parentAge: hydratedFormData.parentAge || null,
          parentPhone: hydratedFormData.parentPhone || null,
          parentRelation: hydratedFormData.parentRelation || null,
          parentPhotoUrl: persistedParentPhotoUrl,
          parentPhotoStoragePath: persistedParentPhotoPath,
        },
        return_origin: typeof window !== 'undefined' ? window.location.origin : undefined,
        currency: 'BDT',
        payment_amount: chargeAmount,
        pay_with_charge: 0,
        reference: registrationData.category === 'current'
          ? (registrationData.studentId || 'CURRENT')
          : 'ALUMNI-REUNION',
        cust_name: studentName,
        cust_phone: registrationData.mobileNumber,
        cust_email: registrationData.email || undefined,
        cust_address: registrationData.address || '',
        callback_url: callbackUrl,
        checkout_items: JSON.stringify({
          type: 'reunion_registration',
          category: registrationData.category,
          batch: registrationData.batchName,
          tshirt: registrationData.tShirtSize,
          regId: pendingRecord.id,
          hasParent: registrationData.hasParent,
          charge: currentCharge,
        }),
        opt_a: registrationData.category,
        opt_b: registrationData.batchName || '',
        opt_c: pendingRecord.id,
      });

      let parsedCheckoutUrl: URL | null = null;
      if (createRes.success && createRes.paymentUrl) {
        try {
          const u = new URL(createRes.paymentUrl);
          if (u.protocol === 'https:' && u.hostname.endsWith('paystation.com.bd')) {
            parsedCheckoutUrl = u;
          }
        } catch {
          parsedCheckoutUrl = null;
        }
      }

      if (!createRes.success || !parsedCheckoutUrl) {
        throw new Error(createRes.error || 'PayStation did not return a valid hosted checkout URL.');
      }

      setProcessingStep(
        isBangla ? 'PayStation চেকআউট পেজে নিয়ে যাওয়া হচ্ছে...' : 'Redirecting to PayStation checkout...'
      );

      // Persist full pending registration session before redirecting
      PayStationService.savePendingSession({
        type: 'registration',
        invoiceNumber: invoiceRef.current,
        amount: chargeAmount,
        formData: hydratedFormData,
        fees: {
          registrationFee,
          donationAmount,
          parentFee,
          gatewayCharge: currentCharge,
          totalPayable: chargeAmount,
        },
        createdAt: new Date().toISOString(),
        registrationId: pendingRecord.id,
        qrToken: pendingRecord.qrToken,
      });

      // Redirect in the current window to the genuine PayStation Hosted Checkout page
      window.location.href = parsedCheckoutUrl.toString();
    } catch (err: any) {
      console.error('[PayStation] Checkout error:', err);
      setErrorMessage(err.message || 'Payment initiation failed.');
      setStep('failed');
    }
  };

  // Auto-initiate PayStation Hosted Checkout immediately when opened for a new payment
  // (bypasses the old channel selector page so user lands directly on PayStation Checkout).
  useEffect(() => {
    if (
      isOpen &&
      step === 'processing' &&
      !isVerifying &&
      !completedTicket &&
      !hasAutoStartedRef.current
    ) {
      hasAutoStartedRef.current = true;
      void handlePayStationHostedCheckout();
    }
  }, [isOpen, step, isVerifying, completedTicket]);

  // ── Render ───────────────────────────────────────────────────────────────

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-slate-950/85 backdrop-blur-xs p-3 sm:p-6 flex items-start sm:items-center justify-center min-h-[100dvh]">
      <section
        aria-labelledby="paystation-modal-title"
        aria-modal="true"
        className="relative w-full max-w-lg rounded-3xl border border-slate-700 bg-white p-5 sm:p-7 shadow-2xl my-auto max-h-[92dvh] flex flex-col overflow-hidden"
        role="dialog"
      >
        {/* Background ambient */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-sky-100 rounded-full filter blur-3xl opacity-60 pointer-events-none -mr-20 -mt-20" />

        {/* Close — only when not mid-transaction */}
        {step !== 'processing' && step !== 'verifying' && (
          <button
            aria-label={isBangla ? 'বন্ধ করুন' : 'Close'}
            className="absolute right-3.5 top-3.5 z-20 rounded-full p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            onClick={step === 'success' && completedTicket && onSuccess ? () => onSuccess(completedTicket, 'register') : onClose}
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
                  {activeCardTab === 'parent' && completedTicket.hasParent
                    ? (isBangla ? 'আপনার অভিভাবক প্রবেশ পাস' : 'Official Parent / Guardian Pass')
                    : completedTicket.category === 'former'
                    ? (isBangla ? 'আপনার অ্যালুমনাই মেম্বার আইডি কার্ড' : 'Your Official Alumni ID Card')
                    : (isBangla ? 'আপনার স্টুডেন্ট আইডি কার্ড' : 'Your Official Student ID Card')}
                </h2>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {isBangla
                    ? 'আইডি কার্ডের ছবি সরাসরি প্রিন্ট করুন অথবা মোবাইল ও কম্পিউটারে ডাউনলোড করুন।'
                    : 'Print your ID card photo directly or download it to your device below.'}
                </p>
              </div>

              {/* Tab selector if student registered with an accompanying parent */}
              {completedTicket.hasParent && (
                <div className="flex items-center justify-center gap-2 p-1 bg-slate-100 rounded-2xl max-w-xs mx-auto border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setActiveCardTab('student')}
                    className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      activeCardTab === 'student'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    🎓 {completedTicket.category === 'former'
                      ? (isBangla ? 'অ্যালুমনাই কার্ড' : 'Alumni Card')
                      : (isBangla ? 'স্টুডেন্ট কার্ড' : 'Student Card')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveCardTab('parent')}
                    className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      activeCardTab === 'parent'
                        ? 'bg-gradient-to-r from-emerald-900 to-teal-900 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    👨‍👩‍👧 {isBangla ? 'অভিভাবক পাস' : 'Parent Pass'}
                  </button>
                </div>
              )}

              {/* Official ID Card Badge with Live Preview, Direct Print, and Download Actions */}
              <div className="flex flex-col items-center justify-center bg-slate-50/80 p-3 sm:p-4 rounded-3xl border border-slate-200">
                {activeCardTab === 'parent' && completedTicket.hasParent ? (
                  <ParentIdCardBadge
                    student={IdCardStore.getOrBuildCardForRegistration(completedTicket)}
                    language={language}
                  />
                ) : (
                  <StudentIdCardBadge
                    student={IdCardStore.getOrBuildCardForRegistration(completedTicket)}
                    language={language}
                  />
                )}
              </div>

              {/* Receipt Summary — Compact & Clean */}
              <details className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs group cursor-pointer">
                <summary className="font-bold text-slate-700 flex items-center justify-between select-none list-none">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>{isBangla ? 'পেমেন্ট রসিদ বিবরণ' : 'Payment Receipt & Telemetry'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-emerald-700 font-bold whitespace-nowrap inline-block tabular-nums">
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
                    <span className="text-emerald-700 whitespace-nowrap inline-block tabular-nums">৳ {transactionSummary.amount.toLocaleString()} BDT</span>
                  </div>
                </div>
              </details>

              <div className="space-y-2 pt-1">
                {/* Primary Action: Register Another Student */}
                <button
                  type="button"
                  onClick={() => {
                    if (onSuccess && completedTicket) onSuccess(completedTicket, 'register');
                    else onClose();
                  }}
                  className="w-full py-3.5 rounded-full bg-[#0284C7] hover:bg-[#0EA5E9] text-white font-bold text-sm shadow-xl shadow-sky-600/30 transition-all cursor-pointer flex items-center justify-center gap-2 group"
                >
                  <UserPlus className="w-5 h-5 text-white group-hover:scale-110 transition-transform" />
                  <span>{isBangla ? 'পরবর্তী শিক্ষার্থী নিবন্ধন করুন' : 'Register Another Student'}</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </button>

                {/* Secondary Action: View Digital Ticket Pass */}
                <button
                  type="button"
                  onClick={() => {
                    if (onSuccess && completedTicket) onSuccess(completedTicket, 'ticket');
                    else onClose();
                  }}
                  className="w-full py-3 rounded-full bg-[#0F172A] hover:bg-slate-800 text-slate-200 hover:text-white font-semibold text-xs border border-slate-700 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <QrCode className="w-4 h-4 text-sky-400" />
                  <span>{isBangla ? 'সম্পূর্ণ ডিজিটাল টিকিট পাস দেখুন' : 'View Full Digital Ticket Pass'}</span>
                </button>
              </div>
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
                    ? 'PayStation চেকআউটে পেমেন্ট সম্পন্ন করুন'
                    : 'Please complete your payment on PayStation checkout'}
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
                className="w-full py-3.5 rounded-full bg-[#0284C7] hover:bg-[#0EA5E9] text-white font-bold text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isBangla ? 'পেমেন্ট সম্পন্ন করেছি — যাচাই করুন' : 'I completed payment — Verify Now'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setErrorMessage('');
                  setPollCount(0);
                  // Regenerate invoice to avoid duplicate before retrying PayStation Hosted Checkout
                  invoiceRef.current = `PLSCF27-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
                  void handlePayStationHostedCheckout();
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
                  setErrorMessage('');
                  setPollCount(0);
                  invoiceRef.current = `PLSCF27-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
                  void handlePayStationHostedCheckout();
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
        ) : null}
        </div>
      </section>
    </div>
  );
};
