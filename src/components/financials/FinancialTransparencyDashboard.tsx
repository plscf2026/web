import React, { useState, useEffect, useMemo } from 'react';
import {
  Wallet,
  HeartHandshake,
  Receipt,
  Scale,
  ShieldCheck,
  Search,
  FileText,
  RefreshCw,
  Layers,
  Utensils,
  Speaker,
  Camera,
  Megaphone,
  BookOpen,
  Shirt,
  Coins,
  Eye,
  Printer,
  Download,
  AlertCircle,
  X,
  UserCheck,
} from 'lucide-react';
import { Language } from '../../types';
import {
  FinancialService,
  FinancialTransparencySummary,
  TransparencyExpenseItem,
  PersonalDonationHistoryResult,
} from '../../services/financialService';

interface FinancialTransparencyDashboardProps {
  language: Language;
  onNavigateDonate?: () => void;
}

export const FinancialTransparencyDashboard: React.FC<FinancialTransparencyDashboardProps> = ({
  language,
  onNavigateDonate,
}) => {
  const isBangla = language === 'bn';

  // ── States ──────────────────────────────────────────────────────────────────
  const [summary, setSummary] = useState<FinancialTransparencySummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'breakdown' | 'donations' | 'myDonations'>('breakdown');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [expenseSearch, setExpenseSearch] = useState('');
  const [donationSearch, setDonationSearch] = useState('');
  const [selectedVoucher, setSelectedVoucher] = useState<TransparencyExpenseItem | null>(null);

  // Personal Donation Lookup state
  const [personalRegId, setPersonalRegId] = useState('');
  const [personalPhone, setPersonalPhone] = useState('');
  const [isVerifyingPersonal, setIsVerifyingPersonal] = useState(false);
  const [personalResult, setPersonalResult] = useState<PersonalDonationHistoryResult | null>(null);
  const [personalError, setPersonalError] = useState<string | null>(null);

  // ── Data Fetching ───────────────────────────────────────────────────────────
  const fetchSummary = async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) setIsRefreshing(true);
    try {
      const data = await FinancialService.getFinancialTransparencySummary();
      setSummary(data);
    } catch (e) {
      console.warn('[FinancialTransparencyDashboard] fetch error:', e);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  // ── Category Icon Mapper ────────────────────────────────────────────────────
  const getCategoryIcon = (iconName?: string) => {
    switch (iconName) {
      case 'Layers': return <Layers className="w-4 h-4" />;
      case 'Utensils': return <Utensils className="w-4 h-4" />;
      case 'Speaker': return <Speaker className="w-4 h-4" />;
      case 'Camera': return <Camera className="w-4 h-4" />;
      case 'Megaphone': return <Megaphone className="w-4 h-4" />;
      case 'ShieldCheck': return <ShieldCheck className="w-4 h-4" />;
      case 'BookOpen': return <BookOpen className="w-4 h-4" />;
      case 'Shirt': return <Shirt className="w-4 h-4" />;
      default: return <Coins className="w-4 h-4" />;
    }
  };

  // ── Filtered Expenses ───────────────────────────────────────────────────────
  const filteredExpenses = useMemo(() => {
    if (!summary?.recent_expenses) return [];
    return summary.recent_expenses.filter((exp) => {
      const matchCat = selectedCategoryId === 'all' || exp.category_id === selectedCategoryId;
      const q = expenseSearch.toLowerCase().trim();
      const matchSearch =
        !q ||
        exp.description.toLowerCase().includes(q) ||
        (exp.description_bn && exp.description_bn.toLowerCase().includes(q)) ||
        (exp.vendor_name && exp.vendor_name.toLowerCase().includes(q)) ||
        (exp.responsible_person && exp.responsible_person.toLowerCase().includes(q)) ||
        (exp.voucher_number && exp.voucher_number.toLowerCase().includes(q));
      return matchCat && matchSearch;
    });
  }, [summary?.recent_expenses, selectedCategoryId, expenseSearch]);

  // ── Filtered Donations ──────────────────────────────────────────────────────
  const filteredDonations = useMemo(() => {
    if (!summary?.recent_donations) return [];
    const q = donationSearch.toLowerCase().trim();
    if (!q) return summary.recent_donations;
    return summary.recent_donations.filter((don) => {
      return (
        don.donor_name.toLowerCase().includes(q) ||
        (don.batch_name && don.batch_name.toLowerCase().includes(q)) ||
        (don.passing_year && don.passing_year.includes(q)) ||
        (don.masked_registration_id && don.masked_registration_id.toLowerCase().includes(q))
      );
    });
  }, [summary?.recent_donations, donationSearch]);

  // ── Personal Lookup Handler ─────────────────────────────────────────────────
  const handleVerifyPersonalDonations = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personalRegId.trim()) {
      setPersonalError(isBangla ? 'অনুগ্রহ করে রেজিস্ট্রেশন আইডি দিন।' : 'Please enter your Registration ID.');
      return;
    }
    if (!personalPhone.trim() || personalPhone.replace(/\D/g, '').length < 4) {
      setPersonalError(
        isBangla
          ? 'যাচাইকরণের জন্য নিবন্ধিত মোবাইলের শেষ ৪টি সংখ্যা দিন।'
          : 'Please enter at least the last 4 digits of your registered mobile number.'
      );
      return;
    }

    setIsVerifyingPersonal(true);
    setPersonalError(null);
    setPersonalResult(null);

    try {
      const res = await FinancialService.verifyPersonalDonationHistory(personalRegId, personalPhone);
      if (res.success) {
        setPersonalResult(res);
      } else {
        setPersonalError(
          res.error ||
            (isBangla
              ? 'যাচাইকরণ ব্যর্থ হয়েছে। অনুগ্রহ করে আইডি এবং মোবাইল নম্বর যাচাই করুন।'
              : 'Verification failed. Please check your Registration ID and mobile digits.')
        );
      }
    } catch (err: any) {
      setPersonalError(err.message || 'Verification service error');
    } finally {
      setIsVerifyingPersonal(false);
    }
  };

  // ── CSV Export ──────────────────────────────────────────────────────────────
  const handleExportCsv = () => {
    if (!summary) return;
    const csvContent = FinancialService.generateFinancialReportCsv(summary);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `PLSCF_Financial_Transparency_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading && !summary) {
    return (
      <section className="py-12 bg-white border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 text-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-3" />
          <p className="text-xs text-slate-500 font-semibold">
            {isBangla ? 'আর্থিক স্বচ্ছতা ড্যাশবোর্ড লোড হচ্ছে...' : 'Loading Financial Transparency Ledger...'}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="py-12 sm:py-16 bg-gradient-to-b from-slate-50 via-white to-slate-50 border-t border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">

        {/* ── HEADER ── */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2 border-b border-slate-200">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{isBangla ? '১০০% প্রকাশ্য ও জবাবদিহিতামূলক তহবিল' : '100% Traceable & Publicly Audited'}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">
              {isBangla ? 'পুনর্মিলনী আর্থিক স্বচ্ছতা ড্যাশবোর্ড' : 'Reunion Financial Transparency Portal'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed">
              {isBangla
                ? 'সুপাবেস ডাটাবেজের সরাসরি লেজার থেকে সংগৃহীত। প্রতিটি টাকা কোথায় জমা হচ্ছে এবং কোথায় ব্যয় হচ্ছে তা সকল শিক্ষার্থী ও শুভানুধ্যায়ীদের জন্য উন্মুক্ত।'
                : 'Directly synchronized with our live Supabase treasury ledger. Complete visibility into total funds collected, patron donations, verified expense vouchers, and net treasury balance.'}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => fetchSummary(true)}
              disabled={isRefreshing}
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title={isBangla ? 'ডাটাবেজ রিফ্রেশ করুন' : 'Refresh from Database'}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-600' : ''}`} />
              <span>{isBangla ? 'হালনাগাদ' : 'Refresh'}</span>
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-sky-400" />
              <span>{isBangla ? 'CSV রিপোর্ট ডাউনলোড' : 'Download CSV'}</span>
            </button>

            {onNavigateDonate && (
              <button
                type="button"
                onClick={onNavigateDonate}
                className="px-4 py-2 rounded-xl bg-[#BE185D] hover:bg-[#9D174D] text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <HeartHandshake className="w-3.5 h-3.5" />
                <span>{isBangla ? 'তহবিলে অনুদান দিন' : 'Contribute / Donate'}</span>
              </button>
            )}
          </div>
        </div>

        {/* ── 1. TOP 4 DYNAMIC FINANCIAL METRIC CARDS ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {/* Card 1: Total Money Collected */}
          <div className="bg-white rounded-3xl p-6 border-2 border-emerald-200/80 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-100/50 rounded-full blur-2xl pointer-events-none -mr-10 -mt-10" />
            <div className="flex items-center justify-between mb-4">
              <span className="p-2.5 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Wallet className="w-5 h-5" />
              </span>
              <span className="text-[10px] uppercase font-black tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                {isBangla ? 'সর্বমোট সংগ্রহ' : 'Total Inflow'}
              </span>
            </div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {isBangla ? 'সর্বমোট সংগৃহীত তহবিল' : 'Total Money Collected'}
            </p>
            <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1 tabular-nums">
              ৳ {summary ? summary.total_collected.toLocaleString() : '...'}
            </h3>
            <p className="text-[11px] text-slate-500 mt-2 flex items-center justify-between border-t border-slate-100 pt-2">
              <span>{isBangla ? 'রেজিস্ট্রেশন ফি:' : 'Reg Fees:'} ৳{summary?.total_registration_fees.toLocaleString() || 0}</span>
              <span className="text-emerald-700 font-bold">{summary?.paid_student_count || 0} {isBangla ? 'শিক্ষার্থী' : 'Students'}</span>
            </p>
          </div>

          {/* Card 2: Total Donations Received */}
          <div className="bg-white rounded-3xl p-6 border-2 border-indigo-200/80 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-100/50 rounded-full blur-2xl pointer-events-none -mr-10 -mt-10" />
            <div className="flex items-center justify-between mb-4">
              <span className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-700 border border-indigo-200">
                <HeartHandshake className="w-5 h-5" />
              </span>
              <span className="text-[10px] uppercase font-black tracking-wider px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                {isBangla ? 'অ্যালামনাই অবদান' : 'Patron Gift'}
              </span>
            </div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {isBangla ? 'সর্বমোট অনুদান প্রাপ্তি' : 'Total Donations Received'}
            </p>
            <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1 tabular-nums">
              ৳ {summary ? summary.total_donations.toLocaleString() : '...'}
            </h3>
            <p className="text-[11px] text-slate-500 mt-2 flex items-center justify-between border-t border-slate-100 pt-2">
              <span>{isBangla ? 'স্বতন্ত্র ও নিবন্ধন অনুদান' : 'Patron & Reg Gifts'}</span>
              <span className="text-indigo-700 font-bold">{summary?.donor_count || 0} {isBangla ? 'অনুদানকারী' : 'Donors'}</span>
            </p>
          </div>

          {/* Card 3: Total Expenses */}
          <div className="bg-white rounded-3xl p-6 border-2 border-rose-200/80 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-rose-100/50 rounded-full blur-2xl pointer-events-none -mr-10 -mt-10" />
            <div className="flex items-center justify-between mb-4">
              <span className="p-2.5 rounded-2xl bg-rose-50 text-rose-700 border border-rose-200">
                <Receipt className="w-5 h-5" />
              </span>
              <span className="text-[10px] uppercase font-black tracking-wider px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                {isBangla ? 'অনুমোদিত ব্যয়' : 'Audited Outflow'}
              </span>
            </div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {isBangla ? 'সর্বমোট অনুমোদিত ব্যয়' : 'Total Verified Expenses'}
            </p>
            <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1 tabular-nums">
              ৳ {summary ? summary.total_expenses.toLocaleString() : '...'}
            </h3>
            <p className="text-[11px] text-slate-500 mt-2 flex items-center justify-between border-t border-slate-100 pt-2">
              <span>{isBangla ? '৯টি ইভেন্ট ক্যাটাগরি' : 'Across 9 Event Sectors'}</span>
              <span className="text-rose-700 font-bold">{summary?.recent_expenses.length || 0} {isBangla ? 'ভাউচার' : 'Vouchers'}</span>
            </p>
          </div>

          {/* Card 4: Remaining Balance */}
          <div className={`bg-white rounded-3xl p-6 border-2 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group ${
            (summary?.remaining_balance ?? 0) >= 0 ? 'border-sky-200/80' : 'border-amber-300'
          }`}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-sky-100/50 rounded-full blur-2xl pointer-events-none -mr-10 -mt-10" />
            <div className="flex items-center justify-between mb-4">
              <span className="p-2.5 rounded-2xl bg-sky-50 text-sky-700 border border-sky-200">
                <Scale className="w-5 h-5" />
              </span>
              <span className={`text-[10px] uppercase font-black tracking-wider px-2 py-0.5 rounded-full ${
                (summary?.remaining_balance ?? 0) >= 0 ? 'bg-sky-100 text-sky-800' : 'bg-amber-100 text-amber-900'
              }`}>
                {isBangla ? 'বর্তমান স্থিতি' : 'Net Balance'}
              </span>
            </div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {isBangla ? 'বর্তমান তহবিল স্থিতি' : 'Remaining Fund Balance'}
            </p>
            <h3 className={`text-2xl sm:text-3xl font-black tracking-tight mt-1 tabular-nums ${
              (summary?.remaining_balance ?? 0) >= 0 ? 'text-sky-900' : 'text-amber-700'
            }`}>
              ৳ {summary ? summary.remaining_balance.toLocaleString() : '...'}
            </h3>
            <p className="text-[11px] text-slate-500 mt-2 flex items-center justify-between border-t border-slate-100 pt-2">
              <span>{isBangla ? 'সংগ্রহ - ব্যয় সমীকরণ' : 'Inflow Minus Outflow'}</span>
              <span className="font-bold text-slate-700">100% {isBangla ? 'স্বচ্ছ' : 'Traceable'}</span>
            </p>
          </div>
        </div>

        {/* ── 2. INTERACTIVE SECTION TABS ── */}
        <div className="bg-white rounded-3xl border border-slate-200 p-2 shadow-xs flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('breakdown')}
            className={`flex-1 py-3 px-4 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'breakdown'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Receipt className="w-4 h-4 text-sky-400" />
            <span>{isBangla ? 'খাতভিত্তিক ব্যয় ও ভাউচার বিবরণ' : 'Expense Breakdown & Vouchers'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('donations')}
            className={`flex-1 py-3 px-4 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'donations'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <HeartHandshake className="w-4 h-4 text-pink-400" />
            <span>{isBangla ? 'প্রকাশ্য অনুদান তালিকা' : 'Donation Transparency Ledger'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('myDonations')}
            className={`flex-1 py-3 px-4 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'myDonations'
                ? 'bg-emerald-700 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-emerald-50/50'
            }`}
          >
            <UserCheck className="w-4 h-4 text-emerald-300" />
            <span>{isBangla ? '🔍 আমার অনুদানের ইতিহাস যাচাই' : '🔍 Check My Donation History'}</span>
          </button>
        </div>

        {/* ── TAB 1: EXPENSE BREAKDOWN & VOUCHERS ── */}
        {activeTab === 'breakdown' && (
          <div className="space-y-8">
            {/* Category Budget Visual Progress Grid */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  <span>{isBangla ? 'খাতভিত্তিক বাজেট বন্টন ও খরচের অগ্রগতি' : 'Category Budget Allocation vs Realized Spend'}</span>
                </h4>
                <span className="text-xs text-slate-500 hidden sm:inline">
                  {isBangla ? 'ক্লিক করে যেকোনো খাতের ভাউচার ফিল্টার করুন' : 'Click a category pill to filter vouchers'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {summary?.categories.map((cat) => {
                  const spent = cat.total_spent || 0;
                  const budget = cat.budget_allocated || 1;
                  const pct = Math.min(100, Math.round((spent / budget) * 100));
                  const isSelected = selectedCategoryId === cat.id;

                  return (
                    <div
                      key={cat.id}
                      onClick={() => setSelectedCategoryId(selectedCategoryId === cat.id ? 'all' : cat.id)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/50 shadow-xs ring-2 ring-indigo-500/20'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="p-1.5 rounded-xl shrink-0"
                            style={{ backgroundColor: `${cat.color || '#4F46E5'}15`, color: cat.color || '#4F46E5' }}
                          >
                            {getCategoryIcon(cat.icon)}
                          </span>
                          <span className="font-bold text-xs text-slate-900 truncate">
                            {isBangla ? cat.name_bn : cat.name_en}
                          </span>
                        </div>
                        <span className="text-xs font-black text-slate-800 whitespace-nowrap tabular-nums">
                          ৳{spent.toLocaleString()}
                        </span>
                      </div>

                      {/* Progress bar */}
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: pct > 90 ? '#E11D48' : pct > 70 ? '#D97706' : cat.color || '#0284C7',
                          }}
                        />
                      </div>

                      <div className="flex justify-between items-center text-[10px] text-slate-500 mt-2 font-medium">
                        <span>{isBangla ? 'বাজেট:' : 'Budget:'} ৳{budget.toLocaleString()}</span>
                        <span>{pct}% {isBangla ? 'ব্যয়িত' : 'spent'} ({cat.expense_count || 0} {isBangla ? 'ভাউচার' : 'vouchers'})</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
              <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                <button
                  type="button"
                  onClick={() => setSelectedCategoryId('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                    selectedCategoryId === 'all'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {isBangla ? 'সকল খাত' : 'All Categories'}
                </button>
                {summary?.categories.map((c) => (
                  <button
                    key={`pill-${c.id}`}
                    type="button"
                    onClick={() => setSelectedCategoryId(c.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                      selectedCategoryId === c.id
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {isBangla ? c.name_bn : c.name_en}
                  </button>
                ))}
              </div>

              <div className="relative min-w-[240px]">
                <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  value={expenseSearch}
                  onChange={(e) => setExpenseSearch(e.target.value)}
                  placeholder={isBangla ? 'ভাউচার বা দায়িত্বশীল খুঁজুন...' : 'Search vouchers, officers...'}
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-900/10"
                />
              </div>
            </div>

            {/* Detailed Expense Voucher Cards */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold px-1">
                <span>
                  {isBangla ? 'প্রদর্শিত ভাউচার সংখ্যা:' : 'Showing Vouchers:'}{' '}
                  <strong className="text-slate-900">{filteredExpenses.length}</strong>
                </span>
                <span>{isBangla ? 'ক্লিক করে রসিদ ও ভাউচার বিস্তারিত দেখুন' : 'Click "View Voucher" to view supporting documents'}</span>
              </div>

              {filteredExpenses.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-3xl border border-slate-200 text-slate-500 text-xs">
                  {isBangla ? 'কোনো ব্যয় রেকর্ড পাওয়া যায়নি।' : 'No expense vouchers matched your search.'}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredExpenses.map((exp) => (
                    <div
                      key={exp.id}
                      className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between space-y-4"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <span className="inline-block px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              {exp.category}
                            </span>
                            <span className="font-mono text-xs font-bold text-slate-400 block">
                              Ref: {exp.voucher_number || exp.id}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-lg font-black text-slate-900 block tabular-nums">
                              ৳{exp.amount.toLocaleString()}
                            </span>
                            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              ✓ {isBangla ? 'যাচাইকৃত' : 'Audited'}
                            </span>
                          </div>
                        </div>

                        <p className="text-xs text-slate-800 leading-relaxed font-medium">
                          {isBangla && exp.description_bn ? exp.description_bn : exp.description}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                        <div className="space-y-0.5">
                          <span className="text-[11px] block text-slate-700 font-semibold">
                            {isBangla ? 'দায়িত্বশীল:' : 'Officer:'} {exp.responsible_person || 'Reunion Secretariat'}
                          </span>
                          <span className="text-[10px] text-slate-400 block">
                            {exp.expense_date} {exp.vendor_name ? `• ${exp.vendor_name}` : ''}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => setSelectedVoucher(exp)}
                          className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                        >
                          <FileText className="w-3.5 h-3.5 text-sky-400" />
                          <span>{isBangla ? 'ভাউচার দেখুন' : 'View Voucher'}</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB 2: PUBLIC DONATION TRANSPARENCY LEDGER ── */}
        {activeTab === 'donations' && (
          <div className="space-y-6">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
              <div className="space-y-0.5">
                <h4 className="text-sm font-bold text-slate-900">
                  {isBangla ? 'স্বচ্ছ অনুদান রেজিস্টার (গোপনীয়তা সংরক্ষিত)' : 'Public Contributor Ledger (Privacy Preserved)'}
                </h4>
                <p className="text-xs text-slate-500">
                  {isBangla
                    ? 'ব্যক্তিগত মোবাইল ও পূর্ণ আইডি গোপন রেখে কেবল নাম, ব্যাচ ও অনুদানের পরিমাণ প্রকাশ করা হয়।'
                    : 'Protects personal phone and email while honoring alumni contributors and transparency.'}
                </p>
              </div>

              <div className="relative min-w-[260px]">
                <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  value={donationSearch}
                  onChange={(e) => setDonationSearch(e.target.value)}
                  placeholder={isBangla ? 'নাম বা ব্যাচ দিয়ে খুঁজুন...' : 'Search by name or batch...'}
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-900/10"
                />
              </div>
            </div>

            {/* Donation Records Grid */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 font-bold">
                      <th className="py-3 px-4">{isBangla ? 'অনুদানকারী শিক্ষার্থী / শুভানুধ্যায়ী' : 'Contributor / Student'}</th>
                      <th className="py-3 px-4">{isBangla ? 'ব্যাচ / পাসের সাল' : 'Batch / Passing Year'}</th>
                      <th className="py-3 px-4">{isBangla ? 'নিবন্ধন আইডি (মাস্কড)' : 'Registration ID (Masked)'}</th>
                      <th className="py-3 px-4">{isBangla ? 'উদ্দেশ্য' : 'Purpose'}</th>
                      <th className="py-3 px-4">{isBangla ? 'পদ্ধতি' : 'Method'}</th>
                      <th className="py-3 px-4">{isBangla ? 'তারিখ' : 'Date'}</th>
                      <th className="py-3 px-4 text-right">{isBangla ? 'অনুদানের পরিমাণ' : 'Amount'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredDonations.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                          {isBangla ? 'কোনো অনুদান রেকর্ড পাওয়া যায়নি।' : 'No contribution records found.'}
                        </td>
                      </tr>
                    ) : (
                      filteredDonations.map((don) => (
                        <tr key={don.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 font-bold text-slate-900 flex items-center gap-2">
                            <span className="w-7 h-7 rounded-full bg-pink-100 text-pink-700 flex items-center justify-center text-xs font-bold shrink-0">
                              {don.donor_name.charAt(0)}
                            </span>
                            <span>{don.donor_name}</span>
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-700">
                            {don.batch_name || don.passing_year ? `${don.batch_name || ''} ${don.passing_year ? `(${don.passing_year})` : ''}` : 'Alumni'}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-slate-500">
                            {don.masked_registration_id || '••••••'}
                          </td>
                          <td className="py-3 px-4 text-slate-600 max-w-[200px] truncate">
                            {don.purpose || 'Reunion Fund'}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-600 uppercase text-[10px]">
                            {don.payment_method || 'bKash'}
                          </td>
                          <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                            {don.donation_date}
                          </td>
                          <td className="py-3 px-4 text-right font-black text-emerald-700 whitespace-nowrap tabular-nums text-sm">
                            ৳{don.amount.toLocaleString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 3: CHECK MY DONATION HISTORY ── */}
        {activeTab === 'myDonations' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-emerald-300 shadow-sm space-y-6">
              <div className="space-y-2 text-center max-w-xl mx-auto">
                <span className="p-3 rounded-2xl bg-emerald-100 text-emerald-800 inline-block mb-1">
                  <UserCheck className="w-7 h-7" />
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  {isBangla ? 'আমার অনুদানের ইতিহাস ও রসিদ যাচাই' : 'Verify My Personal Donation History'}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {isBangla
                    ? 'আপনার রেজিস্ট্রেশন আইডি এবং নিবন্ধিত মোবাইল নম্বরের শেষ ৪টি সংখ্যা দিয়ে ব্যক্তিগত অনুদান ও ডিজিটাল রসিদ নিরাপদে দেখুন।'
                    : 'Enter your Registration ID and the last 4 digits of your registered mobile number for identity verification.'}
                </p>
              </div>

              <form onSubmit={handleVerifyPersonalDonations} className="space-y-4 max-w-md mx-auto">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {isBangla ? 'রেজিস্ট্রেশন আইডি (Registration ID)' : 'Registration ID'} *
                  </label>
                  <input
                    type="text"
                    required
                    value={personalRegId}
                    onChange={(e) => setPersonalRegId(e.target.value.toUpperCase())}
                    placeholder="e.g. PLSCF-2027-F3323"
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 font-mono text-sm uppercase tracking-wide focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                    <span>{isBangla ? 'নিবন্ধিত মোবাইলের শেষ ৪টি সংখ্যা' : 'Registered Mobile (Last 4 Digits)'} *</span>
                    <span className="text-[10px] text-emerald-700 font-normal bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      {isBangla ? 'পরিচয় নিশ্চিতকরণ' : 'Identity Verification'}
                    </span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={11}
                    value={personalPhone}
                    onChange={(e) => setPersonalPhone(e.target.value)}
                    placeholder="e.g. 4390 or 01712344390"
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 font-mono text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
                  />
                </div>

                {personalError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{personalError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isVerifyingPersonal}
                  className="w-full py-3.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isVerifyingPersonal ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>{isBangla ? 'যাচাই করা হচ্ছে...' : 'Verifying Identity...'}</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4 text-emerald-200" />
                      <span>{isBangla ? 'অনুদানের ইতিহাস দেখুন' : 'Verify & View My Donation History'}</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Verification Result Card */}
            {personalResult && (
              <div className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-emerald-400 shadow-xl space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-lg">
                      ✓
                    </div>
                    <div>
                      <h4 className="text-lg font-black text-slate-900">{personalResult.student_name}</h4>
                      <p className="text-xs text-slate-500 font-mono">
                        {personalResult.registration_id} • {personalResult.batch_name || 'General Alumni'}
                      </p>
                    </div>
                  </div>

                  <div className="text-left sm:text-right">
                    <span className="text-xs font-semibold text-slate-500 block">
                      {isBangla ? 'আপনার সর্বমোট অনুদান' : 'Your Total Contribution'}
                    </span>
                    <span className="text-2xl font-black text-emerald-700 tabular-nums">
                      ৳{(personalResult.total_donated || 0).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Details Breakdown */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">{isBangla ? 'শ্রেণী' : 'Category'}</span>
                    <span className="font-bold text-slate-800 capitalize">{personalResult.category || 'Alumni'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">{isBangla ? 'রেজিস্ট্রেশন ফি' : 'Reg Fee'}</span>
                    <span className="font-bold text-slate-800">৳{personalResult.registration_fee?.toLocaleString() || 0}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">{isBangla ? 'সর্বমোট পরিশোধ' : 'Total Paid'}</span>
                    <span className="font-bold text-emerald-700">৳{personalResult.total_paid?.toLocaleString() || 0}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">{isBangla ? 'পেমেন্ট স্ট্যাটাস' : 'Status'}</span>
                    <span className="font-bold text-emerald-700">✓ {personalResult.payment_status}</span>
                  </div>
                </div>

                {/* Transaction history list */}
                <div className="space-y-3">
                  <h5 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    {isBangla ? 'অনুদান লেনদেন বিবরণ' : 'Itemized Contribution Records'}
                  </h5>

                  {(!personalResult.history || personalResult.history.length === 0) ? (
                    <p className="text-xs text-slate-500 italic p-3 bg-slate-50 rounded-xl">
                      {isBangla
                        ? 'আপনার রেজিস্ট্রেশন ফিস পরিশোধিত হয়েছে, কোনো অতিরিক্ত অনুদান রেকর্ড নেই।'
                        : 'Your registration fee is paid. No additional patron donation was added.'}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {personalResult.history.map((tx) => (
                        <div
                          key={tx.id}
                          className="p-3.5 rounded-xl border border-slate-200 bg-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs"
                        >
                          <div>
                            <span className="font-bold text-slate-800 block">{tx.purpose}</span>
                            <span className="font-mono text-[11px] text-slate-400">
                              Trx: {tx.transaction_id || 'VERIFIED'} • {tx.donation_date}
                            </span>
                          </div>
                          <div className="text-right flex items-center gap-3 self-end sm:self-center">
                            <span className="font-mono text-emerald-700 font-black text-sm">
                              ৳{Number(tx.amount).toLocaleString()}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                              ✓ Paid
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Certificate Print Button */}
                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shadow-sm"
                  >
                    <Printer className="w-3.5 h-3.5 text-sky-400" />
                    <span>{isBangla ? 'রসিদ প্রিন্ট করুন' : 'Print Donation Slip'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── 4. SUPPORTING VOUCHER PREVIEW MODAL ── */}
        {selectedVoucher && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs p-4 flex items-center justify-center min-h-screen">
            <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 space-y-5 my-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-600" />
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{isBangla ? 'অফিসিয়াল ব্যয় ভাউচার ও রসিদ' : 'Official Expense Voucher'}</h4>
                    <span className="font-mono text-xs text-slate-400">{selectedVoucher.voucher_number || selectedVoucher.id}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedVoucher(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Voucher Image / Document Preview */}
              <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 aspect-16/9 relative group">
                <img
                  src={selectedVoucher.receipt_url || 'https://images.unsplash.com/photo-1555244162-803834f70033?w=800&auto=format&fit=crop&q=80'}
                  alt="Voucher receipt scan"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <a
                    href={selectedVoucher.receipt_url || '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-1.5 rounded-xl bg-white text-slate-900 text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>{isBangla ? 'পূর্ণ ছবি খুলুন' : 'Open Full Image'}</span>
                  </a>
                </div>
              </div>

              {/* Voucher metadata */}
              <div className="space-y-2 text-xs text-slate-600">
                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="text-slate-400 font-semibold">{isBangla ? 'খাত:' : 'Category:'}</span>
                  <span className="font-bold text-slate-900">{selectedVoucher.category}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="text-slate-400 font-semibold">{isBangla ? 'তারিখ:' : 'Expense Date:'}</span>
                  <span className="font-bold text-slate-900">{selectedVoucher.expense_date}</span>
                </div>
                {selectedVoucher.vendor_name && (
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-400 font-semibold">{isBangla ? 'সরবরাহকারী / ভেন্ডর:' : 'Vendor / Contractor:'}</span>
                    <span className="font-bold text-slate-900">{selectedVoucher.vendor_name}</span>
                  </div>
                )}
                {selectedVoucher.responsible_person && (
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-400 font-semibold">{isBangla ? 'দায়িত্বশীল কর্মকর্তা:' : 'Responsible Officer:'}</span>
                    <span className="font-bold text-slate-900">{selectedVoucher.responsible_person}</span>
                  </div>
                )}
                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="text-slate-400 font-semibold">{isBangla ? 'পরিমাণ:' : 'Amount Spent:'}</span>
                  <span className="font-black text-rose-600 text-sm">৳{selectedVoucher.amount.toLocaleString()} BDT</span>
                </div>
                <div className="pt-2">
                  <span className="text-slate-400 font-semibold block mb-1">{isBangla ? 'বিবরণ:' : 'Description:'}</span>
                  <p className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-slate-800 leading-relaxed">
                    {isBangla && selectedVoucher.description_bn ? selectedVoucher.description_bn : selectedVoucher.description}
                  </p>
                </div>
              </div>

              {/* Verified seal */}
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between font-semibold">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>{isBangla ? 'পুনর্মিলনী অর্থ কমিটি কর্তৃক অনুমোদিত' : 'Audited by Reunion Finance Secretariat'}</span>
                </span>
                <span className="font-mono text-[10px] text-emerald-600">STATUS: APPROVED</span>
              </div>
            </div>
          </div>
        )}

      </div>
    </section>
  );
};
