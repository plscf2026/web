import { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { HomePage } from './components/HomePage';
import { RegistrationPage } from './components/RegistrationPage';
import { PaymentModal } from './components/PaymentModal';
import { TicketView } from './components/TicketView';
import { TicketLookupModal } from './components/TicketLookupModal';
import { DonationPage } from './components/DonationPage';
import { NoticeBoardPage } from './components/NoticeBoardPage';
import { GalleryPage } from './components/GalleryPage';
import { AboutContactPage } from './components/AboutContactPage';
import { ScannerPortal } from './components/ScannerPortal';
import { AdminDashboard } from './components/AdminDashboard';
import { RmsManagementPortal } from './components/rms/RmsManagementPortal';
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

  // Navigation State
  const [activeView, setActiveView] = useState<string>('home');

  // Active Ticket to display
  const [activeTicket, setActiveTicket] = useState<RegistrationRecord | null>(null);

  // Fee settings
  const [feeSettings, setFeeSettings] = useState<FeeSettings>(() => AppStore.getFeeSettings());

  // Payment Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [pendingRegistrationData, setPendingRegistrationData] = useState<RegistrationFormData | null>(null);
  const [paymentModalError, setPaymentModalError] = useState<string>('');
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

  // Deep-link routing: auto-handle QR scans, verification URLs, and PayStation payment returns
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const params = new URLSearchParams(window.location.search);
      const idParam = params.get('id') || params.get('verify') || params.get('ticket');
      const tokenParam = params.get('token');
      const query = tokenParam || idParam;

      // ── PayStation payment return callback handling ───────────────────────
      // Triggers when customer completes checkout, fails, or clicks "GO BACK" on PayStation
      const isPaymentReturn =
        params.get('payment_return') === '1' ||
        params.has('invoice_number') ||
        params.has('trx_status') ||
        params.has('status');

      if (isPaymentReturn) {
        const payType = params.get('type') as 'registration' | 'donation' | null;
        const statusParam = (params.get('status') || params.get('trx_status') || '').toLowerCase();

        // Clean the URL immediately to prevent re-triggering on refresh
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, '', cleanUrl);

        const pendingSession = PayStationService.getPendingSession();

        if (pendingSession && pendingSession.type === 'registration' && pendingSession.formData) {
          setActiveView('register');
          setPendingRegistrationData(pendingSession.formData);
          if (pendingSession.fees) {
            setPendingFees(pendingSession.fees);
          }

          // If gateway reported failure/cancel or user pressed "GO BACK" after an error
          if (statusParam.includes('fail') || statusParam.includes('cancel')) {
            setPaymentModalError(
              language === 'bn'
                ? 'পেমেন্ট সম্পন্ন হয়নি বা বাতিল করা হয়েছে। বিকাশ/নগদ স্যান্ডবক্সে ব্যক্তিগত নম্বর প্রবেশ করালে "The input wallet is not eligible" দেখায়। অনুগ্রহ করে টেস্ট নম্বর 01770618575, OTP: 123456, PIN: 12121 দিয়ে আবার চেষ্টা করুন।'
                : 'Payment was not completed or failed. Entering personal numbers in sandbox triggers "The input wallet is not eligible". Please try again with test wallet 01770618575, OTP 123456, PIN 12121.'
            );
          }
          setIsPaymentModalOpen(true);
        } else if (payType === 'donation' || (pendingSession && pendingSession.type === 'donation')) {
          setActiveView('donate');
        } else {
          setActiveView('register');
        }
        return;
      }

      // ── Standard deep-link handling ──────────────────────────────────────
      if (query) {
        const local = findRegistrationByTokenOrId(AppStore.getRegistrations(), query);
        if (local) {
          setActiveTicket(local);
          setActiveView('ticket');
        } else {
          setActiveView('find-ticket');
        }
      } else if (params.get('admin') === 'true') {
        setActiveView('admin');
      } else if (params.get('scanner') === 'true') {
        setActiveView('scanner');
      } else if (params.get('donate') === 'true') {
        setActiveView('donate');
      } else if (params.get('register') === 'true') {
        setActiveView('register');
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
    setPendingFees(fees);

    // If current student, reserve the Student ID in atomic state
    if (formData.category === 'current' && formData.studentId) {
      StudentIdService.reserveStudentId(formData.studentId, 600);
    }

    setIsPaymentModalOpen(true);
  };

  // Handle closing payment modal without completing transaction
  const handleCancelPaymentModal = () => {
    if (pendingRegistrationData?.category === 'current' && pendingRegistrationData.studentId) {
      StudentIdService.releaseReservation(pendingRegistrationData.studentId);
    }
    setIsPaymentModalOpen(false);
    setPendingRegistrationData(null);
    setPaymentModalError('');
    PayStationService.clearPendingSession();
  };

  if (activeView === 'portal') {
    return (
      <RmsManagementPortal
        onBackToPublic={() => {
          setActiveView('home');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
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
          onNavigate={(view) => {
            setActiveView(view);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      </div>

      {/* Main Content Area */}
      <main className="flex-1">
        {activeView === 'home' && (
          <HomePage
            language={language}
            feeSettings={feeSettings}
            onNavigate={(view) => {
              setActiveView(view);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onSelectTicket={(reg) => {
              setActiveTicket(reg);
              setActiveView('ticket');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {activeView === 'register' && (
          <RegistrationPage
            language={language}
            feeSettings={feeSettings}
            onInitiatePayment={handleInitiatePayment}
            onNavigate={(view) => {
              setActiveView(view);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {activeView === 'find-ticket' && (
          <TicketLookupModal
            language={language}
            onSelectRegistration={(registration) => {
              setActiveTicket(registration);
              setActiveView('ticket');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onNavigateRegister={() => {
              setActiveView('register');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {activeView === 'ticket' && activeTicket && (
          <TicketView
            registration={activeTicket}
            language={language}
            onNavigateHome={() => {
              setActiveView('home');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {activeView === 'donate' && <DonationPage language={language} />}

        {activeView === 'notices' && <NoticeBoardPage language={language} />}

        {activeView === 'gallery' && <GalleryPage language={language} />}

        {activeView === 'about' && <AboutContactPage language={language} />}

        {activeView === 'scanner' && <ScannerPortal language={language} />}

        {activeView === 'admin' && (
          <AdminDashboard
            language={language}
            onSelectTicket={(reg) => {
              setActiveTicket(reg);
              setActiveView('ticket');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}
      </main>

      {/* Universal Footer */}
      <div className="no-print">
        <Footer
          language={language}
          onNavigate={(view) => {
            setActiveView(view);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      </div>

      {/* Secure Payment Gateway Modal */}
      {isPaymentModalOpen && pendingRegistrationData && (
        <PaymentModal
          isOpen={isPaymentModalOpen}
          onClose={handleCancelPaymentModal}
          onSuccess={(ticket) => {
            setIsPaymentModalOpen(false);
            setPendingRegistrationData(null);
            setPaymentModalError('');
            PayStationService.clearPendingSession();
            try {
              localStorage.removeItem('plscf_registration_draft');
            } catch {}
            setActiveTicket(ticket);
            setActiveView('ticket');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          language={language}
          registrationFee={pendingFees.registrationFee}
          donationAmount={pendingFees.donationAmount}
          totalPayable={pendingFees.totalPayable}
          studentName={pendingRegistrationData.fullName}
          registrationData={pendingRegistrationData}
          initialErrorMessage={paymentModalError}
        />
      )}
    </div>
  );
}
