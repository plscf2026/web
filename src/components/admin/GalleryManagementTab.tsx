import React, { useState, useEffect, useRef } from 'react';
import {
  Image as ImageIcon,
  Video as VideoIcon,
  Plus,
  Edit2,
  Trash2,
  Upload,
  Download,
  RefreshCw,
  Search,
  Play,
  X,
  ExternalLink,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Eye,
  Film,
  Camera,
} from 'lucide-react';
import { Language } from '../../types';
import { GalleryService, GalleryMediaItem } from '../../services/galleryService';
import { GlobalPagination } from '../common/GlobalPagination';
import { paginate } from '../../utils/pagination';
import { readValidatedImage } from '../../utils/fileValidation';

interface GalleryManagementTabProps {
  language: Language;
}

const ALBUM_OPTIONS = [
  { id: 'heritage', labelEn: 'Heritage (1962-1980)', labelBn: 'ঐতিহ্য ও প্রতিষ্ঠা (১৯৬২-১৯৮০)' },
  { id: 'alumni', labelEn: 'Alumni Batches (1981-2000)', labelBn: 'প্রাক্তন ব্যাচসমূহ (১৯৮১-২০০০)' },
  { id: 'modern', labelEn: 'Modern Campus (2001-2024)', labelBn: 'আধুনিক ক্যাম্পাস (২০০১-২০২৪)' },
  { id: 'campus', labelEn: 'Campus & Infrastructure', labelBn: 'ক্যাম্পাস ও প্রাঙ্গণ' },
  { id: 'cultural', labelEn: 'Cultural & Reunion Celebrations', labelBn: 'সাংস্কৃতিক ও পুনর্মিলনী উৎসব' },
];

