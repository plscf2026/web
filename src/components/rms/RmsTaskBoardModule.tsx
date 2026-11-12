import { useState, useEffect } from 'react';
import {
  CheckSquare,
  Plus,
  Search,
  Filter,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  User,
  MessageSquare,
  Send,
  X,
  Kanban,
  Table as TableIcon,
  CalendarDays,
  Sparkles,
} from 'lucide-react';
import { RmsStore } from '../../services/rmsStore';
import { RmsTask, TaskStatus, TaskPriority, CommitteeId } from '../../types/rms';
import { Language } from '../../types';
import { GlobalPagination } from '../common/GlobalPagination';
import { paginate } from '../../utils/pagination';

interface RmsTaskBoardModuleProps {
  language?: Language;
  currentUser?: unknown;
  canManage?: boolean;
}

export const RmsTaskBoardModule: React.FC<RmsTaskBoardModuleProps> = ({
  language = 'en',
}) => {
  const [tasks, setTasks] = useState<RmsTask[]>(() => RmsStore.getTasks());
  const committees = RmsStore.getCommittees();
  const currentUser = RmsStore.getCurrentUser();

  const [activeView, setActiveView] = useState<'KANBAN' | 'TABLE' | 'CALENDAR'>('KANBAN');
  const [committeeFilter, setCommitteeFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Global Pagination State for Table View (Default 10, options 10, 20, 30, 40)
  const [tablePage, setTablePage] = useState(1);
  const [tablePageSize, setTablePageSize] = useState(10);

  // Reset to page 1 on filter/search change
  useEffect(() => {
    setTablePage(1);
  }, [committeeFilter, priorityFilter, searchQuery]);

  // Selected task for detail modal
  const [selectedTask, setSelectedTask] = useState<RmsTask | null>(null);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Create form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [committeeId, setCommitteeId] = useState<CommitteeId>('registration-database');
  const [assignedMemberName, setAssignedMemberName] = useState('');
  const [deadline, setDeadline] = useState('2026-12-15');
  const [priority, setPriority] = useState<TaskPriority>('HIGH');

  // Comment & Evidence state
  const [newComment, setNewComment] = useState('');
  const [evidenceText, setEvidenceText] = useState('');
  const [rejectionReasonText, setRejectionReasonText] = useState('');

  const refreshTasks = () => {
    const list = RmsStore.getTasks();
    setTasks(list);
    if (selectedTask) {
      const updated = list.find((t) => t.id === selectedTask.id);
      setSelectedTask(updated || null);
    }
  };

  const filteredTasks = tasks.filter((t) => {
    const matchesCommittee = committeeFilter === 'ALL' || t.committeeId === committeeFilter;
    const matchesPriority = priorityFilter === 'ALL' || t.priority === priorityFilter;
    const matchesSearch =
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.assignedMemberName && t.assignedMemberName.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCommittee && matchesPriority && matchesSearch;
  });

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const comm = committees.find((c) => c.id === committeeId);
    RmsStore.createTask({
      title: title.trim(),
      description: description.trim(),
      committeeId,
      committeeName: comm ? comm.nameEn : 'General Committee',
      assignedMemberName: assignedMemberName.trim() || undefined,
      createdBy: currentUser.id,
      createdByName: currentUser.fullName,
      startDate: new Date().toISOString().split('T')[0],
      deadline,
      priority,
      status: 'ASSIGNED',
      attachments: [],
      comments: [],
    });

    setShowCreateModal(false);
    setTitle('');
    setDescription('');
    refreshTasks();
  };

  const handleStatusChange = (task: RmsTask, newStatus: TaskStatus) => {
    RmsStore.updateTaskStatus(task.id, newStatus, currentUser.fullName);
    refreshTasks();
  };

  const handleAddComment = () => {
    if (!selectedTask || !newComment.trim()) return;
    RmsStore.addTaskComment(
      selectedTask.id,
      currentUser.id,
      currentUser.fullName,
      currentUser.role,
      newComment.trim()
    );
    setNewComment('');
    refreshTasks();
  };

  const handleSubmitEvidence = () => {
    if (!selectedTask || !evidenceText.trim()) return;
    RmsStore.updateTaskStatus(
      selectedTask.id,
      'UNDER_REVIEW',
      currentUser.fullName,
      evidenceText.trim()
    );
    setEvidenceText('');
    refreshTasks();
  };

  const handleApproveTask = () => {
    if (!selectedTask) return;
    RmsStore.updateTaskStatus(selectedTask.id, 'COMPLETED', currentUser.fullName);
    refreshTasks();
  };

  const handleRejectTask = () => {
    if (!selectedTask || !rejectionReasonText.trim()) return;
    RmsStore.updateTaskStatus(
      selectedTask.id,
      'REJECTED',
      currentUser.fullName,
      undefined,
      rejectionReasonText.trim()
    );
    setRejectionReasonText('');
    refreshTasks();
  };

  const kanbanColumns: Array<{ id: TaskStatus; label: string; color: string }> = [
    { id: 'PENDING', label: 'Pending', color: 'bg-slate-100 text-slate-700' },
    { id: 'ASSIGNED', label: 'Assigned', color: 'bg-sky-100 text-sky-800' },
    { id: 'IN_PROGRESS', label: 'In Progress', color: 'bg-amber-100 text-amber-800' },
    { id: 'UNDER_REVIEW', label: 'Under Review', color: 'bg-purple-100 text-purple-800' },
    { id: 'COMPLETED', label: 'Completed', color: 'bg-emerald-100 text-emerald-800' },
  ];

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-black text-slate-900 font-clash flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-sky-600" />
            <span>{language === 'bn' ? 'টাস্ক ও কর্মপরিকল্পনা ম্যানেজমেন্ট' : 'Enterprise Task Management System'}</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Track milestones, assign deadlines to committee members, submit completion evidence, and verify deliverables.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          {/* View Mode Switcher */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1">
            <button
              onClick={() => setActiveView('KANBAN')}
              className={`p-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeView === 'KANBAN' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Kanban Board"
            >
              <Kanban className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Kanban</span>
            </button>
            <button
              onClick={() => setActiveView('TABLE')}
              className={`p-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeView === 'TABLE' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Table View"
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Table</span>
            </button>
            <button
              onClick={() => setActiveView('CALENDAR')}
              className={`p-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeView === 'CALENDAR' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Calendar Milestones"
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Calendar</span>
            </button>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-sm cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            <span>Create Task</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search tasks, assignees..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:border-slate-900 focus:outline-hidden"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={committeeFilter}
              onChange={(e) => setCommitteeFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 font-semibold focus:outline-hidden"
            >
              <option value="ALL">All Committees</option>
              {committees.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nameEn}
                </option>
              ))}
            </select>
          </div>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 font-semibold focus:outline-hidden"
          >
            <option value="ALL">All Priorities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>
      </div>

      {/* VIEW 1: KANBAN BOARD */}
      {activeView === 'KANBAN' && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 overflow-x-auto min-h-[500px]">
          {kanbanColumns.map((col) => {
            const colTasks = filteredTasks.filter((t) => t.status === col.id);
            return (
              <div key={col.id} className="bg-slate-100/70 rounded-3xl p-4 flex flex-col gap-3 min-w-[240px]">
                <div className="flex items-center justify-between px-1">
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg ${col.color}`}>
                    {col.label}
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-500">{colTasks.length}</span>
                </div>

                <div className="space-y-3 flex-1">
                  {colTasks.map((task) => (
                    <div
                      key={task.id}
                      onClick={() => setSelectedTask(task)}
                      className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs hover:shadow-md hover:border-sky-500/60 transition-all cursor-pointer space-y-2.5 group"
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <span
                          className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                            task.priority === 'CRITICAL'
                              ? 'bg-rose-100 text-rose-800'
                              : task.priority === 'HIGH'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {task.priority}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {task.committeeName.split('&')[0]}
                        </span>
                      </div>

                      <h4 className="text-xs font-bold text-slate-900 group-hover:text-sky-700 transition-colors leading-snug">
                        {task.title}
                      </h4>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                        <span className="flex items-center gap-1 font-medium">
                          <User className="w-3 h-3 text-slate-400" />
                          <span>{task.assignedMemberName || 'Unassigned'}</span>
                        </span>
                        <span className="flex items-center gap-1 font-mono text-[10px]">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>{task.deadline}</span>
                        </span>
                      </div>
                    </div>
                  ))}

                  {colTasks.length === 0 && (
                    <div className="text-center py-8 text-slate-400 text-xs border border-dashed border-slate-300 rounded-2xl">
                      No tasks
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW 2: TABLE VIEW */}
      {activeView === 'TABLE' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] font-bold border-b border-slate-200">
                  <th className="py-3 px-4">Task Title</th>
                  <th className="py-3 px-4">Committee</th>
                  <th className="py-3 px-4">Assignee</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Deadline</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginate(filteredTasks, tablePage, tablePageSize).map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => setSelectedTask(t)}
                    className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 font-bold text-slate-900 max-w-xs truncate">{t.title}</td>
                    <td className="py-3 px-4 text-slate-600">{t.committeeName}</td>
                    <td className="py-3 px-4 text-slate-700 font-medium">{t.assignedMemberName || 'Unassigned'}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                          t.priority === 'CRITICAL'
                            ? 'bg-rose-100 text-rose-800'
                            : t.priority === 'HIGH'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {t.priority}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">{t.deadline}</td>
                    <td className="py-3 px-4">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-800">
                        {t.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button className="text-sky-700 font-bold hover:underline">View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Tasks Table Global Pagination */}
          <GlobalPagination
            currentPage={tablePage}
            totalRecords={filteredTasks.length}
            pageSize={tablePageSize}
            onPageChange={setTablePage}
            onPageSizeChange={setTablePageSize}
            language={language}
          />
        </div>
      )}

      {/* VIEW 3: CALENDAR VIEW */}
      {activeView === 'CALENDAR' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Calendar className="w-4 h-4 text-sky-600" />
            <span className="text-xs font-bold text-slate-900">Task Deadlines & Scheduled Deliverables</span>
          </div>

          <div className="space-y-4">
            {filteredTasks.map((t) => (
              <div
                key={t.id}
                onClick={() => setSelectedTask(t)}
                className="p-4 rounded-2xl bg-slate-50 border border-slate-200 hover:border-sky-500/50 hover:bg-sky-50/20 transition-all cursor-pointer flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      Due: {t.deadline}
                    </span>
                    <span className="text-xs font-bold text-slate-900">{t.title}</span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {t.committeeName} • Assignee: <strong>{t.assignedMemberName || 'None'}</strong>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
                    {t.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Task Details Modal */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] overflow-y-auto p-6 space-y-5 border border-slate-200 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-mono font-bold text-sky-700 uppercase">
                  {selectedTask.committeeName}
                </span>
                <h2 className="text-lg font-black text-slate-900 font-clash mt-1">{selectedTask.title}</h2>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1">
                  <span>Assigned to: <strong className="text-slate-800">{selectedTask.assignedMemberName || 'Unassigned'}</strong></span>
                  <span>•</span>
                  <span>Deadline: <strong className="text-slate-800 font-mono">{selectedTask.deadline}</strong></span>
                </div>
              </div>

              <button onClick={() => setSelectedTask(null)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <span className="font-bold text-slate-900 block mb-1">Description:</span>
              <p>{selectedTask.description || 'No detailed instructions provided.'}</p>
            </div>

            {/* Status change actions */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-900 block">Update Status:</span>
              <div className="flex flex-wrap gap-2">
                {(['ASSIGNED', 'IN_PROGRESS', 'UNDER_REVIEW', 'COMPLETED', 'ON_HOLD'] as TaskStatus[]).map((st) => (
                  <button
                    key={st}
                    onClick={() => handleStatusChange(selectedTask, st)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                      selectedTask.status === st
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Evidence Submission (for members) */}
            <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200 space-y-2">
              <span className="text-xs font-bold text-sky-900 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Submit Deliverable / Completion Evidence</span>
              </span>
              {selectedTask.completionEvidence ? (
                <div className="p-3 bg-white rounded-xl border border-sky-200 text-xs text-slate-800 font-medium">
                  {selectedTask.completionEvidence}
                </div>
              ) : (
                <div className="space-y-2">
                  <textarea
                    rows={2}
                    placeholder="Enter links, drive URLs, or physical delivery details..."
                    value={evidenceText}
                    onChange={(e) => setEvidenceText(e.target.value)}
                    className="w-full text-xs p-3 rounded-xl border border-sky-300 bg-white"
                  />
                  <button
                    onClick={handleSubmitEvidence}
                    disabled={!evidenceText.trim()}
                    className="px-3 py-1.5 rounded-xl bg-sky-700 text-white text-xs font-bold hover:bg-sky-800 cursor-pointer disabled:opacity-50"
                  >
                    Submit for Review
                  </button>
                </div>
              )}
            </div>

            {/* Director Review & Approval */}
            {selectedTask.status === 'UNDER_REVIEW' && (
              <div className="p-4 rounded-2xl bg-purple-50 border border-purple-200 space-y-2">
                <span className="text-xs font-bold text-purple-900 block">Director Action: Deliverable Review</span>
                <div className="flex gap-2">
                  <button
                    onClick={handleApproveTask}
                    className="flex items-center gap-1 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Approve as Complete</span>
                  </button>

                  <button
                    onClick={handleRejectTask}
                    className="flex items-center gap-1 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Request Revision</span>
                  </button>
                </div>
              </div>
            )}

            {/* Comments Thread */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                <span>Discussion & Comments ({selectedTask.comments.length})</span>
              </span>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {selectedTask.comments.map((c) => (
                  <div key={c.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-900">{c.authorName}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-slate-700">{c.content}</p>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Write a message or instruction..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                  className="flex-1 text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden"
                />
                <button
                  onClick={handleAddComment}
                  className="px-3 py-2 rounded-xl bg-slate-900 text-white cursor-pointer hover:bg-slate-800"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Task Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 border border-slate-200 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 font-clash">Create New Committee Task</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Task Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Inspect Ground Lighting & Generator Line"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Committee *</label>
                <select
                  value={committeeId}
                  onChange={(e) => setCommitteeId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                >
                  {committees.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nameEn}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Assigned Member Name</label>
                <input
                  type="text"
                  value={assignedMemberName}
                  onChange={(e) => setAssignedMemberName(e.target.value)}
                  placeholder="Name of member or volunteer"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  >
                    <option value="CRITICAL">Critical</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Deadline *</label>
                  <input
                    type="date"
                    required
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Detailed Description & Deliverables</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Specific requirements, checklist, and contact references..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-slate-900 text-white font-bold cursor-pointer hover:bg-slate-800"
                >
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
