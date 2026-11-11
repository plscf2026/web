import React, { useState } from 'react';
import {
  Users,
  Search,
  Download,
  Phone,
  Mail,
  Eye,
  Plus,
  X,
} from 'lucide-react';
import { RegistrationRecord, Language } from '../../../types';
import { RmsStore } from '../../../services/rmsStore';
import { formatCsvRow } from '../../../utils/security';

interface Props {
  language: Language;
  registrations: RegistrationRecord[];
}

export const AdminRmsMemberManagement: React.FC<Props> = ({
  registrations,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'former' | 'current'>('all');
  const [selectedCommitteeFilter, setSelectedCommitteeFilter] = useState<string>('all');
  const [selectedMember, setSelectedMember] = useState<RegistrationRecord | null>(null);

  // Committee assignment modal
  const [assigningMember, setAssigningMember] = useState<RegistrationRecord | null>(null);
  const [targetCommitteeId, setTargetCommitteeId] = useState('registration-database');
  const [targetRole, setTargetRole] = useState<'DIRECTOR' | 'ASSISTANT_DIRECTOR' | 'MEMBER' | 'COORDINATOR'>('MEMBER');

  const committees = RmsStore.getCommittees();

  // Map committee assignments for quick lookup
  const memberCommitteeMap: Record<string, { committeeName: string; role: string }[]> = {};
  committees.forEach((comm) => {
    comm.members.forEach((m) => {
      // Key by mobile or full name
      const key = m.mobileNumber || m.fullName;
      if (!memberCommitteeMap[key]) memberCommitteeMap[key] = [];
      memberCommitteeMap[key].push({ committeeName: comm.nameEn, role: m.role });
    });
  });

  const filteredMembers = registrations.filter((reg) => {
    const matchesSearch =
      reg.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      reg.mobileNumber.includes(searchQuery) ||
      reg.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (reg.studentId && reg.studentId.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCat = selectedCategory === 'all' || reg.category === selectedCategory;

    let matchesComm = true;
    if (selectedCommitteeFilter !== 'all') {
      const comm = committees.find((c) => c.id === selectedCommitteeFilter);
      const isMember = comm?.members.some(
        (m) => m.mobileNumber === reg.mobileNumber || m.fullName.toLowerCase() === reg.fullName.toLowerCase()
      );
      matchesComm = Boolean(isMember);
    }

    return matchesSearch && matchesCat && matchesComm;
  });

  const handleAssignToCommittee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningMember) return;

    const comm = committees.find((c) => c.id === targetCommitteeId);
    if (!comm) return;

    const alreadyMember = comm.members.some((m) => m.mobileNumber === assigningMember.mobileNumber);
    if (!alreadyMember) {
      const updatedMembers = [
        ...comm.members,
        {
          id: `MEM-${Date.now().toString().slice(-4)}`,
          userId: `USR-${Date.now().toString().slice(-4)}`,
          fullName: assigningMember.fullName,
          mobileNumber: assigningMember.mobileNumber,
          email: assigningMember.email || `${assigningMember.fullName.toLowerCase().replace(/\s+/g, '')}@policelines.edu.bd`,
          role: targetRole,
          assignedResponsibilities: ['Committee Support & Coordination'],
          joinedDate: new Date().toISOString(),
          status: 'ACTIVE' as const,
        },
      ];
      RmsStore.updateCommittee(comm.id, { members: updatedMembers });
    }

    setAssigningMember(null);
  };

  const handleExportCsv = () => {
    const headers = ['Registration ID', 'Full Name', 'Category', 'Batch/Class', 'Year', 'Mobile Number', 'Email', 'T-Shirt Size', 'Payment Status', 'Committee Assignments'];
    const rows = filteredMembers.map((m) => {
      const assignments = memberCommitteeMap[m.mobileNumber] || memberCommitteeMap[m.fullName] || [];
      const commText = assignments.map((a) => `${a.committeeName} (${a.role})`).join('; ');
      return formatCsvRow([
        m.id,
        m.fullName,
        m.category,
        m.batchName,
        m.passingYear || m.currentClass || '',
        m.mobileNumber,
        m.email || '',
        m.tShirtSize,
        m.paymentStatus,
        commText,
      ]);
    });
    const csvContent = 'data:text/csv;charset=utf-8,' + [formatCsvRow(headers), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `reunion_members_directory_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-blue-50 text-blue-700 rounded-xl">
              <Users className="w-6 h-6" />
            </span>
            <h2 className="text-2xl font-bold text-slate-900">Central Member & Attendee Directory</h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Search all registered attendees, manage multi-committee appointments, and view contact profiles without exposing sensitive credentials.
          </p>
        </div>

        <button
          onClick={handleExportCsv}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition shadow-xs cursor-pointer"
        >
          <Download className="w-4 h-4 text-emerald-400" />
          <span>Export Directory CSV</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by student name, mobile, or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value as any)}
            className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 font-semibold cursor-pointer"
          >
            <option value="all">All Categories</option>
            <option value="former">Alumni</option>
            <option value="current">Current Students</option>
          </select>

          <select
            value={selectedCommitteeFilter}
            onChange={(e) => setSelectedCommitteeFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 font-semibold cursor-pointer"
          >
            <option value="all">All Committee Memberships</option>
            {committees.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nameEn}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Member Directory Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Attendee Profile</th>
                <th className="px-6 py-4">Batch / Class</th>
                <th className="px-6 py-4">Contact Details</th>
                <th className="px-6 py-4">T-Shirt & Payment</th>
                <th className="px-6 py-4">Committee Roles</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 text-sm">
                    No registered members found matching the filter criteria.
                  </td>
                </tr>
              ) : (
                filteredMembers.map((member) => {
                  const assignments =
                    memberCommitteeMap[member.mobileNumber] ||
                    memberCommitteeMap[member.fullName] ||
                    [];

                  return (
                    <tr key={member.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={member.photoUrl}
                            alt={member.fullName}
                            className="w-10 h-10 rounded-xl object-cover border border-slate-200 flex-shrink-0"
                          />
                          <div>
                            <span className="font-bold text-slate-900 text-sm block leading-tight">
                              {member.fullName}
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono">
                              #{member.id} {member.studentId ? `• ID: ${member.studentId}` : ''}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-slate-900 text-sm block">{member.batchName}</span>
                        <span className="text-[11px] text-slate-500">
                          {member.category === 'former' ? `Passing Year: ${member.passingYear || 'N/A'}` : `Class: ${member.currentClass || 'Enrolled'}`}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1 font-mono text-slate-800 font-semibold">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{member.mobileNumber}</span>
                          </div>
                          {member.email ? (
                            <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
                              <Mail className="w-3 h-3 text-slate-400" />
                              <span className="truncate max-w-[140px]">{member.email}</span>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">No email provided</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <span className="inline-block px-2 py-0.5 bg-slate-100 rounded text-[11px] font-bold text-slate-700">
                            Size: {member.tShirtSize}
                          </span>
                          <span
                            className={`block text-[10px] font-bold uppercase tracking-wider ${
                              member.paymentStatus === 'paid' ? 'text-emerald-700' : 'text-amber-700'
                            }`}
                          >
                            ● {member.paymentStatus}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {assignments.length > 0 ? (
                          <div className="space-y-1">
                            {assignments.map((a, idx) => (
                              <span
                                key={idx}
                                className="inline-block mr-1 px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded text-[10px] font-bold"
                              >
                                {a.committeeName}: {a.role.replace('_', ' ')}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-xs">General Attendee</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setSelectedMember(member)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition cursor-pointer"
                            title="Inspect Attendee Profile"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setAssigningMember(member)}
                            className="p-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg transition cursor-pointer"
                            title="Assign to Committee"
                          >
                            <Plus className="w-4 h-4" />
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
      </div>

      {/* Inspect Member Details Modal */}
      {selectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-lg">Attendee Profile Card</h3>
              <button
                onClick={() => setSelectedMember(null)}
                className="text-slate-400 hover:text-slate-600 font-bold p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-4">
              <img
                src={selectedMember.photoUrl}
                alt={selectedMember.fullName}
                className="w-20 h-20 rounded-2xl object-cover border-2 border-slate-200 shadow-xs"
              />
              <div>
                <h4 className="font-bold text-slate-900 text-lg">{selectedMember.fullName}</h4>
                <p className="text-xs text-slate-500">{selectedMember.batchName}</p>
                <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-50 text-blue-800">
                  {selectedMember.category === 'former' ? 'Alumni Participant' : 'Current Enrolled Student'}
                </span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl space-y-2 text-xs text-slate-600">
              <div className="flex justify-between">
                <span className="text-slate-400">Registration ID:</span>
                <span className="font-mono font-bold text-slate-900">{selectedMember.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Mobile Phone:</span>
                <span className="font-mono font-bold text-slate-900">{selectedMember.mobileNumber}</span>
              </div>
              {selectedMember.email && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Email Address:</span>
                  <span className="text-slate-900">{selectedMember.email}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-400">T-Shirt Size:</span>
                <span className="font-bold text-slate-900">{selectedMember.tShirtSize}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total Paid:</span>
                <span className="font-black text-emerald-600">৳{(selectedMember.totalPaid || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Gateway Trx ID:</span>
                <span className="font-mono text-slate-700">{selectedMember.transactionId}</span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedMember(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Member to Committee Modal */}
      {assigningMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="font-bold text-slate-900 text-lg">Appoint to Sub-Committee</h3>
            <p className="text-xs text-slate-500 mt-1">Attendee: {assigningMember.fullName} ({assigningMember.batchName})</p>

            <form onSubmit={handleAssignToCommittee} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Target Committee *
                </label>
                <select
                  value={targetCommitteeId}
                  onChange={(e) => setTargetCommitteeId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                >
                  {committees.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nameEn}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Designated Role in Committee *
                </label>
                <select
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                >
                  <option value="MEMBER">Committee Member</option>
                  <option value="ASSISTANT_DIRECTOR">Assistant Director</option>
                  <option value="ADVISER">Adviser</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAssigningMember(null)}
                  className="px-4 py-2 font-bold text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl"
                >
                  Confirm Appointment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
