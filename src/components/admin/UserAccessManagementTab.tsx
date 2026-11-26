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
  Lock,
  RefreshCw,
  Search,
  Clock,
  Activity,
  CheckCircle2,
  XCircle,
  Crown,
  DollarSign,
  Layers,
  ChevronRight,
  Edit2,
  X,
  Mail,
  Building,
  MapPin,
  Eye,
  EyeOff,
  Phone,
  Copy,
  Check,
  LogOut,
  UserCheck,
  Wand2,
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
  const isSuperAdmin = String(currentAdmin?.role || '').toLowerCase() === 'super_admin';

  // State
  const [users, setUsers] = useState<UnifiedSystemUser[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [feedbackNotice, setFeedbackNotice] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // One-time ephemeral credential handoff display (NEVER persisted to storage/DB/audit logs)
  const [oneTimeCredentials, setOneTimeCredentials] = useState<{
    title: string;
    fullName: string;
    userId: string;
    staffCode?: string;
    role: string;
    username: string;
    email: string;
    temporaryPassword: string;
    assignedManagerName?: string | null;
    status: string;
    mustChangePassword: boolean;
  } | null>(null);
  const [copiedCredentials, setCopiedCredentials] = useState(false);

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

  // Password Management State
  const [passwordModalUser, setPasswordModalUser] = useState<UnifiedSystemUser | null>(null);
  const [directNewPassword, setDirectNewPassword] = useState('');
  const [directConfirmPassword, setDirectConfirmPassword] = useState('');
  const [directMustChangePassword, setDirectMustChangePassword] = useState(true);
  const [showDirectPassword, setShowDirectPassword] = useState(false);
  const [isPasswordSubmitting, setIsPasswordSubmitting] = useState(false);

  // Secure random temporary password helper (never persisted outside component state)
  const generateTempPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#$%';
    let pw = 'Plsc@';
    for (let i = 0; i < 6; i++) {
      pw += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pw;
  };

  // Helper to generate RFC4122 compliant UUIDv4
  const generateUuid = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };

  // Create Form State & Conditional Controls
  const [selectedCreateCategory, setSelectedCreateCategory] = useState<RoleCategory>('ADMIN');
  const [customModelLabel, setCustomModelLabel] = useState('Admin 1');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [financeTier, setFinanceTier] = useState<'MANAGER' | 'STAFF'>('MANAGER');

  const [createForm, setCreateForm] = useState({
    userType: 'ADMIN' as UserType,
    fullName: '',
    username: '',
    email: '',
    mobileNumber: '',
    staffCode: '',
    assignedManagerId: '',
    initialStatus: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
    mustChangePassword: true,
    role: 'admin',
    department: 'CENTRAL_ADMIN',
    assignedStation: 'Admin 1',
    permissions: ['VIEW', 'VERIFY', 'APPROVE', 'EXPORT'] as StaffPermissionAction[],
    authUserId: '',
    initialPassword: '',
  });
  const [showCreatePassword, setShowCreatePassword] = useState(false);

  // Edit Form State
  const [editForm, setEditForm] = useState({
    fullName: '',
    username: '',
    email: '',
    mobileNumber: '',
    staffCode: '',
    assignedManagerId: '',
    role: '',
    department: '',
    assignedStation: '',
    permissions: [] as StaffPermissionAction[],
  });
  const [editPassword, setEditPassword] = useState('');
  const [confirmEditPassword, setConfirmEditPassword] = useState('');
  const [showEditPassword, setShowEditPassword] = useState(false);

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

  // Compute Finance Managers eligible to supervise Finance Staff
  const financeManagers = useMemo(() => {
    return users.filter(
      (u) =>
        u.userType === 'ADMIN' &&
        (u.role.toLowerCase() === 'finance_manager' || u.role.toLowerCase() === 'super_admin')
    );
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
        (u.mobileNumber || '').toLowerCase().includes(q) ||
        (u.staffCode || '').toLowerCase().includes(q) ||
        (u.assignedManagerName || '').toLowerCase().includes(q) ||
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

  // Switch Category inside Provisioning Modal
  const handleSwitchCategory = (cat: RoleCategory) => {
    if (cat === 'SUPER_ADMIN') {
      showNotification('error', 'Super Admin account creation is permanently locked.');
      return;
    }
    setSelectedCreateCategory(cat);
    const newUUID = generateUuid();

    if (cat === 'ADMIN') {
      const nextNum = users.filter((u) => u.roleCategory === 'ADMIN').length + 1;
      const label = `Admin ${nextNum}`;
      setCustomModelLabel(label);
      setCreateForm((prev) => ({
        ...prev,
        userType: 'ADMIN',
        role: 'admin',
        department: 'CENTRAL_ADMIN',
        assignedStation: label,
        authUserId: newUUID,
        permissions: ['VIEW', 'VERIFY', 'APPROVE', 'EXPORT'],
      }));
    } else if (cat === 'STAFF') {
      setCreateForm((prev) => ({
        ...prev,
        userType: 'STAFF',
        role: 'GATE_STAFF',
        department: 'GATE',
        assignedStation: 'Gate 01 - Main Entrance Checkpoint',
        authUserId: newUUID,
        permissions: ['VIEW', 'SCAN', 'VERIFY', 'APPROVE'],
      }));
    } else if (cat === 'FINANCE') {
      if (financeTier === 'MANAGER') {
        setCreateForm((prev) => ({
          ...prev,
          userType: 'ADMIN',
          role: 'finance_manager',
          department: 'FINANCE',
          assignedStation: 'Central Finance Oversight Office',
          authUserId: newUUID,
          permissions: ['VIEW', 'APPROVE', 'EXPORT', 'MANAGE'],
        }));
      } else {
        setCreateForm((prev) => ({
          ...prev,
          userType: 'STAFF',
          role: 'FINANCE_STAFF',
          department: 'FINANCE',
          assignedStation: 'On-Site Finance & Cash Counter',
          authUserId: newUUID,
          permissions: ['VIEW', 'SCAN', 'VERIFY'],
        }));
      }
    }
  };

  // Staff Daily Operational Role Switcher
  const handleStaffRoleChange = (role: string) => {
    let station = 'Operational Station';
    let dept = 'OPERATIONS';
    switch (role) {
      case 'GATE_STAFF':
        station = 'Gate 01 - Main Entrance Checkpoint';
        dept = 'GATE';
        break;
      case 'BREAKFAST_STAFF':
        station = 'Breakfast Station - Food Counter A';
        dept = 'FOOD';
        break;
      case 'LUNCH_STAFF':
        station = 'Lunch Dining Pavilion - Counter 01';
        dept = 'FOOD';
        break;
      case 'DINNER_STAFF':
        station = 'Dinner Banquet Pavilion - Counter 01';
        dept = 'FOOD';
        break;
      case 'DRESS_STAFF':
        station = 'T-Shirt & Souvenir Gift Desk';
        dept = 'DRESS';
        break;
      default:
        station = 'Operational Station';
        dept = 'OPERATIONS';
    }
    setCreateForm((prev) => ({
      ...prev,
      role,
      department: dept,
      assignedStation: station,
    }));
  };

  // Finance Tier Switcher (Manager vs Staff)
  const handleFinanceTierChange = (tier: 'MANAGER' | 'STAFF') => {
    setFinanceTier(tier);
    if (tier === 'MANAGER') {
      setCreateForm((prev) => ({
        ...prev,
        userType: 'ADMIN',
        role: 'finance_manager',
        department: 'FINANCE',
        assignedStation: 'Central Finance Oversight Office',
        permissions: ['VIEW', 'APPROVE', 'EXPORT', 'MANAGE'],
      }));
    } else {
      setCreateForm((prev) => ({
        ...prev,
        userType: 'STAFF',
        role: 'FINANCE_STAFF',
        department: 'FINANCE',
        assignedStation: 'On-Site Finance & Cash Counter',
        permissions: ['VIEW', 'SCAN', 'VERIFY'],
      }));
    }
  };

  // Open Create Modal for specific category
  const handleOpenCreateForCategory = (category: RoleCategory) => {
    if (category === 'SUPER_ADMIN') {
      showNotification('error', 'Super Admin account creation is permanently locked.');
      return;
    }
    setSelectedCreateCategory(category);
    const newUUID = generateUuid();
    setConfirmPassword('');
    setShowCreatePassword(false);
    setShowConfirmPassword(false);

    let defaultRole = 'GATE_STAFF';
    let defaultType: UserType = 'STAFF';
    let defaultDept = 'GATE';
    let defaultStation = 'Gate 01 - Main Entrance Checkpoint';

    if (category === 'ADMIN') {
      const nextNum = users.filter((u) => u.roleCategory === 'ADMIN').length + 1;
      const label = `Admin ${nextNum}`;
      setCustomModelLabel(label);
      defaultRole = 'admin';
      defaultType = 'ADMIN';
      defaultDept = 'CENTRAL_ADMIN';
      defaultStation = label;
    } else if (category === 'FINANCE') {
      setFinanceTier('MANAGER');
      defaultRole = 'finance_manager';
      defaultType = 'ADMIN';
      defaultDept = 'FINANCE';
      defaultStation = 'Central Finance Oversight Office';
    } else {
      defaultRole = 'GATE_STAFF';
      defaultType = 'STAFF';
      defaultDept = 'GATE';
      defaultStation = 'Gate 01 - Main Entrance Checkpoint';
    }

    setCreateForm({
      userType: defaultType,
      fullName: '',
      username: '',
      email: '',
      mobileNumber: '',
      staffCode: '',
      assignedManagerId:
        financeManagers.find((m) => m.role.toLowerCase() === 'finance_manager')?.id ||
        financeManagers[0]?.id ||
        '',
      initialStatus: 'ACTIVE',
      mustChangePassword: true,
      role: defaultRole,
      department: defaultDept,
      assignedStation: defaultStation,
      permissions: ['VIEW', 'SCAN', 'VERIFY', 'APPROVE'],
      authUserId: newUUID,
      initialPassword: '',
    });
    setIsCreateModalOpen(true);
  };

  // Execute Create User
  const handleCreateSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();

    if (!isSuperAdmin) {
      showNotification('error', 'UNAUTHORIZED: Only Super Admin can create accounts.');
      return;
    }

    if (!createForm.fullName.trim() || !createForm.username.trim()) {
      showNotification('error', 'Please fill in Full Name and Login ID / Username.');
      return;
    }

    if (selectedCreateCategory === 'FINANCE' && !createForm.mobileNumber.trim()) {
      showNotification('error', 'Please provide a Mobile Number for Finance personnel.');
      return;
    }

    if (
      selectedCreateCategory === 'FINANCE' &&
      financeTier === 'STAFF' &&
      !createForm.assignedManagerId.trim()
    ) {
      showNotification('error', 'Please assign this Finance Staff member to a Finance Manager.');
      return;
    }

    if (!createForm.initialPassword || createForm.initialPassword.trim().length < 6) {
      showNotification('error', 'Password must be at least 6 characters long.');
      return;
    }

    if (createForm.initialPassword !== confirmPassword) {
      showNotification('error', 'Passwords do not match. Please verify both password fields.');
      return;
    }

    const cleanUsername = createForm.username.trim().toLowerCase().replace(/^@/, '');
    const cleanEmail = createForm.email.trim()
      ? createForm.email.trim().toLowerCase()
      : `${cleanUsername}@plscf.edu.bd`;

    let finalRole = createForm.role;
    let finalDept = createForm.department;
    let finalStation = createForm.assignedStation;
    let finalType: UserType = createForm.userType;
    let finalPermissions = createForm.permissions;

    if (selectedCreateCategory === 'SUPER_ADMIN') {
      finalType = 'ADMIN';
      finalRole = 'super_admin';
      finalDept = 'CENTRAL_ADMIN';
      finalStation = customModelLabel.trim() || 'Super Admin 1';
      finalPermissions = ['VIEW', 'SCAN', 'VERIFY', 'APPROVE', 'EXPORT', 'MANAGE'];
    } else if (selectedCreateCategory === 'ADMIN') {
      finalType = 'ADMIN';
      finalRole = 'admin';
      finalDept = 'CENTRAL_ADMIN';
      finalStation = customModelLabel.trim() || 'Admin 1';
      finalPermissions = ['VIEW', 'VERIFY', 'APPROVE', 'EXPORT'];
    } else if (selectedCreateCategory === 'STAFF') {
      finalType = 'STAFF';
      finalRole = createForm.role;
      finalStation = createForm.assignedStation;
    } else if (selectedCreateCategory === 'FINANCE') {
      if (financeTier === 'MANAGER') {
        finalType = 'ADMIN';
        finalRole = 'finance_manager';
        finalDept = 'FINANCE';
        finalStation = 'Central Finance Oversight Office';
        finalPermissions = ['VIEW', 'APPROVE', 'EXPORT', 'MANAGE'];
      } else {
        finalType = 'STAFF';
        finalRole = 'FINANCE_STAFF';
        finalDept = 'FINANCE';
        finalStation = 'On-Site Finance & Cash Counter';
        finalPermissions = ['VIEW', 'SCAN', 'VERIFY'];
      }
    }

    const rawTempPassword = createForm.initialPassword.trim();
    const assignedMgrId =
      finalRole === 'FINANCE_STAFF' ? createForm.assignedManagerId.trim() : undefined;

    setIsSubmitting(true);
    try {
      const res = await UserManagementService.createSystemUser(
        {
          userType: finalType,
          fullName: createForm.fullName.trim(),
          username: cleanUsername,
          email: cleanEmail,
          role: finalRole,
          department: finalDept,
          assignedStation: finalStation,
          permissions: finalPermissions,
          authUserId: createForm.authUserId || undefined,
          initialPassword: rawTempPassword,
          mobileNumber: createForm.mobileNumber.trim() || undefined,
          staffCode: createForm.staffCode.trim() || undefined,
          assignedManagerId: assignedMgrId,
          initialStatus: createForm.initialStatus,
          mustChangePassword: createForm.mustChangePassword,
        },
        currentAdmin
      );

      if (res.success) {
        showNotification(
          'success',
          `Successfully provisioned ${finalRole} "${createForm.fullName}" (${res.userId})! Credentials set securely in Supabase Auth.`
        );
        setIsCreateModalOpen(false);
        setCopiedCredentials(false);
        setOneTimeCredentials({
          title: 'Account Created — Share Login Credentials Securely',
          fullName: createForm.fullName.trim(),
          userId: res.userId || '',
          staffCode: res.staffCode || createForm.staffCode.trim() || res.userId,
          role: finalRole,
          username: cleanUsername,
          email: cleanEmail,
          temporaryPassword: rawTempPassword,
          assignedManagerName: res.assignedManagerName || null,
          status: res.status || createForm.initialStatus,
          mustChangePassword: Boolean(res.mustChangePassword ?? createForm.mustChangePassword),
        });

        // Immediate real-time database and portal event dispatch
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('plscf_user_management_sync'));
          window.dispatchEvent(new CustomEvent('plscf_staff_sync'));
          window.dispatchEvent(new CustomEvent('plscf_admin_sync'));
        }

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
    if (UserManagementService.isProtectedSuperAdminTarget(user)) {
      showNotification('error', 'Super Admin ID and profile are permanently locked.');
      return;
    }
    setEditingUser(user);
    setEditForm({
      fullName: user.fullName,
      username: user.username,
      email: user.email,
      mobileNumber: user.mobileNumber || '',
      staffCode: user.staffCode || '',
      assignedManagerId: user.assignedManagerId || '',
      role: user.role,
      department: user.department,
      assignedStation: user.assignedStation,
      permissions: user.permissions || [],
    });
    setEditPassword('');
    setConfirmEditPassword('');
    setShowEditPassword(false);
  };

  // Execute Edit User
  const handleEditSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!editingUser || !isSuperAdmin) return;

    if (
      editingUser.userType === 'STAFF' &&
      editForm.role.toUpperCase() === 'FINANCE_STAFF' &&
      !editForm.assignedManagerId.trim()
    ) {
      showNotification('error', 'Finance Staff must remain assigned to a Finance Manager.');
      return;
    }

    if (editPassword.trim()) {
      if (editPassword.trim().length < 6) {
        showNotification('error', 'New password must be at least 6 characters long.');
        return;
      }
      if (editPassword !== confirmEditPassword) {
        showNotification('error', 'New passwords do not match.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const res = await UserManagementService.updateUserProfile(
        editingUser.id,
        editingUser.userType,
        {
          fullName: editForm.fullName,
          username: editForm.username,
          email: editForm.email,
          mobileNumber: editForm.mobileNumber,
          staffCode: editForm.staffCode,
          assignedManagerId:
            editingUser.userType === 'STAFF' ? editForm.assignedManagerId : undefined,
          role: editForm.role,
          department: editForm.department,
          assignedStation: editForm.assignedStation,
          permissions: editForm.permissions,
        },
        currentAdmin,
        'Profile update via User & Access Management portal'
      );

      if (!res.success) {
        showNotification('error', res.error || 'Failed to update user profile.');
        setIsSubmitting(false);
        return;
      }

      // If new password provided, update directly in Supabase Auth (treated as temporary reset)
      if (editPassword.trim()) {
        const pwRes = await UserManagementService.setUserPassword(
          editForm.email,
          editPassword.trim(),
          currentAdmin,
          true
        );
        if (!pwRes.success) {
          showNotification('error', `Profile saved, but password update failed: ${pwRes.error}`);
          await loadUsers();
          return;
        }
      }

      showNotification(
        'success',
        `Updated profile for "${editForm.fullName}"${editPassword.trim() ? ' and set temporary password (rotation required on next login)' : ''}.`
      );
      setEditingUser(null);
      await loadUsers();
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

  // Open Direct Password Modal
  const handleOpenPasswordModal = (user: UnifiedSystemUser) => {
    if (UserManagementService.isProtectedSuperAdminTarget(user)) {
      showNotification('error', 'Super Admin password cannot be changed.');
      return;
    }
    setPasswordModalUser(user);
    setDirectNewPassword('');
    setDirectConfirmPassword('');
    setDirectMustChangePassword(true);
    setShowDirectPassword(false);
  };

  // Direct Password Update Execution
  const handleExecuteDirectPasswordChange = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!passwordModalUser || !isSuperAdmin) return;
    if (directNewPassword.length < 6) {
      showNotification('error', 'Password must be at least 6 characters long.');
      return;
    }
    if (directNewPassword !== directConfirmPassword) {
      showNotification('error', 'Passwords do not match.');
      return;
    }

    const tempPw = directNewPassword.trim();
    const targetUser = passwordModalUser;

    setIsPasswordSubmitting(true);
    try {
      const res = await UserManagementService.setUserPassword(
        targetUser.email,
        tempPw,
        currentAdmin,
        directMustChangePassword
      );
      if (res.success) {
        showNotification(
          'success',
          `Temporary password set in Supabase Auth for "${targetUser.fullName}". Prior sessions revoked.`
        );
        setPasswordModalUser(null);
        setDirectNewPassword('');
        setDirectConfirmPassword('');
        setCopiedCredentials(false);
        setOneTimeCredentials({
          title: 'Password Reset Complete — Share New Temporary Password',
          fullName: targetUser.fullName,
          userId: targetUser.id,
          staffCode: targetUser.staffCode || targetUser.id,
          role: targetUser.role,
          username: targetUser.username,
          email: targetUser.email,
          temporaryPassword: tempPw,
          assignedManagerName: targetUser.assignedManagerName || null,
          status: targetUser.status,
          mustChangePassword: directMustChangePassword,
        });
        await loadUsers();
      } else {
        showNotification('error', res.error || 'Failed to update user password.');
      }
    } catch (err: any) {
      showNotification('error', err?.message || 'Password update failed.');
    } finally {
      setIsPasswordSubmitting(false);
    }
  };

  // Super Admin session revocation without deactivating account
  const handleRevokeUserSessions = async (user: UnifiedSystemUser) => {
    if (!isSuperAdmin) return;
    if (!window.confirm(`Revoke all active login sessions for ${user.fullName} (@${user.username})?`)) {
      return;
    }
    const res = await UserManagementService.revokeUserSessions(
      user.id,
      user.userType,
      currentAdmin,
      'Manual session revocation by Super Admin'
    );
    if (res.success) {
      showNotification('success', `Revoked active auth sessions for "${user.fullName}".`);
    } else {
      showNotification('error', res.error || 'Unable to revoke user sessions.');
    }
  };

  // Password Reset Trigger via Email
  const handleResetPassword = async (user: UnifiedSystemUser) => {
    if (UserManagementService.isProtectedSuperAdminTarget(user)) {
      showNotification('error', 'Super Admin password reset is disabled.');
      return;
    }
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
      default:
        return <Shield className="w-5 h-5 text-indigo-500" />;
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="bg-white rounded-3xl border border-rose-200 p-8 sm:p-12 text-center space-y-3 shadow-xs">
        <ShieldAlert className="w-10 h-10 text-rose-600 mx-auto" />
        <h3 className="text-lg font-black text-slate-900">Super Admin Access Strictly Required</h3>
        <p className="text-xs text-slate-600 max-w-md mx-auto">
          Only the Super Administrator is authorized to create Finance Manager or Finance Staff accounts, assign managers, modify statuses, or reset passwords.
        </p>
      </div>
    );
  }

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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
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
                            <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5 flex-wrap">
                              <span>{u.fullName}</span>
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-normal">
                                {u.userType}
                              </span>
                              {u.assignedStation && (u.roleCategory === 'SUPER_ADMIN' || u.roleCategory === 'ADMIN') && (
                                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                                  {u.assignedStation}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="font-mono text-slate-500">ID: {u.staffCode || u.id}</span>
                              <span>•</span>
                              <span>@{u.username}</span>
                              {u.mobileNumber && (
                                <>
                                  <span>•</span>
                                  <span className="inline-flex items-center gap-0.5 font-mono text-slate-600">
                                    <Phone className="w-3 h-3 text-slate-400" />
                                    {u.mobileNumber}
                                  </span>
                                </>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-600 flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="font-mono">{u.email}</span>
                              {u.assignedManagerName && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-800 border border-purple-200">
                                  <UserCheck className="w-3 h-3" />
                                  Mgr: {u.assignedManagerName}
                                </span>
                              )}
                              {u.mustChangePassword && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                  Temp PW
                                </span>
                              )}
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
                              {u.roleCategory === 'SUPER_ADMIN' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 text-[10px] font-black border border-amber-200">
                                  <Lock className="w-3 h-3" />
                                  Immutable (Locked)
                                </span>
                              ) : (
                                <>
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
                                    onClick={() => handleOpenPasswordModal(u)}
                                    className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition cursor-pointer"
                                    title="Set / Reset User Password"
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

                                  {/* Revoke Active Auth Sessions */}
                                  <button
                                    type="button"
                                    onClick={() => handleRevokeUserSessions(u)}
                                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 transition cursor-pointer"
                                    title="Revoke Active Login Sessions"
                                  >
                                    <LogOut className="w-3.5 h-3.5" />
                                  </button>
                                </>
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
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-bold text-slate-900 text-sm">{u.fullName}</h4>
                          {u.assignedStation && (u.roleCategory === 'SUPER_ADMIN' || u.roleCategory === 'ADMIN') && (
                            <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                              {u.assignedStation}
                            </span>
                          )}
                        </div>
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
                      {u.roleCategory === 'SUPER_ADMIN' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-50 text-amber-800 text-xs font-black border border-amber-200">
                          <Lock className="w-3.5 h-3.5" />
                          Immutable (Locked)
                        </span>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(u)}
                            className="px-3 py-1.5 rounded-xl bg-slate-200 text-slate-800 text-xs font-bold"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenPasswordModal(u)}
                            className="px-3 py-1.5 rounded-xl bg-indigo-100 text-indigo-800 text-xs font-bold"
                          >
                            Password
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
                        </>
                      )}
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
              {/* Category Selector Tabs */}
              <div>
                <label className="font-bold text-slate-700 block mb-1.5 uppercase text-[10px] tracking-wider">
                  Select User Classification *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-1 bg-slate-100 rounded-2xl">
                  <button
                    type="button"
                    disabled
                    title="Super Admin creation is permanently locked"
                    className="py-2 px-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 bg-slate-200/70 text-slate-400 cursor-not-allowed"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Super Admin (Locked)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSwitchCategory('ADMIN')}
                    className={`py-2 px-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      selectedCreateCategory === 'ADMIN'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-700 hover:bg-white/60'
                    }`}
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span>Admin</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSwitchCategory('STAFF')}
                    className={`py-2 px-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      selectedCreateCategory === 'STAFF'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-700 hover:bg-white/60'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Staff</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSwitchCategory('FINANCE')}
                    className={`py-2 px-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      selectedCreateCategory === 'FINANCE'
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'text-slate-700 hover:bg-white/60'
                    }`}
                  >
                    <DollarSign className="w-3.5 h-3.5" />
                    <span>Finance</span>
                  </button>
                </div>
              </div>

              {/* ================================================================= */}
              {/* CONDITIONAL BRANCH 1: SUPER ADMIN & ADMIN (SIMPLIFIED EXECUTIVE)  */}
              {/* ================================================================= */}
              {(selectedCreateCategory === 'SUPER_ADMIN' || selectedCreateCategory === 'ADMIN') && (
                <div className="space-y-4 pt-1">
                  {/* Category Banner */}
                  <div
                    className={`p-3 rounded-2xl border text-xs flex items-center gap-2.5 ${
                      selectedCreateCategory === 'SUPER_ADMIN'
                        ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                        : 'bg-blue-50/80 border-blue-200 text-blue-900'
                    }`}
                  >
                    {selectedCreateCategory === 'SUPER_ADMIN' ? (
                      <Crown className="w-4 h-4 text-amber-600 shrink-0" />
                    ) : (
                      <Shield className="w-4 h-4 text-blue-600 shrink-0" />
                    )}
                    <div>
                      <span className="font-extrabold block">
                        {selectedCreateCategory === 'SUPER_ADMIN'
                          ? 'Super Administrator Provisioning'
                          : 'System Administrator Provisioning'}
                      </span>
                      <span className="text-[11px] opacity-80">
                        {selectedCreateCategory === 'SUPER_ADMIN'
                          ? 'Full root system privileges, financial authorization, and database audit control.'
                          : 'Administrative operator managing registrations, inquiries, and event oversight.'}
                      </span>
                    </div>
                  </div>

                  {/* Full Name & Custom Model Labeling */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">FULL NAME *</label>
                      <input
                        type="text"
                        required
                        value={createForm.fullName}
                        onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
                        placeholder="e.g. Tanvir Hasan"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-semibold focus:bg-white focus:ring-2 focus:ring-indigo-500 transition"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">
                        CUSTOM MODEL LABELING (e.g. {selectedCreateCategory === 'SUPER_ADMIN' ? 'Super Admin 1' : 'Admin 1'}) *
                      </label>
                      <input
                        type="text"
                        required
                        value={customModelLabel}
                        onChange={(e) => setCustomModelLabel(e.target.value)}
                        placeholder={selectedCreateCategory === 'SUPER_ADMIN' ? 'Super Admin 1' : 'Admin 1'}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition"
                      />
                    </div>
                  </div>

                  {/* Preset Pills */}
                  <div className="flex flex-wrap items-center gap-1.5 -mt-1">
                    <span className="text-[10px] text-slate-400 font-bold">Quick Presets:</span>
                    {(selectedCreateCategory === 'SUPER_ADMIN'
                      ? ['Super Admin 1', 'Super Admin 2', 'Lead Executive', 'Director']
                      : ['Admin 1', 'Admin 2', 'Event Operations Admin', 'Campus Lead']
                    ).map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setCustomModelLabel(preset)}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md border transition cursor-pointer ${
                          customModelLabel === preset
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>

                  {/* Username & Auto-derived Email */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">USERNAME *</label>
                      <input
                        type="text"
                        required
                        value={createForm.username}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCreateForm({
                            ...createForm,
                            username: val,
                            email: val ? `${val.trim().toLowerCase().replace(/^@/, '')}@plscf.edu.bd` : '',
                          });
                        }}
                        placeholder={selectedCreateCategory === 'SUPER_ADMIN' ? 'e.g. superadmin1' : 'e.g. admin1'}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono font-semibold focus:bg-white focus:ring-2 focus:ring-indigo-500 transition"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">SYSTEM AUTH EMAIL (AUTO-MANAGED)</label>
                      <input
                        type="email"
                        value={
                          createForm.email ||
                          (createForm.username
                            ? `${createForm.username.trim().toLowerCase().replace(/^@/, '')}@plscf.edu.bd`
                            : '')
                        }
                        onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                        placeholder="e.g. admin@plscf.edu.bd"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 border border-slate-200 font-mono text-[11px] text-slate-600 focus:bg-white transition"
                      />
                    </div>
                  </div>

                  {/* Auto-Generated Supabase Auth UUID */}
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-700 text-[11px] flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        AUTO-GENERATED SUPABASE AUTH ID (UUID)
                      </span>
                      <button
                        type="button"
                        onClick={() => setCreateForm({ ...createForm, authUserId: generateUuid() })}
                        className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
                        title="Regenerate UUID"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Regenerate</span>
                      </button>
                    </div>
                    <div className="font-mono text-[11px] font-bold text-slate-800 bg-white px-3 py-2 rounded-xl border border-slate-200 select-all flex items-center justify-between">
                      <span>{createForm.authUserId || 'Generating UUID...'}</span>
                      <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-extrabold">
                        UUIDv4
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500">
                      ✓ Generated cryptographically. Department modules and internal database roles are automated.
                    </p>
                  </div>
                </div>
              )}

              {/* ================================================================= */}
              {/* CONDITIONAL BRANCH 2: STAFF (DAILY OPERATIONAL ROLES & PORTAL)     */}
              {/* ================================================================= */}
              {selectedCreateCategory === 'STAFF' && (
                <div className="space-y-4 pt-1">
                  {/* Category Banner */}
                  <div className="p-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 text-emerald-950 text-xs flex items-center gap-2.5">
                    <Users className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div>
                      <span className="font-extrabold block">Daily Operational Staff Account</span>
                      <span className="text-[11px] text-emerald-800">
                        Deploy station operators for daily ground operations linked directly to dedicated station terminals.
                      </span>
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
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-semibold focus:bg-white focus:ring-2 focus:ring-emerald-500 transition"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">USERNAME *</label>
                      <input
                        type="text"
                        required
                        value={createForm.username}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCreateForm({
                            ...createForm,
                            username: val,
                            email: val ? `${val.trim().toLowerCase().replace(/^@/, '')}@plscf.edu.bd` : '',
                          });
                        }}
                        placeholder="e.g. gate1, lunch2"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono font-semibold focus:bg-white focus:ring-2 focus:ring-emerald-500 transition"
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">EMAIL ADDRESS *</label>
                    <input
                      type="email"
                      required
                      value={createForm.email}
                      onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                      placeholder="e.g. gate1@plscf.edu.bd"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono font-semibold focus:bg-white focus:ring-2 focus:ring-emerald-500 transition"
                    />
                  </div>

                  {/* Specific Daily Operational Role */}
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      ASSIGN SPECIFIC DAILY OPERATIONAL ROLE *
                    </label>
                    <select
                      value={createForm.role}
                      onChange={(e) => handleStaffRoleChange(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 transition"
                    >
                      <option value="GATE_STAFF">🚪 Gate Staff (Entry & Exit Checkpoint)</option>
                      <option value="BREAKFAST_STAFF">🥐 Breakfast Staff (Morning Food Station)</option>
                      <option value="LUNCH_STAFF">🍛 Lunch Staff (Noon Dining Hall)</option>
                      <option value="DINNER_STAFF">🍽️ Dinner Staff (Evening Banquet)</option>
                      <option value="DRESS_STAFF">👕 Dress & Gift Kit Staff (T-Shirt & Souvenirs)</option>
                    </select>
                  </div>

                  {/* Designated Station / Booth */}
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">DESIGNATED STATION / BOOTH *</label>
                    <input
                      type="text"
                      required
                      value={createForm.assignedStation}
                      onChange={(e) => setCreateForm({ ...createForm, assignedStation: e.target.value })}
                      placeholder="e.g. Gate 01 - Main Entrance Checkpoint"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-semibold focus:bg-white focus:ring-2 focus:ring-emerald-500 transition"
                    />
                  </div>

                  {/* Designated Portal & Sync Banner */}
                  <div className="p-3.5 rounded-2xl bg-sky-50 border border-sky-200 space-y-1.5 text-sky-950">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-xs flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5 text-sky-600" />
                        <span>LINKED OPERATIONAL PORTAL</span>
                      </span>
                      <span className="font-mono text-[10px] bg-sky-200/80 px-2 py-0.5 rounded font-bold">
                        /scanner
                      </span>
                    </div>
                    <p className="text-[11px] text-sky-800 leading-relaxed">
                      🔗 Directly connects to the <strong>Scanner Portal</strong>. Upon signing in, this account will automatically open their station's verification module with <strong>real-time database cloud sync</strong>.
                    </p>
                  </div>

                  {/* Auto-Generated Supabase Auth UUID */}
                  <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="space-y-0.5">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Supabase Auth UUID</span>
                      <span className="font-mono text-[11px] font-bold text-slate-700 block">{createForm.authUserId}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCreateForm({ ...createForm, authUserId: generateUuid() })}
                      className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600 cursor-pointer"
                      title="Regenerate"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* ================================================================= */}
              {/* CONDITIONAL BRANCH 3: FINANCE (TWO TIERS: MANAGER VS STAFF)        */}
              {/* ================================================================= */}
              {selectedCreateCategory === 'FINANCE' && (
                <div className="space-y-4 pt-1">
                  {/* Category Banner */}
                  <div className="p-3 rounded-2xl border border-purple-200 bg-purple-50/80 text-purple-950 text-xs flex items-center gap-2.5">
                    <DollarSign className="w-4 h-4 text-purple-600 shrink-0" />
                    <div>
                      <span className="font-extrabold block">Dedicated Finance User Provisioning</span>
                      <span className="text-[11px] text-purple-800">
                        Strict role-isolated portals separating central administrative treasury oversight from on-site data entry.
                      </span>
                    </div>
                  </div>

                  {/* Two Dedicated Tiers Selection Cards */}
                  <div>
                    <label className="font-bold text-slate-700 block mb-1.5 uppercase text-[10px] tracking-wider">
                      SELECT FINANCE ARCHITECTURE TIER *
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Tier 1: Finance Manager */}
                      <button
                        type="button"
                        onClick={() => handleFinanceTierChange('MANAGER')}
                        className={`p-3 rounded-2xl border text-left transition-all cursor-pointer space-y-1.5 ${
                          financeTier === 'MANAGER'
                            ? 'border-purple-600 bg-purple-50 ring-2 ring-purple-600/20'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-black text-xs text-purple-950">Tier 1: Finance Manager</span>
                          <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-purple-200 text-purple-900 uppercase">
                            Admin Portal
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 leading-snug">
                          <strong>Full Approval & Management:</strong> Treasury oversight, expense approvals, budget allocations, fee settings, bank reconciliations, and audit reports.
                        </p>
                      </button>

                      {/* Tier 2: Finance Staff */}
                      <button
                        type="button"
                        onClick={() => handleFinanceTierChange('STAFF')}
                        className={`p-3 rounded-2xl border text-left transition-all cursor-pointer space-y-1.5 ${
                          financeTier === 'STAFF'
                            ? 'border-purple-600 bg-purple-50 ring-2 ring-purple-600/20'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-black text-xs text-purple-950">Tier 2: Finance Staff</span>
                          <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 uppercase">
                            Scanner Portal
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 leading-snug">
                          <strong>Field Data Entry & Counter Intake:</strong> Logging manual cash payments, uploading voucher photos, and intake entry (isolated from administrative approvals).
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* Full Name & Login ID / Username */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">FULL NAME *</label>
                      <input
                        type="text"
                        required
                        value={createForm.fullName}
                        onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
                        placeholder="e.g. Finance Officer"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-semibold focus:bg-white focus:ring-2 focus:ring-purple-500 transition"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">LOGIN ID / USERNAME *</label>
                      <input
                        type="text"
                        required
                        value={createForm.username}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCreateForm({
                            ...createForm,
                            username: val,
                            email: val ? `${val.trim().toLowerCase().replace(/^@/, '')}@plscf.edu.bd` : '',
                          });
                        }}
                        placeholder="e.g. finance1, staff_cash1"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono font-semibold focus:bg-white focus:ring-2 focus:ring-purple-500 transition"
                      />
                    </div>
                  </div>

                  {/* Mobile Number, Staff ID / Reg Number & Initial Status */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">MOBILE NUMBER *</label>
                      <input
                        type="tel"
                        required
                        value={createForm.mobileNumber}
                        onChange={(e) => setCreateForm({ ...createForm, mobileNumber: e.target.value })}
                        placeholder="e.g. 017XXXXXXXX"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono font-semibold focus:bg-white focus:ring-2 focus:ring-purple-500 transition"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">STAFF ID / REG NO.</label>
                      <input
                        type="text"
                        value={createForm.staffCode}
                        onChange={(e) => setCreateForm({ ...createForm, staffCode: e.target.value })}
                        placeholder="Optional (auto if blank)"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono font-semibold focus:bg-white focus:ring-2 focus:ring-purple-500 transition"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">ACCOUNT STATUS *</label>
                      <select
                        value={createForm.initialStatus}
                        onChange={(e) =>
                          setCreateForm({ ...createForm, initialStatus: e.target.value as 'ACTIVE' | 'INACTIVE' })
                        }
                        className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold focus:bg-white focus:ring-2 focus:ring-purple-500 transition"
                      >
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="INACTIVE">INACTIVE</option>
                      </select>
                    </div>
                  </div>

                  {/* Assigned Finance Manager (Required for Finance Staff) */}
                  {financeTier === 'STAFF' && (
                    <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-2">
                      <label className="font-black text-emerald-950 block text-xs uppercase tracking-wider">
                        ASSIGNED FINANCE MANAGER *
                      </label>
                      <select
                        required
                        value={createForm.assignedManagerId}
                        onChange={(e) => setCreateForm({ ...createForm, assignedManagerId: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-emerald-300 font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="">-- Select Supervising Finance Manager --</option>
                        {financeManagers.map((mgr) => (
                          <option key={mgr.id} value={mgr.id}>
                            {mgr.fullName} (@{mgr.username} • {mgr.role})
                          </option>
                        ))}
                      </select>
                      <p className="text-[11px] text-emerald-800">
                        Only the assigned Finance Manager (and Super Admin) will see this staff member in their Staff Directory and approve their expenses.
                      </p>
                    </div>
                  )}

                  {/* Email */}
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">EMAIL ADDRESS *</label>
                    <input
                      type="email"
                      required
                      value={createForm.email}
                      onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                      placeholder="e.g. finance@plscf.edu.bd"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono font-semibold focus:bg-white focus:ring-2 focus:ring-purple-500 transition"
                    />
                  </div>

                  {/* Designated Portal Info Banner */}
                  <div className="p-3 rounded-2xl bg-purple-50/60 border border-purple-200 text-purple-900 text-xs flex items-center justify-between">
                    <div>
                      <span className="font-bold block">
                        Assigned Portal: {financeTier === 'MANAGER' ? 'Central Admin Dashboard (/admin)' : 'Operational Scanner Terminal (/scanner)'}
                      </span>
                      <span className="text-[11px] text-purple-700">
                        {financeTier === 'MANAGER' ? 'Direct access to Treasury, Budget & Audit tabs.' : 'Direct access to On-site Cash & Voucher Logging desk.'}
                      </span>
                    </div>
                    <span className="font-mono text-[10px] font-bold px-2 py-1 rounded bg-purple-200/80 text-purple-900">
                      {financeTier === 'MANAGER' ? 'ADMIN' : 'STAFF'}
                    </span>
                  </div>

                  {/* Auto-Generated Supabase Auth UUID */}
                  <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="space-y-0.5">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Supabase Auth UUID</span>
                      <span className="font-mono text-[11px] font-bold text-slate-700 block">{createForm.authUserId}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCreateForm({ ...createForm, authUserId: generateUuid() })}
                      className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600 cursor-pointer"
                      title="Regenerate"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* ================================================================= */}
              {/* SHARED PASSWORD FIELDS (ENTER PASSWORD & CONFIRM PASSWORD)        */}
              {/* ================================================================= */}
              <div className="pt-2 border-t border-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-700">
                    Initial Authentication Password (Supabase Auth)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const pw = generateTempPassword();
                      setCreateForm({ ...createForm, initialPassword: pw, mustChangePassword: true });
                      setConfirmPassword(pw);
                      setShowCreatePassword(true);
                      setShowConfirmPassword(true);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold border border-indigo-200 cursor-pointer"
                  >
                    <Wand2 className="w-3 h-3" />
                    <span>Generate Temp Password</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Enter Password */}
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      {language === 'bn' ? 'পাসওয়ার্ড লিখুন (কমপক্ষে ৬ অক্ষর) *' : 'ENTER INITIAL PASSWORD (MIN 6 CHARS) *'}
                    </label>
                    <div className="relative">
                      <input
                        type={showCreatePassword ? 'text' : 'password'}
                        required
                        value={createForm.initialPassword}
                        onChange={(e) => setCreateForm({ ...createForm, initialPassword: e.target.value })}
                        placeholder="Enter password (e.g. Admin@2027)"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono font-bold pr-10 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCreatePassword(!showCreatePassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showCreatePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      {language === 'bn' ? 'পাসওয়ার্ড নিশ্চিত করুন *' : 'CONFIRM PASSWORD *'}
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter password"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono font-bold pr-10 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Temporary password force-change checkbox */}
                <label className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-[11px] font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createForm.mustChangePassword}
                    onChange={(e) => setCreateForm({ ...createForm, mustChangePassword: e.target.checked })}
                    className="rounded text-indigo-600"
                  />
                  <span>
                    Temporary password: Require user to change password at their next login (recommended)
                  </span>
                </label>

                {/* Password Match Status Live Indicator */}
                <div className="flex items-center justify-between text-[11px] pt-0.5">
                  <div className="flex items-center gap-1.5 font-medium">
                    {createForm.initialPassword && confirmPassword ? (
                      createForm.initialPassword === confirmPassword ? (
                        <span className="text-emerald-700 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          ✓ Passwords match
                        </span>
                      ) : (
                        <span className="text-rose-600 font-bold flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5 text-rose-500" />
                          ✗ Passwords do not match
                        </span>
                      )
                    ) : (
                      <span className="text-slate-400">
                        {language === 'bn' ? 'দুটো ঘরে একই পাসওয়ার্ড প্রবেশ করান' : 'Enter the same password in both fields'}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {createForm.initialPassword.length >= 6 ? '✓ Valid Length' : `${createForm.initialPassword.length}/6 chars`}
                  </span>
                </div>
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">MOBILE NUMBER</label>
                  <input
                    type="tel"
                    value={editForm.mobileNumber}
                    onChange={(e) => setEditForm({ ...editForm, mobileNumber: e.target.value })}
                    placeholder="e.g. 017XXXXXXXX"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono font-semibold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">STAFF ID / REG NO.</label>
                  <input
                    type="text"
                    value={editForm.staffCode}
                    onChange={(e) => setEditForm({ ...editForm, staffCode: e.target.value })}
                    placeholder="Staff ID / Registration Number"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono font-semibold"
                  />
                </div>
              </div>

              {editingUser.userType === 'STAFF' && (
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    ASSIGNED FINANCE MANAGER {editForm.role.toUpperCase() === 'FINANCE_STAFF' ? '*' : '(OPTIONAL)'}
                  </label>
                  <select
                    required={editForm.role.toUpperCase() === 'FINANCE_STAFF'}
                    value={editForm.assignedManagerId}
                    onChange={(e) => setEditForm({ ...editForm, assignedManagerId: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 font-bold text-slate-900"
                  >
                    <option value="">-- Unassigned / Select Finance Manager --</option>
                    {financeManagers.map((mgr) => (
                      <option key={mgr.id} value={mgr.id}>
                        {mgr.fullName} (@{mgr.username} • {mgr.role})
                      </option>
                    ))}
                  </select>
                </div>
              )}

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

              {/* Security & Password Credentials */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-black text-slate-800 flex items-center gap-1.5 uppercase tracking-wider text-xs">
                    <Key className="w-4 h-4 text-indigo-600" />
                    {language === 'bn' ? 'নতুন সাময়িক পাসওয়ার্ড সেট করুন (ঐচ্ছিক)' : 'SET NEW TEMPORARY PASSWORD (OPTIONAL)'}
                  </label>
                  <span className="text-[10px] text-slate-500 font-semibold">
                    {language === 'bn' ? 'পরিবর্তন না করতে চাইলে ফাঁকা রাখুন' : 'Leave blank to keep unchanged'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Existing passwords are cryptographically hashed in Supabase Auth and cannot be viewed or retrieved. Setting a new password revokes active sessions and requires a change on next login.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">
                      {language === 'bn' ? 'নতুন পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর)' : 'New Password (min 6 characters)'}
                    </label>
                    <div className="relative">
                      <input
                        type={showEditPassword ? 'text' : 'password'}
                        value={editPassword}
                        onChange={(e) => setEditPassword(e.target.value)}
                        placeholder="Enter new password"
                        className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 font-mono text-xs pr-9"
                      />
                      <button
                        type="button"
                        onClick={() => setShowEditPassword(!showEditPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showEditPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">
                      {language === 'bn' ? 'পাসওয়ার্ড নিশ্চিত করুন' : 'Confirm New Password'}
                    </label>
                    <input
                      type={showEditPassword ? 'text' : 'password'}
                      value={confirmEditPassword}
                      onChange={(e) => setConfirmEditPassword(e.target.value)}
                      placeholder="Repeat new password"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 font-mono text-xs"
                    />
                  </div>
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

      {/* ========================================================================= */}
      {/* 9. MODAL: DIRECT PASSWORD MANAGEMENT & CREDENTIAL DISPATCH                */}
      {/* ========================================================================= */}
      {passwordModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {language === 'bn' ? 'ইউজার পাসওয়ার্ড সেট / রিসেট' : 'Set or Reset User Password'}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {passwordModalUser.fullName} • <span className="font-mono text-indigo-600 font-semibold">{passwordModalUser.email}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPasswordModalUser(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteDirectPasswordChange} className="space-y-4 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600">
                Current passwords are never stored in readable form and cannot be viewed. Assign a new temporary password below to replace it and revoke active sessions.
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700 block">
                    {language === 'bn' ? 'সরাসরি নতুন পাসওয়ার্ড দিন *' : 'ENTER NEW TEMPORARY PASSWORD *'}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const pw = generateTempPassword();
                      setDirectNewPassword(pw);
                      setDirectConfirmPassword(pw);
                      setShowDirectPassword(true);
                    }}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-bold border border-indigo-200 cursor-pointer"
                  >
                    <Wand2 className="w-3 h-3" />
                    <span>Generate Temp PW</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showDirectPassword ? 'text' : 'password'}
                    required
                    value={directNewPassword}
                    onChange={(e) => setDirectNewPassword(e.target.value)}
                    placeholder="Min 6 characters (e.g. Admin@2027)"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono font-bold pr-10 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowDirectPassword(!showDirectPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showDirectPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">
                  {language === 'bn' ? 'পাসওয়ার্ড নিশ্চিত করুন *' : 'CONFIRM NEW PASSWORD *'}
                </label>
                <input
                  type={showDirectPassword ? 'text' : 'password'}
                  required
                  value={directConfirmPassword}
                  onChange={(e) => setDirectConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono font-bold text-xs"
                />
              </div>

              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-[11px] font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={directMustChangePassword}
                  onChange={(e) => setDirectMustChangePassword(e.target.checked)}
                  className="rounded text-indigo-600"
                />
                <span>Require user to change this temporary password at next login</span>
              </label>

              <button
                type="submit"
                disabled={isPasswordSubmitting}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black shadow-md cursor-pointer disabled:opacity-60 transition"
              >
                {isPasswordSubmitting
                  ? (language === 'bn' ? 'আপডেট হচ্ছে...' : 'Updating Password...')
                  : (language === 'bn' ? '🔒 সাময়িক পাসওয়ার্ড সেট করুন' : '🔒 Reset Password & Revoke Sessions')}
              </button>
            </form>

            <div className="relative flex items-center justify-center my-2">
              <div className="border-t border-slate-200 w-full" />
              <span className="bg-white px-3 text-[11px] font-bold text-slate-400 uppercase">
                {language === 'bn' ? 'অথবা' : 'OR'}
              </span>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  const target = passwordModalUser;
                  setPasswordModalUser(null);
                  handleResetPassword(target);
                }}
                className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Mail className="w-4 h-4 text-indigo-600" />
                <span>{language === 'bn' ? '📧 ইমেইলে পাসওয়ার্ড রিসেট লিংক পাঠান' : '📧 Send Password Reset Link to Email'}</span>
              </button>
              <p className="text-[10px] text-slate-400 text-center">
                Dispatches a secure Supabase Auth recovery link to {passwordModalUser.email}.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 10. ONE-TIME CREDENTIAL HANDOFF MODAL (EPHEMERAL IN-MEMORY ONLY)          */}
      {/* ========================================================================= */}
      {oneTimeCredentials && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border-2 border-emerald-500 space-y-4">
            <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-2xl bg-emerald-100 text-emerald-700">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">{oneTimeCredentials.title}</h3>
                  <p className="text-[11px] text-slate-500 font-semibold">
                    {oneTimeCredentials.fullName} ({oneTimeCredentials.role})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOneTimeCredentials(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 font-semibold leading-relaxed">
              🔒 Security Notice: This temporary password is shown <strong>once</strong> so you can communicate it securely to the account holder. Once closed, it is discarded from memory and can never be viewed again.
            </div>

            <div className="bg-slate-900 text-slate-100 rounded-2xl p-4 space-y-2 font-mono text-xs">
              <div className="flex justify-between gap-2">
                <span className="text-slate-400">Account ID:</span>
                <span className="font-bold text-white">{oneTimeCredentials.staffCode || oneTimeCredentials.userId}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-400">Login ID / Username:</span>
                <span className="font-bold text-emerald-300">{oneTimeCredentials.username}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-400">Portal Email:</span>
                <span className="font-bold text-sky-300">{oneTimeCredentials.email}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-400">Temporary Password:</span>
                <span className="font-black text-amber-300 select-all">{oneTimeCredentials.temporaryPassword}</span>
              </div>
              {oneTimeCredentials.assignedManagerName && (
                <div className="flex justify-between gap-2 pt-1 border-t border-slate-800">
                  <span className="text-slate-400">Assigned Manager:</span>
                  <span className="font-bold text-purple-300">{oneTimeCredentials.assignedManagerName}</span>
                </div>
              )}
              <div className="flex justify-between gap-2">
                <span className="text-slate-400">Portal URL:</span>
                <span className="font-bold text-slate-200">
                  {oneTimeCredentials.role === 'finance_manager'
                    ? '/finance'
                    : [
                        'FINANCE_STAFF',
                        'GATE_STAFF',
                        'FOOD_STAFF',
                        'BREAKFAST_STAFF',
                        'LUNCH_STAFF',
                        'DINNER_STAFF',
                        'DRESS_STAFF',
                      ].includes(oneTimeCredentials.role.toUpperCase())
                    ? '/scanner'
                    : '/admin'}
                </span>
              </div>
            </div>

            {oneTimeCredentials.mustChangePassword && (
              <p className="text-[11px] text-indigo-800 bg-indigo-50 border border-indigo-200 p-2.5 rounded-xl font-medium">
                The user will be required to change this temporary password immediately upon their next login.
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  const portalPath =
                    oneTimeCredentials.role === 'finance_manager'
                      ? '/finance'
                      : [
                          'FINANCE_STAFF',
                          'GATE_STAFF',
                          'FOOD_STAFF',
                          'BREAKFAST_STAFF',
                          'LUNCH_STAFF',
                          'DINNER_STAFF',
                          'DRESS_STAFF',
                        ].includes(oneTimeCredentials.role.toUpperCase())
                      ? '/scanner'
                      : '/admin';
                  const msg = [
                    `PLSCF Reunion 2027 — Account Credentials`,
                    `Name: ${oneTimeCredentials.fullName}`,
                    `Role: ${oneTimeCredentials.role}`,
                    `ID: ${oneTimeCredentials.staffCode || oneTimeCredentials.userId}`,
                    `Portal: ${typeof window !== 'undefined' ? window.location.origin : ''}${portalPath}`,
                    `Login ID / Username: ${oneTimeCredentials.username}`,
                    `Email: ${oneTimeCredentials.email}`,
                    `Initial Password: ${oneTimeCredentials.temporaryPassword}`,
                    oneTimeCredentials.assignedManagerName
                      ? `Assigned Manager: ${oneTimeCredentials.assignedManagerName}`
                      : '',
                    oneTimeCredentials.mustChangePassword
                      ? `Note: You will be prompted to set a new password at first login.`
                      : '',
                  ]
                    .filter(Boolean)
                    .join('\n');
                  navigator.clipboard?.writeText(msg);
                  setCopiedCredentials(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer"
              >
                {copiedCredentials ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCredentials ? 'Copied!' : 'Copy Login Instructions'}</span>
              </button>
              <button
                type="button"
                onClick={() => setOneTimeCredentials(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold cursor-pointer"
              >
                Close & Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
