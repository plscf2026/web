import { useState, useEffect } from 'react';
import { Bell, Search, Download, Pin, Calendar, FileText } from 'lucide-react';
import { Language } from '../types';
import { translations } from '../i18n/translations';
import { AppStore } from '../services/store';
import { GlobalPagination } from './common/GlobalPagination';
import { paginate, DEFAULT_PAGE_SIZE } from '../utils/pagination';

interface NoticeBoardPageProps {
  language: Language;
}

export const NoticeBoardPage: React.FC<NoticeBoardPageProps> = ({ language }) => {
  const t = translations[language];
  const notices = AppStore.getNotices();

  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [activeCategory, searchTerm]);

  const filteredNotices = notices.filter((n) => {
    const matchCat = activeCategory === 'all' || n.category === activeCategory;
    const title = language === 'bn' ? n.titleBn : n.titleEn;
    const content = language === 'bn' ? n.contentBn : n.contentEn;
    const matchSearch =
      title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      content.toLowerCase().includes(searchTerm.toLowerCase());
    return matchCat && matchSearch;
  });

  const handleDownload = (filename: string, title: string) => {
    // Generate simulated PDF text download
    const blob = new Blob(
      [
        `POLICE LINES SCHOOL AND COLLEGE, FARIDPUR\nGRAND REUNION 2026 OFFICIAL NOTICE\n\nTitle: ${title}\nDate: ${new Date().toLocaleDateString()}\n\nOfficial notice copy from the Reunion Organizing Committee.`,
      ],
      { type: 'text/plain' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'PLSCF_Reunion_Notice.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">
      {/* Title */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold">
          <Bell className="w-3.5 h-3.5" />
          <span>{language === 'bn' ? 'সাপ্তাহিক ও জরুরি ঘোষণা' : 'Official Advisories'}</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          {t.noticesHeading}
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 max-w-xl mx-auto">
          {t.noticesSubtitle}
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {[
            { id: 'all', label: t.filterAll },
            { id: 'general', label: t.filterGeneral },
            { id: 'registration', label: t.filterRegistration },
            { id: 'event', label: t.filterEvent },
            { id: 'emergency', label: t.filterEmergency },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                activeCategory === cat.id
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search notices..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-300 text-xs focus:border-emerald-500 focus:outline-hidden"
          />
        </div>
      </div>

      {/* Notices List */}
      <div className="space-y-4">
        {filteredNotices.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            No notices match your filter.
          </div>
        ) : (
          paginate(filteredNotices, page, pageSize).map((notice) => (
            <div
              key={notice.id}
              className={`bg-white rounded-2xl p-6 border shadow-xs transition-shadow hover:shadow-md space-y-4 ${
                notice.isPinned
                  ? 'border-2 border-[#172554] bg-[#F3F4F6]'
                  : 'border-slate-200'
              }`}
            >
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                <div className="flex items-center gap-2">
                  {notice.isPinned && (
                    <span className="flex items-center gap-1 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-amber-400 text-slate-950">
                      <Pin className="w-3 h-3 fill-slate-950" />
                      <span>Pinned</span>
                    </span>
                  )}
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
                    {notice.category}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{notice.date}</span>
                </div>
              </div>

              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  {language === 'bn' ? notice.titleBn : notice.titleEn}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
                  {language === 'bn' ? notice.contentBn : notice.contentEn}
                </p>
              </div>

              {notice.attachmentName && (
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <FileText className="w-4 h-4 text-emerald-600" />
                    <span>{notice.attachmentName}</span>
                  </div>

                  <button
                    onClick={() =>
                      handleDownload(
                        notice.attachmentName!,
                        language === 'bn' ? notice.titleBn : notice.titleEn
                      )
                    }
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{t.downloadAttachment}</span>
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <GlobalPagination
        currentPage={page}
        pageSize={pageSize}
        totalRecords={filteredNotices.length}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        language={language}
      />
    </div>
  );
};
