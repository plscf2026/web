import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Users,
  ShieldCheck,
} from 'lucide-react';
import { CommitteeMember, CommitteeSettings, Language } from '../../types';
import { CommitteeService } from '../../services/committeeService';
import { translations } from '../../i18n/translations';

interface CommitteeSectionProps {
  language: Language;
  onNavigateAdminTab?: (tab: string) => void;
  isSuperAdmin?: boolean;
}

export const CommitteeSection: React.FC<CommitteeSectionProps> = ({
  language,
  onNavigateAdminTab,
  isSuperAdmin,
}) => {
  const t = translations[language];
  const [members, setMembers] = useState<CommitteeMember[]>(() => CommitteeService.getMembers());
  const [settings, setSettings] = useState<CommitteeSettings>(() => CommitteeService.getSettings());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartXRef = useRef<number | null>(null);

  // Sync with service on mount and on realtime updates
  useEffect(() => {
    CommitteeService.loadMembers().then((loaded) => {
      setMembers(loaded);
    });

    const handleUpdate = (e: any) => {
      if (e.detail && Array.isArray(e.detail)) {
        setMembers(e.detail);
      } else {
        setMembers(CommitteeService.getMembers());
      }
    };

    const handleSettingsUpdate = (e: any) => {
      if (e.detail) {
        setSettings(e.detail);
      }
    };

    window.addEventListener('plscf_committee_updated', handleUpdate);
    window.addEventListener('plscf_committee_settings_updated', handleSettingsUpdate);

    return () => {
      window.removeEventListener('plscf_committee_updated', handleUpdate);
      window.removeEventListener('plscf_committee_settings_updated', handleSettingsUpdate);
    };
  }, []);

  // Filter to active members
  const activeMembers = useMemo(() => {
    return members.filter((m) => m.isActive !== false);
  }, [members]);

  // Mobile Infinite Auto-Scroll Carousel
  useEffect(() => {
    if (isPaused || activeMembers.length <= 1) {
      return;
    }

    const intervalTime = settings.autoScrollSpeedMs || 3500;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => {
        if (prev >= activeMembers.length - 1) {
          return 0; // Seamless loop back to first member
        }
        return prev + 1;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [isPaused, activeMembers.length, settings.autoScrollSpeedMs]);

  const handleNext = () => {
    setCurrentIndex((prev) => (prev >= activeMembers.length - 1 ? 0 : prev + 1));
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev <= 0 ? activeMembers.length - 1 : prev - 1));
  };

  // Touch swipe support for mobile carousel
  const handleTouchStart = (e: React.TouchEvent) => {
    setIsPaused(true);
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    setIsPaused(false);
    if (touchStartXRef.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartXRef.current - touchEndX;

    if (Math.abs(diff) > 35) {
      if (diff > 0) {
        handleNext();
      } else {
        handlePrev();
      }
    }
    touchStartXRef.current = null;
  };

  if (activeMembers.length === 0) {
    return null;
  }

  const isBn = language === 'bn';
  const heading = isBn ? (settings.sectionTitleBn || t.committeeHeading) : (settings.sectionTitleEn || t.committeeHeading);
  const subtitle = isBn ? settings.sectionSubtitleBn : settings.sectionSubtitleEn;

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div className="text-center sm:text-left space-y-1">
          <div className="flex items-center justify-center sm:justify-start gap-2">
            <span className="p-1.5 rounded-lg bg-sky-100 text-[#0284C7]">
              <Users className="w-5 h-5" />
            </span>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
              {heading}
            </h2>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              {activeMembers.length} {isBn ? 'সদস্য' : 'Members'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 max-w-2xl">
            {subtitle}
          </p>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2 self-center sm:self-auto shrink-0">
          {/* Mobile Carousel Controls (Visible ONLY on Mobile < 768px) */}
          <div className="flex md:hidden items-center gap-1.5">
            {/* Play/Pause Button */}
            <button
              type="button"
              onClick={() => setIsPaused((prev) => !prev)}
              className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 transition-colors shadow-2xs active:scale-95 cursor-pointer"
              title={isPaused ? (isBn ? 'চালু করুন' : 'Resume') : (isBn ? 'থামান' : 'Pause')}
              aria-label={isPaused ? 'Resume Auto-scroll' : 'Pause Auto-scroll'}
            >
              {isPaused ? <Play className="w-3.5 h-3.5 text-emerald-600" /> : <Pause className="w-3.5 h-3.5" />}
            </button>

            {/* Prev / Next Buttons */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrev}
                className="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs active:scale-95 cursor-pointer"
                title={isBn ? 'পূর্ববর্তী' : 'Previous'}
                aria-label="Previous"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs active:scale-95 cursor-pointer"
                title={isBn ? 'পরবর্তী' : 'Next'}
                aria-label="Next"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Super Admin Quick Link (Desktop & Mobile) */}
          {isSuperAdmin && onNavigateAdminTab && (
            <button
              type="button"
              onClick={() => onNavigateAdminTab('committeeManagement')}
              className="px-3 py-1.5 rounded-xl bg-[#0284C7] hover:bg-[#0EA5E9] text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              title="Super Admin: Edit Committee Members"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{isBn ? 'কমিটি সম্পাদনা' : 'Edit Committee'}</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. DESKTOP & TABLET VIEW: RESPONSIVE MULTI-COLUMN CSS GRID                */}
      {/*    Strictly displayed on screens >= 768px (Tablet: 3 cols, Computer: 4 cols) */}
      {/* ========================================================================= */}
      <div className="hidden md:grid md:grid-cols-3 lg:grid-cols-4 gap-5 lg:gap-6">
        {activeMembers.map((member, idx) => (
          <CommitteeMemberCard key={member.id || idx} member={member} language={language} />
        ))}
      </div>

      {/* ========================================================================= */}
      {/* 2. MOBILE VIEW: AUTO-SCROLLING HORIZONTAL INFINITE CAROUSEL                */}
      {/*    Strictly displayed on Mobile devices < 768px                           */}
      {/* ========================================================================= */}
      <div className="block md:hidden">
        <div
          className="relative overflow-hidden select-none px-1 py-1"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Pause Notification Pill */}
          {isPaused && (
            <div className="absolute top-3 right-4 z-20 pointer-events-none bg-slate-900/80 text-white text-[10px] px-2.5 py-1 rounded-full backdrop-blur-xs font-semibold flex items-center gap-1 shadow-sm">
              <Pause className="w-2.5 h-2.5 text-amber-400" />
              <span>{isBn ? 'বিরতি দেওয়া হয়েছে' : 'Paused on Touch'}</span>
            </div>
          )}

          {/* Carousel Slide Track with Exact Math Proportion */}
          <div
            className="flex transition-transform duration-500 ease-out"
            style={{
              width: `${activeMembers.length * 100}%`,
              transform: `translateX(-${currentIndex * (100 / activeMembers.length)}%)`,
            }}
          >
            {activeMembers.map((member, idx) => (
              <div
                key={member.id || idx}
                style={{ width: `${100 / activeMembers.length}%` }}
                className="shrink-0 px-2"
              >
                <div className="w-full max-w-xs mx-auto">
                  <CommitteeMemberCard member={member} language={language} isMobileSlide />
                </div>
              </div>
            ))}
          </div>

          {/* Mobile Slide Navigation & Counter */}
          <div className="flex items-center justify-between gap-2 pt-4 px-2">
            {/* Slide Index Pill */}
            <span className="text-[11px] font-mono font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200 shadow-2xs">
              {currentIndex + 1} / {activeMembers.length}
            </span>

            {/* Pagination Dots (All dots neatly styled) */}
            <div className="flex items-center gap-1 justify-center flex-wrap max-w-[150px]">
              {activeMembers.map((_, dotIdx) => (
                <button
                  key={`mob-dot-${dotIdx}`}
                  type="button"
                  onClick={() => setCurrentIndex(dotIdx)}
                  className={`h-1.5 rounded-full transition-all cursor-pointer ${
                    currentIndex === dotIdx
                      ? 'w-4 bg-[#0284C7]'
                      : 'w-1.5 bg-slate-300 hover:bg-slate-400'
                  }`}
                  aria-label={`Go to slide ${dotIdx + 1}`}
                />
              ))}
            </div>

            {/* Mobile Prev / Next Buttons */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrev}
                className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs active:scale-95 cursor-pointer"
                title={isBn ? 'পূর্ববর্তী' : 'Previous'}
                aria-label="Previous"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs active:scale-95 cursor-pointer"
                title={isBn ? 'পরবর্তী' : 'Next'}
                aria-label="Next"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface MemberCardProps {
  member: CommitteeMember;
  language: Language;
  isMobileSlide?: boolean;
}

const CommitteeMemberCard: React.FC<MemberCardProps> = ({ member, language, isMobileSlide }) => {
  const isBn = language === 'bn';
  const name = isBn && member.nameBn ? member.nameBn : member.name;
  const role = isBn && member.roleBn ? member.roleBn : member.role;
  const desc = isBn && member.descBn ? member.descBn : member.desc;

  return (
    <div
      className={`bg-white rounded-3xl border border-slate-200 text-center shadow-xs transition-all duration-300 flex flex-col items-center justify-between group ${
        isMobileSlide
          ? 'p-6 space-y-4 border-sky-200/90 shadow-md min-h-[280px]'
          : 'p-5 lg:p-6 space-y-3 hover:shadow-md hover:border-sky-300 hover:-translate-y-1 h-full'
      }`}
    >
      {/* Avatar Container with glowing border */}
      <div className="relative">
        <div
          className={`rounded-full overflow-hidden bg-slate-100 p-0.5 border-2 border-[#0284C7] shadow-sm group-hover:scale-105 group-hover:border-[#0EA5E9] transition-transform duration-300 flex items-center justify-center ${
            isMobileSlide ? 'w-24 h-24' : 'w-20 h-20 sm:w-22 sm:h-22'
          }`}
        >
          <img
            src={member.img || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300&auto=format&fit=crop&q=80'}
            alt={name}
            className="w-full h-full object-cover rounded-full"
            loading={isMobileSlide ? 'eager' : 'lazy'}
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80';
            }}
          />
        </div>
        {member.batch && (
          <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-slate-900 text-white text-[10px] font-mono font-bold tracking-tight shadow-xs whitespace-nowrap">
            {member.batch.startsWith('19') || member.batch.startsWith('20') ? `SSC '${member.batch.slice(2)}` : member.batch}
          </span>
        )}
      </div>

      {/* Member Details */}
      <div className="w-full pt-1 space-y-1">
        <h4
          className={`font-extrabold text-slate-900 group-hover:text-[#0284C7] transition-colors ${
            isMobileSlide ? 'text-base sm:text-lg' : 'text-sm sm:text-base line-clamp-1'
          }`}
          title={name}
        >
          {name}
        </h4>
        <span
          className={`font-bold text-[#0284C7] block ${
            isMobileSlide ? 'text-xs sm:text-sm' : 'text-xs sm:text-sm line-clamp-1'
          }`}
          title={role}
        >
          {role}
        </span>
        <p
          className={`text-slate-600 leading-relaxed ${
            isMobileSlide ? 'text-xs px-2 pt-1' : 'text-xs line-clamp-2'
          }`}
          title={desc}
        >
          {desc}
        </p>
      </div>
    </div>
  );
};
