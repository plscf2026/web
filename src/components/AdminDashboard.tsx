import { useState, useEffect, lazy, Suspense } from 'react';
import {
  ShieldCheck,
  Users,
  DollarSign,
  Shirt,
  QrCode,
  FileText,
  Settings,
  Plus,
  Search,
  Download,
  Trash2,
  Edit2,
  Check,
  BarChart3,
  Calendar,
  AlertCircle,
  RefreshCw,
  Lock,
  Unlock,
  Sparkles,
  Database,
  LogOut,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Landmark,
  CreditCard,
  Layers,
  Menu,
  X,
} from 'lucide-react';
import {
  RegistrationRecord,
  DonationRecord,
  ExpenseRecord,
  FeeSettings,
  Language,
  NoticeItem,
  ScanLog,
  AdminAccount,
  HomePageSectionId,
  HomePageSectionSetting,
  DEFAULT_HOME_PAGE_SECTIONS,
} from '../types';
import { translations } from '../i18n/translations';
import { AppStore, INITIAL_STAFF_USERS } from '../services/store';
import { calculateFinancialSummary } from '../utils/rules';
import {
  SupabaseService,
  SUPABASE_PROJECT_ID,
  getRegistrationsTableName,
  getDonationsTableName,
  isDevTestBypassAllowed,
} from '../services/supabase';
import { MasterEventOverview } from './admin/MasterEventOverview';
import { BudgetManagementTab } from './admin/BudgetManagementTab';
import { DailyAnalyticsTab } from './admin/DailyAnalyticsTab';
import { StaffManagementTab } from './admin/StaffManagementTab';
import { AuditHistoryTab } from './admin/AuditHistoryTab';
import { StudentIdManagementTab } from './admin/StudentIdManagementTab';
import { StudentIdService } from '../services/studentIdStore';
import { EventStore } from '../services/eventStore';
// Heavy administrative portals loaded lazily to preserve bundle performance
const AdminRmsContainer = lazy(() =>
  import('./admin/rms/AdminRmsContainer').then((m) => ({ default: m.AdminRmsContainer }))
);
const IdCardManagementPortal = lazy(() =>
  import('./admin/idcard/IdCardManagementPortal').then((m) => ({ default: m.IdCardManagementPortal }))
);

const AdminTabFallback = () => (
  <div className="bg-white rounded-2xl p-12 border border-slate-200 text-center flex flex-col items-center justify-center my-6" role="status">
    <div className="w-10 h-10 rounded-full border-4 border-emerald-100 border-t-emerald-600 animate-spin mb-3 shadow-xs" />
    <p className="text-sm font-medium text-slate-500">Loading module...</p>
  </div>
);
import { formatCsvRow } from '../utils/security';

