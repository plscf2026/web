import { supabase } from './supabase';

export interface GalleryMediaItem {
  id: string;
  type: 'photo' | 'video';
  titleEn: string;
  titleBn: string;
  album: 'heritage' | 'alumni' | 'modern' | 'campus' | 'cultural' | string;
  year: string;
  thumbnail: string;
  videoUrl?: string;
  descriptionEn: string;
  descriptionBn: string;
  sortOrder?: number;
  createdAt?: string;
  updatedAt?: string;
}

const STORAGE_KEY = 'plscf_gallery_media_v1';
const DATA_FILE_URL = '/data/gallery_media.json';

const DEFAULT_MEDIA_ITEMS: GalleryMediaItem[] = [
  {
    id: 'M1',
    type: 'photo',
    titleEn: 'Founding Batch of Police Lines High School (1962)',
    titleBn: 'বিদ্যালয় প্রতিষ্ঠার উদ্বোধনী ব্যাচ ও শিক্ষকবৃন্দ (১৯৬২)',
    album: 'heritage',
    year: '1962',
    thumbnail: 'https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?w=800&auto=format&fit=crop&q=80',
    videoUrl: '',
    descriptionEn: 'The historic first gathering of students and teachers under the banyan tree of Faridpur Police Ground.',
    descriptionBn: 'ফরিদপুর পুলিশ লাইন্স মাঠে প্রতিষ্ঠিত বিদ্যালয়ের প্রথম শিক্ষক ও শিক্ষার্থী সমাবেশের ঐতিহাসিক মুহূর্ত।',
    sortOrder: 1,
  },
  {
    id: 'M2',
    type: 'photo',
    titleEn: 'SSC 1978 Batch Celebration',
    titleBn: 'এসএসসি ১৯৭৮ ব্যাচের বিদায় সংবর্ধনা',
    album: 'heritage',
    year: '1978',
    thumbnail: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&auto=format&fit=crop&q=80',
    videoUrl: '',
    descriptionEn: 'Memorable batch photo of SSC 1978 after academic board triumph.',
    descriptionBn: 'বোর্ড পরীক্ষায় অভাবনীয় সাফল্যের পর ১৯৭৮ সালের এসএসসি ব্যাচ।',
    sortOrder: 2,
  },
  {
    id: 'M3',
    type: 'photo',
    titleEn: 'Silver Jubilee Celebration (1987)',
    titleBn: 'রজত জয়ন্তী উদ্‌যাপন (১৯৮৭)',
    album: 'alumni',
    year: '1987',
    thumbnail: 'https://images.unsplash.com/photo-1511578314322-379afb476865?w=800&auto=format&fit=crop&q=80',
    videoUrl: '',
    descriptionEn: '25 years celebration gala held at the central district stadium.',
    descriptionBn: '২৫ বছর পূর্তিতে আয়োজিত বর্ণাঢ্য রজত জয়ন্তী উৎসব।',
    sortOrder: 3,
  },
  {
    id: 'M4',
    type: 'photo',
    titleEn: 'Science Lab & Robotic Fair',
    titleBn: 'বিজ্ঞান মেলা ও ল্যাবরেটরি প্রদর্শনী',
    album: 'modern',
    year: '2016',
    thumbnail: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=800&auto=format&fit=crop&q=80',
    videoUrl: '',
    descriptionEn: 'Innovative science projects built by high school students.',
    descriptionBn: 'শিক্ষার্থীদের উদ্ভাবনী বিজ্ঞান ও রোবোটিক্স প্রকল্প প্রদর্শনী।',
    sortOrder: 4,
  },
  {
    id: 'M5',
    type: 'video',
    titleEn: 'Historic Reunion Documentary: 64 Years of Legacy',
    titleBn: 'ঐতিহাসিক প্রামাণ্যচিত্র: গৌরবের ৬৪ বছর',
    album: 'cultural',
    year: '2026',
    thumbnail: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&auto=format&fit=crop&q=80',
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    descriptionEn: 'Documentary recounting the transformation from a police school to a premier college.',
    descriptionBn: 'বিদ্যালয় প্রতিষ্ঠার ইতিহাস ও দেশসেরা প্রতিষ্ঠানে রূপান্তরের গল্প।',
    sortOrder: 5,
  },
  {
    id: 'M6',
    type: 'video',
    titleEn: 'Teacher Interviews: Golden Memories of Faridpur',
    titleBn: 'গুরুজনদের স্মৃতিকথা: প্রবীণ শিক্ষকদের স্মৃতিচারণ',
    album: 'cultural',
    year: '2025',
    thumbnail: 'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=800&auto=format&fit=crop&q=80',
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    descriptionEn: 'Heartwarming interviews with former headmasters and senior faculty.',
    descriptionBn: 'প্রাক্তন প্রধান শিক্ষক ও বর্ষীয়ান শিক্ষকদের আন্তরিক সাক্ষাৎকার।',
    sortOrder: 6,
  },
  {
    id: 'M7',
    type: 'photo',
    titleEn: 'Modern Academic Building & Campus Grounds',
    titleBn: 'আধুনিক একাডেমিক ভবন ও সবুজ প্রাঙ্গণ',
    album: 'campus',
    year: '2024',
    thumbnail: 'https://images.unsplash.com/photo-1562774053-701939374585?w=800&auto=format&fit=crop&q=80',
    videoUrl: '',
    descriptionEn: 'Aerial view of the renovated high school and college facilities in Joyrampur, Faridpur.',
    descriptionBn: 'জয়রামপুরে অবস্থিত দৃষ্টিনন্দন বহুতল কলেজ ভবন ও খেলার মাঠ।',
    sortOrder: 7,
  },
  {
    id: 'M8',
    type: 'photo',
    titleEn: 'Annual Sports Parade & Police March Past',
    titleBn: 'বার্ষিক ক্রীড়া প্রতিযোগিতা ও বর্ণাঢ্য মার্চপাস্ট',
    album: 'campus',
    year: '2023',
    thumbnail: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=800&auto=format&fit=crop&q=80',
    videoUrl: '',
    descriptionEn: 'Cadet drill and athletic sprint finals on sports day.',
    descriptionBn: 'শৃঙ্খলাপরায়ণ প্যারেড ও ক্রীড়া প্রতিযোগিতার রোমাঞ্চকর মুহূর্ত।',
    sortOrder: 8,
  },
];

