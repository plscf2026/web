import { useState } from 'react';
import {
  Wallet,
  PlusCircle,
  Clock,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { StaffAccount, Language } from '../types';
import { EventStore } from '../services/eventStore';
import { calculateStaffFinancialSummary } from '../utils/eventRules';
import { readValidatedImage } from '../utils/fileValidation';
import { sanitizeUrl } from '../utils/security';

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

  // Add Expense Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('Logistics & Transport');
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [expenseTime, setExpenseTime] = useState(() => new Date().toTimeString().slice(0, 5));
  const [vendorName, setVendorName] = useState('');
  const [receiptUrl, setReceiptUrl] = useState('');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

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

    const res = EventStore.submitStaffExpense(
      staffUser.id,
      staffUser.fullName,
      amt,
      expenseCategory,
      expenseDescription.trim(),
      expenseDate,
      expenseTime,
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
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Expense Date *
                </label>
                <input
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Expense Time *
                </label>
                <input
                  type="time"
                  value={expenseTime}
                  onChange={(e) => setExpenseTime(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Vendor / Shop / Contractor Name (Optional)
                </label>
                <input
                  type="text"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  placeholder="e.g. Al-Amin Printing Press, Faridpur"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Receipt / Voucher Image (Optional)
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleReceiptUpload}
                  className="w-full text-xs text-slate-500 file:mr-2 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-slate-100 file:text-slate-800 hover:file:bg-slate-200"
                />
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
                {staffExpensesList.map((exp) => (
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
                        <a
                          href={sanitizeUrl(exp.receiptUrl)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-indigo-600 hover:underline font-bold"
                        >
                          View Voucher
                        </a>
                      ) : (
                        <span className="text-slate-400">—</span>
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
      </div>
    </div>
  );
};
