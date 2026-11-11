import React, { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Radio,
  ShieldAlert,
  Search,
} from 'lucide-react';
import { IncidentReport, RmsUser } from '../../types/rms';
import { RmsStore } from '../../services/rmsStore';
import { AppStore } from '../../services/store';

interface Props {
  currentUser: RmsUser;
  canManage: boolean;
}

export const RmsEventDayModule: React.FC<Props> = ({ currentUser, canManage }) => {
  const [activeDay, setActiveDay] = useState<'DAY_1' | 'DAY_2'>('DAY_2');
  const [incidents, setIncidents] = useState<IncidentReport[]>(() => RmsStore.getIncidents());
  const registrations = AppStore.getRegistrations();
  const volunteers = RmsStore.getVolunteers();
  const scanLogs = AppStore.getScanLogs();

  // Search & Filter for Incidents
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Report Incident Modal
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [incidentType, setIncidentType] = useState<IncidentReport['incidentType']>('TECHNICAL');
  const [severity, setSeverity] = useState<IncidentReport['severity']>('MEDIUM');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [assignedTeam, setAssignedTeam] = useState('Venue Coordination Desk');

  // Resolve Modal
  const [selectedIncident, setSelectedIncident] = useState<IncidentReport | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');

  const reloadData = () => {
    setIncidents(RmsStore.getIncidents());
  };

  const filteredIncidents = incidents.filter((inc) => {
    const matchesSearch =
      inc.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inc.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inc.reportedByName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSev = selectedSeverity === 'ALL' || inc.severity === selectedSeverity;
    const matchesStat = selectedStatus === 'ALL' || inc.resolutionStatus === selectedStatus;
    return matchesSearch && matchesSev && matchesStat;
  });

  // Telemetry Calculations
  const totalRegistered = registrations.length;
  const gateEntries = scanLogs.filter((l) => l.scanType === 'entry' && l.status === 'approved').length;
  const foodDelivered = Math.round(gateEntries * 0.9);
  const dressDelivered = registrations.filter((r) => r.isTShirtCollected).length;
  const activeVolunteersCount = volunteers.filter((v) => v.attendanceStatus === 'CHECKED_IN').length;

  const handleReportIncident = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !location.trim()) return;

    RmsStore.reportIncident({
      incidentType,
      severity,
      location: location.trim(),
      description: description.trim(),
      reportedBy: currentUser.id,
      reportedByName: `${currentUser.fullName} (${currentUser.role.replace('_', ' ')})`,
      assignedTeam,
    });

    setIsReportModalOpen(false);
    setLocation('');
    setDescription('');
    reloadData();
  };

  const handleUpdateStatus = (incidentId: string, status: IncidentReport['resolutionStatus'], notes?: string) => {
    RmsStore.updateIncidentStatus(incidentId, status, notes);
    setSelectedIncident(null);
    setResolutionNotes('');
    reloadData();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Emergency Radio Signal */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-lg">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
            </span>
            <div className="flex items-center gap-2">
              <Radio className="w-5 h-5 text-rose-400" />
              <h1 className="text-2xl font-black tracking-tight">Event Day Operations Command Center</h1>
            </div>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Real-time live telemetry, stage readiness telemetry, and incident dispatch for Sylhet Police Lines High School & College Reunion 2027.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Day Switcher */}
          <div className="bg-slate-800 p-1 rounded-xl flex items-center gap-1 border border-slate-700">
            <button
              onClick={() => setActiveDay('DAY_1')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                activeDay === 'DAY_1' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Day 1 (Jan 28)
            </button>
            <button
              onClick={() => setActiveDay('DAY_2')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                activeDay === 'DAY_2' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Day 2 (Jan 29) Main
            </button>
          </div>

          {canManage && (
            <button
              onClick={() => setIsReportModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-md transition"
            >
              <AlertTriangle className="w-4 h-4" /> Report Incident
            </button>
          )}
        </div>
      </div>

      {/* Telemetry Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Registered</span>
          <p className="text-2xl font-black text-slate-900 mt-1">{totalRegistered}</p>
          <p className="text-[11px] text-slate-500 mt-1">Alumni & Current Students</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Gate Check-Ins</span>
          <p className="text-2xl font-black text-emerald-600 mt-1">{gateEntries}</p>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
            <div
              className="bg-emerald-500 h-1.5 rounded-full"
              style={{ width: `${totalRegistered > 0 ? (gateEntries / totalRegistered) * 100 : 0}%` }}
            />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600">Buffet Servings</span>
          <p className="text-2xl font-black text-amber-600 mt-1">{foodDelivered}</p>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
            <div
              className="bg-amber-500 h-1.5 rounded-full"
              style={{ width: `${totalRegistered > 0 ? (foodDelivered / totalRegistered) * 100 : 0}%` }}
            />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-sky-600">Gift Bags & Dress</span>
          <p className="text-2xl font-black text-sky-600 mt-1">{dressDelivered}</p>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
            <div
              className="bg-sky-500 h-1.5 rounded-full"
              style={{ width: `${totalRegistered > 0 ? (dressDelivered / totalRegistered) * 100 : 0}%` }}
            />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm col-span-2 lg:col-span-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-purple-600">Active Volunteers</span>
          <p className="text-2xl font-black text-purple-600 mt-1">{activeVolunteersCount}</p>
          <p className="text-[11px] text-slate-500 mt-1">Field deployed right now</p>
        </div>
      </div>

      {/* Program Schedule & Readiness Monitor */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Timeline */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-600" />
              <h2 className="font-bold text-slate-900 text-lg">
                {activeDay === 'DAY_1' ? 'January 28, 2027 Schedule' : 'January 29, 2027 Main Reunion Schedule'}
              </h2>
            </div>
            <span className="text-xs px-2.5 py-1 bg-indigo-50 text-indigo-700 font-semibold rounded-full">
              {activeDay === 'DAY_1' ? 'Registration & Cultural Eve' : 'Grand Reunion Day'}
            </span>
          </div>

          <div className="mt-6 space-y-6">
            {activeDay === 'DAY_1' ? (
              <>
                <div className="flex gap-4 items-start">
                  <div className="w-20 text-xs font-bold text-indigo-600 pt-0.5">08:00 AM</div>
                  <div className="w-2 h-2 rounded-full bg-indigo-600 mt-1.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-slate-900">Participant Registration & ID Card Distribution</h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Multi-station verification desk at School Campus. Distribution of delegate folders, ID tags, and commemorative t-shirts.
                    </p>
                    <span className="inline-block mt-2 text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded">
                      Registration Desk Active
                    </span>
                  </div>
                </div>

                <div className="flex gap-4 items-start">
                  <div className="w-20 text-xs font-bold text-indigo-600 pt-0.5">03:00 PM</div>
                  <div className="w-2 h-2 rounded-full bg-indigo-600 mt-1.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-slate-900">Stage & Sound Final Technical Soundcheck</h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Joint inspection by Event Management & Production committee and Cultural affairs team.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4 items-start">
                  <div className="w-20 text-xs font-bold text-indigo-600 pt-0.5">06:00 PM</div>
                  <div className="w-2 h-2 rounded-full bg-purple-600 mt-1.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-slate-900">Evening Traditional Qawwali Program</h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Traditional sufi and spiritual musical evening featuring master vocalists and guest musicians.
                    </p>
                    <span className="inline-block mt-2 text-[10px] font-bold px-2 py-0.5 bg-purple-100 text-purple-800 rounded">
                      Evening Highlight
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex gap-4 items-start">
                  <div className="w-20 text-xs font-bold text-rose-600 pt-0.5">07:30 AM</div>
                  <div className="w-2 h-2 rounded-full bg-rose-600 mt-1.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-slate-900">Colorful Grand Procession / Ananda Shovajatra</h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Flag-off by Institution Principal, Convener Monowar Shikder & Member Secretary Siddiqur Rahman from School grounds around city thoroughfares.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4 items-start">
                  <div className="w-20 text-xs font-bold text-rose-600 pt-0.5">09:30 AM</div>
                  <div className="w-2 h-2 rounded-full bg-rose-600 mt-1.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-slate-900">National Anthem, Flag Hoisting & Opening Ceremony</h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Release of balloons & pigeons at Police Lines Large Field. Welcome address by central organizing leadership.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4 items-start">
                  <div className="w-20 text-xs font-bold text-rose-600 pt-0.5">01:00 PM</div>
                  <div className="w-2 h-2 rounded-full bg-amber-600 mt-1.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-slate-900">Grand Reunion Banquet Lunch & Networking</h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Buffet meal distribution across 8 pavilions supervised by Food & Catering Committee.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4 items-start">
                  <div className="w-20 text-xs font-bold text-rose-600 pt-0.5">04:30 PM</div>
                  <div className="w-2 h-2 rounded-full bg-purple-600 mt-1.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-slate-900">Mega Cultural Concert & Celebrity Band Night</h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Performances by institutional alumni performers followed by leading national band headlines.
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Readiness Checklist */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
              <Activity className="w-5 h-5 text-emerald-600" />
              <h2 className="font-bold text-slate-900 text-lg">Field Readiness Checks</h2>
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between p-3 bg-emerald-50/60 border border-emerald-100 rounded-xl">
                <span className="text-xs font-bold text-emerald-900">Main Stage LED & Line Array Sound</span>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-200 text-emerald-800 rounded">
                  100% READY
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-emerald-50/60 border border-emerald-100 rounded-xl">
                <span className="text-xs font-bold text-emerald-900">Police Security Barricades & Cordon</span>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-200 text-emerald-800 rounded">
                  VERIFIED
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-emerald-50/60 border border-emerald-100 rounded-xl">
                <span className="text-xs font-bold text-emerald-900">Generator & Dual Power Redundancy</span>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-200 text-emerald-800 rounded">
                  ONLINE
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-emerald-50/60 border border-emerald-100 rounded-xl">
                <span className="text-xs font-bold text-emerald-900">First Aid & Ambulance Standby</span>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-200 text-emerald-800 rounded">
                  DEPLOYED
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-emerald-50/60 border border-emerald-100 rounded-xl">
                <span className="text-xs font-bold text-emerald-900">VIP Guest Reception Protocol</span>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-200 text-emerald-800 rounded">
                  ACTIVE
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <span className="text-xs text-slate-400">All systems operating within normal parameters</span>
          </div>
        </div>
      </div>

      {/* Incident Reporting Desk */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-600" />
              <h2 className="text-lg font-bold text-slate-900">Incident Dispatch & Resolution Desk</h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Active security alerts, medical assists, crowd flow bottlenecks, lost & found logs, and quick response dispatches.
            </p>
          </div>

          {canManage && (
            <button
              onClick={() => setIsReportModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-xl text-xs transition shadow-sm"
            >
              <AlertTriangle className="w-4 h-4" /> Log New Incident
            </button>
          )}
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search incidents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-700"
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-700"
            >
              <option value="ALL">All Statuses</option>
              <option value="REPORTED">Reported</option>
              <option value="INVESTIGATING">Investigating</option>
              <option value="RESOLVED">Resolved</option>
            </select>
          </div>
        </div>

        {/* Incident Stream */}
        <div className="space-y-3">
          {filteredIncidents.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">
              No incidents reported matching the selected filters.
            </div>
          ) : (
            filteredIncidents.map((inc) => (
              <div
                key={inc.id}
                className={`p-4 rounded-xl border transition flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  inc.severity === 'CRITICAL'
                    ? 'bg-rose-50/50 border-rose-200'
                    : inc.severity === 'HIGH'
                    ? 'bg-amber-50/50 border-amber-200'
                    : 'bg-white border-slate-200'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        inc.severity === 'CRITICAL'
                          ? 'bg-rose-600 text-white'
                          : inc.severity === 'HIGH'
                          ? 'bg-amber-600 text-white'
                          : inc.severity === 'MEDIUM'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {inc.severity}
                    </span>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                      {inc.incidentType.replace('_', ' ')}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">#{inc.id}</span>
                  </div>

                  <p className="text-sm font-semibold text-slate-900">{inc.description}</p>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <span>Location: <strong className="text-slate-700">{inc.location}</strong></span>
                    <span>Reported by: <strong className="text-slate-700">{inc.reportedByName}</strong></span>
                    <span>Assigned Unit: <strong className="text-slate-700">{inc.assignedTeam}</strong></span>
                    <span>Time: {new Date(inc.reportedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>

                  {inc.resolutionNotes && (
                    <div className="mt-2 text-xs text-emerald-800 bg-emerald-50 p-2 rounded-lg border border-emerald-100">
                      <strong>Resolution Note:</strong> {inc.resolutionNotes} (Resolved at{' '}
                      {inc.resolvedAt ? new Date(inc.resolvedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'now'})
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase ${
                      inc.resolutionStatus === 'RESOLVED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : inc.resolutionStatus === 'IN_PROGRESS'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {inc.resolutionStatus.replace('_', ' ')}
                  </span>

                  {canManage && inc.resolutionStatus !== 'RESOLVED' && (
                    <div className="flex items-center gap-1">
                      {inc.resolutionStatus === 'REPORTED' && (
                        <button
                          onClick={() => handleUpdateStatus(inc.id, 'IN_PROGRESS')}
                          className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg"
                        >
                          Dispatched
                        </button>
                      )}
                      <button
                        onClick={() => setSelectedIncident(inc)}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1"
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> Resolve
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Resolution Notes Modal */}
      {selectedIncident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="font-bold text-slate-900 text-lg">Mark Incident as Resolved</h3>
            <p className="text-xs text-slate-500 mt-1">Incident: #{selectedIncident.id} - {selectedIncident.location}</p>

            <div className="mt-4">
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Resolution Action Taken
              </label>
              <textarea
                rows={3}
                required
                placeholder="Explain how the incident was safely resolved..."
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedIncident(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleUpdateStatus(selectedIncident.id, 'RESOLVED', resolutionNotes)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg"
              >
                Confirm Resolution
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Incident Modal */}
      {isReportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Report Field Incident</h2>
            <form onSubmit={handleReportIncident} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Incident Category</label>
                  <select
                    value={incidentType}
                    onChange={(e) => setIncidentType(e.target.value as IncidentReport['incidentType'])}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                  >
                    <option value="SECURITY">Security / Discipline</option>
                    <option value="MEDICAL">Medical Emergency</option>
                    <option value="TECHNICAL">Technical / Sound / Power</option>
                    <option value="CROWD_MANAGEMENT">Crowd Bottleneck</option>
                    <option value="FOOD_BEVERAGE">Food & Beverage Issue</option>
                    <option value="LOST_FOUND">Lost & Found</option>
                    <option value="OTHER">Other Field Issue</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Severity Level</label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as IncidentReport['severity'])}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical (Immediate Response)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Specific Location</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Gate 02 Entrance Barricade / VIP Dining Pavilion"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Assigned Response Team</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Security & Discipline Unit / Medical First Aid"
                  value={assignedTeam}
                  onChange={(e) => setAssignedTeam(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Description of Incident</label>
                <textarea
                  rows={3}
                  required
                  placeholder="State the observed situation accurately..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsReportModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-xl shadow-sm transition"
                >
                  Dispatch Incident
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