type GalleryListener = (items: GalleryMediaItem[]) => void;
const listeners = new Set<GalleryListener>();

function notifyListeners(items: GalleryMediaItem[]) {
  listeners.forEach((fn) => {
    try {
      fn(items);
    } catch (_) {}
  });
}

function rowToItem(row: any): GalleryMediaItem {
  return {
    id: row.id || `M-${Date.now()}`,
    type: (row.type === 'video' ? 'video' : 'photo'),
    titleEn: row.title_en || row.titleEn || '',
    titleBn: row.title_bn || row.titleBn || '',
    album: row.album || 'heritage',
    year: String(row.year || '2026'),
    thumbnail: row.thumbnail || '',
    videoUrl: row.video_url || row.videoUrl || '',
    descriptionEn: row.description_en || row.descriptionEn || '',
    descriptionBn: row.description_bn || row.descriptionBn || '',
    sortOrder: Number(row.sort_order ?? row.sortOrder ?? 0),
    createdAt: row.created_at || row.createdAt,
    updatedAt: row.updated_at || row.updatedAt,
  };
}

function itemToRow(item: GalleryMediaItem) {
  return {
    id: item.id,
    type: item.type,
    title_en: item.titleEn,
    title_bn: item.titleBn,
    album: item.album,
    year: item.year,
    thumbnail: item.thumbnail,
    video_url: item.videoUrl || null,
    description_en: item.descriptionEn,
    description_bn: item.descriptionBn,
    sort_order: item.sortOrder ?? 0,
    updated_at: new Date().toISOString(),
  };
}

