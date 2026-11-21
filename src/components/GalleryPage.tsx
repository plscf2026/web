import { useState, useEffect } from 'react';
import {
  Image as ImageIcon,
  Video as VideoIcon,
  Play,
  X,
  Sparkles,
  Edit,
  ExternalLink,
} from 'lucide-react';
import { Language } from '../types';
import { translations } from '../i18n/translations';
import { GlobalPagination } from './common/GlobalPagination';
import { paginate, DEFAULT_PAGE_SIZE } from '../utils/pagination';
import { GalleryService, GalleryMediaItem } from '../services/galleryService';

interface GalleryPageProps {
  language: Language;
  onNavigate?: (view: string, replace?: boolean, extraParams?: Record<string, string>) => void;
}

function getEmbedUrl(url?: string): string | null {
  if (!url) return null;
  const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  if (ytMatch && ytMatch[1]) {
    return `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1`;
  }
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch && vimeoMatch[1]) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1`;
  }
  return null;
}

export const GalleryPage: React.FC<GalleryPageProps> = ({ language, onNavigate }) => {
  const t = translations[language];

  const [mediaItems, setMediaItems] = useState<GalleryMediaItem[]>(GalleryService.getLocalCache());
  const [activeTab, setActiveTab] = useState<'photos' | 'videos'>('photos');
  const [activeAlbum, setActiveAlbum] = useState<string>('all');
  const [selectedItem, setSelectedItem] = useState<GalleryMediaItem | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  useEffect(() => {
    // Load dynamically from database/file/local storage
    GalleryService.loadItems().then((items) => {
      setMediaItems(items);
    });

    // Real-time subscription to admin updates
    const unsubscribe = GalleryService.subscribe((updated) => {
      setMediaItems(updated);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    setPage(1);
  }, [activeTab, activeAlbum]);

  const filteredItems = mediaItems.filter((item) => {
    const matchType = activeTab === 'photos' ? item.type === 'photo' : item.type === 'video';
    const matchAlbum = activeAlbum === 'all' || item.album === activeAlbum;
    return matchType && matchAlbum;
  });

  const embedUrl = selectedItem?.videoUrl ? getEmbedUrl(selectedItem.videoUrl) : null;
  const isDirectVideo =
    selectedItem?.videoUrl &&
    (selectedItem.videoUrl.endsWith('.mp4') ||
      selectedItem.videoUrl.endsWith('.webm') ||
      selectedItem.videoUrl.startsWith('blob:') ||
      selectedItem.videoUrl.startsWith('data:video/'));

  return (
    <div className="max-w-7xl mx-auto px-4 py-10 space-y-8">
      {/* Title & Super Admin Edit Shortcut */}
      <div className="text-center space-y-3 relative">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E2EEF8] text-[#0284C7] text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>{language === 'bn' ? 'সোনালী স্মৃতির সংগ্রহশালা' : 'Heritage Archive 1962-2027'}</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          {t.galleryHeading}
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 max-w-xl mx-auto">
          {t.gallerySubtitle}
        </p>

        {/* Quick Admin Edit Button */}
        {onNavigate && (
          <div className="pt-1 flex justify-center">
            <button
              type="button"
              onClick={() => onNavigate('admin', false, { role: 'super_admin' })}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-slate-900 hover:bg-[#0284C7] text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <Edit className="w-3.5 h-3.5" />
              <span>{language === 'bn' ? '📸 গ্যালারি এডিটিং প্যানেল' : '📸 Admin Gallery Editor'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Tabs: Photos vs Videos */}
      <div className="flex justify-center">
        <div className="bg-white p-1 rounded-2xl border border-slate-200 shadow-xs flex gap-1">
          <button
            onClick={() => {
              setActiveTab('photos');
              setActiveAlbum('all');
            }}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'photos'
                ? 'bg-[#0284C7] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>{t.tabPhotos}</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('videos');
              setActiveAlbum('all');
            }}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'videos'
                ? 'bg-[#0284C7] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <VideoIcon className="w-4 h-4" />
            <span>{t.tabVideos}</span>
          </button>
        </div>
      </div>

      {/* Album Filters */}
      {activeTab === 'photos' && (
        <div className="flex flex-wrap justify-center gap-1.5">
          {[
            { id: 'all', label: t.albumAll },
            { id: 'heritage', label: t.albumHeritage },
            { id: 'alumni', label: t.albumAlumni },
            { id: 'modern', label: t.albumModern },
            { id: 'campus', label: t.albumCampus },
            { id: 'cultural', label: language === 'bn' ? 'সাংস্কৃতিক উৎসব' : 'Cultural' },
          ].map((alb) => (
            <button
              key={alb.id}
              onClick={() => setActiveAlbum(alb.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                activeAlbum === alb.id
                  ? 'bg-slate-900 text-white'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              {alb.label}
            </button>
          ))}
        </div>
      )}

      {/* Media Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {paginate(filteredItems, page, pageSize).map((item) => (
          <div
            key={item.id}
            onClick={() => setSelectedItem(item)}
            className="group bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-xs hover:shadow-xl transition-all cursor-pointer flex flex-col justify-between"
          >
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
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/20 transition-colors">
                  <div className="w-12 h-12 rounded-full bg-[#0284C7] text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <Play className="w-5 h-5 fill-white ml-0.5" />
                  </div>
                </div>
              )}

              <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900/80 text-white backdrop-blur-xs">
                {item.year}
              </span>
            </div>

            <div className="p-4 space-y-1">
              <h3 className="font-bold text-slate-900 text-xs sm:text-sm line-clamp-1 group-hover:text-[#0284C7] transition-colors">
                {language === 'bn' ? item.titleBn : item.titleEn}
              </h3>
              <p className="text-[11px] text-slate-500 line-clamp-2">
                {language === 'bn' ? item.descriptionBn || item.descriptionEn : item.descriptionEn || item.descriptionBn}
              </p>
            </div>
          </div>
        ))}
      </div>

      <GlobalPagination
        currentPage={page}
        pageSize={pageSize}
        totalRecords={filteredItems.length}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        language={language}
      />

      {/* Lightbox / Video Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-3xl w-full overflow-hidden shadow-2xl border border-slate-700 space-y-4">
            <div className="relative aspect-16/9 bg-black flex items-center justify-center">
              {selectedItem.type === 'photo' ? (
                <img
                  src={selectedItem.thumbnail}
                  alt={selectedItem.titleEn}
                  className="w-full h-full object-contain"
                />
              ) : embedUrl ? (
                <iframe
                  src={embedUrl}
                  title={selectedItem.titleEn}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full border-0"
                />
              ) : isDirectVideo ? (
                <video
                  src={selectedItem.videoUrl}
                  controls
                  autoPlay
                  className="w-full h-full"
                />
              ) : (
                <div className="text-center p-8 text-white space-y-3">
                  <Play className="w-16 h-16 text-[#38BDF8] mx-auto animate-pulse" />
                  <p className="text-sm font-semibold">
                    {language === 'bn' ? 'ভিডিও স্ট্রিম প্লেয়ার' : 'Video Memory Stream'}
                  </p>
                  {selectedItem.videoUrl && (
                    <a
                      href={selectedItem.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#0284C7] text-white text-xs font-bold hover:bg-[#0EA5E9]"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>{language === 'bn' ? 'ভিডিও প্লে করুন' : 'Watch Video'}</span>
                    </a>
                  )}
                  <p className="text-xs text-slate-400">
                    Police Lines School and College Faridpur Media Archive
                  </p>
                </div>
              )}

              <button
                onClick={() => setSelectedItem(null)}
                className="absolute top-4 right-4 p-2 rounded-full bg-black/60 text-white hover:bg-black cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#0284C7] uppercase">
                  {selectedItem.album} • {selectedItem.year}
                </span>
                <span className="text-xs text-slate-400 font-mono">ID: {selectedItem.id}</span>
              </div>
              <h3 className="text-lg font-black text-slate-900">
                {language === 'bn' ? selectedItem.titleBn : selectedItem.titleEn}
              </h3>
              <p className="text-xs sm:text-sm text-slate-600">
                {language === 'bn' ? selectedItem.descriptionBn : selectedItem.descriptionEn}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
