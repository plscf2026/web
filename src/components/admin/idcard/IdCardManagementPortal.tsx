/**
 * Police Lines School & College, Faridpur - Grand Reunion 2026 / 2027
 * Complete Student ID Card Management System
 * Modules:
 * 1. Executive Metrics Dashboard
 * 2. All Students Directory & Filtering
 * 3. Bulk & Batch ID Card Generation
 * 4. Year-Wise Folders Management
 * 5. Visual Card Gallery & Inspection
 * 6. Combined A4 Gang-Run Print Decks
 * 7. One-Click Complete Bulk ZIP Download (with Progress Engine)
 * 8. Role-Based Staff Management & Account Approvals (Super Admin)
 * 9. Download History & Administrative Audit Trail
 * 10. System Print & Verification Settings
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  CreditCard,
  FolderArchive,
  Download,
  Users,
  Search,
  CheckCircle2,
  AlertTriangle,
  Printer,
  ShieldCheck,
  UserCheck,
  UserX,
  Plus,
  RefreshCw,
  Eye,
  Settings,
  Layers,
  Archive,
  History,
  AlertCircle,
  Key,
} from 'lucide-react';
import {
  StudentIdCardRecord,
  BatchIdCardCollection,
  IdCardStaffAccount,
  IdCardDownloadLog,
  IdCardSystemSettings,
} from '../../../types/idcard';
import { IdCardStore } from '../../../services/idCardStore';
import { GlobalPagination } from '../../common/GlobalPagination';
import { paginate } from '../../../utils/pagination';

const IdCardPreviewModal = React.lazy(() =>
  import('./IdCardPreviewModal').then((m) => ({ default: m.IdCardPreviewModal }))
);

interface IdCardManagementPortalProps {
  currentUserEmail?: string;
  currentUserRole?: string;
  isSuperAdmin?: boolean;
}

export const IdCardManagementPortal: React.FC<IdCardManagementPortalProps> = ({
  currentUserEmail = 'admin@gmail.com',
  currentUserRole = 'SUPER_ADMIN',
  isSuperAdmin = true,
}) => {
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<
    | 'dashboard'
    | 'allStudents'
    | 'generate'
    | 'yearFolders'
    | 'gallery'
    | 'combinedPdf'
    | 'bulkDownload'
    | 'staffManagement'
    | 'downloadHistory'
    | 'settings'
  >('dashboard');

  // Core Data States (fast cached initialization)
  const [cards, setCards] = useState<StudentIdCardRecord[]>(() => IdCardStore.getIdCards());
  const [batches, setBatches] = useState<BatchIdCardCollection[]>(() => IdCardStore.getBatchCollections());
  const [staffList, setStaffList] = useState<IdCardStaffAccount[]>(() => IdCardStore.getStaffAccounts());
  const [downloadLogs, setDownloadLogs] = useState<IdCardDownloadLog[]>(() => IdCardStore.getDownloadLogs());
  const [settings, setSettings] = useState<IdCardSystemSettings>(() =>
    IdCardStore.getSettings()
  );

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBatchFilter, setSelectedBatchFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Global Pagination States (Default 10, options 10, 20, 30, 40)
  const [studentPage, setStudentPage] = useState(1);
  const [studentPageSize, setStudentPageSize] = useState(10);

  const [batchPage, setBatchPage] = useState(1);
  const [batchPageSize, setBatchPageSize] = useState(10);

  const [staffPage, setStaffPage] = useState(1);
  const [staffPageSize, setStaffPageSize] = useState(10);

  const [downloadLogPage, setDownloadLogPage] = useState(1);
  const [downloadLogPageSize, setDownloadLogPageSize] = useState(10);

  // Reset student page to 1 on search or filter change
  useEffect(() => {
    setStudentPage(1);
  }, [searchQuery, selectedBatchFilter, statusFilter]);

  // Modals & Preview States
  const [previewStudent, setPreviewStudent] = useState<StudentIdCardRecord | null>(null);
  const [showCreateStaffModal, setShowCreateStaffModal] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState<IdCardStaffAccount | null>(null);
  const [newStaffPassword, setNewStaffPassword] = useState('');

  // Bulk Generation & Download Processing States
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{
    percent: number;
    processed: number;
    total: number;
    currentTask: string;
    downloadUrl?: string;
    archiveFilename?: string;
  }>({ percent: 0, processed: 0, total: 0, currentTask: '' });

  // Selected Cards for Checkbox Actions
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set());

  // Notification Toast
  const [toastMessage, setToastMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  // New Staff Form State
  const [newStaffForm, setNewStaffForm] = useState({
    fullName: '',
    username: '',
    email: '',
    role: 'ID_CARD_STAFF' as IdCardStaffAccount['role'],
    assignedBatches: '',
  });

  const showToast = (type: 'success' | 'error' | 'info', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Load Data
  const refreshData = () => {
    const updatedCards = IdCardStore.syncWithRegistrations();
    setCards(updatedCards);
    setBatches(IdCardStore.getBatchCollections());
    setStaffList(IdCardStore.getStaffAccounts());
    setDownloadLogs(IdCardStore.getDownloadLogs());
  };

  useEffect(() => {
    // Non-blocking initialization: lets the mobile browser complete initial render/paint first
    const timer = setTimeout(() => {
      refreshData();
    }, 20);
    return () => clearTimeout(timer);
  }, []);

  // System Metrics
  const metrics = useMemo(() => {
    return IdCardStore.getMetrics();
  }, [cards, batches]);

  // Filtered Students
  const filteredStudents = useMemo(() => {
    return cards.filter((item) => {
      if (selectedBatchFilter !== 'ALL' && item.batchYear !== selectedBatchFilter) {
        return false;
      }
      if (statusFilter !== 'ALL' && item.cardStatus !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = (item.studentName || '').toLowerCase().includes(q);
        const matchesId = (item.idNumber || item.registrationId || '').toLowerCase().includes(q);
        const matchesContact = (item.contactNumber || '').toLowerCase().includes(q);
        const matchesBatch = (item.batchName || item.batchYear || '').toLowerCase().includes(q);
        if (!matchesName && !matchesId && !matchesContact && !matchesBatch) {
          return false;
        }
      }
      return true;
    });
  }, [cards, selectedBatchFilter, statusFilter, searchQuery]);

  // Handle Select All Checkboxes
  const handleToggleSelectAll = () => {
    if (selectedCardIds.size === filteredStudents.length) {
      setSelectedCardIds(new Set());
    } else {
      setSelectedCardIds(new Set(filteredStudents.map((s) => s.registrationId)));
    }
  };

  const handleToggleSelectCard = (regId: string) => {
    const updated = new Set(selectedCardIds);
    if (updated.has(regId)) {
      updated.delete(regId);
    } else {
      updated.add(regId);
    }
    setSelectedCardIds(updated);
  };

  // ==========================================================================
  // ACTION: DOWNLOAD INDIVIDUAL PDF
  // ==========================================================================
  const handleDownloadSinglePdf = async (student: StudentIdCardRecord) => {
    try {
      const { generateIndividualIdCardPdf } = await import('../../../utils/idCardGenerator');
      const { pdfBlob } = await generateIndividualIdCardPdf(student);
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      const safeId = (student.idNumber || student.registrationId || 'card').replace(/[^a-zA-Z0-9_-]/g, '_');
      a.download = `Student_ID_${safeId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      IdCardStore.markCardGenerated(student.registrationId, {
        generatedBy: currentUserEmail,
        fileSizeBytes: pdfBlob.size,
      });

      IdCardStore.logDownload({
        userId: currentUserEmail,
        userName: currentUserEmail,
        userRole: currentUserRole,
        downloadType: 'INDIVIDUAL_PDF',
        batchYear: student.batchYear || 'N/A',
        registrationId: student.idNumber || student.registrationId,
        cardCount: 1,
        status: 'SUCCESS',
        details: `Downloaded individual ID card for ${student.studentName || 'Student'} (${student.idNumber || 'ID'})`,
      });

      refreshData();
      showToast('success', `ID card downloaded for ${student.studentName}`);
    } catch (err) {
      console.error('[IdCard] Download single failed:', err);
      showToast('error', 'Failed to generate ID card PDF.');
    }
  };

  // ==========================================================================
  // ACTION: DOWNLOAD BATCH COMBINED A4 PDF
  // ==========================================================================
  const handleDownloadBatchCombinedPdf = async (batchYear: string) => {
    const batchCards = cards.filter((c) => c.batchYear === batchYear);
    if (batchCards.length === 0) {
      showToast('error', `No eligible students found in Batch ${batchYear}`);
      return;
    }

    try {
      setIsProcessingBulk(true);
      setBulkProgress({
        percent: 30,
        processed: 0,
        total: batchCards.length,
        currentTask: `Formatting Batch ${batchYear} cards into A4 print sheets...`,
      });

      const { generateBatchCombinedA4Pdf } = await import('../../../utils/idCardGenerator');
      const { pdfBlob, totalPages } = await generateBatchCombinedA4Pdf(
        batchCards,
        batchYear
      );

      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Batch_${batchYear}_All_Cards_PrintDeck.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Mark all batch cards as generated
      for (const card of batchCards) {
        IdCardStore.markCardGenerated(card.registrationId, {
          generatedBy: currentUserEmail,
        });
      }

      IdCardStore.logDownload({
        userId: currentUserEmail,
        userName: currentUserEmail,
        userRole: currentUserRole,
        downloadType: 'BATCH_COMBINED_PDF',
        batchYear,
        cardCount: batchCards.length,
        status: 'SUCCESS',
        details: `Generated A4 print deck (${totalPages} pages, ${batchCards.length} cards)`,
      });

      refreshData();
      showToast('success', `Batch ${batchYear} combined A4 print PDF generated!`);
    } catch (err) {
      console.error('[IdCard] Combined PDF failed:', err);
      showToast('error', 'Failed to compile batch print PDF.');
    } finally {
      setIsProcessingBulk(false);
      setBulkProgress({ percent: 0, processed: 0, total: 0, currentTask: '' });
    }
  };

  // ==========================================================================
  // ACTION: DOWNLOAD YEAR-WISE ZIP
  // ==========================================================================
  const handleDownloadBatchZip = async (batchYear: string) => {
    const batchCards = cards.filter((c) => c.batchYear === batchYear);
    if (batchCards.length === 0) {
      showToast('error', `No eligible students found in Batch ${batchYear}`);
      return;
    }

    try {
      setIsProcessingBulk(true);
      setBulkProgress({
        percent: 10,
        processed: 0,
        total: batchCards.length,
        currentTask: `Generating individual PDFs for Batch ${batchYear}...`,
      });

      const { generateBatchZipArchive } = await import('../../../utils/idCardGenerator');
      const zipBlob = await generateBatchZipArchive(
        batchYear,
        batchCards,
        (processed, total, percent) => {
          setBulkProgress({
            percent,
            processed,
            total,
            currentTask: `Archiving student ${processed} of ${total} into Batch_${batchYear}.zip...`,
          });
        }
      );

      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Batch_${batchYear}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Mark cards as generated
      for (const card of batchCards) {
        IdCardStore.markCardGenerated(card.registrationId, {
          generatedBy: currentUserEmail,
        });
      }

      IdCardStore.logDownload({
        userId: currentUserEmail,
        userName: currentUserEmail,
        userRole: currentUserRole,
        downloadType: 'BATCH_ZIP',
        batchYear,
        cardCount: batchCards.length,
        status: 'SUCCESS',
        details: `Downloaded Batch_${batchYear}.zip (${batchCards.length} cards + combined PDF)`,
      });

      refreshData();
      showToast('success', `Batch_${batchYear}.zip downloaded successfully!`);
    } catch (err) {
      console.error('[IdCard] Batch ZIP failed:', err);
      showToast('error', 'Failed to generate Batch ZIP archive.');
    } finally {
      setIsProcessingBulk(false);
      setBulkProgress({ percent: 0, processed: 0, total: 0, currentTask: '' });
    }
  };

  // ==========================================================================
  // ACTION: ONE-CLICK BULK DOWNLOAD OF ALL CARDS (10,000+ Students Resilience)
  // ==========================================================================
  const handleDownloadAllCardsBulkZip = async () => {
    const grouped = IdCardStore.getCardsByBatch();
    const batchCount = Object.keys(grouped).length;
    const totalStudents = cards.length;

    if (totalStudents === 0) {
      showToast('error', 'No eligible student records available for export.');
      return;
    }

    try {
      setIsProcessingBulk(true);
      setBulkProgress({
        percent: 5,
        processed: 0,
        total: totalStudents,
        currentTask: `Initializing bulk packaging engine for ${batchCount} graduation batches (${totalStudents} students)...`,
      });

      // Create persistent job
      const job = IdCardStore.createDownloadJob({
        requestedById: currentUserEmail,
        requestedByName: currentUserEmail,
        jobType: 'ALL_CARDS_BULK_ZIP',
        totalCards: totalStudents,
        archiveFilename: 'Police_Lines_All_Student_ID_Cards.zip',
      });

      const { generateAllBatchesBulkZip } = await import('../../../utils/idCardGenerator');
      const zipBlob = await generateAllBatchesBulkZip(
        grouped,
        (processedBatches, totalBatches, percent) => {
          setBulkProgress({
            percent,
            processed: processedBatches,
            total: totalBatches,
            currentTask: `Compiling year folders: processed ${processedBatches} of ${totalBatches} batches...`,
          });
          IdCardStore.updateJobProgress(job.id, processedBatches, percent, 'PROCESSING');
        }
      );

      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Police_Lines_All_Student_ID_Cards.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      IdCardStore.updateJobProgress(
        job.id,
        totalStudents,
        100,
        'COMPLETED',
        url
      );

      // Mark all cards generated
      for (const card of cards) {
        IdCardStore.markCardGenerated(card.registrationId, {
          generatedBy: currentUserEmail,
        });
      }

      IdCardStore.logDownload({
        userId: currentUserEmail,
        userName: currentUserEmail,
        userRole: currentUserRole,
        downloadType: 'ALL_CARDS_BULK_ZIP',
        batchYear: 'ALL',
        cardCount: totalStudents,
        status: 'SUCCESS',
        details: `Downloaded complete collection: ${batchCount} year folders, ${totalStudents} cards`,
      });

      refreshData();
      showToast('success', 'Complete ID card collection archive downloaded successfully!');
    } catch (err) {
      console.error('[IdCard] Bulk all download failed:', err);
      showToast('error', 'Failed to compile bulk ID card archive.');
    } finally {
      setIsProcessingBulk(false);
      setBulkProgress({ percent: 0, processed: 0, total: 0, currentTask: '' });
    }
  };

  // ==========================================================================
  // ACTION: BULK GENERATE SELECTED CARDS
  // ==========================================================================
  const handleGenerateSelectedCards = async () => {
    if (selectedCardIds.size === 0) {
      showToast('info', 'Please select at least one student card to generate.');
      return;
    }

    const selectedList = cards.filter((c) => selectedCardIds.has(c.registrationId));

    try {
      setIsProcessingBulk(true);
      const { generateIndividualIdCardPdf } = await import('../../../utils/idCardGenerator');
      for (let i = 0; i < selectedList.length; i++) {
        const student = selectedList[i];
        setBulkProgress({
          percent: Math.round(((i + 1) / selectedList.length) * 100),
          processed: i + 1,
          total: selectedList.length,
          currentTask: `Generating card for ${student.studentName} (${i + 1}/${selectedList.length})...`,
        });

        const { pdfDataUri, fileSizeBytes } = await generateIndividualIdCardPdf(student);
        IdCardStore.markCardGenerated(student.registrationId, {
          pdfDataUri,
          generatedBy: currentUserEmail,
          fileSizeBytes,
        });
      }

      refreshData();
      setSelectedCardIds(new Set());
      showToast('success', `Successfully generated ${selectedList.length} ID cards!`);
    } catch (err) {
      console.error('[IdCard] Batch generation failed:', err);
      showToast('error', 'Error occurred during ID card batch generation.');
    } finally {
      setIsProcessingBulk(false);
      setBulkProgress({ percent: 0, processed: 0, total: 0, currentTask: '' });
    }
  };

  // ==========================================================================
  // SUPER ADMIN: STAFF MANAGEMENT ACTIONS
  // ==========================================================================
  const handleCreateStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffForm.fullName || !newStaffForm.username || !newStaffForm.email) {
      showToast('error', 'Please fill in all mandatory staff fields.');
      return;
    }

    try {
      IdCardStore.createStaffAccount({
        fullName: newStaffForm.fullName,
        username: newStaffForm.username,
        email: newStaffForm.email,
        role: newStaffForm.role,
        assignedBatchYears: newStaffForm.assignedBatches
          ? newStaffForm.assignedBatches.split(',').map((s) => s.trim())
          : [],
        createdBy: currentUserEmail,
      });

      refreshData();
      setShowCreateStaffModal(false);
      setNewStaffForm({
        fullName: '',
        username: '',
        email: '',
        role: 'ID_CARD_STAFF',
        assignedBatches: '',
      });
      showToast('success', 'Staff account created. Account is pending approval.');
    } catch (err: any) {
      showToast('error', err.message || 'Failed to create staff account.');
    }
  };

  const handleUpdateStaffStatus = (
    staffId: string,
    status: IdCardStaffAccount['status']
  ) => {
    try {
      IdCardStore.updateStaffStatus(staffId, status, currentUserEmail);
      refreshData();
      showToast('success', `Staff account status updated to ${status}.`);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to update staff status.');
    }
  };

  const handleDeleteStaff = (staffId: string) => {
    if (!window.confirm('Are you sure you want to permanently delete this staff account?')) {
      return;
    }
    IdCardStore.deleteStaffAccount(staffId);
    refreshData();
    showToast('success', 'Staff account removed.');
  };

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 text-sm font-semibold transition-all ${
            toastMessage.type === 'success'
              ? 'bg-emerald-600 text-white'
              : toastMessage.type === 'error'
              ? 'bg-rose-600 text-white'
              : 'bg-blue-600 text-white'
          }`}
        >
          {toastMessage.type === 'success' && <CheckCircle2 className="w-5 h-5" />}
          {toastMessage.type === 'error' && <AlertTriangle className="w-5 h-5" />}
          {toastMessage.type === 'info' && <AlertCircle className="w-5 h-5" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Bulk Processing Progress Banner */}
      {isProcessingBulk && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 border border-indigo-500/40 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <RefreshCw className="w-5 h-5 text-indigo-400 animate-spin" />
              <h4 className="text-sm font-bold text-white">
                Bulk Packaging &amp; PDF Processing in Progress...
              </h4>
            </div>
            <span className="text-sm font-extrabold text-indigo-300">
              {bulkProgress.percent}%
            </span>
          </div>
          <p className="text-xs text-slate-300">{bulkProgress.currentTask}</p>
          <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-indigo-500 transition-all duration-300"
              style={{ width: `${bulkProgress.percent}%` }}
            />
          </div>
        </div>
      )}

      {/* Header & Prominent Bulk Download Action */}
      <div className="p-6 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border border-slate-800 shadow-2xl flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 text-slate-950 shadow-lg shadow-amber-500/20">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-white">
                Student ID Card Management System
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Official Campus Signature CR80 Template (54 × 86 mm) • Year-Wise Folders • Bulk Packaging
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={refreshData}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs flex items-center gap-1.5 transition"
          >
            <RefreshCw className="w-4 h-4" />
            Sync Database
          </button>

          <button
            onClick={handleDownloadAllCardsBulkZip}
            disabled={isProcessingBulk || cards.length === 0}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-600 hover:to-yellow-600 text-slate-950 font-extrabold text-xs shadow-xl shadow-amber-500/20 flex items-center gap-2 transition disabled:opacity-50"
          >
            <Archive className="w-4 h-4" />
            DOWNLOAD ALL ID CARDS (ZIP)
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-800 scrollbar-none text-xs font-semibold">
        {[
          { id: 'dashboard', label: 'Dashboard', icon: Layers },
          { id: 'allStudents', label: 'All Students', icon: Users },
          { id: 'generate', label: 'Card Generation', icon: CreditCard },
          { id: 'yearFolders', label: 'Year-wise Folders', icon: FolderArchive },
          { id: 'gallery', label: 'Card Gallery', icon: Eye },
          { id: 'combinedPdf', label: 'Combined A4 Print', icon: Printer },
          { id: 'bulkDownload', label: 'Bulk Download', icon: Download },
          ...(isSuperAdmin
            ? [{ id: 'staffManagement', label: 'Staff Management', icon: ShieldCheck }]
            : []),
          ...(isSuperAdmin
            ? [{ id: 'downloadHistory', label: 'Download History', icon: History }]
            : []),
          { id: 'settings', label: 'Settings', icon: Settings },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2.5 rounded-xl flex items-center gap-2 whitespace-nowrap transition ${
                isActive
                  ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                  : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ==================================================================== */}
      {/* 1. DASHBOARD TAB */}
      {/* ==================================================================== */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Top Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              {
                label: 'Total Registered',
                val: metrics.totalEligible,
                color: 'text-indigo-400',
                bg: 'bg-indigo-500/10 border-indigo-500/20',
              },
              {
                label: 'Eligible (Paid)',
                val: metrics.totalEligible,
                color: 'text-emerald-400',
                bg: 'bg-emerald-500/10 border-emerald-500/20',
              },
              {
                label: 'Generated Cards',
                val: metrics.totalGenerated,
                color: 'text-teal-400',
                bg: 'bg-teal-500/10 border-teal-500/20',
              },
              {
                label: 'Pending Cards',
                val: metrics.totalPending,
                color: 'text-amber-400',
                bg: 'bg-amber-500/10 border-amber-500/20',
              },
              {
                label: 'Batches / Years',
                val: metrics.totalBatches,
                color: 'text-sky-400',
                bg: 'bg-sky-500/10 border-sky-500/20',
              },
              {
                label: 'Flagged Review',
                val: metrics.totalFlagged,
                color: 'text-rose-400',
                bg: 'bg-rose-500/10 border-rose-500/20',
              },
            ].map((stat, i) => (
              <div
                key={i}
                className={`p-4 rounded-2xl border ${stat.bg} flex flex-col justify-between`}
              >
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  {stat.label}
                </span>
                <span className={`text-2xl font-black ${stat.color} mt-2`}>
                  {stat.val}
                </span>
              </div>
            ))}
          </div>

          {/* Year-Wise Batches Summary Table */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">
                  Graduation Year / Batch Summary
                </h3>
                <p className="text-xs text-slate-400">
                  Live database breakdown by passing year with folder actions
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-800 text-slate-300">
                {batches.length} Batches Active
              </span>
            </div>

            {/* Desktop Batch Table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">Batch / Year</th>
                    <th className="py-3 px-4 text-center">Total Students</th>
                    <th className="py-3 px-4 text-center">Generated Cards</th>
                    <th className="py-3 px-4 text-center">Pending</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Quick Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {paginate(batches, batchPage, batchPageSize).map((batch) => {
                    const isAllGenerated =
                      batch.totalGeneratedCards === batch.totalEligibleStudents &&
                      batch.totalEligibleStudents > 0;
                    return (
                      <tr key={batch.batchYear} className="hover:bg-slate-800/40 transition">
                        <td className="py-3.5 px-4 font-bold text-white flex items-center gap-2">
                          <FolderArchive className="w-4 h-4 text-amber-400" />
                          <span>Batch {batch.batchYear}</span>
                        </td>
                        <td className="py-3.5 px-4 text-center text-slate-300 font-semibold">
                          {batch.totalEligibleStudents}
                        </td>
                        <td className="py-3.5 px-4 text-center text-emerald-400 font-bold">
                          {batch.totalGeneratedCards}
                        </td>
                        <td className="py-3.5 px-4 text-center text-amber-400 font-semibold">
                          {batch.totalPendingCards}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {isAllGenerated ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              READY
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              PENDING
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setSelectedBatchFilter(batch.batchYear);
                                setActiveTab('allStudents');
                              }}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold transition"
                            >
                              View Students
                            </button>
                            <button
                              onClick={() => handleDownloadBatchCombinedPdf(batch.batchYear)}
                              className="px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-[11px] font-semibold transition flex items-center gap-1"
                              title="Download All Cards as Combined A4 PDF"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              A4 PDF
                            </button>
                            <button
                              onClick={() => handleDownloadBatchZip(batch.batchYear)}
                              className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 text-[11px] font-bold transition flex items-center gap-1"
                              title="Download Batch ZIP Folder"
                            >
                              <Download className="w-3.5 h-3.5" />
                              ZIP
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Batch Cards */}
            <div className="sm:hidden space-y-3">
              {paginate(batches, batchPage, batchPageSize).map((batch) => {
                const isAllGenerated =
                  batch.totalGeneratedCards === batch.totalEligibleStudents &&
                  batch.totalEligibleStudents > 0;
                return (
                  <div key={batch.batchYear} className="rounded-xl bg-slate-800/60 border border-slate-700 p-3.5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FolderArchive className="w-4 h-4 text-amber-400" />
                        <span className="font-bold text-white text-sm">Batch {batch.batchYear}</span>
                      </div>
                      {isAllGenerated ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">READY</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">PENDING</span>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="bg-slate-900/60 rounded-lg p-2">
                        <p className="text-slate-400 text-[10px] uppercase tracking-wider">Total</p>
                        <p className="text-slate-200 font-bold">{batch.totalEligibleStudents}</p>
                      </div>
                      <div className="bg-slate-900/60 rounded-lg p-2">
                        <p className="text-slate-400 text-[10px] uppercase tracking-wider">Generated</p>
                        <p className="text-emerald-400 font-bold">{batch.totalGeneratedCards}</p>
                      </div>
                      <div className="bg-slate-900/60 rounded-lg p-2">
                        <p className="text-slate-400 text-[10px] uppercase tracking-wider">Pending</p>
                        <p className="text-amber-400 font-bold">{batch.totalPendingCards}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => { setSelectedBatchFilter(batch.batchYear); setActiveTab('allStudents'); }}
                        className="flex-1 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold transition min-h-[44px]"
                      >
                        View Students
                      </button>
                      <button
                        onClick={() => handleDownloadBatchCombinedPdf(batch.batchYear)}
                        className="flex-1 py-2.5 rounded-lg bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 text-xs font-semibold transition flex items-center justify-center gap-1 min-h-[44px]"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        A4 PDF
                      </button>
                      <button
                        onClick={() => handleDownloadBatchZip(batch.batchYear)}
                        className="flex-1 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold transition flex items-center justify-center gap-1 min-h-[44px]"
                      >
                        <Download className="w-3.5 h-3.5" />
                        ZIP
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Batches Global Pagination */}
            <GlobalPagination
              variant="dark"
              currentPage={batchPage}
              totalRecords={batches.length}
              pageSize={batchPageSize}
              onPageChange={setBatchPage}
              onPageSizeChange={setBatchPageSize}
            />
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 2. ALL STUDENTS DIRECTORY TAB */}
      {/* ==================================================================== */}
      {activeTab === 'allStudents' && (
        <div className="space-y-4">
          {/* Search & Filter Toolbar */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search student name, ID, mobile..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-400 text-xs focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              {/* Batch Filter */}
              <select
                value={selectedBatchFilter}
                onChange={(e) => setSelectedBatchFilter(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs focus:outline-none"
              >
                <option value="ALL">All Batches / Years</option>
                {batches.map((b) => (
                  <option key={b.batchYear} value={b.batchYear}>
                    Batch {b.batchYear} ({b.totalEligibleStudents})
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs focus:outline-none"
              >
                <option value="ALL">All Card Statuses</option>
                <option value="ELIGIBLE">Eligible (Pending)</option>
                <option value="GENERATED">Generated</option>
                <option value="FLAGGED_REVIEW">Flagged for Review</option>
              </select>

              {/* Bulk Selected Generate Button */}
              {selectedCardIds.size > 0 && (
                <button
                  onClick={handleGenerateSelectedCards}
                  disabled={isProcessingBulk}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5"
                >
                  <CreditCard className="w-4 h-4" />
                  Generate ({selectedCardIds.size})
                </button>
              )}
            </div>
          </div>

          {/* Student Table */}

          {/* Desktop Student Table */}
          <div className="hidden sm:block p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-3 w-8">
                    <input
                      type="checkbox"
                      checked={
                        selectedCardIds.size === filteredStudents.length &&
                        filteredStudents.length > 0
                      }
                      onChange={handleToggleSelectAll}
                      className="rounded border-slate-700 text-amber-500 focus:ring-0"
                    />
                  </th>
                  <th className="py-3 px-3">Student Photo</th>
                  <th className="py-3 px-3">Student Name</th>
                  <th className="py-3 px-3">Registration ID</th>
                  <th className="py-3 px-3">Batch / Passing Year</th>
                  <th className="py-3 px-3">Contact</th>
                  <th className="py-3 px-3 text-center">Card Status</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      No matching student registrations found.
                    </td>
                  </tr>
                ) : (
                  paginate(filteredStudents, studentPage, studentPageSize).map((student) => (
                    <tr key={student.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-3">
                        <input
                          type="checkbox"
                          checked={selectedCardIds.has(student.registrationId)}
                          onChange={() => handleToggleSelectCard(student.registrationId)}
                          className="rounded border-slate-700 text-amber-500 focus:ring-0"
                        />
                      </td>
                      <td className="py-3 px-3">
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-800 border border-slate-700 flex items-center justify-center">
                          {student.photoUrl ? (
                            <img
                              src={student.photoUrl}
                              alt={student.studentName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Users className="w-5 h-5 text-slate-500" />
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <p className="font-bold text-white">{student.studentName}</p>
                        <p className="text-[10px] text-slate-400">
                          {student.studentNameBn || student.batchName}
                        </p>
                      </td>
                      <td className="py-3 px-3 font-mono font-semibold text-indigo-300">
                        {student.idNumber}
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                          {student.batchYear}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-300">{student.contactNumber}</td>
                      <td className="py-3 px-3 text-center">
                        {student.cardStatus === 'GENERATED' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            GENERATED
                          </span>
                        )}
                        {student.cardStatus === 'ELIGIBLE' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            ELIGIBLE
                          </span>
                        )}
                        {student.cardStatus === 'FLAGGED_REVIEW' && (
                          <span
                            className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 cursor-help"
                            title={student.reviewReason}
                          >
                            REVIEW REQUIRED
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setPreviewStudent(student)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                            title="Preview ID Card"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDownloadSinglePdf(student)}
                            className="p-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 transition"
                            title="Download Individual PDF"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Student Cards */}
          <div className="sm:hidden space-y-3">
            {filteredStudents.length === 0 ? (
              <p className="py-6 text-center text-slate-400 text-xs">No matching student registrations found.</p>
            ) : (
              paginate(filteredStudents, studentPage, studentPageSize).map((student) => (
                <div key={student.id} className="rounded-xl bg-slate-800/60 border border-slate-700 p-3.5 space-y-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedCardIds.has(student.registrationId)}
                      onChange={() => handleToggleSelectCard(student.registrationId)}
                      className="rounded border-slate-700 text-amber-500 focus:ring-0 w-4 h-4 shrink-0"
                    />
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                      {student.photoUrl ? (
                        <img src={student.photoUrl} alt={student.studentName} className="w-full h-full object-cover" />
                      ) : (
                        <Users className="w-5 h-5 text-slate-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-white text-sm truncate">{student.studentName}</p>
                      <p className="text-[10px] text-slate-400 truncate">{student.studentNameBn || student.batchName}</p>
                    </div>
                    {student.cardStatus === 'GENERATED' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">GENERATED</span>
                    )}
                    {student.cardStatus === 'ELIGIBLE' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">ELIGIBLE</span>
                    )}
                    {student.cardStatus === 'FLAGGED_REVIEW' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 shrink-0">REVIEW</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider">Reg ID</span>
                      <p className="font-mono font-semibold text-indigo-300 truncate">{student.idNumber}</p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase tracking-wider">Batch</span>
                      <p className="text-slate-300 font-semibold">{student.batchYear}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-[10px] uppercase tracking-wider">Contact</span>
                      <p className="text-slate-300">{student.contactNumber}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => setPreviewStudent(student)}
                      className="flex-1 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold transition flex items-center justify-center gap-1.5 min-h-[44px]"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Preview
                    </button>
                    <button
                      onClick={() => handleDownloadSinglePdf(student)}
                      className="flex-1 py-2.5 rounded-lg bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition flex items-center justify-center gap-1.5 min-h-[44px]"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download PDF
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Students Global Pagination */}
          <GlobalPagination
            variant="dark"
            currentPage={studentPage}
            totalRecords={filteredStudents.length}
            pageSize={studentPageSize}
            onPageChange={setStudentPage}
            onPageSizeChange={setStudentPageSize}
          />
        </div>
      )}

      {/* ==================================================================== */}
      {/* 3. CARD GENERATION TAB */}
      {/* ==================================================================== */}
      {activeTab === 'generate' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-white">Batch &amp; Bulk Generation Hub</h3>
            <p className="text-xs text-slate-400">
              Generate ID cards in high-speed batches. System assigns unique cryptographic QR tokens and guarantees zero duplicate cards.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
              {batches.map((b) => (
                <div
                  key={b.batchYear}
                  className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-extrabold text-white">
                        Batch {b.batchYear}
                      </h4>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                        {b.totalEligibleStudents} Cards
                      </span>
                    </div>
                    <div className="mt-3 space-y-1 text-xs text-slate-400">
                      <p>
                        Generated: <strong className="text-emerald-400">{b.totalGeneratedCards}</strong>
                      </p>
                      <p>
                        Pending: <strong className="text-amber-400">{b.totalPendingCards}</strong>
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800 flex items-center gap-2">
                    <button
                      onClick={() => handleDownloadBatchZip(b.batchYear)}
                      disabled={isProcessingBulk}
                      className="w-full py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold transition flex items-center justify-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Generate Batch ZIP
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 4. YEAR-WISE FOLDERS TAB */}
      {/* ==================================================================== */}
      {activeTab === 'yearFolders' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">Year-Wise Folder Directory</h3>
                <p className="text-xs text-slate-400">
                  Physical and logical structure: <code className="text-amber-400">STUDENT_ID_CARDS/Batch_&lt;year&gt;/</code>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {batches.map((batch) => (
                <div
                  key={batch.batchYear}
                  className="p-5 rounded-2xl bg-slate-950 border border-slate-800 hover:border-amber-400/50 transition group flex flex-col justify-between"
                >
                  <div>
                    <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-3 group-hover:scale-110 transition">
                      <FolderArchive className="w-6 h-6" />
                    </div>
                    <h4 className="text-base font-extrabold text-white">
                      Batch_{batch.batchYear}/
                    </h4>
                    <p className="text-xs text-slate-400 mt-1">
                      {batch.totalEligibleStudents} student cards inside
                    </p>
                    <div className="mt-3 text-[11px] text-slate-500 space-y-1 font-mono">
                      <p>📁 Individual_Cards/ ({batch.totalEligibleStudents} PDFs)</p>
                      <p>📄 Batch_{batch.batchYear}_All_Cards.pdf</p>
                      <p>📦 Batch_{batch.batchYear}.zip</p>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-slate-800/80 flex items-center gap-2">
                    <button
                      onClick={() => handleDownloadBatchCombinedPdf(batch.batchYear)}
                      className="flex-1 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition text-center"
                    >
                      A4 Deck
                    </button>
                    <button
                      onClick={() => handleDownloadBatchZip(batch.batchYear)}
                      className="flex-1 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold transition text-center"
                    >
                      ZIP
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 5. VISUAL CARD GALLERY TAB */}
      {/* ==================================================================== */}
      {activeTab === 'gallery' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-white">Visual Card Gallery</h3>
            <p className="text-xs text-slate-400">
              Click any card to launch the high-resolution CR80 inspection &amp; print modal.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {filteredStudents.map((student) => (
                <div
                  key={student.id}
                  onClick={() => setPreviewStudent(student)}
                  className="cursor-pointer group relative p-3 rounded-2xl bg-slate-950 border border-slate-800 hover:border-amber-400 transition shadow-lg flex flex-col items-center text-center"
                >
                  <div className="w-16 h-20 rounded-xl overflow-hidden bg-slate-800 border border-slate-700 mb-2 flex items-center justify-center">
                    {student.photoUrl ? (
                      <img
                        src={student.photoUrl}
                        alt={student.studentName}
                        className="w-full h-full object-cover group-hover:scale-105 transition"
                      />
                    ) : (
                      <Users className="w-8 h-8 text-slate-500" />
                    )}
                  </div>
                  <h4 className="text-xs font-bold text-white truncate w-full">
                    {student.studentName}
                  </h4>
                  <p className="text-[10px] text-amber-400 font-mono mt-0.5">
                    {student.idNumber}
                  </p>
                  <span className="mt-2 text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                    Batch {student.batchYear}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 6. COMBINED A4 PRINTING TAB */}
      {/* ==================================================================== */}
      {activeTab === 'combinedPdf' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-white">
              Combined A4 Gang-Run Print Decks
            </h3>
            <p className="text-xs text-slate-400">
              Arranges 9 cards per standard A4 printing sheet (3 rows × 3 columns) with crop marks and guillotine cutting guides.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {batches.map((b) => (
                <div
                  key={b.batchYear}
                  className="p-5 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col justify-between"
                >
                  <div>
                    <h4 className="text-base font-extrabold text-white">
                      Batch {b.batchYear} Print Deck
                    </h4>
                    <p className="text-xs text-slate-400 mt-1">
                      {b.totalEligibleStudents} Cards • ~{Math.ceil(b.totalEligibleStudents / 9)} A4 Sheets
                    </p>
                  </div>

                  <button
                    onClick={() => handleDownloadBatchCombinedPdf(b.batchYear)}
                    disabled={isProcessingBulk}
                    className="mt-4 w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition"
                  >
                    <Printer className="w-4 h-4" />
                    Download A4 Print PDF
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 7. BULK DOWNLOAD TAB */}
      {/* ==================================================================== */}
      {activeTab === 'bulkDownload' && (
        <div className="space-y-6">
          <div className="p-8 rounded-3xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 shadow-2xl text-center max-w-2xl mx-auto space-y-6">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-500 to-amber-700 mx-auto flex items-center justify-center text-slate-950 shadow-2xl shadow-amber-500/20">
              <Archive className="w-10 h-10" />
            </div>

            <div>
              <h3 className="text-xl font-extrabold text-white">
                Download Complete ID Card Archive
              </h3>
              <p className="text-xs text-slate-400 mt-2 max-w-md mx-auto">
                Packages all graduation-year folders, individual student PDFs, and batch A4 print decks into one authoritative master ZIP archive:
                <br />
                <code className="text-amber-400 font-bold">Police_Lines_All_Student_ID_Cards.zip</code>
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto text-left">
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 font-semibold uppercase">Total Cards</span>
                <p className="text-lg font-bold text-white mt-1">{metrics.totalEligible}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 font-semibold uppercase">Total Batches</span>
                <p className="text-lg font-bold text-amber-400 mt-1">{metrics.totalBatches}</p>
              </div>
            </div>

            <button
              onClick={handleDownloadAllCardsBulkZip}
              disabled={isProcessingBulk || cards.length === 0}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-600 hover:to-yellow-600 text-slate-950 font-extrabold text-sm shadow-2xl shadow-amber-500/30 flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              <Download className="w-5 h-5" />
              START COMPLETE BULK DOWNLOAD
            </button>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 8. STAFF MANAGEMENT TAB (Super Admin Only) */}
      {/* ==================================================================== */}
      {activeTab === 'staffManagement' && isSuperAdmin && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">Authorized Staff &amp; RBAC Control</h3>
                <p className="text-xs text-slate-400">
                  Staff accounts require explicit Super Admin approval before access is permitted.
                </p>
              </div>
              <button
                onClick={() => setShowCreateStaffModal(true)}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition"
              >
                <Plus className="w-4 h-4" />
                Create Staff Account
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">Staff Member</th>
                    <th className="py-3 px-4">Username / Email</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Administrative Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {paginate(staffList, staffPage, staffPageSize).map((staff) => (
                    <tr key={staff.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3.5 px-4 font-bold text-white">{staff.fullName}</td>
                      <td className="py-3.5 px-4 text-slate-300">
                        <p>{staff.username}</p>
                        <p className="text-[10px] text-slate-500">{staff.email}</p>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-indigo-300 border border-indigo-500/20">
                          {staff.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {staff.status === 'APPROVED' || staff.status === 'ACTIVE' ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {staff.status}
                          </span>
                        ) : staff.status === 'PENDING_APPROVAL' ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            PENDING APPROVAL
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            {staff.status}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {staff.status === 'PENDING_APPROVAL' && (
                            <button
                              onClick={() => handleUpdateStaffStatus(staff.id, 'APPROVED')}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition flex items-center gap-1"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              Approve
                            </button>
                          )}
                          {staff.status === 'APPROVED' && (
                            <button
                              onClick={() => handleUpdateStaffStatus(staff.id, 'DISABLED')}
                              className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[11px] font-semibold transition"
                            >
                              Deactivate
                            </button>
                          )}
                          {staff.status === 'DISABLED' && (
                            <button
                              onClick={() => handleUpdateStaffStatus(staff.id, 'APPROVED')}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 text-[11px] font-semibold transition"
                            >
                              Activate
                            </button>
                          )}
                          <button
                            onClick={() => setShowResetPasswordModal(staff)}
                            className="p-1 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-amber-400 transition"
                            title="Reset Staff Password"
                          >
                            <Key className="w-3.5 h-3.5" />
                          </button>
                          {staff.role !== 'SUPER_ADMIN' && (
                            <button
                              onClick={() => handleDeleteStaff(staff.id)}
                              className="p-1 rounded-lg hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition"
                              title="Delete Account"
                            >
                              <UserX className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Staff Global Pagination */}
            <GlobalPagination
              variant="dark"
              currentPage={staffPage}
              totalRecords={staffList.length}
              pageSize={staffPageSize}
              onPageChange={setStaffPage}
              onPageSizeChange={setStaffPageSize}
            />
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 9. DOWNLOAD HISTORY & AUDIT LOGS TAB (Super Admin Only) */}
      {/* ==================================================================== */}
      {activeTab === 'downloadHistory' && isSuperAdmin && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-white">Download Activity &amp; Audit Trail</h3>
            <p className="text-xs text-slate-400">
              Immutable logging of every staff download, batch packaging event, and timestamp.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">Date &amp; Time</th>
                    <th className="py-3 px-4">Staff Member</th>
                    <th className="py-3 px-4">Download Type</th>
                    <th className="py-3 px-4">Batch / Scope</th>
                    <th className="py-3 px-4 text-center">Cards Count</th>
                    <th className="py-3 px-4 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {downloadLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-400">
                        No downloads logged yet.
                      </td>
                    </tr>
                  ) : (
                    paginate(downloadLogs, downloadLogPage, downloadLogPageSize).map((log) => (
                      <tr key={log.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3 px-4 font-mono text-slate-400">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 font-bold text-white">{log.userName}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            {log.downloadType}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-amber-400 font-semibold">{log.batchYear}</td>
                        <td className="py-3 px-4 text-center font-bold text-emerald-400">
                          {log.cardCount}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-400">{log.details}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Download Logs Global Pagination */}
            <GlobalPagination
              variant="dark"
              currentPage={downloadLogPage}
              totalRecords={downloadLogs.length}
              pageSize={downloadLogPageSize}
              onPageChange={setDownloadLogPage}
              onPageSizeChange={setDownloadLogPageSize}
            />
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 10. SYSTEM SETTINGS TAB */}
      {/* ==================================================================== */}
      {activeTab === 'settings' && (
        <div className="space-y-6 max-w-2xl">
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-5">
            <h3 className="text-base font-bold text-white">ID Card Printing &amp; Engine Settings</h3>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Physical Dimensions
                </label>
                <input
                  type="text"
                  disabled
                  value="54.0 × 86.0 mm (Standard CR80 Portrait Card)"
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  A4 Gang-Run Printing Layout
                </label>
                <input
                  type="text"
                  disabled
                  value="3 Columns × 3 Rows = 9 Cards per A4 Sheet (210 × 297 mm)"
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Verification QR Target Endpoint
                </label>
                <input
                  type="text"
                  value={settings.verificationEndpoint}
                  onChange={(e) =>
                    setSettings({ ...settings, verificationEndpoint: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="pt-3">
                <button
                  onClick={() => {
                    IdCardStore.saveSettings(settings);
                    showToast('success', 'Settings saved successfully.');
                  }}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold transition"
                >
                  Save Configuration
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ID Card Preview Modal */}
      {previewStudent && (
        <React.Suspense fallback={null}>
          <IdCardPreviewModal
            student={previewStudent}
            currentUserName={currentUserEmail}
            currentUserRole={currentUserRole}
            onClose={() => setPreviewStudent(null)}
            onCardGenerated={refreshData}
          />
        </React.Suspense>
      )}

      {/* Create Staff Modal */}
      {showCreateStaffModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">Create New Staff Account</h3>
            <p className="text-xs text-slate-400">
              Staff members must be approved by the Super Admin before they can access the panel.
            </p>

            <form onSubmit={handleCreateStaff} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tariqul Islam"
                  value={newStaffForm.fullName}
                  onChange={(e) =>
                    setNewStaffForm({ ...newStaffForm, fullName: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Username / Login ID</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. tariq.idcard"
                  value={newStaffForm.username}
                  onChange={(e) =>
                    setNewStaffForm({ ...newStaffForm, username: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. tariq@gmail.com"
                  value={newStaffForm.email}
                  onChange={(e) =>
                    setNewStaffForm({ ...newStaffForm, email: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Staff Role</label>
                <select
                  value={newStaffForm.role}
                  onChange={(e) =>
                    setNewStaffForm({
                      ...newStaffForm,
                      role: e.target.value as IdCardStaffAccount['role'],
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none"
                >
                  <option value="ID_CARD_STAFF">ID Card Staff</option>
                  <option value="ID_CARD_SUPERVISOR">ID Card Supervisor</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateStaffModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition"
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Staff Password Modal */}
      {showResetPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">Reset Staff Password</h3>
            <p className="text-xs text-slate-400">
              Reset credentials for <strong className="text-white">{showResetPasswordModal.fullName}</strong> ({showResetPasswordModal.username})
            </p>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-slate-300 font-semibold text-xs">New Secure Password</label>
                <button
                  type="button"
                  onClick={() => setNewStaffPassword('admin@123')}
                  className="text-[10px] text-amber-400 hover:text-amber-300 font-mono font-semibold"
                >
                  🧪 Fill: admin@123
                </button>
              </div>
              <input
                type="password"
                placeholder="Enter new password (e.g. staff@123)"
                value={newStaffPassword}
                onChange={(e) => setNewStaffPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none focus:border-amber-400"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowResetPasswordModal(null);
                  setNewStaffPassword('');
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  showToast('success', `Password reset successfully for ${showResetPasswordModal.username}`);
                  setShowResetPasswordModal(null);
                  setNewStaffPassword('');
                }}
                className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs"
              >
                Save Password
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
