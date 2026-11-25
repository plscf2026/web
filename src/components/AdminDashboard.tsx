import { useState, useEffect, lazy, Suspense } from 'react';
import {
  Shield,
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
  CreditCard,
  Layers,
  Menu,
  X,
  UserPlus,
  Camera,
  CheckCircle2,
  Clock,
  Utensils,
  DoorOpen,
  DoorClosed,
  AlertOctagon,
  RotateCcw,
  Award,
  Eye,
  EyeOff,
  Heart,
  Crown,
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
  DressDistributionRecord,
  FoodDistributionRecord,
  GateEventRecord,
  HomePageSectionId,
  HomePageSectionSetting,
  DEFAULT_HOME_PAGE_SECTIONS,
  reconcileHomePageSections,
  PortalRole,
  normalizePortalRole,
  getPortalRoleFromSlug,
  getPortalConfigByRole,
} from '../types';
import { RoleLoginPage } from './auth/RoleLoginPage';
import { RoleDirectoryPortal } from './auth/RoleDirectoryPortal';
import { AccessDeniedGate } from './auth/AccessDeniedGate';
import { subscribeToAuthSync } from '../services/authSync';
import { translations } from '../i18n/translations';
import { AppStore, INITIAL_STAFF_USERS } from '../services/store';
import { calculateFinancialSummary } from '../utils/rules';
import {
  SupabaseService,
  SUPABASE_PROJECT_ID,
  getRegistrationsTableName,
  getDonationsTableName,
  isDevTestBypassAllowed,
  supabase,
} from '../services/supabase';
import { MasterEventOverview } from './admin/MasterEventOverview';
import { BudgetManagementTab } from './admin/BudgetManagementTab';
import { DailyAnalyticsTab } from './admin/DailyAnalyticsTab';
import { StaffManagementTab } from './admin/StaffManagementTab';
import { AuditHistoryTab } from './admin/AuditHistoryTab';
import { StudentIdManagementTab } from './admin/StudentIdManagementTab';
import { MealTimeScannerControlPanel } from './admin/MealTimeScannerControlPanel';
import { RegistrationDonationControlPanel } from './admin/RegistrationDonationControlPanel';
import { StudentIdService } from '../services/studentIdStore';
import { EventStore } from '../services/eventStore';
import { IdCardStore } from '../services/idCardStore';
import { FinancialService } from '../services/financialService';
import { GlobalPagination } from './common/GlobalPagination';
import { paginate } from '../utils/pagination';
import { ErrorBoundary } from './common/ErrorBoundary';
import { ManualRegistrationTab } from './admin/manual/ManualRegistrationTab';
import { ManualApprovalTab } from './admin/manual/ManualApprovalTab';
import { UserAccessManagementTab } from './admin/UserAccessManagementTab';
import { AdminStudentPhotoModal } from './admin/photos/AdminStudentPhotoModal';
import { ThankYouCardModal } from './ThankYouCardModal';
// Heavy administrative portals loaded lazily to preserve bundle performance
const IdCardManagementPortal = lazy(() =>
  import('./admin/idcard/IdCardManagementPortal').then((m) => ({ default: m.IdCardManagementPortal }))
);
const GateScannerModule = lazy(() =>
  import('./GateScannerModule').then((m) => ({ default: m.GateScannerModule }))
);
const GalleryManagementTab = lazy(() =>
  import('./admin/GalleryManagementTab').then((m) => ({ default: m.GalleryManagementTab }))
);
const CommitteeManagementTab = lazy(() =>
  import('./admin/CommitteeManagementTab').then((m) => ({ default: m.CommitteeManagementTab }))
);
const GuestManagementTab = lazy(() =>
  import('./admin/guest/GuestManagementTab').then((m) => ({ default: m.GuestManagementTab }))
);
const StaffCardManagementTab = lazy(() =>
  import('./admin/staffCard/StaffCardManagementTab').then((m) => ({ default: m.StaffCardManagementTab }))
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
  portalRole?: PortalRole;
  activeView?: string;
  onNavigateHome?: () => void;
  onNavigateScanner?: () => void;
  onSwitchPortal?: (targetRole: PortalRole, toDashboard?: boolean) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  language,
  onSelectTicket,
  portalRole,
  activeView,
  onNavigateHome,
  onNavigateScanner,
  onSwitchPortal,
}) => {
  const t = translations[language];

  // Active portal role resolution from props, URL or session
  const [activePortalRole, setActivePortalRole] = useState<PortalRole | undefined>(() => {
    if (portalRole) return portalRole;
    if (typeof window !== 'undefined') {
      try {
        const sp = new URLSearchParams(window.location.search);
        const roleParam = sp.get('role');
        const parsed = getPortalRoleFromSlug(roleParam);
        if (parsed) return parsed;
        const saved = sessionStorage.getItem('plscf_current_portal_role');
        if (saved) return getPortalRoleFromSlug(saved) || undefined;
      } catch (_) {}
    }
    return undefined;
  });

  useEffect(() => {
    if (portalRole && portalRole !== activePortalRole) {
      setActivePortalRole(portalRole);
    }
  }, [portalRole]);

  // ==========================================
  // SINGLE-SLOT ADMIN AUTHENTICATION STATE
  // ==========================================
  const [adminSession, setAdminSession] = useState<AdminAccount | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState<boolean>(true);
  const [quarantineError, setQuarantineError] = useState<string | null>(null);
  const [isRetryingLogout, setIsRetryingLogout] = useState<boolean>(false);

  // Dev bypass enabled only in local development
  const isDevBypass = isDevTestBypassAllowed();

  // Cross-tab authentication synchronization listener
  useEffect(() => {
    const unsubscribe = subscribeToAuthSync((event) => {
      if (event.action === 'LOGOUT') {
        setAdminSession(null);
        setIsLoadingSession(false);
        setQuarantineError(null);
      }
    });
    return unsubscribe;
  }, []);

  // Check session on mount and handle RBAC prefill / auto-login
  useEffect(() => {
    let isMounted = true;
    async function checkSession() {
      try {
        setIsLoadingSession(true);
        // Check for RBAC role-selection handoff from Footer
        const prefillUser = sessionStorage.getItem('plscf_admin_prefill_user');
        const targetTab = sessionStorage.getItem('plscf_admin_active_tab');
        const autoLogin = sessionStorage.getItem('plscf_admin_auto_login');

        if (targetTab) {
          setActiveTab(targetTab as any);
        }

        if (prefillUser) {
          sessionStorage.removeItem('plscf_admin_prefill_user');

          if (isDevBypass && autoLogin === 'true') {
            sessionStorage.removeItem('plscf_admin_auto_login');
            const res = await SupabaseService.loginAdmin(prefillUser, 'admin@123');
            if (res.success && res.account && isMounted) {
              setAdminSession(res.account);
              setIsLoadingSession(false);
              return;
            }
          }
        }

        const session = await SupabaseService.getActiveAdminSession();
        if (isMounted) {
          setAdminSession(session);
        }
      } catch (err) {
        console.error('Error checking admin session:', err);
      } finally {
        if (isMounted) {
          setIsLoadingSession(false);
        }
      }
    }

    checkSession();

    // Supabase reactive auth state listener to restore session on token refresh or sign-in
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, authSession) => {
      if (!isMounted) return;
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
        if (authSession?.user) {
          const session = await SupabaseService.getActiveAdminSession();
          if (isMounted && session) {
            setAdminSession(session);
            setIsLoadingSession(false);
          }
        }
      } else if (event === 'SIGNED_OUT') {
        if (isMounted) {
          setAdminSession(null);
          setIsLoadingSession(false);
        }
      }
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, [isDevBypass]);

  // Handle Log Out
  const handleLogout = async () => {
    try {
      await SupabaseService.logoutAdmin();
    } catch (err) {
      console.error('Admin logout failed:', err);
    }
    setAdminSession(null);
    try {
      sessionStorage.removeItem('plscf_current_portal_role');
      sessionStorage.removeItem('plscf_admin_active_tab');
    } catch (_) {}
  };

  // Handle portal switching with strict session isolation
  const handleSwitchPortalWithIsolation = async (targetRole: PortalRole, toDashboard = false) => {
    if (adminSession && targetRole !== adminSession.role) {
      const res = await SupabaseService.terminateAdministrativeSession();
      if (!res.success) {
        setQuarantineError(res.error || 'Server-side sign-out unconfirmed');
        return;
      }
      setAdminSession(null);
    }
    setQuarantineError(null);
    setActivePortalRole(targetRole);
    onSwitchPortal?.(targetRole, toDashboard);
  };

  // Handle returning to the public Home page with strict session termination
  const handleNavigateHomeWithIsolation = async () => {
    if (adminSession) {
      await SupabaseService.terminateAdministrativeSession({ forceLocal: true });
      setAdminSession(null);
    }
    setQuarantineError(null);
    if (onNavigateHome) {
      onNavigateHome();
    } else if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  // ==========================================
  // DASHBOARD DATA STATE
  // ==========================================
  type AdminTab =
    | 'overview'
    | 'userAccessManagement'
    | 'guestManagement'
    | 'staffCardManagement'
    | 'idCardManagement'
    | 'manualRegistration'
    | 'manualApproval'
    | 'masterOverview'
    | 'budgetManagement'
    | 'dailyAnalytics'
    | 'staffManagement'
    | 'auditHistory'
    | 'allBookings'
    | 'gateManagement'
    | 'securityAudit'
    | 'studentIds'
    | 'registrations'
    | 'feeSettings'
    | 'registrationControl'
    | 'mealControl'
    | 'payments'
    | 'donations'
    | 'tshirts'
    | 'tickets'
    | 'staff'
    | 'finances'
    | 'notices'
    | 'galleryManagement'
    | 'committeeManagement'
    | 'reports';

  const isSuperAdmin = adminSession?.role === 'super_admin';
  const effectiveAdmin: AdminAccount = adminSession || {
    id: 'admin_master',
    username: 'admin',
    fullName: 'Venue Admin',
    email: 'admin@gmail.com',
    role: 'super_admin',
    createdAt: new Date().toISOString(),
  };

  const [activeTab, setActiveTab] = useState<AdminTab>(() => {
    if (typeof window !== 'undefined') {
      try {
        const sp = new URLSearchParams(window.location.search);
        const tabParam = sp.get('tab');
        if (tabParam && tabParam !== 'reunionManagement') return tabParam as AdminTab;
        const saved = sessionStorage.getItem('plscf_admin_active_tab');
        if (saved && saved !== 'reunionManagement') return saved as AdminTab;
      } catch (_) {}
    }
    return 'overview';
  });

  const handleTabChange = (tabId: AdminTab) => {
    setActiveTab(tabId);
    try {
      sessionStorage.setItem('plscf_admin_active_tab', tabId);
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tabId);
      window.history.replaceState({ ...window.history.state, tab: tabId }, '', url.toString());
    } catch (_) {}
  };
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [navSearchQuery, setNavSearchQuery] = useState('');

  // Delete Booking Confirmation State (pop-up with mandatory reason)
  const [bookingToDelete, setBookingToDelete] = useState<RegistrationRecord | null>(null);
  const [deleteReason, setDeleteReason] = useState<string>('');
  const [isDeletingBooking, setIsDeletingBooking] = useState<boolean>(false);

  // Gate Access Control Alert Modal for Admin / Super Admin attempting to distribute to NOT_ENTERED or BACK attendees
  const [gateBlockedAlert, setGateBlockedAlert] = useState<{
    studentName: string;
    studentId: string;
    gateStatus: 'BACK' | 'NOT_ENTERED';
    itemType: 'T-Shirt' | 'Breakfast' | 'Lunch' | 'Dinner';
    registration: RegistrationRecord;
  } | null>(null);

  // Consolidated Registration Database Table (registrations_2027)
  const selectedYear = 2027;
  const [isFetchingFromSupabase, setIsFetchingFromSupabase] = useState<boolean>(false);
  const [supabaseTableUsed, setSupabaseTableUsed] = useState<string>(
    getRegistrationsTableName(2027)
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
  const [dressDistributions, setDressDistributions] = useState<DressDistributionRecord[]>(() =>
    EventStore.getDressDistributions()
  );
  const [foodDistributions, setFoodDistributions] = useState<FoodDistributionRecord[]>(() =>
    EventStore.getFoodDistributions()
  );
  const [gateEvents, setGateEvents] = useState<GateEventRecord[]>(() =>
    EventStore.getGateEvents()
  );

  // Search & Column Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'former' | 'current'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'pending' | 'refunded'>('all');
  const [gateFilter, setGateFilter] = useState<'all' | 'entry' | 'back' | 'not_entered' | 'in' | 'out'>('all');
  const [foodFilter, setFoodFilter] = useState<string>('all');
  const [tshirtFilter, setTshirtFilter] = useState<'all' | 'given' | 'pending'>('all');
  const [tshirtSizeFilter, setTshirtSizeFilter] = useState<string>('all');
  const [batchFilter, setBatchFilter] = useState<string>('all');

  // Global Pagination States (Default 10 per page, dynamic 10/20/30/40 selector)
  const [regPage, setRegPage] = useState(1);
  const [regPageSize, setRegPageSize] = useState(10);

  const [payPage, setPayPage] = useState(1);
  const [payPageSize, setPayPageSize] = useState(10);

  const [donationsPage, setDonationsPage] = useState(1);
  const [donationsPageSize, setDonationsPageSize] = useState(10);
  const [donationsSearchQuery, setDonationsSearchQuery] = useState('');
  const [donationsPurposeFilter, setDonationsPurposeFilter] = useState('ALL');
  const [isRefreshingDonations, setIsRefreshingDonations] = useState(false);

  useEffect(() => {
    setDonationsPage(1);
  }, [donationsSearchQuery, donationsPurposeFilter, selectedYear]);

  const refreshDonationsFromCloud = async () => {
    setIsRefreshingDonations(true);
    try {
      const res = await SupabaseService.fetchDonations(selectedYear);
      if (res.data) {
        setDonations(res.data);
        AppStore.saveDonations(res.data);
      }
    } catch (err) {
      console.warn('Error refreshing donations from Supabase:', err);
    } finally {
      setIsRefreshingDonations(false);
    }
  };

  const handleDeleteDonation = async (d: DonationRecord) => {
    const confirmMsg = language === 'bn'
      ? `আপনি কি নিশ্চিত যে ${d.donorName}-এর অনুদান রেকর্ডটি (${d.id}) ডিলিট করতে চান?`
      : `Are you sure you want to delete donation ${d.id} from ${d.donorName}?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      await supabase.from('donations').delete().eq('id', d.id);
      await supabase.from('donations_2027').delete().eq('id', d.id);
      const updated = donations.filter((item) => item.id !== d.id);
      setDonations(updated);
      AppStore.saveDonations(updated);
    } catch (err: any) {
      alert(err?.message || 'Failed to delete donation');
    }
  };

  const [tshirtPage, setTshirtPage] = useState(1);
  const [tshirtPageSize, setTshirtPageSize] = useState(10);

  const [ticketsPage, setTicketsPage] = useState(1);
  const [ticketsPageSize, setTicketsPageSize] = useState(10);

  const [staffPage, setStaffPage] = useState(1);
  const [staffPageSize, setStaffPageSize] = useState(10);

  const [expensesPage, setExpensesPage] = useState(1);
  const [expensesPageSize, setExpensesPageSize] = useState(10);

  const [noticesPage, setNoticesPage] = useState(1);
  const [noticesPageSize, setNoticesPageSize] = useState(10);

  // Automatically reset registrations to page 1 whenever search, filters, or year change
  useEffect(() => {
    setRegPage(1);
  }, [searchTerm, categoryFilter, statusFilter, selectedYear]);

  // Modals
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [showAddNoticeModal, setShowAddNoticeModal] = useState(false);
  const [editingNoticeId, setEditingNoticeId] = useState<string | null>(null);
  const [showEditStudentModal, setShowEditStudentModal] = useState<RegistrationRecord | null>(null);
  const [selectedStudentForPhoto, setSelectedStudentForPhoto] = useState<RegistrationRecord | null>(null);

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
    () => reconcileHomePageSections(feeSettings.homePageSections)
  );
  const [endDateInput, setEndDateInput] = useState(feeSettings.endDate || '2026-12-15');
  const [hideDonationAmountsInput, setHideDonationAmountsInput] = useState<boolean>(
    Boolean(feeSettings.hideDonationAmounts)
  );
  const [selectedCardDonation, setSelectedCardDonation] = useState<DonationRecord | null>(null);
  const [settingsSuccessNotice, setSettingsSuccessNotice] = useState(false);

  // Super Admin direct privacy toggle for Donors Hall of Fame
  const handleToggleHideDonationAmounts = () => {
    const updated: FeeSettings = {
      ...feeSettings,
      hideDonationAmounts: !feeSettings.hideDonationAmounts,
    };
    AppStore.saveFeeSettings(updated);
    setFeeSettings(updated);
    setHideDonationAmountsInput(Boolean(updated.hideDonationAmounts));
  };

  // Fetch registrations from Supabase for selected year
  const fetchSupabaseRegistrationsForYear = async (year: number, forceRefresh = false) => {
    setIsFetchingFromSupabase(true);
    try {
      const res = await SupabaseService.fetchRegistrations(year, { forceRefresh });
      setSupabaseTableUsed(res.tableUsed);
      const deletedIds = AppStore.getDeletedRegistrationIds();

      if (res.data) {
        // Supabase is authoritative: mirror cloud state and filter out tombstoned IDs
        const validCloudData = res.data.filter((r) => !deletedIds.has(r.id));
        setRegistrations(validCloudData);
        AppStore.saveRegistrations(validCloudData);
        IdCardStore.syncWithRegistrations();
        // Circular event dispatch removed here: network fetch completion must NEVER re-trigger event listeners
      }
    } catch (err) {
      console.warn('Error fetching registrations from Supabase:', err);
    } finally {
      setIsFetchingFromSupabase(false);
    }
  };

  useEffect(() => {
    fetchSupabaseRegistrationsForYear(selectedYear);
    SupabaseService.fetchDonations(selectedYear).then((res) => {
      if (res.data && res.data.length > 0) {
        setDonations(res.data);
        AppStore.saveDonations(res.data);
      }
    }).catch((err) => console.warn('Error fetching donations from Supabase on mount:', err));
  }, [selectedYear]);

  // Real-time bidirectional synchronization for staff stations (Food, Dress, Gate, Check-in)
  useEffect(() => {
    EventStore.initRealtimeSync();
    EventStore.syncDistributionsWithSupabase();

    const handleSync = () => {
      syncLocalState();
    };

    window.addEventListener('plscf_all_stations_synced', handleSync);
    window.addEventListener('plscf_food_sync', handleSync);
    window.addEventListener('plscf_dress_sync', handleSync);
    window.addEventListener('plscf_gate_sync', handleSync);
    window.addEventListener('plscf_registration_updated', handleSync);

    return () => {
      window.removeEventListener('plscf_all_stations_synced', handleSync);
      window.removeEventListener('plscf_food_sync', handleSync);
      window.removeEventListener('plscf_dress_sync', handleSync);
      window.removeEventListener('plscf_gate_sync', handleSync);
      window.removeEventListener('plscf_registration_updated', handleSync);
    };
  }, []);

  // RBAC & Portal Configuration Resolution (Unconditional Hook Compliance)
  const userAccountRole = adminSession?.role ? normalizePortalRole(adminSession.role) : undefined;
  const targetPortalRole = activePortalRole ? normalizePortalRole(activePortalRole) : userAccountRole;
  const isSuperAdminAccount = adminSession?.role === 'super_admin';
  const isAuthorizedForPortal = isSuperAdminAccount || (Boolean(userAccountRole) && userAccountRole === targetPortalRole);
  const effectivePortalRole: PortalRole = targetPortalRole || 'admin';
  const currentPortalConfig = getPortalConfigByRole(effectivePortalRole);

  // Auto-redirect if activeTab is not permitted for this role
  useEffect(() => {
    if (adminSession && !isSuperAdminAccount) {
      if (!currentPortalConfig.allowedTabs.includes(activeTab as any)) {
        setActiveTab(currentPortalConfig.defaultTab as any);
      }
    }
  }, [adminSession, isSuperAdminAccount, currentPortalConfig, activeTab]);

  // Synchronize component state with local storage & event stores without network overhead
  const syncLocalState = () => {
    const freshRegs = AppStore.getRegistrations();
    const freshDonations = AppStore.getDonations();
    const freshExpenses = AppStore.getExpenses();
    const freshSettings = AppStore.getFeeSettings();
    const freshNotices = AppStore.getNotices();
    const freshScanLogs = AppStore.getScanLogs();
    const freshDress = EventStore.getDressDistributions();
    const freshFood = EventStore.getFoodDistributions();
    const freshGate = EventStore.getGateEvents();

    setRegistrations(freshRegs);
    setDonations(freshDonations);
    setExpenses(freshExpenses);
    setFeeSettings(freshSettings);
    setNotices(freshNotices);
    setScanLogs(freshScanLogs);
    setDressDistributions(freshDress);
    setFoodDistributions(freshFood);
    setGateEvents(freshGate);

    setFormerFeeInput(freshSettings.formerStudentFee);
    setCurrentFeeInput(freshSettings.currentStudentFee);
    setRegistrationOpenInput(freshSettings.registrationOpen);
    setClosedMessageEnInput(freshSettings.closedMessageEn || '');
    setClosedMessageBnInput(freshSettings.closedMessageBn || '');
    setEventTargetDateInput(freshSettings.eventTargetDate || '2027-01-29T09:00:00');
    setSimulateEventCompletedInput(Boolean(freshSettings.simulateEventCompleted));
    setHomePageSectionsInput(reconcileHomePageSections(freshSettings.homePageSections));
    setEndDateInput(freshSettings.endDate || '2026-12-15');
  };

  // Explicit refresh from Supabase cloud database (e.g. when user clicks Refresh button)
  const refreshAll = async () => {
    await Promise.allSettled([
      fetchSupabaseRegistrationsForYear(selectedYear, true),
      EventStore.syncDistributionsWithSupabase(),
    ]);
    SupabaseService.fetchDonations(selectedYear).then((res) => {
      if (res.data && res.data.length > 0) {
        setDonations(res.data);
        AppStore.saveDonations(res.data);
      }
    }).catch((err) => console.warn('Error fetching donations from Supabase in refreshAll:', err));

    syncLocalState();
  };

  const isTShirtGiven = (reg: RegistrationRecord): boolean => {
    if (reg.isTShirtCollected) return true;
    return dressDistributions.some(
      (d) =>
        (d.registrationId === reg.id || (reg.studentId && d.registrationId === reg.studentId)) &&
        d.status === 'RECEIVED'
    );
  };

  const isMealCollected = (reg: RegistrationRecord, mealType: 'breakfast' | 'lunch' | 'dinner'): boolean => {
    return foodDistributions.some(
      (d) =>
        (d.registrationId === reg.id || (reg.studentId && d.registrationId === reg.studentId)) &&
        d.mealType === mealType &&
        d.status === 'COLLECTED'
    );
  };

  const getStudentGateStatus = (reg: RegistrationRecord): 'NOT_ENTERED' | 'ENTRY' | 'BACK' => {
    const events = gateEvents.filter(
      (e) =>
        (e.registrationId === reg.id || (reg.studentId && e.registrationId === reg.studentId)) &&
        e.status === 'APPROVED'
    );
    if (events.length > 0) {
      const type = events[0].eventType;
      if (type === 'ENTRY') return 'ENTRY';
      if (type === 'BACK' || type === 'EXIT') return 'BACK';
    }
    if (reg.gateStatus === 'BACK') return 'BACK';
    if (reg.gateStatus === 'ENTRY' || reg.isCheckedIn) return 'ENTRY';
    return 'NOT_ENTERED';
  };

  const isStudentInside = (reg: RegistrationRecord): boolean => {
    return getStudentGateStatus(reg) === 'ENTRY';
  };

  const handleToggleGateAttendance = async (
    reg: RegistrationRecord,
    currentGateStatus: 'NOT_ENTERED' | 'ENTRY' | 'BACK'
  ) => {
    const nextIsInside = currentGateStatus !== 'ENTRY';
    const nextGateStatus: 'ENTRY' | 'BACK' = nextIsInside ? 'ENTRY' : 'BACK';

    // 1. Optimistic UI update on registrations state
    setRegistrations((prev) =>
      prev.map((r) =>
        r.id === reg.id ? { ...r, isCheckedIn: nextIsInside, gateStatus: nextGateStatus } : r
      )
    );
    AppStore.updateRegistration(
      reg.id,
      { isCheckedIn: nextIsInside, gateStatus: nextGateStatus },
      selectedYear
    );

    // 2. Authoritative Supabase update via toggleGateAttendance
    await SupabaseService.toggleGateAttendance(
      reg.id,
      nextIsInside,
      effectiveAdmin.id,
      effectiveAdmin.fullName
    );

    // 3. Update EventStore gate events
    const res = EventStore.recordGateEvent(
      reg.id,
      reg.fullName,
      reg.batchName,
      reg.photoUrl,
      nextGateStatus,
      'Gate 01 - Main Entrance',
      'ADMIN-DASHBOARD',
      effectiveAdmin.id,
      effectiveAdmin.fullName,
      undefined
    );

    if (res.event) {
      setGateEvents(EventStore.getGateEvents());
    }

    // 4. Cross-tab & window event broadcast
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('plscf_gate_sync', { detail: res.event }));
      window.dispatchEvent(
        new CustomEvent('plscf_registration_updated', {
          detail: { id: reg.id, isCheckedIn: nextIsInside, gateStatus: nextGateStatus },
        })
      );
    }
    EventStore.broadcastStationEvent('plscf_gate_sync', { regId: reg.id, isInside: nextIsInside, gateStatus: nextGateStatus });
    EventStore.broadcastStationEvent('plscf_registration_updated', {
      id: reg.id,
      isCheckedIn: nextIsInside,
      gateStatus: nextGateStatus,
    });
  };

  const registrationsForYear = registrations.filter(
    (registration) => (registration.year ?? 2027) === selectedYear
  );
  const genuineRegistrations = registrationsForYear.filter((r) => !r.isDemo);
  const financial = calculateFinancialSummary(genuineRegistrations, donations, expenses);
  const homePageSectionLabels: Record<HomePageSectionId, string> = {
    hero: language === 'bn' ? 'মূল ইভেন্ট ব্যানার (Main event banner)' : 'Main event banner',
    featureCards: language === 'bn' ? 'কুইক ফিচার কার্ডসমূহ (Quick Feature Cards)' : 'Quick Feature Cards (Notices, Gallery, Helpdesk)',
    pillarsRibbon: language === 'bn' ? 'পুনর্মিলনী বার্তা ও ক্যাম্পাস রিবন' : 'Reunion Core Pillars & Campus Ribbon',
    countdown: language === 'bn' ? 'কাউন্টডাউন (Countdown)' : 'Countdown',
    status: language === 'bn' ? 'নিবন্ধন স্ট্যাটাস অনুসন্ধান (Registration status lookup)' : 'Registration status lookup',
    fees: language === 'bn' ? 'নিবন্ধন ফি (Registration fees)' : 'Registration fees',
    financials: language === 'bn' ? 'আর্থিক স্বচ্ছতা ড্যাশবোর্ড (Financial Transparency Dashboard)' : 'Financial Transparency Dashboard',
    notices: language === 'bn' ? 'সর্বশেষ নোটিশ (Latest notices)' : 'Latest notices',
    gallery: language === 'bn' ? 'ফটো ও ভিডিও প্রিভিউ (Photo and video preview)' : 'Photo and video preview',
    committee: language === 'bn' ? 'আয়োজক পরিচালনা কমিটি (Organizing committee)' : 'Organizing committee',
  };

  const uniqueBatches = Array.from(
    new Set(registrationsForYear.map((r) => r.batchName).filter(Boolean))
  ).sort();

  const activeFilterCount =
    (searchTerm.trim() !== '' ? 1 : 0) +
    (categoryFilter !== 'all' ? 1 : 0) +
    (statusFilter !== 'all' ? 1 : 0) +
    (gateFilter !== 'all' ? 1 : 0) +
    (foodFilter !== 'all' ? 1 : 0) +
    (tshirtFilter !== 'all' ? 1 : 0) +
    (tshirtSizeFilter !== 'all' ? 1 : 0) +
    (batchFilter !== 'all' ? 1 : 0);

  const handleResetFilters = () => {
    setSearchTerm('');
    setCategoryFilter('all');
    setStatusFilter('all');
    setGateFilter('all');
    setFoodFilter('all');
    setTshirtFilter('all');
    setTshirtSizeFilter('all');
    setBatchFilter('all');
    setRegPage(1);
  };

  // Filtered registrations for selected year with comprehensive column filters
  const filteredRegistrations = registrationsForYear.filter((r) => {
    const matchSearch =
      r.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.mobileNumber.includes(searchTerm) ||
      r.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.batchName.toLowerCase().includes(searchTerm.toLowerCase());

    const matchCategory = categoryFilter === 'all' || r.category === categoryFilter;
    const matchStatus = statusFilter === 'all' || r.paymentStatus === statusFilter;

    // Gate Attendance Filter (ENTRY / BACK / NOT_ENTERED)
    const gStatus = getStudentGateStatus(r);
    const matchGate =
      gateFilter === 'all' ||
      (gateFilter === 'entry' && gStatus === 'ENTRY') ||
      (gateFilter === 'in' && gStatus === 'ENTRY') ||
      (gateFilter === 'back' && gStatus === 'BACK') ||
      (gateFilter === 'out' && gStatus !== 'ENTRY') ||
      (gateFilter === 'not_entered' && gStatus === 'NOT_ENTERED');

    // Food Distribution Filter
    const bTaken = isMealCollected(r, 'breakfast');
    const lTaken = isMealCollected(r, 'lunch');
    const dTaken = isMealCollected(r, 'dinner');
    let matchFood = true;
    if (foodFilter === 'all_taken') matchFood = bTaken && lTaken && dTaken;
    else if (foodFilter === 'any_taken') matchFood = bTaken || lTaken || dTaken;
    else if (foodFilter === 'none_taken') matchFood = !bTaken && !lTaken && !dTaken;
    else if (foodFilter === 'breakfast_taken') matchFood = bTaken;
    else if (foodFilter === 'breakfast_pending') matchFood = !bTaken;
    else if (foodFilter === 'lunch_taken') matchFood = lTaken;
    else if (foodFilter === 'lunch_pending') matchFood = !lTaken;
    else if (foodFilter === 'dinner_taken') matchFood = dTaken;
    else if (foodFilter === 'dinner_pending') matchFood = !dTaken;

    // T-Shirt Distribution Filter
    const tGiven = isTShirtGiven(r);
    const matchTShirt =
      tshirtFilter === 'all' ||
      (tshirtFilter === 'given' && tGiven) ||
      (tshirtFilter === 'pending' && !tGiven);

    // T-Shirt Size Filter
    const matchSize = tshirtSizeFilter === 'all' || r.tShirtSize === tshirtSizeFilter;

    // Batch Filter
    const matchBatch = batchFilter === 'all' || r.batchName === batchFilter;

    return (
      matchSearch &&
      matchCategory &&
      matchStatus &&
      matchGate &&
      matchFood &&
      matchTShirt &&
      matchSize &&
      matchBatch
    );
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
  const handleSaveFeeSettings = (e: React.SyntheticEvent) => {
    e.preventDefault();
    const currentLatest = AppStore.getFeeSettings();
    const updated: FeeSettings = {
      ...currentLatest,
      ...feeSettings,
      formerStudentFee: Number(formerFeeInput),
      currentStudentFee: Number(currentFeeInput),
      registrationOpen: Boolean(registrationOpenInput),
      alumniRegistrationOpen: currentLatest.alumniRegistrationOpen !== false,
      currentStudentRegistrationOpen: currentLatest.currentStudentRegistrationOpen !== false,
      donationOpen: currentLatest.donationOpen !== false,
      closedMessageEn: closedMessageEnInput,
      closedMessageBn: closedMessageBnInput,
      donationClosedMessageEn: currentLatest.donationClosedMessageEn,
      donationClosedMessageBn: currentLatest.donationClosedMessageBn,
      eventTargetDate: eventTargetDateInput,
      simulateEventCompleted: Boolean(simulateEventCompletedInput),
      homePageSections: homePageSectionsInput,
      endDate: endDateInput,
      hideDonationAmounts: Boolean(hideDonationAmountsInput),
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

  const handleAddExpense = (e: React.SyntheticEvent) => {
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

    // Asynchronously record into Supabase expenses and financial audit logs
    FinancialService.recordExpense(
      {
        category_id: 'cat-other',
        category: expenseCategory,
        amount: Number(expenseAmount),
        expense_date: new Date().toISOString().split('T')[0],
        description: expenseReason,
        responsible_person: expenseOfficer,
        voucher_number: expenseReceipt,
      },
      { id: adminSession?.id || 'admin', name: adminSession?.fullName || 'Administrator' },
      `Expense voucher recorded by ${adminSession?.fullName || 'Administrator'}: ${expenseReason}`
    ).catch(() => {});

    setShowAddExpenseModal(false);
    setExpenseAmount('');
    setExpenseReason('');
  };

  const handleAddNotice = (e: React.SyntheticEvent) => {
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

  const handleToggleTShirtCollected = async (regId: string, current: boolean) => {
    const nextStatus = !current;
    const targetReg = registrations.find((r) => r.id === regId);

    // GATE ENTRY ACCESS CONTROL: Admin and Super Admin cannot give T-shirt if student is NOT_ENTERED or BACK
    if (nextStatus && targetReg) {
      const gateStatus = getStudentGateStatus(targetReg);
      if (gateStatus !== 'ENTRY') {
        setGateBlockedAlert({
          studentName: targetReg.fullName,
          studentId: targetReg.id,
          gateStatus,
          itemType: 'T-Shirt',
          registration: targetReg,
        });
        return;
      }
    }

    // 1. Optimistic UI update
    setRegistrations((prev) =>
      prev.map((r) => (r.id === regId ? { ...r, isTShirtCollected: nextStatus } : r))
    );
    AppStore.updateRegistration(regId, { isTShirtCollected: nextStatus }, selectedYear);

    // 2. Authoritative Supabase toggle via SECURITY DEFINER RPC
    await SupabaseService.toggleTShirtDistribution(
      regId,
      nextStatus,
      effectiveAdmin.id,
      effectiveAdmin.fullName
    );

    // 3. Update EventStore dress distributions
    if (nextStatus) {
      const targetReg = registrations.find((r) => r.id === regId);
      if (targetReg) {
        EventStore.confirmDressDistribution(
          regId,
          targetReg.fullName,
          'reunion_tshirt',
          targetReg.tShirtSize || 'L',
          effectiveAdmin.id,
          effectiveAdmin.fullName,
          'Admin Manual Toggle'
        );
      }
    } else {
      const dList = EventStore.getDressDistributions();
      const match = dList.find((d) => d.registrationId === regId);
      if (match) {
        EventStore.adminCorrectDressDistribution(
          match.id,
          'RETURNED',
          match.registeredSize,
          'Admin toggled to Pending',
          effectiveAdmin.id,
          effectiveAdmin.fullName
        );
      }
      const remaining = EventStore.getDressDistributions().filter((d) => d.registrationId !== regId);
      EventStore.saveDressDistributions(remaining);
    }

    setDressDistributions(EventStore.getDressDistributions());

    // 4. Cross-tab & window event broadcast
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('plscf_dress_sync'));
      window.dispatchEvent(new CustomEvent('plscf_registration_updated'));
    }
    EventStore.broadcastStationEvent('plscf_dress_sync', { regId, isCollected: nextStatus });
    EventStore.broadcastStationEvent('plscf_registration_updated', { id: regId, isTShirtCollected: nextStatus });
  };

  const handleToggleFoodDistribution = async (
    reg: RegistrationRecord,
    mealType: 'breakfast' | 'lunch' | 'dinner'
  ) => {
    const current = isMealCollected(reg, mealType);
    const nextStatus = !current;

    // GATE ENTRY ACCESS CONTROL: Admin and Super Admin cannot give meals if student is NOT_ENTERED or BACK
    if (nextStatus) {
      const gateStatus = getStudentGateStatus(reg);
      if (gateStatus !== 'ENTRY') {
        const itemLabel = mealType === 'breakfast' ? 'Breakfast' : mealType === 'lunch' ? 'Lunch' : 'Dinner';
        setGateBlockedAlert({
          studentName: reg.fullName,
          studentId: reg.id,
          gateStatus,
          itemType: itemLabel,
          registration: reg,
        });
        return;
      }
    }

    // 1. Authoritative Supabase toggle via SECURITY DEFINER RPC
    await SupabaseService.toggleFoodDistribution(
      reg.id,
      mealType,
      nextStatus,
      effectiveAdmin.id,
      effectiveAdmin.fullName,
      reg.batchName || 'General'
    );

    // 2. Update EventStore
    if (nextStatus) {
      EventStore.confirmFoodDistribution(
        reg.id,
        reg.fullName,
        reg.batchName || 'General',
        mealType,
        effectiveAdmin.id,
        effectiveAdmin.fullName,
        'Admin Dashboard Manual Toggle'
      );
    } else {
      const fList = EventStore.getFoodDistributions();
      const match = fList.find(
        (d) => (d.registrationId === reg.id || d.registrationId === reg.studentId) && d.mealType === mealType
      );
      if (match) {
        EventStore.adminCorrectFoodDistribution(
          match.id,
          'CANCELLED',
          'Admin toggled meal to Pending',
          effectiveAdmin.id,
          effectiveAdmin.fullName
        );
      }
      const remaining = EventStore.getFoodDistributions().filter(
        (d) => !((d.registrationId === reg.id || d.registrationId === reg.studentId) && d.mealType === mealType)
      );
      EventStore.saveFoodDistributions(remaining);
    }

    setFoodDistributions(EventStore.getFoodDistributions());

    // 3. Broadcast instant event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('plscf_food_sync'));
    }
    EventStore.broadcastStationEvent('plscf_food_sync', { regId: reg.id, mealType, collected: nextStatus });
  };

  const handleConfirmDeleteBooking = async () => {
    if (!bookingToDelete || !deleteReason.trim()) return;
    setIsDeletingBooking(true);

    try {
      const regId = bookingToDelete.id;
      const studentId = bookingToDelete.studentId;

      // 1. Mark as tombstoned and delete from local storage immediately
      AppStore.markRegistrationDeleted(regId);
      AppStore.deleteRegistration(regId, selectedYear);

      // 2. Immediately remove from React state so UI updates without delay
      setRegistrations((prev) => prev.filter((r) => r.id !== regId));

      // 3. Clean up ID Card cache
      IdCardStore.removeCardByRegistrationId(regId);

      // 4. If student ID was used or reserved, release/reset it back to AVAILABLE
      if (studentId) {
        StudentIdService.releaseReservation(studentId);
      }

      // 5. Authoritatively delete from Supabase Database (both RPC & direct delete)
      await SupabaseService.deleteRegistration(
        regId,
        deleteReason.trim(),
        adminSession,
        selectedYear
      );

      // 6. Record audit trail in EventStore
      EventStore.recordAuditHistory({
        adminId: adminSession?.id || 'SUPER_ADMIN',
        adminName: adminSession?.fullName || adminSession?.username || 'Super Administrator',
        entityType: 'REGISTRATION',
        entityId: regId,
        action: 'DELETE_REGISTRATION',
        reason: deleteReason.trim(),
      });
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
  // VIEW 0: AUTHENTICATION LOADING STATE (Supabase session restoring)
  // ==========================================
  if (isLoadingSession) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-8 text-center" role="status" aria-label="Loading Admin Session">
        <div className="w-12 h-12 rounded-full border-4 border-sky-100 border-t-sky-600 animate-spin mb-4 shadow-xs" />
        <p className="text-sm font-semibold text-slate-700 animate-pulse tracking-wide">
          {language === 'bn' ? 'অ্যাডমিন সেশন যাচাই করা হচ্ছে...' : 'Restoring admin session...'}
        </p>
        <p className="text-xs text-slate-400 mt-1">
          {language === 'bn' ? 'অনুগ্রহ করে অপেক্ষা করুন' : 'Verifying credentials with secure server'}
        </p>
      </div>
    );
  }

  // ==========================================
  // VIEW 0.5: FAILED LOGOUT QUARANTINE GATE (Requirement #3)
  // Blocks destination administrative portal until clean unauthenticated state is achieved
  // ==========================================
  if (quarantineError) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4 sm:p-8 font-satoshi">
        <div className="max-w-md w-full bg-slate-900 border border-amber-500/40 rounded-3xl p-6 sm:p-8 text-center text-white space-y-4 shadow-2xl">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div>
            <span className="text-[10px] font-black tracking-widest uppercase px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
              {language === 'bn' ? 'সার্ভার সাইন-আউট অসমাপ্ত' : 'Server Sign-Out Unconfirmed'}
            </span>
            <h2 className="text-xl font-black mt-2">
              {language === 'bn' ? 'সুপাবেস সেশন প্রত্যাহার নিশ্চিত নয়' : 'Revocation Confirmation Pending'}
            </h2>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              {language === 'bn'
                ? 'নেটওয়ার্ক বা সার্ভার ত্রুটির কারণে সুপাবেস অথেন্টিকেশন সার্ভারের সাথে সংযোগ বিচ্ছিন্ন হয়েছে। অন্য প্রশাসনিক পোর্টালে প্রবেশের পূর্বে সার্ভার সাইন-আউট পুনরায় চেষ্টা করুন অথবা লোকাল সেশন মুছে হোমে ফিরে যান।'
                : 'Unable to confirm session revocation with the Supabase authentication server (Network / Server Error). Access to the destination administrative portal is quarantined until an unauthenticated state is verified.'}
            </p>
            <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-rose-300 font-mono text-[11px] mt-3 break-all">
              {quarantineError}
            </div>
          </div>
          <div className="space-y-2 pt-2">
            <button
              type="button"
              disabled={isRetryingLogout}
              onClick={async () => {
                setIsRetryingLogout(true);
                const res = await SupabaseService.terminateAdministrativeSession();
                setIsRetryingLogout(false);
                if (res.success) {
                  setQuarantineError(null);
                  setAdminSession(null);
                  if (activePortalRole) {
                    onSwitchPortal?.(activePortalRole, false);
                  }
                } else {
                  setQuarantineError(res.error || 'Server sign-out failed again.');
                }
              }}
              className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRetryingLogout ? 'animate-spin' : ''}`} />
              <span>{language === 'bn' ? 'সাইন-আউট পুনরায় চেষ্টা করুন (Retry)' : 'Retry Server Sign-Out'}</span>
            </button>
            <button
              type="button"
              onClick={async () => {
                await SupabaseService.terminateAdministrativeSession({ forceLocal: true });
                setQuarantineError(null);
                setAdminSession(null);
                if (onNavigateHome) {
                  onNavigateHome();
                } else if (typeof window !== 'undefined') {
                  window.location.href = '/';
                }
              }}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors border border-slate-700"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-400" />
              <span>{language === 'bn' ? 'ফোর্স লোকাল সাইন-আউট ও হোমপেজে যান' : 'Force Local Sign-Out & Return Home'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Check if current route is an admin portal/gate view (/admin or /admin/:role)
  const isAdminGateRoute =
    activeView === 'admin' ||
    (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin'));

  // ==========================================
  // VIEW 1: AUTHENTICATION GATE (ROLE-SPECIFIC LOGIN PORTAL)
  // Shown when not logged in, OR when visiting an /admin gate for a role not yet authorized
  // ==========================================
  const shouldShowLoginPage = !adminSession || (isAdminGateRoute && !isAuthorizedForPortal);

  if (shouldShowLoginPage) {
    if (activePortalRole) {
      return (
        <RoleLoginPage
          role={activePortalRole}
          language={language}
          currentAccount={adminSession || undefined}
          onLoginSuccess={(account) => {
            setAdminSession(account);
            if (isAdminGateRoute) {
              onSwitchPortal?.(activePortalRole, true);
            }
          }}
          onSwitchPortal={(targetRole) => {
            handleSwitchPortalWithIsolation(targetRole, false);
          }}
          onNavigateHome={handleNavigateHomeWithIsolation}
          onNavigateScanner={onNavigateScanner}
          onNavigateAuthorized={() => {
            const authorizedRole = userAccountRole || 'admin';
            setActivePortalRole(authorizedRole);
            onSwitchPortal?.(authorizedRole, true);
          }}
        />
      );
    }

    return (
      <RoleDirectoryPortal
        language={language}
        onSelectRole={(role) => {
          handleSwitchPortalWithIsolation(role, false);
        }}
        onNavigateHome={handleNavigateHomeWithIsolation}
        onNavigateScanner={onNavigateScanner}
      />
    );
  }

  // ==========================================
  // VIEW 1.5: ROLE AUTHORIZATION ACCESS DENIED GUARD (URL Tampering Protection)
  // Only triggers when attempting to access a protected dashboard view directly
  // ==========================================
  if (activePortalRole && !isAuthorizedForPortal) {
    return (
      <AccessDeniedGate
        currentAccount={adminSession}
        requiredRole={activePortalRole}
        language={language}
        onNavigateAuthorized={() => {
          const authorizedRole = userAccountRole || 'admin';
          setActivePortalRole(authorizedRole);
          onSwitchPortal?.(authorizedRole, true);
        }}
        onLogoutAndSwitch={async () => {
          const res = await SupabaseService.terminateAdministrativeSession();
          if (!res.success) {
            setQuarantineError(res.error || 'Server-side sign-out unconfirmed');
          } else {
            setAdminSession(null);
            setQuarantineError(null);
            onSwitchPortal?.(activePortalRole, false);
          }
        }}
        onNavigateHome={handleNavigateHomeWithIsolation}
      />
    );
  }

  interface NavigationTabItem {
    id: AdminTab;
    label: string;
    icon: any;
    category: 'operations' | 'credentials' | 'finance' | 'admin' | 'media';
    highlight?: boolean;
    badge?: string;
    badgeColor?: 'emerald' | 'amber' | 'indigo' | 'sky' | 'rose' | 'violet' | 'teal' | 'blue';
  }

  const allNavigationTabs: NavigationTabItem[] = [
    // 1. Operations & Gate
    {
      id: 'masterOverview',
      label: language === 'bn' ? 'মাস্টার ইভেন্ট ওভারভিউ' : 'Event Master Overview',
      icon: Sparkles,
      category: 'operations',
    },
    {
      id: 'gateManagement',
      label: language === 'bn' ? 'গেইট কন্ট্রোল ও স্ক্যানার' : 'Gate Entry & Scanner',
      icon: DoorOpen,
      category: 'operations',
      highlight: true,
      badge: 'LIVE',
      badgeColor: 'emerald',
    },
    {
      id: 'manualRegistration',
      label: language === 'bn' ? 'ভেন্যু শিক্ষার্থী নিবন্ধন' : 'Venue Registration Desk',
      icon: UserPlus,
      category: 'operations',
      highlight: true,
      badge: 'Desk',
      badgeColor: 'sky',
    },
    ...(isSuperAdminAccount || currentPortalConfig.allowedTabs.includes('manualApproval' as any)
      ? [
          {
            id: 'manualApproval' as const,
            label: language === 'bn' ? 'ম্যানুয়াল নিবন্ধন অনুমোদন' : 'Registration Approvals',
            icon: ShieldCheck,
            category: 'operations' as const,
            highlight: true,
            badge: 'Admin',
            badgeColor: 'amber' as const,
          },
        ]
      : []),
    ...(isSuperAdminAccount || currentPortalConfig.allowedTabs.includes('mealControl' as any)
      ? [
          {
            id: 'mealControl' as const,
            label: language === 'bn' ? 'খাবার সময়সূচী ও স্ক্যানার' : 'Meal Time & Scanner Control',
            icon: Clock,
            category: 'operations' as const,
            highlight: true,
            badge: 'Food',
            badgeColor: 'amber' as const,
          },
        ]
      : []),
    {
      id: 'allBookings',
      label: language === 'bn' ? 'সকল বুকিং ডেটাবেজ' : 'All Bookings Database',
      icon: Database,
      category: 'operations',
    },

    // 2. Credentials & Passes
    {
      id: 'idCardManagement',
      label: language === 'bn' ? 'শিক্ষার্থী আইডি কার্ড' : 'Student ID Cards',
      icon: CreditCard,
      category: 'credentials',
      highlight: true,
      badge: 'Cards',
      badgeColor: 'indigo',
    },
    {
      id: 'studentIds',
      label: language === 'bn' ? 'স্টুডেন্ট আইডি ডেটাবেজ' : 'Student ID Database',
      icon: ShieldCheck,
      category: 'credentials',
    },
    ...(isSuperAdminAccount || currentPortalConfig.allowedTabs.includes('guestManagement' as any)
      ? [
          {
            id: 'guestManagement' as const,
            label: language === 'bn' ? 'ভিআইপি গেস্ট ও খাবার' : 'VIP Guest Pass & Meals',
            icon: Crown,
            category: 'credentials' as const,
            highlight: true,
            badge: 'VIP',
            badgeColor: 'amber' as const,
          },
        ]
      : []),
    ...(isSuperAdminAccount || currentPortalConfig.allowedTabs.includes('staffCardManagement' as any)
      ? [
          {
            id: 'staffCardManagement' as const,
            label: language === 'bn' ? 'স্টাফ কার্ড ও খাবার' : 'Staff Pass & Meal Suite',
            icon: Shield,
            category: 'credentials' as const,
            highlight: true,
            badge: 'Staff',
            badgeColor: 'emerald' as const,
          },
        ]
      : []),
    {
      id: 'tickets',
      label: language === 'bn' ? 'কিউআর টিকিট ভেরিফিকেশন' : 'QR Ticket Verification',
      icon: QrCode,
      category: 'credentials',
    },

    // 3. Finance & Analytics
    {
      id: 'budgetManagement',
      label: language === 'bn' ? 'বাজেট ও ব্যয় হিসাব' : 'Budget & Expenses',
      icon: DollarSign,
      category: 'finance',
    },
    {
      id: 'donations',
      label: language === 'bn' ? 'অনুদান ও ডোনার্স তালিকা' : 'Donations & Patrons',
      icon: Heart,
      category: 'finance',
      highlight: true,
      badge: 'Patrons',
      badgeColor: 'rose',
    },
    {
      id: 'dailyAnalytics',
      label: language === 'bn' ? 'দৈনিক অ্যানালিটিক্স' : 'Daily Analytics',
      icon: BarChart3,
      category: 'finance',
    },
    {
      id: 'reports',
      label: language === 'bn' ? 'এক্সপোর্ট ও রিপোর্টস' : 'Export & Reports',
      icon: Download,
      category: 'finance',
    },

    // 4. Security & Access
    ...(isSuperAdminAccount || currentPortalConfig.allowedTabs.includes('userAccessManagement' as any)
      ? [
          {
            id: 'userAccessManagement' as const,
            label: language === 'bn' ? 'ইউজার ও এক্সেস কন্ট্রোল' : 'User & Access Control',
            icon: Users,
            category: 'admin' as const,
            highlight: true,
            badge: 'RBAC',
            badgeColor: 'violet' as const,
          },
        ]
      : []),
    {
      id: 'staffManagement',
      label: language === 'bn' ? 'স্টাফ অ্যাকাউন্টস ও রোলস' : 'Staff Accounts & Roles',
      icon: Users,
      category: 'admin',
    },
    {
      id: 'auditHistory',
      label: language === 'bn' ? 'সিকিউরিটি অডিট ট্রেইল' : 'Security Audit Trail',
      icon: ShieldAlert,
      category: 'admin',
    },
    {
      id: 'feeSettings',
      label: language === 'bn' ? 'রেজিস্ট্রেশন, অনুদান ও সেটিংস' : 'Registration, Donation & Settings',
      icon: Settings,
      category: 'admin',
      highlight: true,
      badge: 'Controls',
      badgeColor: 'amber',
    },

    // 5. Media & Content
    {
      id: 'galleryManagement',
      label: language === 'bn' ? 'ফটো ও ভিডিও গ্যালারি' : 'Photo & Video Gallery',
      icon: Camera,
      category: 'media',
      highlight: true,
      badge: 'CMS',
      badgeColor: 'blue',
    },
    {
      id: 'committeeManagement',
      label: language === 'bn' ? 'পরিচালনা পরিষদ (১৬)' : 'Executive Committee (16)',
      icon: Award,
      category: 'media',
      highlight: true,
      badge: '16 Cards',
      badgeColor: 'teal',
    },
    {
      id: 'notices',
      label: language === 'bn' ? 'নোটিশ ও মিডিয়া পাবলিকেশন' : 'Notices & Media',
      icon: FileText,
      category: 'media',
    },
  ];

  const visibleNavTabs = isSuperAdminAccount
    ? allNavigationTabs
    : allNavigationTabs.filter((tab) => currentPortalConfig.allowedTabs.includes(tab.id as any));

  const navCategories = [
    { id: 'operations', title: language === 'bn' ? 'অপারেশনস ও গেইট' : 'Operations & Gate' },
    { id: 'credentials', title: language === 'bn' ? 'আইডি ও পাস' : 'Credentials & Passes' },
    { id: 'finance', title: language === 'bn' ? 'আর্থিক ও অ্যানালিটিক্স' : 'Finance & Analytics' },
    { id: 'admin', title: language === 'bn' ? 'সিকিউরিটি ও এক্সেস' : 'Security & Access' },
    { id: 'media', title: language === 'bn' ? 'মিডিয়া ও প্রকাশনা' : 'Media & Content' },
  ] as const;

  const filteredNavTabs = navSearchQuery.trim()
    ? visibleNavTabs.filter((tab) => {
        const q = navSearchQuery.toLowerCase().trim();
        return (
          tab.label.toLowerCase().includes(q) ||
          tab.id.toLowerCase().includes(q) ||
          (tab.badge && tab.badge.toLowerCase().includes(q))
        );
      })
    : visibleNavTabs;

  const getBadgeClasses = (color?: string, isActive?: boolean) => {
    if (isActive) {
      return 'bg-white/15 text-sky-200 border-white/20';
    }
    switch (color) {
      case 'emerald':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'amber':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'rose':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'violet':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'sky':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'teal':
        return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'indigo':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'blue':
      default:
        return 'bg-blue-50 text-blue-700 border-blue-200';
    }
  };

  const renderNavTabButton = (tab: (typeof allNavigationTabs)[number], onClickExtra?: () => void) => {
    const isActive = activeTab === tab.id;
    const Icon = tab.icon;
    return (
      <button
        key={tab.id}
        type="button"
        onClick={() => {
          handleTabChange(tab.id as any);
          if (onClickExtra) onClickExtra();
        }}
        className={`w-full group flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer ${
          isActive
            ? 'bg-slate-900 text-white shadow-sm ring-1 ring-slate-800 font-bold'
            : tab.highlight
            ? 'text-slate-700 bg-sky-50/50 hover:bg-sky-50 hover:text-sky-900'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0 pr-1.5">
          <Icon
            className={`w-4 h-4 shrink-0 transition-colors ${
              isActive
                ? 'text-sky-400'
                : tab.highlight
                ? 'text-sky-600 group-hover:text-sky-700'
                : 'text-slate-400 group-hover:text-slate-600'
            }`}
          />
          <span className="truncate tracking-tight text-left">{tab.label}</span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {tab.badge && (
            <span
              className={`text-[9px] font-bold px-1.5 py-0.5 rounded border leading-none inline-flex items-center gap-1 shrink-0 ${getBadgeClasses(
                tab.badgeColor,
                isActive
              )}`}
            >
              {tab.badge === 'LIVE' && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              )}
              {tab.badge}
            </span>
          )}
          {isActive ? (
            <ChevronRight className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          )}
        </div>
      </button>
    );
  };

  // ==========================================
  // VIEW 2: AUTHENTICATED CENTRAL COMMAND DASHBOARD
  // ==========================================
  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Admin Header with Supabase Connection Telemetry - Solid Obsidian */}
      <div className="bg-[#0F172A] text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full overflow-hidden bg-white p-0.5 border-2 border-[#0284C7] shadow-md shrink-0 hidden sm:flex items-center justify-center">
            <img
              src="/assets/school_logo.png"
              alt="Police Lines School & College Faridpur Emblem"
              className="w-full h-full object-contain rounded-full"
            />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[11px] font-bold text-[#38BDF8]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#38BDF8]" />
              <span>{adminSession.fullName}</span>
              <span className="text-slate-300 font-mono">(@{adminSession.username})</span>
            </span>

            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[11px] font-mono text-emerald-300">
              <Database className="w-3 h-3 text-emerald-400" />
              <span>Supabase: {SUPABASE_PROJECT_ID}</span>
            </span>

            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-950 border border-blue-800 text-[10px] font-bold uppercase text-[#C5A45D]">
              <Lock className="w-3 h-3 text-[#C5A45D]" />
              <span>{language === 'bn' ? currentPortalConfig.badgeLabelBn : currentPortalConfig.badgeLabelEn}</span>
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            {language === 'bn' ? currentPortalConfig.titleBn : currentPortalConfig.titleEn}
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            {language === 'bn' ? currentPortalConfig.taglineBn : currentPortalConfig.taglineEn}
          </p>
        </div>
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
        <aside className="hidden lg:flex flex-col w-72 xl:w-80 shrink-0 bg-white rounded-3xl p-3.5 border border-slate-200/90 shadow-sm sticky top-20 max-h-[calc(100vh-6rem)]">
          {/* Header Section */}
          <div className="px-2 pb-3 border-b border-slate-100 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[11px] font-black tracking-wide text-slate-800 uppercase block leading-tight">
                    {language === 'bn' ? currentPortalConfig.badgeLabelBn : currentPortalConfig.badgeLabelEn}
                  </span>
                  <span className="text-[10px] font-medium text-slate-400">
                    {language === 'bn' ? `${visibleNavTabs.length}টি মডিউল উপলব্ধ` : `${visibleNavTabs.length} active modules`}
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-mono font-bold bg-slate-900 text-sky-400 px-2 py-0.5 rounded-full shadow-xs">
                {currentPortalConfig.badgeLabelEn.split(' ')[0]}
              </span>
            </div>

            {/* Live Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={navSearchQuery}
                onChange={(e) => setNavSearchQuery(e.target.value)}
                placeholder={language === 'bn' ? 'মডিউল খুঁজুন...' : 'Search modules...'}
                className="w-full bg-slate-50 hover:bg-slate-100/80 focus:bg-white text-slate-900 text-xs rounded-xl pl-8 pr-7 py-1.5 border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-100 transition-all outline-hidden placeholder:text-slate-400"
              />
              {navSearchQuery && (
                <button
                  type="button"
                  onClick={() => setNavSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Navigation Items List with smooth scroll */}
          <div className="flex-1 overflow-y-auto pt-2 space-y-3 pr-1 scrollbar-thin">
            {navSearchQuery.trim() ? (
              /* Search Results Mode */
              filteredNavTabs.length === 0 ? (
                <div className="py-8 text-center px-2">
                  <p className="text-xs font-semibold text-slate-500">
                    {language === 'bn' ? 'কোনো মডিউল পাওয়া যায়নি' : 'No modules found'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setNavSearchQuery('')}
                    className="mt-2 text-[11px] font-bold text-sky-600 hover:underline cursor-pointer"
                  >
                    {language === 'bn' ? 'অনুসন্ধান মুছুন' : 'Clear search query'}
                  </button>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2.5 pb-1">
                    {language === 'bn' ? `ফলাফল (${filteredNavTabs.length})` : `Matches (${filteredNavTabs.length})`}
                  </div>
                  {filteredNavTabs.map((tab) => renderNavTabButton(tab))}
                </div>
              )
            ) : (
              /* Categorized Mode */
              navCategories.map((category) => {
                const categoryTabs = visibleNavTabs.filter((t) => t.category === category.id);
                if (categoryTabs.length === 0) return null;
                return (
                  <div key={category.id} className="space-y-1">
                    <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 px-2.5 pt-1 pb-1 flex items-center justify-between">
                      <span>{category.title}</span>
                      <span className="text-[9px] font-bold text-slate-400/80 bg-slate-100 rounded px-1.5 py-0.2">
                        {categoryTabs.length}
                      </span>
                    </div>
                    {categoryTabs.map((tab) => renderNavTabButton(tab))}
                  </div>
                );
              })
            )}
          </div>
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
            <div className="relative w-80 max-w-[85vw] bg-white h-full shadow-2xl p-4 flex flex-col z-10">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-900 block leading-tight">
                      {language === 'bn'
                        ? `${currentPortalConfig.badgeLabelBn} মডিউলসমূহ`
                        : `${currentPortalConfig.badgeLabelEn} Modules`}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {language === 'bn' ? `${visibleNavTabs.length}টি মডিউল` : `${visibleNavTabs.length} modules`}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileDrawerOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Mobile Drawer Search */}
              <div className="relative mb-3">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={navSearchQuery}
                  onChange={(e) => setNavSearchQuery(e.target.value)}
                  placeholder={language === 'bn' ? 'মডিউল খুঁজুন...' : 'Search modules...'}
                  className="w-full bg-slate-50 focus:bg-white text-slate-900 text-xs rounded-xl pl-8 pr-7 py-2 border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-100 transition-all outline-hidden placeholder:text-slate-400"
                />
                {navSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setNavSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Navigation Items List */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin">
                {navSearchQuery.trim() ? (
                  filteredNavTabs.length === 0 ? (
                    <div className="py-8 text-center px-2">
                      <p className="text-xs font-semibold text-slate-500">
                        {language === 'bn' ? 'কোনো মডিউল পাওয়া যায়নি' : 'No modules found'}
                      </p>
                      <button
                        type="button"
                        onClick={() => setNavSearchQuery('')}
                        className="mt-2 text-[11px] font-bold text-sky-600 hover:underline cursor-pointer"
                      >
                        {language === 'bn' ? 'অনুসন্ধান মুছুন' : 'Clear search query'}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2.5 pb-1">
                        {language === 'bn' ? `ফলাফল (${filteredNavTabs.length})` : `Matches (${filteredNavTabs.length})`}
                      </div>
                      {filteredNavTabs.map((tab) => renderNavTabButton(tab, () => setIsMobileDrawerOpen(false)))}
                    </div>
                  )
                ) : (
                  navCategories.map((category) => {
                    const categoryTabs = visibleNavTabs.filter((t) => t.category === category.id);
                    if (categoryTabs.length === 0) return null;
                    return (
                      <div key={category.id} className="space-y-1">
                        <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 px-2.5 pt-1 pb-1 flex items-center justify-between">
                          <span>{category.title}</span>
                          <span className="text-[9px] font-bold text-slate-400/80 bg-slate-100 rounded px-1.5 py-0.2">
                            {categoryTabs.length}
                          </span>
                        </div>
                        {categoryTabs.map((tab) => renderNavTabButton(tab, () => setIsMobileDrawerOpen(false)))}
                      </div>
                    );
                  })
                )}
              </div>
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
              <div className="w-8 h-8 rounded-xl bg-slate-900 text-sky-400 flex items-center justify-center shrink-0 shadow-xs">
                {(() => {
                  const CurrentIcon = visibleNavTabs.find((t) => t.id === activeTab)?.icon || Layers;
                  return <CurrentIcon className="w-4 h-4" />;
                })()}
              </div>
              <div className="truncate">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  {language === 'bn' ? 'বর্তমান সেকশন' : 'Current Section'}
                </span>
                <span className="text-xs font-black text-slate-900 truncate block">
                  {allNavigationTabs.find((t) => t.id === activeTab)?.label || activeTab}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsMobileDrawerOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shrink-0 transition-colors cursor-pointer shadow-xs"
            >
              <Menu className="w-4 h-4 text-sky-400" />
              <span>{language === 'bn' ? 'সকল মেনু' : 'All Modules'}</span>
            </button>
          </div>

      {/* TAB: STUDENT ID CARD MANAGEMENT SYSTEM */}
      {activeTab === 'idCardManagement' && (
        <ErrorBoundary>
          <Suspense fallback={<AdminTabFallback />}>
            <IdCardManagementPortal
              currentUserEmail={adminSession?.email || 'admin@gmail.com'}
              currentUserRole={adminSession?.role || 'super_admin'}
              isSuperAdmin={adminSession?.role === 'super_admin' || !adminSession}
            />
          </Suspense>
        </ErrorBoundary>
      )}

      {/* TAB: MANUAL STUDENT REGISTRATION (ADMIN VENUE ASSISTANCE) */}
      {activeTab === 'manualRegistration' && (
        <ErrorBoundary>
          <ManualRegistrationTab
            language={language}
            currentAdmin={effectiveAdmin}
          />
        </ErrorBoundary>
      )}

      {/* TAB: SUPER ADMIN MANUAL REGISTRATION & FINANCIAL APPROVAL PORTAL */}
      {activeTab === 'manualApproval' && isSuperAdmin && (
        <ErrorBoundary>
          <ManualApprovalTab
            language={language}
            currentAdmin={effectiveAdmin}
          />
        </ErrorBoundary>
      )}

      {/* TAB: CENTRALIZED ROLE-BASED USER MANAGEMENT DASHBOARD (SUPER ADMIN EXCLUSIVE) */}
      {activeTab === 'userAccessManagement' && isSuperAdmin && (
        <ErrorBoundary>
          <UserAccessManagementTab
            language={language}
            currentAdmin={effectiveAdmin}
          />
        </ErrorBoundary>
      )}

      {/* TAB: DYNAMIC GUEST PASS & FOOD MANAGEMENT SYSTEM */}
      {activeTab === 'guestManagement' && (
        <ErrorBoundary>
          <Suspense fallback={<AdminTabFallback />}>
            <GuestManagementTab
              language={language}
              currentAdmin={effectiveAdmin}
            />
          </Suspense>
        </ErrorBoundary>
      )}

      {/* TAB: DYNAMIC STAFF CARD & MEAL ENTITLEMENT SYSTEM */}
      {activeTab === 'staffCardManagement' && (
        <ErrorBoundary>
          <Suspense fallback={<AdminTabFallback />}>
            <StaffCardManagementTab
              language={language}
              currentAdmin={effectiveAdmin}
            />
          </Suspense>
        </ErrorBoundary>
      )}

      {/* TAB: MASTER EVENT OVERVIEW (PART 9) */}
      {activeTab === 'masterOverview' && (
        <MasterEventOverview
          language={language}
          registrations={registrations}
          onNavigateTab={(tab) => {
            if (tab === 'dailyRegAnalytics' || tab === 'dailyPayAnalytics') {
              handleTabChange('dailyAnalytics');
            } else if (tab === 'gateManagement') {
              handleTabChange('gateManagement');
            } else {
              handleTabChange(tab as any);
            }
          }}
        />
      )}

      {/* TAB: BUDGET & EXPENSE MANAGEMENT (PART 8) */}
      {activeTab === 'budgetManagement' && (
        <BudgetManagementTab
          adminId={adminSession?.id || effectiveAdmin.id}
          adminName={adminSession?.fullName || effectiveAdmin.fullName}
        />
      )}

      {/* TAB: DAILY REGISTRATION & PAYMENT ANALYTICS (PARTS 6 & 7) */}
      {activeTab === 'dailyAnalytics' && (
        <DailyAnalyticsTab language={language} registrations={registrations} />
      )}

      {/* TAB: STAFF ACCOUNTS & ROLE ISOLATION (PART 2) */}
      {activeTab === 'staffManagement' && (
        <StaffManagementTab currentAdminEmail={adminSession?.email || effectiveAdmin.email} />
      )}

      {/* TAB: PRIVILEGED OPERATIONS AUDIT TRAIL (PART 10) */}
      {activeTab === 'auditHistory' && (
        <AuditHistoryTab />
      )}

      {/* TAB: LIVE GATE ACCESS & SCANNER MANAGEMENT (Super Admin & Venue Admin) */}
      {activeTab === 'gateManagement' && (
        <div className="space-y-6">
          {/* Top Gate Status Overview Banner */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black shadow-md">
                  <DoorOpen className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
                      Live Gate Control
                    </span>
                    <span className="text-xs text-slate-400 font-mono">Grand Reunion 2027</span>
                  </div>
                  <h2 className="text-lg font-black text-slate-900 mt-0.5">
                    {language === 'bn' ? 'গেইট প্রবেশ ও প্রস্থান কন্ট্রোল পোর্টাল' : 'Gate Entry / Back Live Access Control'}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {language === 'bn'
                      ? 'রিয়েল-টাইম গেইট এন্ট্রি (সবুজ) ও ব্যাক (লাল) স্ট্যাটাস পর্যবেক্ষণ ও সুপার অ্যাডমিন সরাসরি স্ক্যানার।'
                      : 'Authoritative real-time Gate Entry (Green) & Back (Red) monitoring with live QR scanning and audit trail.'}
                  </p>
                </div>
              </div>

              {/* Quick Actions to All Bookings filtered by Gate */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setGateFilter('entry');
                    handleTabChange('allBookings');
                  }}
                  className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                  title="View all students currently inside venue"
                >
                  <Users className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{language === 'bn' ? 'ভেতরে উপস্থিত তালিকা (ENTRY)' : 'View Inside List (ENTRY)'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setGateFilter('back');
                    handleTabChange('allBookings');
                  }}
                  className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                  title="View all students who exited (BACK)"
                >
                  <DoorClosed className="w-3.5 h-3.5 text-rose-600" />
                  <span>{language === 'bn' ? 'প্রস্থানকারী তালিকা (BACK)' : 'View Exited List (BACK)'}</span>
                </button>
              </div>
            </div>

            {/* KPI Summary Cards */}
            {(() => {
              const insideCount = registrations.filter((r) => getStudentGateStatus(r) === 'ENTRY').length;
              const backCount = registrations.filter((r) => getStudentGateStatus(r) === 'BACK').length;
              const notEnteredCount = registrations.filter((r) => getStudentGateStatus(r) === 'NOT_ENTERED').length;
              const allEvents = EventStore.getGateEvents();

              return (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      Currently Inside (ENTRY)
                    </span>
                    <div className="text-2xl font-black text-emerald-950 font-mono">
                      {insideCount}
                    </div>
                    <span className="text-[10px] text-emerald-700 block font-medium">Eligible for Food & T-Shirts</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-rose-800 tracking-wider flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-rose-500" />
                      Exited Campus (BACK)
                    </span>
                    <div className="text-2xl font-black text-rose-950 font-mono">
                      {backCount}
                    </div>
                    <span className="text-[10px] text-rose-700 block font-medium">Collection strictly blocked</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-600 tracking-wider">
                      Not Yet Entered
                    </span>
                    <div className="text-2xl font-black text-slate-800 font-mono">
                      {notEnteredCount}
                    </div>
                    <span className="text-[10px] text-slate-500 block font-medium">Awaiting first arrival</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-1">
                    <span className="text-[10px] uppercase font-bold text-amber-300 tracking-wider">
                      Total Gate Audit Logs
                    </span>
                    <div className="text-2xl font-black text-amber-400 font-mono">
                      {allEvents.length}
                    </div>
                    <span className="text-[10px] text-slate-400 block font-medium">Immutable transitions</span>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Embedded Full Gate Scanner Module */}
          <ErrorBoundary>
            <Suspense fallback={<AdminTabFallback />}>
              <GateScannerModule
                language={language}
                staffUser={{
                  id: effectiveAdmin.id || 'SUPER_ADMIN_01',
                  authUserId: effectiveAdmin.id || 'SUPER_ADMIN_01',
                  username: effectiveAdmin.username || 'admin',
                  fullName: effectiveAdmin.fullName || 'Super Administrator',
                  email: effectiveAdmin.email || 'admin@gmail.com',
                  role: 'SUPER_ADMIN',
                  department: 'ALL_SERVICES',
                  permissions: ['VERIFY', 'APPROVE', 'REJECT', 'MANAGE'],
                  status: 'ACTIVE',
                  assignedGate: 'Gate 01 - Main Entrance',
                  createdAt: effectiveAdmin.createdAt || new Date().toISOString(),
                }}
                isSuperAdmin={true}
              />
            </Suspense>
          </ErrorBoundary>
        </div>
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

            {/* Consolidated Registration Database Status & Sync Control */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800">
                <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                <span>{language === 'bn' ? 'কনসোলিডেটেড ডাটাবেস:' : 'Consolidated Table:'} <code className="font-mono font-bold text-[11px] text-emerald-900">registrations_2027</code></span>
              </span>

              <button
                onClick={() => fetchSupabaseRegistrationsForYear(2027)}
                disabled={isFetchingFromSupabase}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-xs font-bold cursor-pointer transition-colors"
                title="Fetch latest bookings directly from Supabase (registrations_2027)"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isFetchingFromSupabase ? 'animate-spin' : ''}`} />
                <span>{isFetchingFromSupabase ? 'Syncing...' : 'Fetch from Supabase'}</span>
              </button>

              <button
                onClick={() => exportToCSV(filteredRegistrations, `PLSCF_Bookings_2027`)}
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
              <span className="text-[11px] text-slate-500 font-bold uppercase block">Genuine Paid Bookings</span>
              <span className="text-2xl font-black text-slate-900 mt-1 block">
                {genuineRegistrations.filter((r) => r.paymentStatus === 'paid').length}
              </span>
              <span className="text-[10px] text-emerald-600 font-medium">
                {registrationsForYear.length > genuineRegistrations.length
                  ? `+${registrationsForYear.length - genuineRegistrations.length} demo seed records preserved`
                  : `In Table: ${supabaseTableUsed}`}
              </span>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <span className="text-[11px] text-slate-500 font-bold uppercase block">Former Students</span>
              <span className="text-2xl font-black text-emerald-700 mt-1 block">
                {genuineRegistrations.filter((r) => r.category === 'former').length}
              </span>
              <span className="text-[10px] text-slate-400">Alumni SSC/HSC</span>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <span className="text-[11px] text-slate-500 font-bold uppercase block">Current Students</span>
              <span className="text-2xl font-black text-teal-700 mt-1 block">
                {genuineRegistrations.filter((r) => r.category === 'current').length}
              </span>
              <span className="text-[10px] text-slate-400">Enrolled School & College</span>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <span className="text-[11px] text-slate-500 font-bold uppercase block">Total Booking Revenue</span>
              <span className="text-2xl font-black text-amber-700 mt-1 block">
                ৳{genuineRegistrations.reduce((sum, r) => sum + r.totalPaid, 0).toLocaleString()}
              </span>
              <span className="text-[10px] text-slate-400">Genuine Paid Inflow</span>
            </div>
          </div>

          {/* Enhanced Search & Column Filters Toolbar */}
          <div className="space-y-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {/* Search Bar */}
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
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-300 text-xs focus:border-emerald-500 focus:outline-hidden bg-white shadow-2xs"
                />
              </div>

              {/* Category Filter */}
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as any)}
                className="px-3 py-2.5 rounded-xl border border-slate-300 text-xs focus:border-emerald-500 focus:outline-hidden bg-white shadow-2xs font-medium text-slate-700"
              >
                <option value="all">All Student Categories (সকল ক্যাটাগরি)</option>
                <option value="former">Former Students (প্রাক্তন অ্যালামনাই)</option>
                <option value="current">Current Students (বর্তমান শিক্ষার্থী)</option>
              </select>

              {/* Payment Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-3 py-2.5 rounded-xl border border-slate-300 text-xs focus:border-emerald-500 focus:outline-hidden bg-white shadow-2xs font-medium text-slate-700"
              >
                <option value="all">All Payment Statuses (সকল পেমেন্ট স্ট্যাটাস)</option>
                <option value="paid">PAID & VERIFIED (পরিশোধিত)</option>
                <option value="pending">PENDING (অপেক্ষমান)</option>
                <option value="refunded">REFUNDED / CANCELLED (বাতিল)</option>
              </select>

              {/* Gate Attendance Filter (ENTRY / BACK / NOT_ENTERED) */}
              <select
                value={gateFilter}
                onChange={(e) => setGateFilter(e.target.value as any)}
                className={`px-3 py-2.5 rounded-xl border text-xs focus:outline-hidden font-bold shadow-2xs ${
                  gateFilter === 'entry' || gateFilter === 'in'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                    : gateFilter === 'back'
                    ? 'border-rose-400 bg-rose-50 text-rose-900'
                    : gateFilter === 'not_entered'
                    ? 'border-slate-400 bg-slate-100 text-slate-700'
                    : 'border-slate-300 bg-white text-slate-700 focus:border-emerald-500'
                }`}
              >
                <option value="all">All Gate Statuses (সকল গেইট স্ট্যাটাস)</option>
                <option value="entry">Gate: ENTRY (উপস্থিত - সবুজ)</option>
                <option value="back">Gate: BACK (প্রস্থান - লাল)</option>
                <option value="not_entered">Gate: NOT ENTERED (প্রবেশ করেনি)</option>
              </select>
            </div>

            {/* Column-Specific Granular Filters Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {/* Food Distribution Filter */}
              <select
                value={foodFilter}
                onChange={(e) => setFoodFilter(e.target.value)}
                className="px-3 py-2.5 rounded-xl border border-slate-300 text-xs focus:border-emerald-500 focus:outline-hidden bg-white shadow-2xs font-medium text-slate-700"
              >
                <option value="all">Food: All Statuses (সকল খাবার স্ট্যাটাস)</option>
                <option value="all_taken">All Meals Taken (সকল খাবার গৃহীত: B+L+D)</option>
                <option value="any_taken">Any Meal Taken (যে কোনো খাবার গৃহীত)</option>
                <option value="none_taken">No Meals Taken (কোনো খাবার নেয়নি)</option>
                <option value="breakfast_taken">Breakfast Taken (সকালের নাস্তা নেওয়া)</option>
                <option value="breakfast_pending">Breakfast Pending (সকালের নাস্তা বাকি)</option>
                <option value="lunch_taken">Lunch Taken (দুপুরের খাবার নেওয়া)</option>
                <option value="lunch_pending">Lunch Pending (দুপুরের খাবার বাকি)</option>
                <option value="dinner_taken">Dinner Taken (রাতের খাবার নেওয়া)</option>
                <option value="dinner_pending">Dinner Pending (রাতের খাবার বাকি)</option>
              </select>

              {/* T-Shirt Distribution Filter */}
              <select
                value={tshirtFilter}
                onChange={(e) => setTshirtFilter(e.target.value as any)}
                className="px-3 py-2.5 rounded-xl border border-slate-300 text-xs focus:border-emerald-500 focus:outline-hidden bg-white shadow-2xs font-medium text-slate-700"
              >
                <option value="all">T-Shirt: All Statuses (সকল টি-শার্ট স্ট্যাটাস)</option>
                <option value="given">T-Shirt Handed Over (টি-শার্ট প্রাপ্ত)</option>
                <option value="pending">T-Shirt Pending (টি-শার্ট বাকি)</option>
              </select>

              {/* T-Shirt Size Filter */}
              <select
                value={tshirtSizeFilter}
                onChange={(e) => setTshirtSizeFilter(e.target.value)}
                className="px-3 py-2.5 rounded-xl border border-slate-300 text-xs focus:border-emerald-500 focus:outline-hidden bg-white shadow-2xs font-medium text-slate-700"
              >
                <option value="all">T-Shirt Size: All Sizes (সকল সাইজ)</option>
                <option value="S">Size: S</option>
                <option value="M">Size: M</option>
                <option value="L">Size: L</option>
                <option value="XL">Size: XL</option>
                <option value="XXL">Size: XXL</option>
                <option value="XXXL">Size: XXXL</option>
                <option value="Oversize 50">Size: Oversize 50</option>
              </select>

              {/* Batch Filter & Reset Button */}
              <div className="flex items-center gap-2">
                <select
                  value={batchFilter}
                  onChange={(e) => setBatchFilter(e.target.value)}
                  className="flex-1 px-3 py-2.5 rounded-xl border border-slate-300 text-xs focus:border-emerald-500 focus:outline-hidden bg-white shadow-2xs font-medium text-slate-700 min-w-0"
                >
                  <option value="all">All Batches (সকল ব্যাচ)</option>
                  {uniqueBatches.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>

                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 border border-slate-200 shadow-2xs"
                    title="Reset all filters to default"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                    <span>Reset ({activeFilterCount})</span>
                  </button>
                )}
              </div>
            </div>

            {/* Live Filter Indicator Bar */}
            <div className="flex items-center justify-between flex-wrap gap-2 pt-1 pb-1 text-xs text-slate-500">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-slate-700">
                  Showing <strong className="text-slate-900 font-black">{filteredRegistrations.length}</strong> of{' '}
                  <strong className="text-slate-900 font-bold">{registrationsForYear.length}</strong> attendees
                </span>
                {gateFilter !== 'all' && (
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 text-[11px] font-bold text-slate-700 border border-slate-200">
                    Gate: {gateFilter.toUpperCase()}
                  </span>
                )}
                {foodFilter !== 'all' && (
                  <span className="px-2 py-0.5 rounded-md bg-amber-50 text-[11px] font-bold text-amber-800 border border-amber-200">
                    Food: {foodFilter}
                  </span>
                )}
                {tshirtFilter !== 'all' && (
                  <span className="px-2 py-0.5 rounded-md bg-teal-50 text-[11px] font-bold text-teal-800 border border-teal-200">
                    T-Shirt: {tshirtFilter}
                  </span>
                )}
                {batchFilter !== 'all' && (
                  <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-[11px] font-bold text-indigo-800 border border-indigo-200">
                    Batch: {batchFilter}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 text-[11px] font-bold">
                <span className="flex items-center gap-1 text-emerald-700">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block"></span>
                  IN Campus: {registrationsForYear.filter(isStudentInside).length}
                </span>
                <span className="flex items-center gap-1 text-rose-600">
                  <span className="w-2 h-2 rounded-full bg-rose-500 inline-block"></span>
                  OUT: {registrationsForYear.filter((r) => !isStudentInside(r)).length}
                </span>
              </div>
            </div>
          </div>

          {/* Bookings Table: Desktop Responsive View (>= 640px) */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold uppercase text-[11px]">
                  <th className="py-3 px-3">Student</th>
                  <th className="py-3 px-3">Category & Batch</th>
                  <th className="py-3 px-3">Contact</th>
                  <th className="py-3 px-3">T-Shirt</th>
                  <th className="py-3 px-3 text-center min-w-[85px]">
                    <div className="flex items-center justify-center gap-1">
                      <DoorOpen className="w-3.5 h-3.5 text-slate-500" />
                      <span>Gate</span>
                    </div>
                  </th>
                  <th className="py-3 px-3 text-center min-w-[130px]">
                    <div className="flex items-center justify-center gap-1">
                      <Utensils className="w-3.5 h-3.5 text-slate-500" />
                      <span>Food</span>
                    </div>
                  </th>
                  <th className="py-3 px-3">Amount Paid</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Transaction</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRegistrations.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-400">
                      No bookings found for year {selectedYear} matching your criteria.
                    </td>
                  </tr>
                ) : (
                  paginate(filteredRegistrations, regPage, regPageSize).map((reg) => (
                    <tr key={reg.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-3">
                          <div
                            onClick={() => setSelectedStudentForPhoto(reg)}
                            className="relative group cursor-pointer shrink-0"
                            title="Click to view & manage student photo in Supabase Storage"
                          >
                            <img
                              src={reg.photoUrl}
                              alt={reg.fullName}
                              className="w-10 h-10 rounded-xl object-cover border border-slate-200 group-hover:ring-2 group-hover:ring-emerald-500 transition-all shadow-xs"
                            />
                            <div className="absolute inset-0 bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[10px]">
                              <Camera className="w-3.5 h-3.5" />
                            </div>
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block">{reg.fullName}</span>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono text-[10px] text-emerald-700 font-bold">
                                {reg.id}
                              </span>
                              {reg.isDemo && (
                                <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 text-[9px] font-bold rounded">
                                  DEMO SEED
                                </span>
                              )}
                              {reg.isLegacy && !reg.isDemo && (
                                <span className="px-1.5 py-0.2 bg-sky-100 text-sky-800 text-[9px] font-bold rounded">
                                  MIGRATED
                                </span>
                              )}
                            </div>
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
                          type="button"
                          onClick={() => handleToggleTShirtCollected(reg.id, isTShirtGiven(reg))}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 shadow-xs whitespace-nowrap ${
                            isTShirtGiven(reg)
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white ring-1 ring-emerald-500'
                              : 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300'
                          }`}
                          title={
                            isTShirtGiven(reg)
                              ? 'T-Shirt Status: Given (Green). Click to reset to Pending (allows re-scanning).'
                              : 'T-Shirt Status: Pending (Yellow). Click to mark as Given.'
                          }
                        >
                          {isTShirtGiven(reg) ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{reg.tShirtSize} • Given</span>
                            </>
                          ) : (
                            <>
                              <Clock className="w-3.5 h-3.5 text-amber-700" />
                              <span>{reg.tShirtSize} • Pending</span>
                            </>
                          )}
                        </button>
                      </td>

                      <td className="py-3 px-3 text-center">
                        {(() => {
                          const gateStatus = getStudentGateStatus(reg);
                          return (
                            <button
                              type="button"
                              onClick={() => handleToggleGateAttendance(reg, gateStatus)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-black cursor-pointer transition-all transform active:scale-95 shadow-xs whitespace-nowrap min-w-[72px] ${
                                gateStatus === 'ENTRY'
                                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white ring-2 ring-emerald-400/50'
                                  : gateStatus === 'BACK'
                                  ? 'bg-rose-600 hover:bg-rose-700 text-white ring-1 ring-rose-400'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-300'
                              }`}
                              title={
                                gateStatus === 'ENTRY'
                                  ? 'Gate Status: ENTRY (Green Box). Student has entered event. Click to record BACK (Exit).'
                                  : gateStatus === 'BACK'
                                  ? 'Gate Status: BACK (Red Box). Student has exited event. Click to record ENTRY (Re-enter).'
                                  : 'Gate Status: NOT ENTERED (Neutral). Click to record ENTRY.'
                              }
                            >
                              {gateStatus === 'ENTRY'
                                ? 'ENTRY'
                                : gateStatus === 'BACK'
                                ? 'BACK'
                                : 'NOT ENTERED'}
                            </button>
                          );
                        })()}
                      </td>

                      <td className="py-3 px-3">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Morning Breakfast */}
                          <button
                            type="button"
                            onClick={() => handleToggleFoodDistribution(reg, 'breakfast')}
                            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-xs font-black transition-all transform active:scale-95 cursor-pointer shadow-xs ${
                              isMealCollected(reg, 'breakfast')
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white ring-2 ring-emerald-400/50'
                                : 'bg-rose-500 hover:bg-rose-600 text-white ring-1 ring-rose-400'
                            }`}
                            title={`Breakfast (সকালের নাস্তা): ${
                              isMealCollected(reg, 'breakfast')
                                ? 'Taken (Green - Click to toggle)'
                                : 'Not Taken (Red - Click to toggle)'
                            }`}
                          >
                            B
                          </button>

                          {/* Lunch */}
                          <button
                            type="button"
                            onClick={() => handleToggleFoodDistribution(reg, 'lunch')}
                            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-xs font-black transition-all transform active:scale-95 cursor-pointer shadow-xs ${
                              isMealCollected(reg, 'lunch')
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white ring-2 ring-emerald-400/50'
                                : 'bg-rose-500 hover:bg-rose-600 text-white ring-1 ring-rose-400'
                            }`}
                            title={`Lunch (দুপুরের খাবার): ${
                              isMealCollected(reg, 'lunch')
                                ? 'Taken (Green - Click to toggle)'
                                : 'Not Taken (Red - Click to toggle)'
                            }`}
                          >
                            L
                          </button>

                          {/* Dinner */}
                          <button
                            type="button"
                            onClick={() => handleToggleFoodDistribution(reg, 'dinner')}
                            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-xs font-black transition-all transform active:scale-95 cursor-pointer shadow-xs ${
                              isMealCollected(reg, 'dinner')
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white ring-2 ring-emerald-400/50'
                                : 'bg-rose-500 hover:bg-rose-600 text-white ring-1 ring-rose-400'
                            }`}
                            title={`Dinner (রাতের খাবার): ${
                              isMealCollected(reg, 'dinner')
                                ? 'Taken (Green - Click to toggle)'
                                : 'Not Taken (Red - Click to toggle)'
                            }`}
                          >
                            D
                          </button>
                        </div>
                        <div className="flex items-center justify-center gap-1.5 text-[9px] text-slate-400 font-semibold mt-1">
                          <span>B: সকাল</span>
                          <span>•</span>
                          <span>L: দুপুর</span>
                          <span>•</span>
                          <span>D: রাত</span>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-black text-slate-900 whitespace-nowrap inline-block tabular-nums">৳{reg.totalPaid}</div>
                        {reg.donationAmount > 0 && (
                          <div className="text-[10px] text-rose-600 font-semibold whitespace-nowrap">
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
                          onClick={() => setSelectedStudentForPhoto(reg)}
                          className="p-1.5 text-emerald-600 hover:text-emerald-800 rounded hover:bg-emerald-50 cursor-pointer"
                          title="Manage Student Photo in Supabase Storage (student-photos)"
                        >
                          <Camera className="w-3.5 h-3.5" />
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

          {/* Bookings Table: Mobile Responsive Cards (< 640px) */}
          <div className="sm:hidden space-y-3.5">
            {filteredRegistrations.length === 0 ? (
              <div className="py-8 text-center text-slate-400 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
                No bookings found for year {selectedYear} matching your criteria.
              </div>
            ) : (
              paginate(filteredRegistrations, regPage, regPageSize).map((reg) => (
                <div
                  key={`mobile-reg-${reg.id}`}
                  className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3"
                >
                  {/* Card Header: Photo, Name, ID, Category & Payment Status */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={reg.photoUrl}
                        alt={reg.fullName}
                        className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0"
                      />
                      <div className="min-w-0">
                        <span className="font-bold text-slate-900 block text-sm truncate">
                          {reg.fullName}
                        </span>
                        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                          <span className="font-mono text-xs text-emerald-700 font-bold">
                            {reg.id}
                          </span>
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                              reg.category === 'former'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-teal-100 text-teal-800'
                            }`}
                          >
                            {reg.category}
                          </span>
                        </div>
                      </div>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0 ${
                        reg.paymentStatus === 'paid'
                          ? 'bg-emerald-100 text-emerald-800'
                          : reg.paymentStatus === 'pending'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {reg.paymentStatus}
                    </span>
                  </div>

                  {/* Card Body Grid: Key Info with Clear Labels */}
                  <div className="grid grid-cols-2 gap-2.5 text-xs pt-2 border-t border-slate-100">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        Batch
                      </span>
                      <span className="font-semibold text-slate-800 block truncate">
                        {reg.batchName}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        Amount Paid
                      </span>
                      <span className="font-black text-slate-900 whitespace-nowrap inline-block tabular-nums text-sm">
                        ৳{reg.totalPaid}
                      </span>
                      {reg.donationAmount > 0 && (
                        <span className="text-[10px] text-rose-600 font-semibold block whitespace-nowrap">
                          (+৳{reg.donationAmount} Don.)
                        </span>
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        Contact Phone
                      </span>
                      <a
                        href={`tel:${reg.mobileNumber}`}
                        className="font-mono text-emerald-700 font-semibold hover:underline block truncate"
                      >
                        {reg.mobileNumber}
                      </a>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        T-Shirt & Kit
                      </span>
                      <button
                        type="button"
                        onClick={() => handleToggleTShirtCollected(reg.id, isTShirtGiven(reg))}
                        className={`mt-0.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all w-full text-center cursor-pointer min-h-[38px] flex items-center justify-center gap-1.5 shadow-xs whitespace-nowrap ${
                          isTShirtGiven(reg)
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white ring-1 ring-emerald-500'
                            : 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300'
                        }`}
                        title={
                          isTShirtGiven(reg)
                            ? 'T-Shirt Status: Given (Green). Click to reset to Pending.'
                            : 'T-Shirt Status: Pending (Yellow). Click to mark as Given.'
                        }
                      >
                        {isTShirtGiven(reg) ? `✓ ${reg.tShirtSize} • Given` : `⏳ ${reg.tShirtSize} • Pending`}
                      </button>
                    </div>

                    <div className="col-span-2">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                        Gate Status (গেট)
                      </span>
                      {(() => {
                        const gateStatus = getStudentGateStatus(reg);
                        return (
                          <button
                            type="button"
                            onClick={() => handleToggleGateAttendance(reg, gateStatus)}
                            className={`px-3 py-2 rounded-lg text-xs font-black transition-all w-full text-center cursor-pointer min-h-[40px] flex items-center justify-center gap-2 shadow-xs whitespace-nowrap ${
                              gateStatus === 'ENTRY'
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white ring-2 ring-emerald-400/50'
                                : gateStatus === 'BACK'
                                ? 'bg-rose-600 hover:bg-rose-700 text-white ring-1 ring-rose-400'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                            }`}
                            title={
                              gateStatus === 'ENTRY'
                                ? 'Gate Status: ENTRY (Green Box). Student is inside event. Tap to record BACK (Exit).'
                                : gateStatus === 'BACK'
                                ? 'Gate Status: BACK (Red Box). Student has exited event. Tap to record ENTRY (Re-enter).'
                                : 'Gate Status: NOT ENTERED (Neutral). Tap to record ENTRY.'
                            }
                          >
                            <span className="px-2 py-0.5 rounded bg-black/20 text-xs font-black">
                              {gateStatus}
                            </span>
                            <span>
                              {gateStatus === 'ENTRY'
                                ? 'Inside Venue (ভেতরে আছেন - সবুজ)'
                                : gateStatus === 'BACK'
                                ? 'Exited / BACK (বাইরে আছেন - লাল)'
                                : 'Not Entered (এখনও প্রবেশ করেননি)'}
                            </span>
                          </button>
                        );
                      })()}
                    </div>

                    <div className="col-span-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] uppercase font-bold text-slate-500">
                          Food Distribution (খাবার বিতরণ)
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          Green: Taken • Red: Pending
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleFoodDistribution(reg, 'breakfast')}
                          className={`min-h-[40px] px-2 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer shadow-xs flex items-center justify-center gap-1 ${
                            isMealCollected(reg, 'breakfast')
                              ? 'bg-emerald-600 active:bg-emerald-700 text-white ring-2 ring-emerald-400/50'
                              : 'bg-rose-500 active:bg-rose-600 text-white ring-1 ring-rose-400'
                          }`}
                          title={`Breakfast (সকালের নাস্তা): ${
                            isMealCollected(reg, 'breakfast') ? 'Taken (Green)' : 'Pending (Red)'
                          }`}
                        >
                          B • সকাল
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleFoodDistribution(reg, 'lunch')}
                          className={`min-h-[40px] px-2 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer shadow-xs flex items-center justify-center gap-1 ${
                            isMealCollected(reg, 'lunch')
                              ? 'bg-emerald-600 active:bg-emerald-700 text-white ring-2 ring-emerald-400/50'
                              : 'bg-rose-500 active:bg-rose-600 text-white ring-1 ring-rose-400'
                          }`}
                          title={`Lunch (দুপুরের খাবার): ${
                            isMealCollected(reg, 'lunch') ? 'Taken (Green)' : 'Pending (Red)'
                          }`}
                        >
                          L • দুপুর
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleFoodDistribution(reg, 'dinner')}
                          className={`min-h-[40px] px-2 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer shadow-xs flex items-center justify-center gap-1 ${
                            isMealCollected(reg, 'dinner')
                              ? 'bg-emerald-600 active:bg-emerald-700 text-white ring-2 ring-emerald-400/50'
                              : 'bg-rose-500 active:bg-rose-600 text-white ring-1 ring-rose-400'
                          }`}
                          title={`Dinner (রাতের খাবার): ${
                            isMealCollected(reg, 'dinner') ? 'Taken (Green)' : 'Pending (Red)'
                          }`}
                        >
                          D • রাত
                        </button>
                      </div>
                    </div>

                    {reg.transactionId && (
                      <div className="col-span-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                        <span className="text-slate-500 font-mono">
                          Tx: <strong className="text-slate-800">{reg.transactionId}</strong>
                        </span>
                        <span className="uppercase font-bold text-slate-600 text-[10px] px-2 py-0.5 bg-white rounded border border-slate-200">
                          {reg.paymentMethod}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Card Actions: 44px Minimum Touch Targets & Generous Spacing */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => onSelectTicket && onSelectTicket(reg)}
                      className="flex-1 min-h-[44px] px-3 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <QrCode className="w-4 h-4" />
                      <span>View Ticket</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowEditStudentModal(reg)}
                      className="min-h-[44px] min-w-[44px] p-2 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 rounded-xl transition-colors flex items-center justify-center cursor-pointer"
                      title="Edit Student Info"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setBookingToDelete(reg);
                        setDeleteReason('');
                      }}
                      className="min-h-[44px] min-w-[44px] p-2 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-600 rounded-xl transition-colors flex items-center justify-center cursor-pointer"
                      title={language === 'bn' ? 'বুকিং মুছে ফেলুন' : 'Delete Registration'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Registrations Global Pagination */}
          <GlobalPagination
            currentPage={regPage}
            totalRecords={filteredRegistrations.length}
            pageSize={regPageSize}
            onPageChange={setRegPage}
            onPageSizeChange={setRegPageSize}
            language={language}
          />
        </div>
      )}

      {/* TAB: CURRENT STUDENT ID MANAGEMENT */}
      {activeTab === 'studentIds' && (
        <ErrorBoundary
          fallbackTitle={language === 'bn' ? 'স্টুডেন্ট আইডি ব্যবস্থাপনা ত্রুটি' : 'Student ID Management Error'}
          fallbackMessage={
            language === 'bn'
              ? 'স্টুডেন্ট আইডি ব্যবস্থাপনা লোড করার সময় একটি সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।'
              : 'An error occurred while loading the Student ID Management tab. Please click retry.'
          }
        >
          <StudentIdManagementTab
            language={language}
            onSelectTicket={(regId) => {
              const reg = registrations.find((r) => r.id === regId);
              if (reg && onSelectTicket) onSelectTicket(reg);
            }}
          />
        </ErrorBoundary>
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
                    {gateEvents.filter((e) => e.eventType === 'ENTRY' && e.status === 'APPROVED').length ||
                      scanLogs.filter((s) => s.scanType === 'entry' && s.status === 'approved').length}
                  </span>
                </div>
                <div className="flex justify-between p-2 rounded-lg bg-slate-50 text-slate-700 font-semibold">
                  <span>Approved Exits:</span>
                  <span className="font-bold">
                    {gateEvents.filter((e) => e.eventType === 'EXIT' && e.status === 'APPROVED').length ||
                      scanLogs.filter((s) => s.scanType === 'exit' && s.status === 'approved').length}
                  </span>
                </div>
                <div className="flex justify-between p-2 rounded-lg bg-amber-50 text-amber-900 font-semibold">
                  <span>Currently Inside Campus:</span>
                  <span className="font-bold">
                    {registrationsForYear.filter(isStudentInside).length}
                  </span>
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
      {(activeTab === 'feeSettings' || (activeTab as any) === 'registrationControl') && (
        <div className="space-y-6 max-w-4xl">
          {/* Registration & Donation Governance Control System */}
          <RegistrationDonationControlPanel
            language={language}
            adminName={effectiveAdmin.fullName || 'Super Admin'}
            onSettingsChanged={(updated) => {
              setFeeSettings(updated);
              setRegistrationOpenInput(updated.registrationOpen);
            }}
          />

          {/* Meal Time & Scanner Control System */}
          <MealTimeScannerControlPanel
            language={language}
            adminName={effectiveAdmin.fullName || 'Super Admin'}
          />

          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Home page sections
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Hide sections or change their display order, then save the settings.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setHomePageSectionsInput([...DEFAULT_HOME_PAGE_SECTIONS])}
                  className="px-2.5 py-1 text-[11px] font-semibold text-[#0284C7] hover:text-[#0EA5E9] border border-slate-200 hover:border-sky-300 rounded-lg bg-white transition cursor-pointer self-start sm:self-auto shadow-2xs"
                >
                  {language === 'bn' ? 'ডিফল্ট সাজান' : 'Reset to Default Order'}
                </button>
              </div>
              <ol className="space-y-2">
                {homePageSectionsInput.map((section, index) => (
                  <li
                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3"
                    key={section.id}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                        <input
                          checked={section.visible}
                          onChange={() => toggleHomePageSection(section.id)}
                          type="checkbox"
                        />
                        <span>{homePageSectionLabels[section.id]}</span>
                      </label>
                      {section.id === 'committee' && (
                        <button
                          type="button"
                          onClick={() => handleTabChange('committeeManagement')}
                          className="px-2 py-0.5 rounded-md bg-sky-50 text-[#0284C7] hover:bg-sky-100 border border-sky-200 text-[11px] font-bold cursor-pointer transition-colors"
                        >
                          {language === 'bn' ? '👥 ১৬ সদস্য ও ক্যারোসেল পরিচালনা' : '👥 Edit 16 Members & Carousel'}
                        </button>
                      )}
                    </div>
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

            {/* 7. DONORS HALL OF FAME PRIVACY CONTROL */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-amber-600" />
                    <span>{language === 'bn' ? 'অনুদাতা তালিকার গোপনীয়তা নিয়ন্ত্রণ' : 'Donors Hall of Fame Privacy Control'}</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {language === 'bn'
                      ? 'অনলাইন অনুদান পেজে শীর্ষ ১০ অনুদাতার টাকার পরিমাণ প্রদর্শন বা গোপন রাখুন।'
                      : 'Control whether donation amounts are publicly visible or hidden in the Donors Hall of Fame.'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setHideDonationAmountsInput(!hideDonationAmountsInput)}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 shadow-xs shrink-0 ${
                    hideDonationAmountsInput
                      ? 'bg-amber-600 text-white hover:bg-amber-700'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700'
                  }`}
                >
                  {hideDonationAmountsInput ? (
                    <>
                      <EyeOff className="w-3.5 h-3.5" />
                      <span>{language === 'bn' ? 'টাকার পরিমাণ লুকানো (HIDDEN)' : 'AMOUNTS HIDDEN'}</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-3.5 h-3.5" />
                      <span>{language === 'bn' ? 'টাকার পরিমাণ দৃশ্যমান (VISIBLE)' : 'AMOUNTS VISIBLE'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

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
        </div>
      )}

      {/* TAB: MEAL TIME & SCANNER CONTROL SYSTEM (SUPER ADMIN & DESK) */}
      {activeTab === 'mealControl' && (
        <div className="space-y-6 max-w-4xl">
          <MealTimeScannerControlPanel
            language={language}
            adminName={effectiveAdmin.fullName || 'Super Admin'}
          />
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

          {/* Payments Table: Desktop View (>= 640px) */}
          <div className="hidden sm:block overflow-x-auto">
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
                {paginate(registrations, payPage, payPageSize).map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                      {r.transactionId}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-900">{r.fullName}</td>
                    <td className="py-2.5 px-3 uppercase font-semibold text-slate-600">
                      {r.paymentMethod}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-emerald-700 whitespace-nowrap tabular-nums">৳{r.totalPaid}</td>
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

          {/* Payments Table: Mobile Responsive Cards (< 640px) */}
          <div className="sm:hidden space-y-3">
            {paginate(registrations, payPage, payPageSize).map((r) => (
              <div key={`mobile-pay-${r.id}`} className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="font-bold text-slate-900 block text-sm truncate">{r.fullName}</span>
                    <span className="font-mono text-xs text-slate-500 font-bold block truncate">{r.transactionId || 'No TxID'}</span>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 shrink-0">
                    {r.paymentStatus}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                  <span className="font-semibold text-slate-600 uppercase text-[10px] bg-slate-100 px-2 py-0.5 rounded">
                    {r.paymentMethod}
                  </span>
                  <span className="font-black text-emerald-700 whitespace-nowrap inline-block tabular-nums text-sm">
                    ৳{r.totalPaid}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {new Date(r.registeredAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Payments Global Pagination */}
          <GlobalPagination
            currentPage={payPage}
            totalRecords={registrations.length}
            pageSize={payPageSize}
            onPageChange={setPayPage}
            onPageSizeChange={setPayPageSize}
            language={language}
          />
        </div>
      )}

      {/* TAB 6: DONATIONS & PATRONS MANAGEMENT */}
      {activeTab === 'donations' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-6">
          {/* Header Bar */}
          <div className="flex flex-wrap justify-between items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center">
                  <Heart className="w-4 h-4 fill-rose-600 text-rose-600" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900">
                    {language === 'bn' ? 'অনুদান ও পৃষ্ঠপোষক তালিকা' : 'Donations & Patrons Ledger'}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {language === 'bn'
                      ? `পুনর্মিলনী উন্নয়ন ও কল্যাণ তহবিলের সম্পূর্ণ হিসাব (সুপাবেস ডাটাবেজ: ${getDonationsTableName(selectedYear)})`
                      : `Live institutional patronage & welfare contributions (Supabase table: ${getDonationsTableName(selectedYear)})`}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={refreshDonationsFromCloud}
                disabled={isRefreshingDonations}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer border border-slate-300 transition-colors shadow-2xs"
                title="Refresh donations directly from Supabase cloud database"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingDonations ? 'animate-spin' : ''}`} />
                <span>{language === 'bn' ? 'ডাটাবেজ রিফ্রেশ' : 'Sync Supabase'}</span>
              </button>

              {isSuperAdminAccount && (
                <button
                  type="button"
                  onClick={handleToggleHideDonationAmounts}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border transition-colors shadow-2xs ${
                    feeSettings.hideDonationAmounts
                      ? 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
                      : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                  }`}
                  title="Super Admin Privacy Toggle: Show or Hide donation amounts on public Donors Hall of Fame"
                >
                  {feeSettings.hideDonationAmounts ? (
                    <>
                      <EyeOff className="w-3.5 h-3.5 text-amber-700" />
                      <span>{language === 'bn' ? 'অনুদানের পরিমাণ গোপন (Hidden)' : 'Amounts: Hidden in Hall of Fame'}</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-3.5 h-3.5 text-slate-600" />
                      <span>{language === 'bn' ? 'অনুদানের পরিমাণ দৃশ্যমান (Visible)' : 'Amounts: Visible in Hall of Fame'}</span>
                    </>
                  )}
                </button>
              )}

              <button
                onClick={() => exportToCSV(donations, `PLSCF_Donations_${selectedYear}`)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{t.btnExportCsv}</span>
              </button>
            </div>
          </div>

          {/* Top Metric Cards */}
          {(() => {
            const totalAmount = donations.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
            const count = donations.length;
            const avgAmount = count > 0 ? Math.round(totalAmount / count) : 0;
            const topDonor = donations.reduce<DonationRecord | null>(
              (max, d) => (!max || Number(d.amount) > Number(max.amount) ? d : max),
              null
            );

            return (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-slate-900 text-white rounded-2xl p-4 border border-slate-800 shadow-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#38BDF8] block">
                    {language === 'bn' ? 'সর্বমোট অনুদান' : 'Total Patronage'}
                  </span>
                  <p className="text-xl font-black text-white mt-1 tabular-nums">
                    ৳{totalAmount.toLocaleString()}
                  </p>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    {language === 'bn' ? `${count}টি নিশ্চিত অনুদান` : `${count} verified contributions`}
                  </span>
                </div>

                <div className="bg-slate-900 text-white rounded-2xl p-4 border border-slate-800 shadow-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
                    {language === 'bn' ? 'মোট অনুদাতা' : 'Total Donors'}
                  </span>
                  <p className="text-xl font-black text-white mt-1 tabular-nums font-mono">
                    {count}
                  </p>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    {language === 'bn' ? 'সুপাবেস লাইভ রেকর্ড' : 'Supabase Live Records'}
                  </span>
                </div>

                <div className="bg-slate-900 text-white rounded-2xl p-4 border border-slate-800 shadow-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block">
                    {language === 'bn' ? 'গড় অনুদান' : 'Average Donation'}
                  </span>
                  <p className="text-xl font-black text-white mt-1 tabular-nums">
                    ৳{avgAmount.toLocaleString()}
                  </p>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    {language === 'bn' ? 'প্রতি অনুদানে গড়' : 'Per donation average'}
                  </span>
                </div>

                <div className="bg-slate-900 text-white rounded-2xl p-4 border border-slate-800 shadow-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 block">
                    {language === 'bn' ? 'সর্বোচ্চ একক অনুদান' : 'Top Contribution'}
                  </span>
                  <p className="text-xl font-black text-white mt-1 tabular-nums">
                    ৳{topDonor ? Number(topDonor.amount).toLocaleString() : 0}
                  </p>
                  <span className="text-[10px] text-slate-400 mt-0.5 block truncate" title={topDonor?.donorName}>
                    {topDonor ? topDonor.donorName : '—'}
                  </span>
                </div>
              </div>
            );
          })()}

          {/* Search & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={donationsSearchQuery}
                onChange={(e) => setDonationsSearchQuery(e.target.value)}
                placeholder={
                  language === 'bn'
                    ? 'অনুদাতার নাম, মোবাইল নম্বর, ট্রানজ্যাকশন আইডি বা টোকেন দিয়ে খুঁজুন...'
                    : 'Search by donor name, phone, transaction ID, or token...'
                }
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0284C7] transition-all"
              />
              {donationsSearchQuery && (
                <button
                  type="button"
                  onClick={() => setDonationsSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="w-full sm:w-auto flex items-center gap-2">
              <select
                value={donationsPurposeFilter}
                onChange={(e) => setDonationsPurposeFilter(e.target.value)}
                className="w-full sm:w-auto px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
              >
                <option value="ALL">{language === 'bn' ? 'সকল খাত (All Causes)' : 'All Causes'}</option>
                {Array.from(new Set(donations.map((d) => d.purpose).filter(Boolean))).map((purpose) => (
                  <option key={purpose} value={purpose}>
                    {purpose}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Donations Table: Desktop View (>= 640px) */}
          {(() => {
            const filtered = donations.filter((d) => {
              const q = donationsSearchQuery.trim().toLowerCase();
              const matchesSearch =
                !q ||
                d.donorName.toLowerCase().includes(q) ||
                d.mobileNumber.toLowerCase().includes(q) ||
                (d.email && d.email.toLowerCase().includes(q)) ||
                d.id.toLowerCase().includes(q) ||
                (d.token && d.token.toLowerCase().includes(q)) ||
                (d.qrToken && d.qrToken.toLowerCase().includes(q)) ||
                (d.transactionId && d.transactionId.toLowerCase().includes(q));

              const matchesPurpose =
                donationsPurposeFilter === 'ALL' || d.purpose === donationsPurposeFilter;

              return matchesSearch && matchesPurpose;
            });

            const paginated = paginate(filtered, donationsPage, donationsPageSize);

            return (
              <>
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold">
                        <th className="py-3 px-3.5">Donor / Patron</th>
                        <th className="py-3 px-3.5">Voucher & Token</th>
                        <th className="py-3 px-3.5">Designated Cause</th>
                        <th className="py-3 px-3.5">Amount</th>
                        <th className="py-3 px-3.5">Gateway & Trx</th>
                        <th className="py-3 px-3.5">Date</th>
                        <th className="py-3 px-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginated.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                            {language === 'bn' ? 'কোনো অনুদানের তথ্য পাওয়া যায়নি।' : 'No donation records found matching criteria.'}
                          </td>
                        </tr>
                      ) : (
                        paginated.map((d) => (
                          <tr key={d.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-3.5">
                              <span className="font-bold text-slate-900 block text-xs">{d.donorName}</span>
                              <a href={`tel:${d.mobileNumber}`} className="text-[11px] text-slate-500 font-mono hover:underline" aria-label={`Call donor ${d.donorName} at ${d.mobileNumber}`}>
                                {d.mobileNumber}
                              </a>
                              {d.email && <span className="text-[10px] text-slate-400 block truncate max-w-[150px]">{d.email}</span>}
                            </td>
                            <td className="py-3 px-3.5">
                              <div className="space-y-1">
                                <span className="font-mono text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 block w-fit">
                                  {d.id}
                                </span>
                                {(d.token || d.qrToken) && (
                                  <span className="font-mono text-[10px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 block w-fit">
                                    Token: {d.token || d.qrToken}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-3.5 text-slate-700 font-medium max-w-[180px]">
                              {d.purpose}
                            </td>
                            <td className="py-3 px-3.5 font-black text-emerald-700 whitespace-nowrap tabular-nums text-sm">
                              ৳{Number(d.amount).toLocaleString('en-US')}
                            </td>
                            <td className="py-3 px-3.5">
                              <span className="inline-block text-[10px] uppercase font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 mb-1">
                                {d.paymentMethod}
                              </span>
                              <span className="font-mono text-[10px] text-slate-500 block truncate max-w-[120px]" title={d.transactionId}>
                                {d.transactionId}
                              </span>
                              <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                                <span>{d.paymentStatus || 'paid'}</span>
                              </span>
                            </td>
                            <td className="py-3 px-3.5 text-slate-500 whitespace-nowrap text-xs">
                              {d.date}
                            </td>
                            <td className="py-3 px-3.5 text-right whitespace-nowrap space-x-1.5">
                              <button
                                type="button"
                                onClick={() => setSelectedCardDonation(d)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold transition-all cursor-pointer shadow-xs"
                                title="View & Download Official Thank You Card"
                              >
                                <Award className="w-3.5 h-3.5 text-amber-600" />
                                <span>Card</span>
                              </button>
                              {isSuperAdminAccount && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteDonation(d)}
                                  className="inline-flex items-center p-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs transition-all cursor-pointer"
                                  title="Delete Donation Record"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Responsive Cards (< 640px) */}
                <div className="sm:hidden space-y-3">
                  {paginated.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 text-xs">
                      {language === 'bn' ? 'কোনো অনুদানের তথ্য পাওয়া যায়নি।' : 'No donation records found.'}
                    </div>
                  ) : (
                    paginated.map((d) => (
                      <div key={`mobile-don-${d.id}`} className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className="font-bold text-slate-900 block text-sm truncate">{d.donorName}</span>
                            <a href={`tel:${d.mobileNumber}`} className="text-xs text-slate-500 font-mono hover:underline" aria-label={`Call donor ${d.donorName} at ${d.mobileNumber}`}>{d.mobileNumber}</a>
                            {d.email && <span className="text-[10px] text-slate-400 block truncate">{d.email}</span>}
                          </div>
                          <span className="font-black text-emerald-700 whitespace-nowrap inline-block tabular-nums text-sm">
                            ৳{Number(d.amount).toLocaleString('en-US')}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 text-xs">
                          <span className="font-mono text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                            {d.id}
                          </span>
                          {(d.token || d.qrToken) && (
                            <span className="font-mono text-[10px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                              Token: {d.token || d.qrToken}
                            </span>
                          )}
                          <span className="text-[10px] uppercase font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                            {d.paymentMethod}
                          </span>
                        </div>

                        <div className="text-xs text-slate-600 pt-2 border-t border-slate-100">
                          <span className="font-medium">{d.purpose}</span> • <span className="text-slate-400">{d.date}</span>
                        </div>

                        {d.transactionId && (
                          <div className="text-[10px] text-slate-400 font-mono truncate">
                            Tx: <strong className="text-slate-700">{d.transactionId}</strong>
                          </div>
                        )}

                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => setSelectedCardDonation(d)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold transition-colors cursor-pointer"
                          >
                            <Award className="w-3.5 h-3.5 text-amber-600" />
                            <span>Thank You Card</span>
                          </button>
                          {isSuperAdminAccount && (
                            <button
                              type="button"
                              onClick={() => handleDeleteDonation(d)}
                              className="p-1.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-xs"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Donations Global Pagination */}
                <GlobalPagination
                  currentPage={donationsPage}
                  totalRecords={filtered.length}
                  pageSize={donationsPageSize}
                  onPageChange={setDonationsPage}
                  onPageSizeChange={setDonationsPageSize}
                  language={language}
                />
              </>
            );
          })()}
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

          {/* T-Shirt Table: Desktop View (>= 640px) */}
          <div className="hidden sm:block overflow-x-auto">
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
                {paginate(registrations, tshirtPage, tshirtPageSize).map((reg) => (
                  <tr key={reg.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-medium text-slate-900">{reg.fullName}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-500">{reg.id}</td>
                    <td className="py-2.5 px-3 font-bold">{reg.tShirtSize}</td>
                    <td className="py-2.5 px-3">
                      <button
                        onClick={() => handleToggleTShirtCollected(reg.id, isTShirtGiven(reg))}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 shadow-xs ${
                          isTShirtGiven(reg)
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            : 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300'
                        }`}
                        title={isTShirtGiven(reg) ? 'Status: Given (Click to reset to Pending)' : 'Status: Pending (Click to mark Given)'}
                      >
                        {isTShirtGiven(reg) ? '✓ Given / Handed Over' : '⏳ Pending Collection'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* T-Shirt Table: Mobile Responsive Cards (< 640px) */}
          <div className="sm:hidden space-y-3">
            {paginate(registrations, tshirtPage, tshirtPageSize).map((reg) => (
              <div key={`mobile-tshirt-${reg.id}`} className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="font-bold text-slate-900 block text-sm truncate">{reg.fullName}</span>
                    <span className="font-mono text-xs text-slate-500 block">{reg.id}</span>
                  </div>
                  <span className="px-3 py-1 rounded-lg bg-slate-100 text-slate-900 font-black text-xs shrink-0">
                    Size {reg.tShirtSize}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleTShirtCollected(reg.id, isTShirtGiven(reg))}
                  className={`w-full min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs ${
                    isTShirtGiven(reg)
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300'
                  }`}
                >
                  {isTShirtGiven(reg) ? '✓ Given / Handed Over (Tap to reset)' : '⏳ Pending Collection (Tap to Give)'}
                </button>
              </div>
            ))}
          </div>

          {/* T-Shirt Global Pagination */}
          <GlobalPagination
            currentPage={tshirtPage}
            totalRecords={registrations.length}
            pageSize={tshirtPageSize}
            onPageChange={setTshirtPage}
            onPageSizeChange={setTshirtPageSize}
            language={language}
          />
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
            {paginate(registrations, ticketsPage, ticketsPageSize).map((reg) => (
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

          {/* Tickets Global Pagination */}
          <GlobalPagination
            currentPage={ticketsPage}
            totalRecords={registrations.length}
            pageSize={ticketsPageSize}
            onPageChange={setTicketsPage}
            onPageSizeChange={setTicketsPageSize}
            language={language}
          />
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

          {/* Staff Table: Desktop View (>= 640px) */}
          <div className="hidden sm:block overflow-x-auto">
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
                {paginate(INITIAL_STAFF_USERS, staffPage, staffPageSize).map((st) => (
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

          {/* Staff Table: Mobile Responsive Cards (< 640px) */}
          <div className="sm:hidden space-y-3">
            {paginate(INITIAL_STAFF_USERS, staffPage, staffPageSize).map((st) => (
              <div key={`mobile-stf-${st.id}`} className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-bold text-slate-900 block text-sm">{st.fullName}</span>
                    <span className="font-mono text-xs text-slate-500 font-semibold">{st.username}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 shrink-0">
                    {st.role}
                  </span>
                </div>
                <div className="text-xs text-slate-600 pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Assigned Station</span>
                  <span className="font-medium text-slate-800">{st.gateAssigned}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Staff Global Pagination */}
          <GlobalPagination
            currentPage={staffPage}
            totalRecords={INITIAL_STAFF_USERS.length}
            pageSize={staffPageSize}
            onPageChange={setStaffPage}
            onPageSizeChange={setStaffPageSize}
            language={language}
          />
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
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  const summary = await FinancialService.getFinancialTransparencySummary();
                  const csv = FinancialService.generateFinancialReportCsv(summary);
                  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `PLSCF_Financial_Report_${new Date().toISOString().split('T')[0]}.csv`;
                  a.click();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold cursor-pointer transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV Report</span>
              </button>
              <button
                onClick={() => setShowAddExpenseModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Record Expense Voucher</span>
              </button>
            </div>
          </div>

          {/* Finances Table: Desktop View (>= 640px) */}
          <div className="hidden sm:block overflow-x-auto">
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
                {paginate(expenses, expensesPage, expensesPageSize).map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-800">{exp.receiptRef}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-700">{exp.category}</td>
                    <td className="py-2.5 px-3 text-slate-600">{exp.reason}</td>
                    <td className="py-2.5 px-3 text-slate-500">{exp.responsiblePerson}</td>
                    <td className="py-2.5 px-3 font-bold text-rose-600 whitespace-nowrap tabular-nums">৳{exp.amount.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-slate-400">{exp.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Finances Table: Mobile Responsive Cards (< 640px) */}
          <div className="sm:hidden space-y-3">
            {paginate(expenses, expensesPage, expensesPageSize).map((exp) => (
              <div key={`mobile-exp-${exp.id}`} className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="font-mono text-xs font-bold text-slate-800 block truncate">{exp.receiptRef}</span>
                    <span className="font-semibold text-slate-700 text-xs block">{exp.category}</span>
                  </div>
                  <span className="font-black text-rose-600 whitespace-nowrap inline-block tabular-nums text-sm shrink-0">
                    ৳{exp.amount.toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  {exp.reason}
                </p>
                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 text-slate-500">
                  <span>Officer: <strong className="text-slate-700">{exp.responsiblePerson}</strong></span>
                  <span className="text-[11px] text-slate-400">{exp.date}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Finances Global Pagination */}
          <GlobalPagination
            currentPage={expensesPage}
            totalRecords={expenses.length}
            pageSize={expensesPageSize}
            onPageChange={setExpensesPage}
            onPageSizeChange={setExpensesPageSize}
            language={language}
          />
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
            {paginate(notices, noticesPage, noticesPageSize).map((n) => (
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

          {/* Notices Global Pagination */}
          <GlobalPagination
            currentPage={noticesPage}
            totalRecords={notices.length}
            pageSize={noticesPageSize}
            onPageChange={setNoticesPage}
            onPageSizeChange={setNoticesPageSize}
            language={language}
          />
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

      {/* TAB 13: PHOTO GALLERY & VIDEO MEMORIES MANAGEMENT */}
      {activeTab === 'galleryManagement' && (
        <Suspense fallback={<AdminTabFallback />}>
          <GalleryManagementTab language={language} />
        </Suspense>
      )}

      {/* TAB 13.5: ORGANIZING COMMITTEE MANAGEMENT */}
      {activeTab === 'committeeManagement' && (
        <Suspense fallback={<AdminTabFallback />}>
          <CommitteeManagementTab language={language} onNavigateHome={onNavigateHome} />
        </Suspense>
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
                className="w-full py-2.5 rounded-xl bg-[#0284C7] hover:bg-[#0EA5E9] text-white font-bold text-xs shadow-xs cursor-pointer transition-colors"
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
                  <span className="font-mono font-bold text-[#0284C7]">{bookingToDelete.studentId}</span>
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

      {/* MODAL: GATE ENTRY REQUIRED ENFORCEMENT POP-UP (Admin & Super Admin) */}
      {gateBlockedAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 border-2 border-rose-500 space-y-4">
            <div className="flex items-center gap-3 text-rose-800 border-b border-rose-100 pb-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center shadow-md shrink-0">
                <AlertOctagon className="w-7 h-7" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full border border-rose-200">
                  Access Control Blocked
                </span>
                <h3 className="font-black text-rose-950 text-lg leading-tight mt-0.5">
                  GATE ENTRY REQUIRED
                </h3>
                <span className="text-xs text-rose-700 font-bold">
                  {gateBlockedAlert.gateStatus === 'BACK' ? 'Student Exited (BACK)' : 'Student Not Entered Yet'}
                </span>
              </div>
            </div>

            <div className="p-4 bg-rose-50 rounded-2xl border border-rose-200 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-600 font-medium">Attendee:</span>
                <span className="font-black text-slate-900">{gateBlockedAlert.studentName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600 font-medium">Registration ID:</span>
                <span className="font-mono font-bold text-slate-900">{gateBlockedAlert.studentId}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600 font-medium">Attempted Distribution:</span>
                <span className="font-black text-rose-700 bg-white px-2 py-0.5 rounded border border-rose-300">
                  {gateBlockedAlert.itemType}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600 font-medium">Current Gate Status:</span>
                <span
                  className={`font-black px-2.5 py-0.5 rounded-full text-[11px] ${
                    gateBlockedAlert.gateStatus === 'BACK'
                      ? 'bg-rose-600 text-white'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {gateBlockedAlert.gateStatus === 'BACK' ? 'BACK (Exited Venue)' : 'NOT ENTERED'}
                </span>
              </div>
            </div>

            <div className="p-3.5 bg-slate-900 text-white rounded-2xl text-xs space-y-1">
              <p className="font-bold text-amber-300 flex items-center gap-1.5">
                <DoorOpen className="w-4 h-4 text-amber-400" />
                <span>Strict Security Protocol Enforced</span>
              </p>
              <p className="text-slate-300 leading-relaxed text-[11px]">
                {language === 'bn'
                  ? 'অ্যাডমিন এবং সুপার অ্যাডমিন কেউই গেটে প্রবেশের পূর্বে খাবার বা টি-শার্ট বিতরণ করতে পারবেন না। শিক্ষার্থীকে আগে গেটে এন্ট্রি (ENTRY) দিতে হবে।'
                  : 'Neither Admin nor Super Admin is permitted to distribute items to attendees who have exited (BACK) or not entered. Items can ONLY be given after Gate ENTRY is completed.'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={async () => {
                  const reg = gateBlockedAlert.registration;
                  const item = gateBlockedAlert.itemType;
                  setGateBlockedAlert(null);
                  await handleToggleGateAttendance(reg, gateBlockedAlert.gateStatus);
                  if (item === 'T-Shirt') {
                    await handleToggleTShirtCollected(reg.id, false);
                  } else {
                    const mType = item.toLowerCase() as 'breakfast' | 'lunch' | 'dinner';
                    await handleToggleFoodDistribution(reg, mType);
                  }
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-all"
              >
                <DoorOpen className="w-4 h-4" />
                <span>Record ENTRY & Distribute</span>
              </button>

              <button
                type="button"
                onClick={() => setGateBlockedAlert(null)}
                className="w-full py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer transition-colors"
              >
                Close / Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL: STUDENT PHOTO INSPECTION & SUPABASE STORAGE MANAGEMENT */}
      {selectedStudentForPhoto && (
        <AdminStudentPhotoModal
          isOpen={Boolean(selectedStudentForPhoto)}
          onClose={() => setSelectedStudentForPhoto(null)}
          registration={selectedStudentForPhoto}
          adminName={effectiveAdmin?.fullName || 'Super Admin'}
          language={language}
          onPhotoUpdated={(updatedReg) => {
            setRegistrations((prev) => prev.map((r) => (r.id === updatedReg.id ? updatedReg : r)));
            setSelectedStudentForPhoto(updatedReg);
            refreshAll();
          }}
        />
      )}

      {/* MODAL: OFFICIAL PATRON THANK YOU CARD INSPECTION & DOWNLOAD */}
      {selectedCardDonation && (
        <ThankYouCardModal
          donation={selectedCardDonation}
          language={language}
          onClose={() => setSelectedCardDonation(null)}
        />
      )}
    </div>
  );
};
