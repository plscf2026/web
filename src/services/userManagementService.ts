import { supabase } from './supabase';
import { AdminAccount, StaffPermissionAction } from '../types';

export type UserType = 'ADMIN' | 'STAFF';
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export type RoleCategory =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'STAFF'
  | 'FINANCE';

export interface UnifiedSystemUser {
  id: string;
  userType: UserType;
  fullName: string;
  username: string;
  email: string;
  mobileNumber?: string | null;
  staffCode?: string | null;
  assignedManagerId?: string | null;
  assignedManagerName?: string | null;
  mustChangePassword?: boolean;
  role: string;
  roleCategory: RoleCategory;
  department: string;
  status: UserStatus;
  assignedStation: string;
  permissions: StaffPermissionAction[];
  createdAt: string;
  lastLoginAt: string | null;
  authUserId: string | null;
  createdBy: string | null;
}

export interface RoleGroupSummary {
  category: RoleCategory;
  titleEn: string;
  titleBn: string;
  descriptionEn: string;
  themeColor: string; // Tailwind class
  accentBg: string;
  accentBorder: string;
  badgeBg: string;
  badgeText: string;
  totalAccounts: number;
  activeAccounts: number;
  inactiveAccounts: number;
  suspendedAccounts: number;
  subRoles: string[];
}

export class UserManagementService {
  /**
   * Enforce strict Super Admin authorization on account & credential operations.
   */
  static isSuperAdminSession(adminSession?: Partial<AdminAccount> | null): boolean {
    return Boolean(adminSession && String(adminSession.role || '').toLowerCase() === 'super_admin');
  }

  /**
   * Fetch Finance Manager accounts authorized for supervising Finance Staff.
   */
  static async fetchFinanceManagers(): Promise<UnifiedSystemUser[]> {
    const all = await this.fetchUnifiedUsers();
    return all.filter(
      (u) =>
        u.userType === 'ADMIN' &&
        (u.role.toLowerCase() === 'finance_manager' || u.role.toLowerCase() === 'super_admin') &&
        u.status === 'ACTIVE'
    );
  }

  /**
   * Authoritatively discover and fetch all system users across all roles from Supabase database
   */
  static async fetchUnifiedUsers(): Promise<UnifiedSystemUser[]> {
    try {
      const { data, error } = await supabase.rpc('rpc_get_unified_system_users');

      if (!error && Array.isArray(data)) {
        return data as UnifiedSystemUser[];
      }

      if (error) {
        console.warn('[UserManagementService] rpc_get_unified_system_users notice:', error.message);
      }
    } catch (err) {
      console.warn('[UserManagementService] RPC query exception, falling back to direct table queries:', err);
    }

    // Direct table fallback
    const users: UnifiedSystemUser[] = [];

    try {
      const [adminsRes, staffRes] = await Promise.all([
        supabase.from('admin_accounts').select('*'),
        supabase.from('staff_accounts').select('*'),
      ]);

      if (adminsRes.data) {
        adminsRes.data.forEach((a: any) => {
          const roleLower = (a.role || 'admin').toLowerCase();
          let cat: RoleCategory = 'ADMIN';
          if (roleLower.includes('super')) cat = 'SUPER_ADMIN';
          else if (roleLower.includes('finance')) cat = 'FINANCE';

          const st: UserStatus = a.is_locked ? 'INACTIVE' : (a.status || 'ACTIVE');

          users.push({
            id: a.id,
            userType: 'ADMIN',
            fullName: a.full_name || 'Admin User',
            username: a.username || a.email,
            email: a.email,
            mobileNumber: a.mobile_number || null,
            staffCode: a.staff_code || a.id,
            assignedManagerId: null,
            assignedManagerName: null,
            mustChangePassword: Boolean(a.must_change_password),
            role: a.role,
            roleCategory: cat,
            department: a.department || 'CENTRAL_ADMIN',
            status: st,
            assignedStation: a.assigned_station || 'Super Admin Command Center',
            permissions: (a.permissions as any) || ['VIEW', 'VERIFY', 'APPROVE', 'EXPORT', 'MANAGE'],
            createdAt: a.created_at || new Date().toISOString(),
            lastLoginAt: a.last_login_at || null,
            authUserId: a.auth_user_id || null,
            createdBy: 'SUPER_ADMIN',
          });
        });
      }

      if (staffRes.data) {
        staffRes.data.forEach((s: any) => {
          const roleUpper = (s.role || 'GATE_STAFF').toUpperCase();
          let cat: RoleCategory = 'STAFF';
          if (roleUpper.includes('SUPER')) cat = 'SUPER_ADMIN';
          else if (roleUpper.includes('FINANCE')) cat = 'FINANCE';
          else if (roleUpper.includes('ADMIN')) cat = 'ADMIN';

          let st: UserStatus = 'ACTIVE';
          if (s.status === 'DISABLED' || s.status === 'INACTIVE') st = 'INACTIVE';
          else if (s.status === 'SUSPENDED') st = 'SUSPENDED';

          users.push({
            id: s.id,
            userType: 'STAFF',
            fullName: s.full_name || 'Staff User',
            username: s.username || s.email,
            email: s.email,
            mobileNumber: s.mobile_number || null,
            staffCode: s.staff_code || s.id,
            assignedManagerId: s.assigned_manager_id || null,
            assignedManagerName: s.assigned_manager_name || null,
            mustChangePassword: Boolean(s.must_change_password),
            role: s.role,
            roleCategory: cat,
            department: s.department || 'OPERATIONS',
            status: st,
            assignedStation: s.assigned_gate || 'Station Booth',
            permissions: (s.permissions as any) || ['VIEW', 'SCAN', 'VERIFY', 'APPROVE'],
            createdAt: s.created_at || new Date().toISOString(),
            lastLoginAt: s.last_login_at || null,
            authUserId: s.auth_user_id || null,
            createdBy: s.created_by || 'SUPER_ADMIN',
          });
        });
      }
    } catch (e) {
      console.warn('[UserManagementService] Direct table fallback error:', e);
    }

    return users;
  }

