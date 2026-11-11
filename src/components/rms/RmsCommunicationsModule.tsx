import React, { useState } from 'react';
import {
  Bell,
  Megaphone,
  Plus,
  AlertCircle,
  Calendar,
  User,
  Users,
  CheckCircle,
} from 'lucide-react';
import { RmsAnnouncement, RmsNotification, RmsUser } from '../../types/rms';
import { RmsStore } from '../../services/rmsStore';

interface Props {
  currentUser: RmsUser;
  canPublish: boolean;
}

export const RmsCommunicationsModule: React.FC<Props> = ({ currentUser, canPublish }) => {
  const [announcements, setAnnouncements] = useState<RmsAnnouncement[]>(() => RmsStore.getAnnouncements());
  const [notifications, setNotifications] = useState<RmsNotification[]>(() => RmsStore.getNotifications());

  const [activeTab, setActiveTab] = useState<'ANNOUNCEMENTS' | 'NOTIFICATIONS'>('ANNOUNCEMENTS');
  const [filterPriority, setFilterPriority] = useState<string>('ALL');

  // Announcement modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [titleEn, setTitleEn] = useState('');
  const [titleBn, setTitleBn] = useState('');
  const [contentEn, setContentEn] = useState('');
  const [contentBn, setContentBn] = useState('');
  const [priority, setPriority] = useState<RmsAnnouncement['priority']>('URGENT');
  const [targetAudience, setTargetAudience] = useState<RmsAnnouncement['targetAudience']>('ALL');

  const reloadData = () => {
    setAnnouncements(RmsStore.getAnnouncements());
    setNotifications(RmsStore.getNotifications());
  };

  const filteredAnnouncements = announcements.filter((ann) => {
    if (filterPriority === 'ALL') return true;
    return ann.priority === filterPriority;
  });

  const handleCreateAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!titleEn.trim() || !contentEn.trim()) return;

    RmsStore.createAnnouncement({
      titleEn: titleEn.trim(),
      titleBn: titleBn.trim() || titleEn.trim(),
      contentEn: contentEn.trim(),
      contentBn: contentBn.trim() || contentEn.trim(),
      priority,
      targetAudience,
      authorName: `${currentUser.fullName} (${currentUser.role.replace('_', ' ')})`,
    });

    setIsAddModalOpen(false);
    setTitleEn('');
    setTitleBn('');
    setContentEn('');
    setContentBn('');
    reloadData();
  };

  const handleMarkAsRead = (id: string) => {
    RmsStore.markNotificationRead(id);
    reloadData();
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-blue-500/10 text-blue-600 rounded-lg">
              <Megaphone className="w-6 h-6" />
            </span>
            <h1 className="text-2xl font-bold text-slate-900">Internal Communications & Notice Board</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Dispatch urgent directives to Central Steering Committee, Sub-Committee Directors, and field volunteers in English & Bangla.
          </p>
        </div>
        {canPublish && (
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition shadow-sm text-sm"
          >
            <Plus className="w-4 h-4" /> Publish Announcement
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('ANNOUNCEMENTS')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition ${
              activeTab === 'ANNOUNCEMENTS'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Megaphone className="w-4 h-4" />
            Official Notices ({announcements.length})
          </button>

          <button
            onClick={() => setActiveTab('NOTIFICATIONS')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition ${
              activeTab === 'NOTIFICATIONS'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Bell className="w-4 h-4" />
            Personal Alerts
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.5 bg-rose-500 text-white text-[10px] rounded-full font-bold">
                {unreadCount}
              </span>
            )}
          </button>
        </div>

        {activeTab === 'ANNOUNCEMENTS' && (
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-700"
          >
            <option value="ALL">All Priorities</option>
            <option value="CRITICAL">Critical Directives</option>
            <option value="URGENT">Urgent Alerts</option>
            <option value="NORMAL">Normal Updates</option>
          </select>
        )}
      </div>

      {/* Announcements Stream */}
      {activeTab === 'ANNOUNCEMENTS' && (
        <div className="space-y-4">
          {filteredAnnouncements.map((ann) => (
            <div
              key={ann.id}
              className={`bg-white rounded-2xl border p-6 shadow-sm transition ${
                ann.priority === 'CRITICAL'
                  ? 'border-rose-400 ring-1 ring-rose-200'
                  : ann.priority === 'URGENT'
                  ? 'border-amber-300'
                  : 'border-slate-200'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-full uppercase tracking-wider ${
                      ann.priority === 'CRITICAL'
                        ? 'bg-rose-100 text-rose-800'
                        : ann.priority === 'URGENT'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    <AlertCircle className="w-3.5 h-3.5" />
                    {ann.priority}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs text-slate-500 px-2 py-0.5 bg-slate-100 rounded-md">
                    <Users className="w-3 h-3 text-slate-400" />
                    Audience: {ann.targetAudience.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5" /> {ann.authorName}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" /> {new Date(ann.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {/* English Title & Body */}
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{ann.titleEn}</h3>
                  <p className="text-sm text-slate-700 mt-1 leading-relaxed">{ann.contentEn}</p>
                </div>

                {/* Bengali Translation Block */}
                {ann.titleBn && ann.titleBn !== ann.titleEn && (
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 mt-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      বাংলা অনুবাদ (Bengali Notice)
                    </span>
                    <h4 className="text-base font-bold text-slate-800">{ann.titleBn}</h4>
                    <p className="text-sm text-slate-700 mt-1 leading-relaxed">{ann.contentBn}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Notifications Tab */}
      {activeTab === 'NOTIFICATIONS' && (
        <div className="space-y-3">
          {notifications.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 text-slate-400">
              No recent notifications in your inbox.
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                className={`p-4 rounded-xl border transition flex items-center justify-between gap-4 ${
                  notif.isRead
                    ? 'bg-white border-slate-200 text-slate-600'
                    : 'bg-blue-50/50 border-blue-200 text-slate-900'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`p-2 rounded-lg mt-0.5 ${
                      notif.type === 'BUDGET'
                        ? 'bg-amber-100 text-amber-800'
                        : notif.type === 'TASK'
                        ? 'bg-sky-100 text-sky-800'
                        : notif.type === 'MEETING'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    <Bell className="w-4 h-4" />
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-slate-900">{notif.title}</h4>
                      {!notif.isRead && (
                        <span className="px-1.5 py-0.5 bg-blue-600 text-white text-[10px] font-bold rounded">
                          NEW
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">{notif.message}</p>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      {new Date(notif.timestamp).toLocaleString()}
                    </span>
                  </div>
                </div>

                {!notif.isRead && (
                  <button
                    onClick={() => handleMarkAsRead(notif.id)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition flex-shrink-0"
                  >
                    <CheckCircle className="w-3.5 h-3.5" /> Mark Read
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Publish Announcement Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Publish Official Announcement</h2>
            <form onSubmit={handleCreateAnnouncement} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                  Title (English)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Schedule for Dress & Gift Bag Distribution Announced"
                  value={titleEn}
                  onChange={(e) => setTitleEn(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                  Title (বাংলা - Optional)
                </label>
                <input
                  type="text"
                  placeholder="যেমন: পোশাক ও উপহার সামগ্রী বিতরণ সংক্রান্ত জরুরি বিজ্ঞপ্তি"
                  value={titleBn}
                  onChange={(e) => setTitleBn(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Priority Level</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as RmsAnnouncement['priority'])}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="CRITICAL">Critical Directive</option>
                    <option value="URGENT">Urgent Alert</option>
                    <option value="NORMAL">Normal Notice</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Target Audience</label>
                  <select
                    value={targetAudience}
                    onChange={(e) => setTargetAudience(e.target.value as RmsAnnouncement['targetAudience'])}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="ALL">Everyone / Public & Committee</option>
                    <option value="COMMITTEE_HEADS">Committee Heads & Directors</option>
                    <option value="VOLUNTEERS">Field Volunteers</option>
                    <option value="PUBLIC">Public Notice</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                  Content (English)
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Provide complete details, dates, venues, and instructions..."
                  value={contentEn}
                  onChange={(e) => setContentEn(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                  Content (বাংলা - Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="বিস্তারিত বিবরণ, তারিখ, সময় ও স্থান..."
                  value={contentBn}
                  onChange={(e) => setContentBn(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
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
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-sm transition"
                >
                  Publish Notice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
