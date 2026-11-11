import React, { useState } from 'react';
import {
  LayoutDashboard,
  Users2,
  CheckSquare,
  DollarSign,
  Award,
  FolderOpen,
  Calendar,
  Megaphone,
  UserCheck,
  Radio,
  FileCheck2,
  ShieldCheck,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Building,
  KeyRound,
  ShieldAlert,
  Menu,
  X,
  Layers,
} from 'lucide-react';
import { RmsUser } from '../../types/rms';
import { Language } from '../../types';
import { RmsStore } from '../../services/rmsStore';
import { isDevTestBypassAllowed } from '../../services/supabase';
import { RmsExecutiveOverview } from './RmsExecutiveOverview';
import { RmsCommitteesModule } from './RmsCommitteesModule';
import { RmsTaskBoardModule } from './RmsTaskBoardModule';
import { RmsFinanceModule } from './RmsFinanceModule';
import { RmsSponsorCrmModule } from './RmsSponsorCrmModule';
import { RmsDocumentsModule } from './RmsDocumentsModule';
import { RmsMeetingsModule } from './RmsMeetingsModule';
import { RmsCommunicationsModule } from './RmsCommunicationsModule';
import { RmsVolunteersModule } from './RmsVolunteersModule';
import { RmsEventDayModule } from './RmsEventDayModule';
import { RmsWeeklyReportsModule } from './RmsWeeklyReportsModule';
import { RmsAuditTrailModule } from './RmsAuditTrailModule';

type RmsTab =
  | 'overview'
  | 'committees'
  | 'tasks'
  | 'finance'
  | 'sponsors'
  | 'documents'
  | 'meetings'
  | 'communications'
  | 'volunteers'
  | 'event-day'
  | 'reports'
  | 'audit';

interface Props {
  onBackToPublic: () => void;
}

