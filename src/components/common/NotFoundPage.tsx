import React from 'react';
import { FileQuestion, Home, ArrowLeft, Ticket, UserCheck, HelpCircle } from 'lucide-react';
import { Language } from '../../types';

interface NotFoundPageProps {
  language: Language;
  notFoundPath?: string;
  onNavigate: (view: string) => void;
}

export const NotFoundPage: React.FC<NotFoundPageProps> = ({
  language,
  notFoundPath = window.location?.pathname || '',
  onNavigate,
}) => {
  const isBangla = language === 'bn';

  return (
    <div className="min-h-[75vh] flex items-center justify-center px-4 py-12 sm:py-16">
      <div className="max-w-xl w-full bg-white rounded-3xl p-6 sm:p-10 border border-slate-200/80 shadow-xl text-center space-y-6">
        {/* 404 Status Icon Badge */}
        <div className="relative mx-auto w-24 h-24 rounded-3xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shadow-sm">
          <FileQuestion className="w-12 h-12" />
          <span className="absolute -top-2 -right-2 px-2.5 py-0.5 rounded-full bg-[#172554] text-white text-[11px] font-black tracking-wider uppercase shadow-md">
            404
          </span>
        </div>

        {/* Heading & Bilingual Explanation */}
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight font-display">
            {isBangla ? 'পৃষ্ঠাটি খুঁজে পাওয়া যায়নি' : 'Page Not Found'}
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed max-w-md mx-auto">
            {isBangla
              ? 'আপনি যে ঠিকানাটিতে প্রবেশের চেষ্টা করেছেন তা বর্তমানে উপলব্ধ নেই বা পরিবর্তিত হয়েছে।'
              : 'The requested page or route does not exist, has been removed, or is temporarily unavailable.'}
          </p>

          {/* Requested Path Display */}
          {notFoundPath && (
            <div className="inline-block mt-3 px-3.5 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-mono text-slate-700">
              <span className="text-slate-400 select-none">URL: </span>
              <span className="font-semibold text-slate-800 break-all">{notFoundPath}</span>
            </div>
          )}
        </div>

        {/* Quick Recovery Action Buttons */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-[#172554] hover:bg-[#1E3A8A] text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>{isBangla ? 'হোমপেজে ফিরে যান' : 'Return to Home'}</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('register')}
            className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            <UserCheck className="w-4 h-4" />
            <span>{isBangla ? 'নিবন্ধন ফরম' : 'Registration Page'}</span>
          </button>
        </div>

        {/* Secondary Helpful Links */}
        <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-center gap-4 text-xs font-semibold text-slate-600">
          <button
            type="button"
            onClick={() => onNavigate('find-ticket')}
            className="hover:text-[#172554] transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Ticket className="w-3.5 h-3.5 text-slate-400" />
            <span>{isBangla ? 'টিকিট খুঁজুন' : 'Find Ticket'}</span>
          </button>
          <span className="text-slate-300">•</span>
          <button
            type="button"
            onClick={() => onNavigate('about')}
            className="hover:text-[#172554] transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
            <span>{isBangla ? 'যোগাযোগ ও সহায়তা' : 'About & Help'}</span>
          </button>
          <span className="text-slate-300">•</span>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="hover:text-[#172554] transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-slate-400" />
            <span>{isBangla ? 'পূর্ববর্তী পৃষ্ঠা' : 'Go Back'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
