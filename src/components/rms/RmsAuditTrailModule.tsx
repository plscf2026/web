import React, { useState } from 'react';
import {
  Search,
  Download,
  Calendar,
  ShieldCheck,
  User,
} from 'lucide-react';
import { RmsAuditLog } from '../../types/rms';
import { RmsStore } from '../../services/rmsStore';
import { formatCsvRow } from '../../utils/security';
import { GlobalPagination } from '../common/GlobalPagination';
import { paginate } from '../../utils/pagination';

export const RmsAuditTrailModule: React.FC = () => {
  const [logs] = useState<RmsAuditLog[]>(() => RmsStore.getAuditLogs());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEntity, setSelectedEntity] = useState<string>('ALL');
  const [selectedAction, setSelectedAction] = useState<string>('ALL');

  // Global Pagination State (Default 10, options 10, 20, 30, 40)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Reset to page 1 on search or filter change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedEntity, selectedAction]);

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.entityId && log.entityId.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesEntity = selectedEntity === 'ALL' || log.entityType === selectedEntity;
    const matchesAction = selectedAction === 'ALL' || log.action === selectedAction;
    return matchesSearch && matchesEntity && matchesAction;
  });

  const handleExportCsv = () => {
    const headers = ['ID', 'Timestamp', 'User ID', 'User Name', 'Role', 'Action', 'Entity Type', 'Entity ID', 'Details'];
    const rows = filteredLogs.map((l) =>
      formatCsvRow([
        l.id,
        l.timestamp,
        l.userId,
        l.userName,
        l.userRole,
        l.action,
        l.entityType,
        l.entityId || '',
        l.details,
      ])
    );
    const csvContent = 'data:text/csv;charset=utf-8,' + [formatCsvRow(headers), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `rms_audit_logs_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-slate-900 text-white rounded-lg">
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
            </span>
            <h1 className="text-2xl font-bold text-slate-900">Immutable Audit Trail & Compliance Log</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Tamper-evident, zero-silent-deletion audit log tracking every leadership action, financial reversal, voucher change, and committee milestone.
          </p>
        </div>

        <button
          onClick={handleExportCsv}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-xl transition shadow-sm text-sm"
        >
          <Download className="w-4 h-4 text-emerald-400" /> Export Compliance CSV
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by user, details, entity ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>

        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <select
            value={selectedEntity}
            onChange={(e) => setSelectedEntity(e.target.value)}
            className="flex-1 sm:flex-initial px-3 py-2.5 sm:py-2 text-base sm:text-sm border border-slate-200 rounded-lg bg-white text-slate-700 min-h-[44px] sm:min-h-0"
          >
            <option value="ALL">All Entity Types</option>
            <option value="COMMITTEE">Committees</option>
            <option value="TASK">Tasks</option>
            <option value="BUDGET">Budgets</option>
            <option value="EXPENSE">Expenses & Vouchers</option>
            <option value="SPONSOR">Sponsors</option>
            <option value="DOCUMENT">Documents</option>
            <option value="MEETING">Meetings</option>
            <option value="REPORT">Weekly Reports</option>
            <option value="USER">User Logins</option>
          </select>

          <select
            value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value)}
            className="flex-1 sm:flex-initial px-3 py-2.5 sm:py-2 text-base sm:text-sm border border-slate-200 rounded-lg bg-white text-slate-700 min-h-[44px] sm:min-h-0"
          >
            <option value="ALL">All Actions</option>
            <option value="INITIALIZE_RMS_PLATFORM">Initialize RMS Platform</option>
            <option value="CREATE_TASK">Create Task</option>
            <option value="TASK_STATUS_CHANGE">Task Status Change</option>
            <option value="APPROVE_BUDGET">Approve Budget</option>
            <option value="RECORD_EXPENSE">Record Expense</option>
            <option value="REVERSE_EXPENSE">Reverse Expense (Audit)</option>
            <option value="UPLOAD_DOCUMENT">Upload Document</option>
            <option value="SCHEDULE_MEETING">Schedule Meeting</option>
            <option value="SUBMIT_WEEKLY_REPORT">Submit Weekly Report</option>
            <option value="REPORT_APPROVE">Approve Weekly Report</option>
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Desktop Table View (>= 640px) */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Timestamp</th>
                <th className="px-6 py-4">Actor / User</th>
                <th className="px-6 py-4">Action</th>
                <th className="px-6 py-4">Entity</th>
                <th className="px-6 py-4">Audit Details & Justification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-xs">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-sans">
                    No audit records found matching criteria.
                  </td>
                </tr>
              ) : (
                paginate(filteredLogs, currentPage, pageSize).map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-slate-700">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {new Date(log.timestamp).toLocaleString()}
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">#{log.id}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="p-1 bg-slate-100 text-slate-700 rounded-md">
                          <User className="w-3.5 h-3.5" />
                        </span>
                        <div>
                          <p className="font-semibold text-slate-900 font-sans">{log.userName}</p>
                          <span className="text-[10px] text-slate-400 font-mono uppercase">{log.userRole}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-block px-2.5 py-1 text-[11px] font-bold rounded-md uppercase tracking-wider ${
                          log.action.includes('REVERSE')
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : log.action.includes('APPROVE')
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : log.action.includes('SUBMIT')
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-block px-2 py-0.5 rounded text-[11px] bg-slate-100 text-slate-700 font-semibold font-sans">
                        {log.entityType}
                      </span>
                      {log.entityId && (
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{log.entityId}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 font-sans text-xs text-slate-700">
                      <p className="leading-relaxed">{log.details}</p>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View (< 640px) */}
        <div className="sm:hidden space-y-3 p-3 font-sans">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              No audit records found matching criteria.
            </div>
          ) : (
            paginate(filteredLogs, currentPage, pageSize).map((log) => (
              <div
                key={log.id}
                className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={`inline-block px-2.5 py-0.5 text-[10px] font-bold rounded-md uppercase tracking-wider shrink-0 ${
                      log.action.includes('REVERSE')
                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                        : log.action.includes('APPROVE')
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : log.action.includes('SUBMIT')
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : 'bg-slate-100 text-slate-800'
                    }`}
                  >
                    {log.action}
                  </span>
                  <div className="text-right text-[11px] font-mono text-slate-500">
                    <div>{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    <div className="text-[10px] text-slate-400">{new Date(log.timestamp).toLocaleDateString()}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">User / Actor</span>
                    <span className="font-bold text-slate-900 block truncate">{log.userName}</span>
                    <span className="text-[10px] text-slate-500 uppercase font-mono block">{log.userRole}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Entity</span>
                    <span className="font-bold text-slate-800 block truncate">{log.entityType}</span>
                    {log.entityId && (
                      <span className="text-[10px] font-mono text-slate-400 block truncate">{log.entityId}</span>
                    )}
                  </div>
                </div>

                <div className="text-xs text-slate-600 leading-relaxed bg-slate-50/50 p-2 rounded border border-slate-100">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Audit Justification</span>
                  {log.details}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Global Pagination */}
        <GlobalPagination
          currentPage={currentPage}
          totalRecords={filteredLogs.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
      </div>
    </div>
  );
};