export const GalleryManagementTab: React.FC<GalleryManagementTabProps> = ({ language }) => {
  const isBangla = language === 'bn';

  const [mediaList, setMediaList] = useState<GalleryMediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Filters
  const [typeFilter, setTypeFilter] = useState<'all' | 'photo' | 'video'>('all');
  const [albumFilter, setAlbumFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<GalleryMediaItem | null>(null);
  const [previewItem, setPreviewItem] = useState<GalleryMediaItem | null>(null);
  const [itemToDelete, setItemToDelete] = useState<GalleryMediaItem | null>(null);

  // Form Fields
  const [formType, setFormType] = useState<'photo' | 'video'>('photo');
  const [formTitleEn, setFormTitleEn] = useState('');
  const [formTitleBn, setFormTitleBn] = useState('');
  const [formAlbum, setFormAlbum] = useState('heritage');
  const [formYear, setFormYear] = useState('2026');
  const [formThumbnail, setFormThumbnail] = useState('');
  const [formVideoUrl, setFormVideoUrl] = useState('');
  const [formDescEn, setFormDescEn] = useState('');
  const [formDescBn, setFormDescBn] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // File Upload Reference
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadGalleryData();
    const unsubscribe = GalleryService.subscribe((updated) => {
      setMediaList(updated);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const loadGalleryData = async () => {
    setIsLoading(true);
    try {
      const items = await GalleryService.loadItems();
      setMediaList(items);
    } catch (_) {
      setMediaList(GalleryService.getLocalCache());
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncDatabase = async () => {
    setIsSyncing(true);
    setStatusMessage(null);
    try {
      const res = await GalleryService.syncWithSupabase();
      if (res.success) {
        setStatusMessage({
          text: isBangla
            ? `ডাটাবেজ ও ক্লাউড সফলভাবে সিঙ্ক হয়েছে (${res.count}টি আইটেম)`
            : `Database & Cloud synchronized successfully (${res.count} items)`,
          type: 'success',
        });
      } else {
        setStatusMessage({
          text: isBangla ? `সিঙ্ক সতর্কতা: ${res.error}` : `Sync Notice: ${res.error}`,
          type: 'info',
        });
      }
    } catch (e: any) {
      setStatusMessage({ text: e?.message || 'Sync failed', type: 'error' });
    } finally {
      setIsSyncing(false);
    }
  };

  const openAddModal = () => {
    setEditingItem(null);
    setFormType('photo');
    setFormTitleEn('');
    setFormTitleBn('');
    setFormAlbum('heritage');
    setFormYear(new Date().getFullYear().toString());
    setFormThumbnail('');
    setFormVideoUrl('');
    setFormDescEn('');
    setFormDescBn('');
    setShowModal(true);
  };

  const openEditModal = (item: GalleryMediaItem) => {
    setEditingItem(item);
    setFormType(item.type);
    setFormTitleEn(item.titleEn);
    setFormTitleBn(item.titleBn);
    setFormAlbum(item.album);
    setFormYear(item.year);
    setFormThumbnail(item.thumbnail);
    setFormVideoUrl(item.videoUrl || '');
    setFormDescEn(item.descriptionEn);
    setFormDescBn(item.descriptionBn);
    setShowModal(true);
  };

  const handleSaveForm = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!formTitleEn.trim() && !formTitleBn.trim()) {
      setStatusMessage({
        text: isBangla ? 'অনুগ্রহ করে শিরোনাম লিখুন' : 'Please provide a title in English or Bengali',
        type: 'error',
      });
      return;
    }

    if (!formThumbnail.trim()) {
      setStatusMessage({
        text: isBangla ? 'অনুগ্রহ করে থাম্বনেইল বা ছবির লিংক/ফাইল দিন' : 'Please provide an image thumbnail URL or file',
        type: 'error',
      });
      return;
    }

    setIsSaving(true);
    try {
      const newItem: GalleryMediaItem = {
        id: editingItem ? editingItem.id : `M-${Date.now()}`,
        type: formType,
        titleEn: formTitleEn.trim() || formTitleBn.trim(),
        titleBn: formTitleBn.trim() || formTitleEn.trim(),
        album: formAlbum,
        year: formYear.trim() || '2026',
        thumbnail: formThumbnail.trim(),
        videoUrl: formType === 'video' ? formVideoUrl.trim() : '',
        descriptionEn: formDescEn.trim(),
        descriptionBn: formDescBn.trim(),
        sortOrder: editingItem?.sortOrder ?? mediaList.length + 1,
        createdAt: editingItem?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await GalleryService.saveItem(newItem);
      setShowModal(false);
      setStatusMessage({
        text: isBangla
          ? `সফলভাবে ${editingItem ? 'হালনাগাদ' : 'যুক্ত'} করা হয়েছে!`
          : `Item successfully ${editingItem ? 'updated' : 'added'}!`,
        type: 'success',
      });
    } catch (err: any) {
      setStatusMessage({ text: err?.message || 'Save error', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;
    try {
      await GalleryService.deleteItem(itemToDelete.id);
      setItemToDelete(null);
      setStatusMessage({
        text: isBangla ? 'আইটেমটি সফলভাবে মুছে ফেলা হয়েছে।' : 'Item deleted successfully.',
        type: 'success',
      });
    } catch (err: any) {
      setStatusMessage({ text: err?.message || 'Delete error', type: 'error' });
    }
  };

  const handleDeviceFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const validatedDataUrl = await readValidatedImage(file);
      setFormThumbnail(validatedDataUrl);
    } catch (err: any) {
      setStatusMessage({
        text: err?.message || (isBangla ? 'শুধুমাত্র বৈধ JPEG, PNG, বা WebP ছবি আপলোড করা যাবে।' : 'Only valid JPEG, PNG, or WebP images are permitted.'),
        type: 'error',
      });
      e.target.value = '';
    }
  };

  const handleImportJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (text) {
        const res = await GalleryService.importFromJson(text);
        if (res.success) {
          setStatusMessage({
            text: isBangla
              ? `ফাইল থেকে ${res.count}টি ফটো ও ভিডিও সফলভাবে লোড হয়েছে!`
              : `Loaded ${res.count} media items successfully from hosting JSON file!`,
            type: 'success',
          });
        } else {
          setStatusMessage({ text: res.error || 'Import failed', type: 'error' });
        }
      }
    };
    reader.readAsText(file);
    if (importFileRef.current) importFileRef.current.value = '';
  };

  // Filtered List
  const filteredList = mediaList.filter((item) => {
    const matchType = typeFilter === 'all' || item.type === typeFilter;
    const matchAlbum = albumFilter === 'all' || item.album === albumFilter;
    const q = searchQuery.trim().toLowerCase();
    const matchQuery =
      !q ||
      item.titleEn.toLowerCase().includes(q) ||
      item.titleBn.toLowerCase().includes(q) ||
      item.year.includes(q) ||
      item.descriptionEn.toLowerCase().includes(q) ||
      item.descriptionBn.toLowerCase().includes(q);

    return matchType && matchAlbum && matchQuery;
  });

  const photoCount = mediaList.filter((m) => m.type === 'photo').length;
  const videoCount = mediaList.filter((m) => m.type === 'video').length;

  return (
    <div className="space-y-6">
      {/* 1. Header Banner & Quick Metrics */}
      <div className="bg-[#0F172A] text-white rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-xl space-y-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[#0284C7] text-white">
                Gallery CMS & Media Studio
              </span>
              <span className="text-xs text-[#38BDF8] font-mono">Grand Reunion 2027</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              <Camera className="w-8 h-8 text-[#0284C7]" />
              <span>{isBangla ? 'ফটো গ্যালারি ও ভিডিও মেমোরিজ ব্যবস্থাপনা' : 'Photo Gallery & Video Memories CMS'}</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl mt-1 leading-relaxed">
              {isBangla
                ? 'সুপার অ্যাডমিন প্যানেল থেকে ঐতিহাসিক স্মৃতি, প্রাক্তন ব্যাচ, সাংস্কৃতিক অনুষ্ঠান ও ক্যাম্পাসের ফটো এবং ভিডিও যুক্ত, সম্পাদনা বা নিয়ন্ত্রণ করুন।'
                : 'Centralized media command: upload, edit, categorize, and organize official historical photos and video streams.'}
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md p-2 rounded-2xl border border-white/10 shrink-0">
            <div className="px-3 py-1.5 text-center">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Photos</span>
              <span className="text-lg font-black text-[#38BDF8] font-mono">{photoCount}</span>
            </div>
            <div className="w-px h-8 bg-white/20" />
            <div className="px-3 py-1.5 text-center">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Videos</span>
              <span className="text-lg font-black text-emerald-400 font-mono">{videoCount}</span>
            </div>
            <div className="w-px h-8 bg-white/20" />
            <div className="px-3 py-1.5 text-center">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Items</span>
              <span className="text-lg font-black text-white font-mono">{mediaList.length}</span>
            </div>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={openAddModal}
              className="px-5 py-2.5 rounded-full bg-[#0284C7] hover:bg-[#0EA5E9] text-white text-xs font-bold transition-all shadow-md shadow-sky-600/30 flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{isBangla ? 'নতুন ফটো / ভিডিও যুক্ত করুন' : 'Add New Media'}</span>
            </button>

            <button
              type="button"
              onClick={() => GalleryService.downloadHostingJsonFile()}
              className="px-4 py-2.5 rounded-full bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
              title="Download gallery_media.json for direct hosting in cPanel, Vercel, or Netlify"
            >
              <Download className="w-3.5 h-3.5 text-[#38BDF8]" />
              <span>{isBangla ? 'হোস্টিং ফাইল ডাউনলোড (.json)' : 'Download Hosting File (JSON)'}</span>
            </button>

            <button
              type="button"
              onClick={() => importFileRef.current?.click()}
              className="px-4 py-2.5 rounded-full bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
              title="Upload existing gallery_media.json from your computer"
            >
              <Upload className="w-3.5 h-3.5 text-[#0EA5E9]" />
              <span>{isBangla ? 'ফাইল ইমপোর্ট করুন' : 'Import from File'}</span>
            </button>
            <input
              ref={importFileRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleImportJsonFile}
            />
          </div>

          <button
            type="button"
            onClick={handleSyncDatabase}
            disabled={isSyncing}
            className="px-4 py-2.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-[#38BDF8]' : 'text-slate-400'}`} />
            <span>{isSyncing ? (isBangla ? 'সিঙ্ক হচ্ছে...' : 'Syncing...') : (isBangla ? 'ডাটাবেজ রিফ্রেশ' : 'Sync Database')}</span>
          </button>
        </div>
      </div>

      {/* Status Notice Alert */}
      {statusMessage && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-xs font-bold animate-in fade-in ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : statusMessage.type === 'error'
              ? 'bg-rose-50 text-rose-800 border-rose-200'
              : 'bg-sky-50 text-sky-800 border-sky-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : statusMessage.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <Sparkles className="w-4 h-4 text-sky-600 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-slate-400 hover:text-slate-700 cursor-pointer p-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* 2. Search & Filtering Controls */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Type Switcher Pills */}
        <div className="flex items-center gap-1.5 w-full md:w-auto">
          <button
            type="button"
            onClick={() => setTypeFilter('all')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              typeFilter === 'all'
                ? 'bg-[#0F172A] text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {isBangla ? 'সকল মিডিয়া' : 'All Media'} ({mediaList.length})
          </button>

          <button
            type="button"
            onClick={() => setTypeFilter('photo')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              typeFilter === 'photo'
                ? 'bg-[#0284C7] text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>{isBangla ? 'স্থিরচিত্র (Photos)' : 'Photos'} ({photoCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setTypeFilter('video')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              typeFilter === 'video'
                ? 'bg-[#0284C7] text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <VideoIcon className="w-3.5 h-3.5" />
            <span>{isBangla ? 'ভিডিও (Videos)' : 'Videos'} ({videoCount})</span>
          </button>
        </div>

        {/* Album Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto">
          <select
            value={albumFilter}
            onChange={(e) => setAlbumFilter(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
          >
            <option value="all">{isBangla ? 'সকল অ্যালবাম (All Albums)' : 'All Albums'}</option>
            {ALBUM_OPTIONS.map((alb) => (
              <option key={alb.id} value={alb.id}>
                {isBangla ? alb.labelBn : alb.labelEn}
              </option>
            ))}
          </select>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isBangla ? 'শিরোনাম, সাল বা বিষয় খুঁজুন...' : 'Search by title, year...'}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. Media Grid (Photos & Videos) */}
      {isLoading ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
          <RefreshCw className="w-8 h-8 text-[#0284C7] animate-spin mx-auto mb-2" />
          <p className="text-xs text-slate-500 font-bold">{isBangla ? 'মিডিয়া ফাইল লোড হচ্ছে...' : 'Loading media items...'}</p>
        </div>
      ) : filteredList.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 space-y-3">
          <Film className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">
            {isBangla ? 'কোনো ফটো বা ভিডিও পাওয়া যায়নি' : 'No Media Items Found'}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {isBangla
              ? 'আপনার অনুসন্ধান অনুসারে কোনো ফলাফল নেই অথবা এখনো কোনো আইটেম যুক্ত করা হয়নি।'
              : 'No items match your selected filters. Click "Add New Media" to create your first memory item.'}
          </p>
          <button
            type="button"
            onClick={openAddModal}
            className="px-4 py-2 rounded-full bg-[#0284C7] text-white text-xs font-bold hover:bg-[#0EA5E9] cursor-pointer"
          >
            {isBangla ? 'নতুন আইটেম যুক্ত করুন' : 'Add New Media Item'}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {paginate(filteredList, currentPage, pageSize).map((item) => (
            <div
              key={item.id}
              className="group bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-xs hover:shadow-xl transition-all flex flex-col justify-between"
            >
              {/* Media Thumbnail Container */}
              <div className="relative aspect-4/3 overflow-hidden bg-slate-950">
                <img
                  src={item.thumbnail}
                  alt={item.titleEn}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src =
                      'https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?w=800&auto=format&fit=crop&q=80';
                  }}
                />

                {item.type === 'video' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 group-hover:bg-black/20 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-[#0284C7] text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                      <Play className="w-4 h-4 fill-white ml-0.5" />
                    </div>
                  </div>
                )}

                {/* Top Badges */}
                <div className="absolute top-2 left-2 flex items-center gap-1.5">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider text-white shadow-xs ${
                      item.type === 'video' ? 'bg-emerald-600' : 'bg-[#0284C7]'
                    }`}
                  >
                    {item.type === 'video' ? '🎬 Video' : '📸 Photo'}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900/80 text-white backdrop-blur-xs">
                    {item.year}
                  </span>
                </div>

                {/* Album Tag */}
                <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded text-[10px] font-bold bg-[#0F172A]/90 text-[#38BDF8] border border-slate-700/60 backdrop-blur-xs capitalize">
                  {item.album}
                </span>

                {/* Quick Preview Eye */}
                <button
                  type="button"
                  onClick={() => setPreviewItem(item)}
                  className="absolute bottom-2 right-2 p-1.5 rounded-full bg-black/60 hover:bg-black text-white cursor-pointer"
                  title="Preview"
                >
                  <Eye className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Title & Description */}
              <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 text-xs sm:text-sm line-clamp-1 group-hover:text-[#0284C7] transition-colors">
                    {isBangla ? item.titleBn : item.titleEn}
                  </h4>
                  {isBangla && item.titleEn !== item.titleBn && (
                    <p className="text-[10px] text-slate-400 line-clamp-1 italic">{item.titleEn}</p>
                  )}
                  <p className="text-[11px] text-slate-500 line-clamp-2 mt-1">
                    {isBangla ? item.descriptionBn || item.descriptionEn : item.descriptionEn || item.descriptionBn}
                  </p>
                </div>

                {/* Actions Bar */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(item.thumbnail);
                      alert(isBangla ? 'লিংক কপি করা হয়েছে!' : 'Media path copied to clipboard!');
                    }}
                    className="text-[10px] text-slate-400 hover:text-slate-700 flex items-center gap-1 cursor-pointer"
                    title="Copy Image URL / Path"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Path</span>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditModal(item)}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-sky-100 text-slate-700 hover:text-[#0284C7] text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>{isBangla ? 'সম্পাদন' : 'Edit'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setItemToDelete(item)}
                      className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                      title="Delete Item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {filteredList.length > pageSize && (
        <GlobalPagination
          currentPage={currentPage}
          pageSize={pageSize}
          totalRecords={filteredList.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          language={language}
        />
      )}

      {/* ======================================================== */}
      {/* MODAL: ADD / EDIT GALLERY ITEM                           */}
      {/* ======================================================== */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 border border-slate-200 shadow-2xl space-y-6 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-[#E2EEF8] text-[#0284C7] flex items-center justify-center">
                  {formType === 'video' ? <VideoIcon className="w-5 h-5" /> : <ImageIcon className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">
                    {editingItem
                      ? (isBangla ? 'মিডিয়া আইটেম সম্পাদন করুন' : 'Edit Media Item')
                      : (isBangla ? 'নতুন ফটো / ভিডিও যুক্ত করুন' : 'Add New Photo or Video Memory')}
                  </h3>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {editingItem ? `ID: ${editingItem.id}` : 'Grand Reunion Media Archive'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="space-y-4 text-xs">
              {/* Type Switcher */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  {isBangla ? 'মিডিয়া ক্যাটাগরি ধরন *' : 'Media Type *'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormType('photo')}
                    className={`py-2.5 px-4 rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer transition-all border ${
                      formType === 'photo'
                        ? 'border-[#0284C7] bg-[#E2EEF8] text-[#0284C7] shadow-xs'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <ImageIcon className="w-4 h-4" />
                    <span>{isBangla ? '📸 স্থিরচিত্র (Photo)' : '📸 Photo'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormType('video')}
                    className={`py-2.5 px-4 rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer transition-all border ${
                      formType === 'video'
                        ? 'border-[#0284C7] bg-[#E2EEF8] text-[#0284C7] shadow-xs'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <VideoIcon className="w-4 h-4" />
                    <span>{isBangla ? '🎬 ভিডিও মেমোরি (Video)' : '🎬 Video Memory'}</span>
                  </button>
                </div>
              </div>

              {/* Title in Bengali & English */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {isBangla ? 'শিরোনাম (বাংলায়) *' : 'Title (Bengali) *'}
                  </label>
                  <input
                    type="text"
                    value={formTitleBn}
                    onChange={(e) => setFormTitleBn(e.target.value)}
                    placeholder="উদা: রজত জয়ন্তী উৎসব ও শিক্ষার্থী মিলনমেলা"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#0284C7] bg-white"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {isBangla ? 'শিরোনাম (ইংরেজিতে) *' : 'Title (English) *'}
                  </label>
                  <input
                    type="text"
                    value={formTitleEn}
                    onChange={(e) => setFormTitleEn(e.target.value)}
                    placeholder="e.g. Silver Jubilee Gathering & Batch Reunion"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#0284C7] bg-white"
                    required
                  />
                </div>
              </div>

              {/* Album & Year */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {isBangla ? 'অ্যালবাম ক্যাটাগরি *' : 'Album Category *'}
                  </label>
                  <select
                    value={formAlbum}
                    onChange={(e) => setFormAlbum(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
                  >
                    {ALBUM_OPTIONS.map((alb) => (
                      <option key={alb.id} value={alb.id}>
                        {isBangla ? alb.labelBn : alb.labelEn}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {isBangla ? 'সাল / ব্যাচ বছর *' : 'Year / Batch Year *'}
                  </label>
                  <input
                    type="text"
                    value={formYear}
                    onChange={(e) => setFormYear(e.target.value)}
                    placeholder="e.g. 1962, 1987, 2026"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#0284C7] bg-white"
                    required
                  />
                </div>
              </div>

              {/* Photo / Thumbnail Image URL or Upload */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700">
                    {formType === 'video'
                      ? (isBangla ? 'ভিডিও থাম্বনেইল ছবি *' : 'Video Thumbnail Image *')
                      : (isBangla ? 'ছবির লিংক বা হোস্টিং পাথ *' : 'Photo Image URL or Hosting Path *')}
                  </label>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-[11px] font-bold text-[#0284C7] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Upload className="w-3 h-3" />
                    <span>{isBangla ? 'ডিভাইস থেকে ছবি আপলোড' : 'Upload from Device'}</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleDeviceFileUpload}
                  />
                </div>

                <input
                  type="text"
                  value={formThumbnail}
                  onChange={(e) => setFormThumbnail(e.target.value)}
                  placeholder="https://... or /assets/homepage/memory_1.jpg"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#0284C7] bg-white"
                  required
                />
                <p className="text-[10px] text-slate-400">
                  {isBangla
                    ? 'হোস্টিং ফোল্ডার (যেমন /assets/homepage/...) অথবা যেকোনো ওয়েব ইমেজ লিংক দিন।'
                    : 'Enter hosting path (e.g. /assets/homepage/...) or web image URL.'}
                </p>

                {formThumbnail && (
                  <div className="relative w-32 aspect-4/3 rounded-xl overflow-hidden border border-slate-200 mt-2 bg-slate-100">
                    <img
                      src={formThumbnail}
                      alt="Thumbnail Preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src =
                          'https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?w=800&auto=format&fit=crop&q=80';
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Video Stream URL (Only if video) */}
              {formType === 'video' && (
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700">
                    {isBangla ? 'ভিডিও স্ট্রিম লিংক (YouTube / Vimeo / MP4) *' : 'Video Stream URL (YouTube, Vimeo, MP4) *'}
                  </label>
                  <input
                    type="text"
                    value={formVideoUrl}
                    onChange={(e) => setFormVideoUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=... or https://.../video.mp4"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#0284C7] bg-white"
                    required
                  />
                </div>
              )}

              {/* Descriptions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {isBangla ? 'বিবরণ (বাংলা)' : 'Description (Bengali)'}
                  </label>
                  <textarea
                    value={formDescBn}
                    onChange={(e) => setFormDescBn(e.target.value)}
                    rows={2}
                    placeholder="স্মৃতিচারণ বা আলোকচিত্রের সংক্ষিপ্ত প্রেক্ষাপট..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#0284C7] bg-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {isBangla ? 'বিবরণ (ইংরেজি)' : 'Description (English)'}
                  </label>
                  <textarea
                    value={formDescEn}
                    onChange={(e) => setFormDescEn(e.target.value)}
                    rows={2}
                    placeholder="Short narrative or background context of the photo..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#0284C7] bg-white"
                  />
                </div>
              </div>

              {/* Buttons */}
              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-full border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 cursor-pointer"
                >
                  {isBangla ? 'বাতিল' : 'Cancel'}
                </button>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2 rounded-full bg-[#0284C7] hover:bg-[#0EA5E9] text-white font-bold shadow-md shadow-sky-600/30 cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  {isSaving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>
                    {isSaving
                      ? (isBangla ? 'সংরক্ষণ হচ্ছে...' : 'Saving to Database...')
                      : (isBangla ? 'ডাটাবেজে সংরক্ষণ করুন' : 'Save Media')}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: LIGHTBOX PREVIEW                                  */}
      {/* ======================================================== */}
      {previewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-3xl w-full overflow-hidden shadow-2xl border border-slate-700 space-y-4">
            <div className="relative aspect-16/9 bg-black flex items-center justify-center">
              {previewItem.type === 'photo' ? (
                <img
                  src={previewItem.thumbnail}
                  alt={previewItem.titleEn}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-center p-8 text-white space-y-3">
                  <Play className="w-16 h-16 text-[#38BDF8] mx-auto animate-pulse" />
                  <p className="text-sm font-bold">
                    {previewItem.videoUrl || (isBangla ? 'ভিডিও স্ট্রিম প্লেয়ার' : 'Video Stream Player')}
                  </p>
                  <p className="text-xs text-slate-400">Police Lines School and College Faridpur Media Archive</p>
                </div>
              )}

              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                className="absolute top-4 right-4 p-2 rounded-full bg-black/60 text-white hover:bg-black cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#0284C7] uppercase">
                  {previewItem.album} • {previewItem.year}
                </span>
                <span className="text-xs text-slate-400 font-mono">ID: {previewItem.id}</span>
              </div>
              <h3 className="text-lg font-black text-slate-900">
                {isBangla ? previewItem.titleBn : previewItem.titleEn}
              </h3>
              <p className="text-xs sm:text-sm text-slate-600">
                {isBangla ? previewItem.descriptionBn : previewItem.descriptionEn}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: DELETE CONFIRMATION                               */}
      {/* ======================================================== */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border-2 border-rose-300 space-y-4">
            <div className="flex items-center gap-3 text-rose-700">
              <AlertCircle className="w-6 h-6 text-rose-600 shrink-0" />
              <h3 className="font-bold text-slate-900 text-base">
                {isBangla ? 'মিডিয়া আইটেম মুছে ফেলা নিশ্চিতকরণ' : 'Confirm Media Deletion'}
              </h3>
            </div>

            <p className="text-xs text-slate-600">
              {isBangla
                ? `আপনি কি নিশ্চিত যে আপনি "${itemToDelete.titleBn || itemToDelete.titleEn}" ডাটাবেজ এবং গ্যালারি থেকে স্থায়ীভাবে মুছে ফেলতে চান?`
                : `Are you sure you want to permanently delete "${itemToDelete.titleEn}" from the database and public gallery?`}
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="px-4 py-2 rounded-full border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 cursor-pointer text-xs"
              >
                {isBangla ? 'বাতিল' : 'Cancel'}
              </button>

              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="px-5 py-2 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-bold cursor-pointer text-xs shadow-xs"
              >
                {isBangla ? 'মুছে ফেলুন' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