  /**
   * Group users dynamically into visual Role Categories with real-time statistics
   */
  static computeRoleGroupSummaries(users: UnifiedSystemUser[]): RoleGroupSummary[] {
    const categories: RoleCategory[] = [
      'SUPER_ADMIN',
      'ADMIN',
      'STAFF',
      'FINANCE',
    ];

    const categoryMeta: Record<
      RoleCategory,
      {
        titleEn: string;
        titleBn: string;
        descEn: string;
        themeColor: string;
        accentBg: string;
        accentBorder: string;
        badgeBg: string;
        badgeText: string;
      }
    > = {
      SUPER_ADMIN: {
        titleEn: 'Super Admin Management',
        titleBn: 'সুপার অ্যাডমিন ব্যবস্থাপনা',
        descEn: 'Master executives with root system privileges, financial authorization, and database audit control.',
        themeColor: 'amber',
        accentBg: 'bg-amber-500/10 hover:bg-amber-500/15',
        accentBorder: 'border-amber-400',
        badgeBg: 'bg-amber-100',
        badgeText: 'text-amber-900',
      },
      ADMIN: {
        titleEn: 'Admin Management',
        titleBn: 'অ্যাডমিন ব্যবস্থাপনা',
        descEn: 'Administrative operators managing registrations, student queries, and event oversight.',
        themeColor: 'blue',
        accentBg: 'bg-blue-500/10 hover:bg-blue-500/15',
        accentBorder: 'border-blue-400',
        badgeBg: 'bg-blue-100',
        badgeText: 'text-blue-900',
      },
      STAFF: {
        titleEn: 'Staff Management',
        titleBn: 'স্টাফ ও ফিল্ড টিম ব্যবস্থাপনা',
        descEn: 'On-site station operators for Gate scanning, Breakfast, Lunch, Dinner, and T-shirt distribution.',
        themeColor: 'emerald',
        accentBg: 'bg-emerald-500/10 hover:bg-emerald-500/15',
        accentBorder: 'border-emerald-400',
        badgeBg: 'bg-emerald-100',
        badgeText: 'text-emerald-900',
      },
      FINANCE: {
        titleEn: 'Finance User Management',
        titleBn: 'অর্থ ও হিসাবরক্ষণ ব্যবস্থাপনা',
        descEn: 'Treasury managers and finance staff managing budgets, expenses, and transaction audits.',
        themeColor: 'purple',
        accentBg: 'bg-purple-500/10 hover:bg-purple-500/15',
        accentBorder: 'border-purple-400',
        badgeBg: 'bg-purple-100',
        badgeText: 'text-purple-900',
      },
    };

    return categories.map((cat) => {
      const groupUsers = users.filter((u) => u.roleCategory === cat);
      const active = groupUsers.filter((u) => u.status === 'ACTIVE').length;
      const inactive = groupUsers.filter((u) => u.status === 'INACTIVE').length;
      const suspended = groupUsers.filter((u) => u.status === 'SUSPENDED').length;
      const subRoles = Array.from(new Set(groupUsers.map((u) => u.role)));

      const meta = categoryMeta[cat];
      return {
        category: cat,
        titleEn: meta.titleEn,
        titleBn: meta.titleBn,
        descriptionEn: meta.descEn,
        themeColor: meta.themeColor,
        accentBg: meta.accentBg,
        accentBorder: meta.accentBorder,
        badgeBg: meta.badgeBg,
        badgeText: meta.badgeText,
        totalAccounts: groupUsers.length,
        activeAccounts: active,
        inactiveAccounts: inactive,
        suspendedAccounts: suspended,
        subRoles,
      };
    });
  }

