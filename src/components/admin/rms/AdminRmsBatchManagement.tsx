import React, { useState } from 'react';
import {
  Users,
  Search,
  Download,
  Calendar,
  UserCheck,
  Phone,
  Edit2,
  CheckCircle2,
  Clock,
  Eye,
  X,
} from 'lucide-react';
import { RegistrationRecord, Language } from '../../../types';
import { formatCsvRow } from '../../../utils/security';
import { GlobalPagination } from '../../common/GlobalPagination';
import { paginate } from '../../../utils/pagination';

interface BatchInfo {
  batchId: string;
  batchName: string;
  year?: string;
  category: 'former' | 'current';
  representativeName?: string;
  representativePhone?: string;
  representativeEmail?: string;
  notes?: string;
}

interface Props {
  language: Language;
  registrations: RegistrationRecord[];
}

export const AdminRmsBatchManagement: React.FC<Props> = ({
  language = 'en',
  registrations,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'former' | 'current'>('all');
  const [selectedBatchDetails, setSelectedBatchDetails] = useState<string | null>(null);

  // Global Pagination State (Default 10, options 10, 20, 30, 40)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Reset to page 1 on search or filter change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory]);

  // Batch representative assignments saved in local state or localStorage
  const [batchMetadata, setBatchMetadata] = useState<Record<string, BatchInfo>>(() => {
    try {
      const saved = localStorage.getItem('plscf_batch_metadata_2027');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn(e);
    }
    return {
      'SSC 1998': {
        batchId: 'SSC 1998',
        batchName: 'SSC 1998',
        year: '1998',
        category: 'former',
        representativeName: 'Tanvir Ahmed',
        representativePhone: '01711223344',
        representativeEmail: 'tanvir@example.com',
      },
      'SSC 2012': {
        batchId: 'SSC 2012',
        batchName: 'SSC 2012',
        year: '2012',
        category: 'former',
        representativeName: 'Sagar',
        representativePhone: '01711000005',
        representativeEmail: 'sagar@policelines.edu.bd',
      },
    };
  });

  // Edit Batch Rep Modal State
  const [editingBatch, setEditingBatch] = useState<BatchInfo | null>(null);
  const [repName, setRepName] = useState('');
  const [repPhone, setRepPhone] = useState('');
  const [repEmail, setRepEmail] = useState('');
  const [repNotes, setRepNotes] = useState('');

  // Extract all distinct batches from real registration records
  const batchMap: Record<
    string,
    {
      batchName: string;
      category: 'former' | 'current';
      year?: string;
      attendees: RegistrationRecord[];
      paidCount: number;
      pendingCount: number;
      totalContribution: number;
    }
  > = {};

  registrations.forEach((reg) => {
    const key = reg.batchName || (reg.category === 'former' ? `Batch ${reg.passingYear || 'Unknown'}` : reg.currentClass || 'Current Class');
    if (!batchMap[key]) {
      batchMap[key] = {
        batchName: key,
        category: reg.category,
        year: reg.passingYear || reg.currentClass,
        attendees: [],
        paidCount: 0,
        pendingCount: 0,
        totalContribution: 0,
      };
    }
    batchMap[key].attendees.push(reg);
    if (reg.paymentStatus === 'paid') {
      batchMap[key].paidCount += 1;
      batchMap[key].totalContribution += reg.totalPaid || 0;
    } else {
      batchMap[key].pendingCount += 1;
    }
  });

  const allBatches = Object.values(batchMap);

  const filteredBatches = allBatches.filter((b) => {
    const matchesSearch =
      b.batchName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.year && b.year.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (batchMetadata[b.batchName]?.representativeName &&
        batchMetadata[b.batchName].representativeName!.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCat = selectedCategory === 'all' || b.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const handleOpenEditRep = (b: { batchName: string; category: 'former' | 'current'; year?: string }) => {
    const existing = batchMetadata[b.batchName] || {
      batchId: b.batchName,
      batchName: b.batchName,
      category: b.category,
      year: b.year,
    };
    setEditingBatch(existing);
    setRepName(existing.representativeName || '');
    setRepPhone(existing.representativePhone || '');
    setRepEmail(existing.representativeEmail || '');
    setRepNotes(existing.notes || '');
  };

  const handleSaveRep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBatch) return;

    const updated: Record<string, BatchInfo> = {
      ...batchMetadata,
      [editingBatch.batchName]: {
        ...editingBatch,
        representativeName: repName.trim(),
        representativePhone: repPhone.trim(),
        representativeEmail: repEmail.trim(),
        notes: repNotes.trim(),
      },
    };

    setBatchMetadata(updated);
    try {
      localStorage.setItem('plscf_batch_metadata_2027', JSON.stringify(updated));
    } catch (err) {
      console.warn(err);
    }
    setEditingBatch(null);
  };

  const handleExportCsv = () => {
    const headers = ['Batch Name', 'Category', 'Year', 'Total Registered', 'Confirmed (Paid)', 'Pending', 'Total Collection (BDT)', 'Batch Representative', 'Rep Phone'];
    const rows = filteredBatches.map((b) => {
      const rep = batchMetadata[b.batchName];
      return formatCsvRow([
        b.batchName,
        b.category,
        b.year || '',
        b.attendees.length,
        b.paidCount,
        b.pendingCount,
        b.totalContribution,
        rep?.representativeName || 'Unassigned',
        rep?.representativePhone || '',
      ]);
    });
    const csvContent = 'data:text/csv;charset=utf-8,' + [formatCsvRow(headers), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `reunion_batches_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const selectedBatchGroup = selectedBatchDetails ? batchMap[selectedBatchDetails] : null;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
              <Users className="w-6 h-6" />
            </span>
            <h2 className="text-2xl font-bold text-slate-900">Batch & Cohort Management</h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Reconcile all alumni batches and student cohorts directly from registration records, assign batch coordinators, and track financial disbursements.
          </p>
        </div>

        <button
          onClick={handleExportCsv}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition shadow-xs cursor-pointer"
        >
          <Download className="w-4 h-4 text-emerald-400" />
          <span>Export Batch CSV</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by batch name, year, or coordinator..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value as any)}
            className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 font-semibold cursor-pointer"
          >
            <option value="all">All Cohorts ({allBatches.length})</option>
            <option value="former">Alumni Batches</option>
            <option value="current">Current Enrolled Classes</option>
          </select>
        </div>
      </div>

      {/* Batches Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Batch / Class Name</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Registered Students</th>
                <th className="px-6 py-4">Payment Status</th>
                <th className="px-6 py-4">Financial Inflow</th>
                <th className="px-6 py-4">Batch Representative</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredBatches.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400 text-sm">
                    No student batches found matching the search criteria.
                  </td>
                </tr>
              ) : (
                paginate(filteredBatches, currentPage, pageSize).map((b) => {
                  const rep = batchMetadata[b.batchName];

                  return (
                    <tr key={b.batchName} className="hover:bg-slate-50/80 transition">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="p-1.5 bg-indigo-50 text-indigo-700 rounded-lg">
                            <Calendar className="w-4 h-4" />
                          </span>
                          <div>
                            <span className="font-bold text-slate-900 text-sm">{b.batchName}</span>
                            {b.year && <span className="block text-[10px] text-slate-400 font-mono">Year: {b.year}</span>}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-block px-2.5 py-1 text-[10px] font-bold rounded-full uppercase tracking-wider ${
                            b.category === 'former'
                              ? 'bg-blue-50 text-blue-800 border border-blue-200'
                              : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          {b.category === 'former' ? 'Alumni' : 'Current Student'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-slate-900 text-sm">{b.attendees.length}</span>
                        <span className="text-slate-400 text-[11px] block">Students Registered</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-emerald-600 font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{b.paidCount} Confirmed</span>
                          </div>
                          {b.pendingCount > 0 && (
                            <div className="flex items-center gap-1.5 text-amber-600 font-semibold">
                              <Clock className="w-3.5 h-3.5" />
                              <span>{b.pendingCount} Pending</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-black text-slate-900 text-sm">৳{b.totalContribution.toLocaleString()}</span>
                        <span className="text-[10px] text-slate-400 block">Verified collected</span>
                      </td>
                      <td className="px-6 py-4">
                        {rep?.representativeName ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1 font-bold text-slate-900">
                              <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                              <span>{rep.representativeName}</span>
                            </div>
                            {rep.representativePhone && (
                              <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
                                <Phone className="w-3 h-3 text-slate-400" />
                                <span>{rep.representativePhone}</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-xs">No representative assigned</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setSelectedBatchDetails(b.batchName)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
                            title="Inspect Registered Attendees"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenEditRep(b)}
                            className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg transition"
                            title="Assign / Edit Batch Representative"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Global Pagination */}
        <GlobalPagination
          currentPage={currentPage}
          totalRecords={filteredBatches.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          language={language}
        />
      </div>

      {/* Inspect Batch Attendees Drawer Modal */}
      {selectedBatchGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                  Batch Attendee Roster
                </span>
                <h3 className="font-bold text-slate-900 text-xl mt-0.5">{selectedBatchGroup.batchName}</h3>
                <p className="text-xs text-slate-500">
                  Total {selectedBatchGroup.attendees.length} Students | ৳{selectedBatchGroup.totalContribution.toLocaleString()} Collected
                </p>
              </div>
              <button
                onClick={() => setSelectedBatchDetails(null)}
                className="text-slate-400 hover:text-slate-600 font-bold p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto pr-1 divide-y divide-slate-100 text-xs">
              {selectedBatchGroup.attendees.map((att) => (
                <div key={att.id} className="py-2.5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <img
                      src={att.photoUrl}
                      alt={att.fullName}
                      className="w-10 h-10 rounded-xl object-cover border border-slate-200"
                    />
                    <div>
                      <p className="font-bold text-slate-900 text-sm">{att.fullName}</p>
                      <p className="text-[11px] text-slate-400 font-mono">
                        {att.id} • {att.mobileNumber} {att.studentId ? `• ID: ${att.studentId}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        att.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {att.paymentStatus}
                    </span>
                    <span className="block font-black text-slate-900 text-xs mt-0.5">
                      ৳{(att.totalPaid || 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedBatchDetails(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold"
              >
                Close Roster
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Batch Representative Modal */}
      {editingBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="font-bold text-slate-900 text-lg">Assign Batch Representative</h3>
            <p className="text-xs text-slate-500 mt-1">Batch: {editingBatch.batchName}</p>

            <form onSubmit={handleSaveRep} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Representative Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mahinur Rahman"
                  value={repName}
                  onChange={(e) => setRepName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Contact Mobile Number *
                </label>
                <input
                  type="text"
                  required
                  placeholder="017XXXXXXXX"
                  value={repPhone}
                  onChange={(e) => setRepPhone(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Email Address (Optional)
                </label>
                <input
                  type="email"
                  placeholder="coordinator@example.com"
                  value={repEmail}
                  onChange={(e) => setRepEmail(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Coordination Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Responsibilities, special coordination requirements..."
                  value={repNotes}
                  onChange={(e) => setRepNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingBatch(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl"
                >
                  Save Batch Representative
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
