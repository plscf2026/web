/**
 * Super Admin Manual Registration Approval Portal
 * Police Lines High School & College, Faridpur — Grand Reunion 2027
 * Independent Verification Engine for On-Site Registrations, QR Code Activation & Treasury Approvals
 */

import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  Check,
  X,
  AlertCircle,
  Edit2,
  DollarSign,
  QrCode,
  Search,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  User,
  GraduationCap,
  Phone,
  Camera,
} from 'lucide-react';
import {
  Language,
  RegistrationRecord,
  AdminAccount,
  RegistrationApprovalStatus,
  FinancialApprovalStatus,
} from '../../../types';
import { ManualRegistrationService } from '../../../services/manualRegistrationService';
import { AppStore } from '../../../services/store';
import { TicketView } from '../../TicketView';
import { AdminStudentPhotoModal } from '../photos/AdminStudentPhotoModal';

interface ManualApprovalTabProps {
  language: Language;
  currentAdmin: AdminAccount;
}

export const ManualApprovalTab: React.FC<ManualApprovalTabProps> = ({
  language,
  currentAdmin,
}) => {
  // Local list refresh trigger
  const [refreshKey, setRefreshKey] = useState(0);
  const handleRefresh = () => setRefreshKey((prev) => prev + 1);

  // Retrieve all registrations from AppStore
  const allRegistrations = useMemo(() => {
    return AppStore.getRegistrations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  // Filter to manual venue registrations
  const manualRegistrations = useMemo(() => {
    return allRegistrations.filter((r) => r.isManualRegistration);
  }, [allRegistrations]);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRegStatus, setFilterRegStatus] = useState<
    'all' | 'pending' | 'approved' | 'rejected'
  >('all');
  const [filterFinStatus, setFilterFinStatus] = useState<
    'all' | 'pending' | 'approved' | 'rejected' | 'none'
  >('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'former' | 'current'>('all');

  // Modal states
  const [viewTicketRecord, setViewTicketRecord] = useState<RegistrationRecord | null>(null);
  const [rejectingRecord, setRejectingRecord] = useState<RegistrationRecord | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isSubmittingRejection, setIsSubmittingRejection] = useState(false);

  const [rejectingFinRecord, setRejectingFinRecord] = useState<RegistrationRecord | null>(null);
  const [financialRejectionReason, setFinancialRejectionReason] = useState('');
  const [isSubmittingFinRejection, setIsSubmittingFinRejection] = useState(false);

  const [editingRecord, setEditingRecord] = useState<RegistrationRecord | null>(null);
  const [selectedStudentForPhoto, setSelectedStudentForPhoto] = useState<RegistrationRecord | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<RegistrationRecord>>({});
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [actionErrorMsg, setActionErrorMsg] = useState<string | null>(null);

  const showNotification = (msg: string, isError = false) => {
    if (isError) {
      setActionErrorMsg(msg);
      setTimeout(() => setActionErrorMsg(null), 5000);
    } else {
      setActionSuccessMsg(msg);
      setTimeout(() => setActionSuccessMsg(null), 4000);
    }
  };

  // KPI Metrics (Calculated dynamically)
  const stats = useMemo(() => {
    const total = manualRegistrations.length;
    const pendingReg = manualRegistrations.filter(
      (r) => (r.registrationApprovalStatus || 'pending') === 'pending'
    ).length;
    const approvedReg = manualRegistrations.filter(
      (r) => r.registrationApprovalStatus === 'approved'
    ).length;
    const rejectedReg = manualRegistrations.filter(
      (r) => r.registrationApprovalStatus === 'rejected'
    ).length;

    let pendingFinCount = 0;
    let pendingFinAmount = 0;
    let approvedFinAmount = 0;
    let rejectedFinAmount = 0;

    manualRegistrations.forEach((r) => {
      const amt = Number(r.financialAmount) || 0;
      if (r.financialApprovalStatus === 'pending') {
        pendingFinCount++;
        pendingFinAmount += amt;
      } else if (r.financialApprovalStatus === 'approved') {
        approvedFinAmount += amt;
      } else if (r.financialApprovalStatus === 'rejected') {
        rejectedFinAmount += amt;
      }
    });

    return {
      total,
      pendingReg,
      approvedReg,
      rejectedReg,
      pendingFinCount,
      pendingFinAmount,
      approvedFinAmount,
      rejectedFinAmount,
    };
  }, [manualRegistrations]);

  // Filtered List
  const filteredRegistrations = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return manualRegistrations.filter((r) => {
      // Category filter
      if (categoryFilter !== 'all' && r.category !== categoryFilter) return false;

      // Registration approval filter
      const regStatus = r.registrationApprovalStatus || 'pending';
      if (filterRegStatus !== 'all' && regStatus !== filterRegStatus) return false;

      // Financial approval filter
      const finStatus = r.financialApprovalStatus || 'none';
      if (filterFinStatus !== 'all' && finStatus !== filterFinStatus) return false;

      // Search term
      if (term) {
        const matchName = (r.fullName || '').toLowerCase().includes(term);
        const matchMobile = (r.mobileNumber || '').includes(term);
        const matchId = (r.id || '').toLowerCase().includes(term);
        const matchStudentId = (r.studentId || '').toLowerCase().includes(term);
        const matchBatch = (r.batchName || '').toLowerCase().includes(term);
        const matchAdmin = (r.createdByAdminName || '').toLowerCase().includes(term);
        const matchTrx = (r.financialReference || '').toLowerCase().includes(term);

        if (!matchName && !matchMobile && !matchId && !matchStudentId && !matchBatch && !matchAdmin && !matchTrx) {
          return false;
        }
      }

      return true;
    });
  }, [manualRegistrations, searchTerm, filterRegStatus, filterFinStatus, categoryFilter]);

  // ==========================================
  // ACTION HANDLERS
  // ==========================================

  // 1. Approve Registration (Activates QR Code)
  const handleApproveRegistration = async (rec: RegistrationRecord) => {
    const confirm = window.confirm(
      language === 'bn'
        ? `আপনি কি নিশ্চিত যে শিক্ষার্থী ${rec.fullName} এর রেজিস্ট্রেশন অনুমোদন করতে চান? এটি সাথে সাথে QR কোড সক্রিয় করবে।`
        : `Are you sure you want to approve registration for ${rec.fullName}? This will activate their QR code immediately.`
    );
    if (!confirm) return;

    const res = await ManualRegistrationService.approveRegistration(
      rec.id,
      { id: currentAdmin.id, name: currentAdmin.fullName || currentAdmin.username },
      `Approved by Super Admin ${currentAdmin.fullName || currentAdmin.username}`
    );

    if (res.success) {
      showNotification(
        language === 'bn'
          ? `শিক্ষার্থী ${rec.fullName} এর রেজিস্ট্রেশন অনুমোদিত ও কিউআর কোড সক্রিয় হয়েছে!`
          : `Registration approved and QR code activated for ${rec.fullName}!`
      );
      handleRefresh();
    } else {
      showNotification(res.error || 'Failed to approve registration.', true);
    }
  };

  // 2. Reject Registration (Deactivates QR Code)
  const handleConfirmRejectRegistration = async () => {
    if (!rejectingRecord) return;
    if (!rejectionReason.trim()) {
      alert(
        language === 'bn'
          ? 'প্রত্যাখ্যানের কারণ লেখা বাধ্যতামূলক।'
          : 'Rejection reason is required for audit logs.'
      );
      return;
    }

    setIsSubmittingRejection(true);
    try {
      const res = await ManualRegistrationService.rejectRegistration(
        rejectingRecord.id,
        { id: currentAdmin.id, name: currentAdmin.fullName || currentAdmin.username },
        rejectionReason.trim()
      );

      if (res.success) {
        showNotification(
          language === 'bn'
            ? `রেজিস্ট্রেশন প্রত্যাখ্যাত হয়েছে (${rejectingRecord.fullName})।`
            : `Registration rejected for ${rejectingRecord.fullName}.`
        );
        setRejectingRecord(null);
        setRejectionReason('');
        handleRefresh();
      } else {
        showNotification(res.error || 'Failed to reject registration.', true);
      }
    } finally {
      setIsSubmittingRejection(false);
    }
  };

  // 3. Approve Financial Amount (Treasury Addition)
  const handleApproveFinancial = async (rec: RegistrationRecord) => {
    const amt = Number(rec.financialAmount) || 0;
    const confirm = window.confirm(
      language === 'bn'
        ? `আপনি কি নিশ্চিত যে ${amt} টাকা অনুমোদন করে অফিসিয়াল ফান্ডে যুক্ত করতে চান?`
        : `Are you sure you want to approve financial amount of BDT ${amt} into official treasury?`
    );
    if (!confirm) return;

    const res = await ManualRegistrationService.approveFinancial(
      rec.id,
      { id: currentAdmin.id, name: currentAdmin.fullName || currentAdmin.username },
      `Financial amount approved by Super Admin ${currentAdmin.fullName || currentAdmin.username}`
    );

    if (res.success) {
      showNotification(
        language === 'bn'
          ? `টাকা ${amt} অনুমোদিত এবং অফিসিয়াল ফান্ডে যুক্ত হয়েছে!`
          : `BDT ${amt} approved and officially added to treasury ledger!`
      );
      handleRefresh();
    } else {
      showNotification(res.error || 'Failed to approve financial amount.', true);
    }
  };

  // 4. Reject Financial Amount (Excluded from treasury)
  const handleConfirmRejectFinancial = async () => {
    if (!rejectingFinRecord) return;

    setIsSubmittingFinRejection(true);
    try {
      const res = await ManualRegistrationService.rejectFinancial(
        rejectingFinRecord.id,
        { id: currentAdmin.id, name: currentAdmin.fullName || currentAdmin.username },
        financialRejectionReason.trim() || 'Rejected by Super Admin'
      );

      if (res.success) {
        showNotification(
          language === 'bn'
            ? `আর্থিক এন্ট্রি প্রত্যাখ্যাত হয়েছে। অফিসিয়াল ফান্ডে যুক্ত হবে না।`
            : `Financial entry rejected. Excluded from official treasury.`
        );
        setRejectingFinRecord(null);
        setFinancialRejectionReason('');
        handleRefresh();
      } else {
        showNotification(res.error || 'Failed to reject financial amount.', true);
      }
    } finally {
      setIsSubmittingFinRejection(false);
    }
  };

  // 5. Edit Registration Details
  const handleOpenEditModal = (rec: RegistrationRecord) => {
    setEditingRecord(rec);
    setEditFormData({
      fullName: rec.fullName,
      mobileNumber: rec.mobileNumber,
      email: rec.email,
      batchName: rec.batchName,
      studentId: rec.studentId,
      tShirtSize: rec.tShirtSize,
      address: rec.address,
      notes: rec.notes,
    });
  };

  const handleSaveEdit = async () => {
    if (!editingRecord) return;
    setIsSubmittingEdit(true);
    try {
      const res = await ManualRegistrationService.updateRegistrationDetails(
        editingRecord.id,
        editFormData,
        { id: currentAdmin.id, name: currentAdmin.fullName || currentAdmin.username }
      );

      if (res.success) {
        showNotification(
          language === 'bn'
            ? 'শিক্ষার্থীর তথ্য সফলভাবে আপডেট করা হয়েছে।'
            : 'Registration details updated successfully.'
        );
        setEditingRecord(null);
        handleRefresh();
      } else {
        showNotification(res.error || 'Failed to update registration.', true);
      }
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Notifications */}
      {actionSuccessMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{actionSuccessMsg}</span>
          </div>
          <button
            onClick={() => setActionSuccessMsg(null)}
            className="p-1 text-emerald-500 hover:text-emerald-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {actionErrorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-semibold flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{actionErrorMsg}</span>
          </div>
          <button
            onClick={() => setActionErrorMsg(null)}
            className="p-1 text-rose-500 hover:text-rose-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-indigo-900/40">
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase bg-amber-400 text-slate-950 shadow-xs">
                <ShieldCheck className="w-3.5 h-3.5" />
                Super Admin Clearance Gate
              </span>
              <span className="text-xs text-indigo-200 font-mono">
                {language === 'bn' ? 'ম্যানুয়াল টিকিট ও পেমেন্ট অনুমোদন' : 'Independent Dual Approval Engine'}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              {language === 'bn'
                ? 'ম্যানুয়াল নিবন্ধন ও ফান্ড অনুমোদন পোর্টাল'
                : 'Manual Registration & Financial Approval Portal'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
              {language === 'bn'
                ? 'অন-সাইট বা ভেন্যুতে অ্যাডমিন কর্তৃক তৈরি করা শিক্ষার্থীদের তালিকা যাচাই করুন। কিউআর কোড সক্রিয়করণ এবং আর্থিক অনুমোদন দুটি সম্পূর্ণ স্বাধীনভাবে সম্পন্ন হয়।'
                : 'Review venue registrations submitted by desk admins. QR code activation and treasury amount approval operate independently to ensure total audit security.'}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleRefresh}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all border border-white/15 shadow-xs"
            >
              <RefreshCw className="w-4 h-4" />
              <span>{language === 'bn' ? 'রিফ্রেশ' : 'Refresh'}</span>
            </button>
          </div>
        </div>

        {/* Real-time KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10">
          <div className="bg-white/5 rounded-2xl p-3 border border-white/10">
            <div className="flex items-center justify-between text-amber-300 text-xs font-bold mb-1">
              <span>{language === 'bn' ? 'অপেক্ষমান নিবন্ধন' : 'Pending Reg'}</span>
              <Clock className="w-4 h-4" />
            </div>
            <div className="text-2xl font-black text-white">{stats.pendingReg}</div>
            <span className="text-[10px] text-slate-400">
              {language === 'bn' ? 'কিউআর কোড নিষ্ক্রিয়' : 'QR code inactive'}
            </span>
          </div>

          <div className="bg-white/5 rounded-2xl p-3 border border-white/10">
            <div className="flex items-center justify-between text-indigo-300 text-xs font-bold mb-1">
              <span>{language === 'bn' ? 'অপেক্ষমান ফান্ড' : 'Pending Funds'}</span>
              <DollarSign className="w-4 h-4" />
            </div>
            <div className="text-2xl font-black text-white">৳{stats.pendingFinAmount.toLocaleString()}</div>
            <span className="text-[10px] text-slate-400">
              {stats.pendingFinCount} {language === 'bn' ? 'টি এন্ট্রি পর্যালোচনায়' : 'entries under review'}
            </span>
          </div>

          <div className="bg-white/5 rounded-2xl p-3 border border-white/10">
            <div className="flex items-center justify-between text-emerald-300 text-xs font-bold mb-1">
              <span>{language === 'bn' ? 'অনুমোদিত নিবন্ধন' : 'Approved Reg'}</span>
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="text-2xl font-black text-white">{stats.approvedReg}</div>
            <span className="text-[10px] text-emerald-400 font-semibold">
              {language === 'bn' ? 'কিউআর সক্রিয়' : 'QR codes active'}
            </span>
          </div>

          <div className="bg-white/5 rounded-2xl p-3 border border-white/10">
            <div className="flex items-center justify-between text-teal-300 text-xs font-bold mb-1">
              <span>{language === 'bn' ? 'অনুমোদিত ফান্ড' : 'Approved Funds'}</span>
              <DollarSign className="w-4 h-4" />
            </div>
            <div className="text-2xl font-black text-white">৳{stats.approvedFinAmount.toLocaleString()}</div>
            <span className="text-[10px] text-slate-400">
              {language === 'bn' ? 'অফিসিয়াল ফান্ডে যুক্ত' : 'Added to official ledger'}
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={
                language === 'bn'
                  ? 'নাম, মোবাইল নম্বর, রেজিস্ট্রেশন আইডি, ব্যাচ বা ট্রানজেকশন দিয়ে খুঁজুন...'
                  : 'Search by student name, mobile, registration ID, batch, admin, Trx ID...'
              }
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Registration Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 whitespace-nowrap">
              {language === 'bn' ? 'নিবন্ধন অবস্থা:' : 'Reg Status:'}
            </span>
            <select
              value={filterRegStatus}
              onChange={(e) => setFilterRegStatus(e.target.value as any)}
              className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            >
              <option value="all">{language === 'bn' ? 'সকল অবস্থা' : 'All Registrations'}</option>
              <option value="pending">
                {language === 'bn' ? '⏳ অপেক্ষমান (Pending)' : '⏳ Pending Approval'}
              </option>
              <option value="approved">
                {language === 'bn' ? '✅ অনুমোদিত (Approved)' : '✅ Approved & Active'}
              </option>
              <option value="rejected">
                {language === 'bn' ? '❌ প্রত্যাখ্যাত (Rejected)' : '❌ Rejected'}
              </option>
            </select>
          </div>

          {/* Financial Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 whitespace-nowrap">
              {language === 'bn' ? 'আর্থিক অবস্থা:' : 'Finance:'}
            </span>
            <select
              value={filterFinStatus}
              onChange={(e) => setFilterFinStatus(e.target.value as any)}
              className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            >
              <option value="all">{language === 'bn' ? 'সকল ফান্ড অবস্থা' : 'All Finance Status'}</option>
              <option value="pending">
                {language === 'bn' ? '⏳ ফান্ড অপেক্ষমান' : '⏳ Pending Treasury Review'}
              </option>
              <option value="approved">
                {language === 'bn' ? '✅ ফান্ড অনুমোদিত' : '✅ Treasury Approved'}
              </option>
              <option value="rejected">
                {language === 'bn' ? '❌ ফান্ড প্রত্যাখ্যাত' : '❌ Treasury Rejected'}
              </option>
              <option value="none">{language === 'bn' ? 'বিনা মূল্যে / নেই' : 'No Financial Entry'}</option>
            </select>
          </div>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as any)}
            className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-600"
          >
            <option value="all">{language === 'bn' ? 'সকল শিক্ষার্থী' : 'All Students'}</option>
            <option value="former">{language === 'bn' ? 'প্রাক্তন শিক্ষার্থী' : 'Former Student'}</option>
            <option value="current">{language === 'bn' ? 'বর্তমান শিক্ষার্থী' : 'Current Student'}</option>
          </select>
        </div>

        {/* Quick status tabs */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
          <span className="text-slate-400 font-bold uppercase text-[10px] mr-1">
            {language === 'bn' ? 'দ্রুত ফিল্টার:' : 'Quick Filters:'}
          </span>
          <button
            onClick={() => {
              setFilterRegStatus('pending');
              setFilterFinStatus('all');
            }}
            className={`px-3 py-1 rounded-full font-bold transition-all ${
              filterRegStatus === 'pending'
                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            ⏳ {language === 'bn' ? 'অপেক্ষমান টিকিট' : 'Pending Registrations'} ({stats.pendingReg})
          </button>
          <button
            onClick={() => {
              setFilterRegStatus('all');
              setFilterFinStatus('pending');
            }}
            className={`px-3 py-1 rounded-full font-bold transition-all ${
              filterFinStatus === 'pending'
                ? 'bg-indigo-100 text-indigo-900 border border-indigo-300'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            💰 {language === 'bn' ? 'অপেক্ষমান টাকা' : 'Pending Financial Review'} ({stats.pendingFinCount})
          </button>
          <button
            onClick={() => {
              setFilterRegStatus('approved');
              setFilterFinStatus('all');
            }}
            className={`px-3 py-1 rounded-full font-bold transition-all ${
              filterRegStatus === 'approved'
                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            ✅ {language === 'bn' ? 'অনুমোদিত' : 'Approved & Active'} ({stats.approvedReg})
          </button>
          <button
            onClick={() => {
              setFilterRegStatus('all');
              setFilterFinStatus('all');
              setSearchTerm('');
              setCategoryFilter('all');
            }}
            className="px-3 py-1 rounded-full font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all ml-auto"
          >
            {language === 'bn' ? 'রিসেট' : 'Reset All'}
          </button>
        </div>
      </div>

      {/* Registrations List / Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
              {language === 'bn'
                ? `ম্যানুয়াল নিবন্ধন তালিকা (${filteredRegistrations.length})`
                : `Manual Venue Registrations (${filteredRegistrations.length})`}
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            {language === 'bn'
              ? 'স্বাধীন দ্বিমুখী অনুমোদন ব্যবস্থা (রেজিস্ট্রেশন ও আর্থিক পৃথক)'
              : 'Independent dual approval system'}
          </span>
        </div>

        {filteredRegistrations.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
              <User className="w-7 h-7" />
            </div>
            <h4 className="text-base font-bold text-slate-700">
              {language === 'bn' ? 'কোনো নিবন্ধন পাওয়া যায়নি' : 'No Registrations Found'}
            </h4>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {language === 'bn'
                ? 'আপনার দেওয়া ফিল্টার বা সার্চ টার্ম অনুযায়ী কোনো ম্যানুয়াল রেজিস্ট্রেশন মেলেনি।'
                : 'No manual venue registrations match the selected filters or search query.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredRegistrations.map((rec) => {
              const regStatus: RegistrationApprovalStatus =
                rec.registrationApprovalStatus || 'pending';
              const finStatus: FinancialApprovalStatus =
                rec.financialApprovalStatus || (Number(rec.financialAmount) > 0 ? 'pending' : 'none');
              const finAmount = Number(rec.financialAmount) || 0;

              return (
                <div
                  key={rec.id}
                  className="p-5 hover:bg-slate-50/80 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-5"
                >
                  {/* Left Column: Student Details */}
                  <div className="flex items-start gap-4 min-w-0 flex-1">
                    {/* Avatar */}
                    <div
                      className="relative shrink-0 group cursor-pointer"
                      onClick={() => setSelectedStudentForPhoto(rec)}
                      title="Click to view & manage student photo in Supabase Storage"
                    >
                      <img
                        src={rec.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80'}
                        alt={rec.fullName}
                        className="w-14 h-14 rounded-2xl object-cover border-2 border-slate-200 shadow-xs group-hover:ring-2 group-hover:ring-emerald-500 transition-all"
                      />
                      <div className="absolute inset-0 bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[10px]">
                        <Camera className="w-4 h-4" />
                      </div>
                      <span
                        className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${
                          regStatus === 'approved'
                            ? 'bg-emerald-500'
                            : regStatus === 'rejected'
                            ? 'bg-rose-500'
                            : 'bg-amber-500'
                        }`}
                        title={`Registration: ${regStatus}`}
                      />
                    </div>

                    {/* Metadata */}
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-sm font-black text-slate-900 truncate">
                          {rec.fullName}
                        </h4>
                        {rec.fullNameBn && (
                          <span className="text-xs font-semibold text-slate-500 truncate">
                            ({rec.fullNameBn})
                          </span>
                        )}
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            rec.category === 'current'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-purple-50 text-purple-700 border border-purple-200'
                          }`}
                        >
                          {rec.category === 'current'
                            ? language === 'bn'
                              ? 'বর্তমান'
                              : 'Current'
                            : language === 'bn'
                            ? 'প্রাক্তন'
                            : 'Former'}
                        </span>

                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                          {rec.id}
                        </span>

                        {rec.studentId && (
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                            SID: {rec.studentId}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                        <span className="flex items-center gap-1 font-medium">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-mono">{rec.mobileNumber}</span>
                        </span>

                        <span className="flex items-center gap-1 font-medium">
                          <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            {language === 'bn' ? 'ব্যাচ:' : 'Batch:'} {rec.batchName || rec.passingYear || 'N/A'}
                          </span>
                        </span>

                        <span className="text-[11px] text-slate-500 font-mono">
                          QR: <span className="font-bold text-slate-800">{rec.qrToken}</span>
                        </span>

                        <span className="text-[11px] text-slate-500 font-medium">
                          {language === 'bn' ? 'সাইজ:' : 'Size:'} <span className="font-bold">{rec.tShirtSize}</span>
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                        <span>
                          {language === 'bn' ? 'নিবন্ধনকারী অ্যাডমিন:' : 'Created by Admin:'}{' '}
                          <strong className="text-slate-700 font-semibold">
                            {rec.createdByAdminName || 'Venue Desk'}
                          </strong>
                        </span>
                        <span>•</span>
                        <span>
                          {new Date(rec.registeredAt).toLocaleDateString(
                            language === 'bn' ? 'bn-BD' : 'en-US',
                            { dateStyle: 'medium', timeStyle: 'short' }
                          )}
                        </span>
                        {rec.approvalNotes && (
                          <>
                            <span>•</span>
                            <span className="italic text-slate-600 font-medium">
                              "{rec.approvalNotes}"
                            </span>
                          </>
                        )}
                        {rec.rejectionReason && (
                          <>
                            <span>•</span>
                            <span className="text-rose-600 font-bold">
                              Reason: {rec.rejectionReason}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Middle Column: Status Badges (Strictly Independent) */}
                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 shrink-0">
                    {/* Registration Approval Badge */}
                    <div className="space-y-1 min-w-[130px]">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        {language === 'bn' ? 'রেজিস্ট্রেশন স্ট্যাটাস' : 'Reg & QR Status'}
                      </span>
                      {regStatus === 'approved' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{language === 'bn' ? 'অনুমোদিত ও সক্রিয়' : 'Approved (Active)'}</span>
                        </span>
                      ) : regStatus === 'rejected' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold bg-rose-50 text-rose-800 border border-rose-300">
                          <X className="w-3.5 h-3.5 text-rose-600" />
                          <span>{language === 'bn' ? 'প্রত্যাখ্যাত (নিষ্ক্রিয়)' : 'Rejected (Inactive)'}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold bg-amber-50 text-amber-900 border border-amber-300 animate-pulse">
                          <Clock className="w-3.5 h-3.5 text-amber-600" />
                          <span>{language === 'bn' ? 'অনুমোদন অপেক্ষমান' : 'Pending Approval'}</span>
                        </span>
                      )}
                    </div>

                    {/* Financial Approval Badge */}
                    <div className="space-y-1 min-w-[140px]">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        {language === 'bn' ? 'ফান্ড ও অর্থ প্রদান' : 'Treasury & Finance'}
                      </span>
                      {finAmount <= 0 || finStatus === 'none' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                          <span>{language === 'bn' ? 'কোনো ফি নেই' : 'No Fee (Free)'}</span>
                        </span>
                      ) : finStatus === 'approved' ? (
                        <div className="space-y-0.5">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span>৳{finAmount} {language === 'bn' ? 'অনুমোদিত' : 'Approved'}</span>
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono block">
                            {rec.financialMethod || 'Cash'}
                          </span>
                        </div>
                      ) : finStatus === 'rejected' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-rose-50 text-rose-800 border border-rose-300">
                          <X className="w-3.5 h-3.5 text-rose-600" />
                          <span>৳{finAmount} {language === 'bn' ? 'প্রত্যাখ্যাত' : 'Rejected'}</span>
                        </span>
                      ) : (
                        <div className="space-y-0.5">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-indigo-50 text-indigo-900 border border-indigo-300">
                            <Clock className="w-3.5 h-3.5 text-indigo-600" />
                            <span>৳{finAmount} {language === 'bn' ? 'রিভিউ দরকার' : 'Review Needed'}</span>
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono block truncate max-w-[130px]">
                            {rec.financialMethod || 'Cash'} {rec.financialReference ? `• ${rec.financialReference}` : ''}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Independent Actions */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                    {/* View Ticket / QR */}
                    <button
                      type="button"
                      onClick={() => setViewTicketRecord(rec)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                      title={language === 'bn' ? 'টিকিট ও কিউআর প্রিভিউ' : 'View Generated Ticket & QR'}
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>{language === 'bn' ? 'টিকিট' : 'Ticket'}</span>
                    </button>

                    {/* Edit Details */}
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(rec)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                      title={language === 'bn' ? 'তথ্য সংশোধন' : 'Edit Details'}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>{language === 'bn' ? 'সংশোধন' : 'Edit'}</span>
                    </button>

                    {/* Manage Photo in Supabase Storage */}
                    <button
                      type="button"
                      onClick={() => setSelectedStudentForPhoto(rec)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200 transition-colors cursor-pointer"
                      title="Manage Student Photo in Supabase Storage (student-photos)"
                    >
                      <Camera className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{language === 'bn' ? 'ছবি' : 'Photo'}</span>
                    </button>

                    {/* Registration Approval Actions */}
                    {regStatus === 'pending' && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleApproveRegistration(rec)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-xs cursor-pointer"
                          title={language === 'bn' ? 'রেজিস্ট্রেশন অনুমোদন ও কিউআর চালু করুন' : 'Approve Registration & Activate QR'}
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{language === 'bn' ? 'অনুমোদন' : 'Approve Reg'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setRejectingRecord(rec)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-colors cursor-pointer"
                          title={language === 'bn' ? 'রেজিস্ট্রেশন প্রত্যাখ্যান করুন' : 'Reject Registration'}
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>{language === 'bn' ? 'বাতিল' : 'Reject'}</span>
                        </button>
                      </div>
                    )}

                    {/* Financial Approval Actions (Independent!) */}
                    {finAmount > 0 && finStatus === 'pending' && (
                      <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
                        <button
                          type="button"
                          onClick={() => handleApproveFinancial(rec)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors shadow-xs cursor-pointer"
                          title={language === 'bn' ? 'টাকা অনুমোদন করে অফিসিয়াল ফান্ডে যোগ করুন' : 'Approve Financial Entry into Official Treasury'}
                        >
                          <DollarSign className="w-3.5 h-3.5" />
                          <span>{language === 'bn' ? '৳ অনুমোদন' : 'Approve ৳'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setRejectingFinRecord(rec)}
                          className="flex items-center gap-1 px-2 py-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 text-xs font-bold transition-colors cursor-pointer"
                          title={language === 'bn' ? 'আর্থিক এন্ট্রি বাতিল করুন' : 'Reject Financial Entry'}
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>{language === 'bn' ? '৳ বাতিল' : 'Reject ৳'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================== */}
      {/* MODAL 1: TICKET & QR CODE PREVIEW MODAL   */}
      {/* ========================================== */}
      {viewTicketRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-xl bg-slate-900 rounded-3xl p-6 border border-slate-700 shadow-2xl my-8">
            <button
              type="button"
              onClick={() => setViewTicketRecord(null)}
              className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-4">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <QrCode className="w-5 h-5 text-amber-400" />
                <span>{language === 'bn' ? 'শিক্ষার্থী টিকিট ও কিউআর প্রিভিউ' : 'Student Ticket & QR Preview'}</span>
              </h3>
              <p className="text-xs text-slate-300 mt-1">
                {language === 'bn'
                  ? 'বর্তমান অবস্থা অনুযায়ী টিকিট রেন্ডারিং এবং কিউআর কোড অ্যাক্টিভেশন স্টেটাস প্রদর্শিত হচ্ছে।'
                  : 'Displays live ticket rendering and QR activation status.'}
              </p>
            </div>

            <div className="bg-white rounded-2xl p-4 overflow-hidden">
              <TicketView
                registration={viewTicketRecord}
                language={language}
                onClose={() => setViewTicketRecord(null)}
              />
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL 2: REJECT REGISTRATION CONFIRMATION */}
      {/* ========================================== */}
      {rejectingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3 text-rose-600 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center border border-rose-200">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  {language === 'bn' ? 'রেজিস্ট্রেশন প্রত্যাখ্যান' : 'Reject Registration'}
                </h3>
                <span className="text-xs text-slate-500 font-mono">{rejectingRecord.id}</span>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-4">
              {language === 'bn'
                ? `আপনি "${rejectingRecord.fullName}" এর নিবন্ধন বাতিল করতে চলেছেন। এর ফলে তার কিউআর কোড সম্পূর্ণ নিষ্ক্রিয় হবে এবং কোনো ভেন্যু সুবিধা পাবেন না। কারণ লেখা বাধ্যতামূলক:`
                : `You are about to reject registration for "${rejectingRecord.fullName}". The QR code will be deactivated permanently. A rejection reason is required for audit logs:`}
            </p>

            <div className="space-y-3">
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
                placeholder={
                  language === 'bn'
                    ? 'প্রত্যাখ্যানের সুস্পষ্ট কারণ লিখুন (যেমন: ভুয়া তথ্য, ডুপ্লিকেট পেমেন্ট)...'
                    : 'Enter rejection reason (e.g., duplicate submission, unverified credentials)...'
                }
                className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
              />

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setRejectingRecord(null);
                    setRejectionReason('');
                  }}
                  disabled={isSubmittingRejection}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  {language === 'bn' ? 'বাতিল' : 'Cancel'}
                </button>

                <button
                  type="button"
                  onClick={handleConfirmRejectRegistration}
                  disabled={isSubmittingRejection || !rejectionReason.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white transition-colors shadow-xs"
                >
                  {isSubmittingRejection
                    ? language === 'bn'
                      ? 'বাতিল হচ্ছে...'
                      : 'Rejecting...'
                    : language === 'bn'
                    ? 'প্রত্যাখ্যান নিশ্চিত করুন'
                    : 'Confirm Rejection'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL 3: REJECT FINANCIAL CONFIRMATION    */}
      {/* ========================================== */}
      {rejectingFinRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3 text-amber-600 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 flex items-center justify-center border border-amber-200">
                <DollarSign className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  {language === 'bn' ? 'আর্থিক এন্ট্রি প্রত্যাখ্যান' : 'Reject Financial Amount'}
                </h3>
                <span className="text-xs text-slate-500 font-mono">
                  BDT {rejectingFinRecord.financialAmount} • {rejectingFinRecord.id}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-4">
              {language === 'bn'
                ? `আপনি কি নিশ্চিত যে এই আর্থিক এন্ট্রি প্রত্যাখ্যান করতে চান? এটি অফিসিয়াল ট্রেজারিতে যুক্ত হবে না। শিক্ষার্থীর মূল রেজিস্ট্রেশন এতে প্রভাবিত হবে না।`
                : `Are you sure you want to reject this financial entry? It will be excluded from the official treasury. The student's registration status will remain independent.`}
            </p>

            <div className="space-y-3">
              <input
                type="text"
                value={financialRejectionReason}
                onChange={(e) => setFinancialRejectionReason(e.target.value)}
                placeholder={
                  language === 'bn'
                    ? 'প্রত্যাখ্যানের নোট (ঐচ্ছিক)...'
                    : 'Rejection note (optional)...'
                }
                className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setRejectingFinRecord(null);
                    setFinancialRejectionReason('');
                  }}
                  disabled={isSubmittingFinRejection}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  {language === 'bn' ? 'বাতিল' : 'Cancel'}
                </button>

                <button
                  type="button"
                  onClick={handleConfirmRejectFinancial}
                  disabled={isSubmittingFinRejection}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white transition-colors shadow-xs"
                >
                  {isSubmittingFinRejection
                    ? language === 'bn'
                      ? 'বাতিল হচ্ছে...'
                      : 'Rejecting...'
                    : language === 'bn'
                    ? 'ফান্ড প্রত্যাখ্যান করুন'
                    : 'Confirm Fund Rejection'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL 4: EDIT REGISTRATION DETAILS        */}
      {/* ========================================== */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-indigo-600" />
                <h3 className="text-base font-black text-slate-900">
                  {language === 'bn' ? 'শিক্ষার্থীর তথ্য সংশোধন' : 'Edit Registration Details'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingRecord(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {language === 'bn' ? 'শিক্ষার্থীর পূর্ণ নাম' : 'Full Name'}
                </label>
                <input
                  type="text"
                  value={editFormData.fullName || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, fullName: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-semibold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {language === 'bn' ? 'মোবাইল নম্বর' : 'Mobile Number'}
                  </label>
                  <input
                    type="text"
                    value={editFormData.mobileNumber || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, mobileNumber: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono font-semibold"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {language === 'bn' ? 'স্টুডেন্ট আইডি' : 'Student ID'}
                  </label>
                  <input
                    type="text"
                    value={editFormData.studentId || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, studentId: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {language === 'bn' ? 'ব্যাচ / পাশের বছর' : 'Batch / Passing Year'}
                  </label>
                  <input
                    type="text"
                    value={editFormData.batchName || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, batchName: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-semibold"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {language === 'bn' ? 'টি-শার্ট সাইজ' : 'T-Shirt Size'}
                  </label>
                  <select
                    value={editFormData.tShirtSize || 'L'}
                    onChange={(e) => setEditFormData({ ...editFormData, tShirtSize: e.target.value as any })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-semibold"
                  >
                    <option value="S">S</option>
                    <option value="M">M</option>
                    <option value="L">L</option>
                    <option value="XL">XL</option>
                    <option value="XXL">XXL</option>
                    <option value="XXXL">XXXL</option>
                    <option value="Oversize 50">Oversize 50</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {language === 'bn' ? 'অতিরিক্ত নোট' : 'Admin Notes'}
                </label>
                <textarea
                  value={editFormData.notes || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  disabled={isSubmittingEdit}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  {language === 'bn' ? 'বাতিল' : 'Cancel'}
                </button>

                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={isSubmittingEdit}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white transition-colors shadow-xs"
                >
                  {isSubmittingEdit
                    ? language === 'bn'
                      ? 'সংরক্ষণ হচ্ছে...'
                      : 'Saving...'
                    : language === 'bn'
                    ? 'পরিবর্তন সংরক্ষণ করুন'
                    : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Student Photo Inspection & Supabase Storage Management Modal */}
      {selectedStudentForPhoto && (
        <AdminStudentPhotoModal
          isOpen={Boolean(selectedStudentForPhoto)}
          onClose={() => setSelectedStudentForPhoto(null)}
          registration={selectedStudentForPhoto}
          adminName={currentAdmin.fullName || currentAdmin.username || 'Super Admin'}
          language={language}
          onPhotoUpdated={(updated) => {
            setSelectedStudentForPhoto(updated);
            setRefreshKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
};