  /**
   * Update User Status (Activate, Deactivate, Suspend, Restore) with audit logging
   */
  static async updateUserStatus(
    userId: string,
    userType: UserType,
    newStatus: UserStatus,
    adminSession: AdminAccount,
    reason: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.isSuperAdminSession(adminSession)) {
      return { success: false, error: 'UNAUTHORIZED: Only Super Admin can activate or deactivate accounts.' };
    }

    try {
      const { data, error } = await supabase.rpc('rpc_manage_user_status', {
        p_user_id: userId,
        p_user_type: userType,
        p_new_status: newStatus,
        p_admin_id: adminSession.id,
        p_admin_name: adminSession.fullName || adminSession.username,
        p_reason: reason.trim() || `Status updated to ${newStatus} by Super Admin`,
      });

      if (!error && data?.success) {
        return { success: true };
      }

      if (data?.error) {
        return { success: false, error: data.error };
      }

      if (error) {
        return { success: false, error: error.message };
      }
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to update user status' };
    }

    return { success: true };
  }

  /**
   * Update User Profile (Role, Department, Permissions, Mobile, Assigned Manager)
   */
  static async updateUserProfile(
    userId: string,
    userType: UserType,
    payload: {
      fullName: string;
      username: string;
      email: string;
      role: string;
      department: string;
      assignedStation: string;
      permissions: StaffPermissionAction[];
      mobileNumber?: string;
      staffCode?: string;
      assignedManagerId?: string | null;
    },
    adminSession: AdminAccount,
    reason: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.isSuperAdminSession(adminSession)) {
      return { success: false, error: 'UNAUTHORIZED: Only Super Admin can modify account profiles.' };
    }

    try {
      const { data, error } = await supabase.rpc('rpc_manage_user_profile', {
        p_user_id: userId,
        p_user_type: userType,
        p_full_name: payload.fullName.trim(),
        p_username: payload.username.trim().toLowerCase(),
        p_email: payload.email.trim().toLowerCase(),
        p_role: payload.role.trim(),
        p_department: payload.department.trim(),
        p_assigned_station: payload.assignedStation.trim(),
        p_permissions: payload.permissions,
        p_admin_id: adminSession.id,
        p_admin_name: adminSession.fullName || adminSession.username,
        p_reason: reason.trim() || 'Profile details updated by Super Admin',
        p_mobile_number: payload.mobileNumber?.trim() || null,
        p_staff_code: payload.staffCode?.trim() || null,
        p_assigned_manager_id: payload.assignedManagerId !== undefined ? (payload.assignedManagerId?.trim() || '') : null,
      });

      if (!error && data?.success) {
        return { success: true };
      }

      if (data?.error) {
        return { success: false, error: data.error };
      }

      if (error) {
        return { success: false, error: error.message };
      }
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to update user profile' };
    }

    return { success: true };
  }

  /**
   * Create a new System User (Admin or Staff) in database (Super Admin only)
   */
  static async createSystemUser(
    payload: {
      userType: UserType;
      fullName: string;
      username: string;
      email: string;
      role: string;
      department: string;
      assignedStation?: string;
      permissions: StaffPermissionAction[];
      authUserId?: string;
      initialPassword?: string;
      mobileNumber?: string;
      staffCode?: string;
      assignedManagerId?: string;
      initialStatus?: 'ACTIVE' | 'INACTIVE';
      mustChangePassword?: boolean;
    },
    adminSession: AdminAccount
  ): Promise<{
    success: boolean;
    userId?: string;
    staffCode?: string;
    username?: string;
    role?: string;
    status?: string;
    assignedManagerId?: string | null;
    assignedManagerName?: string | null;
    mustChangePassword?: boolean;
    error?: string;
  }> {
    if (!this.isSuperAdminSession(adminSession)) {
      return { success: false, error: 'UNAUTHORIZED: Only Super Admin can create accounts.' };
    }

    try {
      const { data, error } = await supabase.rpc('rpc_create_system_user', {
        p_user_type: payload.userType,
        p_full_name: payload.fullName.trim(),
        p_username: payload.username.trim().toLowerCase(),
        p_email: payload.email.trim().toLowerCase(),
        p_role: payload.role.trim(),
        p_department: payload.department.trim(),
        p_assigned_station: payload.assignedStation?.trim() || null,
        p_permissions: payload.permissions,
        p_auth_user_id: payload.authUserId?.trim() || null,
        p_initial_password: payload.initialPassword?.trim() || null,
        p_admin_id: adminSession.id,
        p_admin_name: adminSession.fullName || adminSession.username,
        p_mobile_number: payload.mobileNumber?.trim() || null,
        p_staff_code: payload.staffCode?.trim() || null,
        p_assigned_manager_id: payload.assignedManagerId?.trim() || null,
        p_initial_status: payload.initialStatus || 'ACTIVE',
        p_must_change_password: payload.mustChangePassword ?? true,
      });

      if (!error && data?.success) {
        return {
          success: true,
          userId: data.userId,
          staffCode: data.staffCode,
          username: data.username,
          role: data.role,
          status: data.status,
          assignedManagerId: data.assignedManagerId || null,
          assignedManagerName: data.assignedManagerName || null,
          mustChangePassword: Boolean(data.mustChangePassword),
        };
      }

      if (data?.error) {
        return { success: false, error: data.error };
      }

      if (error) {
        return { success: false, error: error.message };
      }
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to create user account' };
    }

    return { success: false, error: 'Unknown creation error' };
  }

  /**
   * Authoritatively set or reset password for any user directly in Supabase Auth (Super Admin only)
   */
  static async setUserPassword(
    email: string,
    newPassword: string,
    adminSession: AdminAccount,
    mustChangePassword: boolean = true
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.isSuperAdminSession(adminSession)) {
      return { success: false, error: 'UNAUTHORIZED: Only Super Admin can reset passwords.' };
    }

    try {
      if (!newPassword || newPassword.trim().length < 6) {
        return { success: false, error: 'Password must be at least 6 characters long.' };
      }

      const { data, error } = await supabase.rpc('rpc_set_user_password', {
        p_email: email.trim().toLowerCase(),
        p_new_password: newPassword.trim(),
        p_admin_id: adminSession.id,
        p_admin_name: adminSession.fullName || adminSession.username,
        p_must_change_password: mustChangePassword,
      });

      if (!error && data?.success) {
        return { success: true };
      }

      if (data?.error) {
        return { success: false, error: data.error };
      }

      if (error) {
        return { success: false, error: error.message };
      }
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to update user password' };
    }

    return { success: true };
  }

  /**
   * Complete forced temporary password rotation for the currently authenticated user.
   */
  static async completeForcedPasswordChange(
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> {
    const clean = newPassword.trim();
    if (!clean || clean.length < 6) {
      return { success: false, error: 'New password must be at least 6 characters long.' };
    }

    try {
      const { error: authErr } = await supabase.auth.updateUser({
        password: clean,
        data: { must_change_password: false },
      });
      if (authErr) {
        return { success: false, error: authErr.message };
      }

      const { data, error } = await supabase.rpc('rpc_complete_forced_password_change', {
        p_new_password: clean,
      });

      if (error) {
        return { success: false, error: error.message };
      }
      if (data && data.success === false) {
        return { success: false, error: data.error || 'Failed to clear temporary password flag.' };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Unable to update password.' };
    }
  }

  /**
   * Super Admin only: Revoke active Supabase Auth sessions for an account.
   */
  static async revokeUserSessions(
    userId: string,
    userType: UserType,
    adminSession: AdminAccount,
    reason: string = 'Sessions revoked by Super Admin'
  ): Promise<{ success: boolean; revokedSessions?: number; error?: string }> {
    if (!this.isSuperAdminSession(adminSession)) {
      return { success: false, error: 'UNAUTHORIZED: Only Super Admin can revoke sessions.' };
    }

    try {
      const { data, error } = await supabase.rpc('rpc_revoke_user_sessions', {
        p_user_id: userId,
        p_user_type: userType,
        p_admin_id: adminSession.id,
        p_admin_name: adminSession.fullName || adminSession.username,
        p_reason: reason,
      });

      if (!error && data?.success) {
        return { success: true, revokedSessions: Number(data.revokedSessions || 0) };
      }
      if (data?.error) {
        return { success: false, error: data.error };
      }
      if (error) {
        return { success: false, error: error.message };
      }
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to revoke user sessions.' };
    }

    return { success: true };
  }

  /**
   * Trigger Supabase Auth Password Reset Email
   */
  static async resetPasswordForEmail(email: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/admin`,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Unable to send password reset email' };
    }
  }

  /**
   * Fetch immutable audit & activity trail for a given user
   */
  static async fetchUserActivityHistory(userId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('admin_audit_logs')
        .select('*')
        .or(`target_id.eq.${userId},admin_id.eq.${userId}`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && Array.isArray(data)) {
        return data;
      }
    } catch (_) {}
    return [];
  }
}