export const GalleryService = {
  subscribe(listener: GalleryListener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  getLocalCache(): GalleryMediaItem[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (_) {}
    return DEFAULT_MEDIA_ITEMS;
  },

  setLocalCache(items: GalleryMediaItem[]) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (_) {}
    notifyListeners(items);
  },

  async loadItems(): Promise<GalleryMediaItem[]> {
    // 1. Try fetching from Supabase database table
    try {
      const { data, error } = await supabase
        .from('gallery_media')
        .select('*')
        .order('sort_order', { ascending: true });

      if (!error && Array.isArray(data) && data.length > 0) {
        const mapped = data.map(rowToItem);
        this.setLocalCache(mapped);
        return mapped;
      }
    } catch (_) {
      // Offline or table not ready, proceed to next fallback
    }

    // 2. Try fetching from hosted public data file (/data/gallery_media.json)
    try {
      const res = await fetch(DATA_FILE_URL, { cache: 'no-cache' });
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json) && json.length > 0) {
          const cached = this.getLocalCache();
          // If local cache has custom user edits (different length or IDs), preserve cached
          if (cached.length <= DEFAULT_MEDIA_ITEMS.length) {
            this.setLocalCache(json);
            return json;
          }
        }
      }
    } catch (_) {}

    // 3. Fallback to local cache or defaults
    return this.getLocalCache();
  },

  async saveItem(item: GalleryMediaItem): Promise<{ success: boolean; item: GalleryMediaItem; error?: string }> {
    const current = this.getLocalCache();
    const index = current.findIndex((i: GalleryMediaItem) => i.id === item.id);
    let updatedList: GalleryMediaItem[];

    const preparedItem: GalleryMediaItem = {
      ...item,
      updatedAt: new Date().toISOString(),
      createdAt: item.createdAt || new Date().toISOString(),
    };

    if (index >= 0) {
      updatedList = [...current];
      updatedList[index] = preparedItem;
    } else {
      updatedList = [preparedItem, ...current];
    }

    this.setLocalCache(updatedList);

    // Persist to Supabase asynchronously
    try {
      const dbRow = itemToRow(preparedItem);
      const { error } = await supabase
        .from('gallery_media')
        .upsert(dbRow, { onConflict: 'id' });

      if (error) {
        return { success: true, item: preparedItem, error: error.message };
      }
    } catch (e: any) {
      return { success: true, item: preparedItem, error: e?.message };
    }

    return { success: true, item: preparedItem };
  },

  async deleteItem(id: string): Promise<{ success: boolean; error?: string }> {
    const current = this.getLocalCache();
    const updated = current.filter((i: GalleryMediaItem) => i.id !== id);
    this.setLocalCache(updated);

    try {
      const { error } = await supabase
        .from('gallery_media')
        .delete()
        .eq('id', id);

      if (error) {
        return { success: true, error: error.message };
      }
    } catch (e: any) {
      return { success: true, error: e?.message };
    }

    return { success: true };
  },

  async syncWithSupabase(): Promise<{ success: boolean; count: number; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('gallery_media')
        .select('*')
        .order('sort_order', { ascending: true });

      if (!error && Array.isArray(data)) {
        if (data.length > 0) {
          const mapped = data.map(rowToItem);
          this.setLocalCache(mapped);
          return { success: true, count: mapped.length };
        } else {
          // If remote is empty, push local items to Supabase
          const local = this.getLocalCache();
          const rows = local.map(itemToRow);
          const { error: insertErr } = await supabase.from('gallery_media').insert(rows);
          if (!insertErr) {
            return { success: true, count: local.length };
          }
        }
      }
      return { success: false, count: 0, error: error?.message || 'Database sync completed with warnings' };
    } catch (err: any) {
      return { success: false, count: 0, error: err?.message || 'Database unavailable' };
    }
  },

  downloadHostingJsonFile() {
    const items = this.getLocalCache();
    const jsonStr = JSON.stringify(items, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gallery_media.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  async importFromJson(jsonString: string): Promise<{ success: boolean; count: number; error?: string }> {
    try {
      const parsed = JSON.parse(jsonString);
      if (!Array.isArray(parsed)) {
        return { success: false, count: 0, error: 'Invalid JSON: Must be an array of media objects' };
      }
      const validated: GalleryMediaItem[] = parsed.map((item, idx) => ({
        id: item.id || `M-${Date.now()}-${idx}`,
        type: item.type === 'video' ? 'video' : 'photo',
        titleEn: item.titleEn || item.title_en || 'Untitled',
        titleBn: item.titleBn || item.title_bn || 'শিরোনামহীন',
        album: item.album || 'heritage',
        year: String(item.year || '2026'),
        thumbnail: item.thumbnail || '',
        videoUrl: item.videoUrl || item.video_url || '',
        descriptionEn: item.descriptionEn || item.description_en || '',
        descriptionBn: item.descriptionBn || item.description_bn || '',
        sortOrder: Number(item.sortOrder ?? item.sort_order ?? idx + 1),
      }));

      this.setLocalCache(validated);

      // Also upsert all to Supabase
      try {
        const rows = validated.map(itemToRow);
        await supabase.from('gallery_media').upsert(rows, { onConflict: 'id' });
      } catch (_) {}

      return { success: true, count: validated.length };
    } catch (err: any) {
      return { success: false, count: 0, error: err.message || 'JSON parse failed' };
    }
  },
};
