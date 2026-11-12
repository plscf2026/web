import { useState } from 'react';
import {
  DollarSign,
  Plus,
  AlertTriangle,
  Download,
  X,
} from 'lucide-react';
import { RmsStore } from '../../services/rmsStore';
import { BudgetRequest, RmsExpense, CommitteeId } from '../../types/rms';
import { Language } from '../../types';
import { formatCsvRow } from '../../utils/security';
import { GlobalPagination } from '../common/GlobalPagination';
import { paginate } from '../../utils/pagination';

interface RmsFinanceModuleProps {
  language?: Language;
  currentUser?: unknown;
  canApprove?: boolean;
  canVerify?: boolean;
}

export const RmsFinanceModule: React.FC<RmsFinanceModuleProps> = ({
  language = 'en',
}) => {
  const [activeTab, setActiveTab] = useState<'BUDGET_REQUESTS' | 'EXPENSES' | 'INCOME'>('BUDGET_REQUESTS');
  const [budgetRequests, setBudgetRequests] = useState<BudgetRequest[]>(() => RmsStore.getBudgetRequests());
  const [expenses, setExpenses] = useState<RmsExpense[]>(() => RmsStore.getExpenses());
  const [incomeList] = useState(() => RmsStore.getIncomeTransactions());
  const committees = RmsStore.getCommittees();
  const currentUser = RmsStore.getCurrentUser();

  // Global Pagination States (Default 10, options 10, 20, 30, 40)
  const [expensePage, setExpensePage] = useState(1);
  const [expensePageSize, setExpensePageSize] = useState(10);

  const [incomePage, setIncomePage] = useState(1);
  const [incomePageSize, setIncomePageSize] = useState(10);

  // Modals
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showReversalModal, setShowReversalModal] = useState<RmsExpense | null>(null);

  // Forms
  const [reqTitle, setReqTitle] = useState('');
  const [reqCategory, setReqCategory] = useState('Logistics & Setup');
  const [reqAmount, setReqAmount] = useState<number>(50000);
  const [reqCommId, setReqCommId] = useState<CommitteeId>('food-catering');
  const [reqDesc, setReqDesc] = useState('');

  const [expTitle, setExpTitle] = useState('');
  const [expCategory, setExpCategory] = useState('Procurement');
  const [expAmount, setExpAmount] = useState<number>(20000);
  const [expCommId, setExpCommId] = useState<CommitteeId>('registration-database');
  const [expVendor, setExpVendor] = useState('');
  const [expMethod, setExpMethod] = useState<'CASH' | 'BKASH' | 'NAGAD' | 'BANK_TRANSFER' | 'CHEQUE'>('BKASH');
  const [expVoucher, setExpVoucher] = useState(`VOUCHER-${Math.floor(100 + Math.random() * 900)}`);

  const [reversalReason, setReversalReason] = useState('');

  const refreshData = () => {
    setBudgetRequests(RmsStore.getBudgetRequests());
    setExpenses(RmsStore.getExpenses());
  };

  const handleCreateBudgetRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqTitle.trim()) return;

    const comm = committees.find((c) => c.id === reqCommId);
    RmsStore.submitBudgetRequest({
      committeeId: reqCommId,
      committeeName: comm ? comm.nameEn : 'Committee',
      requestTitle: reqTitle.trim(),
      expenseCategory: reqCategory,
      requestedAmount: Number(reqAmount) || 0,
      description: reqDesc.trim(),
      supportingDocuments: [],
      requestedBy: currentUser.id,
      requestedByName: currentUser.fullName,
    });

    setShowBudgetModal(false);
    setReqTitle('');
    setReqDesc('');
    refreshData();
  };

  const handleCreateExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expTitle.trim() || !expVendor.trim()) return;

    const comm = committees.find((c) => c.id === expCommId);
    RmsStore.recordExpense({
      committeeId: expCommId,
      committeeName: comm ? comm.nameEn : 'Committee',
      expenseTitle: expTitle.trim(),
      expenseCategory: expCategory,
      amount: Number(expAmount) || 0,
      paymentMethod: expMethod,
      vendor: expVendor.trim(),
      expenseDate: new Date().toISOString().split('T')[0],
      voucherNumber: expVoucher,
      submittedBy: currentUser.id,
      submittedByName: currentUser.fullName,
    });

    setShowExpenseModal(false);
    setExpTitle('');
    setExpVendor('');
    refreshData();
  };

  const handleConfirmReversal = () => {
    if (!showReversalModal || !reversalReason.trim() || reversalReason.trim().length < 8) return;
    RmsStore.reverseExpense(showReversalModal.id, reversalReason.trim(), currentUser.fullName);
    setShowReversalModal(null);
    setReversalReason('');
    refreshData();
  };

  // Financial Aggregates
  const totalAllocated = committees.reduce((sum, c) => sum + c.budgetAllocated, 0);
  const totalSpent = expenses
    .filter((e) => e.verificationStatus !== 'REVERSED')
    .reduce((sum, e) => sum + e.amount, 0);
  const totalIncome = incomeList.reduce((sum, i) => sum + (i.status === 'CONFIRMED' ? i.amount : 0), 0);

  const exportFinancialCSV = () => {
    const headers = ['Voucher Number', 'Date', 'Committee', 'Expense Title', 'Category', 'Vendor', 'Amount (BDT)', 'Method', 'Status'];
    const rows = expenses.map((e) => [
      e.voucherNumber,
      e.expenseDate,
      e.committeeName,
      e.expenseTitle,
      e.expenseCategory,
      e.vendor,
      e.amount,
      e.paymentMethod,
      e.verificationStatus,
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [formatCsvRow(headers), ...rows.map((r) => formatCsvRow(r))].join('\n');
    const encoded = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encoded);
    link.setAttribute('download', `Reunion2027_Financial_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-black text-slate-900 font-clash flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-600" />
            <span>{language === 'bn' ? 'বাজেট, ব্যয় ও হিসাব ব্যবস্থাপনা' : 'Financial Ledger & Budget Control'}</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Authoritative budget approvals, verified expenditure vouchers, and audit-compliant reversal tracking.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={exportFinancialCSV}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => setShowBudgetModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-700 hover:bg-sky-800 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Submit Budget Request</span>
          </button>

          <button
            onClick={() => setShowExpenseModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-amber-400" />
            <span>Record Expense</span>
          </button>
        </div>
      </div>

      {/* Financial KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Approved Budget</span>
          <span className="text-2xl font-black text-slate-900 font-mono mt-1 block">
            ৳ {(totalAllocated / 100000).toFixed(2)} Lac
          </span>
          <span className="text-[11px] text-slate-500 mt-0.5 block">Allocated across 12 departments</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Verified Expenses</span>
          <span className="text-2xl font-black text-rose-700 font-mono mt-1 block">
            ৳ {(totalSpent / 100000).toFixed(2)} Lac
          </span>
          <span className="text-[11px] text-emerald-600 mt-0.5 block font-semibold">
            Remaining Budget: ৳{((totalAllocated - totalSpent) / 100000).toFixed(2)} Lac
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Sponsorship & Inflow</span>
          <span className="text-2xl font-black text-emerald-700 font-mono mt-1 block">
            ৳ {(totalIncome / 100000).toFixed(2)} Lac
          </span>
          <span className="text-[11px] text-sky-700 mt-0.5 block font-semibold">
            Net Surplus: ৳{((totalIncome - totalSpent) / 100000).toFixed(2)} Lac
          </span>
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="flex border-b border-slate-200 gap-6 text-xs font-bold">
        <button
          onClick={() => setActiveTab('BUDGET_REQUESTS')}
          className={`pb-3 transition-colors cursor-pointer border-b-2 ${
            activeTab === 'BUDGET_REQUESTS'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          Budget Requests & Approvals ({budgetRequests.length})
        </button>

        <button
          onClick={() => setActiveTab('EXPENSES')}
          className={`pb-3 transition-colors cursor-pointer border-b-2 ${
            activeTab === 'EXPENSES'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          Operational Expenses & Vouchers ({expenses.length})
        </button>

        <button
          onClick={() => setActiveTab('INCOME')}
          className={`pb-3 transition-colors cursor-pointer border-b-2 ${
            activeTab === 'INCOME'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          Income & Sponsorship Inflow ({incomeList.length})
        </button>
      </div>

      {/* TAB 1: BUDGET REQUESTS PIPELINE */}
      {activeTab === 'BUDGET_REQUESTS' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {budgetRequests.map((req) => (
              <div key={req.id} className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-3">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                      {req.id} • {req.committeeName}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 mt-1 leading-snug">{req.requestTitle}</h3>
                    <span className="text-[11px] text-slate-500 font-medium">Category: {req.expenseCategory}</span>
                  </div>

                  <span
                    className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                      req.status === 'APPROVED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : req.status === 'RECOMMENDED'
                        ? 'bg-purple-100 text-purple-800'
                        : req.status === 'REJECTED'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {req.status}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs">
                  <div className="flex justify-between text-slate-600 mb-1">
                    <span>Requested Amount:</span>
                    <strong className="text-slate-900 font-mono text-sm">৳ {req.requestedAmount.toLocaleString()}</strong>
                  </div>
                  {req.approvedAmount !== undefined && (
                    <div className="flex justify-between text-emerald-700 font-bold pt-1 border-t border-slate-200">
                      <span>Approved Amount:</span>
                      <strong className="font-mono text-sm">৳ {req.approvedAmount.toLocaleString()}</strong>
                    </div>
                  )}
                </div>

                <p className="text-[11px] text-slate-600 leading-relaxed">{req.description}</p>

                {/* Workflow actions */}
                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-[10px] text-slate-400">By {req.requestedByName} on {req.requestDate}</span>

                  <div className="flex gap-1.5">
                    {req.status === 'SUBMITTED' && (
                      <button
                        onClick={() => {
                          RmsStore.updateBudgetRequestStatus(req.id, 'RECOMMENDED', currentUser.fullName);
                          refreshData();
                        }}
                        className="px-2.5 py-1 rounded-lg bg-purple-700 text-white text-[11px] font-bold cursor-pointer hover:bg-purple-800"
                      >
                        Recommend (Finance)
                      </button>
                    )}

                    {(req.status === 'SUBMITTED' || req.status === 'RECOMMENDED') && (
                      <button
                        onClick={() => {
                          RmsStore.updateBudgetRequestStatus(req.id, 'APPROVED', currentUser.fullName, req.requestedAmount);
                          refreshData();
                        }}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-bold cursor-pointer hover:bg-emerald-700"
                      >
                        Approve (Convener)
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: EXPENSES & VOUCHERS */}
      {activeTab === 'EXPENSES' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] font-bold border-b border-slate-200">
                  <th className="py-3 px-4">Voucher #</th>
                  <th className="py-3 px-4">Expense Title</th>
                  <th className="py-3 px-4">Committee</th>
                  <th className="py-3 px-4">Vendor</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Reversal Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginate(expenses, expensePage, expensePageSize).map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-sky-700">{exp.voucherNumber}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">{exp.expenseTitle}</td>
                    <td className="py-3 px-4 text-slate-600">{exp.committeeName}</td>
                    <td className="py-3 px-4 text-slate-700">{exp.vendor}</td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">৳ {exp.amount.toLocaleString()}</td>
                    <td className="py-3 px-4 uppercase text-[10px] text-slate-500 font-semibold">{exp.paymentMethod}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          exp.verificationStatus === 'REVERSED'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {exp.verificationStatus}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {exp.verificationStatus !== 'REVERSED' ? (
                        <button
                          onClick={() => setShowReversalModal(exp)}
                          className="px-2.5 py-1 rounded-lg border border-rose-300 text-rose-700 hover:bg-rose-50 text-[11px] font-bold cursor-pointer"
                        >
                          Reverse
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">Reversed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Expenses Global Pagination */}
          <GlobalPagination
            currentPage={expensePage}
            totalRecords={expenses.length}
            pageSize={expensePageSize}
            onPageChange={setExpensePage}
            onPageSizeChange={setExpensePageSize}
            language={language}
          />
        </div>
      )}

      {/* TAB 3: INCOME */}
      {activeTab === 'INCOME' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] font-bold border-b border-slate-200">
                  <th className="py-3 px-4">Reference</th>
                  <th className="py-3 px-4">Source Title</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Payment Method</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginate(incomeList, incomePage, incomePageSize).map((inc) => (
                  <tr key={inc.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-700">{inc.referenceId}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">{inc.sourceTitle}</td>
                    <td className="py-3 px-4 font-semibold text-sky-700">{inc.source}</td>
                    <td className="py-3 px-4 font-mono font-bold text-emerald-700">৳ {inc.amount.toLocaleString()}</td>
                    <td className="py-3 px-4 text-slate-600">{inc.paymentMethod}</td>
                    <td className="py-3 px-4 text-slate-500 font-mono">{inc.receivedDate}</td>
                    <td className="py-3 px-4">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                        {inc.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Income Global Pagination */}
          <GlobalPagination
            currentPage={incomePage}
            totalRecords={incomeList.length}
            pageSize={incomePageSize}
            onPageChange={setIncomePage}
            onPageSizeChange={setIncomePageSize}
            language={language}
          />
        </div>
      )}

      {/* Submit Budget Request Modal */}
      {showBudgetModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 border border-slate-200 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 font-clash">Submit Budget Request</h3>
              <button onClick={() => setShowBudgetModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateBudgetRequest} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Request Title *</label>
                <input
                  type="text"
                  required
                  value={reqTitle}
                  onChange={(e) => setReqTitle(e.target.value)}
                  placeholder="e.g. Stage Sound Monitor & Acoustic Speakers"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Committee *</label>
                  <select
                    value={reqCommId}
                    onChange={(e) => setReqCommId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  >
                    {committees.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nameEn}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Requested Amount (BDT) *</label>
                  <input
                    type="number"
                    required
                    value={reqAmount}
                    onChange={(e) => setReqAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Expense Category</label>
                <input
                  type="text"
                  value={reqCategory}
                  onChange={(e) => setReqCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Description & Justification</label>
                <textarea
                  rows={3}
                  value={reqDesc}
                  onChange={(e) => setReqDesc(e.target.value)}
                  placeholder="Market quotation basis, itemized breakdown..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowBudgetModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-slate-900 text-white font-bold cursor-pointer hover:bg-slate-800"
                >
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Expense Modal */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 border border-slate-200 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 font-clash">Record Operational Expense</h3>
              <button onClick={() => setShowExpenseModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateExpense} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Expense Title *</label>
                <input
                  type="text"
                  required
                  value={expTitle}
                  onChange={(e) => setExpTitle(e.target.value)}
                  placeholder="e.g. Printing of 2,000 Program Schedule Flyers"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Committee *</label>
                  <select
                    value={expCommId}
                    onChange={(e) => setExpCommId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  >
                    {committees.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nameEn}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Amount (BDT) *</label>
                  <input
                    type="number"
                    required
                    value={expAmount}
                    onChange={(e) => setExpAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Expense Category</label>
                <select
                  value={expCategory}
                  onChange={(e) => setExpCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                >
                  <option value="Procurement">Procurement</option>
                  <option value="Printing & Publicity">Printing & Publicity</option>
                  <option value="Venue & Logistics">Venue & Logistics</option>
                  <option value="Food & Refreshment">Food & Refreshment</option>
                  <option value="Artists & Entertainment">Artists & Entertainment</option>
                  <option value="Technology & SMS">Technology & SMS</option>
                  <option value="Honorarium">Honorarium</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Vendor / Beneficiary *</label>
                  <input
                    type="text"
                    required
                    value={expVendor}
                    onChange={(e) => setExpVendor(e.target.value)}
                    placeholder="Company or Person name"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Payment Method</label>
                  <select
                    value={expMethod}
                    onChange={(e) => setExpMethod(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  >
                    <option value="BKASH">bKash</option>
                    <option value="NAGAD">Nagad</option>
                    <option value="BANK_TRANSFER">Bank Wire</option>
                    <option value="CASH">Cash</option>
                    <option value="CHEQUE">Cheque</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Voucher / Bill Number</label>
                <input
                  type="text"
                  value={expVoucher}
                  onChange={(e) => setExpVoucher(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowExpenseModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-slate-900 text-white font-bold cursor-pointer hover:bg-slate-800"
                >
                  Record Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mandatory Reversal Modal (No Silent Deletions) */}
      {showReversalModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 border border-rose-200 shadow-2xl">
            <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
              <AlertTriangle className="w-5 h-5" />
              <span>Financial Reversal Audit Confirmation</span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Financial regulations strictly forbid silent deletion of vouchers. A reversal entry will be permanently logged in the audit trail.
            </p>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <span className="font-bold text-slate-900 block">{showReversalModal.expenseTitle}</span>
              <span className="text-slate-500 font-mono">
                ৳{showReversalModal.amount.toLocaleString()} • {showReversalModal.voucherNumber}
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Mandatory Audit Reason (min 8 characters) *
              </label>
              <textarea
                rows={3}
                required
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
                placeholder="State the reason for transaction reversal..."
                className="w-full text-xs p-3 rounded-xl border border-slate-300"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowReversalModal(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={reversalReason.trim().length < 8}
                onClick={handleConfirmReversal}
                className="px-5 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-bold cursor-pointer disabled:opacity-50"
              >
                Execute Reversal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
