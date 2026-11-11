import React, { useState } from 'react';
import {
  Settings,
  Save,
  ShieldCheck,
  Calendar,
  DollarSign,
  UserCheck,
  CheckCircle2,
  Lock,
  RotateCcw,
} from 'lucide-react';
import { Language, FeeSettings } from '../../../types';
import { AppStore } from '../../../services/store';
import { isDevTestBypassAllowed } from '../../../services/supabase';

interface Props {
  language: Language;
}

export const AdminRmsSettings: React.FC<Props> = ({ language }) => {
  const [feeSettings, setFeeSettings] = useState<FeeSettings>(() => AppStore.getFeeSettings());

  // Form State
  const [eventName] = useState('Sylhet Police Lines High School & College Reunion 2027');
  const [eventDate, setEventDate] = useState(feeSettings.eventTargetDate || '2027-01-29T09:00:00');
  const [registrationOpen, setRegistrationOpen] = useState(feeSettings.registrationOpen);
  const [formerStudentFee, setFormerStudentFee] = useState<number>(feeSettings.formerStudentFee || 1000);
  const [currentStudentFee, setCurrentStudentFee] = useState<number>(feeSettings.currentStudentFee || 500);
  const [endDate, setEndDate] = useState(feeSettings.endDate || '2027-01-15');
  const [closedMessageEn, setClosedMessageEn] = useState(
    feeSettings.closedMessageEn || 'Online registration for Reunion 2027 is currently closed.'
  );

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: FeeSettings = {
      ...feeSettings,
      eventTargetDate: eventDate,
      registrationOpen,
      formerStudentFee: Number(formerStudentFee),
      currentStudentFee: Number(currentStudentFee),
      endDate,
      closedMessageEn,
    };

    AppStore.saveFeeSettings(updated);
    setFeeSettings(updated);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 4000);
  };

  const handleResetDemoData = () => {
    if (!window.confirm('Reset RMS demo datasets (tasks, budget requests, audit log) to default factory seed? This cannot be undone.')) {
      return;
    }
    // Re-initialize demo data in RmsStore
    localStorage.removeItem('plscf_rms_tasks_2027');
    localStorage.removeItem('plscf_rms_budget_reqs_2027');
    localStorage.removeItem('plscf_rms_expenses_2027');
    localStorage.removeItem('plscf_rms_sponsors_2027');
    localStorage.removeItem('plscf_rms_documents_2027');
    setResetSuccess(true);
    setTimeout(() => setResetSuccess(false), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-[#172554] text-white p-6 rounded-3xl shadow-lg border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-bold uppercase tracking-wider border border-blue-400/30">
              Module 12
            </span>
            <span className="text-xs text-slate-300 font-medium">Reunion Management ERP</span>
          </div>
          <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <Settings className="w-6 h-6 text-amber-400" />
            <span>{language === 'bn' ? 'পুনর্মিলনী সিস্টেম ও গভর্ন্যান্স সেটিংস' : 'RMS System Configuration & Governance'}</span>
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-xl">
            {language === 'bn'
              ? 'ইভেন্টের চূড়ান্ত তারিখ, রেজিস্ট্রেশন ফি, কেন্দ্রীয় কমিটির নির্বাহী নেতৃত্ব এবং নিরাপত্তা নীতিমালা পরিচালনা করুন।'
              : 'Master event schedule parameters, registration gate policies, fee structures, and executive authority credentials.'}
          </p>
        </div>

        {savedSuccess && (
          <div className="p-3 bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 rounded-xl text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Settings saved successfully!</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Form Settings */}
        <div className="lg:col-span-8 space-y-6">
          <form onSubmit={handleSaveSettings} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-6">
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2 pb-3 border-b border-slate-100">
                <Calendar className="w-4 h-4 text-blue-600" />
                <span>Reunion Event Parameters</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 text-xs">
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Event Master Title</label>
                  <input
                    type="text"
                    disabled
                    value={eventName}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50 font-bold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Main Event Target Date & Time</label>
                  <input
                    type="datetime-local"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Registration Closing Deadline</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-hidden"
                  />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2 pb-3 border-b border-slate-100">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                <span>Registration Fees & Policies</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Former Student (Alumni) Fee (BDT)</label>
                  <input
                    type="number"
                    min={0}
                    value={formerStudentFee}
                    onChange={(e) => setFormerStudentFee(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-hidden font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Current Student Fee (BDT)</label>
                  <input
                    type="number"
                    min={0}
                    value={currentStudentFee}
                    onChange={(e) => setCurrentStudentFee(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-hidden font-mono font-bold"
                  />
                </div>

                <div className="sm:col-span-2 flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <input
                    type="checkbox"
                    id="regOpenCheck"
                    checked={registrationOpen}
                    onChange={(e) => setRegistrationOpen(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <label htmlFor="regOpenCheck" className="text-xs font-bold text-slate-800 cursor-pointer">
                    Enable Public Student Registration Portal (Allow New Sign-Ups)
                  </label>
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Closed Registration Notice (English)</label>
                  <input
                    type="text"
                    value={closedMessageEn}
                    onChange={(e) => setClosedMessageEn(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-hidden"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs shadow-md transition flex items-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4 text-emerald-400" />
                <span>Save Configuration</span>
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Governance Leadership Roster & Testing Reminder */}
        <div className="lg:col-span-4 space-y-4">
          {/* Universal Testing Credentials Card (Rendered only in dev testing mode) */}
          {isDevTestBypassAllowed() && (
            <div className="bg-sky-50 border border-sky-200 rounded-3xl p-5 shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-sky-950 font-bold text-sm">
                <Lock className="w-4 h-4 text-sky-700" />
                <span>Universal Testing Account</span>
              </div>
              <p className="text-xs text-sky-800 leading-relaxed">
                For testing and demonstration across all panels in local development:
              </p>
              <div className="bg-white p-3 rounded-xl border border-sky-200 font-mono text-xs space-y-1">
                <div><b>Email:</b> admin@gmail.com</div>
                <div><b>Password / PIN:</b> admin@123</div>
                <div className="text-[10px] text-slate-400 pt-1">Single-slot admin protection active.</div>
              </div>
            </div>
          )}

          {/* Executive Leadership Directory */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-3">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
              <UserCheck className="w-4 h-4 text-blue-600" />
              <span>Central Executive Leadership</span>
            </h3>

            <div className="space-y-2.5 text-xs">
              <div className="p-2.5 bg-slate-50 rounded-xl">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Chief Adviser</span>
                <span className="font-bold text-slate-900 block">Institution Principal</span>
                <span className="text-slate-500 font-mono text-[11px]">principal@policelines.edu.bd</span>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-xl">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Reunion Convener</span>
                <span className="font-bold text-slate-900 block">Monowar Shikder</span>
                <span className="text-slate-500 font-mono text-[11px]">monowar@policelines.edu.bd</span>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-xl">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Member Secretary</span>
                <span className="font-bold text-slate-900 block">Siddiqur Rahman</span>
                <span className="text-slate-500 font-mono text-[11px]">siddiqur@policelines.edu.bd</span>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-xl">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Registration & Database Director</span>
                <span className="font-bold text-slate-900 block">Sagar</span>
                <span className="text-slate-500 font-mono text-[11px]">sagar@policelines.edu.bd</span>
              </div>
            </div>
          </div>

          {/* Factory Reset Demo Data */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-3">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-rose-600" />
              <span>Reset Factory Sample Data</span>
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              If demo records have been modified during testing, reset sample tasks and vouchers back to default.
            </p>

            {resetSuccess && (
              <div className="p-2 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-bold text-center">
                Sample datasets reset. Refreshing...
              </div>
            )}

            <button
              type="button"
              onClick={handleResetDemoData}
              className="w-full py-2.5 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 hover:border-rose-300 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset RMS Sample Datasets</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
