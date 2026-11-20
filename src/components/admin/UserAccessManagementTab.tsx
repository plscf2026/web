/**
 * Centralized Role-Based User Management Dashboard
 * Police Lines School & College, Faridpur — Grand Reunion 2027
 * Enterprise RBAC Control Center for Super Admins
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Key,
  RefreshCw,
  Search,
  Clock,
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Crown,
  DollarSign,
  Briefcase,
  Layers,
  ChevronRight,
  Edit2,
  X,
  Mail,
  Building,
  MapPin,
} from 'lucide-react';
import { AdminAccount, Language, StaffPermissionAction } from '../../types';
import {
  UserManagementService,
  UnifiedSystemUser,
  RoleGroupSummary,
  RoleCategory,
  UserStatus,
  UserType,
} from '../../services/userManagementService';
import { GlobalPagination } from '../common/GlobalPagination';
import { paginate } from '../../utils/pagination';

interface UserAccessManagementTabProps {
  currentAdmin: AdminAccount;
  language: Language;
}

export const UserAccessManagementTab: React.FC<UserAccessManagementTabProps> = ({
  currentAdmin,
  language,
}) => {
  // State
  const [users, setUsers] = useState<UnifiedSystemUser[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [feedbackNotice, setFeedbackNotice] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoleCategory, setSelectedRoleCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('ALL');
  const [selectedUserType, setSelectedUserType] = useState<string>('ALL');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UnifiedSystemUser | null>(null);
  const [statusConfirmUser, setStatusConfirmUser] = useState<{
    user: UnifiedSystemUser;
    targetStatus: UserStatus;
  } | null>(null);
  const [statusChangeReason, setStatusChangeReason] = useState('');
  const [activityHistoryUser, setActivityHistoryUser] = useState<UnifiedSystemUser | null>(null);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Create Form State
  const [createForm, setCreateForm] = useState({
    userType: 'STAFF' as UserType,
    fullName: '',
    username: '',
    email: '',
    role: 'GATE_STAFF',
    department: 'GATE',
    assignedStation: 'Gate 01 - Main Entrance',
    permissions: ['VIEW', 'SCAN', 'VERIFY', 'APPROVE'] as StaffPermissionAction[],
    authUserId: '',
  });

  // Edit Form State
  const [editForm, setEditForm] = useState({
    fullName: '',
    username: '',
    email: '',
    role: '',
    department: '',
    assignedStation: '',
    permissions: [] as StaffPermissionAction[],
  });

  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setFeedbackNotice({ type, message });
    setTimeout(() => setFeedbackNotice(null), 5000);
  };

  // Fetch Users
  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const fetched = await UserManagementService.fetchUnifiedUsers();
      setUsers(fetched);
    } catch (err: any) {
      showNotification('error', err?.message || 'Failed to load system users');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  // Compute Role Group Summaries
  const roleGroups: RoleGroupSummary[] = useMemo(() => {
    return UserManagementService.computeRoleGroupSummaries(users);
  }, [users]);

  // Unique Departments
  const departments = useMemo(() => {
    const set = new Set<string>();
    users.forEach((u) => {
      if (u.department) set.add(u.department);
    });
    return Array.from(set);
  }, [users]);

  // Filtered Users List
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // Search
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        u.fullName.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q) ||
        u.assignedStation.toLowerCase().includes(q) ||
        u.department.toLowerCase().includes(q);

      // Category
      const matchesCategory =
        selectedRoleCategory === 'ALL' || u.roleCategory === selectedRoleCategory;

      // Status
      const matchesStatus = selectedStatus === 'ALL' || u.status === selectedStatus;

      // Department
      const matchesDept = selectedDepartment === 'ALL' || u.department === selectedDepartment;

      // User Type
      const matchesType = selectedUserType === 'ALL' || u.userType === selectedUserType;

      return matchesSearch && matchesCategory && matchesStatus && matchesDept && matchesType;
    });
  }, [users, searchQuery, selectedRoleCategory, selectedStatus, selectedDepartment, selectedUserType]);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedRoleCategory, selectedStatus, selectedDepartment, selectedUserType]);

  // Format Date Helper
  const formatDhakaDateTime = (ts: string | null) => {
    if (!ts) return language === 'bn' ? 'লগইন হয়নি' : 'Never logged in';
    try {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return ts;
      return d.toLocaleString('en-US', {
        timeZone: 'Asia/Dhaka',
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      return ts;
    }
  };

  // Handle Quick Filter by clicking a Role Box
  const handleSelectRoleBox = (category: RoleCategory) => {
    setSelectedRoleCategory(category);
    // Smooth scroll down to table
    const tableEl = document.getElementById('unified-users-table');
    if (tableEl) {
      tableEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Open Create Modal for specific category
  const handleOpenCreateForCategory = (category: RoleCategory) => {
    let defaultRole = 'GATE_STAFF';
    let defaultType: UserType = 'STAFF';
    let defaultDept = 'OPERATIONS';

    if (category === 'SUPER_ADMIN') {
      defaultRole = 'super_admin';
      defaultType = 'ADMIN';
      defaultDept = 'CENTRAL_ADMIN';
    } else if (category === 'ADMIN') {
      defaultRole = 'admin';
      defaultType = 'ADMIN';
      defaultDept = 'CENTRAL_ADMIN';
    } else if (category === 'FINANCE') {
      defaultRole = 'FINANCE_STAFF';
      defaultType = 'STAFF';
      defaultDept = 'FINANCE';
    } else if (category === 'MANAGER') {
      defaultRole = 'registration_officer';
      defaultType = 'ADMIN';
      defaultDept = 'MANAGEMENT';
    }

    setCreateForm({
      userType: defaultType,
      fullName: '',
      username: '',
      email: '',
      role: defaultRole,
      department: defaultDept,
      assignedStation: defaultType === 'ADMIN' ? 'Super Admin Command Center' : 'Operational Booth 01',
      permissions: ['VIEW', 'SCAN', 'VERIFY', 'APPROVE'],
      authUserId: '',
    });
    setIsCreateModalOpen(true);
  };

  // Execute Create User
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.fullName.trim() || !createForm.username.trim() || !createForm.email.trim()) {
      showNotification('error', 'Please fill in all mandatory fields.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await UserManagementService.createSystemUser(
        {
          userType: createForm.userType,
          fullName: createForm.fullName,
          username: createForm.username,
          email: createForm.email,
          role: createForm.role,
          department: createForm.department,
          assignedStation: createForm.assignedStation,
          permissions: createForm.permissions,
          authUserId: createForm.authUserId || undefined,
        },
        currentAdmin
      );

      if (res.success) {
        showNotification(
          'success',
          `Successfully created ${createForm.userType} user "${createForm.fullName}" with role ${createForm.role}!`
        );
        setIsCreateModalOpen(false);
        await loadUsers();
      } else {
        showNotification('error', res.error || 'Failed to create user account.');
      }
    } catch (err: any) {
      showNotification('error', err?.message || 'Server error occurred during account creation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (user: UnifiedSystemUser) => {
    setEditingUser(user);
    setEditForm({
      fullName: user.fullName,
      username: user.username,
      email: user.email,
      role: user.role,
      department: user.department,
      assignedStation: user.assignedStation,
      permissions: user.permissions || [],
    });
  };

  // Execute Edit User
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setIsSubmitting(true);
    try {
      const res = await UserManagementService.updateUserProfile(
        editingUser.id,
        editingUser.userType,
        {
          fullName: editForm.fullName,
          username: editForm.username,
          email: editForm.email,
          role: editForm.role,
          department: editForm.department,
          assignedStation: editForm.assignedStation,
          permissions: editForm.permissions,
        },
        currentAdmin,
        'Profile update via User & Access Management portal'
      );

      if (res.success) {
        showNotification('success', `Updated profile for "${editForm.fullName}".`);
        setEditingUser(null);
        await loadUsers();
      } else {
        showNotification('error', res.error || 'Failed to update user profile.');
      }
    } catch (err: any) {
      showNotification('error', err?.message || 'Update failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Execute Status Toggle (Active, Inactive, Suspended)
  const handleConfirmStatusChange = async () => {
    if (!statusConfirmUser) return;
    const { user, targetStatus } = statusConfirmUser;

    setIsSubmitting(true);
    try {
      const res = await UserManagementService.updateUserStatus(
        user.id,
        user.userType,
        targetStatus,
        currentAdmin,
        statusChangeReason.trim() || `Status updated to ${targetStatus}`
      );

      if (res.success) {
        showNotification(
          'success',
          `Account "${user.fullName}" is now ${targetStatus}. Sessions revoked where applicable.`
        );
        setStatusConfirmUser(null);
        setStatusChangeReason('');
        await loadUsers();
      } else {
        showNotification('error', res.error || 'Unable to update account status.');
      }
    } catch (err: any) {
      showNotification('error', err?.message || 'Status transition error.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Password Reset Trigger
  const handleResetPassword = async (user: UnifiedSystemUser) => {
    const confirmed = window.confirm(
      `Send official password reset email to ${user.fullName} (${user.email})?`
    );
    if (!confirmed) return;

    try {
      const res = await UserManagementService.resetPasswordForEmail(user.email);
      if (res.success) {
        showNotification(
          'success',
          `Password reset link dispatched to ${user.email}. Staff can set their new password securely.`
        );
      } else {
        showNotification('error', res.error || 'Failed to send password reset email.');
      }
    } catch (err: any) {
      showNotification('error', err?.message || 'Password reset failed.');
    }
  };

  // View Activity History
  const handleOpenActivityHistory = async (user: UnifiedSystemUser) => {
    setActivityHistoryUser(user);
    setIsLoadingLogs(true);
    try {
      const logs = await UserManagementService.fetchUserActivityHistory(user.id);
      setActivityLogs(logs);
    } catch {
      setActivityLogs([]);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  // Category Icon Mapping
  const getCategoryIcon = (cat: RoleCategory) => {
    switch (cat) {
      case 'SUPER_ADMIN':
        return <Crown className="w-5 h-5 text-amber-500" />;
      case 'ADMIN':
        return <Shield className="w-5 h-5 text-blue-500" />;
      case 'STAFF':
        return <Users className="w-5 h-5 text-emerald-500" />;
      case 'FINANCE':
        return <DollarSign className="w-5 h-5 text-purple-500" />;
      case 'MANAGER':
        return <Briefcase className="w-5 h-5 text-indigo-500" />;
      case 'CUSTOM':
      default:
        return <Layers className="w-5 h-5 text-rose-500" />;
    }
  };

  return (
    <div className="space-y-8">
      {/* ========================================================================= */}
      {/* 1. TOP HEADER & TELEMETRY BANNER                                         */}
      {/* ========================================================================= */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-indigo-900/60 relative overflow-hidden">
        {/* Glow Decoration */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold border border-indigo-400/30">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{language === 'bn' ? 'সেন্ট্রালাইজড আর-ব্যাক ড্যাশবোর্ড' : 'Centralized RBAC Control Hub'}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              {language === 'bn' ? 'ইউজার ও এক্সেস ম্যানেজমেন্ট' : 'User & Access Management'}
            </h2>
            <p className="text-sm text-slate-300 max-w-2xl font-medium leading-relaxed">
              {language === 'bn'
                ? 'সিস্টেমের সমস্ত সুপার অ্যাডমিন, অ্যাডমিন, স্টেশন স্টাফ, ফাইন্যান্স অফিসার ও মডারেটরদের কেন্দ্রীয় নিয়ন্ত্রণ, ভূমিকা নির্ধারণ এবং নিরাপত্তা অডিট।'
                : 'Master role-based governance: Discover all database roles, provision isolated station credentials, enforce granular permissions, and track immutable audit logs.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={loadUsers}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition border border-white/15 cursor-pointer disabled:opacity-60 shadow-xs"
              title="Refresh users authoritatively from Supabase"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? (language === 'bn' ? 'সিঙ্ক হচ্ছে...' : 'Syncing...') : (language === 'bn' ? 'রিফ্রেশ' : 'Refresh Data')}</span>
            </button>

            <button
              type="button"
              onClick={() => handleOpenCreateForCategory('STAFF')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black transition cursor-pointer shadow-lg shadow-indigo-600/30 active:scale-95"
            >
              <UserPlus className="w-4 h-4" />
              <span>{language === 'bn' ? '+ নতুন অ্যাকাউন্ট তৈরি' : '+ Create New User'}</span>
            </button>
          </div>
        </div>

        {/* Global Summary Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10">
          <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Users</span>
            <span className="text-xl font-mono font-black text-white">{users.length}</span>
          </div>
          <div className="bg-emerald-500/10 rounded-2xl p-3 border border-emerald-500/20">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">Active Accounts</span>
            <span className="text-xl font-mono font-black text-emerald-300">
              {users.filter((u) => u.status === 'ACTIVE').length}
            </span>
          </div>
          <div className="bg-amber-500/10 rounded-2xl p-3 border border-amber-500/20">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block">Inactive / Locked</span>
            <span className="text-xl font-mono font-black text-amber-300">
              {users.filter((u) => u.status === 'INACTIVE').length}
            </span>
          </div>
          <div className="bg-rose-500/10 rounded-2xl p-3 border border-rose-500/20">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 block">Suspended</span>
            <span className="text-xl font-mono font-black text-rose-300">
              {users.filter((u) => u.status === 'SUSPENDED').length}
            </span>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {feedbackNotice && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between text-xs font-bold transition shadow-sm ${
            feedbackNotice.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : feedbackNotice.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : 'bg-indigo-50 border-indigo-200 text-indigo-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackNotice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : feedbackNotice.type === 'error' ? (
              <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-indigo-600 shrink-0" />
            )}
            <span>{feedbackNotice.message}</span>
          </div>
          <button
            onClick={() => setFeedbackNotice(null)}
            className="p-1 rounded hover:bg-black/5 text-slate-500 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. SEPARATE ROLE-BASED BOXES (Dynamic Cards)                              */}
      {/* ========================================================================= */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600" />
            <h3 className="text-lg font-black text-slate-900">
              {language === 'bn' ? 'ভূমিকাভিত্তিক সিস্টেম কার্ডসমূহ' : 'Role-Based User Classification'}
            </h3>
          </div>
          <span className="text-xs font-bold text-slate-400">
            {roleGroups.length} {language === 'bn' ? 'টি ক্যাটাগরি আবিষ্কৃত' : 'Discovered Categories'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {roleGroups.map((group) => {
            const isSelected = selectedRoleCategory === group.category;
            return (
              <div
                key={group.category}
                className={`bg-white rounded-3xl p-6 border transition-all duration-200 shadow-xs flex flex-col justify-between space-y-4 hover:shadow-md ${
                  isSelected ? 'ring-2 ring-indigo-600 border-indigo-600' : 'border-slate-200'
                }`}
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className={`p-2.5 rounded-2xl ${group.accentBg} ${group.accentBorder} border`}>
                        {getCategoryIcon(group.category)}
                      </div>
                      <div>
                        <h4 className="text-base font-black text-slate-900">{group.titleEn}</h4>
                        <span className="text-xs text-slate-500 font-medium">{group.titleBn}</span>
                      </div>
                    </div>
                    <span
                      className={`text-xs font-mono font-black px-2.5 py-1 rounded-full ${group.badgeBg} ${group.badgeText}`}
                    >
                      {group.totalAccounts} Users
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 font-medium mt-2 leading-relaxed min-h-[36px]">
                    {group.descriptionEn}
                  </p>

                  {/* Account Metrics Counter */}
                  <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-slate-100 text-center">
                    <div className="bg-slate-50 rounded-xl p-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Active</span>
                      <span className="text-sm font-mono font-black text-emerald-600">
                        {group.activeAccounts}
                      </span>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Inactive</span>
                      <span className="text-sm font-mono font-black text-amber-600">
                        {group.inactiveAccounts}
                      </span>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Suspended</span>
                      <span className="text-sm font-mono font-black text-rose-600">
                        {group.suspendedAccounts}
                      </span>
                    </div>
                  </div>

                  {/* Discovered Sub-Roles Tags */}
                  {group.subRoles.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5 items-center">
                      <span className="text-[10px] font-bold text-slate-400">Roles:</span>
                      {group.subRoles.map((r) => (
                        <span
                          key={r}
                          className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700"
                        >
                          {r}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Card Action Buttons */}
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => handleOpenCreateForCategory(group.category)}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Create User</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectRoleBox(group.category)}
                    className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-black transition cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700'
                    }`}
                  >
                    <span>View All Users</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. CENTRALIZED SEARCH & ADVANCED FILTERS BAR                              */}
      {/* ========================================================================= */}
      <div id="unified-users-table" className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <Search className="w-5 h-5 text-indigo-600" />
            <h3 className="text-base font-black text-slate-900">
              {language === 'bn' ? 'সেন্ট্রাল ইউজার সার্চ ও ফিল্টারিং' : 'Centralized User Directory & Actions'}
            </h3>
          </div>

          {(selectedRoleCategory !== 'ALL' ||
            selectedStatus !== 'ALL' ||
            selectedDepartment !== 'ALL' ||
            selectedUserType !== 'ALL' ||
            searchQuery) && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedRoleCategory('ALL');
                setSelectedStatus('ALL');
                setSelectedDepartment('ALL');
                setSelectedUserType('ALL');
              }}
              className="text-xs font-bold text-rose-600 hover:text-rose-700 cursor-pointer flex items-center gap-1"
            >
              ✕ Reset All Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search Box */}
          <div className="sm:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, username, email, ID, station..."
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
            />
          </div>

          {/* Role Category Filter */}
          <div>
            <select
              value={selectedRoleCategory}
              onChange={(e) => setSelectedRoleCategory(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-bold focus:outline-hidden"
            >
              <option value="ALL">All Role Categories</option>
              <option value="SUPER_ADMIN">Super Admins</option>
              <option value="ADMIN">Admins</option>
              <option value="STAFF">Station Staff</option>
              <option value="FINANCE">Finance Users</option>
              <option value="MANAGER">Managers & Desks</option>
              <option value="CUSTOM">Custom Roles</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-bold focus:outline-hidden"
            >
              <option value="ALL">All Account Status</option>
              <option value="ACTIVE">ACTIVE (Authorized)</option>
              <option value="INACTIVE">INACTIVE (Locked)</option>
              <option value="SUSPENDED">SUSPENDED</option>
            </select>
          </div>

          {/* Department Filter */}
          <div>
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-bold focus:outline-hidden"
            >
              <option value="ALL">All Departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 4. INDIVIDUAL USER MANAGEMENT TABLE                                      */}
        {/* ========================================================================= */}
        <div className="pt-2">
          {filteredUsers.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-3">
              <Users className="w-10 h-10 mx-auto text-slate-300" />
              <p className="text-sm font-bold">No system users found matching your active query criteria.</p>
            </div>
          ) : (
            <>
              {/* Desktop View */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                      <th className="py-3 px-4">User Details</th>
                      <th className="py-3 px-4">Role & Category</th>
                      <th className="py-3 px-4">Department & Station</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4">Created Date</th>
                      <th className="py-3 px-4">Last Login</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginate(filteredUsers, currentPage, pageSize).map((u) => {
                      return (
                        <tr key={`${u.userType}-${u.id}`} className="hover:bg-slate-50/80 transition-colors">
                          {/* User Details */}
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                              <span>{u.fullName}</span>
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-normal">
                                {u.userType}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                              <span className="font-mono text-slate-400">ID: {u.id}</span>
                              <span>•</span>
                              <span>@{u.username}</span>
                            </div>
                            <div className="text-[11px] text-slate-600 flex items-center gap-1 mt-0.5">
                              <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="font-mono">{u.email}</span>
                            </div>
                          </td>

                          {/* Role & Category */}
                          <td className="py-3.5 px-4">
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              {u.role}
                            </span>
                            <span className="block text-[10px] uppercase font-bold text-slate-400 mt-1">
                              {u.roleCategory}
                            </span>
                          </td>

                          {/* Department & Station */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5 font-bold text-slate-700">
                              <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>{u.department}</span>
                            </div>
                            <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5">
                              <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>{u.assignedStation}</span>
                            </div>
                          </td>

                          {/* Status Badge */}
                          <td className="py-3.5 px-4 text-center">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                u.status === 'ACTIVE'
                                  ? 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300'
                                  : u.status === 'SUSPENDED'
                                  ? 'bg-rose-100 text-rose-800 ring-1 ring-rose-300'
                                  : 'bg-amber-100 text-amber-800 ring-1 ring-amber-300'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  u.status === 'ACTIVE'
                                    ? 'bg-emerald-600'
                                    : u.status === 'SUSPENDED'
                                    ? 'bg-rose-600'
                                    : 'bg-amber-600'
                                }`}
                              />
                              {u.status}
                            </span>
                          </td>

                          {/* Created Date */}
                          <td className="py-3.5 px-4 whitespace-nowrap text-[11px] text-slate-500 font-mono">
                            {formatDhakaDateTime(u.createdAt)}
                          </td>

                          {/* Last Login */}
                          <td className="py-3.5 px-4 whitespace-nowrap text-[11px] font-mono text-slate-600">
                            {formatDhakaDateTime(u.lastLoginAt)}
                          </td>

                          {/* Action Menu */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              {/* Edit Profile */}
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(u)}
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                                title="Edit Account & Permissions"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              {/* Reset Password */}
                              <button
                                type="button"
                                onClick={() => handleResetPassword(u)}
                                className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition cursor-pointer"
                                title="Reset User Password"
                              >
                                <Key className="w-3.5 h-3.5" />
                              </button>

                              {/* Status Toggle Button (Active <-> Inactive) */}
                              {u.status === 'ACTIVE' ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setStatusConfirmUser({
                                      user: u,
                                      targetStatus: 'INACTIVE',
                                    })
                                  }
                                  className="px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 text-[10px] font-bold border border-amber-200 cursor-pointer"
                                  title="Deactivate account (locks sessions)"
                                >
                                  Deactivate
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setStatusConfirmUser({
                                      user: u,
                                      targetStatus: 'ACTIVE',
                                    })
                                  }
                                  className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-200 cursor-pointer"
                                  title="Activate and unlock account"
                                >
                                  Activate
                                </button>
                              )}

                              {/* Suspend / Restore Button */}
                              {u.status === 'SUSPENDED' ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setStatusConfirmUser({
                                      user: u,
                                      targetStatus: 'ACTIVE',
                                    })
                                  }
                                  className="px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 text-[10px] font-bold border border-blue-200 cursor-pointer"
                                  title="Restore suspended account"
                                >
                                  Restore
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setStatusConfirmUser({
                                      user: u,
                                      targetStatus: 'SUSPENDED',
                                    })
                                  }
                                  className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 text-[10px] font-bold border border-rose-200 cursor-pointer"
                                  title="Suspend account"
                                >
                                  Suspend
                                </button>
                              )}

                              {/* View Activity / Audit Trail */}
                              <button
                                type="button"
                                onClick={() => handleOpenActivityHistory(u)}
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                                title="View Security Activity & Audit History"
                              >
                                <Activity className="w-3.5 h-3.5 text-slate-600" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View (< 1024px) */}
              <div className="lg:hidden space-y-3">
                {paginate(filteredUsers, currentPage, pageSize).map((u) => (
                  <div
                    key={`mobile-${u.userType}-${u.id}`}
                    className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{u.fullName}</h4>
                        <div className="text-xs text-slate-500 font-mono">@{u.username} • {u.id}</div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          u.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : u.status === 'SUSPENDED'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {u.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-white p-2.5 rounded-xl border border-slate-200">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">Role</span>
                        <span className="font-mono font-bold text-indigo-700">{u.role}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">Department</span>
                        <span className="font-medium text-slate-800">{u.department}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">Station</span>
                        <span className="font-medium text-slate-700">{u.assignedStation}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-200">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(u)}
                        className="px-3 py-1.5 rounded-xl bg-slate-200 text-slate-800 text-xs font-bold"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleResetPassword(u)}
                        className="px-3 py-1.5 rounded-xl bg-indigo-100 text-indigo-800 text-xs font-bold"
                      >
                        Reset Pwd
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setStatusConfirmUser({
                            user: u,
                            targetStatus: u.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
                          })
                        }
                        className="px-3 py-1.5 rounded-xl bg-slate-800 text-white text-xs font-bold"
                      >
                        {u.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              <div className="pt-4">
                <GlobalPagination
                  currentPage={currentPage}
                  totalRecords={filteredUsers.length}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={setPageSize}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. MODAL: PROVISION NEW SYSTEM USER                                      */}
      {/* ========================================================================= */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Provision New System User</h3>
                  <p className="text-xs text-slate-500">Configure role-isolated system credentials</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              {/* User Type Switcher */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">USER ARCHITECTURE TYPE *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCreateForm({ ...createForm, userType: 'STAFF', role: 'GATE_STAFF' })}
                    className={`py-2 px-3 rounded-xl font-bold border transition ${
                      createForm.userType === 'STAFF'
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    Station Staff Account
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreateForm({ ...createForm, userType: 'ADMIN', role: 'admin' })}
                    className={`py-2 px-3 rounded-xl font-bold border transition ${
                      createForm.userType === 'ADMIN'
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    Administrative Portal Account
                  </button>
                </div>
              </div>

              {/* Full Name & Username */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">FULL NAME *</label>
                  <input
                    type="text"
                    required
                    value={createForm.fullName}
                    onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
                    placeholder="e.g. Tanvir Hasan"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-semibold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">USERNAME *</label>
                  <input
                    type="text"
                    required
                    value={createForm.username}
                    onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                    placeholder="e.g. gate1"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono font-semibold"
                  />
                </div>
              </div>

              {/* Email & Auth User ID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">EMAIL ADDRESS *</label>
                  <input
                    type="email"
                    required
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                    placeholder="e.g. staff@plscf.edu.bd"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono font-semibold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">SUPABASE AUTH USER ID (UUID)</label>
                  <input
                    type="text"
                    value={createForm.authUserId}
                    onChange={(e) => setCreateForm({ ...createForm, authUserId: e.target.value })}
                    placeholder="UID from Supabase Auth > Users"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono font-medium text-[11px]"
                  />
                </div>
              </div>

              {/* Role & Department */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">ASSIGNED ROLE *</label>
                  {createForm.userType === 'ADMIN' ? (
                    <select
                      value={createForm.role}
                      onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold"
                    >
                      <option value="super_admin">Super Administrator</option>
                      <option value="admin">Administrator</option>
                      <option value="finance_manager">Finance Manager</option>
                      <option value="moderator">System Moderator</option>
                      <option value="registration_officer">Registration Officer</option>
                      <option value="committee_member">Committee Member</option>
                    </select>
                  ) : (
                    <select
                      value={createForm.role}
                      onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold"
                    >
                      <option value="GATE_STAFF">Gate Staff (Entry & Exit)</option>
                      <option value="BREAKFAST_STAFF">Breakfast Staff</option>
                      <option value="LUNCH_STAFF">Lunch Staff</option>
                      <option value="DINNER_STAFF">Dinner Staff</option>
                      <option value="DRESS_STAFF">Dress & Gift Kit Staff</option>
                      <option value="FINANCE_STAFF">Finance & Treasury Staff</option>
                      <option value="SUPER_ADMIN">Super Admin (Operational)</option>
                    </select>
                  )}
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">DEPARTMENT / MODULE *</label>
                  <input
                    type="text"
                    required
                    value={createForm.department}
                    onChange={(e) => setCreateForm({ ...createForm, department: e.target.value })}
                    placeholder="e.g. GATE, FINANCE, OPERATIONS"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold"
                  />
                </div>
              </div>

              {/* Station */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">ASSIGNED STATION / BOOTH</label>
                <input
                  type="text"
                  value={createForm.assignedStation}
                  onChange={(e) => setCreateForm({ ...createForm, assignedStation: e.target.value })}
                  placeholder="e.g. Gate 01 - Main Entrance"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-semibold"
                />
              </div>

              {/* Notice */}
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Passwords are authenticated securely via Supabase Auth. Enter the user's Auth UID if already created, or invite them via email.
                </span>
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black shadow-md cursor-pointer disabled:opacity-60"
                >
                  {isSubmitting ? 'Creating...' : 'Confirm Account Creation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. MODAL: EDIT USER & PERMISSIONS                                        */}
      {/* ========================================================================= */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Edit User & Role Privileges</h3>
                  <p className="text-xs text-slate-500 font-mono">ID: {editingUser.id} ({editingUser.userType})</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">FULL NAME</label>
                <input
                  type="text"
                  required
                  value={editForm.fullName}
                  onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-semibold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">USERNAME</label>
                  <input
                    type="text"
                    required
                    value={editForm.username}
                    onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono font-semibold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">EMAIL ADDRESS</label>
                  <input
                    type="email"
                    required
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">ASSIGNED ROLE</label>
                  <input
                    type="text"
                    required
                    value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">DEPARTMENT</label>
                  <input
                    type="text"
                    required
                    value={editForm.department}
                    onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">ASSIGNED STATION / LOCATION</label>
                <input
                  type="text"
                  value={editForm.assignedStation}
                  onChange={(e) => setEditForm({ ...editForm, assignedStation: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-semibold"
                />
              </div>

              {/* Granular Permissions Checkboxes */}
              <div>
                <label className="font-bold text-slate-700 block mb-2">GRANULAR PERMISSIONS</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['VIEW', 'SCAN', 'VERIFY', 'APPROVE', 'REJECT', 'EXPORT', 'MANAGE'] as StaffPermissionAction[]).map(
                    (perm) => {
                      const isChecked = editForm.permissions.includes(perm);
                      return (
                        <label
                          key={perm}
                          className={`p-2 rounded-xl border flex items-center gap-2 cursor-pointer transition ${
                            isChecked
                              ? 'bg-indigo-50 border-indigo-300 text-indigo-900 font-bold'
                              : 'bg-slate-50 border-slate-200 text-slate-600'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setEditForm({ ...editForm, permissions: [...editForm.permissions, perm] });
                              } else {
                                setEditForm({
                                  ...editForm,
                                  permissions: editForm.permissions.filter((p) => p !== perm),
                                });
                              }
                            }}
                            className="rounded text-indigo-600"
                          />
                          <span className="text-xs">{perm}</span>
                        </label>
                      );
                    }
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black shadow-md cursor-pointer disabled:opacity-60"
                >
                  {isSubmitting ? 'Saving...' : 'Save Profile Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. MODAL: STATUS CHANGE CONFIRMATION (REASON REQUIRED)                   */}
      {/* ========================================================================= */}
      {statusConfirmUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                  statusConfirmUser.targetStatus === 'ACTIVE'
                    ? 'bg-emerald-100 text-emerald-700'
                    : statusConfirmUser.targetStatus === 'SUSPENDED'
                    ? 'bg-rose-100 text-rose-700'
                    : 'bg-amber-100 text-amber-700'
                }`}
              >
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Confirm Account Status Transition
                </h3>
                <p className="text-xs text-slate-500">
                  Target state: <strong className="font-mono">{statusConfirmUser.targetStatus}</strong>
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to transition account{' '}
              <strong>"{statusConfirmUser.user.fullName}"</strong> (Role: {statusConfirmUser.user.role}) to{' '}
              <strong>{statusConfirmUser.targetStatus}</strong>? Active authentication sessions will be immediately revoked.
            </p>

            <div>
              <label className="font-bold text-slate-700 block mb-1 text-xs">
                MANDATORY AUDIT REASON *
              </label>
              <textarea
                rows={2}
                required
                value={statusChangeReason}
                onChange={(e) => setStatusChangeReason(e.target.value)}
                placeholder="State the administrative reason for this action..."
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setStatusConfirmUser(null);
                  setStatusChangeReason('');
                }}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting || !statusChangeReason.trim()}
                onClick={handleConfirmStatusChange}
                className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-black text-white font-black text-xs shadow-md cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? 'Updating...' : 'Execute Status Transition'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 8. MODAL: USER SECURITY ACTIVITY & AUDIT HISTORY                         */}
      {/* ========================================================================= */}
      {activityHistoryUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 max-h-[85vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Security & Activity Audit History</h3>
                  <p className="text-xs text-slate-500 font-mono">User: {activityHistoryUser.fullName} ({activityHistoryUser.id})</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActivityHistoryUser(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isLoadingLogs ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-600" />
                <p className="text-xs font-bold">Querying immutable audit logs from database...</p>
              </div>
            ) : activityLogs.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <Clock className="w-8 h-8 mx-auto text-slate-300" />
                <p className="text-xs font-bold">No historical security actions recorded for this account yet.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {activityLogs.map((log) => (
                  <div key={log.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                        {log.action}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {formatDhakaDateTime(log.created_at)}
                      </span>
                    </div>
                    <p className="text-slate-700 font-medium">{log.details}</p>
                    <div className="flex items-center gap-3 text-[10px] text-slate-400 font-mono pt-0.5">
                      <span>Officer: {log.admin_username}</span>
                      <span>•</span>
                      <span>Target: {log.target_id}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActivityHistoryUser(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold"
              >
                Close Audit View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
