import { useState } from 'react';
import {
  Users,
  CheckCircle2,
  AlertTriangle,
  DollarSign,
  TrendingUp,
  Calendar,
  Sparkles,
  Filter,
} from 'lucide-react';
import { RmsStore } from '../../services/rmsStore';
import { AppStore } from '../../services/store';
import { Language } from '../../types';

interface RmsExecutiveOverviewProps {
  language?: Language;
  onNavigateTab: (tabId: string) => void;
}

export const RmsExecutiveOverview: React.FC<RmsExecutiveOverviewProps> = ({
  language = 'en',
  onNavigateTab,
}) => {
  const [selectedCommitteeFilter, setSelectedCommitteeFilter] = useState<string>('ALL');

  const committees = RmsStore.getCommittees();
  const tasks = RmsStore.getTasks();
  const budgetRequests = RmsStore.getBudgetRequests();
  const sponsors = RmsStore.getSponsors();
  const registrations = AppStore.getRegistrations();

  // Filter tasks if committee selected
  const filteredTasks = selectedCommitteeFilter === 'ALL'
    ? tasks
    : tasks.filter((t) => t.committeeId === selectedCommitteeFilter);

  const completedTasks = filteredTasks.filter((t) => t.status === 'COMPLETED').length;
  const inProgressTasks = filteredTasks.filter((t) => t.status === 'IN_PROGRESS').length;
  const underReviewTasks = filteredTasks.filter((t) => t.status === 'UNDER_REVIEW').length;
  const overdueTasks = filteredTasks.filter((t) => {
    const isPast = new Date(t.deadline).getTime() < Date.now();
    return isPast && t.status !== 'COMPLETED' && t.status !== 'CANCELLED';
  }).length;

  // Financial aggregates
  const totalApprovedBudget = committees.reduce((sum, c) => sum + c.budgetAllocated, 0);
  const totalSpent = committees.reduce((sum, c) => sum + c.budgetSpent, 0);
  const totalSponsorReceived = sponsors.reduce((sum, s) => sum + s.receivedAmount, 0);
  const totalRegRevenue = registrations.reduce((sum, r) => sum + (r.paymentStatus === 'paid' ? r.totalPaid : 0), 0);
  const totalIncome = totalSponsorReceived + totalRegRevenue;
  const netBalance = totalIncome - totalSpent;

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Top Banner with Leadership & Reunion Countdown */}
      <div className="bg-[#0f172a] text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#0284c7]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-950 border border-sky-800 text-[11px] font-bold text-sky-400">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Police Lines High School & College, Faridpur Reunion 2027</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight font-clash">
              {language === 'bn' ? 'কেন্দ্রীয় পরিচালনা পরিষদ ড্যাশবোর্ড' : 'Central Steering Committee Command Center'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {language === 'bn'
                ? 'আহ্বায়ক: মনোয়ার শিকদার • সদস্য সচিব: সিদ্দিকুর রহমান • রেজিস্ট্রেশন ও ডেটাবেজ পরিচালক: সাগর'
                : 'Convener: Monowar Shikder • Member Secretary: Siddiqur Rahman • Registration & Database Director: Sagar'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-slate-900/90 border border-slate-800 px-4 py-3 rounded-2xl text-center min-w-[130px]">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Main Event Date</span>
              <span className="text-sm font-black text-amber-400 font-mono">Jan 29, 2027</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Campus & Ground</span>
            </div>
            <div className="bg-slate-900/90 border border-slate-800 px-4 py-3 rounded-2xl text-center min-w-[130px]">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Target Attendees</span>
              <span className="text-sm font-black text-sky-400 font-mono">10,000+</span>
              <span className="text-[10px] text-emerald-400 block mt-0.5">Alumni & Faculty</span>
            </div>
          </div>
        </div>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Registered */}
        <div
          onClick={() => onNavigateTab('registrations')}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Registrations</span>
            <Users className="w-4 h-4 text-sky-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">{registrations.length}</div>
          <div className="mt-1 text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
            <span>Verified: {registrations.filter((r) => r.paymentStatus === 'paid').length}</span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-500">Target: 10k</span>
          </div>
        </div>

        {/* Task Completion Rate */}
        <div
          onClick={() => onNavigateTab('tasks')}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Task Progress</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            {tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0}%
          </div>
          <div className="mt-1 text-[11px] text-slate-600 font-semibold flex items-center gap-2">
            <span className="text-emerald-700 font-bold">{completedTasks} Done</span>
            <span className="text-slate-300">•</span>
            <span className="text-amber-600 font-bold">{inProgressTasks} In Progress</span>
          </div>
        </div>

        {/* Total Funds Collected */}
        <div
          onClick={() => onNavigateTab('finance')}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Inflow</span>
            <DollarSign className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-black text-emerald-700 font-mono">
            ৳ {(totalIncome / 100000).toFixed(2)} Lac
          </div>
          <div className="mt-1 text-[11px] text-slate-500 font-semibold">
            Sponsors: ৳{(totalSponsorReceived / 100000).toFixed(1)}L • Regs: ৳{(totalRegRevenue / 100000).toFixed(1)}L
          </div>
        </div>

        {/* Total Budget Spent & Net Balance */}
        <div
          onClick={() => onNavigateTab('finance')}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Net Balance</span>
            <TrendingUp className="w-4 h-4 text-sky-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            ৳ {(netBalance / 100000).toFixed(2)} Lac
          </div>
          <div className="mt-1 text-[11px] text-slate-500 font-semibold">
            Allocated: ৳{(totalApprovedBudget / 100000).toFixed(1)}L • Spent: ৳{(totalSpent / 100000).toFixed(1)}L
          </div>
        </div>
      </div>

      {/* Main Two-Column Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: 12 Committees Performance Overview */}
        <div className="lg:col-span-8 bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 font-clash flex items-center gap-2">
                <span>12 Sub-Committees Operational Health</span>
                <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 text-[10px] font-bold">
                  {committees.length} Active
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Real-time tracking of tasks, budgets, and directors across all operational departments.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedCommitteeFilter}
                onChange={(e) => setSelectedCommitteeFilter(e.target.value)}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 font-semibold focus:outline-hidden"
              >
                <option value="ALL">All Committees</option>
                {committees.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nameEn}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {committees.map((comm) => {
              const commTasks = tasks.filter((t) => t.committeeId === comm.id);
              const commDone = commTasks.filter((t) => t.status === 'COMPLETED').length;
              const commPct = commTasks.length > 0 ? Math.round((commDone / commTasks.length) * 100) : 0;
              const spentPct = comm.budgetAllocated > 0 ? Math.round((comm.budgetSpent / comm.budgetAllocated) * 100) : 0;

              return (
                <div
                  key={comm.id}
                  onClick={() => onNavigateTab('committees')}
                  className="p-4 rounded-2xl bg-slate-50 border border-slate-200 hover:border-sky-500/50 hover:bg-sky-50/20 transition-all cursor-pointer group"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h3 className="text-xs font-bold text-slate-900 group-hover:text-sky-700 transition-colors">
                        {language === 'bn' ? comm.nameBn : comm.nameEn}
                      </h3>
                      <span className="text-[11px] text-slate-500 font-medium block">
                        Director: <strong className="text-slate-800">{comm.directorName}</strong>
                      </span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600 font-bold shrink-0">
                      {commTasks.length} tasks
                    </span>
                  </div>

                  {/* Task Progress Bar */}
                  <div className="space-y-1 mb-2.5">
                    <div className="flex justify-between text-[10px] font-semibold text-slate-600">
                      <span>Tasks Complete</span>
                      <span className="font-mono">{commPct}% ({commDone}/{commTasks.length})</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-600 rounded-full transition-all duration-300"
                        style={{ width: `${commPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Budget Allocation & Spent */}
                  <div className="flex justify-between items-center text-[10px] text-slate-500 pt-2 border-t border-slate-200/60 font-medium">
                    <span>
                      Allocated: <strong className="text-slate-800 font-mono">৳{(comm.budgetAllocated / 1000).toFixed(0)}k</strong>
                    </span>
                    <span>
                      Spent: <strong className="text-slate-800 font-mono">৳{(comm.budgetSpent / 1000).toFixed(0)}k</strong> ({spentPct}%)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Urgent Action Center & Calendar Milestones */}
        <div className="lg:col-span-4 space-y-6">
          {/* Action Alerts & Overdue */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span>Attention Required</span>
            </h3>

            <div className="space-y-2.5">
              <div
                onClick={() => onNavigateTab('tasks')}
                className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs flex items-center justify-between cursor-pointer hover:bg-rose-100 transition-colors"
              >
                <div>
                  <span className="font-bold text-rose-900 block">Overdue Tasks</span>
                  <span className="text-[11px] text-rose-700">{overdueTasks} tasks passed deadline</span>
                </div>
                <span className="text-sm font-black font-mono text-rose-700">{overdueTasks}</span>
              </div>

              <div
                onClick={() => onNavigateTab('tasks')}
                className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs flex items-center justify-between cursor-pointer hover:bg-amber-100 transition-colors"
              >
                <div>
                  <span className="font-bold text-amber-900 block">Under Review</span>
                  <span className="text-[11px] text-amber-700">{underReviewTasks} awaiting director approval</span>
                </div>
                <span className="text-sm font-black font-mono text-amber-700">{underReviewTasks}</span>
              </div>

              <div
                onClick={() => onNavigateTab('finance')}
                className="p-3 rounded-xl bg-sky-50 border border-sky-200 text-xs flex items-center justify-between cursor-pointer hover:bg-sky-100 transition-colors"
              >
                <div>
                  <span className="font-bold text-sky-900 block">Pending Budget Requests</span>
                  <span className="text-[11px] text-sky-700">
                    {budgetRequests.filter((b) => b.status === 'SUBMITTED' || b.status === 'RECOMMENDED').length} pending review
                  </span>
                </div>
                <span className="text-sm font-black font-mono text-sky-700">
                  {budgetRequests.filter((b) => b.status === 'SUBMITTED' || b.status === 'RECOMMENDED').length}
                </span>
              </div>
            </div>
          </div>

          {/* Upcoming Reunion Milestones */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-sky-600" />
              <span>Event Milestones 2027</span>
            </h3>

            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-slate-900">Jan 28, 2027 • Day 1</span>
                  <span className="text-[10px] font-bold text-sky-700 bg-sky-100 px-2 py-0.5 rounded">Prelude</span>
                </div>
                <ul className="text-[11px] text-slate-600 list-disc list-inside space-y-0.5">
                  <li>08:00 AM - Registration & ID Card Distribution</li>
                  <li>06:00 PM - Evening Traditional Qawwali Night</li>
                </ul>
              </div>

              <div className="p-3 rounded-xl bg-slate-900 text-white text-xs shadow-md">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-amber-400">Jan 29, 2027 • Main Day</span>
                  <span className="text-[10px] font-bold text-slate-900 bg-amber-400 px-2 py-0.5 rounded">Grand Reunion</span>
                </div>
                <ul className="text-[11px] text-slate-300 list-disc list-inside space-y-0.5">
                  <li>08:30 AM - Grand Rally & Festive Procession</li>
                  <li>10:00 AM - Opening Ceremony & Faculty Honor</li>
                  <li>01:00 PM - Grand Banquet Lunch</li>
                  <li>04:30 PM - Celebrity Bands & Cultural Night</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
