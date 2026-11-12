import { useState, useEffect } from 'react';
import {
  UserPlus,
  Shield,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lock,
  Search,
  Filter,
  Trash2,
  MapPin,
  RefreshCw,
} from 'lucide-react';
import { StaffAccount, EventStaffRole, DepartmentType, StaffPermissionAction } from '../../types';
import { EventStore, getDefaultDepartment, getDefaultPermissions } from '../../services/eventStore';
import { GlobalPagination } from '../common/GlobalPagination';
import { paginate } from '../../utils/pagination';

interface StaffManagementTabProps {
  currentAdminEmail?: string;
}

export const StaffManagementTab: React.FC<StaffManagementTabProps> = ({ currentAdminEmail = '' }) => {
  const [staffList, setStaffList] = useState<StaffAccount[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Global Pagination State (Default 10, supports 10, 20, 30, 40)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Reset to page 1 on filter/search change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, roleFilter, statusFilter]);

  // Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isConfirmActionOpen, setIsConfirmActionOpen] = useState(false);

  // Selected Staff for Action
  const [selectedStaff, setSelectedStaff] = useState<StaffAccount | null>(null);
  const [actionType, setActionType] = useState<'TOGGLE_STATUS' | 'DELETE' | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form State for New Staff
  const [newStaffForm, setNewStaffForm] = useState({
    fullName: '',
    username: '',
    email: '',
    authUserId: '',
    role: 'GATE_STAFF' as EventStaffRole,
    department: 'GATE' as DepartmentType,
    permissions: ['VIEW', 'SCAN', 'VERIFY', 'APPROVE'] as StaffPermissionAction[],
    assignedGate: 'Gate 01 - Main Academic Gate',
  });

  const loadStaff = async () => {
    try {
      setStaffList(await EventStore.fetchStaffAccounts());
    } catch (error) {
      console.error('Unable to load staff profiles:', error);
      showNotification('error', 'Unable to load staff profiles. Verify your admin authorization and try again.');
    }
  };

  useEffect(() => {
    void loadStaff();
  }, []);

  const showNotification = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffForm.fullName || !newStaffForm.username || !newStaffForm.email || !newStaffForm.authUserId) {
      showNotification('error', 'Please fill in all mandatory fields.');
      return;
    }

    // Check duplicate username or email
    const duplicate = staffList.find(
      (s) =>
        s.username.toLowerCase() === newStaffForm.username.trim().toLowerCase() ||
        (newStaffForm.email && s.email.toLowerCase() === newStaffForm.email.trim().toLowerCase())
    );

    if (duplicate) {
      showNotification('error', `A staff account with username "${newStaffForm.username}" or email already exists.`);
      return;
    }

    try {
      await EventStore.createStaffAccount({
        authUserId: newStaffForm.authUserId.trim(),
        fullName: newStaffForm.fullName.trim(),
        username: newStaffForm.username.trim().toLowerCase(),
        email: newStaffForm.email.trim().toLowerCase(),
        role: newStaffForm.role,
        department: newStaffForm.department,
        permissions: newStaffForm.permissions,
        status: 'ACTIVE',
        assignedGate: newStaffForm.assignedGate.trim(),
        createdBy: currentAdminEmail,
      });

      await loadStaff();
      setIsCreateModalOpen(false);
      setNewStaffForm({
        fullName: '',
        username: '',
        email: '',
        authUserId: '',
        role: 'GATE_STAFF',
        department: 'GATE',
        permissions: ['VIEW', 'SCAN', 'VERIFY', 'APPROVE'],
        assignedGate: 'Gate 01 - Main Academic Gate',
      });
      showNotification('success', 'Staff profile provisioned with isolated department permissions.');
    } catch (error) {
      console.error('Unable to create staff profile:', error);
      showNotification('error', 'Unable to create staff profile. Check the Auth user ID and admin permissions.');
    }
  };

  const handleToggleStatus = (staff: StaffAccount) => {
    setSelectedStaff(staff);
    setActionType('TOGGLE_STATUS');
    setActionReason('');
    setIsConfirmActionOpen(true);
  };

  const handleDeleteStaff = (staff: StaffAccount) => {
    if (staff.role === 'SUPER_ADMIN') {
      showNotification('error', 'Super Admin staff profiles cannot be deleted here.');
      return;
    }
    setSelectedStaff(staff);
    setActionType('DELETE');
    setActionReason('');
    setIsConfirmActionOpen(true);
  };

  const executeConfirmedAction = async () => {
    if (!selectedStaff || !actionType) return;
    if (!actionReason.trim()) {
      showNotification('error', 'Mandatory audit reason is required for privileged changes.');
      return;
    }

    try {
      if (actionType === 'TOGGLE_STATUS') {
        const nextStatus = selectedStaff.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
        const updated = await EventStore.updateStaffAccount(
          selectedStaff.id,
          { status: nextStatus },
          `Status toggled to ${nextStatus}: ${actionReason.trim()}`
        );
        if (!updated) throw new Error('The staff profile no longer exists.');
        showNotification('success', `Staff account status changed to ${nextStatus}.`);
      } else if (actionType === 'DELETE') {
        const deleted = await EventStore.deleteStaffAccount(selectedStaff.id, actionReason.trim());
        if (!deleted) throw new Error('The staff profile no longer exists.');
        showNotification('success', `Staff account ${selectedStaff.fullName} (${selectedStaff.id}) deleted.`);
      }

      setIsConfirmActionOpen(false);
      setSelectedStaff(null);
      setActionType(null);
      setActionReason('');
      await loadStaff();
    } catch (error) {
      console.error('Unable to apply staff account change:', error);
      showNotification('error', error instanceof Error ? error.message : 'Unable to update staff account.');
    }
  };

  // Filter staff list
  const filteredStaff = staffList.filter((s) => {
    const matchesSearch =
      s.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'ALL' || s.role === roleFilter;
    const matchesStatus = statusFilter === 'ALL' || s.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const getRoleBadge = (role: EventStaffRole) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">Super Admin</span>;
      case 'GATE_STAFF':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">Gate Staff</span>;
      case 'BREAKFAST_STAFF':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">Breakfast Staff</span>;
      case 'LUNCH_STAFF':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 border border-orange-200">Lunch Staff</span>;
      case 'DINNER_STAFF':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200">Dinner Staff</span>;
      case 'DRESS_STAFF':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">Dress / T-Shirt Staff</span>;
      case 'FINANCE_STAFF':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-100 text-teal-800 border border-teal-200">Finance Staff</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800">{role}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Staff Authentication & Role Management</h2>
              <p className="text-sm text-slate-500">
                Link Supabase Auth users to staff roles. Passwords are managed only by Supabase Auth.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadStaff}
            className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors"
            title="Refresh Staff List"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium shadow-sm"
          >
            <UserPlus className="w-4 h-4" />
            Create Staff Account
          </button>
        </div>
      </div>

      {/* Notification Toast */}
      {statusMessage && (
        <div
          className={`p-4 rounded-xl flex items-center gap-3 text-sm font-medium ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, username, email or Staff ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL">All Roles ({staffList.length})</option>
                <option value="SUPER_ADMIN">Super Admin</option>
                <option value="GATE_STAFF">Gate Staff</option>
                <option value="BREAKFAST_STAFF">Breakfast Staff</option>
                <option value="LUNCH_STAFF">Lunch Staff</option>
                <option value="DINNER_STAFF">Dinner Staff</option>
                <option value="DRESS_STAFF">Dress / T-Shirt Staff</option>
                <option value="FINANCE_STAFF">Finance Staff</option>
              </select>
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active Only</option>
              <option value="DISABLED">Disabled Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Staff Accounts Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-4">Staff Member</th>
                <th className="py-3 px-4">Credentials</th>
                <th className="py-3 px-4">Role & Permissions</th>
                <th className="py-3 px-4">Assigned Station</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No staff accounts found matching your query.
                  </td>
                </tr>
              ) : (
                paginate(filteredStaff, currentPage, pageSize).map((staff) => (
                  <tr key={staff.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{staff.fullName}</div>
                      <div className="text-xs font-mono text-slate-500">{staff.id}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-mono text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded inline-block font-semibold">
                        @{staff.username}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">{staff.email}</div>
                    </td>
                    <td className="py-3 px-4">{getRoleBadge(staff.role)}</td>
                    <td className="py-3 px-4 text-xs text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{staff.assignedGate || 'Central Command'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {staff.status === 'ACTIVE' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                          <XCircle className="w-3.5 h-3.5" />
                          Disabled
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => handleToggleStatus(staff)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            staff.status === 'ACTIVE'
                              ? 'text-slate-500 hover:text-amber-600 hover:bg-amber-50'
                              : 'text-slate-500 hover:text-emerald-600 hover:bg-emerald-50'
                          }`}
                          title={staff.status === 'ACTIVE' ? 'Deactivate Account' : 'Activate Account'}
                        >
                          {staff.status === 'ACTIVE' ? (
                            <Lock className="w-4 h-4" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4" />
                          )}
                        </button>
                        {staff.role !== 'SUPER_ADMIN' && (
                          <button
                            onClick={() => handleDeleteStaff(staff)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Delete Staff"
                          >
                            <Trash2 className="w-4 h-4" />
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

        {/* Staff Global Pagination */}
        <GlobalPagination
          currentPage={currentPage}
          totalRecords={filteredStaff.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      {/* Modal: Create Staff Account */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">Provision New Staff Account</h3>
                <p className="text-xs text-slate-300">Set up role-isolated staff credentials</p>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateStaff} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sub-Inspector Tanvir Hasan"
                  value={newStaffForm.fullName}
                  onChange={(e) => setNewStaffForm({ ...newStaffForm, fullName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Username *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. gate1"
                    value={newStaffForm.username}
                    onChange={(e) => setNewStaffForm({ ...newStaffForm, username: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. staff@plscf.edu.bd"
                    value={newStaffForm.email}
                    onChange={(e) => setNewStaffForm({ ...newStaffForm, email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Supabase Auth User ID *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Create the user in Supabase Auth, then paste its UUID"
                  value={newStaffForm.authUserId}
                  onChange={(e) => setNewStaffForm({ ...newStaffForm, authUserId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Assigned Role *
                  </label>
                  <select
                    value={newStaffForm.role}
                    onChange={(e) => {
                      const role = e.target.value as EventStaffRole;
                      setNewStaffForm({
                        ...newStaffForm,
                        role,
                        department: getDefaultDepartment(role),
                        permissions: getDefaultPermissions(role),
                      });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="GATE_STAFF">Gate Staff (Entry & Exit)</option>
                    <option value="BREAKFAST_STAFF">Breakfast Staff</option>
                    <option value="LUNCH_STAFF">Lunch Staff</option>
                    <option value="DINNER_STAFF">Dinner Staff</option>
                    <option value="DRESS_STAFF">Dress / T-Shirt Staff</option>
                    <option value="FINANCE_STAFF">Finance & Expense Staff</option>
                    <option value="SUPER_ADMIN">Super Administrator</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Assigned Department *
                  </label>
                  <select
                    value={newStaffForm.department}
                    onChange={(e) =>
                      setNewStaffForm({ ...newStaffForm, department: e.target.value as DepartmentType })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="GATE">Gate Security & Entry</option>
                    <option value="BREAKFAST">Breakfast Service</option>
                    <option value="LUNCH">Lunch Service</option>
                    <option value="DINNER">Dinner Service</option>
                    <option value="DRESS">Dress / T-Shirt Distribution</option>
                    <option value="FINANCE">Finance & Accounts</option>
                    <option value="ALL_SERVICES">All Services (Full Event)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Assigned Station / Gate Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Gate 02 or Food Pavilion A"
                  value={newStaffForm.assignedGate}
                  onChange={(e) => setNewStaffForm({ ...newStaffForm, assignedGate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Granular Permissions (Default Deny - Explicitly Allow)
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['VIEW', 'SCAN', 'VERIFY', 'APPROVE', 'REJECT', 'EXPORT', 'MANAGE'] as StaffPermissionAction[]).map(
                    (action) => (
                      <label
                        key={action}
                        className="flex items-center gap-1.5 p-1.5 border border-slate-200 rounded-lg bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={newStaffForm.permissions.includes(action)}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            const perms = checked
                              ? [...newStaffForm.permissions, action]
                              : newStaffForm.permissions.filter((p) => p !== action);
                            setNewStaffForm({ ...newStaffForm, permissions: perms });
                          }}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="font-mono text-[11px] font-bold text-slate-700">{action}</span>
                      </label>
                    )
                  )}
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Staff accounts are strictly role-isolated. Staff members can only access their designated operational station. All actions are logged.
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirm Action (Toggle / Delete) */}
      {isConfirmActionOpen && selectedStaff && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  actionType === 'DELETE'
                    ? 'bg-rose-50 text-rose-600 border border-rose-200'
                    : 'bg-amber-50 text-amber-600 border border-amber-200'
                }`}
              >
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {actionType === 'DELETE' ? 'Delete Staff Account' : 'Toggle Account Status'}
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedStaff.fullName} ({selectedStaff.id})
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-600">
              {actionType === 'DELETE'
                ? `Are you sure you want to permanently delete the staff account for ${selectedStaff.fullName}? This cannot be undone.`
                : `Are you sure you want to change the status of ${selectedStaff.fullName} from ${selectedStaff.status} to ${
                    selectedStaff.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE'
                  }?`}
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Mandatory Audit Reason *
              </label>
              <textarea
                required
                rows={2}
                placeholder="Explain why this privileged administrative change is being made..."
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsConfirmActionOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeConfirmedAction}
                className={`px-4 py-2 text-white rounded-lg text-sm font-medium ${
                  actionType === 'DELETE'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                Confirm Action
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
