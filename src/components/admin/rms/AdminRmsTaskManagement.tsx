import React, { useState } from 'react';
import {
  CheckSquare,
  Plus,
  Search,
  Filter,
  Calendar,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Building,
  User,
  X,
  Send,
  Eye,
  LayoutGrid,
  List,
} from 'lucide-react';
import { RmsTask, TaskStatus, TaskPriority } from '../../../types/rms';
import { Language } from '../../../types';
import { RmsStore } from '../../../services/rmsStore';

interface Props {
  language: Language;
}

export const AdminRmsTaskManagement: React.FC<Props> = ({ language }) => {
  const [tasks, setTasks] = useState<RmsTask[]>(() => RmsStore.getTasks());
  const [viewMode, setViewMode] = useState<'kanban' | 'list' | 'deadlines'>('kanban');
  const [searchQuery, setSearchQuery] = useState('');
  const [committeeFilter, setCommitteeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<RmsTask | null>(null);
  const [isSubmitEvidenceModalOpen, setIsSubmitEvidenceModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [evidenceText, setEvidenceText] = useState('');
  const [rejectionReasonText, setRejectionReasonText] = useState('');
  const [newCommentText, setNewCommentText] = useState('');

  // New Task form state
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskCommitteeId, setTaskCommitteeId] = useState('publicity-publication');
  const [taskAssignee, setTaskAssignee] = useState('');
  const [taskPriority, setTaskPriority] = useState<TaskPriority>('HIGH');
  const [taskDeadline, setTaskDeadline] = useState('2026-12-15');

  const committees = RmsStore.getCommittees();
  const currentUser = RmsStore.getCurrentUser();

  const reloadTasks = () => {
    const list = RmsStore.getTasks();
    setTasks(list);
    if (selectedTask) {
      const updated = list.find((t) => t.id === selectedTask.id) || null;
      setSelectedTask(updated);
    }
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim() || !taskDeadline) return;

    const comm = committees.find((c) => c.id === taskCommitteeId);

    RmsStore.createTask({
      title: taskTitle.trim(),
      description: taskDesc.trim() || 'Assigned task for committee reunion milestone.',
      committeeId: taskCommitteeId,
      committeeName: comm?.nameEn || 'General Committee',
      assignedMemberName: taskAssignee.trim() || undefined,
      createdBy: currentUser.id,
      createdByName: currentUser.fullName,
      startDate: new Date().toISOString().split('T')[0],
      deadline: taskDeadline,
      priority: taskPriority,
      status: taskAssignee.trim() ? 'ASSIGNED' : 'PENDING',
      attachments: [],
      comments: [],
    });

    setIsAddModalOpen(false);
    setTaskTitle('');
    setTaskDesc('');
    setTaskAssignee('');
    setTaskDeadline('2026-12-15');
    setTaskPriority('HIGH');
    reloadTasks();
  };

  const handleSubmitEvidence = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !evidenceText.trim()) return;

    RmsStore.updateTaskStatus(
      selectedTask.id,
      'UNDER_REVIEW',
      currentUser.fullName,
      evidenceText.trim()
    );

    setIsSubmitEvidenceModalOpen(false);
    setEvidenceText('');
    reloadTasks();
  };

  const handleApproveTask = () => {
    if (!selectedTask) return;
    RmsStore.updateTaskStatus(
      selectedTask.id,
      'COMPLETED',
      currentUser.fullName,
      selectedTask.completionEvidence
    );
    setIsReviewModalOpen(false);
    reloadTasks();
  };

  const handleRejectTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !rejectionReasonText.trim()) return;

    RmsStore.updateTaskStatus(
      selectedTask.id,
      'REJECTED',
      currentUser.fullName,
      selectedTask.completionEvidence,
      rejectionReasonText.trim()
    );

    setIsReviewModalOpen(false);
    setRejectionReasonText('');
    reloadTasks();
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !newCommentText.trim()) return;

    RmsStore.addTaskComment(
      selectedTask.id,
      currentUser.id,
      currentUser.fullName,
      currentUser.role,
      newCommentText.trim()
    );

    setNewCommentText('');
    reloadTasks();
  };

  // Filter tasks
  const filteredTasks = tasks.filter((t) => {
    const matchesSearch =
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.assignedMemberName && t.assignedMemberName.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesComm = committeeFilter === 'all' || t.committeeId === committeeFilter;
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || t.priority === priorityFilter;

    return matchesSearch && matchesComm && matchesStatus && matchesPriority;
  });

  const isOverdue = (task: RmsTask) => {
    if (task.status === 'COMPLETED') return false;
    const today = new Date().toISOString().split('T')[0];
    return task.deadline < today;
  };

  const totalOverdue = tasks.filter(isOverdue).length;
  const totalCompleted = tasks.filter((t) => t.status === 'COMPLETED').length;
  const totalReview = tasks.filter((t) => t.status === 'UNDER_REVIEW').length;

  const kanbanColumns: { id: TaskStatus; label: string; bg: string; dot: string }[] = [
    { id: 'PENDING', label: language === 'bn' ? 'অপেক্ষমান / নির্ধারিত' : 'Pending & Assigned', bg: 'bg-slate-50', dot: 'bg-slate-400' },
    { id: 'IN_PROGRESS', label: language === 'bn' ? 'চলমান (In Progress)' : 'In Progress', bg: 'bg-blue-50/50', dot: 'bg-blue-500' },
    { id: 'UNDER_REVIEW', label: language === 'bn' ? 'রিভিউ প্রতীক্ষিত' : 'Under Review', bg: 'bg-amber-50/50', dot: 'bg-amber-500' },
    { id: 'COMPLETED', label: language === 'bn' ? 'সম্পন্ন (Completed)' : 'Completed', bg: 'bg-emerald-50/50', dot: 'bg-emerald-500' },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner & KPI Stat Row */}
      <div className="bg-gradient-to-r from-slate-900 to-[#172554] text-white p-6 rounded-3xl shadow-lg border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-bold uppercase tracking-wider border border-blue-400/30">
              Module 5
            </span>
            <span className="text-xs text-slate-300 font-medium">Reunion Management ERP</span>
          </div>
          <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <CheckSquare className="w-6 h-6 text-amber-400" />
            <span>{language === 'bn' ? 'কমিটি টাস্ক ও ওয়ার্কফ্লো ট্র্যাকার' : 'Committee Task & Milestone Tracking'}</span>
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-xl">
            {language === 'bn'
              ? 'সকল ১২টি সাব-কমিটির দায়িত্বশীলদের অর্পিত কাজের অগ্রগতি, ডেডলাইন, ডেলিভারেবল প্রমাণাদি পর্যালোচনা ও অনুমোদন পরিচালনা করুন।'
              : 'End-to-end task delegation, deliverable evidence verification, deadline monitoring, and director review workflow.'}
          </p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-bold text-xs shadow-md transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{language === 'bn' ? 'নতুন টাস্ক তৈরি' : 'Create New Task'}</span>
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold">{language === 'bn' ? 'মোট টাস্ক' : 'Total Tasks'}</span>
            <CheckSquare className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-black text-slate-900">{tasks.length}</p>
          <span className="text-[10px] text-slate-400">Across 12 Committees</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold">{language === 'bn' ? 'সম্পন্ন সম্পন্ন' : 'Completed'}</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-emerald-600">{totalCompleted}</p>
          <span className="text-[10px] text-emerald-600 font-medium">
            {tasks.length > 0 ? Math.round((totalCompleted / tasks.length) * 100) : 0}% Completion Rate
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold">{language === 'bn' ? 'রিভিউ অপেক্ষায়' : 'Needs Review'}</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-amber-600">{totalReview}</p>
          <span className="text-[10px] text-amber-600 font-medium">Deliverables Submitted</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold">{language === 'bn' ? 'ওভারডিউ টাস্ক' : 'Overdue Tasks'}</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-2xl font-black text-rose-600">{totalOverdue}</p>
          <span className="text-[10px] text-rose-500 font-bold">Past Target Deadline</span>
        </div>
      </div>

      {/* View Switcher, Filter & Search Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-full md:w-auto">
          <button
            onClick={() => setViewMode('kanban')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              viewMode === 'kanban' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Kanban Board</span>
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              viewMode === 'list' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            <span>List Table</span>
          </button>
          <button
            onClick={() => setViewMode('deadlines')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              viewMode === 'deadlines' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Deadlines</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          <div className="relative flex-1 md:w-56">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder={language === 'bn' ? 'টাস্ক খুঁজুন...' : 'Search tasks...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-hidden focus:border-slate-800"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={committeeFilter}
              onChange={(e) => setCommitteeFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs bg-white text-slate-700 focus:outline-hidden"
            >
              <option value="all">All Committees</option>
              {committees.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nameEn}
                </option>
              ))}
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs bg-white text-slate-700 focus:outline-hidden"
            >
              <option value="all">All Priorities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs bg-white text-slate-700 focus:outline-hidden"
            >
              <option value="all">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="ASSIGNED">Assigned</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="COMPLETED">Completed</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      {/* VIEW 1: KANBAN BOARD */}
      {viewMode === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
          {kanbanColumns.map((col) => {
            const columnTasks = filteredTasks.filter((t) => {
              if (col.id === 'PENDING') return t.status === 'PENDING' || t.status === 'ASSIGNED';
              return t.status === col.id;
            });

            return (
              <div key={col.id} className={`${col.bg} p-3.5 rounded-2xl border border-slate-200/80 min-h-[500px]`}>
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${col.dot}`} />
                    <span className="text-xs font-bold text-slate-800">{col.label}</span>
                  </div>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white text-slate-600 border border-slate-200">
                    {columnTasks.length}
                  </span>
                </div>

                <div className="space-y-3">
                  {columnTasks.map((task) => {
                    const overdue = isOverdue(task);
                    return (
                      <div
                        key={task.id}
                        onClick={() => setSelectedTask(task)}
                        className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs hover:shadow-md transition cursor-pointer space-y-2.5 group"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span
                            className={`text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                              task.priority === 'CRITICAL'
                                ? 'bg-rose-100 text-rose-800'
                                : task.priority === 'HIGH'
                                ? 'bg-orange-100 text-orange-800'
                                : task.priority === 'MEDIUM'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {task.priority}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">#{task.id}</span>
                        </div>

                        <div>
                          <h4 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition leading-snug">
                            {task.title}
                          </h4>
                          <p className="text-[11px] text-slate-500 line-clamp-2 mt-1">{task.description}</p>
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                          <div className="flex items-center gap-1.5 truncate max-w-[130px]" title={task.committeeName}>
                            <Building className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">{task.committeeName.split(' ')[0]}</span>
                          </div>

                          <div
                            className={`flex items-center gap-1 font-mono text-[10px] font-bold ${
                              overdue ? 'text-rose-600' : 'text-slate-500'
                            }`}
                          >
                            <Calendar className="w-3 h-3" />
                            <span>{task.deadline}</span>
                          </div>
                        </div>

                        {task.assignedMemberName && (
                          <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                            <span className="flex items-center gap-1 truncate font-medium">
                              <User className="w-3 h-3 text-slate-400" />
                              {task.assignedMemberName}
                            </span>
                            {task.comments.length > 0 && (
                              <span className="flex items-center gap-0.5 text-slate-400 font-mono">
                                <MessageSquare className="w-3 h-3" />
                                {task.comments.length}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {columnTasks.length === 0 && (
                    <div className="py-8 text-center text-xs text-slate-400 italic">No tasks in this stage</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW 2: LIST TABLE */}
      {viewMode === 'list' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Task ID & Title</th>
                  <th className="px-4 py-3">Committee</th>
                  <th className="px-4 py-3">Assignee</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Deadline</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTasks.map((task) => {
                  const overdue = isOverdue(task);
                  return (
                    <tr key={task.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{task.title}</div>
                        <div className="text-[10px] text-slate-400 font-mono">#{task.id}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 font-medium">{task.committeeName}</td>
                      <td className="px-4 py-3 text-slate-600">{task.assignedMemberName || '—'}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            task.priority === 'CRITICAL'
                              ? 'bg-rose-100 text-rose-800'
                              : task.priority === 'HIGH'
                              ? 'bg-orange-100 text-orange-800'
                              : task.priority === 'MEDIUM'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {task.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px]">
                        <span className={overdue ? 'text-rose-600 font-bold flex items-center gap-1' : 'text-slate-600'}>
                          {overdue && <AlertTriangle className="w-3 h-3 text-rose-500" />}
                          {task.deadline}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                            task.status === 'COMPLETED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : task.status === 'UNDER_REVIEW'
                              ? 'bg-amber-100 text-amber-800'
                              : task.status === 'IN_PROGRESS'
                              ? 'bg-blue-100 text-blue-800'
                              : task.status === 'REJECTED'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {task.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setSelectedTask(task)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition cursor-pointer"
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 3: DEADLINE OVERVIEW */}
      {viewMode === 'deadlines' && (
        <div className="space-y-4">
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4">
            <h3 className="text-sm font-bold text-rose-900 flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>Overdue Tasks ({filteredTasks.filter(isOverdue).length})</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredTasks
                .filter(isOverdue)
                .map((task) => (
                  <div
                    key={task.id}
                    onClick={() => setSelectedTask(task)}
                    className="p-3 bg-white rounded-xl border border-rose-200 shadow-xs cursor-pointer hover:border-rose-400 transition"
                  >
                    <div className="flex items-center justify-between text-xs font-bold text-slate-900">
                      <span>{task.title}</span>
                      <span className="text-rose-600 font-mono text-[11px]">{task.deadline}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                      <span>{task.committeeName}</span>
                      <span>Assignee: {task.assignedMemberName || 'Unassigned'}</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-blue-600" />
              <span>Upcoming Milestones</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredTasks
                .filter((t) => !isOverdue(t) && t.status !== 'COMPLETED')
                .map((task) => (
                  <div
                    key={task.id}
                    onClick={() => setSelectedTask(task)}
                    className="p-3 bg-slate-50 rounded-xl border border-slate-200 shadow-xs cursor-pointer hover:bg-slate-100 transition"
                  >
                    <div className="flex items-center justify-between text-xs font-bold text-slate-900">
                      <span>{task.title}</span>
                      <span className="text-blue-600 font-mono text-[11px]">{task.deadline}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                      <span>{task.committeeName}</span>
                      <span className="font-semibold text-slate-700">{task.status}</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: CREATE NEW TASK */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-lg font-black text-slate-900">
                {language === 'bn' ? 'নতুন টাস্ক তৈরি করুন' : 'Assign New Milestone Task'}
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Task Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Finalize Guest of Honor Souvenir Print Order"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-hidden focus:border-slate-800"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Target Committee *</label>
                <select
                  value={taskCommitteeId}
                  onChange={(e) => setTaskCommitteeId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-hidden"
                >
                  {committees.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nameEn}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Assigned Person</label>
                  <input
                    type="text"
                    placeholder="e.g. Sagar (Director)"
                    value={taskAssignee}
                    onChange={(e) => setTaskAssignee(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Priority</label>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value as TaskPriority)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-hidden"
                  >
                    <option value="CRITICAL">Critical (Urgent)</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Deadline Date *</label>
                <input
                  type="date"
                  required
                  value={taskDeadline}
                  onChange={(e) => setTaskDeadline(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Detailed Description & Deliverables</label>
                <textarea
                  rows={3}
                  placeholder="Outline expected deliverables, vendor guidelines, and verification requirements..."
                  value={taskDesc}
                  onChange={(e) => setTaskDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-hidden"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition cursor-pointer"
                >
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: TASK DETAILS & COMMENTS & WORKFLOW */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold">
                    #{selectedTask.id}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                      selectedTask.priority === 'CRITICAL'
                        ? 'bg-rose-100 text-rose-800'
                        : selectedTask.priority === 'HIGH'
                        ? 'bg-orange-100 text-orange-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {selectedTask.priority}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                      selectedTask.status === 'COMPLETED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : selectedTask.status === 'UNDER_REVIEW'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-100 text-slate-800'
                    }`}
                  >
                    {selectedTask.status.replace('_', ' ')}
                  </span>
                </div>
                <h3 className="text-base font-black text-slate-900">{selectedTask.title}</h3>
              </div>
              <button
                onClick={() => setSelectedTask(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200">
                {selectedTask.description}
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-xl text-[11px]">
                <div>
                  <span className="text-slate-400 block">Committee</span>
                  <span className="font-bold text-slate-800">{selectedTask.committeeName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Assignee</span>
                  <span className="font-bold text-slate-800">{selectedTask.assignedMemberName || 'Unassigned'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Deadline</span>
                  <span className="font-mono font-bold text-slate-800">{selectedTask.deadline}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Created By</span>
                  <span className="font-medium text-slate-800">{selectedTask.createdByName}</span>
                </div>
              </div>

              {/* Completion Evidence if present */}
              {selectedTask.completionEvidence && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1">
                  <span className="text-[11px] font-bold text-emerald-900 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Deliverable Evidence Submitted:
                  </span>
                  <p className="text-xs text-emerald-800">{selectedTask.completionEvidence}</p>
                </div>
              )}

              {/* Rejection reason if present */}
              {selectedTask.rejectionReason && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1">
                  <span className="text-[11px] font-bold text-rose-900 flex items-center gap-1.5">
                    <XCircle className="w-3.5 h-3.5 text-rose-600" />
                    Review Feedback / Revision Request:
                  </span>
                  <p className="text-xs text-rose-800">{selectedTask.rejectionReason}</p>
                </div>
              )}

              {/* Action Buttons for Task Lifecycle */}
              <div className="p-3 bg-slate-100 rounded-xl flex flex-wrap items-center justify-between gap-2">
                <div className="text-[11px] text-slate-600 font-medium">
                  {selectedTask.status === 'COMPLETED' ? (
                    <span className="text-emerald-700 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Task Completed & Verified by Leadership
                    </span>
                  ) : (
                    <span>Current Workflow State: <b>{selectedTask.status}</b></span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {selectedTask.status !== 'COMPLETED' && selectedTask.status !== 'UNDER_REVIEW' && (
                    <button
                      onClick={() => setIsSubmitEvidenceModalOpen(true)}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs shadow-xs cursor-pointer flex items-center gap-1"
                    >
                      <CheckSquare className="w-3.5 h-3.5" />
                      <span>Submit Deliverable</span>
                    </button>
                  )}

                  {selectedTask.status === 'UNDER_REVIEW' && (
                    <button
                      onClick={() => setIsReviewModalOpen(true)}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs shadow-xs cursor-pointer flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Review Deliverable</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Comments & Audit Thread */}
              <div className="pt-2 space-y-2">
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                  <span>Discussion & Progress Notes ({selectedTask.comments.length})</span>
                </h4>

                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {selectedTask.comments.map((c) => (
                    <div key={c.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                        <span className="font-bold text-slate-700">
                          {c.authorName} ({c.authorRole})
                        </span>
                        <span className="font-mono">{new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="text-slate-800">{c.content}</p>
                    </div>
                  ))}

                  {selectedTask.comments.length === 0 && (
                    <p className="text-[11px] text-slate-400 italic">No notes posted yet.</p>
                  )}
                </div>

                <form onSubmit={handleAddComment} className="flex gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="Write a progress update or note..."
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-hidden"
                  />
                  <button
                    type="submit"
                    className="px-3 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-1 hover:bg-slate-800 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Post</span>
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: SUBMIT EVIDENCE / DELIVERABLE */}
      {isSubmitEvidenceModalOpen && selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-blue-600" />
              <span>Submit Task Completion Deliverable</span>
            </h3>
            <p className="text-xs text-slate-500">
              Provide summary notes, confirmation links, or proof of execution for <b>{selectedTask.title}</b>.
            </p>

            <form onSubmit={handleSubmitEvidence} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Deliverable Evidence / Notes *</label>
                <textarea
                  rows={4}
                  required
                  placeholder="e.g. Printed 5000 souvenir copies from Royal Press Faridpur. Voucher #EXP-2027-44 submitted to Accounts."
                  value={evidenceText}
                  onChange={(e) => setEvidenceText(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-hidden"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsSubmitEvidenceModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 cursor-pointer"
                >
                  Send for Review
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: REVIEW & APPROVAL / REJECTION */}
      {isReviewModalOpen && selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Eye className="w-5 h-5 text-amber-500" />
              <span>Review Committee Deliverable</span>
            </h3>
            <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1">
              <span className="font-bold text-slate-700">Submitted Evidence:</span>
              <p className="text-slate-600">{selectedTask.completionEvidence || 'No evidence text provided.'}</p>
            </div>

            <div className="space-y-3 pt-2 text-xs">
              <button
                type="button"
                onClick={handleApproveTask}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Approve & Mark Completed</span>
              </button>

              <form onSubmit={handleRejectTask} className="space-y-2 pt-2 border-t border-slate-100">
                <label className="block font-bold text-slate-700">Or Request Revision / Reject with Reason:</label>
                <textarea
                  rows={2}
                  required
                  placeholder="State missing requirements or correction details..."
                  value={rejectionReasonText}
                  onChange={(e) => setRejectionReasonText(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-hidden"
                />
                <button
                  type="submit"
                  className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <XCircle className="w-4 h-4" />
                  <span>Reject & Send Back</span>
                </button>
              </form>
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setIsReviewModalOpen(false)}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