export const RmsManagementPortal: React.FC<Props> = ({ onBackToPublic }) => {
  const [currentUser, setCurrentUser] = useState<RmsUser>(() => RmsStore.getCurrentUser());
  const [activeTab, setActiveTab] = useState<RmsTab>('overview');
  const [language, setLanguage] = useState<Language>('en');
  const [isPersonaMenuOpen, setIsPersonaMenuOpen] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  const users = RmsStore.getUsers();

  const handleSwitchUser = (user: RmsUser) => {
    RmsStore.setCurrentUser(user);
    setCurrentUser(user);
    setIsPersonaMenuOpen(false);
  };

  // Determine permissions based on role
  const isSuperAdmin = currentUser.role === 'SUPER_ADMIN';
  const isConvener = currentUser.role === 'CONVENER';
  const isSecretary = currentUser.role === 'MEMBER_SECRETARY';
  const isChiefAdviser = currentUser.role === 'CHIEF_ADVISER';
  const isFinanceOfficer = currentUser.role === 'FINANCE_OFFICER';
  const isDirector = currentUser.role === 'COMMITTEE_DIRECTOR';

  const canApproveBudgets = isSuperAdmin || isConvener || isSecretary;
  const canVerifyExpenses = isSuperAdmin || isFinanceOfficer;
  const canManageCommittees = isSuperAdmin || isConvener || isSecretary;
  const canScheduleMeetings = isSuperAdmin || isConvener || isSecretary || isDirector;
  const canPublishAnnouncements = isSuperAdmin || isConvener || isSecretary;
  const canManageVolunteers = !isChiefAdviser;
  const canSubmitWeeklyReport = isDirector || isSuperAdmin || isConvener;
  const canReviewWeeklyReport = isConvener || isSecretary || isSuperAdmin;
  const canEditSponsors = !isChiefAdviser;
  const canUploadDocs = !isChiefAdviser;

  const navItems: {
    id: RmsTab;
    labelEn: string;
    labelBn: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: 'overview', labelEn: 'Executive Overview', labelBn: 'এক্সিকিউটিভ ওভারভিউ', icon: LayoutDashboard },
    { id: 'committees', labelEn: '12 Committees Directory', labelBn: '১২টি কমিটি ডিরেক্টরি', icon: Users2 },
    { id: 'tasks', labelEn: 'Task Management', labelBn: 'টাস্ক ব্যবস্থাপনা', icon: CheckSquare },
    { id: 'finance', labelEn: 'Finance & Accounts', labelBn: 'আর্থিক হিসাব ও বাজেট', icon: DollarSign },
    { id: 'sponsors', labelEn: 'Sponsorship CRM', labelBn: 'স্পনসরশিপ সিআরএম', icon: Award },
    { id: 'documents', labelEn: 'Document Archive', labelBn: 'নথি ও আর্কাইভ', icon: FolderOpen },
    { id: 'meetings', labelEn: 'Meetings & Minutes', labelBn: 'মিটিং ও রেজুলেশন', icon: Calendar },
    { id: 'communications', labelEn: 'Notice Board', labelBn: 'বিজ্ঞপ্তি বোর্ড', icon: Megaphone },
    { id: 'volunteers', labelEn: 'Volunteer Corps', labelBn: 'স্বেচ্ছাসেবক বহর', icon: UserCheck },
    { id: 'event-day', labelEn: 'Event Day Control', labelBn: 'ইভেন্ট ডে কন্ট্রোল', icon: Radio },
    { id: 'reports', labelEn: 'Weekly Progress Reports', labelBn: 'সাপ্তাহিক অগ্রগতি রিপোর্ট', icon: FileCheck2 },
    { id: 'audit', labelEn: 'Compliance Audit Log', labelBn: 'কমপ্লায়েন্স অডিট লগ', icon: ShieldCheck },
  ];

  const currentTabDef = navItems.find((n) => n.id === activeTab) || navItems[0];
  const isBangla = language === 'bn';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Banner: Event & Persona Switcher */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: Brand Identity & Mobile Menu Toggle */}
            <div className="flex items-center gap-3">
              {/* Mobile Drawer Toggle */}
              <button
                type="button"
                onClick={() => setIsMobileDrawerOpen(!isMobileDrawerOpen)}
                className="lg:hidden p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                aria-label="Toggle Navigation Menu"
              >
                {isMobileDrawerOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>

              <button
                onClick={onBackToPublic}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-semibold transition"
                title="Return to Public Website"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Public Site</span>
              </button>

              <div className="h-6 w-px bg-slate-800 hidden sm:block" />

              <div>
                <div className="flex items-center gap-2">
                  <Building className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="font-black text-xs sm:text-sm tracking-tight text-white truncate max-w-[200px] sm:max-w-none">
                    Police Lines High School & College, Faridpur
                  </span>
                  <span className="px-2 py-0.5 bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-black rounded uppercase shrink-0">
                    RMS 2027 ERP
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 hidden md:block">
                  Reunion Date: Friday, January 29, 2027 | Police Lines Large Field, Faridpur
                </p>
              </div>
            </div>

            {/* Right: Active Persona Switcher */}
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => setLanguage(language === 'en' ? 'bn' : 'en')}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold text-slate-300 transition"
              >
                {language === 'en' ? 'বাংলা' : 'English'}
              </button>

              {/* Universal Password Pill (Rendered only in dev bypass) */}
              {isDevTestBypassAllowed() && (
                <div className="hidden xl:flex items-center gap-1 px-2.5 py-1 bg-slate-800/80 rounded-lg text-[11px] text-amber-400 border border-slate-700">
                  <KeyRound className="w-3 h-3" />
                  <span>Test Password: <strong>admin@123</strong></span>
                </div>
              )}

              {/* Persona Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setIsPersonaMenuOpen(!isPersonaMenuOpen)}
                  className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition text-left"
                >
                  <div className="w-7 h-7 rounded-lg bg-emerald-500 text-slate-950 font-black text-xs flex items-center justify-center shrink-0">
                    {currentUser.fullName.charAt(0)}
                  </div>
                  <div className="hidden sm:block">
                    <p className="text-xs font-bold text-white leading-tight truncate max-w-[130px]">{currentUser.fullName}</p>
                    <p className="text-[10px] text-slate-400 font-mono uppercase">{currentUser.role.replace('_', ' ')}</p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </button>

                {isPersonaMenuOpen && (
                  <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200 p-2 z-50 text-slate-900">
                    <div className="p-2 border-b border-slate-100">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Switch Role Persona
                      </p>
                    </div>

                    <div className="mt-1 space-y-1 max-h-80 overflow-y-auto">
                      {users.map((u) => (
                        <button
                          key={u.id}
                          onClick={() => handleSwitchUser(u)}
                          className={`w-full flex items-center justify-between p-2 rounded-xl text-left text-xs transition ${
                            u.id === currentUser.id
                              ? 'bg-emerald-50 text-emerald-950 font-bold'
                              : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <div>
                            <p className="font-semibold">{u.fullName}</p>
                            <p className="text-[10px] text-slate-400 uppercase font-mono">{u.role.replace('_', ' ')}</p>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400">{u.email}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Advisory Banner if Chief Adviser */}
      {isChiefAdviser && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2.5 text-center text-xs font-medium text-amber-900 flex items-center justify-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-600" />
          <span>
            You are logged in as <strong>Chief Adviser (Institution Principal)</strong>. Central ERP mode is operating with executive oversight and read-only transparency.
          </span>
        </div>
      )}

      {/* Main ERP Layout: Left Sidebar + Viewport Content */}
      <div className="flex-1 flex max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 gap-6 items-start">
        {/* ======================================================== */}
        {/* 1. LEFT SIDEBAR NAVIGATION (Desktop: lg+)                */}
        {/* ======================================================== */}
        <aside className="hidden lg:block w-64 xl:w-72 shrink-0 bg-white rounded-3xl p-3.5 border border-slate-200 shadow-xs sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto">
          {/* Sidebar Title */}
          <div className="px-3 py-2 flex items-center justify-between border-b border-slate-100 mb-2">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-slate-700" />
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                {isBangla ? 'পুনর্মিলনী মডিউল (১২টি)' : 'RMS MODULES (12)'}
              </span>
            </div>
            <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
              2027
            </span>
          </div>

          {/* Navigation Items List */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              const label = isBangla ? item.labelBn : item.labelEn;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-md'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                    <span className="truncate">{label}</span>
                  </div>
                  {isActive && <ChevronRight className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* ======================================================== */}
        {/* 2. MOBILE DRAWER NAVIGATION (Mobile: < lg)              */}
        {/* ======================================================== */}
        {isMobileDrawerOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
              onClick={() => setIsMobileDrawerOpen(false)}
            />

            {/* Drawer Content */}
            <div className="relative w-72 max-w-[85vw] bg-white h-full shadow-2xl p-4 flex flex-col z-10 overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-black text-slate-900">
                    {isBangla ? 'কার্যকরী মডিউলসমূহ' : 'RMS Modules (12)'}
                  </span>
                </div>
                <button
                  onClick={() => setIsMobileDrawerOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="space-y-1 flex-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  const label = isBangla ? item.labelBn : item.labelEn;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id);
                        setIsMobileDrawerOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                        isActive
                          ? 'bg-slate-900 text-white shadow-md'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                        <span className="truncate">{label}</span>
                      </div>
                      {isActive && <ChevronRight className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* 3. MAIN CONTENT VIEWPORT (Right side of Sidebar)         */}
        {/* ======================================================== */}
        <main className="flex-1 min-w-0 w-full space-y-4">
          {/* Mobile Current Module Quick-Selector Bar (< lg) */}
          <div className="lg:hidden bg-white rounded-2xl p-3 border border-slate-200 shadow-2xs flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
              <span className="text-[10px] text-slate-400 uppercase font-bold">Active:</span>
              <span>{isBangla ? currentTabDef.labelBn : currentTabDef.labelEn}</span>
            </div>
            <button
              onClick={() => setIsMobileDrawerOpen(true)}
              className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-xl cursor-pointer"
            >
              <Menu className="w-3.5 h-3.5" />
              <span>{isBangla ? 'সব মডিউল' : 'All Modules'}</span>
            </button>
          </div>

          {activeTab === 'overview' && (
            <RmsExecutiveOverview language={language} onNavigateTab={(tab) => setActiveTab(tab as RmsTab)} />
          )}

          {activeTab === 'committees' && (
            <RmsCommitteesModule language={language} currentUser={currentUser} canManage={canManageCommittees} />
          )}

          {activeTab === 'tasks' && (
            <RmsTaskBoardModule language={language} currentUser={currentUser} canManage={!isChiefAdviser} />
          )}

          {activeTab === 'finance' && (
            <RmsFinanceModule
              language={language}
              currentUser={currentUser}
              canApprove={canApproveBudgets}
              canVerify={canVerifyExpenses}
            />
          )}

          {activeTab === 'sponsors' && (
            <RmsSponsorCrmModule currentUser={currentUser} canEdit={canEditSponsors} />
          )}

          {activeTab === 'documents' && (
            <RmsDocumentsModule currentUser={currentUser} canUpload={canUploadDocs} />
          )}

          {activeTab === 'meetings' && (
            <RmsMeetingsModule currentUser={currentUser} canSchedule={canScheduleMeetings} />
          )}

          {activeTab === 'communications' && (
            <RmsCommunicationsModule currentUser={currentUser} canPublish={canPublishAnnouncements} />
          )}

          {activeTab === 'volunteers' && (
            <RmsVolunteersModule currentUser={currentUser} canManage={canManageVolunteers} />
          )}

          {activeTab === 'event-day' && (
            <RmsEventDayModule currentUser={currentUser} canManage={!isChiefAdviser} />
          )}

          {activeTab === 'reports' && (
            <RmsWeeklyReportsModule
              currentUser={currentUser}
              canSubmit={canSubmitWeeklyReport}
              canReview={canReviewWeeklyReport}
            />
          )}

          {activeTab === 'audit' && <RmsAuditTrailModule />}
        </main>
      </div>

      {/* Persistent Enterprise Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500 mt-auto">
        <div className="max-w-[1600px] mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>
            © 2027 Police Lines High School & College, Faridpur Reunion Organizing Committee. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-xs">
            <span className="font-semibold text-slate-700">Convener: Monowar Shikder</span>
            <span>•</span>
            <span className="font-semibold text-slate-700">Member Secretary: Siddiqur Rahman</span>
            <span>•</span>
            <span className="font-semibold text-slate-700">Reg & Database Director: Sagar</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
