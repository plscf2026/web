import React, { useState } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Plus,
  Users,
  CheckCircle,
  XCircle,
  FileCheck,
  ChevronRight,
  ListOrdered,
} from 'lucide-react';
import { RmsMeeting, RmsUser } from '../../types/rms';
import { RmsStore } from '../../services/rmsStore';

interface Props {
  currentUser: RmsUser;
  canSchedule: boolean;
}

export const RmsMeetingsModule: React.FC<Props> = ({ currentUser, canSchedule }) => {
  const [meetings, setMeetings] = useState<RmsMeeting[]>(() => RmsStore.getMeetings());
  const committees = RmsStore.getCommittees();

  const [activeTab, setActiveTab] = useState<'UPCOMING' | 'PAST'>('UPCOMING');
  const [filterCentralOnly, setFilterCentralOnly] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<RmsMeeting | null>(null);

  // Schedule modal state
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [isCentral, setIsCentral] = useState(true);
  const [commId, setCommId] = useState(currentUser.committeeId || 'registration-database');
  const [meetingDate, setMeetingDate] = useState('2026-11-25');
  const [startTime, setStartTime] = useState('16:00');
  const [endTime, setEndTime] = useState('18:00');
  const [venue, setVenue] = useState('School Conference Hall');
  const [agendaInput, setAgendaInput] = useState('');
  const [agendaList, setAgendaList] = useState<string[]>([
    'Review batch coordinator registration targets',
    'Stage & Sound setup vendor evaluation',
  ]);

  // Meeting Minutes modal state
  const [isMinutesModalOpen, setIsMinutesModalOpen] = useState(false);
  const [decisionInput, setDecisionInput] = useState('');
  const [decisions, setDecisions] = useState<string[]>([]);
  const [meetingMinutesText, setMeetingMinutesText] = useState('');

  const reloadData = () => {
    setMeetings(RmsStore.getMeetings());
    if (selectedMeeting) {
      const refreshed = RmsStore.getMeetings().find((m) => m.id === selectedMeeting.id);
      if (refreshed) setSelectedMeeting(refreshed);
    }
  };

  const todayStr = new Date().toISOString().split('T')[0];

  const filteredMeetings = meetings.filter((m) => {
    const isPast = m.meetingDate < todayStr;
    const matchesTab = activeTab === 'PAST' ? isPast : !isPast;
    const matchesCentral = filterCentralOnly ? m.isCentralMeeting : true;
    return matchesTab && matchesCentral;
  });

  const handleAddAgenda = () => {
    if (!agendaInput.trim()) return;
    setAgendaList([...agendaList, agendaInput.trim()]);
    setAgendaInput('');
  };

  const handleRemoveAgenda = (idx: number) => {
    setAgendaList(agendaList.filter((_, i) => i !== idx));
  };

  const handleScheduleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || agendaList.length === 0) return;

    const comm = committees.find((c) => c.id === commId);

    const defaultAttendees: RmsMeeting['attendees'] = [
      { userId: 'USR-CONVENER', userName: 'Monowar Shikder', role: 'Convener', attended: false },
      { userId: 'USR-SECRETARY', userName: 'Siddiqur Rahman', role: 'Member Secretary', attended: false },
      { userId: currentUser.id, userName: currentUser.fullName, role: currentUser.role, attended: true },
    ];

    RmsStore.scheduleMeeting({
      title: title.trim(),
      committeeId: isCentral ? undefined : commId,
      committeeName: isCentral ? undefined : (comm ? comm.nameEn : undefined),
      isCentralMeeting: isCentral,
      meetingDate,
      startTime,
      endTime,
      venue,
      agenda: agendaList,
      attendees: defaultAttendees,
      decisions: [],
      followUpTasks: [],
      createdBy: currentUser.id,
    });

    setIsScheduleModalOpen(false);
    setTitle('');
    setAgendaList([]);
    reloadData();
  };

  const toggleAttendee = (meetingId: string, userId: string) => {
    const updatedMeetings = meetings.map((m) => {
      if (m.id === meetingId) {
        return {
          ...m,
          attendees: m.attendees.map((a) =>
            a.userId === userId ? { ...a, attended: !a.attended } : a
          ),
        };
      }
      return m;
    });
    RmsStore.saveMeetings(updatedMeetings);
    reloadData();
  };

  const openMinutesModal = (m: RmsMeeting) => {
    setSelectedMeeting(m);
    setDecisions(m.decisions || []);
    setMeetingMinutesText(m.minutesDocumentUrl || '');
    setIsMinutesModalOpen(true);
  };

  const handleSaveMinutes = () => {
    if (!selectedMeeting) return;
    const updatedMeetings = meetings.map((m) => {
      if (m.id === selectedMeeting.id) {
        return {
          ...m,
          decisions: decisions,
          minutesDocumentUrl: meetingMinutesText,
        };
      }
      return m;
    });
    RmsStore.saveMeetings(updatedMeetings);
    setIsMinutesModalOpen(false);
    reloadData();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-emerald-500/10 text-emerald-600 rounded-lg">
              <CalendarIcon className="w-6 h-6" />
            </span>
            <h1 className="text-2xl font-bold text-slate-900">Meetings & Steering Committee Calendar</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Central organizing committee assemblies, sub-committee working sessions, attendee presence audit, and recorded meeting resolutions.
          </p>
        </div>
        {canSchedule && (
          <button
            onClick={() => setIsScheduleModalOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl transition shadow-sm text-sm"
          >
            <Plus className="w-4 h-4" /> Schedule Meeting
          </button>
        )}
      </div>

      {/* Filter and Tab Navigation */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('UPCOMING')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition ${
              activeTab === 'UPCOMING'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Upcoming Sessions
          </button>
          <button
            onClick={() => setActiveTab('PAST')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition ${
              activeTab === 'PAST'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Past Archive & Minutes
          </button>
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={filterCentralOnly}
              onChange={(e) => setFilterCentralOnly(e.target.checked)}
              className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
            />
            Central Committee Meetings Only
          </label>
        </div>
      </div>

      {/* Meetings List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredMeetings.length === 0 ? (
          <div className="col-span-2 bg-white p-12 text-center rounded-2xl border border-slate-200 text-slate-400">
            No meetings found in this view.
          </div>
        ) : (
          filteredMeetings.map((m) => {
            const attendeeCount = m.attendees.length;
            const attendedCount = m.attendees.filter((a) => a.attended).length;

            return (
              <div
                key={m.id}
                className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                        m.isCentralMeeting
                          ? 'bg-purple-50 text-purple-700 border border-purple-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      {m.isCentralMeeting ? 'Central Steering Committee' : m.committeeName || 'Sub-Committee'}
                    </span>
                    <span className="text-xs font-mono text-slate-400">{m.id}</span>
                  </div>

                  <h3 className="font-bold text-lg text-slate-900 mt-2">{m.title}</h3>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="w-4 h-4 text-emerald-600" />
                      <span className="font-semibold">{m.meetingDate}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-emerald-600" />
                      <span>
                        {m.startTime} - {m.endTime}
                      </span>
                    </div>
                    <div className="col-span-2 flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <span className="truncate">{m.venue}</span>
                    </div>
                  </div>

                  {/* Agendas */}
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                      <ListOrdered className="w-3.5 h-3.5" /> Agenda Points
                    </h4>
                    <ul className="space-y-1.5 text-xs text-slate-700">
                      {m.agenda.map((ag, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="w-4 h-4 rounded-full bg-slate-100 text-[10px] font-bold text-slate-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <span>{ag}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Decisions Summary if any */}
                  {m.decisions && m.decisions.length > 0 && (
                    <div className="mt-4 p-3 bg-emerald-50/60 border border-emerald-100 rounded-xl">
                      <span className="text-[11px] font-bold uppercase text-emerald-800 tracking-wider flex items-center gap-1">
                        <FileCheck className="w-3.5 h-3.5 text-emerald-600" /> Adopted Decisions
                      </span>
                      <ul className="mt-1 space-y-1 text-xs text-emerald-950">
                        {m.decisions.map((dec, dIdx) => (
                          <li key={dIdx} className="list-disc ml-4">
                            {dec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Users className="w-4 h-4 text-slate-400" />
                    <span>
                      {attendedCount}/{attendeeCount} Present
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openMinutesModal(m)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg transition"
                    >
                      Minutes & Decisions
                    </button>
                    <button
                      onClick={() => setSelectedMeeting(m)}
                      className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                      title="Inspect Meeting Details"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Attendance & Detail Inspector Modal */}
      {selectedMeeting && !isMinutesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">
                  {selectedMeeting.isCentralMeeting ? 'Central Meeting' : 'Sub-Committee Session'}
                </span>
                <h3 className="font-bold text-slate-900 text-lg mt-0.5">{selectedMeeting.title}</h3>
                <p className="text-xs text-slate-500">
                  {selectedMeeting.meetingDate} | {selectedMeeting.startTime} - {selectedMeeting.endTime}
                </p>
              </div>
              <button
                onClick={() => setSelectedMeeting(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Venue Location</h4>
                <p className="text-sm font-medium text-slate-800">{selectedMeeting.venue}</p>
              </div>

              {/* Attendance Checklist */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Attendee Roster & Roll Call
                </h4>
                <div className="space-y-2">
                  {selectedMeeting.attendees.map((att) => (
                    <div
                      key={att.userId}
                      onClick={() => toggleAttendee(selectedMeeting.id, att.userId)}
                      className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition ${
                        att.attended
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {att.attended ? (
                          <CheckCircle className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <XCircle className="w-4 h-4 text-slate-300" />
                        )}
                        <div>
                          <span className="font-semibold block">{att.userName}</span>
                          <span className="text-[10px] text-slate-400 uppercase font-medium">{att.role}</span>
                        </div>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          att.attended ? 'bg-emerald-200 text-emerald-800' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {att.attended ? 'Present' : 'Absent'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Follow-up tasks */}
              {selectedMeeting.followUpTasks && selectedMeeting.followUpTasks.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Action Items & Follow-ups
                  </h4>
                  <div className="space-y-2">
                    {selectedMeeting.followUpTasks.map((t, idx) => (
                      <div key={idx} className="p-3 bg-slate-50 rounded-xl text-xs space-y-1">
                        <p className="font-semibold text-slate-800">{t.description}</p>
                        <div className="flex items-center justify-between text-slate-500 text-[11px]">
                          <span>Assigned: {t.assignedTo}</span>
                          <span>Deadline: {t.deadline}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedMeeting(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Minutes & Resolutions Modal */}
      {isMinutesModalOpen && selectedMeeting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <h3 className="font-bold text-slate-900 text-lg">Record Meeting Minutes & Decisions</h3>
            <p className="text-xs text-slate-500 mt-1">Official archive entry for {selectedMeeting.title}</p>

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Adopted Decisions</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter decision or resolution..."
                    value={decisionInput}
                    onChange={(e) => setDecisionInput(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (decisionInput.trim()) {
                        setDecisions([...decisions, decisionInput.trim()]);
                        setDecisionInput('');
                      }
                    }}
                    className="px-3 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-lg"
                  >
                    Add
                  </button>
                </div>

                <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                  {decisions.map((d, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg text-xs">
                      <span>{d}</span>
                      <button
                        type="button"
                        onClick={() => setDecisions(decisions.filter((_, i) => i !== idx))}
                        className="text-rose-500 hover:text-rose-700 font-bold ml-2"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                  Minutes Document URL / Note
                </label>
                <textarea
                  rows={3}
                  placeholder="Paste link to signed PDF or summary of proceedings..."
                  value={meetingMinutesText}
                  onChange={(e) => setMeetingMinutesText(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="mt-6 pt-3 border-t border-slate-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsMinutesModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveMinutes}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg"
              >
                Save Minutes & Decisions
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Meeting Modal */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Schedule Committee Meeting</h2>
            <form onSubmit={handleScheduleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Meeting Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Venue & Stage Infrastructure Review"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={isCentral}
                    onChange={(e) => setIsCentral(e.target.checked)}
                    className="rounded text-emerald-600 w-4 h-4"
                  />
                  Central Organizing Committee Assembly
                </label>
              </div>

              {!isCentral && (
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Sub-Committee</label>
                  <select
                    value={commId}
                    onChange={(e) => setCommId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {committees.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nameEn}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={meetingDate}
                    onChange={(e) => setMeetingDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Start Time</label>
                  <input
                    type="time"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">End Time</label>
                  <input
                    type="time"
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Venue / Room</label>
                <input
                  type="text"
                  required
                  placeholder="School Auditorium / Police Lines Field Tent"
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Agenda item creator */}
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Agenda Items</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter agenda point..."
                    value={agendaInput}
                    onChange={(e) => setAgendaInput(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddAgenda}
                    className="px-3 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg"
                  >
                    Add
                  </button>
                </div>

                <div className="mt-2 space-y-1 max-h-24 overflow-y-auto">
                  {agendaList.map((ag, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg text-xs">
                      <span>
                        {idx + 1}. {ag}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveAgenda(idx)}
                        className="text-rose-500 hover:text-rose-700 font-bold ml-2"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsScheduleModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-sm transition"
                >
                  Schedule Meeting
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

