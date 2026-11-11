import React, { useState, useEffect } from 'react';
import {
  FileText,
  Search,
  Filter,
  Download,
  RefreshCw,
  ShieldAlert,
  ArrowRight,
  Clock,
  User,
  Tag,
} from 'lucide-react';
import { AdminAuditHistoryItem } from '../../types';
import { EventStore } from '../../services/eventStore';
import { formatCsvRow } from '../../utils/security';

export const AuditHistoryTab: React.FC = () => {
  const [history, setHistory] = useState<AdminAuditHistoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [entityFilter, setEntityFilter] = useState<string>('ALL');

  const loadHistory = () => {
    const records = EventStore.getAuditHistory();
    setHistory(records);
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const filteredHistory = history.filter((item) => {
    const matchesSearch =
      item.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.entityId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.reason.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.adminName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesEntity = entityFilter === 'ALL' || item.entityType === entityFilter;
    return matchesSearch && matchesEntity;
  });

  const exportAuditCSV = () => {
    const headers = [
      'Timestamp (ISO)',
      'Timestamp (Dhaka Time)',
      'Admin Name',
      'Admin ID',
      'Entity Type',
      'Entity ID',
      'Action',
      'Previous Value',
      'New Value',
      'Audit Reason',
    ];

    const rows = filteredHistory.map((item) => {
      const dhakaTime = new Date(item.timestamp).toLocaleString('en-US', {
        timeZone: 'Asia/Dhaka',
      });
      return formatCsvRow([
        item.timestamp,
        dhakaTime,
        item.adminName,
        item.adminId,
        item.entityType,
        item.entityId,
        item.action,
        item.previousValue || '',
        item.newValue || '',
        item.reason,
      ]);
    });

    const csvContent = [formatCsvRow(headers), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `reunion_2026_audit_trail_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getEntityBadge = (type: string) => {
    switch (type) {
      case 'MEAL':
        return <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">Meal</span>;
      case 'GATE':
        return <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">Gate</span>;
      case 'DRESS':
        return <span className="px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">Dress</span>;
      case 'BUDGET':
        return <span className="px-2 py-0.5 rounded text-xs font-medium bg-teal-100 text-teal-800">Budget</span>;
      case 'EXPENSE':
        return <span className="px-2 py-0.5 rounded text-xs font-medium bg-rose-100 text-rose-800">Expense</span>;
      case 'STAFF':
        return <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">Staff</span>;
      case 'REGISTRATION':
        return <span className="px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">Registration</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800">{type}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Privileged Operations Audit Log</h2>
              <p className="text-sm text-slate-500">
                Part 10: Immutable audit trail for every administrative override, budget allocation, gate correction, and staff modification.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadHistory}
            className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors"
            title="Refresh Audit Trail"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={exportAuditCSV}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors text-sm font-medium shadow-sm"
          >
            <Download className="w-4 h-4" />
            Export Audit Trail (CSV)
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search by action, ID, admin name, or audit reason..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">All Categories ({history.length})</option>
              <option value="MEAL">Meal Overrides</option>
              <option value="GATE">Gate Overrides</option>
              <option value="DRESS">Dress Overrides</option>
              <option value="BUDGET">Budget & Allocations</option>
              <option value="EXPENSE">Expense Approvals/Voids</option>
              <option value="STAFF">Staff Account Actions</option>
              <option value="REGISTRATION">Registration Overrides</option>
            </select>
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-4">Timestamp (Dhaka)</th>
                <th className="py-3 px-4">Admin Identity</th>
                <th className="py-3 px-4">Entity & Action</th>
                <th className="py-3 px-4">Previous &rarr; New Value</th>
                <th className="py-3 px-4">Mandatory Audit Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-400">
                    <FileText className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    No audit records found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredHistory.map((item) => {
                  const dhakaTime = new Date(item.timestamp).toLocaleString('en-US', {
                    timeZone: 'Asia/Dhaka',
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  });
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap text-xs text-slate-600">
                        <div className="flex items-center gap-1.5 font-medium">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{dhakaTime}</span>
                        </div>
                        <span className="font-mono text-[10px] text-slate-400">{item.id}</span>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-semibold text-slate-800 text-xs">{item.adminName}</span>
                        </div>
                        <span className="text-[11px] font-mono text-slate-400 pl-5">{item.adminId}</span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 mb-1">
                          {getEntityBadge(item.entityType)}
                          <span className="font-mono text-xs font-bold text-slate-700">
                            {item.action}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-slate-500">
                          <Tag className="w-3 h-3 text-slate-400" />
                          <span className="font-mono">{item.entityId}</span>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-xs max-w-xs truncate">
                        {item.previousValue || item.newValue ? (
                          <div className="flex items-center gap-1.5 text-slate-600">
                            {item.previousValue && (
                              <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono truncate max-w-[120px]">
                                {item.previousValue}
                              </span>
                            )}
                            {item.previousValue && item.newValue && (
                              <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                            )}
                            {item.newValue && (
                              <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-mono font-medium truncate max-w-[140px]">
                                {item.newValue}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">No value change</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-xs text-slate-700 font-medium">
                        <div className="bg-slate-50 border border-slate-200 rounded-md p-2">
                          {item.reason}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
