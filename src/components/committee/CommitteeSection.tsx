import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Users,
  ShieldCheck,
  MoveHorizontal,
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
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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

  // Mobile horizontal scroll button handlers
  const handleScroll = (direction: 'left' | 'right') => {
    if (!scrollContainerRef.current) return;
    const scrollAmount = 280; // Approximate card width + gap
    scrollContainerRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
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
          {/* Mobile Horizontal Scroll Arrows (Visible ONLY on Mobile < 768px) */}
          <div className="flex md:hidden items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleScroll('left')}
              className="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs active:scale-95 cursor-pointer"
              title={isBn ? 'বামে স্ক্রোল করুন' : 'Scroll Left'}
              aria-label="Scroll Left"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleScroll('right')}
              className="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs active:scale-95 cursor-pointer"
              title={isBn ? 'ডানে স্ক্রোল করুন' : 'Scroll Right'}
              aria-label="Scroll Right"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Super Admin Quick Link */}
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
      {/* 2. MOBILE VIEW: TOUCH-FRIENDLY HORIZONTAL SCROLL SYSTEM                   */}
      {/*    Strictly displayed on Mobile devices < 768px                           */}
      {/* ========================================================================= */}
      <div className="block md:hidden">
        {/* Horizontal Native Scroll Rail */}
        <div
          ref={scrollContainerRef}
          className="flex gap-4 overflow-x-auto pb-4 pt-1 px-1 scrollbar-none snap-x snap-mandatory"
          style={{
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
          }}
        >
          {activeMembers.map((member, idx) => (
            <div
              key={member.id || idx}
              className="w-[260px] sm:w-[280px] shrink-0 snap-start"
            >
              <CommitteeMemberCard member={member} language={language} isMobileScroll />
            </div>
          ))}
        </div>

        {/* Mobile Swipe Hint */}
        <div className="flex items-center justify-between text-slate-400 text-[11px] pt-1 px-2 border-t border-slate-100">
          <div className="flex items-center gap-1.5">
            <MoveHorizontal className="w-3.5 h-3.5 text-[#0284C7]" />
            <span>{isBn ? 'ডানে-বামে স্ক্রোল করে সব সদস্য দেখুন' : 'Scroll horizontally to view all members'}</span>
          </div>
          <span className="font-mono font-semibold text-slate-500">
            1 - {activeMembers.length}
          </span>
        </div>
      </div>
    </div>
  );
};

interface MemberCardProps {
  member: CommitteeMember;
  language: Language;
  isMobileScroll?: boolean;
}

const CommitteeMemberCard: React.FC<MemberCardProps> = ({ member, language, isMobileScroll }) => {
  const isBn = language === 'bn';
  const name = isBn && member.nameBn ? member.nameBn : member.name;
  const role = isBn && member.roleBn ? member.roleBn : member.role;
  const desc = isBn && member.descBn ? member.descBn : member.desc;

  return (
    <div
      className={`bg-white rounded-3xl border border-slate-200/90 text-center shadow-xs transition-all duration-300 flex flex-col items-center justify-between h-full group ${
        isMobileScroll
          ? 'p-5 space-y-3.5 border-sky-100 shadow-sm min-h-[290px]'
          : 'p-5 lg:p-6 space-y-3 hover:shadow-md hover:border-sky-300 hover:-translate-y-1'
      }`}
    >
      {/* Avatar Container with glowing border */}
      <div className="relative">
        <div
          className={`rounded-full overflow-hidden bg-slate-100 p-0.5 border-2 border-[#0284C7] shadow-sm group-hover:scale-105 group-hover:border-[#0EA5E9] transition-transform duration-300 flex items-center justify-center ${
            isMobileScroll ? 'w-22 h-22' : 'w-20 h-20 sm:w-22 sm:h-22'
          }`}
        >
          <img
            src={member.img || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300&auto=format&fit=crop&q=80'}
            alt={name}
            className="w-full h-full object-cover rounded-full"
            loading="lazy"
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
          className={`font-extrabold text-slate-900 group-hover:text-[#0284C7] transition-colors line-clamp-1 ${
            isMobileScroll ? 'text-sm sm:text-base' : 'text-sm sm:text-base'
          }`}
          title={name}
        >
          {name}
        </h4>
        <span
          className="font-bold text-[#0284C7] block text-xs sm:text-sm line-clamp-1"
          title={role}
        >
          {role}
        </span>
        <p
          className="text-slate-500 leading-relaxed text-xs line-clamp-2 pt-0.5"
          title={desc}
        >
          {desc}
        </p>
      </div>
    </div>
  );
};
