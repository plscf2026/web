import React, { useState } from 'react';
import {
  QrCode,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Users,
  Shirt,
  Utensils,
  Clock,
  ShieldCheck,
  Building,
  RefreshCw,
} from 'lucide-react';
import { RegistrationRecord, Language, ScanLog } from '../../../types';
import { AppStore } from '../../../services/store';

interface Props {
  language: Language;
  registrations: RegistrationRecord[];
}

export const AdminRmsQrCheckInManagement: React.FC<Props> = ({
  language,
  registrations,
}) => {
  const [selectedStation, setSelectedStation] = useState<string>('gate-1');
  const [scanLogs, setScanLogs] = useState<ScanLog[]>(() => AppStore.getScanLogs());
  const [searchQuery, setSearchQuery] = useState('');
  const [activeAttendee, setActiveAttendee] = useState<RegistrationRecord | null>(null);
  const [manualSuccessMsg, setManualSuccessMsg] = useState('');

  const reloadData = () => {
    setScanLogs(AppStore.getScanLogs());
  };

  const stations = [
    { id: 'gate-1', nameEn: 'Gate 1: Main Campus Entrance', nameBn: 'গেট ১: মূল প্রবেশদ্বার', icon: ShieldCheck },
    { id: 'gate-2', nameEn: 'Gate 2: VIP & Teachers Corridor', nameBn: 'গেট ২: ভিআইপি ও শিক্ষক গেট', icon: Building },
    { id: 'kit-desk', nameEn: 'Kit Counter: T-Shirts & ID Badges', nameBn: 'কিট কাউন্টার: টি-শার্ট ও ব্যাজ', icon: Shirt },
    { id: 'banquet-desk', nameEn: 'Grand Banquet: Meal Voucher Counter', nameBn: 'প্রীতিভোজ: খাবার ভাউচার কাউন্টার', icon: Utensils },
  ];

  // Verified Attendees
  const paidRegistrations = registrations.filter((r) => r.paymentStatus === 'paid');

  // Calculation of checked-in attendees
  const entryScanLogs = scanLogs.filter((l) => l.scanType === 'entry' && l.status === 'approved');
  const checkedInRegIds = new Set(entryScanLogs.map((l) => l.registrationId));
  const totalCheckedIn = paidRegistrations.filter((r) => checkedInRegIds.has(r.id)).length;
  const totalKitsDispatched = paidRegistrations.filter((r) => r.isTShirtCollected).length;

  // Search Results
  const searchResults = searchQuery.trim().length >= 2
    ? registrations.filter(
        (r) =>
          r.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.mobileNumber.includes(searchQuery) ||
          (r.studentId && r.studentId.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : [];

  const handleSelectAttendee = (att: RegistrationRecord) => {
    setActiveAttendee(att);
    setManualSuccessMsg('');
  };

  const handleManualCheckIn = (att: RegistrationRecord) => {
    const isAlreadyIn = checkedInRegIds.has(att.id);

    const newLog: ScanLog = {
      id: `SCAN-${Date.now().toString().slice(-6)}`,
      registrationId: att.id,
      studentName: att.fullName,
      studentCategory: att.category,
      scanType: 'entry',
      timestamp: new Date().toISOString(),
      staffId: 'STAFF-ADMIN-01',
      staffName: 'Admin Desk Officer',
      gateId: selectedStation,
      status: isAlreadyIn ? 'supervisor_review' : 'approved',
      failureReason: isAlreadyIn ? 'Duplicate manual scan attempt' : undefined,
    };

    AppStore.addScanLog(newLog);
    reloadData();

    if (isAlreadyIn) {
      setManualSuccessMsg(`Duplicate scan warning: ${att.fullName} was already logged as entered.`);
    } else {
      setManualSuccessMsg(`Successfully verified entry for ${att.fullName} (${att.id})!`);
    }
  };

  const handleToggleKitDispatched = (att: RegistrationRecord) => {
    const newStatus = !att.isTShirtCollected;
    AppStore.updateRegistration(att.id, { isTShirtCollected: newStatus });
    // Update local active attendee state
    setActiveAttendee({ ...att, isTShirtCollected: newStatus });
    setManualSuccessMsg(
      newStatus
        ? `Kit & T-Shirt (${att.tShirtSize}) marked as DISPATCHED for ${att.fullName}.`
        : `Kit dispatch status RESET for ${att.fullName}.`
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-[#172554] text-white p-6 rounded-3xl shadow-lg border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-bold uppercase tracking-wider border border-blue-400/30">
              Module 9
            </span>
            <span className="text-xs text-slate-300 font-medium">Reunion Management ERP</span>
          </div>
          <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <QrCode className="w-6 h-6 text-amber-400" />
            <span>{language === 'bn' ? 'মাল্টি-স্টেশন কিউআর চেক-ইন ডেস্ক' : 'Multi-Station QR Check-In & Gate Verification'}</span>
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-xl">
            {language === 'bn'
              ? 'গেট ১, ভিআইপি প্রবেশদ্বার, কিট ডেলিভারি এবং ব্যাঙ্কোয়েট খাবার ভাউচার যাচাইকরণ পরিচালনা করুন।'
              : 'Live scan validator, duplicate prevention engine, manual check-in fallback, and kit distribution tracking.'}
          </p>
        </div>

        <button
          onClick={reloadData}
          className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold text-xs shadow-md transition cursor-pointer"
        >
          <RefreshCw className="w-4 h-4 text-emerald-400" />
          <span>Sync Scan Logs</span>
        </button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold">{language === 'bn' ? 'অনুমোদিত অংশগ্রহণকারী' : 'Confirmed Paid'}</span>
            <Users className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-black text-slate-900">{paidRegistrations.length}</p>
          <span className="text-[10px] text-slate-400 font-medium">Eligible for Entry</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold">{language === 'bn' ? 'গেটে ভেরিফায়েড প্রবেশ' : 'Gate Checked-In'}</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-emerald-600">{totalCheckedIn}</p>
          <span className="text-[10px] text-emerald-600 font-bold">
            {paidRegistrations.length > 0 ? Math.round((totalCheckedIn / paidRegistrations.length) * 100) : 0}% Turnout
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold">{language === 'bn' ? 'কিট ও টি-শার্ট বিতরণ' : 'Kits Dispatched'}</span>
            <Shirt className="w-4 h-4 text-purple-500" />
          </div>
          <p className="text-2xl font-black text-purple-600">{totalKitsDispatched}</p>
          <span className="text-[10px] text-purple-600 font-medium">Badges & Souvenirs</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold">{language === 'bn' ? 'প্রবেশের বাকি' : 'Pending Entry'}</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-amber-600">{paidRegistrations.length - totalCheckedIn}</p>
          <span className="text-[10px] text-slate-400 font-medium">Expected at Campus</span>
        </div>
      </div>

      {/* Station Selector Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
          Select Active Verification Station:
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {stations.map((st) => {
            const Icon = st.icon;
            const isSelected = selectedStation === st.id;
            return (
              <button
                key={st.id}
                type="button"
                onClick={() => setSelectedStation(st.id)}
                className={`p-3 rounded-xl border text-left flex items-center gap-3 transition cursor-pointer ${
                  isSelected
                    ? 'bg-[#172554] text-white border-[#172554] shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className={`p-2 rounded-lg ${isSelected ? 'bg-white/10 text-amber-400' : 'bg-white text-slate-700 shadow-xs'}`}>
                  <Icon className="w-4 h-4" />
                </span>
                <div className="min-w-0">
                  <div className="text-xs font-bold truncate">{st.nameEn.split(':')[0]}</div>
                  <div className={`text-[10px] truncate ${isSelected ? 'text-slate-300' : 'text-slate-400'}`}>
                    {st.nameEn.split(':')[1]}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Two-Column Working Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Manual Search & Verification Card */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Search className="w-4 h-4 text-blue-600" />
              <span>Attendee Search & Manual Check-In</span>
            </h3>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search by ID (e.g. PLSCF-2026-F8941), Mobile, or Name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-hidden focus:border-slate-800"
              />
            </div>

            {/* Quick Search Matches dropdown/list */}
            {searchResults.length > 0 && (
              <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl">
                {searchResults.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => handleSelectAttendee(r)}
                    className="w-full p-2.5 text-left text-xs hover:bg-blue-50 flex items-center justify-between transition cursor-pointer"
                  >
                    <div>
                      <div className="font-bold text-slate-900">{r.fullName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {r.id} • {r.batchName} • {r.mobileNumber}
                      </div>
                    </div>
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        r.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {r.paymentStatus}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {manualSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{manualSuccessMsg}</span>
              </div>
            )}

            {/* Active Attendee Inspector Card */}
            {activeAttendee && (
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={activeAttendee.photoUrl}
                      alt={activeAttendee.fullName}
                      className="w-14 h-14 rounded-xl object-cover border border-slate-300 bg-white"
                    />
                    <div>
                      <h4 className="text-base font-black text-slate-900">{activeAttendee.fullName}</h4>
                      <p className="text-xs text-slate-500 font-mono">{activeAttendee.id}</p>
                      <p className="text-xs text-slate-600 font-medium">{activeAttendee.batchName}</p>
                    </div>
                  </div>

                  <div className="text-right space-y-1">
                    <span
                      className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        activeAttendee.paymentStatus === 'paid'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      Payment: {activeAttendee.paymentStatus}
                    </span>

                    {checkedInRegIds.has(activeAttendee.id) ? (
                      <div className="text-[10px] text-emerald-700 font-bold flex items-center justify-end gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Entered Campus</span>
                      </div>
                    ) : (
                      <div className="text-[10px] text-amber-700 font-bold flex items-center justify-end gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Not Yet Entered</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs bg-white p-3 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Mobile Phone</span>
                    <span className="font-bold text-slate-800">{activeAttendee.mobileNumber}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">T-Shirt Size</span>
                    <span className="font-bold text-slate-800">{activeAttendee.tShirtSize}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Fee Paid</span>
                    <span className="font-mono font-bold text-emerald-700">৳{activeAttendee.totalPaid || activeAttendee.registrationFee}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Kit Delivered</span>
                    <span className={`font-bold ${activeAttendee.isTShirtCollected ? 'text-emerald-700' : 'text-slate-500'}`}>
                      {activeAttendee.isTShirtCollected ? 'Yes (Delivered)' : 'No (Pending)'}
                    </span>
                  </div>
                </div>

                {/* Duplicate Scan Alert if attendee was already scanned */}
                {checkedInRegIds.has(activeAttendee.id) && (
                  <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block">Attendee is already inside the venue.</span>
                      <span className="text-[11px] text-amber-800">
                        Scan was already approved previously. Further check-ins will trigger a duplicate warning.
                      </span>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => handleManualCheckIn(activeAttendee)}
                    disabled={activeAttendee.paymentStatus !== 'paid'}
                    className="py-2.5 px-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Authorize Gate Entry</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggleKitDispatched(activeAttendee)}
                    className="py-2.5 px-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <Shirt className="w-4 h-4" />
                    <span>{activeAttendee.isTShirtCollected ? 'Mark Kit Pending' : 'Dispatch Kit'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Live Multi-Station Verification Feed */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-500" />
                <span>Live Verification Feed (Recent Scans)</span>
              </h3>
              <span className="text-[10px] font-mono text-slate-400">{scanLogs.length} total logs</span>
            </div>

            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {scanLogs.slice(0, 15).map((log) => {
                const isApproved = log.status === 'approved';
                return (
                  <div
                    key={log.id}
                    className={`p-3 rounded-xl border text-xs flex items-center justify-between transition ${
                      isApproved ? 'bg-slate-50 border-slate-200' : 'bg-rose-50/50 border-rose-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`p-1.5 rounded-lg ${isApproved ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                        {isApproved ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                      </span>

                      <div>
                        <div className="font-bold text-slate-900">{log.studentName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {log.registrationId} • Station: {log.gateId}
                        </div>
                        {log.failureReason && (
                          <div className="text-[10px] text-rose-600 font-medium">{log.failureReason}</div>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          isApproved ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {log.status.replace('_', ' ')}
                      </span>
                      <div className="text-[10px] text-slate-400 font-mono mt-1">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </div>
                    </div>
                  </div>
                );
              })}

              {scanLogs.length === 0 && (
                <div className="py-8 text-center text-xs text-slate-400 italic">
                  No scan logs recorded yet. Use the manual check-in or barcode scanner at desk.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

