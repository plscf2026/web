import React, { useState } from 'react';
import {
  Users,
  Plus,
  Search,
  CheckCircle,
  MapPin,
  Clock,
  Phone,
  Calendar,
  AlertTriangle,
  Download,
  LogIn,
  LogOut,
} from 'lucide-react';
import { VolunteerRecord, RmsUser } from '../../types/rms';
import { RmsStore } from '../../services/rmsStore';
import { formatCsvRow } from '../../utils/security';

interface Props {
  currentUser: RmsUser;
  canManage: boolean;
}

export const RmsVolunteersModule: React.FC<Props> = ({ canManage }) => {
  const [volunteers, setVolunteers] = useState<VolunteerRecord[]>(() => RmsStore.getVolunteers());
  const committees = RmsStore.getCommittees();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCommitteeId, setSelectedCommitteeId] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedDate, setSelectedDate] = useState<string>('ALL');

  // Add Volunteer Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [assignedCommId, setAssignedCommId] = useState('registration-database');
  const [assignedLocation, setAssignedLocation] = useState('Gate 01 Registration & ID Desk');
  const [assignedDate, setAssignedDate] = useState('2027-01-28');
  const [dutyStartTime, setDutyStartTime] = useState('08:00');
  const [dutyEndTime, setDutyEndTime] = useState('14:00');
  const [supervisorName, setSupervisorName] = useState('Sagar');
  const [supervisorPhone, setSupervisorPhone] = useState('01711000005');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyRelation, setEmergencyRelation] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');

  const reloadData = () => {
    setVolunteers(RmsStore.getVolunteers());
  };

  const filteredVolunteers = volunteers.filter((vol) => {
    const matchesSearch =
      vol.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vol.phone.includes(searchQuery) ||
      vol.assignedLocation.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesComm = selectedCommitteeId === 'ALL' || vol.assignedCommitteeId === selectedCommitteeId;
    const matchesStatus = selectedStatus === 'ALL' || vol.attendanceStatus === selectedStatus;
    const matchesDate = selectedDate === 'ALL' || vol.assignedDate === selectedDate;
    return matchesSearch && matchesComm && matchesStatus && matchesDate;
  });

  // Analytics Metrics
  const totalVolunteers = volunteers.length;
  const checkedInCount = volunteers.filter((v) => v.attendanceStatus === 'CHECKED_IN').length;
  const completedCount = volunteers.filter((v) => v.attendanceStatus === 'COMPLETED').length;
  const pendingCount = volunteers.filter((v) => v.attendanceStatus === 'PENDING').length;

  const handleAddVolunteer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !phone.trim()) return;

    const newVol: VolunteerRecord = {
      id: `VOL-${Math.floor(100 + Math.random() * 900)}`,
      fullName: fullName.trim(),
      phone: phone.trim(),
      email: email.trim() || undefined,
      assignedCommitteeId: assignedCommId,
      assignedLocation,
      assignedDate,
      dutyStartTime,
      dutyEndTime,
      supervisorName,
      supervisorPhone,
      attendanceStatus: 'PENDING',
      responsibilities: ['Assist attendees and maintain coordination protocol'],
      emergencyContact: {
        name: emergencyName.trim() || 'Central Emergency Desk',
        relation: emergencyRelation.trim() || 'Guardian',
        phone: emergencyPhone.trim() || phone.trim(),
      },
    };

    RmsStore.saveVolunteer(newVol);
    setIsAddModalOpen(false);
    resetForm();
    reloadData();
  };

  const resetForm = () => {
    setFullName('');
    setPhone('');
    setEmail('');
    setAssignedLocation('Gate 01 Registration & ID Desk');
    setAssignedDate('2027-01-28');
    setDutyStartTime('08:00');
    setDutyEndTime('14:00');
    setEmergencyName('');
    setEmergencyRelation('');
    setEmergencyPhone('');
  };

  const handleCheckIn = (id: string) => {
    RmsStore.volunteerCheckIn(id);
    reloadData();
  };

  const handleCheckOut = (id: string) => {
    RmsStore.volunteerCheckOut(id);
    reloadData();
  };

  const handleExportCsv = () => {
    const headers = ['ID', 'Full Name', 'Phone', 'Committee', 'Location', 'Date', 'Shift', 'Status', 'Supervisor'];
    const rows = filteredVolunteers.map((v) =>
      formatCsvRow([
        v.id,
        v.fullName,
        v.phone,
        v.assignedCommitteeId,
        v.assignedLocation,
        v.assignedDate,
        `${v.dutyStartTime}-${v.dutyEndTime}`,
        v.attendanceStatus,
        v.supervisorName,
      ])
    );
    const csvContent = 'data:text/csv;charset=utf-8,' + [formatCsvRow(headers), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `reunion_volunteers_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-emerald-500/10 text-emerald-600 rounded-lg">
              <Users className="w-6 h-6" />
            </span>
            <h1 className="text-2xl font-bold text-slate-900">Volunteer Corps & Duty Rosters</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Manage volunteer shift allocations for January 28 (ID distribution) & January 29 (Grand Reunion), live attendance check-ins, and emergency protocols.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium rounded-xl transition shadow-sm text-sm"
          >
            <Download className="w-4 h-4" /> Export Roster
          </button>
          {canManage && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl transition shadow-sm text-sm"
            >
              <Plus className="w-4 h-4" /> Enlist Volunteer
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Enlisted Corps</span>
          <p className="text-2xl font-black text-slate-900 mt-1">{totalVolunteers}</p>
          <p className="text-xs text-slate-500 mt-1">Active student & alumni volunteers</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Currently On Duty</span>
          <p className="text-2xl font-black text-emerald-600 mt-1">{checkedInCount}</p>
          <p className="text-xs text-slate-500 mt-1">Active on field</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Shift Completed</span>
          <p className="text-2xl font-black text-sky-600 mt-1">{completedCount}</p>
          <p className="text-xs text-slate-500 mt-1">Checked out successfully</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Pending Duty</span>
          <p className="text-2xl font-black text-amber-600 mt-1">{pendingCount}</p>
          <p className="text-xs text-slate-500 mt-1">Upcoming shift assignments</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by volunteer name, phone, location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <select
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700"
          >
            <option value="ALL">All Event Dates</option>
            <option value="2027-01-28">Jan 28, 2027 (ID / Qawwali)</option>
            <option value="2027-01-29">Jan 29, 2027 (Grand Reunion)</option>
          </select>

          <select
            value={selectedCommitteeId}
            onChange={(e) => setSelectedCommitteeId(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700"
          >
            <option value="ALL">All Committees</option>
            {committees.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nameEn}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700"
          >
            <option value="ALL">All Attendance Status</option>
            <option value="CHECKED_IN">Checked In (Active)</option>
            <option value="COMPLETED">Completed</option>
            <option value="PENDING">Pending Arrival</option>
            <option value="ABSENT">Absent</option>
          </select>
        </div>
      </div>

      {/* Volunteer Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredVolunteers.map((vol) => {
          const comm = committees.find((c) => c.id === vol.assignedCommitteeId);

          return (
            <div
              key={vol.id}
              className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">{vol.fullName}</h3>
                    <span className="text-xs text-slate-500 font-mono">{vol.id}</span>
                  </div>
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      vol.attendanceStatus === 'CHECKED_IN'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : vol.attendanceStatus === 'COMPLETED'
                        ? 'bg-sky-50 text-sky-700 border border-sky-200'
                        : vol.attendanceStatus === 'ABSENT'
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}
                  >
                    {vol.attendanceStatus.replace('_', ' ')}
                  </span>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 space-y-2 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-medium text-slate-800">{vol.phone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span className="font-medium text-slate-900">{vol.assignedLocation}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>{vol.assignedDate}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      Shift: {vol.dutyStartTime} - {vol.dutyEndTime}
                    </span>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-slate-50 rounded-xl space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Committee:</span>
                    <span className="font-medium text-slate-800">{comm ? comm.nameEn : vol.assignedCommitteeId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Supervisor:</span>
                    <span className="font-medium text-slate-800">
                      {vol.supervisorName} ({vol.supervisorPhone})
                    </span>
                  </div>
                  {vol.checkInTime && (
                    <div className="flex justify-between text-[11px] text-emerald-700">
                      <span>In Time:</span>
                      <span>{new Date(vol.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  )}
                  {vol.checkOutTime && (
                    <div className="flex justify-between text-[11px] text-sky-700">
                      <span>Out Time:</span>
                      <span>{new Date(vol.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  )}
                </div>

                {vol.emergencyContact && (
                  <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-amber-500" />
                    <span>
                      Emergency: {vol.emergencyContact.name} ({vol.emergencyContact.phone})
                    </span>
                  </div>
                )}
              </div>

              {canManage && (
                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center gap-2">
                  {vol.attendanceStatus === 'PENDING' && (
                    <button
                      onClick={() => handleCheckIn(vol.id)}
                      className="w-full inline-flex items-center justify-center gap-1.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition"
                    >
                      <LogIn className="w-3.5 h-3.5" /> Check-In Shift
                    </button>
                  )}
                  {vol.attendanceStatus === 'CHECKED_IN' && (
                    <button
                      onClick={() => handleCheckOut(vol.id)}
                      className="w-full inline-flex items-center justify-center gap-1.5 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-lg transition"
                    >
                      <LogOut className="w-3.5 h-3.5" /> Check-Out Shift
                    </button>
                  )}
                  {vol.attendanceStatus === 'COMPLETED' && (
                    <div className="w-full text-center py-1.5 text-xs text-slate-500 font-semibold flex items-center justify-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> Duty Completed
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Enlist Volunteer Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Enlist Volunteer to Duty Roster</h2>
            <form onSubmit={handleAddVolunteer} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mahinur Rahman"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Phone Number</label>
                  <input
                    type="text"
                    required
                    placeholder="017XXXXXXXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="volunteer@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Assigned Committee</label>
                  <select
                    value={assignedCommId}
                    onChange={(e) => setAssignedCommId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {committees.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nameEn}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Duty Station / Location</label>
                  <input
                    type="text"
                    required
                    placeholder="Gate 01 / Food Counter"
                    value={assignedLocation}
                    onChange={(e) => setAssignedLocation(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Date</label>
                  <select
                    value={assignedDate}
                    onChange={(e) => setAssignedDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="2027-01-28">Jan 28, 2027</option>
                    <option value="2027-01-29">Jan 29, 2027</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Start Time</label>
                  <input
                    type="time"
                    required
                    value={dutyStartTime}
                    onChange={(e) => setDutyStartTime(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">End Time</label>
                  <input
                    type="time"
                    required
                    value={dutyEndTime}
                    onChange={(e) => setDutyEndTime(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Supervisor Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Sagar"
                    value={supervisorName}
                    onChange={(e) => setSupervisorName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Supervisor Phone</label>
                  <input
                    type="text"
                    required
                    placeholder="017XXXXXXXX"
                    value={supervisorPhone}
                    onChange={(e) => setSupervisorPhone(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600 block">
                  Emergency Contact (Optional)
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="Contact Name"
                    value={emergencyName}
                    onChange={(e) => setEmergencyName(e.target.value)}
                    className="px-2 py-1.5 text-xs border border-slate-200 rounded-lg"
                  />
                  <input
                    type="text"
                    placeholder="Relationship"
                    value={emergencyRelation}
                    onChange={(e) => setEmergencyRelation(e.target.value)}
                    className="px-2 py-1.5 text-xs border border-slate-200 rounded-lg"
                  />
                  <input
                    type="text"
                    placeholder="Contact Phone"
                    value={emergencyPhone}
                    onChange={(e) => setEmergencyPhone(e.target.value)}
                    className="px-2 py-1.5 text-xs border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-sm transition"
                >
                  Enlist Volunteer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
