import React, { useState } from 'react';
import {
  DollarSign,
  TrendingUp,
  Receipt,
  Plus,
  Search,
  Filter,
  Download,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Building,
  HandCoins,
  X,
} from 'lucide-react';
import { RegistrationRecord, Language } from '../../../types';
import { RmsExpense, BudgetRequest, RmsSponsor, BudgetStatus } from '../../../types/rms';
import { RmsStore } from '../../../services/rmsStore';
import { AppStore } from '../../../services/store';
import { formatCsvRow } from '../../../utils/security';
import { GlobalPagination } from '../../common/GlobalPagination';
import { paginate } from '../../../utils/pagination';

interface Props {
  language: Language;
  registrations: RegistrationRecord[];
}

export const AdminRmsFinanceManagement: React.FC<Props> = ({ language, registrations }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'expenses' | 'requisitions' | 'sponsors'>('overview');

  const [expenses, setExpenses] = useState<RmsExpense[]>(() => RmsStore.getExpenses());
  const [budgetRequests, setBudgetRequests] = useState<BudgetRequest[]>(() => RmsStore.getBudgetRequests());
  const [sponsors, setSponsors] = useState<RmsSponsor[]>(() => RmsStore.getSponsors());
  const committees = RmsStore.getCommittees();
  const donations = AppStore.getDonations();
  const currentUser = RmsStore.getCurrentUser();

  // Filters
  const [expenseSearch, setExpenseSearch] = useState('');
  const [expenseCommFilter, setExpenseCommFilter] = useState('all');

  // Global Pagination State (Default 10, options 10, 20, 30, 40)
  const [expensePage, setExpensePage] = useState(1);
  const [expensePageSize, setExpensePageSize] = useState(10);

  // Reset to page 1 on search or filter change
  React.useEffect(() => {
    setExpensePage(1);
  }, [expenseSearch, expenseCommFilter]);

  // Modals
  const [isRecordExpenseModalOpen, setIsRecordExpenseModalOpen] = useState(false);
  const [isRequisitionModalOpen, setIsRequisitionModalOpen] = useState(false);
  const [reversalTarget, setReversalTarget] = useState<RmsExpense | null>(null);
  const [reversalReason, setReversalReason] = useState('');

  // Record Expense Form
  const [expTitle, setExpTitle] = useState('');
  const [expCommId, setExpCommId] = useState('food-catering');
  const [expCategory, setExpCategory] = useState('Catering & Food Service');
  const [expAmount, setExpAmount] = useState<number>(50000);
  const [expMethod, setExpMethod] = useState<RmsExpense['paymentMethod']>('BANK_TRANSFER');
  const [expVendor, setExpVendor] = useState('');
  const [expVoucherNum, setExpVoucherNum] = useState(`VOUCHER-${Math.floor(1000 + Math.random() * 9000)}`);
  const [expDate, setExpDate] = useState(new Date().toISOString().split('T')[0]);

  // Budget Request Form
  const [reqTitle, setReqTitle] = useState('');
  const [reqCommId, setReqCommId] = useState('cultural-affairs');
  const [reqCategory, setReqCategory] = useState('Stage & Sound Production');
  const [reqAmount, setReqAmount] = useState<number>(100000);
  const [reqDesc, setReqDesc] = useState('');

  const reloadData = () => {
    setExpenses(RmsStore.getExpenses());
    setBudgetRequests(RmsStore.getBudgetRequests());
    setSponsors(RmsStore.getSponsors());
  };

  // Financial calculations
  const verifiedTicketRevenue = registrations
    .filter((r) => r.paymentStatus === 'paid')
    .reduce((sum, r) => sum + (r.totalPaid || r.registrationFee || 0), 0);

  const verifiedDonationRevenue = donations
    .filter((d) => d.paymentStatus === 'paid' || !d.paymentStatus)
    .reduce((sum, d) => sum + (d.amount || 0), 0);

  const verifiedSponsorRevenue = sponsors.reduce((sum, s) => sum + (s.receivedAmount || 0), 0);
  const pledgedSponsorRevenue = sponsors.reduce((sum, s) => sum + (s.agreedAmount || 0), 0);

  const totalVerifiedIncome = verifiedTicketRevenue + verifiedDonationRevenue + verifiedSponsorRevenue;

  const validExpenses = expenses.filter((e) => e.verificationStatus !== 'REVERSED');
  const totalVerifiedExpenses = validExpenses.reduce((sum, e) => sum + e.amount, 0);

  const netLiquidity = totalVerifiedIncome - totalVerifiedExpenses;

  // Handlers
  const handleRecordExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expTitle.trim() || expAmount <= 0) return;

    const comm = committees.find((c) => c.id === expCommId);

    RmsStore.recordExpense({
      committeeId: expCommId,
      committeeName: comm?.nameEn || 'General Committee',
      expenseTitle: expTitle.trim(),
      expenseCategory: expCategory,
      amount: Number(expAmount),
      paymentMethod: expMethod,
      vendor: expVendor.trim() || 'Official Supplier',
      expenseDate: expDate,
      voucherNumber: expVoucherNum.trim(),
      submittedBy: currentUser.id,
      submittedByName: currentUser.fullName,
    });

    setIsRecordExpenseModalOpen(false);
    setExpTitle('');
    setExpVendor('');
    setExpAmount(50000);
    setExpVoucherNum(`VOUCHER-${Math.floor(1000 + Math.random() * 9000)}`);
    reloadData();
  };

  const handleConfirmReversal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reversalTarget || reversalReason.trim().length < 8) return;

    RmsStore.reverseExpense(
      reversalTarget.id,
      reversalReason.trim(),
      currentUser.fullName
    );

    setReversalTarget(null);
    setReversalReason('');
    reloadData();
  };

  const handleSubmitRequisition = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqTitle.trim() || reqAmount <= 0) return;

    const comm = committees.find((c) => c.id === reqCommId);

    RmsStore.submitBudgetRequest({
      committeeId: reqCommId,
      committeeName: comm?.nameEn || 'General Committee',
      requestTitle: reqTitle.trim(),
      expenseCategory: reqCategory,
      requestedAmount: Number(reqAmount),
      description: reqDesc.trim() || 'Required budget requisition for designated reunion activities.',
      supportingDocuments: [],
      requestedBy: currentUser.id,
      requestedByName: currentUser.fullName,
    });

    setIsRequisitionModalOpen(false);
    setReqTitle('');
    setReqDesc('');
    setReqAmount(100000);
    reloadData();
  };

  const handleTransitionRequisition = (reqId: string, status: BudgetStatus, comments?: string) => {
    RmsStore.updateBudgetRequestStatus(reqId, status, currentUser.fullName, undefined, comments);
    reloadData();
  };

  const handleToggleSponsorBenefit = (sponsorId: string, benefitId: string) => {
    const sp = sponsors.find((s) => s.id === sponsorId);
    if (!sp) return;

    const updatedBenefits = sp.benefits.map((b) =>
      b.id === benefitId ? { ...b, isDelivered: !b.isDelivered } : b
    );

    const updated = { ...sp, benefits: updatedBenefits };
    RmsStore.saveSponsor(updated);
    reloadData();
  };

  const handleExportFinancialStatement = () => {
    const headers = ['Type', 'Reference ID', 'Title/Description', 'Category/Source', 'Amount (BDT)', 'Date', 'Party/Vendor', 'Status'];
    const rows: string[] = [];

    // Verified Ticket Regs
    rows.push(formatCsvRow(['INCOME', 'REG-TICKETS', 'Online Ticket Registrations', 'Student Delegate Fees', verifiedTicketRevenue, new Date().toISOString().split('T')[0], 'Registered Alumni & Students', 'CONFIRMED']));

    // Donations
    donations.forEach((d) => {
      rows.push(formatCsvRow(['INCOME', d.id, `${d.donorName} (${d.purpose})`, 'Alumni Donation', d.amount, d.date, d.donorName, (d.paymentStatus || 'paid').toUpperCase()]));
    });

    // Sponsors
    sponsors.forEach((s) => {
      rows.push(formatCsvRow(['INCOME', s.id, `${s.companyName} (${s.category})`, 'Corporate Sponsorship', s.receivedAmount, s.createdAt.split('T')[0], s.contactPerson, s.paymentStatus]));
    });

    // Expenses
    expenses.forEach((e) => {
      rows.push(formatCsvRow(['EXPENSE', e.voucherNumber, e.expenseTitle, e.committeeName, e.amount, e.expenseDate, e.vendor, e.verificationStatus]));
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [formatCsvRow(headers), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `reunion_2027_financial_statement_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredExpenses = expenses.filter((e) => {
    const matchesSearch =
      e.expenseTitle.toLowerCase().includes(expenseSearch.toLowerCase()) ||
      e.voucherNumber.toLowerCase().includes(expenseSearch.toLowerCase()) ||
      e.vendor.toLowerCase().includes(expenseSearch.toLowerCase());
    const matchesComm = expenseCommFilter === 'all' || e.committeeId === expenseCommFilter;
    return matchesSearch && matchesComm;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-[#172554] text-white p-6 rounded-3xl shadow-lg border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase tracking-wider border border-emerald-400/30">
              Module 7
            </span>
            <span className="text-xs text-slate-300 font-medium">Reunion Management ERP</span>
          </div>
          <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-emerald-400" />
            <span>{language === 'bn' ? 'আর্থিক ব্যবস্থাপনা ও ব্যালেন্স শিট' : 'Finance ERP & Financial Accounts'}</span>
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-xl">
            {language === 'bn'
              ? 'নিবন্ধন ফি, কর্পোরেট স্পনসরশিপ ও অনুদানের সমন্বিত আয়, কমিটির বাজেট রিকুইজিশন এবং ভাউচার ব্যয় নিরীক্ষা করুন।'
              : 'Unified ledger for ticket sales, corporate sponsorships, alumni donations, 3-tier requisition pipeline, and audited voucher management.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <button
            onClick={() => setIsRecordExpenseModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-xs shadow-md transition cursor-pointer"
          >
            <Plus className="w-4 h-4 text-emerald-400" />
            <span>{language === 'bn' ? 'ব্যয় রেকর্ড করুন' : 'Record Expense'}</span>
          </button>

          <button
            onClick={() => setIsRequisitionModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs shadow-md transition cursor-pointer"
          >
            <HandCoins className="w-4 h-4" />
            <span>{language === 'bn' ? 'বাজেট রিকুইজিশন' : 'Budget Requisition'}</span>
          </button>

          <button
            onClick={handleExportFinancialStatement}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition cursor-pointer"
            title="Export CSV Balance Sheet"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Financial Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold">{language === 'bn' ? 'মোট ভেরিফায়েড আয়' : 'Verified Income'}</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-emerald-600">৳{totalVerifiedIncome.toLocaleString('en-IN')}</p>
          <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1">
            <span>Reg: ৳{verifiedTicketRevenue.toLocaleString('en-IN')}</span>
            <span>Spn: ৳{verifiedSponsorRevenue.toLocaleString('en-IN')}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold">{language === 'bn' ? 'অনুমোদিত ব্যয়' : 'Approved Expenses'}</span>
            <Receipt className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-2xl font-black text-rose-600">৳{totalVerifiedExpenses.toLocaleString('en-IN')}</p>
          <span className="text-[10px] text-slate-400 font-mono">
            {validExpenses.length} Verified Vouchers Disbursed
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold">{language === 'bn' ? 'অবশিষ্ট রিজার্ভ তহবিল' : 'Net Liquidity Reserve'}</span>
            <DollarSign className="w-4 h-4 text-blue-500" />
          </div>
          <p className={`text-2xl font-black ${netLiquidity >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>
            ৳{netLiquidity.toLocaleString('en-IN')}
          </p>
          <span className="text-[10px] text-blue-600 font-medium">Available Operating Balance</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold">{language === 'bn' ? 'স্পনসর প্রতিশ্রুতি' : 'Sponsor Pledged'}</span>
            <Building className="w-4 h-4 text-purple-500" />
          </div>
          <p className="text-2xl font-black text-purple-600">৳{pledgedSponsorRevenue.toLocaleString('en-IN')}</p>
          <span className="text-[10px] text-purple-600 font-medium">
            {sponsors.length} Corporate Partners
          </span>
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="flex items-center gap-1 bg-white p-2 rounded-2xl border border-slate-200 shadow-xs overflow-x-auto">
        {[
          { id: 'overview', label: 'Financial Overview', icon: TrendingUp },
          { id: 'expenses', label: `Expense Vouchers (${validExpenses.length})`, icon: Receipt },
          { id: 'requisitions', label: `Budget Pipeline (${budgetRequests.length})`, icon: HandCoins },
          { id: 'sponsors', label: `Sponsorship CRM (${sponsors.length})`, icon: Building },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                isActive ? 'bg-[#172554] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW & COMMITTEE BUDGET UTILIZATION */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Income Source Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ticket Registrations</span>
              <p className="text-xl font-black text-slate-900">৳{verifiedTicketRevenue.toLocaleString('en-IN')}</p>
              <p className="text-[11px] text-slate-500">
                From {registrations.filter((r) => r.paymentStatus === 'paid').length} verified participant payments.
              </p>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Corporate Sponsorships</span>
              <p className="text-xl font-black text-purple-700">৳{verifiedSponsorRevenue.toLocaleString('en-IN')}</p>
              <p className="text-[11px] text-slate-500">
                ৳{(pledgedSponsorRevenue - verifiedSponsorRevenue).toLocaleString('en-IN')} pending tranche collection.
              </p>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Alumni Donations</span>
              <p className="text-xl font-black text-emerald-700">৳{verifiedDonationRevenue.toLocaleString('en-IN')}</p>
              <p className="text-[11px] text-slate-500">
                From {donations.filter((d) => d.paymentStatus === 'paid' || !d.paymentStatus).length} verified philanthropic gifts.
              </p>
            </div>
          </div>

          {/* Committee Budget Consumption */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Building className="w-4 h-4 text-blue-600" />
              <span>Committee Budget Allocations & Expenditure Status</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {committees.map((comm) => {
                const burnPct = comm.budgetAllocated > 0 ? Math.min(100, Math.round((comm.budgetSpent / comm.budgetAllocated) * 100)) : 0;
                return (
                  <div key={comm.id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-900">{comm.nameEn}</span>
                      <span className="font-mono text-slate-600">
                        ৳{comm.budgetSpent.toLocaleString('en-IN')} / ৳{comm.budgetAllocated.toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          burnPct > 90 ? 'bg-rose-500' : burnPct > 70 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${burnPct}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span>Director: {comm.directorName}</span>
                      <span className="font-bold text-slate-700">{burnPct}% utilized</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: EXPENSES & VOUCHER AUDIT */}
      {activeTab === 'expenses' && (
        <div className="space-y-4">
          {/* Filter Toolbar */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search voucher, title, or vendor..."
                value={expenseSearch}
                onChange={(e) => setExpenseSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-hidden"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={expenseCommFilter}
                onChange={(e) => setExpenseCommFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs bg-white text-slate-700 focus:outline-hidden"
              >
                <option value="all">All Committees</option>
                {committees.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nameEn}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Voucher #</th>
                    <th className="px-4 py-3">Expense Title & Category</th>
                    <th className="px-4 py-3">Committee</th>
                    <th className="px-4 py-3">Vendor / Payee</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Method</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Audit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginate(filteredExpenses, expensePage, expensePageSize).map((exp) => (
                    <tr key={exp.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">{exp.voucherNumber}</td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{exp.expenseTitle}</div>
                        <div className="text-[10px] text-slate-400">{exp.expenseCategory}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 font-medium">{exp.committeeName}</td>
                      <td className="px-4 py-3 text-slate-600">{exp.vendor}</td>
                      <td className="px-4 py-3 font-mono font-black text-slate-900">
                        ৳{exp.amount.toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                          {exp.paymentMethod}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            exp.verificationStatus === 'VERIFIED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : exp.verificationStatus === 'REVERSED'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {exp.verificationStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {exp.verificationStatus === 'VERIFIED' && (
                          <button
                            onClick={() => {
                              setReversalTarget(exp);
                              setReversalReason('');
                            }}
                            className="px-2.5 py-1 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-bold transition flex items-center gap-1 ml-auto cursor-pointer"
                            title="Reverse Expense Voucher"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Reverse</span>
                          </button>
                        )}
                        {exp.verificationStatus === 'REVERSED' && (
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
              totalRecords={filteredExpenses.length}
              pageSize={expensePageSize}
              onPageChange={setExpensePage}
              onPageSizeChange={setExpensePageSize}
              language={language}
            />
          </div>
        </div>
      )}

      {/* TAB 3: BUDGET REQUISITION PIPELINE */}
      {activeTab === 'requisitions' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {budgetRequests.map((req) => (
              <div key={req.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-mono text-slate-400">#{req.id}</span>
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          req.status === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : req.status === 'RECOMMENDED'
                            ? 'bg-blue-100 text-blue-800'
                            : req.status === 'FINANCE_REVIEWED'
                            ? 'bg-purple-100 text-purple-800'
                            : req.status === 'REJECTED'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {req.status.replace('_', ' ')}
                      </span>
                    </div>
                    <h4 className="text-sm font-black text-slate-900">{req.requestTitle}</h4>
                  </div>
                  <span className="font-mono font-black text-base text-slate-900">
                    ৳{req.requestedAmount.toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 space-y-1">
                  <p><b>Committee:</b> {req.committeeName}</p>
                  <p><b>Category:</b> {req.expenseCategory}</p>
                  <p className="text-slate-500">{req.description}</p>
                  <p className="text-[10px] text-slate-400 pt-1">
                    Requested by <b>{req.requestedByName}</b> on {req.requestDate}
                  </p>
                </div>

                {/* Workflow Transitions */}
                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-[10px] text-slate-400">
                    {req.status === 'APPROVED' && (
                      <span className="text-emerald-700 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Approved by {req.approvedByName}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {req.status === 'SUBMITTED' && (
                      <button
                        onClick={() => handleTransitionRequisition(req.id, 'FINANCE_REVIEWED', 'Finance desk initial audit complete')}
                        className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                      >
                        Finance Review
                      </button>
                    )}

                    {req.status === 'FINANCE_REVIEWED' && (
                      <button
                        onClick={() => handleTransitionRequisition(req.id, 'RECOMMENDED', 'Recommended for Convener sanction')}
                        className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                      >
                        Recommend
                      </button>
                    )}

                    {(req.status === 'RECOMMENDED' || req.status === 'FINANCE_REVIEWED') && (
                      <>
                        <button
                          onClick={() => handleTransitionRequisition(req.id, 'APPROVED')}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Approve</span>
                        </button>
                        <button
                          onClick={() => handleTransitionRequisition(req.id, 'REJECTED', 'Insufficient allocation')}
                          className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1"
                        >
                          <XCircle className="w-3 h-3" />
                          <span>Decline</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: SPONSORSHIP CRM */}
      {activeTab === 'sponsors' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sponsors.map((sponsor) => (
              <div key={sponsor.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        sponsor.category === 'TITLE_SPONSOR'
                          ? 'bg-amber-100 text-amber-800'
                          : sponsor.category === 'PLATINUM'
                          ? 'bg-slate-200 text-slate-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {sponsor.category.replace('_', ' ')}
                    </span>
                    <h4 className="text-base font-black text-slate-900 mt-1">{sponsor.companyName}</h4>
                    <p className="text-xs text-slate-500">
                      Contact: {sponsor.contactPerson} ({sponsor.phone})
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block">Agreed / Received</span>
                    <span className="font-mono font-black text-sm text-slate-900">
                      ৳{sponsor.receivedAmount.toLocaleString('en-IN')} / ৳{sponsor.agreedAmount.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                {/* Benefits Delivery Checklist */}
                <div className="pt-2 border-t border-slate-100 space-y-1.5">
                  <span className="text-xs font-bold text-slate-700 block">Sponsor Deliverables & Benefits:</span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {sponsor.benefits.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => handleToggleSponsorBenefit(sponsor.id, b.id)}
                        className={`p-2 rounded-xl border text-left flex items-center justify-between gap-1 transition cursor-pointer ${
                          b.isDelivered
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <span className="truncate">{b.name}</span>
                        {b.isDelivered ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        ) : (
                          <span className="w-3 h-3 rounded-full border border-slate-300 shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL 1: RECORD EXPENSE */}
      {isRecordExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-900">
                {language === 'bn' ? 'কমিটি ব্যয় ভাউচার রেকর্ড করুন' : 'Record Audited Expense Voucher'}
              </h3>
              <button
                onClick={() => setIsRecordExpenseModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordExpense} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Expense Title / Item *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 5000 Reunion Souvenir Badges & Lanyards"
                  value={expTitle}
                  onChange={(e) => setExpTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Committee *</label>
                  <select
                    value={expCommId}
                    onChange={(e) => setExpCommId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-hidden"
                  >
                    {committees.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nameEn}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Category</label>
                  <input
                    type="text"
                    value={expCategory}
                    onChange={(e) => setExpCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Amount (BDT) *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={expAmount}
                    onChange={(e) => setExpAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-hidden font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Payment Method</label>
                  <select
                    value={expMethod}
                    onChange={(e) => setExpMethod(e.target.value as RmsExpense['paymentMethod'])}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-hidden"
                  >
                    <option value="BANK_TRANSFER">Bank Transfer / Pay Order</option>
                    <option value="BKASH">bKash</option>
                    <option value="NAGAD">Nagad</option>
                    <option value="CHEQUE">Bank Cheque</option>
                    <option value="CASH">Petty Cash</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Vendor / Payee *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Royal Printers, Faridpur"
                    value={expVendor}
                    onChange={(e) => setExpVendor(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Voucher Number *</label>
                  <input
                    type="text"
                    required
                    value={expVoucherNum}
                    onChange={(e) => setExpVoucherNum(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-hidden font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Expense Date</label>
                <input
                  type="date"
                  value={expDate}
                  onChange={(e) => setExpDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-hidden"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsRecordExpenseModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition cursor-pointer"
                >
                  Record Voucher
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: SUBMIT BUDGET REQUISITION */}
      {isRequisitionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-900">
                {language === 'bn' ? 'বাজেট রিকুইজিশন দাখিল করুন' : 'Submit Committee Budget Requisition'}
              </h3>
              <button
                onClick={() => setIsRequisitionModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitRequisition} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Requisition Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sound System & Stage Light Advance Requisition"
                  value={reqTitle}
                  onChange={(e) => setReqTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Committee *</label>
                  <select
                    value={reqCommId}
                    onChange={(e) => setReqCommId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-hidden"
                  >
                    {committees.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nameEn}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Category</label>
                  <input
                    type="text"
                    value={reqCategory}
                    onChange={(e) => setReqCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Requested Amount (BDT) *</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={reqAmount}
                  onChange={(e) => setReqAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-hidden font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Requisition Justification & Breakdown</label>
                <textarea
                  rows={3}
                  placeholder="Detail why this allocation is urgently needed and how it will be audited..."
                  value={reqDesc}
                  onChange={(e) => setReqDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-hidden"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsRequisitionModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition cursor-pointer"
                >
                  Submit Requisition
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: EXPENSE REVERSAL WITH MANDATORY JUSTIFICATION AUDIT */}
      {reversalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-black text-rose-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
              <span>Authorize Expense Reversal</span>
            </h3>

            <p className="text-xs text-slate-600 leading-relaxed">
              You are about to reverse voucher <b>{reversalTarget.voucherNumber}</b> (৳{reversalTarget.amount.toLocaleString('en-IN')}) for <b>{reversalTarget.expenseTitle}</b>. This will refund the amount back to the committee’s available budget.
            </p>

            <form onSubmit={handleConfirmReversal} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Mandatory Reversal Justification (min 8 characters) *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Duplicate voucher submitted mistakenly by vendor; payment was cancelled by bank."
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-hidden"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setReversalTarget(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reversalReason.trim().length < 8}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl font-bold cursor-pointer transition"
                >
                  Confirm Reversal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
