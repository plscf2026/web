import { useState, useEffect } from 'react';
import {
  Image as ImageIcon,
  Video as VideoIcon,
  Play,
  X,
  Sparkles,
} from 'lucide-react';
import { Language } from '../types';
import { translations } from '../i18n/translations';
import { GlobalPagination } from './common/GlobalPagination';
import { paginate, DEFAULT_PAGE_SIZE } from '../utils/pagination';

interface GalleryPageProps {
  language: Language;
}

interface MediaItem {
  id: string;
  type: 'photo' | 'video';
  titleEn: string;
  titleBn: string;
  album: 'heritage' | 'alumni' | 'modern' | 'campus' | 'cultural';
  year: string;
  thumbnail: string;
  videoUrl?: string;
  descriptionEn: string;
  descriptionBn: string;
}

const MEDIA_ITEMS: MediaItem[] = [
  {
    id: 'M1',
    type: 'photo',
    titleEn: 'Founding Batch of Police Lines High School (1962)',
    titleBn: 'বিদ্যালয় প্রতিষ্ঠার উদ্বোধনী ব্যাচ ও শিক্ষকবৃন্দ (১৯৬২)',
    album: 'heritage',
    year: '1962',
    thumbnail: 'https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?w=800&auto=format&fit=crop&q=80',
    descriptionEn: 'The historic first gathering of students and teachers under the banyan tree of Faridpur Police Ground.',
    descriptionBn: 'ফরিদপুর পুলিশ লাইন্স মাঠে প্রতিষ্ঠিত বিদ্যালয়ের প্রথম শিক্ষক ও শিক্ষার্থী সমাবেশের ঐতিহাসিক মুহূর্ত।',
  },
  {
    id: 'M2',
    type: 'photo',
    titleEn: 'SSC 1978 Batch Celebration',
    titleBn: 'এসএসসি ১৯৭৮ ব্যাচের বিদায় সংবর্ধনা',
    album: 'heritage',
    year: '1978',
    thumbnail: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&auto=format&fit=crop&q=80',
    descriptionEn: 'Memorable batch photo of SSC 1978 after academic board triumph.',
    descriptionBn: 'বোর্ড পরীক্ষায় অভাবনীয় সাফল্যের পর ১৯৭৮ সালের এসএসসি ব্যাচ।',
  },
  {
    id: 'M3',
    type: 'photo',
    titleEn: 'Silver Jubilee Celebration (1987)',
    titleBn: 'রজত জয়ন্তী উদ্‌যাপন (১৯৮৭)',
    album: 'alumni',
    year: '1987',
    thumbnail: 'https://images.unsplash.com/photo-1511578314322-379afb476865?w=800&auto=format&fit=crop&q=80',
    descriptionEn: '25 years celebration gala held at the central district stadium.',
    descriptionBn: '২৫ বছর পূর্তিতে আয়োজিত বর্ণাঢ্য রজত জয়ন্তী উৎসব।',
  },
  {
    id: 'M4',
    type: 'photo',
    titleEn: 'Science Lab & Robotic Fair',
    titleBn: 'বিজ্ঞান মেলা ও ল্যাবরেটরি প্রদর্শনী',
    album: 'modern',
    year: '2016',
    thumbnail: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=800&auto=format&fit=crop&q=80',
    descriptionEn: 'Innovative science projects built by high school students.',
    descriptionBn: 'শিক্ষার্থীদের উদ্ভাবনী বিজ্ঞান ও রোবোটিক্স প্রকল্প প্রদর্শনী।',
  },
  {
    id: 'M5',
    type: 'video',
    titleEn: 'Historic Reunion Documentary: 64 Years of Legacy',
    titleBn: 'ঐতিহাসিক প্রামাণ্যচিত্র: গৌরবের ৬৪ বছর',
    album: 'cultural',
    year: '2026',
    thumbnail: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&auto=format&fit=crop&q=80',
    descriptionEn: 'Documentary recounting the transformation from a police school to a premier college.',
    descriptionBn: 'বিদ্যালয় প্রতিষ্ঠার ইতিহাস ও দেশসেরা প্রতিষ্ঠানে রূপান্তরের গল্প।',
  },
  {
    id: 'M6',
    type: 'video',
    titleEn: 'Teacher Interviews: Golden Memories of Faridpur',
    titleBn: 'গুরুজনদের স্মৃতিকথা: প্রবীণ শিক্ষকদের স্মৃতিচারণ',
    album: 'cultural',
    year: '2025',
    thumbnail: 'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=800&auto=format&fit=crop&q=80',
    descriptionEn: 'Heartwarming interviews with former headmasters and senior faculty.',
    descriptionBn: 'প্রাক্তন প্রধান শিক্ষক ও বর্ষীয়ান শিক্ষকদের আন্তরিক সাক্ষাৎকার।',
  },
  {
    id: 'M7',
    type: 'photo',
    titleEn: 'Modern Academic Building & Campus Grounds',
    titleBn: 'আধুনিক একাডেমিক ভবন ও সবুজ প্রাঙ্গণ',
    album: 'campus',
    year: '2024',
    thumbnail: 'https://images.unsplash.com/photo-1562774053-701939374585?w=800&auto=format&fit=crop&q=80',
    descriptionEn: 'Aerial view of the renovated high school and college facilities in Joyrampur, Faridpur.',
    descriptionBn: 'জয়রামপুরে অবস্থিত দৃষ্টিনন্দন বহুতল কলেজ ভবন ও খেলার মাঠ।',
  },
  {
    id: 'M8',
    type: 'photo',
    titleEn: 'Annual Sports Parade & Police March Past',
    titleBn: 'বার্ষিক ক্রীড়া প্রতিযোগিতা ও বর্ণাঢ্য মার্চপাস্ট',
    album: 'campus',
    year: '2023',
    thumbnail: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=800&auto=format&fit=crop&q=80',
    descriptionEn: 'Cadet drill and athletic sprint finals on sports day.',
    descriptionBn: 'শৃঙ্খলাপরায়ণ প্যারেড ও ক্রীড়া প্রতিযোগিতার রোমাঞ্চকর মুহূর্ত।',
  },
];

