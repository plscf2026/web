import React, { useState, useMemo } from 'react';
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  RotateCcw,
  Save,
  Search,
  X,
  ExternalLink,
  Sliders,
  Grid,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { CommitteeMember, CommitteeSettings, Language } from '../../types';
import { CommitteeService } from '../../services/committeeService';

interface CommitteeManagementTabProps {
  language: Language;
  onNavigateHome?: () => void;
}

// Preset photo options from Unsplash
const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=300&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=300&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=300&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=300&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?w=300&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&auto=format&fit=crop&q=80',
];

export const CommitteeManagementTab: React.FC<CommitteeManagementTabProps> = ({
  language,
  onNavigateHome,
}) => {
  const isBn = language === 'bn';
  const [members, setMembers] = useState<CommitteeMember[]>(() => CommitteeService.getMembers());
  const [settings, setSettings] = useState<CommitteeSettings>(() => CommitteeService.getSettings());
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<CommitteeMember | null>(null);
  const [toastMessage, setToastMessage] = useState<string>('');

  // Form State
  const [formData, setFormData] = useState<Partial<CommitteeMember>>({
    name: '',
    nameBn: '',
    role: '',
    roleBn: '',
    desc: '',
    descBn: '',
    batch: '',
    img: '',
    order: 1,
    isActive: true,
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const refreshList = () => {
    setMembers(CommitteeService.getMembers());
    setSettings(CommitteeService.getSettings());
  };

  // Filtered members by search
  const filteredMembers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return members;
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        (m.nameBn && m.nameBn.includes(q)) ||
        m.role.toLowerCase().includes(q) ||
        (m.roleBn && m.roleBn.includes(q)) ||
        (m.batch && m.batch.toLowerCase().includes(q)) ||
        m.desc.toLowerCase().includes(q)
    );
  }, [members, searchQuery]);

  // Open Create Modal
  const handleOpenCreateModal = () => {
    const maxOrder = members.reduce((max, m) => Math.max(max, m.order || 0), 0);
    setEditingMember(null);
    setFormData({
      name: '',
      nameBn: '',
      role: '',
      roleBn: '',
      desc: '',
      descBn: '',
      batch: '',
      img: PRESET_AVATARS[members.length % PRESET_AVATARS.length],
      order: maxOrder + 1,
      isActive: true,
    });
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (member: CommitteeMember) => {
    setEditingMember(member);
    setFormData({ ...member });
    setIsModalOpen(true);
  };

  // Submit Form (Add or Edit)
  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim() || !formData.role?.trim()) {
      alert(isBn ? 'অনুগ্রহ করে সদস্যের নাম এবং পদবি পূরণ করুন।' : 'Please fill in member name and role.');
      return;
    }

    if (editingMember) {
      CommitteeService.updateMember(editingMember.id, formData);
      showToast(isBn ? 'সদস্যের তথ্য সফলভাবে হালনাগাদ করা হয়েছে।' : 'Member updated successfully.');
    } else {
      CommitteeService.addMember(formData as any);
      showToast(isBn ? 'নতুন সদস্য সফলভাবে যুক্ত করা হয়েছে।' : 'New member added successfully.');
    }

    setIsModalOpen(false);
    refreshList();
  };

  // Delete Member
  const handleDeleteMember = (id: string, name: string) => {
    if (confirm(isBn ? `আপনি কি নিশ্চিতভাবে "${name}"-কে অপসারণ করতে চান?` : `Are you sure you want to remove "${name}" from the committee?`)) {
      CommitteeService.deleteMember(id);
      showToast(isBn ? 'সদস্য অপসারণ করা হয়েছে।' : 'Member removed.');
      refreshList();
    }
  };

  // Toggle Member Active Status
  const handleToggleActive = (member: CommitteeMember) => {
    CommitteeService.updateMember(member.id, { isActive: !member.isActive });
    refreshList();
  };

  // Move Up / Down
  const handleMove = (id: string, dir: 'up' | 'down') => {
    CommitteeService.reorderMember(id, dir);
    refreshList();
  };

  // Save Carousel / Grid Settings
  const handleUpdateSettings = (partial: Partial<CommitteeSettings>) => {
    const updated = CommitteeService.saveSettings(partial);
    setSettings(updated);
    showToast(isBn ? 'প্রদর্শন সেটিংস সফলভাবে সংরক্ষিত হয়েছে।' : 'Display settings saved.');
  };

  // Reset to default 16 members
  const handleResetToDefault = () => {
    if (confirm(isBn ? 'আপনি কি কমিটি সদস্যদের ডিফল্ট ১৬ জনে রিসেট করতে চান?' : 'Reset committee members to default 16 members?')) {
      CommitteeService.resetToDefault();
      showToast(isBn ? '১৬ জন সদস্যে রিসেট সম্পন্ন হয়েছে।' : 'Reset to default 16 members complete.');
      refreshList();
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Banner */}
      <div className="bg-gradient-to-r from-sky-900 via-slate-900 to-indigo-950 text-white rounded-3xl p-6 sm:p-8 shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/20 text-sky-300 text-xs font-semibold border border-sky-400/30">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isBn ? 'আয়োজক পরিষদ ব্যবস্থাপনা' : 'Organizing Committee CMS'}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {isBn ? 'পরিচালনা পরিষদ ও সদস্য তালিকা' : 'Organizing Committee Management'}
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm max-w-2xl leading-relaxed">
              {isBn
                ? 'হোম পেজের পরিচালনা পরিষদ সেকশনে প্রদর্শিত ১৬ জন সদস্যের প্রোফাইল, ছবি, পদবি এবং অসীম অটো-স্ক্রোল ক্যারোসেল বা রেসপনসিভ গ্রিড লেআউট নিয়ন্ত্রণ করুন।'
                : 'Configure the 16 committee member cards, designations, photos, and toggle between smooth auto-scrolling horizontal carousel and responsive multi-column CSS grid.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="px-4 py-2.5 rounded-xl bg-[#0284C7] hover:bg-[#0EA5E9] text-white text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{isBn ? 'নতুন সদস্য যোগ করুন' : 'Add Committee Member'}</span>
            </button>

            {onNavigateHome && (
              <button
                type="button"
                onClick={onNavigateHome}
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all border border-white/20 flex items-center gap-2 cursor-pointer"
              >
                <ExternalLink className="w-4 h-4" />
                <span>{isBn ? 'হোম পেজে দেখুন' : 'Preview on Home'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleResetToDefault}
              className="p-2.5 rounded-xl bg-white/10 hover:bg-rose-500/20 hover:border-rose-400 text-slate-300 hover:text-white text-xs font-bold transition-all border border-white/20 cursor-pointer"
              title={isBn ? 'ডিফল্ট ১৬ জনে রিসেট করুন' : 'Reset to default 16 members'}
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Display Controls & Carousel Configuration Box */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-2xs space-y-4">
        <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
          <Sliders className="w-4 h-4 text-[#0284C7]" />
          <span>{isBn ? 'লেআউট ও ক্যারোসেল অটো-স্ক্রোল সেটিংস' : 'Layout & Carousel Auto-Scroll Settings'}</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          {/* Default Display Mode */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">
              {isBn ? 'ডিফল্ট ভিউ মোড' : 'Default View Mode'}
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleUpdateSettings({ displayMode: 'carousel' })}
                className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  settings.displayMode === 'carousel'
                    ? 'bg-sky-50 border-[#0284C7] text-[#0284C7] shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>{isBn ? 'অটো-স্ক্রোল ক্যারোসেল' : 'Auto Carousel'}</span>
              </button>
              <button
                type="button"
                onClick={() => handleUpdateSettings({ displayMode: 'grid' })}
                className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  settings.displayMode === 'grid'
                    ? 'bg-sky-50 border-[#0284C7] text-[#0284C7] shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Grid className="w-3.5 h-3.5" />
                <span>{isBn ? 'রেসপনসিভ গ্রিড (১৬ জন)' : 'Grid (All 16)'}</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              {isBn
                ? 'ভিজিটররা হোম পেজে নিজেদের পছন্দমতো টগল করতে পারবেন।'
                : 'Visitors can also switch between Grid and Carousel on the Home page.'}
            </p>
          </div>

          {/* Carousel Scroll Speed */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">
              {isBn ? 'ক্যারোসেল অটো-স্ক্রোল বিরতি' : 'Auto-Scroll Transition Speed'}
            </label>
            <select
              value={settings.autoScrollSpeedMs}
              onChange={(e) => handleUpdateSettings({ autoScrollSpeedMs: Number(e.target.value) })}
              className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 bg-white focus:ring-2 focus:ring-[#0284C7]/20 focus:outline-hidden"
            >
              <option value={2000}>{isBn ? 'দ্রুত (২ সেকেন্ড)' : 'Fast (2.0s per slide)'}</option>
              <option value={3500}>{isBn ? 'স্বাভাবিক (৩.৫ সেকেন্ড)' : 'Normal (3.5s per slide)'}</option>
              <option value={5000}>{isBn ? 'ধীর (৫ সেকেন্ড)' : 'Slow (5.0s per slide)'}</option>
              <option value={7000}>{isBn ? 'খুব ধীর (৭ সেকেন্ড)' : 'Very Slow (7.0s per slide)'}</option>
            </select>
            <p className="text-[11px] text-slate-500">
              {isBn ? 'মাউস হোভার বা স্পর্শে স্বয়ংক্রিয়ভাবে থেমে থাকবে।' : 'Pauses automatically when hovered or touched.'}
            </p>
          </div>

          {/* Section Heading Title Customization */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">
              {isBn ? 'সেকশন শিরোনাম (বাংলা)' : 'Section Heading (Bangla)'}
            </label>
            <input
              type="text"
              value={settings.sectionTitleBn}
              onChange={(e) => handleUpdateSettings({ sectionTitleBn: e.target.value })}
              className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 bg-white focus:ring-2 focus:ring-[#0284C7]/20 focus:outline-hidden"
              placeholder="পুনর্মিলনী ২০২৬ পরিচালনা পরিষদ"
            />
          </div>
        </div>
      </div>

      {/* Member Management Cards & Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {/* Table Controls */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900 text-sm">
              {isBn ? 'কমিটি সদস্য তালিকা' : 'Committee Roster'}
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-sky-100 text-[#0284C7] font-bold text-xs">
              {filteredMembers.length} {isBn ? 'জন' : 'Members'}
            </span>
          </div>

          {/* Search Box */}
          <div className="relative min-w-[260px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isBn ? 'নাম, পদবি বা ব্যাচ খুঁজুন...' : 'Search name, role, batch...'}
              className="w-full pl-9 pr-3 py-2 rounded-xl text-xs border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#0284C7]/20 focus:outline-hidden"
            />
          </div>
        </div>

        {/* Member Grid List */}
        <div className="divide-y divide-slate-100">
          {filteredMembers.map((member, idx) => (
            <div
              key={member.id}
              className={`p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-colors ${
                !member.isActive ? 'bg-slate-50/80 opacity-70' : 'hover:bg-slate-50/60'
              }`}
            >
              {/* Member Identity */}
              <div className="flex items-center gap-3.5 min-w-0">
                <span className="text-xs font-mono font-bold text-slate-400 w-6 text-center shrink-0">
                  #{member.order || idx + 1}
                </span>

                <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-[#0284C7] shrink-0 bg-slate-100 shadow-2xs">
                  <img
                    src={member.img}
                    alt={member.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = PRESET_AVATARS[0];
                    }}
                  />
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-bold text-slate-900 text-sm truncate">
                      {member.name}
                    </h4>
                    {member.nameBn && (
                      <span className="text-xs text-slate-500 font-medium">({member.nameBn})</span>
                    )}
                    {member.batch && (
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-sky-50 text-[#0284C7] border border-sky-100">
                        {member.batch.startsWith('19') || member.batch.startsWith('20') ? `SSC '${member.batch.slice(2)}` : member.batch}
                      </span>
                    )}
                    {!member.isActive && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                        {isBn ? 'লুকানো' : 'Hidden'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-[#0284C7] mt-0.5">
                    {member.role}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate max-w-md mt-0.5">
                    {member.desc}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                {/* Move Up / Down */}
                <button
                  type="button"
                  onClick={() => handleMove(member.id, 'up')}
                  disabled={idx === 0}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  title="Move Up"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleMove(member.id, 'down')}
                  disabled={idx === filteredMembers.length - 1}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  title="Move Down"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>

                {/* Toggle Visibility */}
                <button
                  type="button"
                  onClick={() => handleToggleActive(member)}
                  className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                    member.isActive
                      ? 'border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                      : 'border-slate-200 text-slate-400 hover:bg-slate-100'
                  }`}
                  title={member.isActive ? (isBn ? 'সক্রিয় (ক্লিক করে লুকান)' : 'Active (Click to Hide)') : (isBn ? 'লুকানো (ক্লিক করে দেখান)' : 'Hidden (Click to Show)')}
                >
                  {member.isActive ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </button>

                {/* Edit */}
                <button
                  type="button"
                  onClick={() => handleOpenEditModal(member)}
                  className="px-2.5 py-1.5 rounded-lg border border-sky-200 text-[#0284C7] bg-sky-50 hover:bg-sky-100 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>{isBn ? 'সম্পাদনা' : 'Edit'}</span>
                </button>

                {/* Delete */}
                <button
                  type="button"
                  onClick={() => handleDeleteMember(member.id, member.name)}
                  className="p-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 cursor-pointer"
                  title="Delete Member"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}

          {filteredMembers.length === 0 && (
            <div className="p-12 text-center text-slate-500 space-y-2">
              <Users className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-sm font-semibold">{isBn ? 'কোনো সদস্য খুঁজে পাওয়া যায়নি।' : 'No members found.'}</p>
            </div>
          )}
        </div>
      </div>

      {/* ADD / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-scale-up my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-sky-100 text-[#0284C7]">
                  <Users className="w-4 h-4" />
                </span>
                <h3 className="font-extrabold text-slate-900 text-base">
                  {editingMember
                    ? (isBn ? 'কমিটি সদস্য তথ্য সম্পাদনা' : 'Edit Committee Member')
                    : (isBn ? 'নতুন কমিটি সদস্য যুক্ত করুন' : 'Add Committee Member')}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-4">
              {/* Photo Preview and Quick Presets */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700">
                  {isBn ? 'সদস্যের ছবি (URL)' : 'Photo URL'}
                </label>
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-[#0284C7] shrink-0 bg-slate-100 shadow-sm">
                    <img
                      src={formData.img || PRESET_AVATARS[0]}
                      alt="Preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = PRESET_AVATARS[0];
                      }}
                    />
                  </div>
                  <input
                    type="url"
                    value={formData.img || ''}
                    onChange={(e) => setFormData({ ...formData, img: e.target.value })}
                    placeholder="https://images.unsplash.com/..."
                    className="flex-1 px-3 py-2 rounded-xl text-xs border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#0284C7]/20 focus:outline-hidden"
                  />
                </div>

                {/* Quick Avatar Presets */}
                <div className="pt-1">
                  <span className="text-[10px] text-slate-400 block mb-1">
                    {isBn ? 'বা দ্রুত প্রিসেট ছবি বেছে নিন:' : 'Or choose from quick presets:'}
                  </span>
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                    {PRESET_AVATARS.map((preset, pIdx) => (
                      <button
                        key={`preset-${pIdx}`}
                        type="button"
                        onClick={() => setFormData({ ...formData, img: preset })}
                        className={`w-7 h-7 rounded-full overflow-hidden border-2 shrink-0 transition-transform hover:scale-110 cursor-pointer ${
                          formData.img === preset ? 'border-[#0284C7] ring-2 ring-sky-300' : 'border-slate-200'
                        }`}
                      >
                        <img src={preset} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Names: English and Bangla */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">
                    {isBn ? 'নাম (ইংরেজি) *' : 'Name (English) *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Dr. M. A. Kashem"
                    className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#0284C7]/20 focus:outline-hidden"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">
                    {isBn ? 'নাম (বাংলা)' : 'Name (Bangla)'}
                  </label>
                  <input
                    type="text"
                    value={formData.nameBn || ''}
                    onChange={(e) => setFormData({ ...formData, nameBn: e.target.value })}
                    placeholder="ড. এম. এ. কাশেম"
                    className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#0284C7]/20 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Roles: English and Bangla */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">
                    {isBn ? 'পদবি (ইংরেজি) *' : 'Role / Designation (English) *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.role || ''}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    placeholder="Convenor (আহ্বায়ক)"
                    className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#0284C7]/20 focus:outline-hidden"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">
                    {isBn ? 'পদবি (বাংলা)' : 'Role / Designation (Bangla)'}
                  </label>
                  <input
                    type="text"
                    value={formData.roleBn || ''}
                    onChange={(e) => setFormData({ ...formData, roleBn: e.target.value })}
                    placeholder="আহ্বায়ক"
                    className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#0284C7]/20 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Batch / Affiliation and Order */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">
                    {isBn ? 'ব্যাচ / বিভাগ' : 'Batch / Affiliation'}
                  </label>
                  <input
                    type="text"
                    value={formData.batch || ''}
                    onChange={(e) => setFormData({ ...formData, batch: e.target.value })}
                    placeholder="e.g. 1974, Administration, Faculty"
                    className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#0284C7]/20 focus:outline-hidden"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">
                    {isBn ? 'প্রদর্শন ক্রম (Order)' : 'Display Order'}
                  </label>
                  <input
                    type="number"
                    value={formData.order || 1}
                    onChange={(e) => setFormData({ ...formData, order: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#0284C7]/20 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Descriptions: English and Bangla */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">
                    {isBn ? 'বিবরণ (ইংরেজি)' : 'Description (English)'}
                  </label>
                  <textarea
                    rows={2}
                    value={formData.desc || ''}
                    onChange={(e) => setFormData({ ...formData, desc: e.target.value })}
                    placeholder="1974 SSC Batch • Senior Civil Servant"
                    className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#0284C7]/20 focus:outline-hidden"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">
                    {isBn ? 'বিবরণ (বাংলা)' : 'Description (Bangla)'}
                  </label>
                  <textarea
                    rows={2}
                    value={formData.descBn || ''}
                    onChange={(e) => setFormData({ ...formData, descBn: e.target.value })}
                    placeholder="১৯৭৪ এসএসসি ব্যাচ • সাবেক সচিব"
                    className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#0284C7]/20 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isActiveToggle"
                  checked={formData.isActive !== false}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="rounded-md border-slate-300 text-[#0284C7] focus:ring-[#0284C7]"
                />
                <label htmlFor="isActiveToggle" className="text-xs font-semibold text-slate-800 cursor-pointer">
                  {isBn ? 'হোম পেজে সক্রিয়ভাবে প্রদর্শন করুন' : 'Show actively on Home Page'}
                </label>
              </div>

              {/* Submit / Cancel Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  {isBn ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#0284C7] hover:bg-[#0EA5E9] text-white text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{editingMember ? (isBn ? 'সংরক্ষণ করুন' : 'Save Changes') : (isBn ? 'যুক্ত করুন' : 'Add Member')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
