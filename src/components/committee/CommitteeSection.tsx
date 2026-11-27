import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Users,
  ShieldCheck,
  MoveHorizontal,
  Shield,
  GraduationCap,
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

  // Dynamic responsive grid columns for desktop/tablet
  // Ensures 6 members render in an aesthetically balanced 3x2 grid with no empty columns
  const gridClass = useMemo(() => {
    const count = activeMembers.length;
    if (count === 1) return 'grid-cols-1 max-w-sm mx-auto';
    if (count === 2) return 'grid-cols-1 sm:grid-cols-2 max-w-2xl mx-auto';
    if (count === 3) return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto';
    if (count === 4) return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4';
    if (count === 5) return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto';
    if (count === 6) return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
    if (count % 3 === 0) return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
    if (count % 4 === 0) return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4';
    return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3';
  }, [activeMembers.length]);

  // Mobile horizontal scroll button handlers
  const handleScroll = (direction: 'left' | 'right') => {
    if (!scrollContainerRef.current) return;
    const scrollAmount = 300;
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
    <section className="py-12 sm:py-16 bg-gradient-to-b from-slate-50/70 via-white to-slate-50/50 border-t border-slate-200/80 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 sm:space-y-10">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-5 pb-6 border-b border-slate-200/80">
          <div className="space-y-2 max-w-3xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-50 text-sky-800 border border-sky-200/80 text-xs font-bold tracking-wide">
              <Users className="w-3.5 h-3.5 text-[#0284C7]" />
              <span>{isBn ? 'নেতৃত্ব ও পরিচালনা পর্ষদ' : 'Leadership & Governance'}</span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
                {heading}
              </h2>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-sky-100 text-[#0284C7] border border-sky-200/80 shadow-2xs">
                {activeMembers.length} {isBn ? 'সদস্য' : 'Members'}
              </span>
            </div>

            <p className="text-xs sm:text-sm md:text-base text-slate-600 leading-relaxed pt-0.5">
              {subtitle}
            </p>
          </div>

          {/* Header Right Actions */}
          <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end shrink-0">
            {/* Mobile Scroll Controls */}
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
                className="px-3.5 py-2 rounded-xl bg-[#0284C7] hover:bg-[#0EA5E9] text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                title="Super Admin: Edit Committee Members"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{isBn ? 'কমিটি সম্পাদনা' : 'Edit Committee'}</span>
              </button>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 1. DESKTOP & TABLET VIEW: ELEGANT BALANCED GRID                           */}
        {/*    Strictly displayed on screens >= 768px                                 */}
        {/* ========================================================================= */}
        <div className={`hidden md:grid gap-6 lg:gap-8 ${gridClass}`}>
          {activeMembers.map((member, idx) => (
            <CommitteeMemberCard key={member.id || idx} member={member} language={language} />
          ))}
        </div>

        {/* ========================================================================= */}
        {/* 2. MOBILE VIEW: TOUCH-FRIENDLY HORIZONTAL CAROUSEL                        */}
        {/*    Strictly displayed on Mobile devices < 768px                           */}
        {/* ========================================================================= */}
        <div className="block md:hidden space-y-3">
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
                className="w-[280px] sm:w-[300px] shrink-0 snap-start"
              >
                <CommitteeMemberCard member={member} language={language} isMobileScroll />
              </div>
            ))}
          </div>

          {/* Mobile Swipe Hint */}
          <div className="flex items-center justify-between text-slate-500 text-[11px] pt-1 px-2 border-t border-slate-200/60 font-medium">
            <div className="flex items-center gap-1.5">
              <MoveHorizontal className="w-3.5 h-3.5 text-[#0284C7]" />
              <span>{isBn ? 'ডানে-বামে স্ক্রোল করে সব সদস্য দেখুন' : 'Scroll horizontally to view all members'}</span>
            </div>
            <span className="font-mono font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200/80">
              {activeMembers.length} {isBn ? 'জন' : 'total'}
            </span>
          </div>
        </div>
      </div>
    </section>
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

  // Determine leadership & role hierarchy for custom styling accents
  const isChiefPatron =
    member.role.toLowerCase().includes('chief patron') ||
    member.roleBn?.includes('প্রধান পৃষ্ঠপোষক') ||
    member.batch?.toLowerCase() === 'administration';

  const isConvenor =
    (member.role.toLowerCase().includes('convenor') || member.roleBn?.includes('আহ্বায়ক')) &&
    !member.role.toLowerCase().includes('joint') &&
    !member.roleBn?.includes('যুগ্ম');

  const isFaculty =
    member.batch?.toLowerCase() === 'faculty' ||
    member.role.toLowerCase().includes('faculty') ||
    member.role.toLowerCase().includes('principal');

  return (
    <div
      className={`relative bg-white rounded-3xl border transition-all duration-300 flex flex-col items-center text-center group overflow-hidden ${
        isChiefPatron
          ? 'border-amber-200/90 shadow-[0_4px_20px_-4px_rgba(245,158,11,0.12)] hover:shadow-[0_16px_36px_-6px_rgba(245,158,11,0.24)] hover:border-amber-300'
          : isConvenor
          ? 'border-sky-200/90 shadow-[0_4px_20px_-4px_rgba(2,132,199,0.12)] hover:shadow-[0_16px_36px_-6px_rgba(2,132,199,0.24)] hover:border-sky-300'
          : isFaculty
          ? 'border-emerald-200/90 shadow-[0_4px_20px_-4px_rgba(16,185,129,0.12)] hover:shadow-[0_16px_36px_-6px_rgba(16,185,129,0.22)] hover:border-emerald-300'
          : 'border-slate-200/80 shadow-[0_2px_14px_-2px_rgba(0,0,0,0.05)] hover:shadow-[0_14px_32px_-6px_rgba(2,132,199,0.18)] hover:border-sky-300'
      } hover:-translate-y-1.5 ${
        isMobileScroll ? 'p-6 min-h-[350px] justify-between' : 'p-6 lg:p-7 justify-between h-full'
      }`}
    >
      {/* Decorative Top Accent Line */}
      <div
        className={`absolute top-0 inset-x-0 h-1.5 ${
          isChiefPatron
            ? 'bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500'
            : isConvenor
            ? 'bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-500'
            : isFaculty
            ? 'bg-gradient-to-r from-emerald-400 via-teal-500 to-sky-500'
            : 'bg-gradient-to-r from-slate-200 via-sky-300 to-slate-200 group-hover:from-sky-400 group-hover:to-indigo-500 transition-colors'
        }`}
      />

      {/* Ambient Top Background Glow */}
      <div
        className={`absolute top-0 inset-x-0 h-32 pointer-events-none transition-opacity duration-300 ${
          isChiefPatron
            ? 'bg-gradient-to-b from-amber-50/70 via-amber-50/20 to-transparent'
            : isConvenor
            ? 'bg-gradient-to-b from-sky-50/70 via-sky-50/20 to-transparent'
            : isFaculty
            ? 'bg-gradient-to-b from-emerald-50/60 via-emerald-50/20 to-transparent'
            : 'bg-gradient-to-b from-slate-50 via-sky-50/30 to-transparent'
        }`}
      />

      {/* Top Body: Avatar with multi-layer glowing ring and pill */}
      <div className="relative mt-2 mb-3 z-10 flex flex-col items-center">
        <div
          className={`rounded-full p-1 shadow-md transition-all duration-300 group-hover:scale-105 ${
            isChiefPatron
              ? 'bg-gradient-to-tr from-amber-400 via-yellow-200 to-amber-500 ring-4 ring-amber-100/80 group-hover:ring-amber-200'
              : isConvenor
              ? 'bg-gradient-to-tr from-sky-500 via-sky-300 to-indigo-500 ring-4 ring-sky-100/80 group-hover:ring-sky-200'
              : isFaculty
              ? 'bg-gradient-to-tr from-emerald-400 via-teal-300 to-emerald-600 ring-4 ring-emerald-100/80 group-hover:ring-emerald-200'
              : 'bg-gradient-to-tr from-sky-400 via-slate-200 to-indigo-400 ring-4 ring-slate-100 group-hover:ring-sky-100'
          } ${isMobileScroll ? 'w-24 h-24' : 'w-24 h-24 sm:w-28 sm:h-28'}`}
        >
          <div className="w-full h-full rounded-full overflow-hidden bg-slate-100 border-2 border-white flex items-center justify-center">
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
        </div>

        {/* Batch / Affiliation Pill */}
        {member.batch && (
          <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap z-20">
            {isChiefPatron || member.batch.toLowerCase() === 'administration' ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-900 text-amber-300 text-[10px] font-bold shadow-sm tracking-wide border border-amber-400/30">
                <Shield className="w-3 h-3 text-amber-400" />
                <span>Administration</span>
              </span>
            ) : isFaculty || member.batch.toLowerCase() === 'faculty' ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-800 text-emerald-100 text-[10px] font-bold shadow-sm tracking-wide border border-emerald-400/30">
                <GraduationCap className="w-3 h-3 text-emerald-200" />
                <span>Faculty</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-900 text-white text-[10px] font-mono font-bold shadow-sm tracking-tight border border-slate-700">
                {member.batch.startsWith('19') || member.batch.startsWith('20')
                  ? `SSC '${member.batch.slice(2)}`
                  : member.batch}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Member Details */}
      <div className="w-full flex-1 flex flex-col justify-center space-y-2.5 z-10 pt-3">
        {/* Name */}
        <h4
          className="font-extrabold text-slate-900 text-base sm:text-lg group-hover:text-[#0284C7] transition-colors line-clamp-1 tracking-tight"
          title={name}
        >
          {name}
        </h4>

        {/* Role Pill */}
        <div className="flex items-center justify-center">
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold tracking-tight text-center shadow-2xs ${
              isChiefPatron
                ? 'bg-amber-50 text-amber-900 border border-amber-200/90'
                : isConvenor
                ? 'bg-sky-50 text-sky-800 border border-sky-200/90'
                : isFaculty
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/90'
                : 'bg-slate-50 text-[#0284C7] border border-sky-100 group-hover:bg-sky-50 group-hover:border-sky-200 transition-colors'
            }`}
            title={role}
          >
            {role}
          </span>
        </div>

        {/* Description / Designation */}
        <p
          className="text-slate-500 text-xs sm:text-sm font-medium leading-relaxed line-clamp-2 px-1"
          title={desc}
        >
          {desc}
        </p>
      </div>

      {/* Subtle Card Footer */}
      <div className="w-full pt-4 mt-4 border-t border-slate-100/90 flex items-center justify-center gap-2 text-slate-400 text-xs font-medium z-10">
        <span
          className={`inline-block w-1.5 h-1.5 rounded-full transition-transform group-hover:scale-125 ${
            isChiefPatron
              ? 'bg-amber-400'
              : isConvenor
              ? 'bg-sky-400'
              : isFaculty
              ? 'bg-emerald-400'
              : 'bg-sky-400'
          }`}
        />
        <span className="text-[11px] text-slate-400 font-semibold group-hover:text-slate-600 transition-colors">
          {isBn ? 'পুনর্মিলনী ২০২৭ পরিচালনা কমিটি' : 'Reunion 2027 Organizing Committee'}
        </span>
      </div>
    </div>
  );
};
