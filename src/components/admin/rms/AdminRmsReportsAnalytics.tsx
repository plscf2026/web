import React, { useState } from 'react';
import {
  BarChart3,
  Download,
  Calendar,
  Building,
  CheckCircle2,
  AlertTriangle,
  Shirt,
  TrendingUp,
  Eye,
  X,
} from 'lucide-react';
import { RegistrationRecord, Language } from '../../../types';
import { WeeklyProgressReport } from '../../../types/rms';
import { RmsStore } from '../../../services/rmsStore';
import { formatCsvRow } from '../../../utils/security';
import { GlobalPagination } from '../../common/GlobalPagination';
import { paginate, DEFAULT_PAGE_SIZE } from '../../../utils/pagination';

interface Props {
  language: Language;
  registrations: RegistrationRecord[];
}

export const AdminRmsReportsAnalytics: React.FC<Props> = ({
  language,
  registrations,
}) => {
  const [activeReportTab, setActiveReportTab] = useState<'batches' | 'committees' | 'weekly' | 'tshirts'>('batches');
  const [weeklyReports, setWeeklyReports] = useState<WeeklyProgressReport[]>(() => RmsStore.getWeeklyReports());
  const [selectedWeeklyReport, setSelectedWeeklyReport] = useState<WeeklyProgressReport | null>(null);
  const [reviewComments, setReviewComments] = useState('');

  // Pagination states
  const [batchPage, setBatchPage] = useState(1);
  const [batchPageSize, setBatchPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [commPage, setCommPage] = useState(1);
  const [commPageSize, setCommPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [weeklyPage, setWeeklyPage] = useState(1);
  const [weeklyPageSize, setWeeklyPageSize] = useState(DEFAULT_PAGE_SIZE);

  const committees = RmsStore.getCommittees();
  const tasks = RmsStore.getTasks();
  const currentUser = RmsStore.getCurrentUser();

  const reloadData = () => {
    setWeeklyReports(RmsStore.getWeeklyReports());
  };

  // 1. Batch breakdown calculations
  const batchStatsMap: Record<
    string,
    {
      batchName: string;
      category: 'former' | 'current';
      year?: string;
      totalRegistered: number;
      totalPaid: number;
      totalRevenue: number;
    }
  > = {};

  registrations.forEach((r) => {
    const key = r.batchName || 'General Batch';
    if (!batchStatsMap[key]) {
      batchStatsMap[key] = {
        batchName: key,
        category: r.category,
        year: r.passingYear || r.currentClass || '',
        totalRegistered: 0,
        totalPaid: 0,
        totalRevenue: 0,
      };
    }
    batchStatsMap[key].totalRegistered += 1;
    if (r.paymentStatus === 'paid') {
      batchStatsMap[key].totalPaid += 1;
      batchStatsMap[key].totalRevenue += r.totalPaid || r.registrationFee || 0;
    }
  });

  const batchStats = Object.values(batchStatsMap).sort((a, b) => b.totalPaid - a.totalPaid);

  // 2. Committee performance scorecard
  const committeeStats = committees.map((c) => {
    const committeeTasks = tasks.filter((t) => t.committeeId === c.id);
    const completedTasks = committeeTasks.filter((t) => t.status === 'COMPLETED').length;
    const taskRate = committeeTasks.length > 0 ? Math.round((completedTasks / committeeTasks.length) * 100) : 100;
    const budgetUtilization = c.budgetAllocated > 0 ? Math.round((c.budgetSpent / c.budgetAllocated) * 100) : 0;

    return {
      committee: c,
      totalTasks: committeeTasks.length,
      completedTasks,
      taskRate,
      budgetUtilization,
    };
  });

  // 3. T-Shirt sizes breakdown
  const tShirtSizes = ['S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'Oversize 50'] as const;
  const tShirtStats = tShirtSizes.map((size) => {
    const count = registrations.filter((r) => r.tShirtSize === size && r.paymentStatus === 'paid').length;
    const pendingCount = registrations.filter((r) => r.tShirtSize === size && r.paymentStatus === 'pending').length;
    return { size, paidCount: count, pendingCount, total: count + pendingCount };
  });

  // Export handlers with formula injection defense
  const handleExportBatchReport = () => {
    const headers = ['Batch Name', 'Category', 'Passing Year / Class', 'Total Registered', 'Confirmed Paid', 'Total Revenue (BDT)'];
    const rows = batchStats.map((b) =>
      formatCsvRow([
        b.batchName,
        b.category,
        b.year,
        b.totalRegistered,
        b.totalPaid,
        b.totalRevenue,
      ])
    );
    const csvContent = 'data:text/csv;charset=utf-8,' + [formatCsvRow(headers), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.href = encodedUri;
    link.download = `reunion_batch_analytics_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportCommitteeReport = () => {
    const headers = ['Committee Name', 'Director', 'Allocated Budget (BDT)', 'Spent Budget (BDT)', 'Budget Burn Rate (%)', 'Total Tasks', 'Completed Tasks', 'Task Completion Rate (%)'];
    const rows = committeeStats.map((cs) =>
      formatCsvRow([
        cs.committee.nameEn,
        cs.committee.directorName,
        cs.committee.budgetAllocated,
        cs.committee.budgetSpent,
        `${cs.budgetUtilization}%`,
        cs.totalTasks,
        cs.completedTasks,
        `${cs.taskRate}%`,
      ])
    );
    const csvContent = 'data:text/csv;charset=utf-8,' + [formatCsvRow(headers), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.href = encodedUri;
    link.download = `reunion_committee_scorecard_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleReviewReport = (action: 'APPROVE' | 'REQUEST_REVISION') => {
    if (!selectedWeeklyReport) return;
    RmsStore.reviewWeeklyReport(
      selectedWeeklyReport.id,
      action,
      currentUser.fullName,
      reviewComments.trim() || undefined
    );
    setSelectedWeeklyReport(null);
    setReviewComments('');
    reloadData();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-[#172554] text-white p-6 rounded-3xl shadow-lg border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-bold uppercase tracking-wider border border-blue-400/30">
              Module 10
            </span>
            <span className="text-xs text-slate-300 font-medium">Reunion Management ERP</span>
          </div>
          <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-amber-400" />
            <span>{language === 'bn' ? 'রিপোর্টস ও এক্সিকিউটিভ অ্যানালিটিক্স' : 'Executive Reports & System Analytics'}</span>
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-xl">
            {language === 'bn'
              ? 'ব্যাচভিত্তিক অংশগ্রহণ, সাব-কমিটি পারফরম্যান্স স্কোরকার্ড, সাপ্তাহিক প্রগ্রেস রিপোর্ট ও পোশাক চাহিদা পর্যালোচনা করুন।'
              : 'Cross-functional batch metrics, committee performance scorecard, weekly progress reports, and souvenir production inventory.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeReportTab === 'batches' && (
            <button
              onClick={handleExportBatchReport}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-bold text-xs shadow-md transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Export Batch CSV</span>
            </button>
          )}

          {activeReportTab === 'committees' && (
            <button
              onClick={handleExportCommitteeReport}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-bold text-xs shadow-md transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Export Scorecard CSV</span>
            </button>
          )}
        </div>
      </div>

      {/* Report Sub-Tabs */}
      <div className="flex items-center gap-1 bg-white p-2 rounded-2xl border border-slate-200 shadow-xs overflow-x-auto">
        {[
          { id: 'batches', label: 'Batch-wise Attendance & Revenue', icon: TrendingUp },
          { id: 'committees', label: 'Committee Scorecard', icon: Building },
          { id: 'weekly', label: `Weekly Progress Reports (${weeklyReports.length})`, icon: Calendar },
          { id: 'tshirts', label: 'T-Shirt & Souvenir Inventory', icon: Shirt },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeReportTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveReportTab(tab.id as any)}
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

      {/* TAB 1: BATCH-WISE ATTENDANCE & REVENUE */}
      {activeReportTab === 'batches' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs space-y-4 p-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-sm font-black text-slate-900">Batch Participation Leaderboard</h3>
            <span className="text-xs text-slate-500">{batchStats.length} Unique Batches Registered</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Rank</th>
                  <th className="px-4 py-3">Batch / Class Name</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Year / Std</th>
                  <th className="px-4 py-3">Total Registered</th>
                  <th className="px-4 py-3">Confirmed Paid</th>
                  <th className="px-4 py-3 text-right">Total Revenue (BDT)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginate(batchStats, batchPage, batchPageSize).map((b, idx) => (
                  <tr key={b.batchName} className="hover:bg-slate-50/80 transition">
                    <td className="px-4 py-3 font-mono font-bold text-slate-400">#{(batchPage - 1) * batchPageSize + idx + 1}</td>
                    <td className="px-4 py-3 font-bold text-slate-900">{b.batchName}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          b.category === 'former' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {b.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{b.year || '—'}</td>
                    <td className="px-4 py-3 font-mono text-slate-700">{b.totalRegistered}</td>
                    <td className="px-4 py-3 font-mono font-bold text-emerald-600">{b.totalPaid}</td>
                    <td className="px-4 py-3 text-right font-mono font-black text-slate-900">
                      ৳{b.totalRevenue.toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <GlobalPagination
            currentPage={batchPage}
            pageSize={batchPageSize}
            totalRecords={batchStats.length}
            onPageChange={setBatchPage}
            onPageSizeChange={setBatchPageSize}
            language={language}
          />
        </div>
      )}

      {/* TAB 2: COMMITTEE SCORECARD */}
      {activeReportTab === 'committees' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs space-y-4 p-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-sm font-black text-slate-900">12 Sub-Committees Executive Health Scorecard</h3>
            <span className="text-xs text-slate-500">Real-time Budget vs Milestone Delivery Audit</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Committee Name</th>
                  <th className="px-4 py-3">Director</th>
                  <th className="px-4 py-3">Budget Allocated</th>
                  <th className="px-4 py-3">Budget Spent</th>
                  <th className="px-4 py-3">Burn Rate</th>
                  <th className="px-4 py-3">Milestones Done</th>
                  <th className="px-4 py-3 text-right">Completion Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginate(committeeStats, commPage, commPageSize).map((cs) => (
                  <tr key={cs.committee.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-4 py-3 font-bold text-slate-900">{cs.committee.nameEn}</td>
                    <td className="px-4 py-3 text-slate-600">{cs.committee.directorName}</td>
                    <td className="px-4 py-3 font-mono">৳{cs.committee.budgetAllocated.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 font-mono font-bold text-rose-600">
                      ৳{cs.committee.budgetSpent.toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              cs.budgetUtilization > 90 ? 'bg-rose-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(100, cs.budgetUtilization)}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-mono font-bold text-slate-700">{cs.budgetUtilization}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {cs.completedTasks} / {cs.totalTasks}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-black text-emerald-600">{cs.taskRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <GlobalPagination
            currentPage={commPage}
            pageSize={commPageSize}
            totalRecords={committeeStats.length}
            onPageChange={setCommPage}
            onPageSizeChange={setCommPageSize}
            language={language}
          />
        </div>
      )}

      {/* TAB 3: WEEKLY PROGRESS REPORTS */}
      {activeReportTab === 'weekly' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {paginate(weeklyReports, weeklyPage, weeklyPageSize).map((report) => (
              <div key={report.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold">
                      Week {report.reportWeekNumber} Report
                    </span>
                    <h4 className="text-sm font-black text-slate-900 mt-1">{report.committeeName}</h4>
                    <span className="text-xs text-slate-500">Director: {report.directorName}</span>
                  </div>

                  <span
                    className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                      report.status === 'APPROVED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : report.status === 'REVISION_REQUESTED'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {report.status.replace('_', ' ')}
                  </span>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl space-y-1.5 text-xs text-slate-600">
                  <div className="font-bold text-slate-800">Completed Work:</div>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-600">
                    {report.workCompleted.map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>

                  {report.problemsEncountered && (
                    <div className="pt-1 text-[11px] text-rose-700">
                      <b>Blockers:</b> {report.problemsEncountered}
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="font-mono text-slate-400 text-[10px]">Reported: {report.reportDate}</span>
                  <button
                    onClick={() => {
                      setSelectedWeeklyReport(report);
                      setReviewComments(report.reviewerComments || '');
                    }}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs flex items-center gap-1 transition cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Review & Audit</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          <GlobalPagination
            currentPage={weeklyPage}
            pageSize={weeklyPageSize}
            totalRecords={weeklyReports.length}
            onPageChange={setWeeklyPage}
            onPageSizeChange={setWeeklyPageSize}
            language={language}
          />
        </div>
      )}

      {/* TAB 4: T-SHIRT & SOUVENIR INVENTORY */}
      {activeReportTab === 'tshirts' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Shirt className="w-5 h-5 text-purple-600" />
                <span>T-Shirt Size Production & Sourcing Requisition</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Exact count breakdown by size based on confirmed attendee registrations.
              </p>
            </div>
            <span className="font-mono font-black text-lg text-purple-700">
              {tShirtStats.reduce((sum, s) => sum + s.paidCount, 0)} Confirmed Units
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {tShirtStats.map((item) => (
              <div key={item.size} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-center space-y-1">
                <span className="text-xs font-black text-slate-700 uppercase tracking-wider">{item.size}</span>
                <p className="text-2xl font-black text-purple-700 font-mono">{item.paidCount}</p>
                <div className="text-[10px] text-slate-400">
                  {item.pendingCount > 0 && <span>+{item.pendingCount} pending</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL: REVIEW WEEKLY PROGRESS REPORT */}
      {selectedWeeklyReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold">
                  Week {selectedWeeklyReport.reportWeekNumber}
                </span>
                <h3 className="text-base font-black text-slate-900 mt-1">{selectedWeeklyReport.committeeName}</h3>
                <span className="text-xs text-slate-500">Submitted by {selectedWeeklyReport.directorName}</span>
              </div>
              <button
                onClick={() => setSelectedWeeklyReport(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl space-y-1">
                <div className="font-bold text-slate-800">Work Completed This Week:</div>
                <ul className="list-disc list-inside text-slate-600 space-y-0.5 text-[11px]">
                  {selectedWeeklyReport.workCompleted.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl space-y-1">
                <div className="font-bold text-slate-800">Work in Progress:</div>
                <ul className="list-disc list-inside text-slate-600 space-y-0.5 text-[11px]">
                  {selectedWeeklyReport.workInProgress.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>

              {selectedWeeklyReport.problemsEncountered && (
                <div className="bg-rose-50 p-3 rounded-xl border border-rose-200 text-rose-800">
                  <b>Blockers / Issues:</b> {selectedWeeklyReport.problemsEncountered}
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">Convener / Secretariat Feedback Notes</label>
                <textarea
                  rows={2}
                  placeholder="Notes on performance or required corrective actions..."
                  value={reviewComments}
                  onChange={(e) => setReviewComments(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-hidden"
                />
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => handleReviewReport('REQUEST_REVISION')}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold cursor-pointer transition flex items-center gap-1"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Request Revision</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleReviewReport('APPROVE')}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold cursor-pointer transition flex items-center gap-1"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Approve Report</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
