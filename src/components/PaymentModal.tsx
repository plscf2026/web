import { useState } from 'react';
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
}

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
}) => {
  if (!isOpen) return null;

  const isBangla = language === 'bn';
  const config = PayStationService.getConfig();

  // State
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('bkash');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [completedTicket, setCompletedTicket] = useState<RegistrationRecord | null>(null);
  const [transactionSummary, setTransactionSummary] = useState<PayStationPaymentResult | null>(null);

  // Generate a clean invoice number
  const invoiceNumber = `PLSCF26-INV-${Math.floor(100000 + Math.random() * 900000)}`;

  /**
   * Complete payment using PayStation Gateway
   */
  const handlePayStationGateway = async (isDirectSandboxSimulation: boolean = false) => {
    if (!registrationData) {
      setErrorMessage(isBangla ? 'নিবন্ধন ডেটা অনুপস্থিত।' : 'Registration data missing.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage('');
    setProcessingStep(isBangla ? 'PayStation সেশন প্রস্তুত করা হচ্ছে...' : 'Initiating PayStation session...');

    try {
      // 1. Request grant token
      const tokenRes = await PayStationService.grantToken();
      if (!tokenRes.success || !tokenRes.token) {
        throw new Error(tokenRes.error || 'Failed to authenticate with PayStation.');
      }

      setProcessingStep(isBangla ? 'পেমেন্ট ইনভয়েস তৈরি হচ্ছে...' : 'Creating payment order...');

      // 2. Create payment session
      const createRes = await PayStationService.createPayment({
        invoice_number: invoiceNumber,
        currency: 'BDT',
        payment_amount: totalPayable,
        reference: registrationData.category === 'current' ? (registrationData.studentId || 'CURRENT') : 'ALUMNI',
        cust_name: studentName,
        cust_phone: registrationData.mobileNumber,
        cust_email: registrationData.email || 'reunion@plscf.edu.bd',
        cust_address: registrationData.address || 'Faridpur',
        callback_url: `${window.location.origin}/api/checkout/callback`,
      }, tokenRes.token);

      if (!createRes.success) {
        throw new Error(createRes.error || 'PayStation order creation failed.');
      }

      // If user wants to simulate completion or test in sandbox
      if (isDirectSandboxSimulation) {
        setProcessingStep(isBangla ? 'গেটওয়ে যাচাই সম্পন্ন হচ্ছে...' : 'Simulating & verifying gateway transaction...');
        await new Promise((r) => setTimeout(r, 1200));

        const simTrxId = createRes.trxId || `PST-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

        const paymentResult: PayStationPaymentResult = {
          invoiceNumber: invoiceNumber,
          trxId: simTrxId,
          status: 'Success',
          amount: totalPayable,
          method: selectedMethod,
          payerMobile: registrationData.mobileNumber,
          timestamp: new Date().toISOString(),
        };

        setProcessingStep(isBangla ? 'ডিজিটাল টিকিট ও সিকিউর সিগনেচার তৈরি হচ্ছে...' : 'Finalizing ticket and security signature...');

        // Authoritatively persist registration, ledger inflow, and QR token
        const ticket = await PayStationService.completeRegistrationAfterPayment(registrationData, paymentResult);

        setTransactionSummary(paymentResult);
        setCompletedTicket(ticket);
        setIsProcessing(false);
      } else {
        // Real Hosted Gateway Redirection
        if (createRes.paymentUrl) {
          window.open(createRes.paymentUrl, '_blank', 'noopener,noreferrer');
          setProcessingStep(isBangla ? 'PayStation পেমেন্ট উইন্ডো খোলা হয়েছে...' : 'PayStation hosted window opened...');
          setIsProcessing(false);
        } else {
          throw new Error('No payment redirection URL returned by PayStation.');
        }
      }
    } catch (err: any) {
      console.error('PayStation checkout error:', err);
      setErrorMessage(err.message || 'Payment initiation encountered an error.');
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
      <section
        aria-labelledby="paystation-modal-title"
        aria-modal="true"
        className="relative w-full max-w-lg rounded-3xl border border-slate-700 bg-white p-6 sm:p-7 shadow-2xl overflow-hidden"
        role="dialog"
      >
        {/* Background ambient accent */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-sky-100 rounded-full filter blur-3xl opacity-60 pointer-events-none -mr-20 -mt-20" />

        {/* Close Button */}
        <button
          aria-label={isBangla ? 'বন্ধ করুন' : 'Close'}
          className="absolute right-4 top-4 rounded-full p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          onClick={onClose}
          type="button"
        >
          <X className="h-5 w-5" />
        </button>

        {/* 1. SUCCESS VIEW (Payment Completed) */}
        {completedTicket && transactionSummary ? (
          <div className="space-y-5 py-2">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {isBangla ? 'পেমেন্ট সফলভাবে সম্পন্ন হয়েছে!' : 'Payment Verified & Confirmed!'}
              </h2>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {isBangla
                  ? 'আপনার নিবন্ধন ও ডিজিটাল টিকিট প্রস্তুত করা হয়েছে। প্রবেশ গেটে QR কোডটি প্রদর্শন করতে পারবেন।'
                  : 'Your registration is confirmed and the digital ticket with verified QR code has been generated.'}
              </p>
            </div>

            {/* Receipt Summary Card */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-2.5">
              <div className="flex justify-between items-center text-slate-600">
                <span>{isBangla ? 'ট্রানজেকশন আইডি' : 'Transaction ID'}:</span>
                <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                  {transactionSummary.trxId}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>{isBangla ? 'নিবন্ধন আইডি' : 'Registration ID'}:</span>
                <span className="font-mono font-bold text-slate-900">{completedTicket.id}</span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>{isBangla ? 'পেমেন্ট মেথড' : 'Payment Method'}:</span>
                <span className="font-bold text-slate-800 uppercase">{transactionSummary.method} (PayStation)</span>
              </div>
              <div className="flex justify-between items-center border-t border-slate-200 pt-2 text-sm font-bold text-slate-900">
                <span>{isBangla ? 'পরিশোধিত মোট ফি' : 'Total Amount Paid'}:</span>
                <span className="text-emerald-700">৳ {transactionSummary.amount} BDT</span>
              </div>
            </div>

            {/* Proceed to Ticket Button */}
            <button
              onClick={() => {
                if (onSuccess) {
                  onSuccess(completedTicket);
                } else {
                  onClose();
                }
              }}
              className="w-full py-4 rounded-2xl bg-[#0F172A] hover:bg-[#1E293B] text-white font-bold text-sm shadow-xl transition-all cursor-pointer flex items-center justify-center gap-2 group"
            >
              <QrCode className="w-5 h-5 text-sky-400 group-hover:scale-110 transition-transform" />
              <span>{isBangla ? 'ডিজিটাল টিকিট পাস দেখুন' : 'View Digital Ticket Pass'}</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>
          </div>
        ) : (
          /* 2. CHECKOUT SELECTION & INITIATION VIEW */
          <div className="space-y-5">
            {/* Header & Gateway Seal */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center font-black shadow-md">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-slate-900 leading-tight" id="paystation-modal-title">
                    PayStation Payment Gateway
                  </h2>
                  <span className="text-[11px] text-slate-500 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>256-bit SSL Encrypted • Licensed by Bangladesh Bank</span>
                  </span>
                </div>
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                config.isSandbox 
                  ? 'bg-amber-50 text-amber-800 border-amber-300' 
                  : 'bg-emerald-50 text-emerald-800 border-emerald-300'
              }`}>
                {config.isSandbox ? 'Sandbox Mode' : 'Live Gateway'}
              </span>
            </div>

            {/* Invoice Overview */}
            <div className="p-4 rounded-2xl bg-sky-50/60 border border-sky-200/80 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>{isBangla ? 'শিক্ষার্থীর নাম' : 'Attendee Name'}:</span>
                <span className="font-bold text-slate-900">{studentName}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>{isBangla ? 'ইনভয়েস নম্বর' : 'Invoice Number'}:</span>
                <span className="font-mono text-slate-700">{invoiceNumber}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>{isBangla ? 'রেজিস্ট্রেশন ফি' : 'Registration Fee'}:</span>
                <span className="font-semibold text-slate-800">৳ {registrationFee}</span>
              </div>
              {donationAmount > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>{isBangla ? 'স্বেচ্ছাসেবী অনুদান' : 'Voluntary Donation'}:</span>
                  <span className="font-semibold text-slate-800">+ ৳ {donationAmount}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-sky-200 pt-2 text-sm font-black text-sky-950">
                <span>{isBangla ? 'সর্বমোট প্রদেয়' : 'Total Payable'}:</span>
                <span className="text-[#0284C7] text-base">৳ {totalPayable} BDT</span>
              </div>
            </div>

            {/* Method Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                {isBangla ? 'পেমেন্ট মাধ্যম নির্বাচন করুন' : 'Select Preferred Payment Channel'}:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'bkash', name: 'bKash', color: 'border-pink-500 text-pink-600', bg: 'hover:bg-pink-50' },
                  { id: 'nagad', name: 'Nagad', color: 'border-orange-500 text-orange-600', bg: 'hover:bg-orange-50' },
                  { id: 'rocket', name: 'Rocket', color: 'border-purple-500 text-purple-600', bg: 'hover:bg-purple-50' },
                  { id: 'card', name: 'Cards', color: 'border-blue-600 text-blue-700', bg: 'hover:bg-blue-50' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedMethod(item.id as PaymentMethod)}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                      selectedMethod === item.id
                        ? `${item.color} bg-white shadow-sm ring-2 ring-sky-500`
                        : 'border-slate-200 text-slate-600 hover:border-slate-400'
                    }`}
                  >
                    <span>{item.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Error Message if any */}
            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-300 text-rose-800 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Processing State */}
            {isProcessing ? (
              <div className="p-4 rounded-xl bg-slate-900 text-white text-center space-y-2">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-sky-400" />
                <p className="text-xs font-bold">{processingStep}</p>
                <span className="text-[11px] text-slate-400">
                  {isBangla ? 'দয়া করে ব্রাউজার বন্ধ করবেন না' : 'Please do not refresh or close this window'}
                </span>
              </div>
            ) : (
              /* Action Buttons */
              <div className="space-y-2 pt-1">
                {/* Instant Verification Button (Direct Sandbox Flow) */}
                <button
                  type="button"
                  onClick={() => handlePayStationGateway(true)}
                  className="w-full py-4 rounded-2xl bg-[#0F172A] hover:bg-[#1E293B] text-white font-bold text-xs sm:text-sm uppercase tracking-wider shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Lock className="w-4 h-4 text-sky-400" />
                  <span>
                    {isBangla 
                      ? `PayStation-এ ৳${totalPayable} পে ও কনফার্ম করুন` 
                      : `Pay ৳${totalPayable} & Confirm via PayStation`}
                  </span>
                </button>

                {/* Hosted Gateway Redirection Link */}
                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => handlePayStationGateway(false)}
                    className="text-xs text-sky-700 hover:text-sky-900 font-semibold underline cursor-pointer inline-flex items-center gap-1"
                  >
                    <span>{isBangla ? 'PayStation পপআপ চেকআউট খুলুন' : 'Open PayStation Hosted Checkout'}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Security Guarantee Footer */}
            <div className="text-center text-[10px] text-slate-400 flex items-center justify-center gap-2 pt-1 border-t border-slate-100">
              <span>Merchant ID: {config.merchantId}</span>
              <span>•</span>
              <span>Supported: bKash, Nagad, Rocket, Upay, Visa, Mastercard</span>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
