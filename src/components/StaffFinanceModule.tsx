import { useState, useEffect, useRef } from 'react';
import {
  Wallet,
  PlusCircle,
  Clock,
  CheckCircle,
  AlertCircle,
  Camera,
  Upload,
  Trash2,
  Eye,
  Lock,
  Calendar,
} from 'lucide-react';
import { StaffAccount, Language, StaffExpense } from '../types';
import { EventStore } from '../services/eventStore';
import { calculateStaffFinancialSummary } from '../utils/eventRules';
import { readValidatedImage } from '../utils/fileValidation';
import { GlobalPagination } from './common/GlobalPagination';
import { paginate } from '../utils/pagination';
import { CameraCaptureModal } from './common/CameraCaptureModal';
import { VoucherModal } from './common/VoucherModal';

interface StaffFinanceModuleProps {
  language: Language;
  staffUser: StaffAccount;
}

export const StaffFinanceModule: React.FC<StaffFinanceModuleProps> = ({
  language: _language,
  staffUser,
}) => {
  const [allocations, setAllocations] = useState(() => EventStore.getStaffAllocations());
  const [expenses, setExpenses] = useState(() => EventStore.getStaffExpenses());
  const [ledger, setLedger] = useState(() => EventStore.getFinancialLedger());

  // Global Pagination State (Default 10, options 10, 20, 30, 40)
  const [expensePage, setExpensePage] = useState(1);
  const [expensePageSize, setExpensePageSize] = useState(10);

  // Add Expense Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('Logistics & Transport');
  const [expenseDescription, setExpenseDescription] = useState('');

  // Auto-matching real-time date and time (non-modifiable by user)
  const [expenseDate, setExpenseDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [expenseTime, setExpenseTime] = useState(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });

  const [vendorName, setVendorName] = useState('');
  const [receiptUrl, setReceiptUrl] = useState('');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Camera and Voucher Modal states
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [viewingVoucherExpense, setViewingVoucherExpense] = useState<StaffExpense | null>(null);
  const [showDraftPreviewModal, setShowDraftPreviewModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Continuously synchronize real-time clock while form is open
  useEffect(() => {
    if (!showAddForm) return;
    const syncClock = () => {
      const d = new Date();
      const curDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const curTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      setExpenseDate(curDate);
      setExpenseTime(curTime);
    };

    syncClock();
    const interval = setInterval(syncClock, 1000);
    return () => clearInterval(interval);
  }, [showAddForm]);

  const refreshFinancials = () => {
    setAllocations(EventStore.getStaffAllocations());
    setExpenses(EventStore.getStaffExpenses());
    setLedger(EventStore.getFinancialLedger());
  };

  // Authoritative financial summary for this staff member ONLY (Part 8 requirement)
  const summary = calculateStaffFinancialSummary(
    staffUser.id,
    staffUser.fullName,
    allocations,
    expenses,
    ledger
  );

  // Staff expenses strictly filtered to current logged-in staff member
  const staffExpensesList = expenses.filter((e) => e.staffId === staffUser.id);

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setReceiptUrl(await readValidatedImage(file));
      setFormError('');
    } catch (error) {
      e.target.value = '';
      setFormError(error instanceof Error ? error.message : 'Unable to validate the receipt image.');
    }
  };

  const handleExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    const amt = Number(expenseAmount);
    if (!amt || amt <= 0) {
      setFormError('Please enter a valid expense amount in BDT.');
      return;
    }

    if (!expenseDescription.trim()) {
      setFormError('Please enter a detailed description of the expense.');
      return;
    }

    // Overspending validation (Requirement 8E)
    if (amt > summary.remainingSpendableBalance) {
      setFormError(
        `Overspending Blocked: Requested amount BDT ${amt} exceeds your remaining allocated balance of BDT ${summary.remainingSpendableBalance}. Please request additional budget allocation from Super Admin.`
      );
      return;
    }

    // Authoritative real-time lock: exact submission timestamp
    const now = new Date();
    const authoritativeDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const authoritativeTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const res = EventStore.submitStaffExpense(
      staffUser.id,
      staffUser.fullName,
      amt,
      expenseCategory,
      expenseDescription.trim(),
      authoritativeDate,
      authoritativeTime,
      vendorName.trim() || undefined,
      receiptUrl || undefined
    );

    if (res.success && res.expense) {
      refreshFinancials();
      setFormSuccess(
        `Expense of BDT ${amt} recorded successfully. Status: SUBMITTED for Super Admin review.`
      );
      setExpenseAmount('');
      setExpenseDescription('');
      setVendorName('');
      setReceiptUrl('');
      setShowAddForm(false);
      setTimeout(() => setFormSuccess(''), 5000);
    } else {
      setFormError(res.error || 'Failed to record expense.');
    }
  };

  // Calculations for daily history
  const today = new Date().toISOString().split('T')[0];
  const todayExpenses = staffExpensesList
    .filter((e) => e.expenseDate === today && e.status !== 'VOIDED' && e.status !== 'REJECTED')
    .reduce((sum, e) => sum + e.amount, 0);

  const categories = [
    'Logistics & Transport',
    'Food & Catering Procurement',
    'Drinking Water & Refreshments',
    'Stage, Lighting & Acoustic Rig',
    'Printing, Badges & Souvenirs',
    'Venue Sanitation & Cleaning',
    'Emergency & Medical First Aid',
    'Volunteer Refreshments',
    'Miscellaneous Supplies',
  ];

  return (
    <div className="space-y-6">
      {/* Staff Financial Overview Header */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black shadow-xs">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                Staff Individual Financial Portal
              </span>
              <h2 className="text-xl font-black text-slate-900 tracking-tight mt-0.5">
                {staffUser.fullName}
              </h2>
              <p className="text-xs text-slate-500 font-mono">
                Staff ID: <strong className="text-slate-800">{staffUser.id}</strong> • Role: {staffUser.role}
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              setShowAddForm(!showAddForm);
              setFormError('');
            }}
            className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all shadow-xs flex items-center gap-2 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{showAddForm ? 'Close Expense Form' : 'Add New Daily Expense'}</span>
          </button>
        </div>

        {/* 4 Essential Balances (Requirement 8B) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-6">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
              TOTAL ALLOCATED BUDGET
            </span>
            <div className="text-xl font-black text-slate-900 font-mono">
              BDT {summary.totalAllocated.toLocaleString()}
            </div>
            <span className="text-[10px] text-slate-400 block">Assigned by Super Admin</span>
          </div>

          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-1">
            <span className="text-[10px] uppercase font-bold text-amber-800 tracking-wider">
              TOTAL EXPENSES RECORDED
            </span>
            <div className="text-xl font-black text-amber-950 font-mono">
              BDT {(summary.totalSubmittedExpenses + summary.totalApprovedExpenses).toLocaleString()}
            </div>
            <span className="text-[10px] text-amber-700 block">
              {summary.totalApprovedExpenses.toLocaleString()} approved • {summary.totalSubmittedExpenses.toLocaleString()} pending
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 space-y-1">
            <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider">
              REMAINING SPENDABLE BALANCE
            </span>
            <div className="text-2xl font-black text-emerald-700 font-mono">
              BDT {summary.remainingSpendableBalance.toLocaleString()}
            </div>
            <span className="text-[10px] text-emerald-700 block">Available for submission</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
              TODAY'S EXPENSES (DHAKA TIME)
            </span>
            <div className="text-xl font-black text-slate-800 font-mono">
              BDT {todayExpenses.toLocaleString()}
            </div>
            <span className="text-[10px] text-slate-400 block">Date: {today}</span>
          </div>
        </div>
      </div>

      {formSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{formSuccess}</span>
        </div>
      )}

      {/* ADD NEW EXPENSE FORM (Requirement 8C) */}
      {showAddForm && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-emerald-500 shadow-md space-y-5 animate-in fade-in duration-200">
          <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-emerald-600" />
              <span>Record New Daily Operational Expense</span>
            </h3>
            <span className="text-xs text-emerald-800 font-bold bg-emerald-50 px-2.5 py-1 rounded-full font-mono">
              Max Spendable: BDT {summary.remainingSpendableBalance.toLocaleString()}
            </span>
          </div>

          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-300 text-rose-800 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleExpenseSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Expense Amount (BDT) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max={summary.remainingSpendableBalance}
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    placeholder="e.g. 5000"
                    required
                    className="w-full pl-12 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm font-mono font-bold focus:border-emerald-600 focus:outline-hidden"
                  />
                  <span className="absolute left-3.5 top-2.5 text-xs font-bold text-slate-400">BDT</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Expense Category *
                </label>
                <select
                  value={expenseCategory}
                  onChange={(e) => setExpenseCategory(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 focus:border-emerald-600 focus:outline-hidden"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Detailed Description *
                </label>
                <input
                  type="text"
                  value={expenseDescription}
                  onChange={(e) => setExpenseDescription(e.target.value)}
                  placeholder="e.g. Van transportation cost for 200 water dispensers from district vendor"
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-xs focus:border-emerald-600 focus:outline-hidden"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <span>Expense Date *</span>
                    <span className="text-[9px] font-black text-emerald-800 bg-emerald-100/90 px-1.5 py-0.5 rounded flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" />
                      AUTO REAL-TIME
                    </span>
                  </label>
                  <span className="text-[10px] text-slate-400 font-medium">Locked</span>
                </div>
                <div className="relative">
                  <input
                    type="date"
                    value={expenseDate}
                    readOnly
                    tabIndex={-1}
                    required
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-slate-700 text-xs font-mono font-bold cursor-not-allowed select-none focus:outline-hidden"
                  />
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Auto-matched to real-time system date. Cannot be modified.
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <span>Expense Time *</span>
                    <span className="text-[9px] font-black text-emerald-800 bg-emerald-100/90 px-1.5 py-0.5 rounded flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" />
                      AUTO REAL-TIME
                    </span>
                  </label>
                  <span className="text-[10px] text-slate-400 font-medium">Locked</span>
                </div>
                <div className="relative">
                  <input
                    type="time"
                    value={expenseTime}
                    readOnly
                    tabIndex={-1}
                    required
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-slate-700 text-xs font-mono font-bold cursor-not-allowed select-none focus:outline-hidden"
                  />
                  <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Auto-matched to real-time system clock. Cannot be modified.
                </p>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Vendor / Shop / Contractor Name (Optional)
                </label>
                <input
                  type="text"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  placeholder="e.g. Al-Amin Printing Press, Faridpur"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-xs focus:border-emerald-600 focus:outline-hidden"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Receipt / Voucher Image (Optional)
                </label>

                {receiptUrl ? (
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={receiptUrl}
                        alt="Receipt preview thumbnail"
                        className="w-14 h-14 object-cover rounded-xl border border-slate-300 shadow-2xs cursor-pointer hover:opacity-90 transition"
                        onClick={() => setShowDraftPreviewModal(true)}
                        title="Click to preview voucher"
                      />
                      <div>
                        <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                          Receipt / Voucher Image Attached
                        </span>
                        <p className="text-[11px] text-slate-500">
                          Captured voucher ready for submission & Super Admin review
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowDraftPreviewModal(true)}
                        className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <Eye className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Preview</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setReceiptUrl('')}
                        className="px-3 py-1.5 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                        <span>Remove</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Camera Button */}
                    <button
                      type="button"
                      onClick={() => setIsCameraOpen(true)}
                      className="flex items-center justify-center gap-2.5 p-3.5 bg-emerald-50 hover:bg-emerald-100/90 border border-emerald-300 rounded-2xl text-emerald-900 text-xs font-bold transition cursor-pointer group shadow-2xs"
                    >
                      <div className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center group-hover:scale-105 transition-transform">
                        <Camera className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <span className="block font-black text-xs text-emerald-950">Take Photo with Camera</span>
                        <span className="text-[10px] text-emerald-700 font-normal">Use mobile or webcam scanner</span>
                      </div>
                    </button>

                    {/* File Upload Button */}
                    <label className="flex items-center justify-center gap-2.5 p-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-2xl text-slate-700 text-xs font-bold transition cursor-pointer group shadow-2xs">
                      <div className="w-7 h-7 rounded-xl bg-slate-700 text-white flex items-center justify-center group-hover:scale-105 transition-transform">
                        <Upload className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <span className="block font-black text-xs text-slate-900">Upload Voucher File</span>
                        <span className="text-[10px] text-slate-500 font-normal">JPEG, PNG, WebP (max 5 MB)</span>
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleReceiptUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider cursor-pointer shadow-xs"
              >
                [ SUBMIT EXPENSE ]
              </button>
            </div>
          </form>
        </div>
      )}

      {/* DAILY EXPENSE HISTORY TABLE (Requirement 8D) */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-4">
        <div className="flex justify-between items-center border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
              My Recorded Expense History
            </h3>
          </div>
          <span className="text-xs font-bold text-slate-500 font-mono">
            {staffExpensesList.length} expenses
          </span>
        </div>

        {staffExpensesList.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center">
            No expenses recorded by your account yet. Use the "Add New Daily Expense" button above.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">Date & Time</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3">Vendor</th>
                  <th className="py-2.5 px-3 text-right">Amount (BDT)</th>
                  <th className="py-2.5 px-3 text-center">Receipt</th>
                  <th className="py-2.5 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginate(staffExpensesList, expensePage, expensePageSize).map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                      {exp.expenseDate} {exp.expenseTime}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800">{exp.category}</td>
                    <td className="py-2.5 px-3 text-slate-600 max-w-xs">{exp.description}</td>
                    <td className="py-2.5 px-3 text-slate-500">{exp.vendorName || '—'}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900">
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
                    <td className="py-2.5 px-3 text-right">
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Global Pagination */}
        <GlobalPagination
          currentPage={expensePage}
          totalRecords={staffExpensesList.length}
          pageSize={expensePageSize}
          onPageChange={setExpensePage}
          onPageSizeChange={setExpensePageSize}
        />
      </div>

      {/* CAMERA SCANNER MODAL */}
      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={(dataUrl) => {
          setReceiptUrl(dataUrl);
          setFormError('');
        }}
        title="Capture Receipt / Voucher Photo"
        instructions="Position the physical receipt or cash voucher clearly within the frame. Ensure numbers and date are legible."
      />

      {/* VIEW VOUCHER POPUP MODAL FOR RECORDED HISTORY */}
      <VoucherModal
        isOpen={Boolean(viewingVoucherExpense)}
        onClose={() => setViewingVoucherExpense(null)}
        expense={viewingVoucherExpense}
      />

      {/* DRAFT RECEIPT PREVIEW POPUP MODAL */}
      {showDraftPreviewModal && receiptUrl && (
        <VoucherModal
          isOpen={showDraftPreviewModal}
          onClose={() => setShowDraftPreviewModal(false)}
          expense={{
            id: 'DRAFT-NEW',
            staffId: staffUser.id,
            staffName: staffUser.fullName,
            amount: Number(expenseAmount) || 0,
            category: expenseCategory,
            description: expenseDescription || 'Draft expense voucher preview',
            expenseDate,
            expenseTime,
            vendorName,
            receiptUrl,
            status: 'SUBMITTED',
            createdAt: new Date().toISOString(),
          }}
        />
      )}
    </div>
  );
};
