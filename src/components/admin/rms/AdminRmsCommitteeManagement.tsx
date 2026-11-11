import React, { useState } from 'react';
import {
  Building,
  Plus,
  Search,
  Phone,
  UserPlus,
  Users,
  Trash2,
  X,
} from 'lucide-react';
import { CommitteeRecord, CommitteeMemberRecord } from '../../../types/rms';
import { Language } from '../../../types';
import { RmsStore } from '../../../services/rmsStore';

interface Props {
  language: Language;
}

export const AdminRmsCommitteeManagement: React.FC<Props> = () => {
  const [committees, setCommittees] = useState<CommitteeRecord[]>(() => RmsStore.getCommittees());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCommittee, setSelectedCommittee] = useState<CommitteeRecord | null>(null);

  // New Committee Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [nameEn, setNameEn] = useState('');
  const [nameBn, setNameBn] = useState('');
  const [descEn, setDescEn] = useState('');
  const [directorName, setDirectorName] = useState('');
  const [directorPhone, setDirectorPhone] = useState('');
  const [directorEmail, setDirectorEmail] = useState('');
  const [proposedBudget, setProposedBudget] = useState<number>(300000);
  const [responsibilitiesText, setResponsibilitiesText] = useState('');

  // Add Member Modal State
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [memberName, setMemberName] = useState('');
  const [memberPhone, setMemberPhone] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberRole, setMemberRole] = useState<'DIRECTOR' | 'ASSISTANT_DIRECTOR' | 'MEMBER' | 'COORDINATOR'>('MEMBER');

  const reloadData = () => {
    const list = RmsStore.getCommittees();
    setCommittees(list);
    if (selectedCommittee) {
      const refreshed = list.find((c) => c.id === selectedCommittee.id);
      if (refreshed) setSelectedCommittee(refreshed);
    }
  };

  const filteredCommittees = committees.filter((comm) => {
    return (
      comm.nameEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      comm.nameBn.includes(searchQuery) ||
      comm.directorName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const handleCreateCommittee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameEn.trim() || !directorName.trim()) return;

    const responsibilities = responsibilitiesText
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    RmsStore.createCommittee({
      nameEn: nameEn.trim(),
      nameBn: nameBn.trim() || nameEn.trim(),
      descriptionEn: descEn.trim() || 'Sub-committee responsible for designated reunion deliverables.',
      descriptionBn: nameBn.trim() || nameEn.trim(),
      directorId: `DIR-${Date.now().toString().slice(-4)}`,
      directorName: directorName.trim(),
      directorPhone: directorPhone.trim() || '01700000000',
      directorEmail: directorEmail.trim() || 'director@policelines.edu.bd',
      assistantDirectorIds: [],
      assistantDirectorNames: [],
      members: [
        {
          id: `MEM-${Date.now().toString().slice(-4)}`,
          userId: `USR-${Date.now().toString().slice(-4)}`,
          fullName: directorName.trim(),
          mobileNumber: directorPhone.trim() || '01700000000',
          email: directorEmail.trim() || 'director@policelines.edu.bd',
          role: 'DIRECTOR',
          assignedResponsibilities: ['Overall Committee Leadership & Strategic Execution'],
          joinedDate: new Date().toISOString(),
          status: 'ACTIVE',
        },
      ],
      assignedResponsibilities: responsibilities.length > 0 ? responsibilities : ['Event preparation and coordination'],
      budgetTotal: proposedBudget,
      budgetAllocated: proposedBudget * 0.8,
      budgetSpent: 0,
      meetingDay: 'Friday 4:00 PM',
      isActive: true,
    });

    setIsAddModalOpen(false);
    resetForm();
    reloadData();
  };

  const resetForm = () => {
    setNameEn('');
    setNameBn('');
    setDescEn('');
    setDirectorName('');
    setDirectorPhone('');
    setDirectorEmail('');
    setProposedBudget(300000);
    setResponsibilitiesText('');
  };

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCommittee || !memberName.trim() || !memberPhone.trim()) return;

    const newMember: CommitteeMemberRecord = {
      id: `MEM-${Date.now().toString().slice(-4)}`,
      userId: `USR-${Date.now().toString().slice(-4)}`,
      fullName: memberName.trim(),
      mobileNumber: memberPhone.trim(),
      email: memberEmail.trim() || `${memberName.toLowerCase().replace(/\s+/g, '')}@policelines.edu.bd`,
      role: memberRole,
      assignedResponsibilities: ['Assigned Committee Tasks'],
      joinedDate: new Date().toISOString(),
      status: 'ACTIVE',
    };

    const updatedMembers = [...selectedCommittee.members, newMember];
    RmsStore.updateCommittee(selectedCommittee.id, { members: updatedMembers });

    setIsAddMemberModalOpen(false);
    setMemberName('');
    setMemberPhone('');
    setMemberEmail('');
    setMemberRole('MEMBER');
    reloadData();
  };

  const handleRemoveMember = (memberId: string) => {
    if (!selectedCommittee) return;
    const updatedMembers = selectedCommittee.members.filter((m) => m.id !== memberId);
    RmsStore.updateCommittee(selectedCommittee.id, { members: updatedMembers });
    reloadData();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-purple-50 text-purple-700 rounded-xl">
              <Building className="w-6 h-6" />
            </span>
            <h2 className="text-2xl font-bold text-slate-900">Dynamic Committee Management</h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Configure organizing sub-committees, appoint Directors and Assistant Directors, allocate operational budgets, and track real-time deliverable execution.
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs transition shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Create Sub-Committee</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by committee name or director..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <span className="text-xs font-bold text-slate-500">
          {filteredCommittees.length} Active Committees
        </span>
      </div>

      {/* Committees Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCommittees.map((comm) => {
          const spentPercent =
            comm.budgetAllocated > 0 ? Math.round((comm.budgetSpent / comm.budgetAllocated) * 100) : 0;

          return (
            <div
              key={comm.id}
              className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs hover:shadow-md transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="p-2.5 bg-purple-50 rounded-2xl text-purple-700">
                    <Building className="w-5 h-5" />
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                      comm.isActive
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {comm.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <h3 className="font-bold text-slate-900 text-base mt-3 leading-snug">{comm.nameEn}</h3>
                <p className="text-xs text-purple-700 font-semibold">{comm.nameBn}</p>
                <p className="text-xs text-slate-600 mt-2 line-clamp-2 leading-relaxed">{comm.descriptionEn}</p>

                {/* Director Card */}
                <div className="mt-4 p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1.5 text-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Committee Director
                  </span>
                  <div className="font-bold text-slate-900">{comm.directorName}</div>
                  <div className="flex items-center gap-1.5 text-slate-500 font-mono text-[11px]">
                    <Phone className="w-3 h-3 text-slate-400" />
                    <span>{comm.directorPhone}</span>
                  </div>
                </div>

                {/* Financial Progress Bar */}
                <div className="mt-4 p-3 bg-slate-50 rounded-2xl space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Allocated Budget:</span>
                    <span className="font-bold text-slate-900">৳{comm.budgetAllocated.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Disbursed:</span>
                    <span className="font-bold text-emerald-600">
                      ৳{comm.budgetSpent.toLocaleString()} ({spentPercent}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-1.5 rounded-full"
                      style={{ width: `${Math.min(spentPercent, 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-500 flex items-center gap-1 font-semibold">
                  <Users className="w-4 h-4 text-slate-400" />
                  {comm.members.length} Members
                </span>

                <button
                  onClick={() => setSelectedCommittee(comm)}
                  className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Manage Roster
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Committee Member Roster Drawer Modal */}
      {selectedCommittee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-purple-600">
                  Sub-Committee Roster & Duties
                </span>
                <h3 className="font-bold text-slate-900 text-xl mt-0.5">{selectedCommittee.nameEn}</h3>
                <p className="text-xs text-slate-500">Director: {selectedCommittee.directorName}</p>
              </div>
              <button
                onClick={() => setSelectedCommittee(null)}
                className="text-slate-400 hover:text-slate-600 font-bold p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Responsibilities list */}
            <div className="p-3 bg-purple-50/60 rounded-2xl border border-purple-100 text-xs text-purple-950 space-y-1">
              <span className="font-bold uppercase text-[10px] tracking-wider text-purple-800 block">
                Assigned Responsibilities
              </span>
              <ul className="list-disc pl-4 space-y-0.5">
                {selectedCommittee.assignedResponsibilities.map((resp, idx) => (
                  <li key={idx}>{resp}</li>
                ))}
              </ul>
            </div>

            {/* Member List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Appointed Members ({selectedCommittee.members.length})
                </h4>
                <button
                  onClick={() => setIsAddMemberModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Add Member</span>
                </button>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1 divide-y divide-slate-100 text-xs">
                {selectedCommittee.members.map((m) => (
                  <div key={m.id} className="py-2.5 flex items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{m.fullName}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            m.role === 'DIRECTOR'
                              ? 'bg-purple-100 text-purple-800'
                              : m.role === 'ASSISTANT_DIRECTOR'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {m.role.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-3">
                        <span>{m.mobileNumber}</span>
                        {m.email && <span>{m.email}</span>}
                      </div>
                    </div>

                    {m.role !== 'DIRECTOR' && (
                      <button
                        onClick={() => handleRemoveMember(m.id)}
                        className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition"
                        title="Remove Member from Committee"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedCommittee(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold"
              >
                Close Roster
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {isAddMemberModalOpen && selectedCommittee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="font-bold text-slate-900 text-lg">Add Member to {selectedCommittee.nameEn}</h3>
            <form onSubmit={handleAddMember} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Farhana Yasmin"
                  value={memberName}
                  onChange={(e) => setMemberName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Phone Number *</label>
                <input
                  type="text"
                  required
                  placeholder="017XXXXXXXX"
                  value={memberPhone}
                  onChange={(e) => setMemberPhone(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Email</label>
                <input
                  type="email"
                  placeholder="member@example.com"
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Role in Committee</label>
                <select
                  value={memberRole}
                  onChange={(e) => setMemberRole(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="MEMBER">Committee Member</option>
                  <option value="ASSISTANT_DIRECTOR">Assistant Director</option>
                  <option value="ADVISER">Adviser</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddMemberModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl"
                >
                  Save Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Sub-Committee Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-slate-900 text-lg">Create New Organizing Sub-Committee</h3>
            <form onSubmit={handleCreateCommittee} className="space-y-4 mt-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Name (English) *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Medical & First Aid"
                    value={nameEn}
                    onChange={(e) => setNameEn(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Name (বাংলা)</label>
                  <input
                    type="text"
                    placeholder="যেমন: প্রাথমিক চিকিৎসা ও সেবা"
                    value={nameBn}
                    onChange={(e) => setNameBn(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Key responsibilities and duties..."
                  value={descEn}
                  onChange={(e) => setDescEn(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Director Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dr. Rafiqul Islam"
                    value={directorName}
                    onChange={(e) => setDirectorName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Director Phone *</label>
                  <input
                    type="text"
                    required
                    placeholder="017XXXXXXXX"
                    value={directorPhone}
                    onChange={(e) => setDirectorPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Director Email</label>
                  <input
                    type="email"
                    placeholder="director@example.com"
                    value={directorEmail}
                    onChange={(e) => setDirectorEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Proposed Budget (৳)</label>
                  <input
                    type="number"
                    min="1000"
                    value={proposedBudget}
                    onChange={(e) => setProposedBudget(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Assigned Responsibilities (One per line)
                </label>
                <textarea
                  rows={2}
                  placeholder="Ambulance deployment&#10;First aid supplies"
                  value={responsibilitiesText}
                  onChange={(e) => setResponsibilitiesText(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 font-bold text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl"
                >
                  Create Sub-Committee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
