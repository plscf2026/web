import { useState, useEffect, useMemo } from 'react';
import {
  DollarSign,
  Wallet,
  PlusCircle,
  CheckCircle,
  XCircle,
  Clock,
  RotateCcw,
  Download,
  Layers,
  Eye,
  Phone,
  ShieldAlert,
  UserCheck,
  X,
} from 'lucide-react';
import {
  StaffExpense,
  StaffAccount,
  Language,
} from '../../types';
import { EventStore } from '../../services/eventStore';
import { AppStore } from '../../services/store';
import {
  calculateCentralBudgetOverview,
  calculateStaffFinancialSummary,
} from '../../utils/eventRules';
import { formatCsvRow } from '../../utils/security';
import { GlobalPagination } from '../common/GlobalPagination';
import { paginate } from '../../utils/pagination';
import { VoucherModal } from '../common/VoucherModal';

interface BudgetManagementTabProps {
  language?: Language;
  adminSession?: { id: string; fullName: string; username?: string };
  adminId?: string;
  adminName?: string;
  adminRole?: string;
}

export const BudgetManagementTab: React.FC<BudgetManagementTabProps> = ({
  language: _language = 'en',
  adminSession: passedSession,
  adminId,
  adminName,
  adminRole = 'super_admin',
}) => {
  const adminSession = passedSession || {
    id: adminId || 'SUPER_ADMIN',
    fullName: adminName || 'Super Administrator',
    username: 'superadmin',
  };
  const isSuperAdmin = String(adminRole || '').toLowerCase() === 'super_admin';

  const [centralBudget, setCentralBudget] = useState(() => EventStore.getCentralBudget());
  const [rawAllocations, setRawAllocations] = useState(() => EventStore.getStaffAllocations());
  const [rawExpenses, setRawExpenses] = useState(() => EventStore.getStaffExpenses());
  const [rawLedger, setRawLedger] = useState(() => EventStore.getFinancialLedger());
  const [staffList, setStaffList] = useState<StaffAccount[]>(() =>
    isSuperAdmin
      ? EventStore.getStaffAccounts()
      : EventStore.getStaffAccounts().filter(
          (s) => s.role === 'FINANCE_STAFF' && s.assignedManagerId === adminSession.id
        )
  );
  const [viewingStaffProfile, setViewingStaffProfile] = useState<StaffAccount | null>(null);

  // Modals & Forms
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [newBudgetAmount, setNewBudgetAmount] = useState(String(centralBudget.totalBudget));
  const [budgetChangeReason, setBudgetChangeReason] = useState('');

  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [allocationAmount, setAllocationAmount] = useState('');
  const [allocationNotes, setAllocationNotes] = useState('');

  const [showCashReturnModal, setShowCashReturnModal] = useState(false);
  const [returnStaffId, setReturnStaffId] = useState('');
  const [returnAmount, setReturnAmount] = useState('');
  const [returnReason, setReturnReason] = useState('');

  const [selectedExpenseForReview, setSelectedExpenseForReview] = useState<StaffExpense | null>(null);
  const [reviewAction, setReviewAction] = useState<'APPROVE' | 'REJECT' | 'VOID'>('APPROVE');
  const [reviewReason, setReviewReason] = useState('');
  const [viewingVoucherExpense, setViewingVoucherExpense] = useState<StaffExpense | null>(null);

  const [feedbackNotice, setFeedbackNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [expenseSearch, setExpenseSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Global Pagination States (Default 10, options 10, 20, 30, 40)
  const [staffPage, setStaffPage] = useState(1);
  const [staffPageSize, setStaffPageSize] = useState(10);

  const [expensePage, setExpensePage] = useState(1);
  const [expensePageSize, setExpensePageSize] = useState(10);

  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerPageSize, setLedgerPageSize] = useState(10);

  // Reset expense page to 1 whenever search or filter changes
  useEffect(() => {
    setExpensePage(1);
  }, [expenseSearch, statusFilter]);

  // Synchronize assigned Staff & Finance records from Supabase (RLS-enforced)
  const syncScopedStaffAndFinance = async () => {
    try {
      await EventStore.syncFinanceWithSupabase();
      if (isSuperAdmin) {
        const fetched = await EventStore.fetchStaffAccounts().catch(() => EventStore.getStaffAccounts());
        setStaffList(fetched);
      } else {
        const scoped = await EventStore.fetchAssignedFinanceStaff(adminSession.id, false);
        setStaffList(scoped);
      }
    } catch (_) {}
    setCentralBudget(EventStore.getCentralBudget());
    setRawAllocations(EventStore.getStaffAllocations());
    setRawExpenses(EventStore.getStaffExpenses());
    setRawLedger(EventStore.getFinancialLedger());
  };

  useEffect(() => {
    void syncScopedStaffAndFinance();
    const onSync = () => {
      void syncScopedStaffAndFinance();
    };
    window.addEventListener('plscf_finance_sync', onSync);
    window.addEventListener('plscf_staff_sync', onSync);
    return () => {
      window.removeEventListener('plscf_finance_sync', onSync);
      window.removeEventListener('plscf_staff_sync', onSync);
    };
  }, [adminSession.id, isSuperAdmin]);

  // Strict Finance Manager Isolation: only see records belonging to assigned Finance Staff
  const allowedStaffIds = useMemo(() => new Set(staffList.map((s) => s.id)), [staffList]);

  const allocations = useMemo(
    () => (isSuperAdmin ? rawAllocations : rawAllocations.filter((a) => allowedStaffIds.has(a.staffId))),
    [isSuperAdmin, rawAllocations, allowedStaffIds]
  );

  const expenses = useMemo(
    () => (isSuperAdmin ? rawExpenses : rawExpenses.filter((e) => allowedStaffIds.has(e.staffId))),
    [isSuperAdmin, rawExpenses, allowedStaffIds]
  );

  const ledger = useMemo(
    () =>
      isSuperAdmin
        ? rawLedger
        : rawLedger.filter(
            (l) => allowedStaffIds.has(l.staffId) || l.transactionType === 'REGISTRATION_INFLOW'
          ),
    [isSuperAdmin, rawLedger, allowedStaffIds]
  );

  const refreshAll = () => {
    setCentralBudget(EventStore.getCentralBudget());
    setRawAllocations(EventStore.getStaffAllocations());
    setRawExpenses(EventStore.getStaffExpenses());
    setRawLedger(EventStore.getFinancialLedger());
    if (isSuperAdmin) {
      setStaffList(EventStore.getStaffAccounts());
    }
  };

  const overview = calculateCentralBudgetOverview(
    centralBudget.totalBudget,
    allocations,
    expenses,
    ledger
  );

  // Update Central Budget Handler (Requirement 8A & 8G)
  const handleUpdateBudget = (e: React.SyntheticEvent) => {
    e.preventDefault();
    const amt = Number(newBudgetAmount);
    if (isNaN(amt) || amt < 0) return;

    EventStore.updateCentralBudget(
      amt,
      adminSession.id,
      adminSession.fullName,
      budgetChangeReason.trim() || 'Central Budget Allocation adjustment'
    );
    refreshAll();
    setShowBudgetModal(false);
    setBudgetChangeReason('');
    setFeedbackNotice({
      type: 'success',
      message: `Central Budget updated to BDT ${amt.toLocaleString()} successfully.`,
    });
    setTimeout(() => setFeedbackNotice(null), 4000);
  };

  // Staff Allocation Handler (Requirement 8B)
  const handleAllocateMoney = (e: React.SyntheticEvent) => {
    e.preventDefault();
    const amt = Number(allocationAmount);
    if (!selectedStaffId || isNaN(amt) || amt <= 0) return;

    if (amt > overview.remainingUnallocatedBudget) {
      alert(`Error: Allocation amount BDT ${amt} exceeds the remaining unallocated budget of BDT ${overview.remainingUnallocatedBudget}.`);
      return;
    }

    const staff = staffList.find((s) => s.id === selectedStaffId);
    if (!staff || (!isSuperAdmin && !allowedStaffIds.has(staff.id))) {
      alert('Unauthorized: You may only allocate budget to Finance Staff assigned to you.');
      return;
    }

    EventStore.allocateMoneyToStaff(
      staff.id,
      staff.fullName,
      amt,
      adminSession.id,
      adminSession.fullName,
      allocationNotes.trim()
    );

    refreshAll();
    setShowAllocateModal(false);
    setAllocationAmount('');
    setAllocationNotes('');
    setFeedbackNotice({
      type: 'success',
      message: `Allocated BDT ${amt.toLocaleString()} to ${staff.fullName} successfully.`,
    });
    setTimeout(() => setFeedbackNotice(null), 4000);
  };

  // Cash Return Settlement Handler (Requirement 8D & 8H)
  const handleRecordCashReturn = (e: React.SyntheticEvent) => {
    e.preventDefault();
    const amt = Number(returnAmount);
    if (!returnStaffId || isNaN(amt) || amt <= 0) return;

    const staff = staffList.find((s) => s.id === returnStaffId);
    if (!staff || (!isSuperAdmin && !allowedStaffIds.has(staff.id))) {
      alert('Unauthorized: You may only record cash returns for Finance Staff assigned to you.');
      return;
    }

    EventStore.recordCashReturned(
      staff.id,
      staff.fullName,
      amt,
      adminSession.id,
      adminSession.fullName,
      returnReason.trim() || 'Cash returned after event operations'
    );

    refreshAll();
    setShowCashReturnModal(false);
    setReturnAmount('');
    setReturnReason('');
    setFeedbackNotice({
      type: 'success',
      message: `Recorded cash return of BDT ${amt.toLocaleString()} from ${staff.fullName}. Restored to unallocated budget.`,
    });
    setTimeout(() => setFeedbackNotice(null), 4000);
  };

  // Review Expense Handler (Approve / Reject / Void) (Requirement 8G & 8I)
  const handleExecuteExpenseReview = (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!selectedExpenseForReview) return;
    if (!isSuperAdmin && !allowedStaffIds.has(selectedExpenseForReview.staffId)) {
      alert('Unauthorized: You may only review expenses for Finance Staff assigned to you.');
      return;
    }

    if (reviewAction === 'APPROVE') {
      EventStore.approveStaffExpense(
        selectedExpenseForReview.id,
        adminSession.id,
        adminSession.fullName
      );
      setFeedbackNotice({
        type: 'success',
        message: `Expense of BDT ${selectedExpenseForReview.amount.toLocaleString()} approved.`,
      });
    } else if (reviewAction === 'REJECT') {
      if (!reviewReason.trim()) {
        alert('Mandatory reason is required to reject an expense.');
        return;
      }
      EventStore.rejectStaffExpense(
        selectedExpenseForReview.id,
        reviewReason.trim(),
        adminSession.id,
        adminSession.fullName
      );
      setFeedbackNotice({
        type: 'success',
        message: `Expense rejected and staff spendable balance restored.`,
      });
    } else if (reviewAction === 'VOID') {
      if (!reviewReason.trim()) {
        alert('Mandatory reason is required to void an expense.');
        return;
      }
      EventStore.voidStaffExpense(
        selectedExpenseForReview.id,
        reviewReason.trim(),
        adminSession.id,
        adminSession.fullName
      );
      setFeedbackNotice({
        type: 'success',
        message: `Expense voided and reversing adjustment recorded in ledger.`,
      });
    }

    refreshAll();
    setSelectedExpenseForReview(null);
    setReviewReason('');
    setTimeout(() => setFeedbackNotice(null), 4000);
  };

  // Close Staff Account Handler (Requirement 8J)
  const handleCloseStaffAccount = (staffId: string, staffName: string) => {
    if (!isSuperAdmin && !allowedStaffIds.has(staffId)) {
      alert('Unauthorized: You may only reconcile and close accounts for Finance Staff assigned to you.');
      return;
    }
    const reason = prompt(`Enter reason for closing financial account for ${staffName}:`);
    if (!reason) return;

    EventStore.closeStaffFinancialAccount(
      staffId,
      staffName,
      adminSession.id,
      adminSession.fullName,
      reason
    );
    refreshAll();
    setFeedbackNotice({
      type: 'success',
      message: `Financial account for ${staffName} closed and reconciled.`,
    });
    setTimeout(() => setFeedbackNotice(null), 4000);
  };

  // Export Financial Ledger CSV
  const handleExportLedgerCSV = () => {
    const headers = ['Transaction ID', 'Staff ID', 'Type', 'Amount (BDT)', 'Reference', 'Description', 'Timestamp', 'Created By'];
    const rows = ledger.map((l) => [
      l.id,
      l.staffId,
      l.transactionType,
      l.amount,
      l.referenceId,
      l.description,
      l.createdAt,
      l.createdBy,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [formatCsvRow(headers), ...rows.map((r) => formatCsvRow(r))].join('\n');
    const encoded = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encoded);
    link.setAttribute('download', `PLSCF_Financial_Ledger_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered expenses
  const filteredExpenses = expenses.filter((e) => {
    const matchesSearch =
      e.staffName.toLowerCase().includes(expenseSearch.toLowerCase()) ||
      e.category.toLowerCase().includes(expenseSearch.toLowerCase()) ||
      e.description.toLowerCase().includes(expenseSearch.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || e.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* SECTION A: CENTRAL ADMIN BUDGET CARDS (Requirement 8A) */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-600" />
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                Central Event Budget & Financial Management
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Double-entry digital cash management system with authoritative server ledger.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowBudgetModal(true)}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>Modify Central Budget</span>
            </button>

            <button
              onClick={() => setShowAllocateModal(true)}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Allocate Money to Staff</span>
            </button>

            <button
              onClick={() => setShowCashReturnModal(true)}
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Record Cash Return</span>
            </button>

            <button
              onClick={handleExportLedgerCSV}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5"
              title="Download CSV Ledger"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Ledger</span>
            </button>
          </div>
        </div>

        {/* 6 Essential Central Budget KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
              TOTAL EVENT BUDGET
            </span>
            <div className="text-lg font-black font-mono text-amber-400">
              BDT {overview.totalCentralBudget.toLocaleString()}
            </div>
            <span className="text-[9px] text-slate-400 block">Master Allocation</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-500 block tracking-wider">
              ALLOCATED TO STAFF
            </span>
            <div className="text-lg font-black font-mono text-slate-900">
              BDT {overview.totalAllocatedToStaff.toLocaleString()}
            </div>
            <span className="text-[9px] text-slate-400 block">{allocations.length} staff assignments</span>
          </div>

          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-1">
            <span className="text-[10px] uppercase font-bold text-amber-800 block tracking-wider">
              PENDING (SUBMITTED)
            </span>
            <div className="text-lg font-black font-mono text-amber-950">
              BDT {(overview.totalExpensesRecorded - overview.totalApprovedExpenses).toLocaleString()}
            </div>
            <span className="text-[9px] text-amber-700 block">Awaiting review (excluded from approved)</span>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-1">
            <span className="text-[10px] uppercase font-bold text-emerald-800 block tracking-wider">
              APPROVED EXPENSES
            </span>
            <div className="text-lg font-black font-mono text-emerald-950">
              BDT {overview.totalApprovedExpenses.toLocaleString()}
            </div>
            <span className="text-[9px] text-emerald-700 block">Verified with receipts</span>
          </div>

          <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 space-y-1">
            <span className="text-[10px] uppercase font-bold text-blue-800 block tracking-wider">
              CASH RETURNED
            </span>
            <div className="text-lg font-black font-mono text-blue-950">
              BDT {overview.totalCashReturned.toLocaleString()}
            </div>
            <span className="text-[9px] text-blue-700 block">Unused settlement</span>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-100/70 border border-emerald-300 space-y-1">
            <span className="text-[10px] uppercase font-bold text-emerald-900 block tracking-wider">
              UNALLOCATED BUDGET
            </span>
            <div className="text-lg font-black font-mono text-emerald-900">
              BDT {overview.remainingUnallocatedBudget.toLocaleString()}
            </div>
            <span className="text-[9px] text-emerald-800 block">Reserve liquidity</span>
          </div>
        </div>

        {/* REVENUE FORECAST & BUDGET SANITY ANALYSIS (Pre-Event Financial Feasibility) */}
        {(() => {
          const totalInflow = ledger
            .filter((l) => l.transactionType === 'REGISTRATION_INFLOW' || (l.transactionType as string) === 'MANUAL_CASH_DEPOSIT')
            .reduce((sum, l) => sum + (l.amount || 0), 0);
          const masterBudget = overview.totalCentralBudget || 6100000;
          const targetAttendees = Math.ceil(masterBudget / 1500);
          const paidAlumni = AppStore.getRegistrations().filter((r: any) => r.paymentStatus === 'paid').length;
          const fundingPct = Math.min(100, Math.round((totalInflow / masterBudget) * 100));
          const deficit = Math.max(0, masterBudget - totalInflow);

          return (
            <div className="mt-4 p-4 rounded-2xl bg-slate-900 text-white border border-slate-800 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                  <span className="font-bold text-xs uppercase tracking-wider text-slate-200">
                    Financial Feasibility & Budget Sanity Forecast (12 Sub-Committees)
                  </span>
                </div>
                <span className="text-[11px] font-mono font-bold text-amber-400">
                  Target: {targetAttendees.toLocaleString()} Alumni @ ৳1,500 = ৳{masterBudget.toLocaleString()} BDT
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700">
                  <span className="text-[10px] text-slate-400 block">Total Inflow Collected</span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">৳{totalInflow.toLocaleString()} BDT</span>
                  <span className="text-[9px] text-slate-400 block mt-0.5">{paidAlumni} Paid Attendees</span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700">
                  <span className="text-[10px] text-slate-400 block">Funding Progress</span>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-2 rounded-full bg-slate-700 overflow-hidden">
                      <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${fundingPct}%` }} />
                    </div>
                    <span className="font-mono font-bold text-amber-300 text-xs">{fundingPct}%</span>
                  </div>
                  <span className="text-[9px] text-slate-400 block mt-1">of Master ৳{masterBudget.toLocaleString()}</span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700">
                  <span className="text-[10px] text-slate-400 block">Remaining Funding Gap</span>
                  <span className="font-mono font-bold text-rose-400 text-sm">৳{deficit.toLocaleString()} BDT</span>
                  <span className="text-[9px] text-slate-400 block mt-0.5">Need {Math.ceil(deficit / 1500)} more tickets or sponsors</span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700">
                  <span className="text-[10px] text-slate-400 block">Recommended Action</span>
                  <span className="text-[11px] font-medium text-slate-200 block mt-0.5 leading-tight">
                    {deficit > 0
                      ? 'Accelerate alumni outreach & corporate sponsorships to cover sub-committee allocations.'
                      : 'Event is fully funded! Surplus can be assigned to student welfare fund.'}
                  </span>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {feedbackNotice && (
        <div
          className={`p-4 rounded-2xl text-xs font-bold flex items-center gap-2 ${
            feedbackNotice.type === 'success'
              ? 'bg-emerald-50 border border-emerald-300 text-emerald-900'
              : 'bg-rose-50 border border-rose-300 text-rose-900'
          }`}
        >
          {feedbackNotice.type === 'success' ? (
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{feedbackNotice.message}</span>
        </div>
      )}

      {/* SECTION B: FINANCE MANAGER STAFF DIRECTORY & BALANCES TABLE (Requirement 8F) */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
              {isSuperAdmin
                ? 'Staff Directory, Allocations & Real-time Balances'
                : 'My Assigned Finance Staff Directory'}
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            {staffList.length} assigned staff personnel
          </span>
        </div>

        {!isSuperAdmin && (
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Showing only Finance Staff assigned to you by the Super Admin. If you need a new Staff account, status change, or password reset, please request it from the Super Administrator.
            </span>
          </div>
        )}

        {staffList.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 bg-slate-50 rounded-2xl border border-slate-200">
            No Finance Staff accounts are currently assigned to your manager profile. Ask the Super Admin to assign Staff under User &amp; Access Control.
          </div>
        ) : (
          <>
            {/* Desktop Table View (>= 640px) */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                    <th className="py-2.5 px-3">Staff ID / Reg No.</th>
                    <th className="py-2.5 px-3">Staff Name &amp; Mobile</th>
                    <th className="py-2.5 px-3 text-right">Allocated</th>
                    <th className="py-2.5 px-3 text-right">Submitted</th>
                    <th className="py-2.5 px-3 text-right">Approved</th>
                    <th className="py-2.5 px-3 text-right">Remaining</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginate(staffList, staffPage, staffPageSize).map((stf) => {
                    const sSummary = calculateStaffFinancialSummary(
                      stf.id,
                      stf.fullName,
                      allocations,
                      expenses,
                      ledger
                    );
                    const sAllocs = allocations.filter((a) => a.staffId === stf.id);
                    const isClosed = sAllocs.length > 0 && sAllocs.every((a) => a.status === 'CLOSED');
                    return (
                      <tr key={stf.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                          <div>{stf.staffCode || stf.id}</div>
                          {stf.staffCode && stf.staffCode !== stf.id && (
                            <span className="text-[10px] text-slate-400 font-normal">{stf.id}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-slate-800">{stf.fullName}</div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                            <span className="inline-flex items-center gap-1 font-mono">
                              <Phone className="w-3 h-3 text-slate-400" />
                              {stf.mobileNumber || '—'}
                            </span>
                            <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 text-[9px] font-bold">
                              {stf.role}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap tabular-nums">
                          BDT {sSummary.totalAllocated.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-amber-700 font-semibold whitespace-nowrap tabular-nums">
                          BDT {sSummary.totalSubmittedExpenses.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-emerald-700 font-bold whitespace-nowrap tabular-nums">
                          BDT {sSummary.totalApprovedExpenses.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900 whitespace-nowrap tabular-nums">
                          BDT {sSummary.remainingSpendableBalance.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              stf.status === 'ACTIVE'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {stf.status}
                          </span>
                          {isClosed && (
                            <span className="block text-[9px] font-bold text-slate-500 mt-0.5">
                              RECONCILED
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setViewingStaffProfile(stf)}
                              className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] border border-indigo-200 cursor-pointer"
                            >
                              View Profile
                            </button>
                            <button
                              onClick={() => handleCloseStaffAccount(stf.id, stf.fullName)}
                              className="text-[11px] font-bold text-slate-600 hover:text-rose-600 cursor-pointer"
                              title="Reconcile and close account"
                            >
                              Close Account
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Responsive Cards (< 640px) */}
            <div className="sm:hidden space-y-3">
              {paginate(staffList, staffPage, staffPageSize).map((stf) => {
                const sSummary = calculateStaffFinancialSummary(
                  stf.id,
                  stf.fullName,
                  allocations,
                  expenses,
                  ledger
                );
                return (
                  <div key={`mobile-stf-budget-${stf.id}`} className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-bold text-slate-900 block text-sm">{stf.fullName}</span>
                        <span className="font-mono text-xs text-slate-500 font-bold">
                          {stf.staffCode || stf.id} {stf.mobileNumber ? `• ${stf.mobileNumber}` : ''}
                        </span>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase shrink-0 ${
                          stf.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {stf.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs pt-2 border-t border-slate-100">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Allocated</span>
                        <span className="font-mono font-bold text-slate-900 text-xs whitespace-nowrap inline-block tabular-nums">
                          BDT {sSummary.totalAllocated.toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Submitted</span>
                        <span className="font-mono text-amber-700 font-semibold text-xs whitespace-nowrap inline-block tabular-nums">
                          BDT {sSummary.totalSubmittedExpenses.toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Approved</span>
                        <span className="font-mono text-emerald-700 font-bold text-xs whitespace-nowrap inline-block tabular-nums">
                          BDT {sSummary.totalApprovedExpenses.toLocaleString()}
                        </span>
                      </div>
                      <div className="col-span-3 bg-emerald-50/60 p-2.5 rounded-xl border border-emerald-100 flex items-center justify-between">
                        <span className="text-[11px] font-bold text-emerald-900 uppercase">Remaining Spendable</span>
                        <span className="font-mono font-black text-emerald-700 text-sm whitespace-nowrap inline-block tabular-nums">
                          BDT {sSummary.remainingSpendableBalance.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setViewingStaffProfile(stf)}
                        className="min-h-[44px] px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center border border-indigo-200"
                      >
                        View Profile
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCloseStaffAccount(stf.id, stf.fullName)}
                        className="min-h-[44px] px-3 py-2 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-700 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center border border-rose-200"
                      >
                        Close &amp; Reconcile
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Staff Allocations Global Pagination */}
        <GlobalPagination
          currentPage={staffPage}
          totalRecords={staffList.length}
          pageSize={staffPageSize}
          onPageChange={setStaffPage}
          onPageSizeChange={setStaffPageSize}
        />
      </div>

      {/* SECTION C: STAFF EXPENSES APPROVAL & REVIEW WORKFLOW (Requirement 8I) */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
              Expense Verification & Approval Workflow
            </h3>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input
              type="text"
              value={expenseSearch}
              onChange={(e) => setExpenseSearch(e.target.value)}
              placeholder="Search staff, category..."
              className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs focus:outline-hidden"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-300 text-xs font-bold"
            >
              <option value="ALL">All Status</option>
              <option value="SUBMITTED">SUBMITTED (Pending)</option>
              <option value="APPROVED">APPROVED</option>
              <option value="REJECTED">REJECTED</option>
              <option value="VOIDED">VOIDED</option>
            </select>
          </div>
        </div>

        {filteredExpenses.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center">
            No expenses found matching the criteria.
          </p>
        ) : (
          <>
            {/* Desktop Table View (>= 640px) */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Staff Incharge</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3 text-right">Amount (BDT)</th>
                    <th className="py-2.5 px-3 text-center">Receipt</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-right">Manager Review Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginate(filteredExpenses, expensePage, expensePageSize).map((exp) => (
                    <tr key={exp.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                        {exp.expenseDate}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{exp.staffName}</td>
                      <td className="py-2.5 px-3 text-slate-700">{exp.category}</td>
                      <td className="py-2.5 px-3 text-slate-600 max-w-xs truncate">{exp.description}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900 whitespace-nowrap tabular-nums">
                        BDT {exp.amount.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {exp.receiptUrl ? (
                          <button
                            type="button"
                            onClick={() => setViewingVoucherExpense(exp)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs transition border border-indigo-200 cursor-pointer shadow-2xs"
                          >
                            <Eye className="w-3.5 h-3.5 text-indigo-600" />
                            <span>View Voucher</span>
                          </button>
                        ) : (
                          <span className="text-slate-400 font-mono text-[11px]">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            exp.status === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : exp.status === 'SUBMITTED'
                              ? 'bg-amber-100 text-amber-800'
                              : exp.status === 'REJECTED'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {exp.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {exp.status === 'SUBMITTED' && (
                            <>
                              <button
                                onClick={() => {
                                  setSelectedExpenseForReview(exp);
                                  setReviewAction('APPROVE');
                                }}
                                className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] cursor-pointer"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedExpenseForReview(exp);
                                  setReviewAction('REJECT');
                                }}
                                className="px-2 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] cursor-pointer"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {exp.status === 'APPROVED' && (
                            <button
                              onClick={() => {
                                setSelectedExpenseForReview(exp);
                                setReviewAction('VOID');
                              }}
                              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-900 text-slate-200 font-bold text-[10px] cursor-pointer"
                            >
                              Void
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Responsive Cards (< 640px) */}
            <div className="sm:hidden space-y-3">
              {paginate(filteredExpenses, expensePage, expensePageSize).map((exp) => (
                <div key={`mobile-exp-vouch-${exp.id}`} className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-bold text-slate-900 block text-sm">{exp.staffName}</span>
                      <span className="text-[11px] text-slate-500 font-mono">{exp.expenseDate} • {exp.category}</span>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                        exp.status === 'APPROVED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : exp.status === 'SUBMITTED'
                          ? 'bg-amber-100 text-amber-800'
                          : exp.status === 'REJECTED'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {exp.status}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    {exp.description}
                  </p>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Amount</span>
                    <span className="font-mono font-black text-slate-900 text-sm whitespace-nowrap inline-block tabular-nums">
                      BDT {exp.amount.toLocaleString()}
                    </span>
                  </div>

                  {/* Actions for Mobile with >= 44px touch targets */}
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                    {exp.receiptUrl && (
                      <button
                        type="button"
                        onClick={() => setViewingVoucherExpense(exp)}
                        className="flex-1 min-h-[44px] px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs transition border border-indigo-200 cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Eye className="w-4 h-4 text-indigo-600" />
                        <span>View Voucher</span>
                      </button>
                    )}

                    {exp.status === 'SUBMITTED' && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedExpenseForReview(exp);
                            setReviewAction('APPROVE');
                          }}
                          className="flex-1 min-h-[44px] px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs transition cursor-pointer flex items-center justify-center"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedExpenseForReview(exp);
                            setReviewAction('REJECT');
                          }}
                          className="flex-1 min-h-[44px] px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-bold text-xs transition cursor-pointer flex items-center justify-center"
                        >
                          Reject
                        </button>
                      </>
                    )}

                    {exp.status === 'APPROVED' && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedExpenseForReview(exp);
                          setReviewAction('VOID');
                        }}
                        className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-slate-200 font-bold text-xs transition cursor-pointer flex items-center justify-center"
                      >
                        Void Approval
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Expenses Global Pagination */}
        <GlobalPagination
          currentPage={expensePage}
          totalRecords={filteredExpenses.length}
          pageSize={expensePageSize}
          onPageChange={setExpensePage}
          onPageSizeChange={setExpensePageSize}
        />
      </div>

      {/* SECTION D: AUTHORITATIVE FINANCIAL LEDGER (Double-Entry Record) */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-4">
        <div className="flex justify-between items-center border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
              Immutable Financial Ledger (Transactions)
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-mono">{ledger.length} ledger entries</span>
        </div>

        {/* Desktop Table View (>= 640px) */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                <th className="py-2.5 px-3">Ledger ID</th>
                <th className="py-2.5 px-3">Staff ID</th>
                <th className="py-2.5 px-3">Transaction Type</th>
                <th className="py-2.5 px-3">Description</th>
                <th className="py-2.5 px-3 text-right">Amount (BDT)</th>
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Created By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {paginate(ledger, ledgerPage, ledgerPageSize).map((l) => (
                <tr key={l.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-2 px-3 text-slate-500">{l.id}</td>
                  <td className="py-2 px-3 font-bold text-slate-900">{l.staffId}</td>
                  <td className="py-2 px-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        l.transactionType === 'ALLOCATION'
                          ? 'bg-emerald-100 text-emerald-800'
                          : l.transactionType === 'EXPENSE'
                          ? 'bg-amber-100 text-amber-800'
                          : l.transactionType === 'CASH_RETURN'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-indigo-100 text-indigo-800'
                      }`}
                    >
                      {l.transactionType}
                    </span>
                  </td>
                  <td className="py-2 px-3 font-sans text-slate-700">{l.description}</td>
                  <td className="py-2 px-3 text-right font-black text-slate-900 whitespace-nowrap tabular-nums">
                    BDT {l.amount.toLocaleString()}
                  </td>
                  <td className="py-2 px-3 text-slate-500">{new Date(l.createdAt).toLocaleDateString()}</td>
                  <td className="py-2 px-3 font-sans text-slate-600">{l.createdBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Responsive Cards (< 640px) */}
        <div className="sm:hidden space-y-3 pt-2">
          {ledger.length === 0 ? (
            <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
              No ledger transactions recorded yet.
            </div>
          ) : (
            paginate(ledger, ledgerPage, ledgerPageSize).map((l) => (
              <div
                key={`mobile-ledger-${l.id}`}
                className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-mono text-xs font-bold text-slate-900 block truncate">
                      {l.staffId}
                    </span>
                    <span className="font-mono text-[10px] text-slate-400 block truncate">
                      #{l.id}
                    </span>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0 ${
                      l.transactionType === 'ALLOCATION'
                        ? 'bg-emerald-100 text-emerald-800'
                        : l.transactionType === 'EXPENSE'
                        ? 'bg-amber-100 text-amber-800'
                        : l.transactionType === 'CASH_RETURN'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-indigo-100 text-indigo-800'
                    }`}
                  >
                    {l.transactionType}
                  </span>
                </div>

                <p className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  {l.description}
                </p>

                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                  <div className="text-[11px] text-slate-500">
                    <span>{new Date(l.createdAt).toLocaleDateString()}</span> •{' '}
                    <span className="text-slate-700 font-semibold">{l.createdBy}</span>
                  </div>
                  <span className="font-mono font-black text-slate-900 text-sm whitespace-nowrap inline-block tabular-nums">
                    BDT {l.amount.toLocaleString()}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Financial Ledger Global Pagination */}
        <GlobalPagination
          currentPage={ledgerPage}
          totalRecords={ledger.length}
          pageSize={ledgerPageSize}
          onPageChange={setLedgerPage}
          onPageSizeChange={setLedgerPageSize}
        />
      </div>

      {/* MODAL 1: MODIFY CENTRAL BUDGET */}
      {showBudgetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900">Update Central Event Budget</h3>
              <button onClick={() => setShowBudgetModal(false)} className="text-slate-400">✕</button>
            </div>
            <form onSubmit={handleUpdateBudget} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Total Central Budget (BDT) *</label>
                <input
                  type="number"
                  min="0"
                  value={newBudgetAmount}
                  onChange={(e) => setNewBudgetAmount(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Reason for Budget Change *</label>
                <textarea
                  value={budgetChangeReason}
                  onChange={(e) => setBudgetChangeReason(e.target.value)}
                  placeholder="e.g. Additional alumni donations allocated to central fund..."
                  required
                  rows={3}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowBudgetModal(false)} className="px-4 py-2 border rounded-xl text-xs font-bold">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold">
                  Save Budget
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ALLOCATE MONEY TO STAFF */}
      {showAllocateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900">Allocate Money to Staff Member</h3>
              <button onClick={() => setShowAllocateModal(false)} className="text-slate-400">✕</button>
            </div>
            <p className="text-xs text-slate-500">
              Unallocated Budget Available: <strong className="text-emerald-700 font-mono">BDT {overview.remainingUnallocatedBudget.toLocaleString()}</strong>
            </p>
            <form onSubmit={handleAllocateMoney} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Select Staff Member *</label>
                <select
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold"
                >
                  <option value="">-- Choose Staff Account --</option>
                  {staffList.filter((s) => s.status === 'ACTIVE').map((s) => (
                    <option key={s.id} value={s.id}>{s.fullName} ({s.id} - {s.role})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Allocated Amount (BDT) *</label>
                <input
                  type="number"
                  min="100"
                  max={overview.remainingUnallocatedBudget}
                  value={allocationAmount}
                  onChange={(e) => setAllocationAmount(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Purpose / Notes *</label>
                <input
                  type="text"
                  value={allocationNotes}
                  onChange={(e) => setAllocationNotes(e.target.value)}
                  placeholder="e.g. Stage lighting advance, morning water purchase..."
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowAllocateModal(false)} className="px-4 py-2 border rounded-xl text-xs font-bold">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold">
                  Confirm Allocation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: RECORD CASH RETURN */}
      {showCashReturnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900">Record Returned Unused Cash</h3>
              <button onClick={() => setShowCashReturnModal(false)} className="text-slate-400">✕</button>
            </div>
            <p className="text-xs text-slate-500">
              Returned cash is credited back to unallocated central budget and is NOT counted as an expense.
            </p>
            <form onSubmit={handleRecordCashReturn} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Select Staff Member *</label>
                <select
                  value={returnStaffId}
                  onChange={(e) => setReturnStaffId(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold"
                >
                  <option value="">-- Choose Staff Account --</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>{s.fullName} ({s.id})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Returned Amount (BDT) *</label>
                <input
                  type="number"
                  min="1"
                  value={returnAmount}
                  onChange={(e) => setReturnAmount(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Reason / Notes *</label>
                <input
                  type="text"
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  placeholder="e.g. Unspent balance returned after dining stage completion"
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowCashReturnModal(false)} className="px-4 py-2 border rounded-xl text-xs font-bold">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold">
                  Record Settlement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: REVIEW EXPENSE (Approve/Reject/Void with Reason) */}
      {selectedExpenseForReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900">
                {reviewAction} Staff Expense
              </h3>
              <button onClick={() => setSelectedExpenseForReview(null)} className="text-slate-400">✕</button>
            </div>

            <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-2xl space-y-1">
              <p>Staff: <strong>{selectedExpenseForReview.staffName}</strong> ({selectedExpenseForReview.staffId})</p>
              <p>Amount: <strong className="font-mono text-emerald-800">BDT {selectedExpenseForReview.amount.toLocaleString()}</strong></p>
              <p>Category: <strong>{selectedExpenseForReview.category}</strong></p>
              <p>Description: {selectedExpenseForReview.description}</p>
            </div>

            <form onSubmit={handleExecuteExpenseReview} className="space-y-4">
              {reviewAction !== 'APPROVE' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mandatory Audit Reason for {reviewAction} *
                  </label>
                  <textarea
                    value={reviewReason}
                    onChange={(e) => setReviewReason(e.target.value)}
                    placeholder="Enter verifiable reason..."
                    required
                    rows={3}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setSelectedExpenseForReview(null)} className="px-4 py-2 border rounded-xl text-xs font-bold">
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-4 py-2 text-white rounded-xl text-xs font-bold ${
                    reviewAction === 'APPROVE' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  Confirm {reviewAction}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW VOUCHER POPUP MODAL */}
      <VoucherModal
        isOpen={Boolean(viewingVoucherExpense)}
        onClose={() => setViewingVoucherExpense(null)}
        expense={viewingVoucherExpense}
      />

      {/* INDIVIDUAL STAFF FINANCIAL PROFILE MODAL */}
      {viewingStaffProfile && (isSuperAdmin || allowedStaffIds.has(viewingStaffProfile.id)) && (() => {
        const prof = viewingStaffProfile;
        const pSummary = calculateStaffFinancialSummary(
          prof.id,
          prof.fullName,
          allocations,
          expenses,
          ledger
        );
        const profExpenses = expenses.filter((e) => e.staffId === prof.id);
        const profAllocations = allocations.filter((a) => a.staffId === prof.id);
        const isClosed =
          profAllocations.length > 0 && profAllocations.every((a) => a.status === 'CLOSED');

        return (
          <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
            <div className="bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-7 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto space-y-5">
              <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-black text-slate-900">{prof.fullName}</h3>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        prof.status === 'ACTIVE'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {prof.status}
                    </span>
                    {isClosed && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-900 text-white">
                        Reconciled &amp; Closed
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 font-mono flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                    <span>ID / Reg No: <strong>{prof.staffCode || prof.id}</strong></span>
                    <span className="inline-flex items-center gap-1">
                      <Phone className="w-3 h-3 text-slate-400" />
                      {prof.mobileNumber || '—'}
                    </span>
                    {prof.assignedManagerName && (
                      <span className="inline-flex items-center gap-1 font-sans text-purple-800 font-bold">
                        <UserCheck className="w-3.5 h-3.5" />
                        Manager: {prof.assignedManagerName}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setViewingStaffProfile(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Staff Financial Summary Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Allocated</span>
                  <span className="font-mono font-black text-slate-900">BDT {pSummary.totalAllocated.toLocaleString()}</span>
                </div>
                <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200">
                  <span className="text-[10px] font-bold uppercase text-amber-800 block">Submitted</span>
                  <span className="font-mono font-black text-amber-900">BDT {pSummary.totalSubmittedExpenses.toLocaleString()}</span>
                </div>
                <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200">
                  <span className="text-[10px] font-bold uppercase text-emerald-800 block">Approved</span>
                  <span className="font-mono font-black text-emerald-900">BDT {pSummary.totalApprovedExpenses.toLocaleString()}</span>
                </div>
                <div className="p-3 rounded-2xl bg-blue-50 border border-blue-200">
                  <span className="text-[10px] font-bold uppercase text-blue-800 block">Returned</span>
                  <span className="font-mono font-black text-blue-900">BDT {pSummary.totalCashReturned.toLocaleString()}</span>
                </div>
                <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-200">
                  <span className="text-[10px] font-bold uppercase text-indigo-800 block">Remaining</span>
                  <span className="font-mono font-black text-indigo-900">BDT {pSummary.remainingSpendableBalance.toLocaleString()}</span>
                </div>
              </div>

              {/* Staff Submitted Expenses & Receipt History */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
                  Submitted Expenses, Receipts &amp; Approval History ({profExpenses.length})
                </h4>
                {profExpenses.length === 0 ? (
                  <p className="text-xs text-slate-400 p-4 text-center bg-slate-50 rounded-2xl border border-slate-200">
                    No expenses recorded by this staff member yet.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {profExpenses.map((exp) => (
                      <div key={exp.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <span className="font-bold text-slate-900">{exp.category}</span>
                            <span className="font-mono text-[11px] text-slate-500 ml-2">
                              {exp.expenseDate} {exp.expenseTime}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-slate-900">
                              BDT {exp.amount.toLocaleString()}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                exp.status === 'APPROVED'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : exp.status === 'SUBMITTED'
                                  ? 'bg-amber-100 text-amber-800'
                                  : exp.status === 'REJECTED'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              {exp.status}
                            </span>
                          </div>
                        </div>

                        <p className="text-slate-600">{exp.description}</p>
                        {exp.vendorName && (
                          <p className="text-[11px] text-slate-500">Vendor: {exp.vendorName}</p>
                        )}
                        {exp.approvedBy && (
                          <p className="text-[11px] text-emerald-700 font-semibold">
                            Approved by {exp.approvedBy} {exp.approvedAt ? `on ${new Date(exp.approvedAt).toLocaleString()}` : ''}
                          </p>
                        )}
                        {exp.rejectionReason && (
                          <p className="text-[11px] text-rose-700 font-semibold">
                            Rejection Reason: {exp.rejectionReason}
                          </p>
                        )}
                        {exp.voidReason && (
                          <p className="text-[11px] text-slate-700 font-semibold">
                            Void Reason: {exp.voidReason}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {exp.receiptUrl && (
                            <button
                              type="button"
                              onClick={() => setViewingVoucherExpense(exp)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] border border-indigo-200 cursor-pointer"
                            >
                              <Eye className="w-3 h-3" />
                              <span>View Receipt</span>
                            </button>
                          )}
                          {exp.status === 'SUBMITTED' && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedExpenseForReview(exp);
                                  setReviewAction('APPROVE');
                                }}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] cursor-pointer"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedExpenseForReview(exp);
                                  setReviewAction('REJECT');
                                }}
                                className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] cursor-pointer"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {exp.status === 'APPROVED' && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedExpenseForReview(exp);
                                setReviewAction('VOID');
                              }}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-bold text-[11px] cursor-pointer"
                            >
                              Void
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setViewingStaffProfile(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold cursor-pointer"
                >
                  Close Profile
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
