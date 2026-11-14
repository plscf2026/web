import { useState, useEffect } from 'react';
import {
  Users,
  CreditCard,
  Download,
  Filter,
  Clock,
} from 'lucide-react';
import { RegistrationRecord, Language } from '../../types';
import { AppStore } from '../../services/store';
import {
  aggregateRegistrationAnalytics,
  aggregatePaymentAnalytics,
  getDhakaDateString,
} from '../../utils/eventRules';
import { formatCsvRow } from '../../utils/security';
import { GlobalPagination } from '../common/GlobalPagination';
import { paginate } from '../../utils/pagination';

interface DailyAnalyticsTabProps {
  language?: Language;
  registrations?: RegistrationRecord[];
}

export const DailyAnalyticsTab: React.FC<DailyAnalyticsTabProps> = ({
  language: _language = 'en',
  registrations: passedRegistrations,
}) => {
  const registrations = passedRegistrations || AppStore.getRegistrations();
  const [activeSubTab, setActiveSubTab] = useState<'registrations' | 'payments'>('registrations');
  const [targetDate, setTargetDate] = useState<string>(() => getDhakaDateString());
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [graduationYearFilter, setGraduationYearFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Global Pagination State (Default 10, supports 10, 20, 30, 40)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Reset to page 1 on filter/search change
  useEffect(() => {
    setCurrentPage(1);
  }, [targetDate, startDate, endDate, graduationYearFilter, searchTerm]);

  // Calculations for current selected date in Asia/Dhaka Timezone
  const regAnalytics = aggregateRegistrationAnalytics(registrations, targetDate);
  const payAnalytics = aggregatePaymentAnalytics(registrations, targetDate);

  // Filter registrations for table
  const filteredRegistrations = registrations.filter((r) => {
    const rDate = getDhakaDateString(r.registeredAt);

    // Date range filter
    if (startDate && rDate < startDate) return false;
    if (endDate && rDate > endDate) return false;

    // Graduation year filter
    if (graduationYearFilter !== 'ALL') {
      const y = r.passingYear || (r.category === 'current' ? 'Current' : 'Other');
      if (y !== graduationYearFilter) return false;
    }

    // Search query
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const match =
        r.fullName.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q) ||
        r.mobileNumber.includes(q) ||
        (r.passingYear && r.passingYear.includes(q)) ||
        r.batchName.toLowerCase().includes(q);
      if (!match) return false;
    }

    return true;
  });

  // Unique graduation years present
  const availableYears = Array.from(
    new Set(
      registrations
        .map((r) => r.passingYear || (r.category === 'current' ? 'Current' : 'Other'))
        .filter(Boolean)
    )
  ).sort();

  // Export Daily Registration Analytics CSV with formula injection defense
  const handleExportRegistrationCSV = () => {
    const headers = [
      'Registration ID',
      'Student Name',
      'Category',
      'Graduation/Passing Year',
      'Batch Name',
      'T-Shirt Size',
      'Registered Date (Dhaka Time)',
      'Payment Status',
      'Fee (BDT)',
      'Total Paid (BDT)',
    ];

    const rows = filteredRegistrations.map((r) => [
      r.id,
      r.fullName,
      r.category,
      r.passingYear || 'Current Enrolled',
      r.batchName,
      r.tShirtSize,
      getDhakaDateString(r.registeredAt),
      r.paymentStatus,
      r.registrationFee,
      r.totalPaid,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [formatCsvRow(headers), ...rows.map((e) => formatCsvRow(e))].join('\n');
    const encoded = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encoded);
    link.setAttribute(
      'download',
      `PLSCF_Daily_Registration_Analytics_${targetDate || 'All'}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export Daily Payment Analytics CSV with formula injection defense
  const handleExportPaymentCSV = () => {
    const paidRows = filteredRegistrations.filter((r) => r.paymentStatus === 'paid');
    const headers = [
      'Registration ID',
      'Student Name',
      'Graduation Year',
      'Payment Date (Dhaka)',
      'Payment Method',
      'Gateway Transaction ID',
      'Fee (BDT)',
      'Donation (BDT)',
      'Total Amount (BDT)',
      'Server Signature',
    ];

    const rows = paidRows.map((r) => [
      r.id,
      r.fullName,
      r.passingYear || 'Current',
      getDhakaDateString(r.registeredAt),
      r.paymentMethod,
      r.transactionId,
      r.registrationFee,
      r.donationAmount,
      r.totalPaid,
      r.serverVerificationSignature || 'VERIFIED_GATEWAY',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [formatCsvRow(headers), ...rows.map((e) => formatCsvRow(e))].join('\n');
    const encoded = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encoded);
    link.setAttribute(
      'download',
      `PLSCF_Daily_Payment_Analytics_${targetDate || 'All'}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Sub-tab Navigation */}
      <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 text-xs font-bold">
          <button
            onClick={() => setActiveSubTab('registrations')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all cursor-pointer ${
              activeSubTab === 'registrations'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Daily Registration Analytics (Part 6)</span>
          </button>

          <button
            onClick={() => setActiveSubTab('payments')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all cursor-pointer ${
              activeSubTab === 'payments'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Daily Payment Analytics (Part 7)</span>
          </button>
        </div>

        {/* Date Selector for Asia/Dhaka reference (Requirements 6 & 7) */}
        <div className="flex items-center gap-2 text-xs">
          <span className="font-bold text-slate-600 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-emerald-600" />
            <span>Asia/Dhaka Reference Date:</span>
          </span>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-300 font-mono text-xs font-bold"
          />
        </div>
      </div>

      {/* 1. DAILY REGISTRATION ANALYTICS SUBTAB (Part 6) */}
      {activeSubTab === 'registrations' && (
        <div className="space-y-6">
          {/* 5 Top KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-1">
              <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider">
                TODAY'S REGISTRATIONS
              </span>
              <div className="text-2xl font-black text-emerald-950 font-mono">
                {regAnalytics.todayCount}
              </div>
              <span className="text-[10px] text-emerald-700 block">{targetDate}</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                YESTERDAY'S
              </span>
              <div className="text-2xl font-black text-slate-900 font-mono">
                {regAnalytics.yesterdayCount}
              </div>
              <span className="text-[10px] text-slate-400 block">Previous day</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                THIS WEEK'S
              </span>
              <div className="text-2xl font-black text-slate-900 font-mono">
                {regAnalytics.weekCount}
              </div>
              <span className="text-[10px] text-slate-400 block">Trailing 7 days</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                THIS MONTH'S
              </span>
              <div className="text-2xl font-black text-slate-900 font-mono">
                {regAnalytics.monthCount}
              </div>
              <span className="text-[10px] text-slate-400 block">Trailing 30 days</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                TOTAL REGISTRATIONS
              </span>
              <div className="text-2xl font-black text-amber-400 font-mono">
                {regAnalytics.totalCount.toLocaleString()}
              </div>
              <span className="text-[10px] text-slate-400 block">Grand Total</span>
            </div>
          </div>

          {/* Breakdown Table Grouped by Graduation Year (Requirement 6) */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                  Registration Counts Grouped by Graduation / Passing Year
                </h3>
                <p className="text-xs text-slate-500">
                  Actual database counts grouped by batch year (Target Audience: 10,000+ students).
                </p>
              </div>

              <button
                onClick={handleExportRegistrationCSV}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Registration CSV</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {regAnalytics.yearBreakdown.map((item) => (
                <div
                  key={item.year}
                  className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex justify-between items-center"
                >
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Graduation Year</span>
                    <strong className="text-sm font-mono text-slate-900">{item.year}</strong>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-black text-emerald-700 font-mono">{item.count}</span>
                    <span className="text-[10px] text-slate-400 block">students</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 2. DAILY PAYMENT ANALYTICS SUBTAB (Part 7) */}
      {activeSubTab === 'payments' && (
        <div className="space-y-6">
          {/* Top Payment KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
            <div className="p-4 rounded-2xl bg-teal-50 border border-teal-200 space-y-1">
              <span className="text-[10px] uppercase font-bold text-teal-800 tracking-wider">
                TODAY'S SUCCESSFUL
              </span>
              <div className="text-2xl font-black text-teal-950 font-mono">
                {payAnalytics.todayPaymentsCount}
              </div>
              <span className="text-[10px] text-teal-700 block">Verified Payments</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                YESTERDAY'S
              </span>
              <div className="text-2xl font-black text-slate-900 font-mono">
                {payAnalytics.yesterdayPaymentsCount}
              </div>
              <span className="text-[10px] text-slate-400 block">Previous Day</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                THIS WEEK'S
              </span>
              <div className="text-2xl font-black text-slate-900 font-mono">
                {payAnalytics.weekPaymentsCount}
              </div>
              <span className="text-[10px] text-slate-400 block">Trailing 7 days</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                TOTAL SUCCESSFUL
              </span>
              <div className="text-2xl font-black text-teal-800 font-mono">
                {payAnalytics.totalSuccessfulPayments}
              </div>
              <span className="text-[10px] text-teal-700 block">Gateway Verified</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                TOTAL AMOUNT COLLECTED
              </span>
              <div className="text-2xl font-black text-amber-400 font-mono">
                BDT {payAnalytics.totalAmountCollected.toLocaleString()}
              </div>
              <span className="text-[10px] text-slate-400 block">Authoritative Total</span>
            </div>
          </div>

          {/* Payment Breakdown by Graduation Year (Requirement 7) */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                  Payment Revenue Breakdown by Graduation Year
                </h3>
                <p className="text-xs text-slate-500">
                  Strictly counts gateway-verified transactions (server-side verified).
                </p>
              </div>

              <button
                onClick={handleExportPaymentCSV}
                className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Payment CSV</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {payAnalytics.paymentByYear.map((item) => (
                <div
                  key={item.year}
                  className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex justify-between items-center"
                >
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Graduation Batch</span>
                    <strong className="text-sm font-mono text-slate-900">{item.year}</strong>
                    <span className="text-[10px] text-slate-500 block">{item.count} students paid</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-black text-teal-700 font-mono">
                      BDT {item.amount.toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* FILTER & DETAILED DATA TABLE */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
              Filtered Records & Date Range Explorer
            </h3>
          </div>

          <span className="text-xs text-slate-500 font-mono font-bold">
            Showing {filteredRegistrations.length} of {registrations.length} records
          </span>
        </div>

        {/* Filters Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Search Keyword</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Name, ID, Mobile..."
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Graduation Year</label>
            <select
              value={graduationYearFilter}
              onChange={(e) => setGraduationYearFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold"
            >
              <option value="ALL">All Graduation Years</option>
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>{yr}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">From Date (Dhaka)</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-mono"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">To Date (Dhaka)</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-mono"
            />
          </div>
        </div>

        {/* Desktop Table View (>= 640px) */}
        <div className="hidden sm:block overflow-x-auto pt-2">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                <th className="py-2.5 px-3">Student ID</th>
                <th className="py-2.5 px-3">Full Name</th>
                <th className="py-2.5 px-3">Graduation Year</th>
                <th className="py-2.5 px-3">Registered Date</th>
                <th className="py-2.5 px-3">T-Shirt</th>
                <th className="py-2.5 px-3 text-right">Fee (BDT)</th>
                <th className="py-2.5 px-3 text-center">Payment Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginate(filteredRegistrations, currentPage, pageSize).map((r) => (
                <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-2 px-3 font-mono font-bold text-slate-900">{r.id}</td>
                  <td className="py-2 px-3 font-semibold text-slate-800">{r.fullName}</td>
                  <td className="py-2 px-3 text-slate-600 font-mono">
                    {r.passingYear || (r.category === 'current' ? 'Current Enrolled' : '—')}
                  </td>
                  <td className="py-2 px-3 text-slate-500 font-mono text-[11px]">
                    {getDhakaDateString(r.registeredAt)}
                  </td>
                  <td className="py-2 px-3 font-mono font-bold text-slate-700">{r.tShirtSize}</td>
                  <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap inline-block tabular-nums">
                    BDT {r.totalPaid.toLocaleString()}
                  </td>
                  <td className="py-2 px-3 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        r.paymentStatus === 'paid'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {r.paymentStatus}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Responsive Cards (< 640px) */}
        <div className="sm:hidden space-y-3 pt-2">
          {paginate(filteredRegistrations, currentPage, pageSize).map((r) => (
            <div key={`mobile-daily-${r.id}`} className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="font-bold text-slate-900 block text-sm truncate">{r.fullName}</span>
                  <span className="font-mono text-xs text-slate-500 font-semibold">{r.id}</span>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase shrink-0 ${
                    r.paymentStatus === 'paid'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {r.paymentStatus}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Year / Class</span>
                  <span className="font-medium text-slate-700">
                    {r.passingYear || (r.category === 'current' ? 'Current Enrolled' : '—')}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">T-Shirt</span>
                  <span className="font-mono font-bold text-slate-800">Size {r.tShirtSize}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Registration Date</span>
                  <span className="font-mono text-slate-500 text-[11px]">{getDhakaDateString(r.registeredAt)}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Fee Paid</span>
                  <span className="font-mono font-black text-slate-900 text-sm whitespace-nowrap inline-block tabular-nums">
                    BDT {r.totalPaid.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Global Pagination */}
        <GlobalPagination
          currentPage={currentPage}
          totalRecords={filteredRegistrations.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
      </div>
    </div>
  );
};
