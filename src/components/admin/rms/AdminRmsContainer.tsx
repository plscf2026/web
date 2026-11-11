import React, { useState } from 'react';
import {
  LayoutDashboard,
  GraduationCap,
  Users2,
  Contact2,
  CheckSquare,
  CalendarDays,
  DollarSign,
  FolderGit2,
  QrCode,
  LineChart,
  History,
  Settings,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';
import { RegistrationRecord, Language, AdminAccount } from '../../../types';
import { AdminRmsCentralDashboard } from './AdminRmsCentralDashboard';
import { AdminRmsBatchManagement } from './AdminRmsBatchManagement';
import { AdminRmsCommitteeManagement } from './AdminRmsCommitteeManagement';
import { AdminRmsMemberManagement } from './AdminRmsMemberManagement';
import { AdminRmsTaskManagement } from './AdminRmsTaskManagement';
import { AdminRmsEventManagement } from './AdminRmsEventManagement';
import { AdminRmsFinanceManagement } from './AdminRmsFinanceManagement';
import { AdminRmsDocumentManagement } from './AdminRmsDocumentManagement';
import { AdminRmsQrCheckInManagement } from './AdminRmsQrCheckInManagement';
import { AdminRmsReportsAnalytics } from './AdminRmsReportsAnalytics';
import { AdminRmsActivityLogs } from './AdminRmsActivityLogs';
import { AdminRmsSettings } from './AdminRmsSettings';

export type RmsModuleId =
  | 'central-dashboard'
  | 'batch-management'
  | 'committee-management'
  | 'member-management'
  | 'task-management'
  | 'event-management'
  | 'finance-management'
  | 'document-management'
  | 'qr-checkin'
  | 'reports-analytics'
  | 'activity-logs'
  | 'settings';

interface Props {
  language: Language;
  registrations: RegistrationRecord[];
  adminSession?: AdminAccount | null;
}

export const AdminRmsContainer: React.FC<Props> = ({
  language,
  registrations,
}) => {
  const [activeModule, setActiveModule] = useState<RmsModuleId>('central-dashboard');

  const modules: {
    id: RmsModuleId;
    labelEn: string;
    labelBn: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
  }[] = [
    { id: 'central-dashboard', labelEn: 'Central Dashboard', labelBn: 'সেন্ট্রাল ড্যাশবোর্ড', icon: LayoutDashboard },
    { id: 'batch-management', labelEn: 'Batch Management', labelBn: 'ব্যাচ ব্যবস্থাপনা', icon: GraduationCap },
    { id: 'committee-management', labelEn: 'Committee Management', labelBn: 'কমিটি ব্যবস্থাপনা', icon: Users2 },
    { id: 'member-management', labelEn: 'Member Management', labelBn: 'সদস্য ডিরেক্টরি', icon: Contact2 },
    { id: 'task-management', labelEn: 'Task Management', labelBn: 'টাস্ক ও ওয়ার্কফ্লো', icon: CheckSquare },
    { id: 'event-management', labelEn: 'Event & Programs', labelBn: 'ইভেন্ট ও কার্যসূচি', icon: CalendarDays },
    { id: 'finance-management', labelEn: 'Finance ERP', labelBn: 'আর্থিক হিসাব ও বাজেট', icon: DollarSign },
    { id: 'document-management', labelEn: 'Document Archives', labelBn: 'নথি ও অনুমতিপত্র', icon: FolderGit2 },
    { id: 'qr-checkin', labelEn: 'QR Check-in Desks', labelBn: 'কিউআর চেক-ইন ডেস্ক', icon: QrCode },
    { id: 'reports-analytics', labelEn: 'Reports & Analytics', labelBn: 'রিপোর্ট ও অ্যানালিটিক্স', icon: LineChart },
    { id: 'activity-logs', labelEn: 'Activity Audit Trail', labelBn: 'অ্যাক্টিভিটি লগস', icon: History },
    { id: 'settings', labelEn: 'RMS Settings', labelBn: 'সিস্টেম সেটিংস', icon: Settings },
  ];

  const handleNavigateFromDashboard = (tabId: string) => {
    const mapping: Record<string, RmsModuleId> = {
      batches: 'batch-management',
      committees: 'committee-management',
      members: 'member-management',
      tasks: 'task-management',
      events: 'event-management',
      finance: 'finance-management',
      documents: 'document-management',
      checkin: 'qr-checkin',
      reports: 'reports-analytics',
      logs: 'activity-logs',
      settings: 'settings',
    };
    if (mapping[tabId]) {
      setActiveModule(mapping[tabId]);
    }
  };

  const currentModuleDef = modules.find((m) => m.id === activeModule) || modules[0];

  return (
    <div className="space-y-6">
      {/* Enterprise Sub-Header for Reunion Management ERP */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#172554] to-blue-900 text-white flex items-center justify-center font-black shadow-md shrink-0">
            <span className="text-amber-400 text-lg">RMS</span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-900 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                Police Lines High School & College, Faridpur Reunion 2027
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <ShieldCheck className="w-3 h-3" />
                <span>Central ERP Active</span>
              </span>
            </div>
            <h2 className="text-lg font-black text-slate-900 mt-0.5 flex items-center gap-2">
              <span>{language === 'bn' ? currentModuleDef.labelBn : currentModuleDef.labelEn}</span>
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
          <span className="font-semibold text-slate-700">Governance:</span>
          <span>Principal (Chief Adviser) • Monowar (Convener) • Siddiqur (Sec) • Sagar (Reg)</span>
        </div>
      </div>

      {/* Main RMS Body with Sidebar Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Sidebar Navigation for 12 RMS Modules */}
        <aside className="lg:col-span-3 bg-white rounded-3xl p-3 border border-slate-200 shadow-xs space-y-1">
          <div className="px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-400">
            {language === 'bn' ? 'পুনর্মিলনী মডিউলসমূহ (১২টি)' : 'REUNION MANAGEMENT (12 MODULES)'}
          </div>

          {modules.map((mod) => {
            const Icon = mod.icon;
            const isActive = activeModule === mod.id;
            return (
              <button
                key={mod.id}
                type="button"
                onClick={() => setActiveModule(mod.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#172554] text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
                  <span className="truncate">{language === 'bn' ? mod.labelBn : mod.labelEn}</span>
                </div>
                {isActive && <ChevronRight className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
              </button>
            );
          })}
        </aside>

        {/* Right Content Area for Active Module */}
        <main className="lg:col-span-9 space-y-6">
          {activeModule === 'central-dashboard' && (
            <AdminRmsCentralDashboard
              language={language}
              registrations={registrations}
              onNavigateTab={handleNavigateFromDashboard}
            />
          )}

          {activeModule === 'batch-management' && (
            <AdminRmsBatchManagement
              language={language}
              registrations={registrations}
            />
          )}

          {activeModule === 'committee-management' && (
            <AdminRmsCommitteeManagement language={language} />
          )}

          {activeModule === 'member-management' && (
            <AdminRmsMemberManagement
              language={language}
              registrations={registrations}
            />
          )}

          {activeModule === 'task-management' && (
            <AdminRmsTaskManagement language={language} />
          )}

          {activeModule === 'event-management' && (
            <AdminRmsEventManagement language={language} />
          )}

          {activeModule === 'finance-management' && (
            <AdminRmsFinanceManagement
              language={language}
              registrations={registrations}
            />
          )}

          {activeModule === 'document-management' && (
            <AdminRmsDocumentManagement language={language} />
          )}

          {activeModule === 'qr-checkin' && (
            <AdminRmsQrCheckInManagement
              language={language}
              registrations={registrations}
            />
          )}

          {activeModule === 'reports-analytics' && (
            <AdminRmsReportsAnalytics
              language={language}
              registrations={registrations}
            />
          )}

          {activeModule === 'activity-logs' && (
            <AdminRmsActivityLogs language={language} />
          )}

          {activeModule === 'settings' && (
            <AdminRmsSettings language={language} />
          )}
        </main>
      </div>
    </div>
  );
};