export const GalleryPage: React.FC<GalleryPageProps> = ({ language }) => {
  const t = translations[language];

  const [activeTab, setActiveTab] = useState<'photos' | 'videos'>('photos');
  const [activeAlbum, setActiveAlbum] = useState<string>('all');
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [activeTab, activeAlbum]);

  const filteredItems = MEDIA_ITEMS.filter((item) => {
    const matchType = activeTab === 'photos' ? item.type === 'photo' : item.type === 'video';
    const matchAlbum = activeAlbum === 'all' || item.album === activeAlbum;
    return matchType && matchAlbum;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-10 space-y-8">
      {/* Title */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>{language === 'bn' ? 'সোনালী স্মৃতির সংগ্রহশালা' : 'Heritage Archive 1962-2026'}</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          {t.galleryHeading}
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 max-w-xl mx-auto">
          {t.gallerySubtitle}
        </p>
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
                ? 'bg-emerald-600 text-white shadow-xs'
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
                ? 'bg-emerald-600 text-white shadow-xs'
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
              />

              {item.type === 'video' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/20 transition-colors">
                  <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <Play className="w-5 h-5 fill-white ml-0.5" />
                  </div>
                </div>
              )}

              <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900/80 text-white backdrop-blur-xs">
                {item.year}
              </span>
            </div>

            <div className="p-4 space-y-1">
              <h3 className="font-bold text-slate-900 text-xs sm:text-sm line-clamp-1 group-hover:text-emerald-700 transition-colors">
                {language === 'bn' ? item.titleBn : item.titleEn}
              </h3>
              <p className="text-[11px] text-slate-500 line-clamp-2">
                {language === 'bn' ? item.descriptionBn : item.descriptionEn}
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
              ) : (
                <div className="text-center p-8 text-white space-y-3">
                  <Play className="w-16 h-16 text-emerald-400 mx-auto animate-pulse" />
                  <p className="text-sm font-semibold">
                    {language === 'bn' ? 'ভিডিও স্ট্রিম চালু হচ্ছে...' : 'Playing High-Definition Video Stream...'}
                  </p>
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
                <span className="text-xs font-bold text-emerald-700 uppercase">
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
