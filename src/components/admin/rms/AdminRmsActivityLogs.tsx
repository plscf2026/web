import React, { useState } from 'react';
import {
  ShieldAlert,
  Search,
  Filter,
  Download,
  Calendar,
  Clock,
  RefreshCw,
} from 'lucide-react';
import { RmsAuditLog } from '../../../types/rms';
import { Language } from '../../../types';
import { RmsStore } from '../../../services/rmsStore';
import { formatCsvRow } from '../../../utils/security';
import { GlobalPagination } from '../../common/GlobalPagination';
import { paginate } from '../../../utils/pagination';

interface Props {
  language: Language;
}

export const AdminRmsActivityLogs: React.FC<Props> = ({ language }) => {
  const [logs, setLogs] = useState<RmsAuditLog[]>(() => RmsStore.getAuditLogs());
  const [searchQuery, setSearchQuery] = useState('');
  const [entityFilter, setEntityFilter] = useState<string>('all');

  // Global Pagination State (Default 10, options 10, 20, 30, 40)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Reset to page 1 on search or filter change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, entityFilter]);

  const reloadLogs = () => {
    setLogs(RmsStore.getAuditLogs());
  };

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.entityId.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesEntity = entityFilter === 'all' || log.entityType === entityFilter;

    return matchesSearch && matchesEntity;
  });

  const handleExportCsv = () => {
    const headers = ['Log ID', 'Timestamp', 'Actor Name', 'Actor Role', 'Action', 'Entity Type', 'Entity ID', 'Details', 'Previous Value', 'New Value'];
    const rows = filteredLogs.map((l) =>
      formatCsvRow([
        l.id,
        l.timestamp,
        l.userName,
        l.userRole,
        l.action,
        l.entityType,
        l.entityId,
        l.details,
        l.previousValue || '',
        l.newValue || '',
      ])
    );
    const csvContent = 'data:text/csv;charset=utf-8,' + [formatCsvRow(headers), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.href = encodedUri;
    link.download = `reunion_audit_trail_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const entityTypes: RmsAuditLog['entityType'][] = [
    'COMMITTEE',
    'TASK',
    'BUDGET',
    'EXPENSE',
    'SPONSOR',
    'DOCUMENT',
    'MEETING',
    'VOLUNTEER',
    'INCIDENT',
    'REPORT',
    'AUTH',
    'SYSTEM',
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-[#172554] text-white p-6 rounded-3xl shadow-lg border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-bold uppercase tracking-wider border border-blue-400/30">
              Module 11
            </span>
            <span className="text-xs text-slate-300 font-medium">Reunion Management ERP</span>
          </div>
          <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-amber-400" />
            <span>{language === 'bn' ? 'কার্যক্রম অডিট ট্রেইল ও লগ' : 'System Activity & Governance Audit Trail'}</span>
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-xl">
            {language === 'bn'
              ? 'কমিটি পরিবর্তন, টাস্ক ডেলিভারি, বাজেট অনুমোদন, ভাউচার রিভার্সাল ও সকল প্রশাসনিক কার্যক্রমের অপরিবর্তনযোগ্য লগ।'
              : 'Immutable chronological audit record tracking financial mutations, task reviews, committee governance, and user authorizations.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={reloadLogs}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold text-xs shadow-md transition cursor-pointer"
          >
            <RefreshCw className="w-4 h-4 text-emerald-400" />
            <span>Refresh Logs</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-bold text-xs shadow-md transition cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export Audit CSV</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full md:w-auto">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder={language === 'bn' ? 'অ্যাকশন, ইউজার বা বিবরণ অনুসন্ধান...' : 'Search logs by action, user, or details...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-hidden"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs bg-white text-slate-700 focus:outline-hidden"
          >
            <option value="all">All Entity Types</option>
            {entityTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Actor & Role</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Entity Type & ID</th>
                <th className="px-4 py-3">Details & Audit Trail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginate(filteredLogs, currentPage, pageSize).map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/80 transition">
                  <td className="px-4 py-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                      <Calendar className="w-3 h-3" />
                      {new Date(log.timestamp).toLocaleDateString()}
                    </span>
                  </td>

                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="font-bold text-slate-900">{log.userName}</div>
                    <span className="text-[10px] text-slate-500 uppercase font-mono">{log.userRole}</span>
                  </td>

                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        log.action.includes('REVERSE') || log.action.includes('REJECT')
                          ? 'bg-rose-100 text-rose-800'
                          : log.action.includes('CREATE') || log.action.includes('APPROVE')
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {log.action}
                    </span>
                  </td>

                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="font-bold text-slate-800">{log.entityType}</div>
                    <div className="text-[10px] font-mono text-slate-400">{log.entityId}</div>
                  </td>

                  <td className="px-4 py-3 text-slate-600 max-w-md">
                    <div className="leading-relaxed">{log.details}</div>
                    {(log.previousValue || log.newValue) && (
                      <div className="mt-1 text-[10px] font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 inline-block">
                        {log.previousValue && <span>Old: {log.previousValue} → </span>}
                        {log.newValue && <span className="font-bold text-slate-700">New: {log.newValue}</span>}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Global Pagination */}
        <GlobalPagination
          currentPage={currentPage}
          totalRecords={filteredLogs.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          language={language}
        />
      </div>
    </div>
  );
};

