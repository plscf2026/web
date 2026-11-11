import { useState, useMemo } from 'react';
import {
  ShieldCheck,
  Search,
  Plus,
  Upload,
  Download,
  CheckCircle2,
  AlertTriangle,
  Clock,
  XCircle,
  Edit2,
  Trash2,
  Power,
  RotateCcw,
  FileSpreadsheet,
} from 'lucide-react';
import { Language, CurrentStudentIdRecord, StudentIdStatus } from '../../types';
import { StudentIdService } from '../../services/studentIdStore';
import { formatCsvRow } from '../../utils/security';

interface StudentIdManagementTabProps {
  language: Language;
  onSelectTicket?: (registrationId: string) => void;
}

export const StudentIdManagementTab: React.FC<StudentIdManagementTabProps> = ({
  language,
}) => {
  const [studentIds, setStudentIds] = useState<CurrentStudentIdRecord[]>(() =>
    StudentIdService.getAllStudentIds()
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState('ALL');
  const [selectedYear, setSelectedYear] = useState('ALL');
  const [selectedUsage, setSelectedUsage] = useState('ALL');

  // Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<CurrentStudentIdRecord | null>(null);
  const [auditModalAction, setAuditModalAction] = useState<{
    type: 'TOGGLE_STATUS' | 'DELETE';
    record: CurrentStudentIdRecord;
  } | null>(null);
  const [auditReason, setAuditReason] = useState('');
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // New Single ID Form State
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [newClass, setNewClass] = useState('Class 10');
  const [newYear, setNewYear] = useState('2026');

  // CSV Import State
  const [csvContent, setCsvContent] = useState('');
  const [importReport, setImportReport] = useState<{
    totalRows: number;
    addedCount: number;
    duplicateCount: number;
    invalidCount: number;
    errorRows: string[];
  } | null>(null);

  const refreshList = () => {
    setStudentIds(StudentIdService.getAllStudentIds());
  };

  const metrics = useMemo(() => {
    return StudentIdService.getMetrics();
  }, [studentIds]);

  // Filtered List
  const filteredList = useMemo(() => {
    return studentIds.filter((item) => {
      if (selectedClass !== 'ALL' && item.className !== selectedClass) return false;
      if (selectedYear !== 'ALL' && item.academicYear !== selectedYear) return false;
      if (selectedUsage !== 'ALL' && item.verificationStatus !== selectedUsage) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesId = item.studentId.toLowerCase().includes(q);
        const matchesName = item.studentName?.toLowerCase().includes(q);
        const matchesReg = item.usedRegistrationId?.toLowerCase().includes(q);
        if (!matchesId && !matchesName && !matchesReg) return false;
      }
      return true;
    });
  }, [studentIds, selectedClass, selectedYear, selectedUsage, searchQuery]);

  // Handle Add Single ID
  const handleAddSingleId = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newId.trim()) return;

    const res = StudentIdService.addStudentId({
      studentId: newId.trim().toUpperCase(),
      studentName: newName.trim() || undefined,
      className: newClass,
      academicYear: newYear,
    });

    if (res.success) {
      refreshList();
      setShowAddModal(false);
      setNewId('');
      setNewName('');
      setActionMessage({
        text: language === 'bn' ? 'স্টুডেন্ট আইডি সফলভাবে যুক্ত করা হয়েছে।' : 'Student ID added successfully.',
        type: 'success',
      });
      setTimeout(() => setActionMessage(null), 3000);
    } else {
      setActionMessage({
        text: res.error || 'Failed to add student ID',
        type: 'error',
      });
    }
  };

  // Handle CSV Import
  const handleImportCSV = () => {
    if (!csvContent.trim()) return;
    const res = StudentIdService.importFromCSV(csvContent);
    setImportReport(res);
    refreshList();
    if (res.addedCount > 0) {
      setActionMessage({
        text: language === 'bn'
          ? `${res.addedCount}টি নতুন আইডি সফলভাবে ইমপোর্ট হয়েছে।`
          : `Successfully imported ${res.addedCount} new Student IDs.`,
        type: 'success',
      });
      setTimeout(() => setActionMessage(null), 4000);
    }
  };

  // Handle Export CSV with formula injection defense
  const handleExportCSV = () => {
    const headers = ['Student ID', 'Student Name', 'Class', 'Academic Year', 'Status', 'Verification Status', 'Used Registration ID', 'Created At'];
    const rows = studentIds.map((item) => [
      item.studentId,
      item.studentName || '',
      item.className,
      item.academicYear,
      item.status,
      item.verificationStatus,
      item.usedRegistrationId || '',
      item.createdAt,
    ]);

    const csvData = [formatCsvRow(headers), ...rows.map((r) => formatCsvRow(r))].join('\n');
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `PLSCF_Student_IDs_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle Confirmed Audit Action (Toggle or Delete)
  const handleConfirmAuditAction = () => {
    if (!auditModalAction || !auditReason.trim()) return;

    if (auditModalAction.type === 'TOGGLE_STATUS') {
      const nextStatus: StudentIdStatus = auditModalAction.record.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      const updated = StudentIdService.toggleStatus(
        auditModalAction.record.studentId,
        auditReason.trim(),
        'SUPER_ADMIN'
      );
      if (updated) {
        refreshList();
        setActionMessage({
          text: language === 'bn'
            ? `আইডি ${auditModalAction.record.studentId} স্ট্যাটাস পরিবর্তন করা হয়েছে।`
            : `ID ${auditModalAction.record.studentId} status updated to ${nextStatus}.`,
          type: 'success',
        });
      } else {
        setActionMessage({ text: 'Student ID record was not found.', type: 'error' });
      }
    } else if (auditModalAction.type === 'DELETE') {
      const res = StudentIdService.deleteRecord(
        auditModalAction.record.studentId,
        auditReason.trim(),
        'SUPER_ADMIN'
      );
      if (res.success) {
        refreshList();
        setActionMessage({
          text: language === 'bn'
            ? `আইডি ${auditModalAction.record.studentId} সফলভাবে মুছে ফেলা হয়েছে।`
            : `ID ${auditModalAction.record.studentId} deleted successfully.`,
          type: 'success',
        });
      } else {
        setActionMessage({
          text: res.error || 'Failed to delete record',
          type: 'error',
        });
      }
    }

    setAuditModalAction(null);
    setAuditReason('');
    setTimeout(() => setActionMessage(null), 3500);
  };

  // Handle Edit Update
  const handleUpdateRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;

    const res = StudentIdService.updateRecord(editingRecord.studentId, {
      studentName: editingRecord.studentName,
      className: editingRecord.className,
      academicYear: editingRecord.academicYear,
    }, 'Student ID details updated from the admin panel.');

    if (res) {
      refreshList();
      setEditingRecord(null);
      setActionMessage({
        text: language === 'bn' ? 'রেকর্ড সফলভাবে হালনাগাদ করা হয়েছে।' : 'Record updated successfully.',
        type: 'success',
      });
      setTimeout(() => setActionMessage(null), 3000);
    } else {
      setActionMessage({ text: 'Student ID record was not found.', type: 'error' });
    }
  };

  const classOptions = [
    'Class 6',
    'Class 7',
    'Class 8',
    'Class 9',
    'Class 10',
    'Class 11 (HSC)',
    'Class 12 (HSC)',
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner / Notification */}
      {actionMessage && (
        <div
          className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between border ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}
        >
          <span>{actionMessage.text}</span>
          <button
            onClick={() => setActionMessage(null)}
            className="text-xs font-bold hover:underline cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Module Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#172554]/10 text-[#172554] text-xs font-bold mb-2">
            <ShieldCheck className="w-4 h-4 text-[#172554]" />
            <span>
              {language === 'bn' ? 'প্রাতিষ্ঠানিক ডাটাবেজ মডিউল' : 'Institutional Database Module'}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900">
            {language === 'bn' ? 'বর্তমান শিক্ষার্থীদের আইডি ব্যবস্থাপনা' : 'CURRENT STUDENT ID MANAGEMENT'}
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            {language === 'bn'
              ? 'বিদ্যালয় ও কলেজ শাখায় বর্তমানে অধ্যয়নরত শিক্ষার্থীদের বৈধ আইডি তালিকা আপলোড, যাচাই ও নিয়ন্ত্রণ করুন।'
              : 'Maintain, upload, verify, and govern the official student ID database for active enrolled students.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2.5 rounded-xl bg-[#172554] hover:bg-[#263B8C] text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>{language === 'bn' ? 'নতুন আইডি যুক্ত করুন' : 'Add Single ID'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-[#172554] border border-slate-300 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
          >
            <Upload className="w-4 h-4 text-[#263B8C]" />
            <span>{language === 'bn' ? 'সিএসভি / এক্সেল আপলোড' : 'Upload CSV / Excel'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
            title="Export to CSV"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span>{language === 'bn' ? 'রপ্তানি' : 'Export'}</span>
          </button>
        </div>
      </div>

      {/* 5 KPI Metric Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Total Uploaded */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            {language === 'bn' ? 'মোট আপলোডকৃত আইডি' : 'Total Uploaded IDs'}
          </div>
          <div className="text-2xl font-black text-slate-900 mt-1 font-mono">
            {metrics.total}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            {language === 'bn' ? 'কেন্দ্রীয় ডাটাবেজ' : 'In Central DB'}
          </div>
        </div>

        {/* Available */}
        <div className="bg-white p-4 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-xs">
          <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
            {language === 'bn' ? 'রেজিস্ট্রেশনের জন্য প্রস্তুত' : 'Available IDs'}
          </div>
          <div className="text-2xl font-black text-emerald-800 mt-1 font-mono">
            {metrics.available}
          </div>
          <div className="text-[10px] text-emerald-600 mt-1">
            {language === 'bn' ? 'ব্যবহারযোগ্য' : 'Ready for checkout'}
          </div>
        </div>

        {/* Reserved */}
        <div className="bg-white p-4 rounded-xl border border-blue-200 bg-blue-50/20 shadow-xs">
          <div className="text-[11px] font-bold text-[#263B8C] uppercase tracking-wider">
            {language === 'bn' ? 'পেমেন্ট অপেক্ষমাণ' : 'Reserved in Checkout'}
          </div>
          <div className="text-2xl font-black text-[#263B8C] mt-1 font-mono">
            {metrics.reserved}
          </div>
          <div className="text-[10px] text-blue-600 mt-1">
            {language === 'bn' ? '১০ মিনিট লকিং' : '10-min checkout lock'}
          </div>
        </div>

        {/* Used / Registered */}
        <div className="bg-white p-4 rounded-xl border border-purple-200 bg-purple-50/20 shadow-xs">
          <div className="text-[11px] font-bold text-purple-700 uppercase tracking-wider">
            {language === 'bn' ? 'সফলভাবে নিবন্ধিত' : 'Successfully Registered'}
          </div>
          <div className="text-2xl font-black text-purple-800 mt-1 font-mono">
            {metrics.used}
          </div>
          <div className="text-[10px] text-purple-600 mt-1">
            {language === 'bn' ? 'পেমেন্ট সম্পন্ন' : 'Paid & verified'}
          </div>
        </div>

        {/* Inactive */}
        <div className="bg-white p-4 rounded-xl border border-amber-200 bg-amber-50/20 shadow-xs">
          <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">
            {language === 'bn' ? 'স্থগিত / নিষ্ক্রিয়' : 'Inactive / Suspended'}
          </div>
          <div className="text-2xl font-black text-amber-800 mt-1 font-mono">
            {metrics.inactive}
          </div>
          <div className="text-[10px] text-amber-600 mt-1">
            {language === 'bn' ? 'রেজিস্ট্রেশন অবরুদ্ধ' : 'Registration blocked'}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex-1 min-w-[240px] relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              language === 'bn'
                ? 'আইডি নম্বর, শিক্ষার্থীর নাম বা টিকিট নম্বর দিয়ে খুঁজুন...'
                : 'Search by Student ID, student name, or registration ID...'
            }
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#172554] bg-white text-slate-800"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Class Filter */}
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 bg-white font-medium text-slate-700 focus:outline-none"
          >
            <option value="ALL">{language === 'bn' ? 'সকল শ্রেণি (All Classes)' : 'All Classes'}</option>
            {classOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Academic Year Filter */}
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 bg-white font-medium text-slate-700 focus:outline-none"
          >
            <option value="ALL">{language === 'bn' ? 'সকল শিক্ষাবর্ষ' : 'All Years'}</option>
            <option value="2026">2026</option>
            <option value="2025">2025</option>
          </select>

          {/* Usage Filter */}
          <select
            value={selectedUsage}
            onChange={(e) => setSelectedUsage(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 bg-white font-medium text-slate-700 focus:outline-none"
          >
            <option value="ALL">{language === 'bn' ? 'সকল অবস্থা (All Status)' : 'All Status'}</option>
            <option value="AVAILABLE">{language === 'bn' ? 'প্রস্তুত (AVAILABLE)' : 'Available'}</option>
            <option value="RESERVED">{language === 'bn' ? 'সংরক্ষিত (RESERVED)' : 'Reserved'}</option>
            <option value="USED">{language === 'bn' ? 'ব্যবহৃত (USED)' : 'Used'}</option>
          </select>

          {(searchQuery || selectedClass !== 'ALL' || selectedYear !== 'ALL' || selectedUsage !== 'ALL') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedClass('ALL');
                setSelectedYear('ALL');
                setSelectedUsage('ALL');
              }}
              className="px-2 py-2 text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{language === 'bn' ? 'রিসেট' : 'Reset'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Student IDs Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-[#172554] text-white uppercase text-[11px] tracking-wider">
                <th className="py-3 px-4 font-bold">Student ID</th>
                <th className="py-3 px-4 font-bold">Student Name</th>
                <th className="py-3 px-4 font-bold">Class</th>
                <th className="py-3 px-4 font-bold">Year</th>
                <th className="py-3 px-4 font-bold">ID Status</th>
                <th className="py-3 px-4 font-bold">Usage Status</th>
                <th className="py-3 px-4 font-bold">Linked Booking</th>
                <th className="py-3 px-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    <AlertTriangle className="w-6 h-6 text-amber-500 mx-auto mb-2" />
                    <div>{language === 'bn' ? 'কোনো স্টুডেন্ট আইডি পাওয়া যায়নি।' : 'No Student ID records match your criteria.'}</div>
                  </td>
                </tr>
              ) : (
                filteredList.map((item) => (
                  <tr key={item.studentId} className="hover:bg-slate-50/70 transition-colors">
                    {/* Student ID */}
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {item.studentId}
                    </td>

                    {/* Student Name */}
                    <td className="py-3 px-4 font-medium text-slate-800">
                      {item.studentName || <span className="text-slate-400 italic">Not set</span>}
                    </td>

                    {/* Class */}
                    <td className="py-3 px-4 text-slate-600">
                      {item.className}
                    </td>

                    {/* Academic Year */}
                    <td className="py-3 px-4 text-slate-600 font-mono">
                      {item.academicYear}
                    </td>

                    {/* ID Status (ACTIVE vs INACTIVE) */}
                    <td className="py-3 px-4">
                      {item.status === 'ACTIVE' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          ACTIVE
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px]">
                          <XCircle className="w-3 h-3 text-amber-600" />
                          INACTIVE
                        </span>
                      )}
                    </td>

                    {/* Verification Status */}
                    <td className="py-3 px-4">
                      {item.verificationStatus === 'AVAILABLE' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px] border border-slate-300">
                          AVAILABLE
                        </span>
                      )}
                      {item.verificationStatus === 'RESERVED' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-[#263B8C] font-bold text-[10px]">
                          <Clock className="w-3 h-3" />
                          RESERVED
                        </span>
                      )}
                      {item.verificationStatus === 'USED' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-bold text-[10px]">
                          <CheckCircle2 className="w-3 h-3" />
                          USED
                        </span>
                      )}
                    </td>

                    {/* Linked Booking */}
                    <td className="py-3 px-4 font-mono text-[11px]">
                      {item.usedRegistrationId ? (
                        <span className="text-[#263B8C] font-bold">
                          {item.usedRegistrationId}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5 justify-end">
                        {/* Toggle Active / Inactive */}
                        <button
                          type="button"
                          onClick={() => {
                            setAuditModalAction({
                              type: 'TOGGLE_STATUS',
                              record: item,
                            });
                          }}
                          className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                            item.status === 'ACTIVE'
                              ? 'border-amber-300 text-amber-700 hover:bg-amber-50'
                              : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                          }`}
                          title={item.status === 'ACTIVE' ? 'Deactivate ID' : 'Activate ID'}
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>

                        {/* Edit Record */}
                        <button
                          type="button"
                          onClick={() => setEditingRecord({ ...item })}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                          title="Edit Record"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete (only permitted if not used) */}
                        {item.verificationStatus !== 'USED' && (
                          <button
                            type="button"
                            onClick={() => {
                              setAuditModalAction({
                                type: 'DELETE',
                                record: item,
                              });
                            }}
                            className="p-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Delete ID Record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="p-3 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-500 flex items-center justify-between">
          <span>
            {language === 'bn'
              ? `মোট ${filteredList.length}টি রেকর্ড প্রদর্শিত হচ্ছে`
              : `Showing ${filteredList.length} of ${studentIds.length} student ID records`}
          </span>
          <span className="text-[#172554] font-medium">
            POLICE LINES SCHOOL & COLLEGE, FARIDPUR
          </span>
        </div>
      </div>

      {/* MODAL: ADD SINGLE STUDENT ID */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#172554]" />
                <span>{language === 'bn' ? 'একক স্টুডেন্ট আইডি যোগ করুন' : 'Add Single Student ID'}</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddSingleId} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Student ID * <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  value={newId}
                  onChange={(e) => setNewId(e.target.value.toUpperCase())}
                  placeholder="e.g. PLSC-2026-120"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-sm uppercase focus:outline-none focus:ring-2 focus:ring-[#172554]"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Student Full Name (Optional)
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Anisul Haque"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#172554]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Class *</label>
                  <select
                    value={newClass}
                    onChange={(e) => setNewClass(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none"
                  >
                    {classOptions.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Academic Year</label>
                  <input
                    type="text"
                    value={newYear}
                    onChange={(e) => setNewYear(e.target.value)}
                    placeholder="2026"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-semibold cursor-pointer"
                >
                  {language === 'bn' ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#172554] hover:bg-[#263B8C] text-white font-bold cursor-pointer"
                >
                  {language === 'bn' ? 'সংরক্ষণ করুন' : 'Save ID'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT RECORD */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-[#263B8C]" />
                <span>{language === 'bn' ? 'আইডি রেকর্ড সম্পাদন' : 'Edit Student ID Record'}</span>
              </h3>
              <button
                onClick={() => setEditingRecord(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateRecord} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Student ID (Immutable)</label>
                <input
                  type="text"
                  disabled
                  value={editingRecord.studentId}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-100 font-mono text-sm text-slate-500 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Student Full Name</label>
                <input
                  type="text"
                  value={editingRecord.studentName || ''}
                  onChange={(e) => setEditingRecord({ ...editingRecord, studentName: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#172554]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Class</label>
                  <select
                    value={editingRecord.className}
                    onChange={(e) => setEditingRecord({ ...editingRecord, className: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none"
                  >
                    {classOptions.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Academic Year</label>
                  <input
                    type="text"
                    value={editingRecord.academicYear}
                    onChange={(e) => setEditingRecord({ ...editingRecord, academicYear: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-semibold cursor-pointer"
                >
                  {language === 'bn' ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#172554] hover:bg-[#263B8C] text-white font-bold cursor-pointer"
                >
                  {language === 'bn' ? 'হালনাগাদ করুন' : 'Update Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CSV / EXCEL IMPORT */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white rounded-2xl shadow-xl max-w-xl w-full p-6 border border-slate-200">
            <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-[#172554]" />
                <span>{language === 'bn' ? 'সিএসভি বা এক্সেল আইডি আপলোড' : 'Upload Student IDs (CSV / Excel)'}</span>
              </h3>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportReport(null);
                  setCsvContent('');
                }}
                className="text-slate-400 hover:text-slate-600 cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <div className="font-bold text-slate-800">CSV Column Format:</div>
                <code className="text-[11px] text-[#172554] bg-white px-2 py-1 rounded border border-slate-200 block font-mono">
                  student_id, student_name, class, year
                </code>
                <div className="text-[11px] text-slate-500">
                  Example: <code>PLSC-2026-111, Nafis Hossain, Class 10, 2026</code>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {language === 'bn' ? 'সিএসভি ফাইল আপলোড করুন' : 'Choose CSV File'}
                </label>
                <input
                  type="file"
                  accept=".csv,text/csv,text/plain"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        setCsvContent(event.target?.result as string || '');
                      };
                      reader.readAsText(file);
                    }
                  }}
                  className="w-full p-2 border border-slate-300 rounded-xl bg-slate-50"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {language === 'bn' ? 'অথবা সরাসরি সিএসভি ডাটা পেস্ট করুন:' : 'Or Paste CSV Data Directly:'}
                </label>
                <textarea
                  value={csvContent}
                  onChange={(e) => setCsvContent(e.target.value)}
                  rows={5}
                  placeholder={`PLSC-2026-115, Salman Farsi, Class 9, 2026\nPLSC-2026-116, Nusrat Jahan, Class 11 (HSC), 2026`}
                  className="w-full p-3 font-mono text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#172554] bg-white"
                />
              </div>

              {importReport && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <div className="font-bold text-slate-900">Validation & Import Report:</div>
                  <div className="grid grid-cols-4 gap-2 text-center text-[11px] pt-1">
                    <div className="p-1.5 rounded bg-white border border-slate-200">
                      <div className="font-bold text-slate-800">{importReport.totalRows}</div>
                      <div className="text-slate-500">Total Rows</div>
                    </div>
                    <div className="p-1.5 rounded bg-emerald-50 border border-emerald-200">
                      <div className="font-bold text-emerald-800">{importReport.addedCount}</div>
                      <div className="text-emerald-700">Imported</div>
                    </div>
                    <div className="p-1.5 rounded bg-amber-50 border border-amber-200">
                      <div className="font-bold text-amber-800">{importReport.duplicateCount}</div>
                      <div className="text-amber-700">Duplicate</div>
                    </div>
                    <div className="p-1.5 rounded bg-rose-50 border border-rose-200">
                      <div className="font-bold text-rose-800">{importReport.invalidCount}</div>
                      <div className="text-rose-700">Invalid</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowImportModal(false);
                    setImportReport(null);
                    setCsvContent('');
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-semibold cursor-pointer"
                >
                  {language === 'bn' ? 'বন্ধ করুন' : 'Close'}
                </button>
                <button
                  type="button"
                  onClick={handleImportCSV}
                  disabled={!csvContent.trim()}
                  className="px-5 py-2 rounded-xl bg-[#172554] hover:bg-[#263B8C] text-white font-bold cursor-pointer disabled:opacity-50"
                >
                  {language === 'bn' ? 'ডাটাবেজে যুক্ত করুন' : 'Process & Import'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: MANDATORY AUDIT REASON BEFORE STATUS TOGGLE OR DELETE */}
      {auditModalAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border-2 border-amber-300">
            <div className="flex items-center gap-2 mb-3 text-amber-800">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <h3 className="font-black text-slate-900 text-base">
                {auditModalAction.type === 'DELETE'
                  ? language === 'bn'
                    ? 'আইডি মুছে ফেলার নিশ্চিতকরণ'
                    : 'Confirm Student ID Deletion'
                  : language === 'bn'
                  ? 'আইডি স্ট্যাটাস পরিবর্তনের নিশ্চিতকরণ'
                  : 'Confirm ID Status Change'}
              </h3>
            </div>

            <div className="text-xs text-slate-600 space-y-2 mb-4">
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <div><strong>Student ID:</strong> {auditModalAction.record.studentId}</div>
                <div><strong>Student:</strong> {auditModalAction.record.studentName || 'N/A'} ({auditModalAction.record.className})</div>
                <div><strong>Current Status:</strong> {auditModalAction.record.status} ({auditModalAction.record.verificationStatus})</div>
              </div>
              <p className="font-semibold text-rose-700">
                {language === 'bn'
                  ? 'নিরাপত্তা অডিট লগিংয়ের জন্য অনুগ্রহ করে পরিবর্তনের কারণ উল্লেখ করুন:'
                  : 'A mandatory audit reason is required before modifying or deleting institutional student records:'}
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {language === 'bn' ? 'অডিট কারণ (বাধ্যতামূলক) *' : 'Audit Reason (Mandatory) *'}
                </label>
                <textarea
                  value={auditReason}
                  onChange={(e) => setAuditReason(e.target.value)}
                  rows={3}
                  placeholder={
                    language === 'bn'
                      ? 'উদা: ভুলবশত এন্ট্রি করা হয়েছিল / শিক্ষার্থীর অনুরোধক্রমে...'
                      : 'e.g. Student transferred, entered by clerical mistake, duplicate record...'
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#172554] bg-white text-slate-900"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setAuditModalAction(null);
                    setAuditReason('');
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-semibold cursor-pointer"
                >
                  {language === 'bn' ? 'বাতিল' : 'Cancel'}
                </button>

                <button
                  type="button"
                  onClick={handleConfirmAuditAction}
                  disabled={!auditReason.trim()}
                  className={`px-5 py-2 rounded-xl font-bold text-white cursor-pointer ${
                    auditModalAction.type === 'DELETE'
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-[#172554] hover:bg-[#263B8C]'
                  } disabled:opacity-50`}
                >
                  {auditModalAction.type === 'DELETE'
                    ? language === 'bn'
                      ? 'মুছে ফেলুন'
                      : 'Delete Record'
                    : language === 'bn'
                    ? 'পরিবর্তন নিশ্চিত করুন'
                    : 'Confirm Status Change'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
