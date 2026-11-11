import React, { useState } from 'react';
import {
  FileCheck2,
  Plus,
  CheckCircle,
  AlertCircle,
  Eye,
  Calendar,
  DollarSign,
  Printer,
} from 'lucide-react';
import { WeeklyProgressReport, RmsUser } from '../../types/rms';
import { RmsStore } from '../../services/rmsStore';

interface Props {
  currentUser: RmsUser;
  canSubmit: boolean;
  canReview: boolean;
}

export const RmsWeeklyReportsModule: React.FC<Props> = ({ currentUser, canSubmit, canReview }) => {
  const [reports, setReports] = useState<WeeklyProgressReport[]>(() => RmsStore.getWeeklyReports());
  const committees = RmsStore.getCommittees();

  const [selectedCommitteeId, setSelectedCommitteeId] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [inspectReport, setInspectReport] = useState<WeeklyProgressReport | null>(null);

  // Submit Modal
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [commId, setCommId] = useState(currentUser.committeeId || 'registration-database');
  const [weekNumber, setWeekNumber] = useState<number>(2);
  const [workCompletedText, setWorkCompletedText] = useState('');
  const [workInProgressText, setWorkInProgressText] = useState('');
  const [workPendingText, setWorkPendingText] = useState('');
  const [problemsText, setProblemsText] = useState('');
  const [budgetSpent, setBudgetSpent] = useState<number>(0);
  const [upcomingText, setUpcomingText] = useState('');
  const [supportText, setSupportText] = useState('');

  // Review Modal
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewComments, setReviewComments] = useState('');

  const reloadData = () => {
    setReports(RmsStore.getWeeklyReports());
    if (inspectReport) {
      const refreshed = RmsStore.getWeeklyReports().find((r) => r.id === inspectReport.id);
      if (refreshed) setInspectReport(refreshed);
    }
  };

  const filteredReports = reports.filter((rep) => {
    const matchesComm = selectedCommitteeId === 'ALL' || rep.committeeId === selectedCommitteeId;
    const matchesStatus = selectedStatus === 'ALL' || rep.status === selectedStatus;
    return matchesComm && matchesStatus;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const comm = committees.find((c) => c.id === commId);

    const parseList = (text: string) =>
      text
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

    RmsStore.submitWeeklyReport({
      committeeId: commId,
      committeeName: comm ? comm.nameEn : 'Committee',
      directorId: currentUser.id,
      directorName: currentUser.fullName,
      reportWeekNumber: weekNumber,
      workCompleted: parseList(workCompletedText),
      workInProgress: parseList(workInProgressText),
      workPending: parseList(workPendingText),
      problemsEncountered: problemsText.trim() || 'None reported.',
      budgetSpent,
      upcomingActivities: parseList(upcomingText),
      supportRequired: supportText.trim() || 'Standard central support.',
    });

    setIsSubmitModalOpen(false);
    resetForm();
    reloadData();
  };

  const resetForm = () => {
    setWorkCompletedText('');
    setWorkInProgressText('');
    setWorkPendingText('');
    setProblemsText('');
    setBudgetSpent(0);
    setUpcomingText('');
    setSupportText('');
  };

  const handleReviewAction = (action: 'APPROVE' | 'REQUEST_REVISION') => {
    if (!inspectReport) return;
    RmsStore.reviewWeeklyReport(
      inspectReport.id,
      action,
      `${currentUser.fullName} (${currentUser.role.replace('_', ' ')})`,
      reviewComments.trim() || undefined
    );
    setIsReviewModalOpen(false);
    setReviewComments('');
    reloadData();
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-purple-500/10 text-purple-600 rounded-lg">
              <FileCheck2 className="w-6 h-6" />
            </span>
            <h1 className="text-2xl font-bold text-slate-900">Weekly Committee Progress Reports</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Mandatory weekly progress submissions from all 12 committee directors, evaluated and approved by Central Leadership (Convener & Member Secretary).
          </p>
        </div>

        {canSubmit && (
          <button
            onClick={() => setIsSubmitModalOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-xl transition shadow-sm text-sm"
          >
            <Plus className="w-4 h-4" /> Submit Weekly Report
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          <select
            value={selectedCommitteeId}
            onChange={(e) => setSelectedCommitteeId(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700"
          >
            <option value="ALL">All Committees</option>
            {committees.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nameEn}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700"
          >
            <option value="ALL">All Submission Statuses</option>
            <option value="SUBMITTED">Submitted (Pending Review)</option>
            <option value="APPROVED">Approved by Convener</option>
            <option value="REVISION_REQUESTED">Revision Requested</option>
          </select>
        </div>
      </div>

      {/* Reports Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredReports.map((rep) => (
          <div
            key={rep.id}
            className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">
                  Week {rep.reportWeekNumber} Report
                </span>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    rep.status === 'APPROVED'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : rep.status === 'REVISION_REQUESTED'
                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}
                >
                  {rep.status.replace('_', ' ')}
                </span>
              </div>

              <h3 className="font-bold text-slate-900 text-lg mt-3">{rep.committeeName}</h3>
              <p className="text-xs text-slate-500">Director: {rep.directorName}</p>

              <div className="mt-4 pt-3 border-t border-slate-100 space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" /> Date:
                  </span>
                  <span className="font-semibold text-slate-800">{rep.reportDate}</span>
                </div>
                <div className="flex items-center justify-between text-slate-500">
                  <span className="flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5" /> Week's Expense:
                  </span>
                  <span className="font-semibold text-slate-800">৳{rep.budgetSpent.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-slate-500">
                  <span>Work Items Done:</span>
                  <span className="font-semibold text-emerald-600">{rep.workCompleted.length} items</span>
                </div>
              </div>

              {rep.reviewerComments && (
                <div className="mt-4 p-3 bg-slate-50 rounded-xl text-xs text-slate-600">
                  <span className="font-bold text-slate-800 block mb-0.5">Central Review:</span>
                  {rep.reviewerComments}
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
              <button
                onClick={() => setInspectReport(rep)}
                className="w-full inline-flex items-center justify-center gap-1.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg transition"
              >
                <Eye className="w-4 h-4" /> Inspect Full Report
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Report Inspector Modal */}
      {inspectReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-purple-600">
                  Week {inspectReport.reportWeekNumber} Progress Submission
                </span>
                <h2 className="text-xl font-bold text-slate-900 mt-1">{inspectReport.committeeName}</h2>
                <p className="text-xs text-slate-500">
                  Submitted by {inspectReport.directorName} on {inspectReport.reportDate}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrint}
                  className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
                  title="Print Report"
                >
                  <Printer className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setInspectReport(null)}
                  className="text-slate-400 hover:text-slate-600 font-bold text-lg"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              {/* Completed Work */}
              <div>
                <h4 className="font-bold text-emerald-800 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> 1. Work Completed This Week
                </h4>
                <ul className="space-y-1 pl-4 list-disc text-slate-700">
                  {inspectReport.workCompleted.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              </div>

              {/* Work in progress */}
              <div>
                <h4 className="font-bold text-sky-800 uppercase tracking-wider mb-1.5">
                  2. Work Currently in Progress
                </h4>
                <ul className="space-y-1 pl-4 list-disc text-slate-700">
                  {inspectReport.workInProgress.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              </div>

              {/* Work pending */}
              <div>
                <h4 className="font-bold text-amber-800 uppercase tracking-wider mb-1.5">
                  3. Pending Work & Dependencies
                </h4>
                <ul className="space-y-1 pl-4 list-disc text-slate-700">
                  {inspectReport.workPending.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              </div>

              {/* Problems Encountered */}
              {inspectReport.problemsEncountered && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl">
                  <h4 className="font-bold text-rose-800 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-600" /> Bottlenecks & Obstacles Encountered
                  </h4>
                  <p className="text-rose-900">{inspectReport.problemsEncountered}</p>
                </div>
              )}

              {/* Upcoming activities */}
              <div>
                <h4 className="font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                  4. Upcoming Activities Next Week
                </h4>
                <ul className="space-y-1 pl-4 list-disc text-slate-700">
                  {inspectReport.upcomingActivities.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              </div>

              {/* Central support needed */}
              {inspectReport.supportRequired && (
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl">
                  <h4 className="font-bold text-purple-800 uppercase tracking-wider mb-1">
                    5. Central Committee Decisions & Support Required
                  </h4>
                  <p className="text-purple-900">{inspectReport.supportRequired}</p>
                </div>
              )}

              {/* Reviewer Note */}
              {inspectReport.reviewedBy && (
                <div className="p-3 bg-slate-100 rounded-xl">
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">
                    Reviewed By {inspectReport.reviewedBy} at {inspectReport.reviewedAt}
                  </span>
                  <p className="text-slate-800 font-medium mt-1">{inspectReport.reviewerComments}</p>
                </div>
              )}
            </div>

            {/* Actions for Convener/Secretary */}
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
              <span
                className={`text-xs font-bold uppercase px-3 py-1 rounded-full ${
                  inspectReport.status === 'APPROVED'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                Status: {inspectReport.status}
              </span>

              {canReview && inspectReport.status !== 'APPROVED' && (
                <button
                  onClick={() => setIsReviewModalOpen(true)}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg shadow-sm"
                >
                  Conduct Central Review
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Central Review Feedback Modal */}
      {isReviewModalOpen && inspectReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="font-bold text-slate-900 text-lg">Central Committee Review Feedback</h3>
            <p className="text-xs text-slate-500 mt-1">Reviewing Week {inspectReport.reportWeekNumber} for {inspectReport.committeeName}</p>

            <div className="mt-4">
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Executive Comments / Directives
              </label>
              <textarea
                rows={3}
                placeholder="Enter feedback or requested revisions..."
                value={reviewComments}
                onChange={(e) => setReviewComments(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsReviewModalOpen(false)}
                className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleReviewAction('REQUEST_REVISION')}
                className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg"
              >
                Request Revision
              </button>
              <button
                type="button"
                onClick={() => handleReviewAction('APPROVE')}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg"
              >
                Approve Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submit Report Modal */}
      {isSubmitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Submit Weekly Progress Report</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Committee</label>
                  <select
                    value={commId}
                    onChange={(e) => setCommId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {committees.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nameEn}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Report Week #</label>
                  <input
                    type="number"
                    min="1"
                    max="52"
                    required
                    value={weekNumber}
                    onChange={(e) => setWeekNumber(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                  1. Work Completed This Week (One per line)
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Completed venue layout draft&#10;Met with printing press vendor"
                  value={workCompletedText}
                  onChange={(e) => setWorkCompletedText(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                  2. Work in Progress (One per line)
                </label>
                <textarea
                  rows={2}
                  placeholder="Reviewing security gate quotes&#10;Organizing volunteer rosters"
                  value={workInProgressText}
                  onChange={(e) => setWorkInProgressText(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                  3. Pending Work & Dependencies (One per line)
                </label>
                <textarea
                  rows={2}
                  placeholder="Awaiting approval from police administration"
                  value={workPendingText}
                  onChange={(e) => setWorkPendingText(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                    Week's Budget Spent (৳)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={budgetSpent}
                    onChange={(e) => setBudgetSpent(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                    Problems Encountered
                  </label>
                  <input
                    type="text"
                    placeholder="None / Vendor delay..."
                    value={problemsText}
                    onChange={(e) => setProblemsText(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                  4. Upcoming Activities Next Week
                </label>
                <textarea
                  rows={2}
                  placeholder="Finalize stage sound contract"
                  value={upcomingText}
                  onChange={(e) => setUpcomingText(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                  5. Central Committee Support Required
                </label>
                <input
                  type="text"
                  placeholder="Approval for financial disbursement advance..."
                  value={supportText}
                  onChange={(e) => setSupportText(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsSubmitModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-xl shadow-sm transition"
                >
                  Submit Weekly Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
