import { useState, useEffect, lazy, Suspense } from 'react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { HomePage } from './components/HomePage';
import { TicketView } from './components/TicketView';
import {
  Language,
  RegistrationRecord,
  FeeSettings,
} from './types';
import { AppStore } from './services/store';
import { RegistrationFormData } from './utils/rules';
import { StudentIdService } from './services/studentIdStore';
import { findRegistrationByTokenOrId } from './utils/tokenGenerator';
import { PayStationService } from './services/paystation';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { MobileBottomNav } from './components/common/MobileBottomNav';
import type { ModalStep } from './components/PaymentModal';
import { resolveRouteFromLocation, syncRouteHistory } from './utils/navigation';

// Route-level code-splitting: heavy pages and portals are loaded on-demand
const RegistrationPage = lazy(() => import('./components/RegistrationPage').then((m) => ({ default: m.RegistrationPage })));
const PaymentModal = lazy(() => import('./components/PaymentModal').then((m) => ({ default: m.PaymentModal })));
const TicketLookupModal = lazy(() => import('./components/TicketLookupModal').then((m) => ({ default: m.TicketLookupModal })));
const DonationPage = lazy(() => import('./components/DonationPage').then((m) => ({ default: m.DonationPage })));
const NoticeBoardPage = lazy(() => import('./components/NoticeBoardPage').then((m) => ({ default: m.NoticeBoardPage })));
const GalleryPage = lazy(() => import('./components/GalleryPage').then((m) => ({ default: m.GalleryPage })));
const AboutContactPage = lazy(() => import('./components/AboutContactPage').then((m) => ({ default: m.AboutContactPage })));
const ScannerPortal = lazy(() => import('./components/ScannerPortal').then((m) => ({ default: m.ScannerPortal })));
const AdminDashboard = lazy(() => import('./components/AdminDashboard').then((m) => ({ default: m.AdminDashboard })));
const RmsManagementPortal = lazy(() => import('./components/rms/RmsManagementPortal').then((m) => ({ default: m.RmsManagementPortal })));
const NotFoundPage = lazy(() => import('./components/common/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));

const PageLoadingFallback = () => (
  <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center" role="status" aria-label="Loading page">
    <div className="w-12 h-12 rounded-full border-4 border-emerald-100 border-t-emerald-600 animate-spin mb-4 shadow-xs" />
    <p className="text-sm font-semibold text-slate-600 animate-pulse tracking-wide">Loading...</p>
  </div>
);

export default function App() {
  // Language preference with localStorage persistence
  const [language, setLanguage] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('plscf_lang');
      return saved === 'en' ? 'en' : 'bn';
    } catch {
      return 'bn';
    }
  });

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    try {
      localStorage.setItem('plscf_lang', lang);
    } catch (e) {
      console.warn(e);
    }
  };

  // Navigation State - initialized synchronously from current browser location/route
  const [activeView, setActiveView] = useState<string>(() => {
    return resolveRouteFromLocation().view;
  });

  const [notFoundPath, setNotFoundPath] = useState<string>(() => {
    return resolveRouteFromLocation().notFoundPath || '';
  });

  // Unified router navigation handler: updates state, syncs HTML5 history and persists session
  const handleNavigate = (view: string, replace = false, extraParams?: Record<string, string>) => {
    if (view === 'register' && activeView === 'ticket') {
      handleStartNewRegistration();
      return;
    }
    setActiveView(view);
    syncRouteHistory(view, replace, extraParams);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Listen to browser Back/Forward navigation buttons
  useEffect(() => {
    const handlePopState = () => {
      const resolved = resolveRouteFromLocation();
      setActiveView(resolved.view);
      if (resolved.notFoundPath) {
        setNotFoundPath(resolved.notFoundPath);
      }
      if (resolved.ticketQuery) {
        const local = findRegistrationByTokenOrId(AppStore.getRegistrations(), resolved.ticketQuery);
        if (local) {
          setActiveTicket(local);
        }
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Active Ticket to display
  const [activeTicket, setActiveTicket] = useState<RegistrationRecord | null>(null);

  // Fee settings
  const [feeSettings, setFeeSettings] = useState<FeeSettings>(() => AppStore.getFeeSettings());

  // Payment Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentModalStep, setPaymentModalStep] = useState<ModalStep>('select');
  const [paymentModalInvoice, setPaymentModalInvoice] = useState<string>('');
  const [pendingRegistrationData, setPendingRegistrationData] = useState<RegistrationFormData | null>(null);
  const [preservedRegistrationData, setPreservedRegistrationData] = useState<RegistrationFormData | null>(() => {
    try {
      const raw = localStorage.getItem('plscf_registration_draft');
      if (raw) return JSON.parse(raw);
    } catch {}
    const session = PayStationService.getPendingSession();
    return session?.formData || null;
  });
  const [registrationFormKey, setRegistrationFormKey] = useState(0);
  const [paymentModalError, setPaymentModalError] = useState<string>('');
  const [lastRegisteredName, setLastRegisteredName] = useState<string>('');
  const [pendingFees, setPendingFees] = useState<{
    registrationFee: number;
    donationAmount: number;
    totalPayable: number;
  }>({
    registrationFee: 1500,
    donationAmount: 0,
    totalPayable: 1500,
  });

  // Keep fee settings updated
  useEffect(() => {
    setFeeSettings(AppStore.getFeeSettings());
  }, [activeView]);

  // Synchronize registrations bidirectionally with Supabase on startup
  useEffect(() => {
    AppStore.syncWithSupabase(2027).catch(() => {});
  }, []);

  // Deep-link routing: auto-handle QR scans, verification URLs, and PayStation payment returns
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const params = new URLSearchParams(window.location.search);
      const idParam = params.get('id') || params.get('verify') || params.get('ticket');
      const tokenParam = params.get('token');
      const query = tokenParam || idParam;

      // ── PayStation payment return callback handling ───────────────────────
      const isPaymentReturn =
        params.get('payment_return') === '1' ||
        params.has('invoice_number') ||
        params.has('trx_status') ||
        params.has('status');

      if (isPaymentReturn) {
        const payType = params.get('type') as 'registration' | 'donation' | null;
        const statusParam = (params.get('status') || params.get('trx_status') || '').toLowerCase();
        const invoiceFromUrl = params.get('invoice') || params.get('invoice_number');

        // Clean the URL immediately to prevent re-triggering on refresh
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, '', cleanUrl);

        const pendingSession = PayStationService.getPendingSession();

        if (pendingSession && pendingSession.type === 'registration' && pendingSession.formData) {
          handleNavigate('register', true);
          setPendingRegistrationData(pendingSession.formData);
          setPreservedRegistrationData(pendingSession.formData);

          // Authoritative amount from PayStation redirect or pending session
          const amountFromUrl = params.get('amount') ? Number(params.get('amount')) : null;
          const sessionAmount = amountFromUrl || pendingSession.amount || pendingSession.fees?.totalPayable;
          if (sessionAmount) {
            const regFee = pendingSession.fees?.registrationFee || (pendingSession.formData.category === 'current' ? 1000 : 1500);
            const donAmt = Math.max(0, sessionAmount - regFee);
            setPendingFees({
              registrationFee: regFee,
              donationAmount: donAmt,
              totalPayable: sessionAmount,
            });
          } else if (pendingSession.fees) {
            setPendingFees(pendingSession.fees);
          }

          const activeInvoice = invoiceFromUrl || pendingSession.invoiceNumber || '';
          setPaymentModalInvoice(activeInvoice);

          // If gateway reported failure/cancel or user pressed "GO BACK" after an error
          if (statusParam.includes('fail') || statusParam.includes('cancel')) {
            setPaymentModalStep('failed');
            const rawMsg = (params.get('message') || params.get('error') || params.get('reason') || '').toLowerCase();
            const isInsufficientBalance = rawMsg.includes('balance') || statusParam.includes('balance');

            if (isInsufficientBalance) {
              setPaymentModalError(
                language === 'bn'
                  ? 'পেমেন্ট ব্যর্থ: বিকাশ স্যান্ডবক্স টেস্ট নম্বরে ব্যালেন্স অপ্রতুল ("Insufficient balance")। অনুগ্রহ করে পর্যাপ্ত ব্যালেন্সযুক্ত সক্রিয় টেস্ট ওয়ালেট 01929918378 বা 01770618576 ব্যবহার করুন (OTP: 123456, PIN: 12121)। আপনার পূরণকৃত সব তথ্য সংরক্ষিত রয়েছে।'
                  : 'Payment Failed: The test bKash wallet has insufficient sandbox mock balance. Please use active test wallet 01929918378 or 01770618576 (OTP: 123456, PIN: 12121). All your entered data is preserved.'
              );
            } else {
              setPaymentModalError(
                language === 'bn'
                  ? 'PayStation গেটওয়েতে পেমেন্ট সম্পন্ন হয়নি (বা বাতিল হয়েছে)। আপনার পূরণকৃত সব তথ্য সংরক্ষিত রয়েছে। টেস্ট মোডে তাৎক্ষণিক নিশ্চিত করতে নিচের সবুজ বাটনে চাপুন।'
                  : 'Payment was not completed or cancelled on PayStation gateway. All your entered data is preserved. Click the green button below to verify in test mode and issue your ticket.'
              );
            }
          } else {
            // Success or pending callback: immediately verify the transaction
            setPaymentModalStep('verifying');
            setPaymentModalError('');
          }
          setIsPaymentModalOpen(true);
        } else if (payType === 'donation' || (pendingSession && pendingSession.type === 'donation')) {
          handleNavigate('donate', true);
        } else {
          handleNavigate('register', true);
        }
        return;
      }

      // ── Standard deep-link handling ──────────────────────────────────────
      const resolved = resolveRouteFromLocation();
      if (query || resolved.ticketQuery) {
        const ticketIdOrToken = query || resolved.ticketQuery;
        const local = findRegistrationByTokenOrId(AppStore.getRegistrations(), ticketIdOrToken!);
        if (local) {
          setActiveTicket(local);
          handleNavigate('ticket', true, { id: ticketIdOrToken! });
        } else {
          handleNavigate('find-ticket', true);
        }
      } else if (resolved.view === '404') {
        setNotFoundPath(resolved.notFoundPath || (typeof window !== 'undefined' ? window.location.pathname : ''));
        setActiveView('404');
      } else {
        syncRouteHistory(resolved.view, true, resolved.tab ? { tab: resolved.tab } : undefined);
      }
    } catch (e) {
      console.warn('URL deep-link parsing notice:', e);
    }
  }, [language]);

  // Initiate Payment flow from Registration Page
  const handleInitiatePayment = (
    formData: RegistrationFormData,
    fees: { registrationFee: number; donationAmount: number; totalPayable: number }
  ) => {
    setPendingRegistrationData(formData);
    setPreservedRegistrationData(formData);
    setPendingFees(fees);
    setPaymentModalStep('select');
    setPaymentModalInvoice('');
    setPaymentModalError('');

    // If current student, reserve the Student ID in atomic state
    if (formData.category === 'current' && formData.studentId) {
      StudentIdService.reserveStudentId(formData.studentId, 600);
    }

    setIsPaymentModalOpen(true);
  };

  // Handle closing payment modal without completing transaction / clicking GO BACK
  const handleCancelPaymentModal = () => {
    if (pendingRegistrationData?.category === 'current' && pendingRegistrationData.studentId) {
      StudentIdService.releaseReservation(pendingRegistrationData.studentId);
    }
    // Keep preserved registration data intact so the registration form does NOT lose any user input
    if (pendingRegistrationData) {
      setPreservedRegistrationData(pendingRegistrationData);
    }
    setIsPaymentModalOpen(false);
    setPaymentModalError('');
    setPaymentModalInvoice('');
    setPaymentModalStep('select');
    handleNavigate('register');
  };

  // Start fresh registration (clears saved form data to register a new student)
  const handleStartNewRegistration = () => {
    try {
      localStorage.removeItem('plscf_registration_draft');
    } catch {}
    setPendingRegistrationData(null);
    setPreservedRegistrationData(null);
    setLastRegisteredName('');
    PayStationService.clearPendingSession();
    setRegistrationFormKey((prev) => prev + 1);
    setActiveTicket(null);
    handleNavigate('register');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (activeView === 'portal') {
    return (
      <ErrorBoundary
        fallbackTitle={language === 'bn' ? 'আরএমএস পোর্টাল লোড করতে সমস্যা হয়েছে' : 'RMS Portal Notice'}
        fallbackMessage={
          language === 'bn'
            ? 'আরএমএস পোর্টাল লোড করতে একটি ত্রুটি ঘটেছে। দয়া করে পুনরায় চেষ্টা করুন অথবা হোমে ফিরে যান।'
            : 'An unexpected issue occurred while rendering the RMS portal. Please try again or return home.'
        }
        showHomeButton
        onNavigateHome={() => handleNavigate('home')}
      >
        <Suspense fallback={<PageLoadingFallback />}>
          <RmsManagementPortal
            onBackToPublic={() => handleNavigate('home')}
          />
        </Suspense>
      </ErrorBoundary>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f0f6fa] text-[#0f172a] antialiased selection:bg-[#0284c7] selection:text-white font-satoshi">
      {/* Universal Header */}
      <div className="no-print">
        <Header
          language={language}
          onLanguageChange={handleLanguageChange}
          activeView={activeView}
          onNavigate={handleNavigate}
        />
      </div>

      {/* Main Content Area */}
      <main className="flex-1 main-content">
        <ErrorBoundary
          fallbackTitle={language === 'bn' ? 'পৃষ্ঠা লোড করতে ত্রুটি হয়েছে' : 'Page Load Notice'}
          fallbackMessage={
            language === 'bn'
              ? 'এই পৃষ্ঠাটি লোড করতে একটি ত্রুটি ঘটেছে। দয়া করে পুনরায় চেষ্টা করুন অথবা হোমে ফিরে যান।'
              : 'An unexpected issue occurred while rendering this view. Please try again or return home.'
          }
          showHomeButton
          onNavigateHome={() => handleNavigate('home')}
        >
          <Suspense fallback={<PageLoadingFallback />}>
          {activeView === 'home' && (
            <HomePage
              language={language}
              feeSettings={feeSettings}
              onNavigate={handleNavigate}
              onSelectTicket={(reg) => {
                setActiveTicket(reg);
                handleNavigate('ticket');
              }}
            />
          )}

          {activeView === 'register' && (
            <RegistrationPage
              key={`registration-form-${registrationFormKey}`}
              language={language}
              feeSettings={feeSettings}
              initialData={preservedRegistrationData}
              isProcessingPayment={isPaymentModalOpen}
              onInitiatePayment={handleInitiatePayment}
              onNavigate={handleNavigate}
              lastRegisteredName={lastRegisteredName}
              onViewLastTicket={
                activeTicket && lastRegisteredName
                  ? () => {
                      setLastRegisteredName('');
                      handleNavigate('ticket');
                    }
                  : undefined
              }
            />
          )}

          {activeView === 'find-ticket' && (
            <TicketLookupModal
              language={language}
              onSelectRegistration={(registration) => {
                setActiveTicket(registration);
                handleNavigate('ticket');
              }}
              onNavigateRegister={handleStartNewRegistration}
            />
          )}

          {(activeView === 'ticket' || activeView === 'profile') && (
            activeTicket ? (
              <TicketView
                registration={activeTicket}
                language={language}
                onNavigateHome={() => handleNavigate('home')}
                onRegisterAnother={handleStartNewRegistration}
              />
            ) : (
              <TicketLookupModal
                language={language}
                onSelectRegistration={(registration) => {
                  setActiveTicket(registration);
                  handleNavigate('ticket');
                }}
                onNavigateRegister={handleStartNewRegistration}
              />
            )
          )}

          {activeView === 'donate' && <DonationPage language={language} />}

          {activeView === 'notices' && <NoticeBoardPage language={language} />}

          {activeView === 'gallery' && <GalleryPage language={language} />}

          {activeView === 'about' && <AboutContactPage language={language} />}

          {activeView === 'scanner' && <ScannerPortal language={language} />}

          {(activeView === 'admin' || activeView === 'login' || activeView === 'dashboard') && (
            <AdminDashboard
              language={language}
              onSelectTicket={(reg) => {
                setActiveTicket(reg);
                handleNavigate('ticket');
              }}
            />
          )}

          {activeView === '404' && (
            <NotFoundPage
              language={language}
              notFoundPath={notFoundPath || (typeof window !== 'undefined' ? window.location.pathname : '')}
              onNavigate={handleNavigate}
            />
          )}
        </Suspense>
      </ErrorBoundary>
    </main>

      {/* Universal Footer */}
      <div className="no-print">
        <Footer
          language={language}
          onNavigate={handleNavigate}
        />
      </div>

      {/* Mobile Fixed Bottom Navigation (iOS Safe Area Compliant, hidden on sm+) */}
      <div className="no-print">
        <MobileBottomNav
          language={language}
          activeView={activeView}
          onNavigate={handleNavigate}
        />
      </div>

      {/* Secure Payment Gateway Modal */}
      {isPaymentModalOpen && pendingRegistrationData && (
        <Suspense fallback={null}>
          <PaymentModal
            isOpen={isPaymentModalOpen}
            onClose={handleCancelPaymentModal}
            onSuccess={(ticket, targetView = 'register') => {
              setIsPaymentModalOpen(false);
              setPendingRegistrationData(null);
              setPreservedRegistrationData(null);
              setPaymentModalError('');
              setPaymentModalInvoice('');
              setPaymentModalStep('select');
              PayStationService.clearPendingSession();
              try {
                localStorage.removeItem('plscf_registration_draft');
              } catch {}
              // Store the just-completed ticket so TicketView can be accessed via header or button
              setActiveTicket(ticket);
              // Remember last registered name for the success banner
              setLastRegisteredName(ticket.fullName || '');
              // Reset the registration form with a fresh key so it is blank & ready for the next student
              setRegistrationFormKey((prev) => prev + 1);
              // Navigate to the target view (defaults to 'register' to keep user on Registration Page)
              handleNavigate(targetView);
            }}
            language={language}
            registrationFee={pendingFees.registrationFee}
            donationAmount={pendingFees.donationAmount}
            totalPayable={pendingFees.totalPayable}
            studentName={pendingRegistrationData.fullName}
            registrationData={pendingRegistrationData}
            initialStep={paymentModalStep}
            initialInvoice={paymentModalInvoice}
            initialErrorMessage={paymentModalError}
          />
        </Suspense>
      )}
    </div>
  );
}
