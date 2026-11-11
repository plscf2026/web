import { useState } from 'react';
import {
  Users,
  Plus,
  Search,
  Phone,
  Mail,
  Calendar,
  ShieldCheck,
  UserPlus,
  ArrowRightLeft,
  Power,
  X,
} from 'lucide-react';
import { RmsStore } from '../../services/rmsStore';
import { CommitteeRecord, CommitteeMemberRecord } from '../../types/rms';
import { Language } from '../../types';

interface RmsCommitteesModuleProps {
  language?: Language;
  currentUser?: unknown;
  canManage?: boolean;
}

export const RmsCommitteesModule: React.FC<RmsCommitteesModuleProps> = ({
  language = 'en',
}) => {
  const [committees, setCommittees] = useState<CommitteeRecord[]>(() => RmsStore.getCommittees());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterActive, setFilterActive] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Selected Committee for member view drawer
  const [selectedCommittee, setSelectedCommittee] = useState<CommitteeRecord | null>(null);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showTransferMemberModal, setShowTransferMemberModal] = useState<CommitteeMemberRecord | null>(null);

  // Form state for new / edit committee
  const [nameEn, setNameEn] = useState('');
  const [nameBn, setNameBn] = useState('');
  const [descEn, setDescEn] = useState('');
  const [descBn, setDescBn] = useState('');
  const [directorName, setDirectorName] = useState('');
  const [directorPhone, setDirectorPhone] = useState('');
  const [directorEmail, setDirectorEmail] = useState('');
  const [meetingDay, setMeetingDay] = useState('');
  const [budgetTotal, setBudgetTotal] = useState<number>(300000);

  // Member form state
  const [memberName, setMemberName] = useState('');
  const [memberPhone, setMemberPhone] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberRole, setMemberRole] = useState<'DIRECTOR' | 'ASSISTANT_DIRECTOR' | 'MEMBER' | 'COORDINATOR'>('MEMBER');
  const [memberResp, setMemberResp] = useState('');

  // Transfer target committee
  const [targetCommitteeId, setTargetCommitteeId] = useState('');

  const refreshCommittees = () => {
    const list = RmsStore.getCommittees();
    setCommittees(list);
    if (selectedCommittee) {
      const updated = list.find((c) => c.id === selectedCommittee.id);
      setSelectedCommittee(updated || null);
    }
  };

  const filteredCommittees = committees.filter((c) => {
    const matchesSearch =
      c.nameEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.nameBn.includes(searchQuery) ||
      c.directorName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      filterActive === 'ALL' || (filterActive === 'ACTIVE' ? c.isActive : !c.isActive);
    return matchesSearch && matchesStatus;
  });

  const handleCreateCommittee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameEn.trim() || !directorName.trim()) return;

    RmsStore.createCommittee({
      nameEn: nameEn.trim(),
      nameBn: nameBn.trim() || nameEn.trim(),
      descriptionEn: descEn.trim(),
      descriptionBn: descBn.trim() || descEn.trim(),
      directorId: `DIR-${Date.now()}`,
      directorName: directorName.trim(),
      directorPhone: directorPhone.trim(),
      directorEmail: directorEmail.trim(),
      assistantDirectorIds: [],
      assistantDirectorNames: [],
      members: [],
      assignedResponsibilities: ['Operational oversight', 'Resource management'],
      budgetTotal: Number(budgetTotal) || 0,
      budgetAllocated: 0,
      budgetSpent: 0,
      isActive: true,
      meetingDay: meetingDay.trim() || 'Weekly',
    });

    setShowAddModal(false);
    refreshCommittees();
  };

  const handleToggleActive = (c: CommitteeRecord) => {
    RmsStore.updateCommittee(c.id, { isActive: !c.isActive });
    refreshCommittees();
  };

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCommittee || !memberName.trim() || !memberPhone.trim()) return;

    const newMember: CommitteeMemberRecord = {
      id: `MEM-${Date.now()}`,
      userId: `USR-${Date.now()}`,
      fullName: memberName.trim(),
      mobileNumber: memberPhone.trim(),
      email: memberEmail.trim(),
      role: memberRole,
      assignedResponsibilities: memberResp.split(',').map((r) => r.trim()).filter(Boolean),
      joinedDate: new Date().toISOString().split('T')[0],
      status: 'ACTIVE',
    };

    const updatedMembers = [...selectedCommittee.members, newMember];
    RmsStore.updateCommittee(selectedCommittee.id, { members: updatedMembers });

    setShowAddMemberModal(false);
    setMemberName('');
    setMemberPhone('');
    setMemberEmail('');
    setMemberResp('');
    refreshCommittees();
  };

  const handleTransferMember = () => {
    if (!selectedCommittee || !showTransferMemberModal || !targetCommitteeId) return;

    // Remove from current
    const updatedSourceMembers = selectedCommittee.members.filter(
      (m) => m.id !== showTransferMemberModal.id
    );
    RmsStore.updateCommittee(selectedCommittee.id, { members: updatedSourceMembers });

    // Add to target
    const targetComm = committees.find((c) => c.id === targetCommitteeId);
    if (targetComm) {
      const updatedTargetMembers = [
        ...targetComm.members,
        {
          ...showTransferMemberModal,
          status: 'ACTIVE' as const,
        },
      ];
      RmsStore.updateCommittee(targetCommitteeId, { members: updatedTargetMembers });
    }

    setShowTransferMemberModal(null);
    setTargetCommitteeId('');
    refreshCommittees();
  };

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-black text-slate-900 font-clash flex items-center gap-2">
            <Users className="w-5 h-5 text-sky-600" />
            <span>{language === 'bn' ? 'উপকমিটি ও নেতৃত্ব ব্যবস্থাপনা' : '12 Sub-Committees Management'}</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Dynamic structure of Directors, Assistant Directors, operational rosters, and budgets.
          </p>
        </div>

        <button
          onClick={() => {
            setNameEn('');
            setNameBn('');
            setDirectorName('');
            setDirectorPhone('');
            setDirectorEmail('');
            setMeetingDay('');
            setShowAddModal(true);
          }}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
        >
          <Plus className="w-4 h-4 text-amber-400" />
          <span>{language === 'bn' ? 'নতুন উপকমিটি তৈরি করুন' : 'Create Committee'}</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder={language === 'bn' ? 'কমিটি বা পরিচালকের নাম খুঁজুন...' : 'Search committee or director...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:border-slate-900 focus:outline-hidden"
          />
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setFilterActive(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                filterActive === st
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Committee Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredCommittees.map((comm) => (
          <div
            key={comm.id}
            className={`bg-white rounded-3xl p-5 border transition-all shadow-xs flex flex-col justify-between ${
              comm.isActive ? 'border-slate-200 hover:border-sky-500/60' : 'border-slate-200 opacity-60 bg-slate-50'
            }`}
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-[10px] font-mono font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                    {comm.id}
                  </span>
                  <h3 className="text-sm font-bold text-slate-900 mt-1 leading-snug">
                    {language === 'bn' ? comm.nameBn : comm.nameEn}
                  </h3>
                  <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 leading-relaxed">
                    {language === 'bn' ? comm.descriptionBn : comm.descriptionEn}
                  </p>
                </div>

                <button
                  onClick={() => handleToggleActive(comm)}
                  className={`p-1.5 rounded-lg border transition-colors cursor-pointer shrink-0 ${
                    comm.isActive ? 'text-emerald-700 border-emerald-200 bg-emerald-50' : 'text-slate-400 border-slate-200 bg-slate-100'
                  }`}
                  title={comm.isActive ? 'Deactivate Committee' : 'Activate Committee'}
                >
                  <Power className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Director Details Card */}
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Director</span>
                  <span className="text-[10px] font-bold text-sky-700 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                    In Charge
                  </span>
                </div>
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>{comm.directorName}</span>
                </div>
                <div className="text-[11px] text-slate-600 flex flex-col gap-0.5">
                  {comm.directorPhone && (
                    <div className="flex items-center gap-1">
                      <Phone className="w-3 h-3 text-slate-400" />
                      <span>{comm.directorPhone}</span>
                    </div>
                  )}
                  {comm.directorEmail && (
                    <div className="flex items-center gap-1">
                      <Mail className="w-3 h-3 text-slate-400" />
                      <span>{comm.directorEmail}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Stats Bar */}
              <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-center">
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Budget Allocated</span>
                  <span className="font-bold font-mono text-emerald-700 text-xs">
                    ৳{(comm.budgetAllocated / 1000).toFixed(0)}k
                  </span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-center">
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Members</span>
                  <span className="font-bold font-mono text-slate-900 text-xs">
                    {comm.members.length} Active
                  </span>
                </div>
              </div>

              {comm.meetingDay && (
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>{comm.meetingDay}</span>
                </div>
              )}
            </div>

            {/* Actions footer */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2 mt-3">
              <button
                onClick={() => setSelectedCommittee(comm)}
                className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors cursor-pointer text-center"
              >
                {language === 'bn' ? 'সদস্য তালিকা ও দায়িত্ব' : 'View Members & Roster'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Member List Drawer / Modal */}
      {selectedCommittee && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 border border-slate-200 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-mono font-bold text-sky-700 uppercase">Committee Roster</span>
                <h2 className="text-lg font-black text-slate-900 font-clash">
                  {language === 'bn' ? selectedCommittee.nameBn : selectedCommittee.nameEn}
                </h2>
                <span className="text-xs text-slate-500">
                  Director: <strong className="text-slate-800">{selectedCommittee.directorName}</strong>
                </span>
              </div>

              <button
                onClick={() => setSelectedCommittee(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-700">
                Total Members: {selectedCommittee.members.length}
              </span>
              <button
                onClick={() => setShowAddMemberModal(true)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sky-700 text-white text-xs font-bold cursor-pointer hover:bg-sky-800 transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Add Member</span>
              </button>
            </div>

            {selectedCommittee.members.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs border border-dashed border-slate-200 rounded-2xl">
                No committee members registered yet. Click &quot;Add Member&quot; to assign alumni or volunteers.
              </div>
            ) : (
              <div className="space-y-2.5">
                {selectedCommittee.members.map((mem) => (
                  <div
                    key={mem.id}
                    className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between gap-3"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{mem.fullName}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-100 text-sky-800">
                          {mem.role}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {mem.mobileNumber} • {mem.email || 'No email'}
                      </div>
                      {mem.assignedResponsibilities.length > 0 && (
                        <div className="text-[10px] text-slate-600 font-medium mt-1">
                          Role: {mem.assignedResponsibilities.join(', ')}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => setShowTransferMemberModal(mem)}
                      className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:border-slate-400 text-[11px] font-semibold flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <ArrowRightLeft className="w-3 h-3 text-sky-600" />
                      <span>Transfer</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Committee Member Modal */}
      {showAddMemberModal && selectedCommittee && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 border border-slate-200 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Add Member to {selectedCommittee.nameEn}</h3>
              <button onClick={() => setShowAddMemberModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddMember} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={memberName}
                  onChange={(e) => setMemberName(e.target.value)}
                  placeholder="e.g. Zahid Hasan"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Mobile Number *</label>
                <input
                  type="text"
                  required
                  value={memberPhone}
                  onChange={(e) => setMemberPhone(e.target.value)}
                  placeholder="017xxxxxxxx"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Email</label>
                <input
                  type="email"
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                  placeholder="zahid@gmail.com"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Role</label>
                <select
                  value={memberRole}
                  onChange={(e) => setMemberRole(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                >
                  <option value="MEMBER">Committee Member</option>
                  <option value="ASSISTANT_DIRECTOR">Assistant Director</option>
                  <option value="COORDINATOR">Batch Coordinator</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Assigned Responsibilities (comma separated)</label>
                <input
                  type="text"
                  value={memberResp}
                  onChange={(e) => setMemberResp(e.target.value)}
                  placeholder="e.g. Venue gate inspection, Sound check"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddMemberModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold cursor-pointer hover:bg-slate-800"
                >
                  Save Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Member Modal */}
      {showTransferMemberModal && selectedCommittee && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 border border-slate-200 shadow-2xl">
            <h3 className="text-sm font-bold text-slate-900">
              Transfer {showTransferMemberModal.fullName}
            </h3>
            <p className="text-xs text-slate-500">
              Select destination committee to transfer this member.
            </p>

            <div className="space-y-3 text-xs">
              <label className="block text-slate-700 font-bold">Target Committee</label>
              <select
                value={targetCommitteeId}
                onChange={(e) => setTargetCommitteeId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
              >
                <option value="">Choose committee...</option>
                {committees
                  .filter((c) => c.id !== selectedCommittee.id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nameEn}
                    </option>
                  ))}
              </select>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowTransferMemberModal(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!targetCommitteeId}
                  onClick={handleTransferMember}
                  className="px-4 py-2 rounded-xl bg-sky-700 text-white font-bold cursor-pointer hover:bg-sky-800 disabled:opacity-50"
                >
                  Confirm Transfer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create New Committee Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 border border-slate-200 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 font-clash">Create New Sub-Committee</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCommittee} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Committee Name (English) *</label>
                  <input
                    type="text"
                    required
                    value={nameEn}
                    onChange={(e) => setNameEn(e.target.value)}
                    placeholder="e.g. Medical & Health Support"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Committee Name (Bangla)</label>
                  <input
                    type="text"
                    value={nameBn}
                    onChange={(e) => setNameBn(e.target.value)}
                    placeholder="e.g. চিকিৎসা ও প্রাথমিক সেবা উপকমিটি"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Description (English)</label>
                  <textarea
                    rows={2}
                    value={descEn}
                    onChange={(e) => setDescEn(e.target.value)}
                    placeholder="Key responsibilities and duties..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Description (বাংলা)</label>
                  <textarea
                    rows={2}
                    value={descBn}
                    onChange={(e) => setDescBn(e.target.value)}
                    placeholder="দায়িত্ব ও কার্যাবলি..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                  />
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3">
                <span className="font-bold text-slate-900 block mb-2">Director Information</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    required
                    value={directorName}
                    onChange={(e) => setDirectorName(e.target.value)}
                    placeholder="Director Name *"
                    className="px-3 py-2 rounded-xl border border-slate-300"
                  />
                  <input
                    type="text"
                    value={directorPhone}
                    onChange={(e) => setDirectorPhone(e.target.value)}
                    placeholder="Mobile Phone"
                    className="px-3 py-2 rounded-xl border border-slate-300"
                  />
                  <input
                    type="email"
                    value={directorEmail}
                    onChange={(e) => setDirectorEmail(e.target.value)}
                    placeholder="Email"
                    className="px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Target Budget (BDT)</label>
                  <input
                    type="number"
                    value={budgetTotal}
                    onChange={(e) => setBudgetTotal(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Weekly Meeting Schedule</label>
                  <input
                    type="text"
                    value={meetingDay}
                    onChange={(e) => setMeetingDay(e.target.value)}
                    placeholder="e.g. Every Sunday 6:00 PM"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-slate-900 text-white font-bold cursor-pointer hover:bg-slate-800"
                >
                  Create Committee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