interface AdminDashboardProps {
  language: Language;
  onSelectTicket?: (reg: RegistrationRecord) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  language,
  onSelectTicket,
}) => {
  const t = translations[language];

  // ==========================================
  // SINGLE-SLOT ADMIN AUTHENTICATION STATE
  // ==========================================
  const [adminSession, setAdminSession] = useState<AdminAccount | null>(null);

  // Login form state - dev bypass enabled only in local development
  const isDevBypass = isDevTestBypassAllowed();
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);

  // Check session on mount
  useEffect(() => {
    let isMounted = true;
    async function checkSession() {
      try {
        const session = await SupabaseService.getActiveAdminSession();
        if (isMounted) setAdminSession(session);
      } catch (err) {
        console.error('Error checking admin session:', err);
      }
    }
    checkSession();
    return () => {
      isMounted = false;
    };
  }, []);

  // Handle Admin Login
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsSubmittingLogin(true);

    try {
      const result = await SupabaseService.loginAdmin(loginUsername, loginPassword);
      if (result.success && result.account) {
        setAdminSession(result.account);
      } else {
        setLoginError(
          result.error ||
            (language === 'bn'
              ? 'ভুল ইউজারনেম বা পাসওয়ার্ড।'
              : 'Invalid credentials. Please verify your username and password.')
        );
      }
    } catch (err: any) {
      setLoginError(err.message || 'Login error occurred.');
    } finally {
      setIsSubmittingLogin(false);
    }
  };

  // Handle Log Out
  const handleLogout = async () => {
    try {
      await SupabaseService.logoutAdmin();
    } catch (err) {
      console.error('Admin logout failed:', err);
    }
    setAdminSession(null);
  };

  // ==========================================
  // DASHBOARD DATA STATE
  // ==========================================
  const [activeTab, setActiveTab] = useState<
    | 'reunionManagement'
    | 'idCardManagement'
    | 'masterOverview'
    | 'budgetManagement'
    | 'dailyAnalytics'
    | 'staffManagement'
    | 'auditHistory'
    | 'allBookings'
    | 'securityAudit'
    | 'studentIds'
    | 'overview'
    | 'registrations'
    | 'feeSettings'
    | 'payments'
    | 'donations'
    | 'tshirts'
    | 'tickets'
    | 'staff'
    | 'finances'
    | 'notices'
    | 'reports'
  >('reunionManagement');
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  // Delete Booking Confirmation State (pop-up with mandatory reason)
  const [bookingToDelete, setBookingToDelete] = useState<RegistrationRecord | null>(null);
  const [deleteReason, setDeleteReason] = useState<string>('');
  const [isDeletingBooking, setIsDeletingBooking] = useState<boolean>(false);

  // Year Selection for Year-Specific Supabase Tables (e.g. registrations_2026, registrations_2027)
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [isFetchingFromSupabase, setIsFetchingFromSupabase] = useState<boolean>(false);
  const [supabaseTableUsed, setSupabaseTableUsed] = useState<string>(
    getRegistrationsTableName(2026)
  );

  // State from AppStore
  const [registrations, setRegistrations] = useState<RegistrationRecord[]>(() =>
    AppStore.getRegistrations()
  );
  const [donations, setDonations] = useState<DonationRecord[]>(() =>
    AppStore.getDonations()
  );
  const [expenses, setExpenses] = useState<ExpenseRecord[]>(() =>
    AppStore.getExpenses()
  );
  const [feeSettings, setFeeSettings] = useState<FeeSettings>(() =>
    AppStore.getFeeSettings()
  );
  const [notices, setNotices] = useState<NoticeItem[]>(() => AppStore.getNotices());
  const [scanLogs, setScanLogs] = useState<ScanLog[]>(() => AppStore.getScanLogs());

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'former' | 'current'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'pending' | 'refunded'>('all');

  // Modals
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [showAddNoticeModal, setShowAddNoticeModal] = useState(false);
  const [editingNoticeId, setEditingNoticeId] = useState<string | null>(null);
  const [showEditStudentModal, setShowEditStudentModal] = useState<RegistrationRecord | null>(null);

  // New Expense Form State
  const [expenseCategory, setExpenseCategory] = useState('Food & Grand Banquet');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseReason, setExpenseReason] = useState('');
  const [expenseOfficer, setExpenseOfficer] = useState('Finance Committee');
  const [expenseReceipt, setExpenseReceipt] = useState(`VOUCHER-${Math.floor(100 + Math.random() * 900)}`);

  // New Notice Form State
  const [noticeTitleEn, setNoticeTitleEn] = useState('');
  const [noticeTitleBn, setNoticeTitleBn] = useState('');
  const [noticeCategory, setNoticeCategory] = useState<NoticeItem['category']>('general');
  const [noticeContentEn, setNoticeContentEn] = useState('');
  const [noticeContentBn, setNoticeContentBn] = useState('');

  // Fee settings form
  const [formerFeeInput, setFormerFeeInput] = useState(feeSettings.formerStudentFee);
  const [currentFeeInput, setCurrentFeeInput] = useState(feeSettings.currentStudentFee);
  const [registrationOpenInput, setRegistrationOpenInput] = useState(feeSettings.registrationOpen);
  const [closedMessageEnInput, setClosedMessageEnInput] = useState(
    feeSettings.closedMessageEn ||
      'Online registration is currently closed. If you need special authorization, please contact the Reunion Secretariat.'
  );
  const [closedMessageBnInput, setClosedMessageBnInput] = useState(
    feeSettings.closedMessageBn ||
      'অনলাইন রেজিস্ট্রেশন কার্যক্রম বর্তমানে বন্ধ রয়েছে। জরুরি প্রয়োজনে অনুগ্রহ করে পুনর্মিলনী সচিবালয়ে যোগাযোগ করুন।'
  );
  const [eventTargetDateInput, setEventTargetDateInput] = useState(
    feeSettings.eventTargetDate || '2027-01-29T09:00:00'
  );
  const [simulateEventCompletedInput, setSimulateEventCompletedInput] = useState(
    Boolean(feeSettings.simulateEventCompleted)
  );
  const [homePageSectionsInput, setHomePageSectionsInput] = useState<HomePageSectionSetting[]>(
    () => feeSettings.homePageSections || DEFAULT_HOME_PAGE_SECTIONS
  );
  const [endDateInput, setEndDateInput] = useState(feeSettings.endDate || '2026-12-15');
  const [settingsSuccessNotice, setSettingsSuccessNotice] = useState(false);

  // Fetch registrations from Supabase for selected year
  const fetchSupabaseRegistrationsForYear = async (year: number) => {
    setIsFetchingFromSupabase(true);
    try {
      const res = await SupabaseService.fetchRegistrations(year);
      setSupabaseTableUsed(res.tableUsed);
      if (res.data && res.data.length > 0) {
        // Merge with existing state
        const localList = AppStore.getRegistrations();
        const mergedMap = new Map<string, RegistrationRecord>();
        localList.forEach((r) => mergedMap.set(r.id, r));
        res.data.forEach((r) => mergedMap.set(r.id, r));
        const mergedArray = Array.from(mergedMap.values());
        setRegistrations(mergedArray);
        AppStore.saveRegistrations(mergedArray);
      }
    } catch (err) {
      console.warn('Error fetching registrations from Supabase:', err);
    } finally {
      setIsFetchingFromSupabase(false);
    }
  };

  useEffect(() => {
    fetchSupabaseRegistrationsForYear(selectedYear);
  }, [selectedYear]);

  // Refresh all state
  const refreshAll = () => {
    const freshRegs = AppStore.getRegistrations();
    const freshDonations = AppStore.getDonations();
    const freshExpenses = AppStore.getExpenses();
    const freshSettings = AppStore.getFeeSettings();
    const freshNotices = AppStore.getNotices();
    const freshScanLogs = AppStore.getScanLogs();

    setRegistrations(freshRegs);
    setDonations(freshDonations);
    setExpenses(freshExpenses);
    setFeeSettings(freshSettings);
    setNotices(freshNotices);
    setScanLogs(freshScanLogs);

    setFormerFeeInput(freshSettings.formerStudentFee);
    setCurrentFeeInput(freshSettings.currentStudentFee);
    setRegistrationOpenInput(freshSettings.registrationOpen);
    setClosedMessageEnInput(freshSettings.closedMessageEn || '');
    setClosedMessageBnInput(freshSettings.closedMessageBn || '');
    setEventTargetDateInput(freshSettings.eventTargetDate || '2027-01-29T09:00:00');
    setSimulateEventCompletedInput(Boolean(freshSettings.simulateEventCompleted));
    setHomePageSectionsInput(freshSettings.homePageSections || DEFAULT_HOME_PAGE_SECTIONS);
    setEndDateInput(freshSettings.endDate || '2026-12-15');

    fetchSupabaseRegistrationsForYear(selectedYear);
  };

  const registrationsForYear = registrations.filter(
    (registration) => (registration.year ?? 2026) === selectedYear
  );
  const financial = calculateFinancialSummary(registrationsForYear, donations, expenses);
  const homePageSectionLabels: Record<HomePageSectionId, string> = {
    hero: 'Main event banner',
    countdown: 'Countdown',
    status: 'Registration status lookup',
    fees: 'Registration fees',
    notices: 'Latest notices',
    gallery: 'Photo and video preview',
    committee: 'Organizing committee',
  };

  // Filtered registrations for selected year / criteria
  const filteredRegistrations = registrationsForYear.filter((r) => {
    const matchSearch =
      r.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.mobileNumber.includes(searchTerm) ||
      r.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.batchName.toLowerCase().includes(searchTerm.toLowerCase());

    const matchCategory = categoryFilter === 'all' || r.category === categoryFilter;
    const matchStatus = statusFilter === 'all' || r.paymentStatus === statusFilter;

    return matchSearch && matchCategory && matchStatus;
  });

  // T-shirt size aggregation
  const tshirtSizes = ['S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'Oversize 50'] as const;
  const tshirtCounts = tshirtSizes.reduce((acc, size) => {
    acc[size] = registrations.filter(
      (r) => (r.year ?? 2026) === selectedYear && r.tShirtSize === size && r.paymentStatus === 'paid'
    ).length;
    return acc;
  }, {} as Record<string, number>);

  const tshirtCollectedCount = registrationsForYear.filter((r) => r.isTShirtCollected).length;

  // Handlers
  const handleSaveFeeSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: FeeSettings = {
      ...feeSettings,
      formerStudentFee: Number(formerFeeInput),
      currentStudentFee: Number(currentFeeInput),
      registrationOpen: Boolean(registrationOpenInput),
      closedMessageEn: closedMessageEnInput,
      closedMessageBn: closedMessageBnInput,
      eventTargetDate: eventTargetDateInput,
      simulateEventCompleted: Boolean(simulateEventCompletedInput),
      homePageSections: homePageSectionsInput,
      endDate: endDateInput,
    };
    AppStore.saveFeeSettings(updated);
    setFeeSettings(updated);
    setSettingsSuccessNotice(true);
    setTimeout(() => setSettingsSuccessNotice(false), 3000);
  };

  const moveHomePageSection = (sectionId: HomePageSectionId, offset: -1 | 1) => {
    setHomePageSectionsInput((current) => {
      const currentIndex = current.findIndex((section) => section.id === sectionId);
      const nextIndex = currentIndex + offset;
      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const updated = [...current];
      [updated[currentIndex], updated[nextIndex]] = [updated[nextIndex], updated[currentIndex]];
      return updated;
    });
  };

  const toggleHomePageSection = (sectionId: HomePageSectionId) => {
    setHomePageSectionsInput((current) =>
      current.map((section) =>
        section.id === sectionId ? { ...section, visible: !section.visible } : section
      )
    );
  };

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseAmount || !expenseReason) return;
    const newExp: ExpenseRecord = {
      id: `EXP-${Date.now()}`,
      category: expenseCategory,
      amount: Number(expenseAmount),
      reason: expenseReason,
      date: new Date().toISOString().split('T')[0],
      responsiblePerson: expenseOfficer,
      receiptRef: expenseReceipt,
    };
    AppStore.addExpense(newExp);
    setExpenses(AppStore.getExpenses());
    setShowAddExpenseModal(false);
    setExpenseAmount('');
    setExpenseReason('');
  };

  const handleAddNotice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noticeTitleEn || !noticeContentEn) return;
    const updated = editingNoticeId
      ? notices.map((notice) =>
          notice.id === editingNoticeId
            ? {
                ...notice,
                titleEn: noticeTitleEn.trim(),
                titleBn: noticeTitleBn.trim() || noticeTitleEn.trim(),
                category: noticeCategory,
                contentEn: noticeContentEn.trim(),
                contentBn: noticeContentBn.trim() || noticeContentEn.trim(),
                date: new Date().toISOString().split('T')[0],
              }
            : notice
        )
      : [
          {
            id: `NOT-${Date.now()}`,
            titleEn: noticeTitleEn.trim(),
            titleBn: noticeTitleBn.trim() || noticeTitleEn.trim(),
            category: noticeCategory,
            date: new Date().toISOString().split('T')[0],
            contentEn: noticeContentEn.trim(),
            contentBn: noticeContentBn.trim() || noticeContentEn.trim(),
            isPinned: false,
          },
          ...notices,
        ];
    AppStore.saveNotices(updated);
    setNotices(updated);
    setShowAddNoticeModal(false);
    setEditingNoticeId(null);
    setNoticeTitleEn('');
    setNoticeTitleBn('');
    setNoticeContentEn('');
    setNoticeContentBn('');
  };

  const handleEditNotice = (notice: NoticeItem) => {
    setEditingNoticeId(notice.id);
    setNoticeTitleEn(notice.titleEn);
    setNoticeTitleBn(notice.titleBn);
    setNoticeCategory(notice.category);
    setNoticeContentEn(notice.contentEn);
    setNoticeContentBn(notice.contentBn);
    setShowAddNoticeModal(true);
  };

  const handleDeleteNotice = (noticeId: string) => {
    if (!window.confirm('Delete this notice? This cannot be undone.')) return;
    const updated = notices.filter((notice) => notice.id !== noticeId);
    AppStore.saveNotices(updated);
    setNotices(updated);
  };

  const handleToggleTShirtCollected = (regId: string, current: boolean) => {
    AppStore.updateRegistration(regId, { isTShirtCollected: !current }, selectedYear);
    refreshAll();
  };

  const handleConfirmDeleteBooking = async () => {
    if (!bookingToDelete || !deleteReason.trim()) return;
    setIsDeletingBooking(true);

    try {
      // 1. If student ID was used or reserved, release/reset it
      if (bookingToDelete.studentId) {
        StudentIdService.releaseReservation(bookingToDelete.studentId);
      }

      // 2. Remove registration from AppStore
      AppStore.deleteRegistration(bookingToDelete.id, selectedYear);

      // 3. Record audit trail in EventStore
      EventStore.recordAuditHistory({
        adminId: adminSession?.id || 'SUPER_ADMIN',
        adminName: adminSession?.fullName || adminSession?.username || 'Super Administrator',
        entityType: 'REGISTRATION',
        entityId: bookingToDelete.id,
        action: 'DELETE_REGISTRATION',
        reason: deleteReason.trim(),
      });

      // 4. Record audit log in SupabaseService
      if (adminSession) {
        await SupabaseService.recordAuditLog({
          adminId: adminSession.id,
          adminUsername: adminSession.username,
          adminRole: adminSession.role,
          action: 'STUDENT_RECORD_DELETE',
          targetType: 'registration',
          targetId: bookingToDelete.id,
          details: `Booking ${bookingToDelete.id} (${bookingToDelete.fullName}) deleted. Reason: ${deleteReason.trim()}`,
        });
      }
    } catch (err) {
      console.warn('Error deleting booking:', err);
    } finally {
      setIsDeletingBooking(false);
      setBookingToDelete(null);
      setDeleteReason('');
      refreshAll();
    }
  };

  // Export to CSV helper with formula injection protection
  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) return;
    const headers = formatCsvRow(Object.keys(data[0]));
    const rows = data.map((obj) => formatCsvRow(Object.values(obj)));
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ==========================================
  // VIEW 1: AUTHENTICATION GATE (SINGLE SLOT / LOGIN)
  // ==========================================
  if (!adminSession) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16">
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
          {/* Header Banner - Solid Institutional Navy Blue */}
          <div className="bg-[#172554] p-6 sm:p-8 text-white text-center space-y-2 border-b border-blue-900">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/10 border border-white/20 text-[#C5A45D] shadow-md mb-1">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight">
              {language === 'bn'
                ? 'পুলিশ লাইন্স স্কুল ও কলেজ পুনর্মিলনী অ্যাডমিন পোর্টাল'
                : 'Police Lines School & College Reunion Admin Portal'}
            </h1>
            <p className="text-xs text-slate-300">
              Supabase Backend: <span className="font-mono text-amber-300">{SUPABASE_PROJECT_ID}</span>
            </p>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            {/* Strict Admin Login Protection Gate (Requirement 1) */}
            <div className="space-y-5">
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 space-y-1">
                <div className="flex items-center gap-2 font-black text-xs uppercase tracking-wider text-amber-800">
                  <Lock className="w-4 h-4 text-amber-600" />
                  <span>
                    {language === 'bn'
                      ? 'অ্যাডমিন প্যানেল পাসওয়ার্ড সুরক্ষিত (Access Protected)'
                      : 'Admin Portal Login Protected (Restricted Access)'}
                  </span>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  {language === 'bn'
                    ? 'এই প্যানেলে প্রবেশের জন্য অনুমোদিত অ্যাডমিন আইডি ও পাসওয়ার্ড বাধ্যতামূলক। অননুমোদিত প্রবেশ প্রতিরোধে সকল লগইন প্রচেষ্টা অডিট লগে রেকর্ড করা হয়।'
                    : 'This administration portal is strictly login-protected. Only authorized administrators with verified credentials may enter. All authentication attempts are logged.'}
                </p>
              </div>

              {/* Testing Mode Credentials Banner (Rendered in development/testing mode) */}
              {isDevBypass && (
                <div className="p-3 bg-sky-50 border border-sky-300 text-sky-900 rounded-xl text-xs space-y-2 shadow-2xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 font-medium flex-wrap">
                      <span className="font-bold text-sky-950">🧪 Testing Credentials:</span>
                      <span className="font-mono bg-white px-2 py-0.5 rounded border border-sky-200 text-sky-800 font-bold">admin@gmail.com</span>
                      <span className="text-slate-400">/</span>
                      <span className="font-mono bg-white px-2 py-0.5 rounded border border-sky-200 text-sky-800 font-bold">admin@123</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setLoginUsername('admin@gmail.com');
                        setLoginPassword('admin@123');
                      }}
                      className="text-[10px] text-sky-800 bg-sky-100 hover:bg-sky-200 px-2.5 py-1 rounded-full font-bold cursor-pointer transition-colors shadow-2xs"
                    >
                      Auto-fill
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-sky-200/60 text-[11px]">
                    <span className="text-[10px] text-slate-500 font-semibold">Other Test Roles:</span>
                    {[
                      { label: 'Registration Mgr', email: 'registration@gmail.com' },
                      { label: 'Finance Mgr', email: 'finance@gmail.com' },
                      { label: 'Scanner Supervisor', email: 'supervisor@gmail.com' },
                    ].map((role) => (
                      <button
                        key={role.email}
                        type="button"
                        onClick={() => {
                          setLoginUsername(role.email);
                          setLoginPassword('admin@123');
                        }}
                        className="px-2 py-0.5 bg-white hover:bg-sky-100 rounded-md border border-sky-200 text-slate-700 text-[10px] font-medium transition cursor-pointer"
                      >
                        {role.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {loginError && (
                <div className="p-3 bg-rose-50 border border-rose-300 text-rose-800 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              <form onSubmit={handleAdminLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {language === 'bn' ? 'অ্যাডমিন ইমেইল / ইউজারনেম' : 'Administrator Email / Username'} *
                  </label>
                  <input
                    type="text"
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    placeholder="admin@example.com"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:border-slate-900 focus:outline-hidden"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {language === 'bn' ? 'পাসওয়ার্ড / নিরাপত্তা পিন' : 'Password / Access PIN'} *
                  </label>
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:border-slate-900 focus:outline-hidden"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingLogin}
                  className="w-full py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs sm:text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 mt-2"
                >
                  <Lock className="w-4 h-4 text-amber-400" />
                  <span>
                    {isSubmittingLogin
                      ? language === 'bn'
                        ? 'যাচাই করা হচ্ছে...'
                        : 'Authenticating...'
                      : language === 'bn'
                      ? 'নিরাপদ অ্যাডমিন লগইন (Sign In)'
                      : 'Secure Admin Sign In'}
                  </span>
                </button>
              </form>

              <div className="pt-2 text-center border-t border-slate-100">
                <span className="text-[11px] text-slate-400">
                  Administrator accounts must be provisioned and authorized in Supabase Auth.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 2: AUTHENTICATED CENTRAL COMMAND DASHBOARD
  // ==========================================
  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Admin Header with Supabase Connection Telemetry - Solid Navy Blue */}
      <div className="bg-[#172554] text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-blue-900 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-900 border border-blue-700 text-[11px] font-bold text-[#C5A45D]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#C5A45D]" />
              <span>{adminSession.fullName}</span>
              <span className="text-slate-300 font-mono">(@{adminSession.username})</span>
            </span>

            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[11px] font-mono text-emerald-300">
              <Database className="w-3 h-3 text-emerald-400" />
              <span>Supabase: {SUPABASE_PROJECT_ID}</span>
            </span>

            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-950 border border-blue-800 text-[10px] font-bold uppercase text-[#C5A45D]">
              <Lock className="w-3 h-3 text-[#C5A45D]" />
              <span>Single Admin Slot Claimed</span>
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">{t.adminHeading}</h1>
          <p className="text-xs text-slate-300 mt-1">{t.adminSubtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end">
          <button
            onClick={refreshAll}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
            title="Refresh local and Supabase data"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{language === 'bn' ? 'রিফ্রেশ' : 'Refresh'}</span>
          </button>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-900/60 hover:bg-rose-900 text-rose-200 text-xs font-semibold border border-rose-700/60 transition-colors cursor-pointer"
            title="Log out of admin session"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-400" />
            <span>{language === 'bn' ? 'লগআউট' : 'Log Out'}</span>
          </button>
        </div>
      </div>

      {/* Admin Navigation & Content Layout */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* ======================================================== */}
        {/* 1. LEFT SIDEBAR NAVIGATION (Desktop: lg+)                */}
        {/* ======================================================== */}
        <aside className="hidden lg:block w-64 xl:w-72 shrink-0 bg-white rounded-3xl p-3.5 border border-slate-200 shadow-xs sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto">
          {/* Sidebar Title */}
          <div className="px-3 py-2 flex items-center justify-between border-b border-slate-100 mb-2">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#172554]" />
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                {language === 'bn' ? 'অ্যাডমিন মডিউল (১৩টি)' : 'ADMIN MODULES (13)'}
              </span>
            </div>
            <span className="text-[10px] font-mono font-bold bg-[#172554]/10 text-[#172554] px-1.5 py-0.5 rounded">
              CONTROL
            </span>
          </div>

          {/* Navigation Items List */}
          <nav className="space-y-1">
            {[
              {
                id: 'reunionManagement',
                label: language === 'bn' ? '🏛️ পুনর্মিলনী ইআরপি (RMS)' : '🏛️ Reunion Management (RMS)',
                icon: Landmark,
                highlight: true,
                badge: 'ERP 2027',
              },
              {
                id: 'idCardManagement',
                label: language === 'bn' ? '🪪 আইডি কার্ড পোর্টাল' : '🪪 Student ID Cards',
                icon: CreditCard,
                highlight: true,
                badge: 'ID Suite',
              },
              { id: 'masterOverview', label: language === 'bn' ? 'মাস্টার ইভেন্ট ড্যাশবোর্ড' : 'Master Overview', icon: Sparkles },
              { id: 'budgetManagement', label: language === 'bn' ? 'বাজেট ও ব্যয়' : 'Budget & Expenses', icon: DollarSign },
              { id: 'dailyAnalytics', label: language === 'bn' ? 'দৈনিক অ্যানালিটিক্স' : 'Daily Analytics', icon: BarChart3 },
              { id: 'staffManagement', label: language === 'bn' ? 'স্টাফ ও রোলস' : 'Staff & Roles', icon: Users },
              { id: 'auditHistory', label: language === 'bn' ? 'অডিট হিস্ট্রি' : 'Audit Trail', icon: ShieldAlert },
              { id: 'allBookings', label: language === 'bn' ? 'সকল বুকিং (সুপাবেস)' : 'All Bookings (Supabase)', icon: Database },
              { id: 'studentIds', label: language === 'bn' ? 'স্টুডেন্ট আইডি ব্যবস্থাপনা' : 'Student ID Management', icon: ShieldCheck },
              { id: 'feeSettings', label: t.tabFeeSettings, icon: Settings },
              { id: 'tickets', label: t.tabTickets, icon: QrCode },
              { id: 'notices', label: t.tabNoticesAdmin, icon: FileText },
              { id: 'reports', label: t.tabReports, icon: Download },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#172554] text-white shadow-md'
                      : tab.highlight
                      ? 'text-[#172554] bg-[#172554]/5 hover:bg-[#172554]/10 font-black'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#C5A45D]' : tab.highlight ? 'text-[#172554]' : 'text-slate-400'}`} />
                    <span className="truncate">{tab.label}</span>
                  </div>
                  {isActive ? (
                    <ChevronRight className="w-3.5 h-3.5 text-[#C5A45D] shrink-0" />
                  ) : tab.badge ? (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                      {tab.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* ======================================================== */}
        {/* 2. MOBILE DRAWER NAVIGATION (Mobile: < lg)              */}
        {/* ======================================================== */}
        {isMobileDrawerOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
              onClick={() => setIsMobileDrawerOpen(false)}
            />

            {/* Drawer Content */}
            <div className="relative w-72 max-w-[85vw] bg-white h-full shadow-2xl p-4 flex flex-col z-10 overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#172554]" />
                  <span className="text-xs font-black text-slate-900">
                    {language === 'bn' ? 'অ্যাডমিন মডিউলসমূহ' : 'Admin Modules (13)'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileDrawerOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="space-y-1 flex-1">
                {[
                  {
                    id: 'reunionManagement',
                    label: language === 'bn' ? '🏛️ পুনর্মিলনী ইআরপি (RMS)' : '🏛️ Reunion Management (RMS)',
                    icon: Landmark,
                    highlight: true,
                  },
                  {
                    id: 'idCardManagement',
                    label: language === 'bn' ? '🪪 আইডি কার্ড পোর্টাল' : '🪪 Student ID Cards',
                    icon: CreditCard,
                    highlight: true,
                  },
                  { id: 'masterOverview', label: language === 'bn' ? 'মাস্টার ইভেন্ট ড্যাশবোর্ড' : 'Master Overview', icon: Sparkles },
                  { id: 'budgetManagement', label: language === 'bn' ? 'বাজেট ও ব্যয়' : 'Budget & Expenses', icon: DollarSign },
                  { id: 'dailyAnalytics', label: language === 'bn' ? 'দৈনিক অ্যানালিটিক্স' : 'Daily Analytics', icon: BarChart3 },
                  { id: 'staffManagement', label: language === 'bn' ? 'স্টাফ ও রোলস' : 'Staff & Roles', icon: Users },
                  { id: 'auditHistory', label: language === 'bn' ? 'অডিট হিস্ট্রি' : 'Audit Trail', icon: ShieldAlert },
                  { id: 'allBookings', label: language === 'bn' ? 'সকল বুকিং (সুপাবেস)' : 'All Bookings (Supabase)', icon: Database },
                  { id: 'studentIds', label: language === 'bn' ? 'স্টুডেন্ট আইডি ব্যবস্থাপনা' : 'Student ID Management', icon: ShieldCheck },
                  { id: 'feeSettings', label: t.tabFeeSettings, icon: Settings },
                  { id: 'tickets', label: t.tabTickets, icon: QrCode },
                  { id: 'notices', label: t.tabNoticesAdmin, icon: FileText },
                  { id: 'reports', label: t.tabReports, icon: Download },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setActiveTab(tab.id as any);
                        setIsMobileDrawerOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                        isActive
                          ? 'bg-[#172554] text-white shadow-md'
                          : tab.highlight
                          ? 'text-[#172554] bg-[#172554]/5 hover:bg-[#172554]/10 font-black'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#C5A45D]' : 'text-slate-400'}`} />
                        <span className="truncate">{tab.label}</span>
                      </div>
                      {isActive && <ChevronRight className="w-3.5 h-3.5 text-[#C5A45D] shrink-0" />}
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* 3. MAIN CONTENT VIEWPORT (Right side of Sidebar)         */}
        {/* ======================================================== */}
        <main className="flex-1 min-w-0 w-full space-y-6">
          {/* Mobile Current Module Quick-Selector Bar (< lg) */}
          <div className="lg:hidden bg-white border border-slate-200 rounded-2xl p-3 shadow-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-[#172554] text-[#C5A45D] flex items-center justify-center shrink-0">
                <Layers className="w-4 h-4" />
              </div>
              <div className="truncate">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">
                  {language === 'bn' ? 'বর্তমান সেকশন' : 'Current Section'}
                </span>
                <span className="text-xs font-black text-slate-900 truncate block">
                  {activeTab === 'reunionManagement'
                    ? (language === 'bn' ? '🏛️ পুনর্মিলনী ইআরপি (RMS)' : '🏛️ Reunion Management (RMS)')
                    : activeTab === 'idCardManagement'
                    ? (language === 'bn' ? '🪪 আইডি কার্ড পোর্টাল' : '🪪 Student ID Cards')
                    : activeTab === 'masterOverview'
                    ? (language === 'bn' ? 'মাস্টার ইভেন্ট ড্যাশবোর্ড' : 'Master Overview')
                    : activeTab === 'budgetManagement'
                    ? (language === 'bn' ? 'বাজেট ও ব্যয়' : 'Budget & Expenses')
                    : activeTab === 'dailyAnalytics'
                    ? (language === 'bn' ? 'দৈনিক অ্যানালিটিক্স' : 'Daily Analytics')
                    : activeTab === 'staffManagement'
                    ? (language === 'bn' ? 'স্টাফ ও রোলস' : 'Staff & Roles')
                    : activeTab === 'auditHistory'
                    ? (language === 'bn' ? 'অডিট হিস্ট্রি' : 'Audit Trail')
                    : activeTab === 'allBookings'
                    ? (language === 'bn' ? 'সকল বুকিং (সুপাবেস)' : 'All Bookings (Supabase)')
                    : activeTab === 'studentIds'
                    ? (language === 'bn' ? 'স্টুডেন্ট আইডি ব্যবস্থাপনা' : 'Student ID Management')
                    : activeTab === 'feeSettings'
                    ? t.tabFeeSettings
                    : activeTab === 'tickets'
                    ? t.tabTickets
                    : activeTab === 'notices'
                    ? t.tabNoticesAdmin
                    : activeTab === 'reports'
                    ? t.tabReports
                    : activeTab}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsMobileDrawerOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold shrink-0 transition-colors cursor-pointer"
            >
              <Menu className="w-4 h-4" />
              <span>{language === 'bn' ? 'সকল মেনু' : 'All Modules'}</span>
            </button>
          </div>

      {/* TAB: REUNION MANAGEMENT SYSTEM (RMS - 12 INTEGRATED MODULES) */}
      {activeTab === 'reunionManagement' && (
        <Suspense fallback={<AdminTabFallback />}>
          <AdminRmsContainer
            language={language}
            registrations={registrations}
            adminSession={adminSession}
          />
        </Suspense>
      )}

      {/* TAB: STUDENT ID CARD MANAGEMENT SYSTEM */}
      {activeTab === 'idCardManagement' && (
        <Suspense fallback={<AdminTabFallback />}>
          <IdCardManagementPortal
            currentUserEmail={adminSession?.email || 'admin@gmail.com'}
            currentUserRole={adminSession?.role || 'super_admin'}
            isSuperAdmin={adminSession?.role === 'super_admin' || !adminSession}
          />
        </Suspense>
      )}

      {/* TAB: MASTER EVENT OVERVIEW (PART 9) */}
      {activeTab === 'masterOverview' && (
        <MasterEventOverview
          language={language}
          registrations={registrations}
          onNavigateTab={(tab) => {
            if (tab === 'dailyRegAnalytics' || tab === 'dailyPayAnalytics') {
              setActiveTab('dailyAnalytics');
            } else {
              setActiveTab(tab as any);
            }
          }}
        />
      )}

      {/* TAB: BUDGET & EXPENSE MANAGEMENT (PART 8) */}
      {activeTab === 'budgetManagement' && (
        <BudgetManagementTab
          adminId={adminSession.id}
          adminName={adminSession.fullName}
        />
      )}

      {/* TAB: DAILY REGISTRATION & PAYMENT ANALYTICS (PARTS 6 & 7) */}
      {activeTab === 'dailyAnalytics' && (
        <DailyAnalyticsTab language={language} registrations={registrations} />
      )}

      {/* TAB: STAFF ACCOUNTS & ROLE ISOLATION (PART 2) */}
      {activeTab === 'staffManagement' && (
        <StaffManagementTab currentAdminEmail={adminSession.email} />
      )}

      {/* TAB: PRIVILEGED OPERATIONS AUDIT TRAIL (PART 10) */}
      {activeTab === 'auditHistory' && (
        <AuditHistoryTab />
      )}

      {/* TAB 1: ALL BOOKINGS (SUPABASE BACKEND - YEAR SPECIFIC) */}
      {activeTab === 'allBookings' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-6">
          {/* Header & Year Selector Bar */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-emerald-600" />
                <h2 className="text-lg font-black text-slate-900">
                  {language === 'bn'
                    ? 'ওয়েবসাইটে সম্পন্ন সকল স্টুডেন্ট বুকিং ও নিবন্ধন'
                    : 'All Student Bookings & Registrations'}
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {language === 'bn'
                  ? `সুপাবেস ব্যাকএন্ড টেবিল: ${supabaseTableUsed} • বছর অনুযায়ী পৃথক টেবিল সংরক্ষণ`
                  : `Target Supabase Backend Table: ${supabaseTableUsed} • Stored separately per event year`}
              </p>
            </div>

            {/* Year Selector Control */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                <span>{language === 'bn' ? 'ইভেন্ট বছর:' : 'Event Year:'}</span>
              </span>

              {[2026, 2027, 2028].map((yr) => (
                <button
                  key={yr}
                  onClick={() => setSelectedYear(yr)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                    selectedYear === yr
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {yr}
                </button>
              ))}

              <button
                onClick={() => fetchSupabaseRegistrationsForYear(selectedYear)}
                disabled={isFetchingFromSupabase}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-xs font-bold cursor-pointer transition-colors"
                title="Fetch latest bookings directly from Supabase"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isFetchingFromSupabase ? 'animate-spin' : ''}`} />
                <span>{isFetchingFromSupabase ? 'Syncing...' : 'Fetch from Supabase'}</span>
              </button>

              <button
                onClick={() => exportToCSV(filteredRegistrations, `PLSCF_Bookings_${selectedYear}`)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{t.btnExportCsv}</span>
              </button>
            </div>
          </div>

          {/* Bookings Statistics Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <span className="text-[11px] text-slate-500 font-bold uppercase block">Total Bookings</span>
              <span className="text-2xl font-black text-slate-900 mt-1 block">
                {registrationsForYear.length}
              </span>
              <span className="text-[10px] text-emerald-600 font-medium">In Table: {supabaseTableUsed}</span>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <span className="text-[11px] text-slate-500 font-bold uppercase block">Former Students</span>
              <span className="text-2xl font-black text-emerald-700 mt-1 block">
                {registrationsForYear.filter((r) => r.category === 'former').length}
              </span>
              <span className="text-[10px] text-slate-400">Alumni SSC/HSC</span>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <span className="text-[11px] text-slate-500 font-bold uppercase block">Current Students</span>
              <span className="text-2xl font-black text-teal-700 mt-1 block">
                {registrationsForYear.filter((r) => r.category === 'current').length}
              </span>
              <span className="text-[10px] text-slate-400">Enrolled School & College</span>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <span className="text-[11px] text-slate-500 font-bold uppercase block">Total Booking Revenue</span>
              <span className="text-2xl font-black text-amber-700 mt-1 block">
                ৳{registrationsForYear.reduce((sum, r) => sum + r.totalPaid, 0).toLocaleString()}
              </span>
              <span className="text-[10px] text-slate-400">Fees + Additional Donations</span>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder={
                  language === 'bn'
                    ? 'নাম, আইডি, মোবাইল বা ব্যাচ দিয়ে খুঁজুন...'
                    : 'Search by student name, ID, mobile, or batch...'
                }
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-300 text-xs focus:border-emerald-500 focus:outline-hidden"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as any)}
              className="px-3 py-2 rounded-xl border border-slate-300 text-xs focus:border-emerald-500 focus:outline-hidden"
            >
              <option value="all">All Student Categories (সকল ক্যাটাগরি)</option>
              <option value="former">Former Students (প্রাক্তন অ্যালামনাই)</option>
              <option value="current">Current Students (বর্তমান শিক্ষার্থী)</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 rounded-xl border border-slate-300 text-xs focus:border-emerald-500 focus:outline-hidden"
            >
              <option value="all">All Payment Statuses (সকল পেমেন্ট স্ট্যাটাস)</option>
              <option value="paid">PAID & VERIFIED (পরিশোধিত)</option>
              <option value="pending">PENDING (অপেক্ষমান)</option>
              <option value="refunded">REFUNDED / CANCELLED (বাতিল)</option>
            </select>
          </div>

          {/* Bookings Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold uppercase text-[11px]">
                  <th className="py-3 px-3">Student</th>
                  <th className="py-3 px-3">Category & Batch</th>
                  <th className="py-3 px-3">Contact</th>
                  <th className="py-3 px-3">T-Shirt</th>
                  <th className="py-3 px-3">Amount Paid</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Transaction</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRegistrations.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      No bookings found for year {selectedYear} matching your criteria.
                    </td>
                  </tr>
                ) : (
                  filteredRegistrations.map((reg) => (
                    <tr key={reg.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={reg.photoUrl}
                            alt={reg.fullName}
                            className="w-10 h-10 rounded-xl object-cover border border-slate-200 shrink-0"
                          />
                          <div>
                            <span className="font-bold text-slate-900 block">{reg.fullName}</span>
                            <span className="font-mono text-[10px] text-emerald-700 font-bold block">
                              {reg.id}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            reg.category === 'former'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-teal-100 text-teal-800'
                          }`}
                        >
                          {reg.category}
                        </span>
                        <span className="block text-slate-700 font-medium mt-1">
                          {reg.batchName}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-slate-600">
                        <div className="font-mono">{reg.mobileNumber}</div>
                        <div className="text-[10px] text-slate-400">{reg.email}</div>
                      </td>

                      <td className="py-3 px-3">
                        <button
                          onClick={() => handleToggleTShirtCollected(reg.id, reg.isTShirtCollected)}
                          className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                            reg.isTShirtCollected
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                          }`}
                          title="Click to toggle collected status"
                        >
                          {reg.tShirtSize} • {reg.isTShirtCollected ? 'Delivered' : 'Pending'}
                        </button>
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-black text-slate-900">৳{reg.totalPaid}</div>
                        {reg.donationAmount > 0 && (
                          <div className="text-[10px] text-rose-600 font-semibold">
                            (+৳{reg.donationAmount} Donation)
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            reg.paymentStatus === 'paid'
                              ? 'bg-emerald-100 text-emerald-800'
                              : reg.paymentStatus === 'pending'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {reg.paymentStatus}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-[11px] text-slate-600">
                        <span className="font-mono font-bold block">{reg.transactionId}</span>
                        <span className="text-[10px] text-slate-400 uppercase">{reg.paymentMethod}</span>
                      </td>

                      <td className="py-3 px-3 text-right space-x-1 whitespace-nowrap">
                        <button
                          onClick={() => onSelectTicket && onSelectTicket(reg)}
                          className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-[11px] font-bold cursor-pointer transition-colors"
                          title="View Digital Ticket"
                        >
                          View Ticket
                        </button>

                        <button
                          onClick={() => setShowEditStudentModal(reg)}
                          className="p-1.5 text-slate-600 hover:text-slate-900 rounded hover:bg-slate-100 cursor-pointer"
                          title="Edit Student Info"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => {
                            setBookingToDelete(reg);
                            setDeleteReason('');
                          }}
                          className="p-1.5 text-rose-600 hover:text-rose-800 rounded hover:bg-rose-50 cursor-pointer"
                          title={language === 'bn' ? 'বুকিং মুছে ফেলুন' : 'Delete Registration'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: CURRENT STUDENT ID MANAGEMENT */}
      {activeTab === 'studentIds' && (
        <StudentIdManagementTab
          language={language}
          onSelectTicket={(regId) => {
            const reg = registrations.find((r) => r.id === regId);
            if (reg && onSelectTicket) onSelectTicket(reg);
          }}
        />
      )}

      {/* TAB 3: OVERVIEW & TELEMETRY */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* KPI Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 block uppercase">
                {language === 'bn' ? 'মোট নিবন্ধিত শিক্ষার্থী' : 'Total Registrations'}
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-black text-slate-900">
                  {financial.paidRegistrationsCount}
                </span>
                <span className="text-xs text-emerald-600 font-bold">10,000+ Capacity</span>
              </div>
              <div className="mt-2 text-[11px] text-slate-500 flex justify-between">
                <span>Former: {financial.formerStudentsCount}</span>
                <span>Current: {financial.currentStudentsCount}</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 block uppercase">
                {language === 'bn' ? 'মোট সংগৃহীত নিবন্ধন ফি' : 'Total Registration Fees'}
              </span>
              <div className="text-3xl font-black text-emerald-700 mt-1">
                ৳ {financial.totalRegistrationRevenue.toLocaleString()}
              </div>
              <div className="mt-2 text-[11px] text-slate-500">
                Avg: ৳{Math.round(financial.totalRegistrationRevenue / (financial.paidRegistrationsCount || 1))} / student
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 block uppercase">
                {language === 'bn' ? 'মোট অনুদান' : 'Total Donations'}
              </span>
              <div className="text-3xl font-black text-teal-700 mt-1">
                ৳ {financial.totalDonations.toLocaleString()}
              </div>
              <div className="mt-2 text-[11px] text-slate-500">
                {donations.length} institutional patrons
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 block uppercase">
                {language === 'bn' ? 'অবশিষ্ট কার্যকরী তহবিল' : 'Net Operating Balance'}
              </span>
              <div
                className={`text-3xl font-black mt-1 ${
                  financial.remainingBalance >= 0 ? 'text-emerald-700' : 'text-rose-600'
                }`}
              >
                ৳ {financial.remainingBalance.toLocaleString()}
              </div>
              <div className="mt-2 text-[11px] text-slate-500">
                Expenses: ৳{financial.totalExpenses.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Operational Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* T-Shirt Breakdown */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <Shirt className="w-4 h-4 text-emerald-600" />
                  <span>{language === 'bn' ? 'টি-শার্ট সাইজ বিভাজন' : 'T-Shirt Size Breakdown'}</span>
                </h3>
                <span className="text-xs font-semibold text-slate-500">
                  {tshirtCollectedCount}/{registrations.length} Delivered
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                {tshirtSizes.map((size) => (
                  <div key={size} className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="font-bold text-slate-700 block">{size}</span>
                    <span className="text-lg font-black text-slate-900 mt-0.5 block">
                      {tshirtCounts[size] || 0}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Gate Attendance Telemetry */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <QrCode className="w-4 h-4 text-emerald-600" />
                <span>{language === 'bn' ? 'গেট প্রবেশ ও প্রস্থান' : 'Gate Attendance'}</span>
              </h3>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between p-2 rounded-lg bg-emerald-50 text-emerald-900 font-semibold">
                  <span>Approved Entries:</span>
                  <span className="font-bold">
                    {scanLogs.filter((s) => s.scanType === 'entry' && s.status === 'approved').length}
                  </span>
                </div>
                <div className="flex justify-between p-2 rounded-lg bg-slate-50 text-slate-700 font-semibold">
                  <span>Approved Exits:</span>
                  <span className="font-bold">
                    {scanLogs.filter((s) => s.scanType === 'exit' && s.status === 'approved').length}
                  </span>
                </div>
                <div className="flex justify-between p-2 rounded-lg bg-amber-50 text-amber-900 font-semibold">
                  <span>Currently Inside Campus:</span>
                  <span className="font-bold">2</span>
                </div>
              </div>
            </div>

            {/* School Profile Summary */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <h3 className="font-bold text-slate-900 text-sm">
                {t.institutionName}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                64 Years of Academic Glory & Discipline. The Grand Reunion 2026 hosts 10,000+ alumni,
                current students, faculty, and national dignitaries at the college campus.
              </p>
              <div className="text-xs text-slate-500 pt-2 border-t border-slate-100 space-y-1">
                <div>Dates: Dec 25-26, 2026</div>
                <div>Security: High District Police Protection</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: FEE SETTINGS & REGISTRATION STATUS */}
      {activeTab === 'feeSettings' && (
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-xs max-w-3xl space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {language === 'bn' ? 'রেজিস্ট্রেশন স্ট্যাটাস ও ফি কনফিগারেশন' : 'Registration Status & Event Settings'}
            </h2>
            <p className="text-xs text-slate-500">
              {language === 'bn'
                ? 'রেজিস্ট্রেশন চালু/বন্ধ, ফি নির্ধারণ, ইভেন্ট সময়সূচি এবং ওয়েবসাইট কাউন্টডাউন নিয়ন্ত্রণ করুন।'
                : 'Manage open/close status, category fees, target event countdown, and post-event simulation.'}
            </p>
          </div>

          {settingsSuccessNotice && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>
                {language === 'bn'
                  ? 'সেটিংস সফলভাবে সংরক্ষিত হয়েছে এবং ওয়েবসাইটে তাৎক্ষণিক প্রযোজ্য হয়েছে!'
                  : 'Settings saved successfully and updated live on the website!'}
              </span>
            </div>
          )}

          <form onSubmit={handleSaveFeeSettings} className="space-y-6">
            {/* 1. REGISTRATION STATUS TOGGLE */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    {language === 'bn' ? 'অনলাইন রেজিস্ট্রেশন স্ট্যাটাস' : 'Online Registration Status'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {language === 'bn'
                      ? 'রেজিস্ট্রেশন বন্ধ করলে ওয়েবসাইটে বন্ধের নোটিশ প্রদর্শিত হবে এবং নতুন আবেদন নিষ্ক্রিয় থাকবে।'
                      : 'Closing registration displays the advisory banner and disables new registration forms.'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setRegistrationOpenInput(!registrationOpenInput)}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 shadow-xs ${
                    registrationOpenInput
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                      : 'bg-rose-600 text-white hover:bg-rose-700'
                  }`}
                >
                  {registrationOpenInput ? (
                    <>
                      <Unlock className="w-3.5 h-3.5" />
                      <span>{language === 'bn' ? 'রেজিস্ট্রেশন চালু (OPEN)' : 'REGISTRATION OPEN'}</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-3.5 h-3.5" />
                      <span>{language === 'bn' ? 'রেজিস্ট্রেশন বন্ধ (CLOSED)' : 'REGISTRATION CLOSED'}</span>
                    </>
                  )}
                </button>
              </div>

              {/* Status preview banner */}
              <div className="pt-2 border-t border-slate-200">
                <span className="text-[11px] text-slate-400 mr-2">Website Badge Preview:</span>
                {registrationOpenInput ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    {t.regStatusOpenBadge} (Deadline: {endDateInput})
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800">
                    <Lock className="w-3 h-3 text-rose-600" />
                    {t.regStatusClosedBadge}
                  </span>
                )}
              </div>
            </div>

            {/* 2. REGISTRATION CLOSED ADVISORY MESSAGES */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-800">
                {language === 'bn'
                  ? 'রেজিস্ট্রেশন বন্ধ থাকলে প্রদর্শিত বার্তা (Notice when Registration is Closed)'
                  : 'Closed Advisory Notices (Displayed when registration is closed)'}
              </label>

              <div>
                <span className="text-[11px] text-slate-500 block mb-1">English Advisory Notice:</span>
                <textarea
                  rows={2}
                  value={closedMessageEnInput}
                  onChange={(e) => setClosedMessageEnInput(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 focus:border-emerald-500 focus:outline-hidden"
                  placeholder="Enter notice in English..."
                />
              </div>

              <div>
                <span className="text-[11px] text-slate-500 block mb-1">বাংলা নোটিশ (Bengali Notice):</span>
                <textarea
                  rows={2}
                  value={closedMessageBnInput}
                  onChange={(e) => setClosedMessageBnInput(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 focus:border-emerald-500 focus:outline-hidden"
                  placeholder="বাংলায় নোটিশ লিখুন..."
                />
              </div>
            </div>

            {/* 3. REGISTRATION FEES */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Former Student Fee (BDT)
                </label>
                <input
                  type="number"
                  value={formerFeeInput}
                  onChange={(e) => setFormerFeeInput(Number(e.target.value))}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-emerald-500 focus:outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Current Student Fee (BDT)
                </label>
                <input
                  type="number"
                  value={currentFeeInput}
                  onChange={(e) => setCurrentFeeInput(Number(e.target.value))}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-emerald-500 focus:outline-hidden"
                  required
                />
              </div>
            </div>

            {/* 4. EVENT DATE & COUNTDOWN CONFIGURATION */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  {language === 'bn' ? 'কাউন্টডাউন ও পুনর্মিলনী তারিখ কনফিগারেশন' : 'Countdown & Event Schedule'}
                </h3>
                <p className="text-xs text-slate-500">
                  {language === 'bn'
                    ? 'পুনর্মিলনী শুরুর তারিখ অনুযায়ী হোমপেজের কাউন্টডাউন স্বয়ংক্রিয়ভাবে চলবে।'
                    : 'The homepage countdown automatically ticks towards this date and time.'}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Event Date & Time (ISO format)
                  </label>
                  <input
                    type="text"
                    value={eventTargetDateInput}
                    onChange={(e) => setEventTargetDateInput(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-mono focus:border-emerald-500 focus:outline-hidden"
                    placeholder="2026-12-25T09:00:00"
                    required
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Confirmed: Dec 25, 2026 at 09:00 AM
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Registration Deadline
                  </label>
                  <input
                    type="text"
                    value={endDateInput}
                    onChange={(e) => setEndDateInput(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-mono focus:border-emerald-500 focus:outline-hidden"
                    placeholder="2026-12-15"
                    required
                  />
                </div>
              </div>

              {/* POST EVENT SIMULATION SWITCH */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>
                      {language === 'bn'
                        ? 'ইভেন্ট পরবর্তী অবস্থা টেস্ট (Simulate Post-Event)'
                        : 'Simulate Post-Event Mode'}
                    </span>
                  </span>
                  <p className="text-[11px] text-slate-500">
                    {language === 'bn'
                      ? 'চালু করলে হোমপেজের কাউন্টডাউন সমাপ্ত দেখিয়ে গ্যালারি, ভিডিও ও স্মরণিকার লিঙ্ক প্রদর্শন করবে।'
                      : 'Switches the homepage countdown to the completed state with memories & souvenir links.'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setSimulateEventCompletedInput(!simulateEventCompletedInput)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    simulateEventCompletedInput
                      ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                      : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  }`}
                >
                  {simulateEventCompletedInput ? 'Active (ইভেন্ট সমাপ্ত)' : 'Inactive (কাউন্টডাউন চালু)'}
                </button>
              </div>
            </div>

            <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Home page sections
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Hide sections or change their display order, then save the settings.
                </p>
              </div>
              <ol className="space-y-2">
                {homePageSectionsInput.map((section, index) => (
                  <li
                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3"
                    key={section.id}
                  >
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        checked={section.visible}
                        onChange={() => toggleHomePageSection(section.id)}
                        type="checkbox"
                      />
                      <span>{homePageSectionLabels[section.id]}</span>
                    </label>
                    <div className="flex items-center gap-1">
                      <button
                        aria-label={`Move ${homePageSectionLabels[section.id]} up`}
                        className="rounded p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                        disabled={index === 0}
                        onClick={() => moveHomePageSection(section.id, -1)}
                        type="button"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button
                        aria-label={`Move ${homePageSectionLabels[section.id]} down`}
                        className="rounded p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                        disabled={index === homePageSectionsInput.length - 1}
                        onClick={() => moveHomePageSection(section.id, 1)}
                        type="button"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            <div className="pt-2">
              <button
                type="submit"
                className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md transition-colors cursor-pointer flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                <span>
                  {language === 'bn' ? 'সকল কনফিগারেশন সংরক্ষণ করুন' : 'Save All Settings & Apply Live'}
                </span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 5: PAYMENTS */}
      {activeTab === 'payments' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-slate-900">{t.tabPayments}</h2>
            <button
              onClick={() => exportToCSV(registrations, 'PLSCF_Reunion_Payments')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{t.btnExportCsv}</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <th className="py-2.5 px-3">Transaction ID</th>
                  <th className="py-2.5 px-3">Student Name</th>
                  <th className="py-2.5 px-3">Method</th>
                  <th className="py-2.5 px-3">Amount</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {registrations.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                      {r.transactionId}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-900">{r.fullName}</td>
                    <td className="py-2.5 px-3 uppercase font-semibold text-slate-600">
                      {r.paymentMethod}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-emerald-700">৳{r.totalPaid}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
                        {r.paymentStatus}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">
                      {new Date(r.registeredAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 6: DONATIONS */}
      {activeTab === 'donations' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold text-slate-900">{t.tabDonations}</h2>
              <p className="text-xs text-slate-500">
                Patrons and alumni financial contributions (Supabase table: {getDonationsTableName(selectedYear)}).
              </p>
            </div>
            <button
              onClick={() => exportToCSV(donations, `PLSCF_Donations_${selectedYear}`)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{t.btnExportCsv}</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <th className="py-2.5 px-3">Donor Name</th>
                  <th className="py-2.5 px-3">Purpose</th>
                  <th className="py-2.5 px-3">Amount</th>
                  <th className="py-2.5 px-3">Method</th>
                  <th className="py-2.5 px-3">Transaction</th>
                  <th className="py-2.5 px-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {donations.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3">
                      <span className="font-bold text-slate-900 block">{d.donorName}</span>
                      <span className="text-[10px] text-slate-400">{d.mobileNumber}</span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">{d.purpose}</td>
                    <td className="py-2.5 px-3 font-bold text-emerald-700">৳{d.amount.toLocaleString()}</td>
                    <td className="py-2.5 px-3 uppercase text-slate-600">{d.paymentMethod}</td>
                    <td className="py-2.5 px-3 font-mono text-[10px] text-slate-500">{d.transactionId}</td>
                    <td className="py-2.5 px-3 text-slate-400">{d.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 7: T-SHIRTS */}
      {activeTab === 'tshirts' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{t.tabTShirts}</h2>
            <p className="text-xs text-slate-500">
              Live inventory distribution tracking. Click on status to toggle delivered.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {tshirtSizes.map((size) => (
              <div key={size} className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
                <span className="text-xs font-bold text-slate-500 block uppercase">Size {size}</span>
                <span className="text-2xl font-black text-slate-900 block mt-1">{tshirtCounts[size] || 0}</span>
                <span className="text-[10px] text-emerald-600 font-semibold">Ordered</span>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <th className="py-2.5 px-3">Student Name</th>
                  <th className="py-2.5 px-3">Reg ID</th>
                  <th className="py-2.5 px-3">Size</th>
                  <th className="py-2.5 px-3">Delivery Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {registrations.map((reg) => (
                  <tr key={reg.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-medium text-slate-900">{reg.fullName}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-500">{reg.id}</td>
                    <td className="py-2.5 px-3 font-bold">{reg.tShirtSize}</td>
                    <td className="py-2.5 px-3">
                      <button
                        onClick={() => handleToggleTShirtCollected(reg.id, reg.isTShirtCollected)}
                        className={`px-2.5 py-1 rounded text-xs font-bold cursor-pointer ${
                          reg.isTShirtCollected
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {reg.isTShirtCollected ? '✓ Handed Over' : '⏳ Pending Collection'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 8: QR TICKETS */}
      {activeTab === 'tickets' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{t.tabTickets}</h2>
            <p className="text-xs text-slate-500">
              Verified digital tickets issued to registered students.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {registrations.map((reg) => (
              <div key={reg.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-slate-800">{reg.id}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase">
                    {reg.paymentStatus}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <img
                    src={reg.photoUrl}
                    alt={reg.fullName}
                    className="w-12 h-12 rounded-lg object-cover border border-slate-200"
                  />
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs">{reg.fullName}</h4>
                    <span className="text-[11px] text-slate-500 block">{reg.batchName}</span>
                    <span className="text-[10px] text-slate-400">T-Shirt: {reg.tShirtSize}</span>
                  </div>
                </div>
                <button
                  onClick={() => onSelectTicket && onSelectTicket(reg)}
                  className="w-full py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
                >
                  View Digital Pass
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 9: STAFF ROLES */}
      {activeTab === 'staff' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{t.tabStaff}</h2>
            <p className="text-xs text-slate-500">
              Gate operators, supervisors, and administrative officers.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <th className="py-2.5 px-3">Username</th>
                  <th className="py-2.5 px-3">Officer Name</th>
                  <th className="py-2.5 px-3">Assigned Gate</th>
                  <th className="py-2.5 px-3">Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {INITIAL_STAFF_USERS.map((st) => (
                  <tr key={st.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-800">{st.username}</td>
                    <td className="py-2.5 px-3 font-medium text-slate-900">{st.fullName}</td>
                    <td className="py-2.5 px-3 text-slate-600">{st.gateAssigned}</td>
                    <td className="py-2.5 px-3 font-bold uppercase text-[10px] text-emerald-700">{st.role}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 10: FINANCES */}
      {activeTab === 'finances' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold text-slate-900">{t.tabFinances}</h2>
              <p className="text-xs text-slate-500">
                Audit trail of event procurement, venue construction, acoustic and souvenir costs.
              </p>
            </div>
            <button
              onClick={() => setShowAddExpenseModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Record Expense Voucher</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <th className="py-2.5 px-3">Voucher Ref</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Reason / Description</th>
                  <th className="py-2.5 px-3">Officer</th>
                  <th className="py-2.5 px-3">Amount</th>
                  <th className="py-2.5 px-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-800">{exp.receiptRef}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-700">{exp.category}</td>
                    <td className="py-2.5 px-3 text-slate-600">{exp.reason}</td>
                    <td className="py-2.5 px-3 text-slate-500">{exp.responsiblePerson}</td>
                    <td className="py-2.5 px-3 font-bold text-rose-600">৳{exp.amount.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-slate-400">{exp.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 11: NOTICES & MEDIA */}
      {activeTab === 'notices' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold text-slate-900">{t.tabNoticesAdmin}</h2>
              <p className="text-xs text-slate-500">
                Publish bulletins, schedule updates, and emergency security advisories.
              </p>
            </div>
            <button
              onClick={() => {
                setEditingNoticeId(null);
                setNoticeTitleEn('');
                setNoticeTitleBn('');
                setNoticeCategory('general');
                setNoticeContentEn('');
                setNoticeContentBn('');
                setShowAddNoticeModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Publish Notice</span>
            </button>
          </div>

          <div className="space-y-3">
            {notices.map((n) => (
              <div key={n.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    {n.category}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400">{n.date}</span>
                    <button
                      type="button"
                      onClick={() => handleEditNotice(n)}
                      className="rounded-md p-1 text-slate-500 hover:bg-slate-200"
                      aria-label={`Edit notice: ${n.titleEn}`}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteNotice(n.id)}
                      className="rounded-md p-1 text-rose-600 hover:bg-rose-100"
                      aria-label={`Delete notice: ${n.titleEn}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <h4 className="font-bold text-slate-900 text-sm">
                  {language === 'bn' ? n.titleBn : n.titleEn}
                </h4>
                <p className="text-xs text-slate-600">
                  {language === 'bn' ? n.contentBn : n.contentEn}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 12: EXPORT & AUDIT REPORTS */}
      {activeTab === 'reports' && (
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6 max-w-3xl">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{t.tabReports}</h2>
            <p className="text-xs text-slate-500">
              Download comprehensive administrative datasets for event audit and government reporting.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={() => exportToCSV(registrations, `PLSCF_All_Registrations_${selectedYear}`)}
              className="p-5 rounded-2xl border-2 border-slate-200 hover:border-emerald-600 text-left transition-all cursor-pointer space-y-2 group"
            >
              <Download className="w-6 h-6 text-emerald-600 group-hover:scale-110 transition-transform" />
              <h4 className="font-bold text-slate-900 text-sm">Export Registrations CSV</h4>
              <p className="text-xs text-slate-500">
                All attendee personal details, batches, T-shirt sizes, and payment records.
              </p>
            </button>

            <button
              onClick={() => exportToCSV(donations, `PLSCF_Donations_${selectedYear}`)}
              className="p-5 rounded-2xl border-2 border-slate-200 hover:border-emerald-600 text-left transition-all cursor-pointer space-y-2 group"
            >
              <Download className="w-6 h-6 text-emerald-600 group-hover:scale-110 transition-transform" />
              <h4 className="font-bold text-slate-900 text-sm">Export Donations CSV</h4>
              <p className="text-xs text-slate-500">
                Complete patron contribution ledger with transaction references.
              </p>
            </button>
          </div>
        </div>
      )}

        </main>
      </div>

      {/* MODAL: ADD EXPENSE */}
      {showAddExpenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-slate-900 text-sm">Record Expense Voucher</h3>
              <button
                onClick={() => setShowAddExpenseModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddExpense} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                <select
                  value={expenseCategory}
                  onChange={(e) => setExpenseCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:border-emerald-500 focus:outline-hidden"
                >
                  <option>Food & Grand Banquet</option>
                  <option>Stage & Acoustic System</option>
                  <option>T-Shirts & Bags</option>
                  <option>Souvenir Magazine & Badges</option>
                  <option>Security & Volunteer Logistics</option>
                  <option>Cultural Artists & Band Honorarium</option>
                  <option>Miscellaneous</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Amount (BDT)</label>
                <input
                  type="number"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  placeholder="e.g. 50000"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:border-emerald-500 focus:outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reason / Description</label>
                <textarea
                  rows={2}
                  value={expenseReason}
                  onChange={(e) => setExpenseReason(e.target.value)}
                  placeholder="Details of expense..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:border-emerald-500 focus:outline-hidden"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Officer</label>
                  <input
                    type="text"
                    value={expenseOfficer}
                    onChange={(e) => setExpenseOfficer(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Voucher #</label>
                  <input
                    type="text"
                    value={expenseReceipt}
                    onChange={(e) => setExpenseReceipt(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-xs cursor-pointer"
              >
                Save Expense Record
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD NOTICE */}
      {showAddNoticeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-slate-900 text-sm">
                {editingNoticeId ? 'Edit Official Notice' : 'Publish New Official Notice'}
              </h3>
              <button
                onClick={() => {
                  setShowAddNoticeModal(false);
                  setEditingNoticeId(null);
                }}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddNotice} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notice Title (English)</label>
                <input
                  type="text"
                  value={noticeTitleEn}
                  onChange={(e) => setNoticeTitleEn(e.target.value)}
                  placeholder="e.g. Schedule Update..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:border-emerald-500 focus:outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notice Title (বাংলা)</label>
                <input
                  type="text"
                  value={noticeTitleBn}
                  onChange={(e) => setNoticeTitleBn(e.target.value)}
                  placeholder="বাংলা শিরোনাম..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:border-emerald-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                <select
                  value={noticeCategory}
                  onChange={(e) => setNoticeCategory(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                >
                  <option value="general">General</option>
                  <option value="registration">Registration</option>
                  <option value="event">Event Schedule</option>
                  <option value="payment">Payment</option>
                  <option value="emergency">Emergency Security</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Content (English)</label>
                <textarea
                  rows={2}
                  value={noticeContentEn}
                  onChange={(e) => setNoticeContentEn(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Content (বাংলা)</label>
                <textarea
                  rows={2}
                  value={noticeContentBn}
                  onChange={(e) => setNoticeContentBn(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-xs cursor-pointer"
              >
                {editingNoticeId ? 'Save Notice' : 'Publish Live Notice'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT STUDENT */}
      {showEditStudentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-slate-900 text-sm">
                Edit Attendee: {showEditStudentModal.id}
              </h3>
              <button
                onClick={() => setShowEditStudentModal(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={showEditStudentModal.fullName}
                  onChange={(e) =>
                    setShowEditStudentModal({ ...showEditStudentModal, fullName: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile Number</label>
                <input
                  type="text"
                  value={showEditStudentModal.mobileNumber}
                  onChange={(e) =>
                    setShowEditStudentModal({ ...showEditStudentModal, mobileNumber: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">T-Shirt Size</label>
                  <select
                    value={showEditStudentModal.tShirtSize}
                    onChange={(e) =>
                      setShowEditStudentModal({
                        ...showEditStudentModal,
                        tShirtSize: e.target.value as any,
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                  >
                    {tshirtSizes.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Status</label>
                  <select
                    value={showEditStudentModal.paymentStatus}
                    onChange={(e) =>
                      setShowEditStudentModal({
                        ...showEditStudentModal,
                        paymentStatus: e.target.value as any,
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                  >
                    <option value="paid">paid</option>
                    <option value="pending">pending</option>
                    <option value="refunded">refunded</option>
                  </select>
                </div>
              </div>

              <button
                onClick={() => {
                  AppStore.updateRegistration(
                    showEditStudentModal.id,
                    showEditStudentModal,
                    selectedYear
                  );
                  setShowEditStudentModal(null);
                  refreshAll();
                }}
                className="w-full py-2.5 rounded-xl bg-[#172554] hover:bg-[#263B8C] text-white font-bold text-xs shadow-xs cursor-pointer transition-colors"
              >
                Save Changes (Supabase & Local)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: MANDATORY AUDIT POP-UP BEFORE DELETING BOOKING */}
      {bookingToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border-2 border-rose-300 space-y-4">
            <div className="flex items-center gap-2.5 text-rose-800 border-b border-rose-100 pb-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center text-rose-700 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-base">
                  {language === 'bn' ? 'বুকিং মুছে ফেলার কারণ ও নিশ্চিতকরণ' : 'Confirm Registration Deletion'}
                </h3>
                <span className="text-[11px] text-rose-600 font-medium">
                  {language === 'bn' ? 'স্থায়ী অপনোদন এবং অডিট লগ এন্ট্রি' : 'Permanent Removal & Audit Log Recording'}
                </span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Registration ID:</span>
                <span className="font-mono font-bold text-slate-900">{bookingToDelete.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Student Name:</span>
                <span className="font-bold text-slate-900">{bookingToDelete.fullName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Category & Mobile:</span>
                <span className="text-slate-700">
                  {bookingToDelete.category === 'former' ? 'Alumni' : 'Current'} • {bookingToDelete.mobileNumber}
                </span>
              </div>
              {bookingToDelete.studentId && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Linked Student ID:</span>
                  <span className="font-mono font-bold text-[#263B8C]">{bookingToDelete.studentId}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Amount Paid:</span>
                <span className="font-bold text-emerald-700">৳ {bookingToDelete.totalPaid} BDT</span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {language === 'bn'
                ? 'এই বুকিং মুছে ফেলার পূর্বে পরিবর্তনের সঠিক কারণ উল্লেখ করা আবশ্যক। কারণ উল্লেখ ব্যতিরেকে বুকিং মুছে ফেলা যাবে না।'
                : 'Before this booking can be deleted or refunded, you must explain the specific reason. This explanation will be permanently recorded in the administrative security audit log.'}
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                {language === 'bn' ? 'মুছে ফেলার কারণ লিখুন (বাধ্যতামূলক) *' : 'Why are you deleting this booking? (Mandatory) *'}
              </label>
              <textarea
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                rows={3}
                placeholder={
                  language === 'bn'
                    ? 'উদা: শিক্ষার্থীর ব্যক্তিগত অনুরোধে বাতিল / ডুপ্লিকেট বুকিং / পেমেন্ট ব্যর্থ...'
                    : 'e.g. Canceled at student request, duplicate booking, payment failed verification...'
                }
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white text-slate-900"
                required
              />
              {!deleteReason.trim() && (
                <span className="text-[10px] text-rose-600 mt-1 block font-medium">
                  {language === 'bn'
                    ? 'মুছে ফেলার বাটন সচল করতে কারণ লিখুন।'
                    : 'Please provide a reason to enable the delete button.'}
                </span>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setBookingToDelete(null);
                  setDeleteReason('');
                }}
                disabled={isDeletingBooking}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-semibold text-xs cursor-pointer hover:bg-slate-50 transition-colors"
              >
                {language === 'bn' ? 'বাতিল' : 'Cancel'}
              </button>

              <button
                type="button"
                onClick={handleConfirmDeleteBooking}
                disabled={!deleteReason.trim() || isDeletingBooking}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-xs flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>
                  {isDeletingBooking
                    ? language === 'bn'
                      ? 'মুছে ফেলা হচ্ছে...'
                      : 'Deleting...'
                    : language === 'bn'
                    ? 'বুকিং স্থায়ীভাবে মুছে ফেলুন'
                    : 'Confirm & Delete Booking'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
