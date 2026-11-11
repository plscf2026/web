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
  Building,
  KeyRound,
  ShieldAlert,
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

  const navItems: { id: RmsTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'overview', label: 'Executive Overview', icon: LayoutDashboard },
    { id: 'committees', label: '12 Committees Directory', icon: Users2 },
    { id: 'tasks', label: 'Task Management', icon: CheckSquare },
    { id: 'finance', label: 'Finance & Accounts', icon: DollarSign },
    { id: 'sponsors', label: 'Sponsorship CRM', icon: Award },
    { id: 'documents', label: 'Document Archive', icon: FolderOpen },
    { id: 'meetings', label: 'Meetings & Minutes', icon: Calendar },
    { id: 'communications', label: 'Notice Board', icon: Megaphone },
    { id: 'volunteers', label: 'Volunteer Corps', icon: UserCheck },
    { id: 'event-day', label: 'Event Day Control', icon: Radio },
    { id: 'reports', label: 'Weekly Progress Reports', icon: FileCheck2 },
    { id: 'audit', label: 'Compliance Audit Log', icon: ShieldCheck },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Banner: Event & Persona Switcher */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: Brand Identity */}
            <div className="flex items-center gap-3">
              <button
                onClick={onBackToPublic}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-semibold transition"
                title="Return to Public Website"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Public Site</span>
              </button>

              <div className="h-6 w-px bg-slate-800 hidden sm:block" />

              <div>
                <div className="flex items-center gap-2">
                  <Building className="w-4 h-4 text-emerald-400" />
                  <span className="font-black text-sm tracking-tight text-white">
                    Police Lines High School & College, Faridpur
                  </span>
                  <span className="px-2 py-0.5 bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-black rounded uppercase">
                    RMS 2027 ERP
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 hidden md:block">
                  Reunion Date: Friday, January 29, 2027 | Police Lines Large Field, Faridpur
                </p>
              </div>
            </div>

            {/* Right: Active Persona Switcher */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setLanguage(language === 'en' ? 'bn' : 'en')}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold text-slate-300 transition"
              >
                {language === 'en' ? 'বাংলা' : 'English'}
              </button>

              {/* Universal Password Pill (Rendered only in dev bypass) */}
              {isDevTestBypassAllowed() && (
                <div className="hidden lg:flex items-center gap-1 px-2.5 py-1 bg-slate-800/80 rounded-lg text-[11px] text-amber-400 border border-slate-700">
                  <KeyRound className="w-3 h-3" />
                  <span>Test Password: <strong>admin@123</strong></span>
                </div>
              )}

              {/* Persona Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setIsPersonaMenuOpen(!isPersonaMenuOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition text-left"
                >
                  <div className="w-7 h-7 rounded-lg bg-emerald-500 text-slate-950 font-black text-xs flex items-center justify-center">
                    {currentUser.fullName.charAt(0)}
                  </div>
                  <div className="hidden sm:block">
                    <p className="text-xs font-bold text-white leading-tight">{currentUser.fullName}</p>
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

      {/* Navigation Tabs Bar */}
      <div className="bg-white border-b border-slate-200 sticky top-16 z-30 shadow-sm overflow-x-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-1 py-2 min-w-max">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
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

      {/* Persistent Enterprise Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
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
