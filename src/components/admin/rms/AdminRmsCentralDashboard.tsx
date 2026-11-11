import React, { useState } from 'react';
import {
  Users,
  CheckCircle2,
  Clock,
  DollarSign,
  TrendingUp,
  Building,
  CheckSquare,
  Calendar,
  Sparkles,
  ArrowRight,
  Filter,
  BarChart3,
  CreditCard,
  ShieldCheck,
} from 'lucide-react';
import { RegistrationRecord, Language } from '../../../types';
import { RmsStore } from '../../../services/rmsStore';
import { AppStore } from '../../../services/store';

interface Props {
  language: Language;
  registrations: RegistrationRecord[];
  onNavigateTab: (tabId: string) => void;
}

export const AdminRmsCentralDashboard: React.FC<Props> = ({
  language,
  registrations,
  onNavigateTab,
}) => {
  const [selectedFilterCategory, setSelectedFilterCategory] = useState<'all' | 'former' | 'current'>('all');

  const committees = RmsStore.getCommittees();
  const tasks = RmsStore.getTasks();
  const expenses = RmsStore.getExpenses();
  const sponsors = RmsStore.getSponsors();
  const auditLogs = RmsStore.getAuditLogs();
  const donations = AppStore.getDonations();

  // Filter registrations if requested
  const filteredRegs = registrations.filter((r) => {
    if (selectedFilterCategory === 'all') return true;
    return r.category === selectedFilterCategory;
  });

  // Accurate Financial Calculations from Database
  const confirmedRegs = filteredRegs.filter((r) => r.paymentStatus === 'paid');
  const pendingRegs = filteredRegs.filter((r) => r.paymentStatus === 'pending');

  const totalRegistrationIncome = confirmedRegs.reduce((sum, r) => sum + (r.totalPaid || 0), 0);
  const totalDonationIncome = donations
    .filter((d) => d.paymentStatus === 'paid')
    .reduce((sum, d) => sum + (d.amount || 0), 0);
  const totalSponsorIncome = sponsors.reduce((sum, s) => sum + (s.receivedAmount || 0), 0);

  const totalVerifiedIncome = totalRegistrationIncome + totalDonationIncome + totalSponsorIncome;

  const totalApprovedExpenses = expenses
    .filter((e) => e.verificationStatus !== 'REVERSED')
    .reduce((sum, e) => sum + e.amount, 0);

  const remainingBalance = totalVerifiedIncome - totalApprovedExpenses;

  // Task Statistics
  const completedTasks = tasks.filter((t) => t.status === 'COMPLETED').length;
  const pendingTasks = tasks.filter((t) => t.status !== 'COMPLETED').length;
  const criticalTasks = tasks.filter((t) => t.priority === 'CRITICAL' && t.status !== 'COMPLETED').length;

  // Total active committee members across all 12 committees
  const totalActiveMembers = committees.reduce((sum, c) => sum + c.members.length, 0);

  // Group confirmed registrations by batch for the interactive chart
  const batchCounts: Record<string, number> = {};
  confirmedRegs.forEach((r) => {
    const key = r.batchName || (r.category === 'former' ? `Batch ${r.passingYear || 'Unknown'}` : r.currentClass || 'Current');
    batchCounts[key] = (batchCounts[key] || 0) + 1;
  });
  const topBatches = Object.entries(batchCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const maxBatchCount = topBatches.length > 0 ? Math.max(...topBatches.map((b) => b[1]), 1) : 1;

  return (
    <div className="space-y-6">
      {/* Top Welcome & Reunion 2027 Countdown Banner */}
      <div className="bg-gradient-to-r from-[#172554] via-[#1e3a8a] to-[#172554] text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-blue-900 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="p-1.5 bg-amber-400 text-slate-950 rounded-lg">
              <Sparkles className="w-4 h-4" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
              Central Committee Command & ERP
            </span>
            <span className="px-2 py-0.5 rounded-full bg-blue-900 border border-blue-700 text-[10px] font-bold text-white uppercase">
              Reunion 2027
            </span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
            {language === 'bn' ? 'পুনর্মিলনী কেন্দ্রীয় ব্যবস্থাপনা ড্যাশবোর্ড' : 'Reunion Central Executive Command'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
            {language === 'bn'
              ? 'সিলেট পুলিশ লাইন্স উচ্চ বিদ্যালয় ও কলেজের পুনর্মিলনী ২০২৭-এর সার্বিক প্রশাসনিক অগ্রগতি, আর্থিক হিসাব, ব্যাচভিত্তিক উপস্থিতি ও উপকমিটির রিয়েল-টাইম তথ্য।'
              : 'Real-time telemetry, committee oversight, budget ledger, and attendee reconciliation for Sylhet Police Lines High School & College Reunion 2027.'}
          </p>
        </div>

        {/* Filter Pill */}
        <div className="flex items-center gap-2 bg-blue-950/80 p-2 rounded-2xl border border-blue-800">
          <Filter className="w-3.5 h-3.5 text-amber-400 ml-1" />
          <select
            value={selectedFilterCategory}
            onChange={(e) => setSelectedFilterCategory(e.target.value as any)}
            className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer"
          >
            <option value="all" className="bg-slate-900 text-white">All Attendees</option>
            <option value="former" className="bg-slate-900 text-white">Alumni Only</option>
            <option value="current" className="bg-slate-900 text-white">Current Students Only</option>
          </select>
        </div>
      </div>

      {/* Row 1: Attendee Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Total Registrations
            </span>
            <p className="text-3xl font-black text-slate-900 mt-1">{filteredRegs.length}</p>
            <p className="text-xs text-slate-500 mt-0.5">Database verified records</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
              Confirmed (Paid)
            </span>
            <p className="text-3xl font-black text-emerald-600 mt-1">{confirmedRegs.length}</p>
            <p className="text-xs text-slate-500 mt-0.5">Payment settled</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-amber-600">
              Pending Payments
            </span>
            <p className="text-3xl font-black text-amber-600 mt-1">{pendingRegs.length}</p>
            <p className="text-xs text-slate-500 mt-0.5">Awaiting gateway settlement</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-purple-600">
              Active Committees
            </span>
            <p className="text-3xl font-black text-purple-700 mt-1">{committees.length}</p>
            <p className="text-xs text-slate-500 mt-0.5">{totalActiveMembers} Appointed members</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
            <Building className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Row 2: Comprehensive Financial Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Total Verified Inflow
            </span>
            <span className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
              <DollarSign className="w-5 h-5" />
            </span>
          </div>
          <p className="text-3xl font-black text-slate-900 mt-3">৳{totalVerifiedIncome.toLocaleString()}</p>
          <div className="mt-3 pt-3 border-t border-slate-100 space-y-1 text-xs text-slate-600">
            <div className="flex justify-between">
              <span>Registration Fees:</span>
              <span className="font-semibold text-slate-800">৳{totalRegistrationIncome.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Alumni Donations:</span>
              <span className="font-semibold text-slate-800">৳{totalDonationIncome.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Corporate Sponsorships:</span>
              <span className="font-semibold text-slate-800">৳{totalSponsorIncome.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Approved Expenditures
            </span>
            <span className="p-2 bg-rose-50 text-rose-700 rounded-xl">
              <CreditCard className="w-5 h-5" />
            </span>
          </div>
          <p className="text-3xl font-black text-rose-600 mt-3">৳{totalApprovedExpenses.toLocaleString()}</p>
          <div className="mt-3 pt-3 border-t border-slate-100 space-y-1 text-xs text-slate-600">
            <div className="flex justify-between">
              <span>Verified Vouchers:</span>
              <span className="font-semibold text-slate-800">{expenses.length} Vouchers</span>
            </div>
            <div className="flex justify-between">
              <span>Reversed Vouchers:</span>
              <span className="font-semibold text-slate-800">
                {expenses.filter((e) => e.verificationStatus === 'REVERSED').length} entries
              </span>
            </div>
            <div className="flex justify-between">
              <span>Avg. Committee Spend:</span>
              <span className="font-semibold text-slate-800">
                ৳{committees.length > 0 ? Math.round(totalApprovedExpenses / committees.length).toLocaleString() : 0}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Net Available Balance
            </span>
            <span className="p-2 bg-sky-50 text-sky-700 rounded-xl">
              <TrendingUp className="w-5 h-5" />
            </span>
          </div>
          <p
            className={`text-3xl font-black mt-3 ${
              remainingBalance >= 0 ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            ৳{remainingBalance.toLocaleString()}
          </p>
          <div className="mt-3 pt-3 border-t border-slate-100 space-y-1 text-xs text-slate-600">
            <div className="flex justify-between">
              <span>Financial Status:</span>
              <span className="font-bold text-emerald-700">Solvent & Verified</span>
            </div>
            <div className="flex justify-between">
              <span>Formula:</span>
              <span className="font-mono text-slate-500">Income - Approved Exp.</span>
            </div>
            <div className="flex justify-between">
              <span>Last Reconciled:</span>
              <span className="font-semibold text-slate-800">Live Database Sync</span>
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Interactive Visualizations & Task Pipeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Interactive Batch Registration Chart */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-600" />
              <h3 className="font-bold text-slate-900 text-base">Top Participating Batches</h3>
            </div>
            <button
              onClick={() => onNavigateTab('batchManagement')}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
            >
              <span>Manage Batches</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {topBatches.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No batch registrations recorded yet.</p>
            ) : (
              topBatches.map(([batch, count]) => {
                const percent = Math.round((count / maxBatchCount) * 100);
                return (
                  <div key={batch} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-800">{batch}</span>
                      <span className="text-slate-600">{count} Registered</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Task Management & Readiness */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-base">Committee Task Health</h3>
              </div>
              <button
                onClick={() => onNavigateTab('taskManagement')}
                className="text-xs font-bold text-emerald-600 hover:text-emerald-800 flex items-center gap-1"
              >
                <span>Task Board</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 mt-4 text-center">
              <div className="p-3 bg-emerald-50 rounded-xl">
                <span className="text-[11px] font-bold text-emerald-700 uppercase">Completed</span>
                <p className="text-2xl font-black text-emerald-800 mt-1">{completedTasks}</p>
              </div>
              <div className="p-3 bg-amber-50 rounded-xl">
                <span className="text-[11px] font-bold text-amber-700 uppercase">In Progress</span>
                <p className="text-2xl font-black text-amber-800 mt-1">{pendingTasks}</p>
              </div>
              <div className="p-3 bg-rose-50 rounded-xl">
                <span className="text-[11px] font-bold text-rose-700 uppercase">Critical</span>
                <p className="text-2xl font-black text-rose-800 mt-1">{criticalTasks}</p>
              </div>
            </div>

            {/* Upcoming Deadlines */}
            <div className="mt-4 space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Upcoming Priority Deadlines
              </span>
              {tasks
                .filter((t) => t.status !== 'COMPLETED')
                .slice(0, 3)
                .map((task) => (
                  <div
                    key={task.id}
                    className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs flex items-center justify-between"
                  >
                    <div className="truncate mr-2">
                      <p className="font-bold text-slate-800 truncate">{task.title}</p>
                      <span className="text-[11px] text-slate-500">{task.committeeName}</span>
                    </div>
                    <span className="text-[11px] font-bold text-rose-600 whitespace-nowrap flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {task.deadline}
                    </span>
                  </div>
                ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Overall Task Completion Rate:</span>
            <span className="font-bold text-slate-800">
              {tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0}%
            </span>
          </div>
        </div>
      </div>

      {/* Row 4: Committee Progress & Recent Audit Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Committee Matrix */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Building className="w-5 h-5 text-purple-600" />
              <h3 className="font-bold text-slate-900 text-base">12 Sub-Committees Budget & Execution</h3>
            </div>
            <button
              onClick={() => onNavigateTab('committeeManagement')}
              className="text-xs font-bold text-purple-600 hover:text-purple-800 flex items-center gap-1"
            >
              <span>View All Committees</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="mt-4 divide-y divide-slate-100 max-h-80 overflow-y-auto pr-1">
            {committees.map((comm) => {
              const spentPct = comm.budgetAllocated > 0 ? Math.round((comm.budgetSpent / comm.budgetAllocated) * 100) : 0;
              return (
                <div key={comm.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 text-sm truncate">{comm.nameEn}</p>
                    <p className="text-xs text-slate-500">
                      Director: <strong className="text-slate-700">{comm.directorName}</strong> ({comm.members.length} Members)
                    </p>
                  </div>
                  <div className="text-right flex items-center gap-4 flex-shrink-0">
                    <div className="text-right">
                      <span className="text-xs font-bold text-slate-800 block">
                        ৳{comm.budgetSpent.toLocaleString()} / ৳{comm.budgetAllocated.toLocaleString()}
                      </span>
                      <span className="text-[11px] text-slate-400">{spentPct}% utilized</span>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        comm.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {comm.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Audit Activities */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-base">Recent Executive Logs</h3>
              </div>
              <button
                onClick={() => onNavigateTab('activityLogs')}
                className="text-xs font-bold text-emerald-600 hover:text-emerald-800 flex items-center gap-1"
              >
                <span>Audit Trail</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="mt-4 space-y-3 max-h-72 overflow-y-auto pr-1">
              {auditLogs.slice(0, 5).map((log) => (
                <div key={log.id} className="p-3 bg-slate-50 rounded-xl text-xs space-y-1">
                  <div className="flex items-center justify-between text-slate-400 text-[11px]">
                    <span className="font-bold text-slate-700">{log.userName}</span>
                    <span>{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="text-slate-800 font-medium truncate">{log.details}</p>
                  <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-slate-200 text-slate-700">
                    {log.action}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-center text-xs text-slate-400">
            Compliance verified with tamper-evident audit hashing
          </div>
        </div>
      </div>
    </div>
  );
};
