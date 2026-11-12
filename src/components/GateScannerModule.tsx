import { useState } from 'react';
import {
  ShieldCheck,
  Search,
  Camera,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  UserCheck,
  UserX,
  Edit3,
  Shield,
  QrCode,
  X,
} from 'lucide-react';
import {
  RegistrationRecord,
  GateEventRecord,
  StaffAccount,
  Language,
} from '../types';
import { AppStore } from '../services/store';
import { EventStore, hasDepartmentPermission } from '../services/eventStore';
import { findRegistrationByTokenOrId, parseScannedInput } from '../utils/tokenGenerator';
import { validateGateAction } from '../utils/eventRules';
import { playScanSuccessSound, playScanErrorSound } from '../utils/audioAlert';
import { decodeQRCodeFromImageFile } from '../utils/qrDecoder';
import { QrCameraScanner } from './common/QrCameraScanner';
import { GlobalPagination } from './common/GlobalPagination';
import { paginate } from '../utils/pagination';

interface GateScannerModuleProps {
  language: Language;
  staffUser: StaffAccount;
  isSuperAdmin?: boolean;
}

export const GateScannerModule: React.FC<GateScannerModuleProps> = ({
  language: _language,
  staffUser,
  isSuperAdmin = false,
}) => {
  const [scanInput, setScanInput] = useState('');
  const [scannedStudent, setScannedStudent] = useState<RegistrationRecord | null>(null);
  const [isInside, setIsInside] = useState<boolean>(false);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [gateEvents, setGateEvents] = useState<GateEventRecord[]>(() =>
    EventStore.getGateEvents()
  );

  // Global Pagination State (Default 10, options 10, 20, 30, 40)
  const [logPage, setLogPage] = useState(1);
  const [logPageSize, setLogPageSize] = useState(10);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isResultPopupOpen, setIsResultPopupOpen] = useState(false);

  // Correction Modal State for Super Admin
  const [selectedEventForCorrection, setSelectedEventForCorrection] = useState<GateEventRecord | null>(null);
  const [correctionReason, setCorrectionReason] = useState('');
  const [newCorrectionStatus, setNewCorrectionStatus] = useState<'APPROVED' | 'DENIED' | 'REVISED'>('REVISED');

  const refreshEvents = () => {
    setGateEvents(EventStore.getGateEvents());
  };

  const handleQRImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const decoded = await decodeQRCodeFromImageFile(file);
    if (decoded) {
      handleProcessScan(decoded);
    } else {
      playScanErrorSound();
      setActionNotice({
        type: 'error',
        message: 'Could not decode QR code from the selected image. Please try another photo or enter the ID manually.',
      });
    }
  };

  const handleProcessScan = async (codeToSearch: string) => {
    if (!codeToSearch.trim()) return;
    refreshEvents();

    const clean = codeToSearch.trim();
    const parsed = parseScannedInput(clean);
    const displayTicket = parsed.id || parsed.token || clean;

    let student = findRegistrationByTokenOrId(AppStore.getRegistrations(), clean);
    if (!student) {
      student = await AppStore.findRegistrationAsync(clean);
    }

    if (!student) {
      playScanErrorSound();
      setScannedStudent(null);
      setActionNotice({
        type: 'error',
        message: `Student ticket "${displayTicket}" not found in database.`,
      });
      setIsResultPopupOpen(true);
      return;
    }

    playScanSuccessSound();
    const inside = EventStore.isStudentCurrentlyInside(student.id);
    setScannedStudent(student);
    setIsInside(inside);
    setActionNotice(null);
    setIsResultPopupOpen(true);
  };

  // Perform Entry or Exit
  const handleGateAction = (eventType: 'ENTRY' | 'EXIT') => {
    if (!scannedStudent) return;

    // Check Department RBAC permission
    if (!hasDepartmentPermission(staffUser, 'GATE', 'APPROVE')) {
      playScanErrorSound();
      setActionNotice({
        type: 'error',
        message: 'PERMISSION_DENIED: Your staff account is not authorized for gate entry operations.',
      });
      return;
    }

    const validation = validateGateAction(scannedStudent, isInside, eventType);
    if (!validation.allowed) {
      playScanErrorSound();
      setActionNotice({
        type: 'error',
        message: validation.messageEn,
      });
      return;
    }

    const res = EventStore.recordGateEvent(
      scannedStudent.id,
      scannedStudent.fullName,
      scannedStudent.batchName,
      scannedStudent.photoUrl,
      eventType,
      staffUser.assignedGate || 'Gate 01 - Main Gate',
      'SCANNER-01',
      staffUser.id,
      staffUser.fullName,
      staffUser
    );

    if (res.success && res.event) {
      playScanSuccessSound();
      refreshEvents();
      const updatedInside = EventStore.isStudentCurrentlyInside(scannedStudent.id);
      setIsInside(updatedInside);
      setActionNotice({
        type: 'success',
        message: `SUCCESS: ${scannedStudent.fullName} marked as ${eventType} at ${new Date().toLocaleTimeString()}.`,
      });

      // Auto-dismiss after 1600ms on success so staff can scan next
      setTimeout(() => {
        setIsResultPopupOpen(false);
        setScannedStudent(null);
        setActionNotice(null);
      }, 1600);
    } else {
      setActionNotice({
        type: 'error',
        message: res.error || 'Failed to record gate event.',
      });
    }
  };

  // Super Admin Correction Execution
  const handleSaveAdminCorrection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventForCorrection || !correctionReason.trim()) return;

    EventStore.adminCorrectGateEvent(
      selectedEventForCorrection.id,
      newCorrectionStatus,
      correctionReason.trim(),
      staffUser.id,
      staffUser.fullName
    );

    refreshEvents();
    setSelectedEventForCorrection(null);
    setCorrectionReason('');
    setActionNotice({
      type: 'success',
      message: 'Gate record corrected and stored in authoritative audit history.',
    });
    setTimeout(() => setActionNotice(null), 4000);
  };

  // Telemetry
  const totalEntries = gateEvents.filter((e) => e.eventType === 'ENTRY' && e.status === 'APPROVED').length;
  const totalExits = gateEvents.filter((e) => e.eventType === 'EXIT' && e.status === 'APPROVED').length;
  const uniqueStudents = Array.from(new Set(gateEvents.map((e) => e.registrationId)));
  const currentlyInsideCount = uniqueStudents.filter((id) =>
    EventStore.isStudentCurrentlyInside(id)
  ).length;

  return (
    <div className="space-y-6">
      {/* Module Header Bar */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-slate-900 text-amber-400 flex items-center justify-center font-black shadow-xs">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              Gate Entry & Exit Management Portal
            </h2>
            <p className="text-xs text-slate-500">
              Staff Incharge: <span className="font-semibold text-slate-800">{staffUser.fullName}</span> ({staffUser.role}) • Station: {staffUser.assignedGate || 'Main Gate'}
            </p>
          </div>
        </div>

        {/* Real-time Gate Metrics (Requirement 4) */}
        <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
          <div className="bg-emerald-50 border border-emerald-200 px-3.5 py-2 rounded-2xl text-center">
            <span className="text-[10px] uppercase font-bold text-emerald-800 block">Currently Inside</span>
            <span className="text-base font-black text-emerald-950 font-mono">{currentlyInsideCount}</span>
          </div>

          <div className="bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-2xl text-center">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Entries</span>
            <span className="text-base font-black text-slate-900 font-mono">{totalEntries}</span>
          </div>

          <div className="bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-2xl text-center">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Exits</span>
            <span className="text-base font-black text-slate-900 font-mono">{totalExits}</span>
          </div>
        </div>
      </div>

      {/* Main Scanner & Verification Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: QR Code Scan & Search */}
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <QrCode className="w-4 h-4 text-sky-700" />
                <span>Gate QR Scanner Desk</span>
              </h3>

              <div className="flex items-center gap-2">
                {/* Upload QR Image File Fallback */}
                <label className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer transition-colors border border-slate-200">
                  <span>📁 Upload QR Image</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleQRImageUpload}
                    className="hidden"
                  />
                </label>

                {/* Open/Close Camera Button */}
                <button
                  type="button"
                  onClick={() => setCameraActive(!cameraActive)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs ${
                    cameraActive
                      ? 'bg-rose-100 text-rose-700 border border-rose-300'
                      : 'bg-slate-900 text-white hover:bg-slate-800'
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>{cameraActive ? 'Stop Camera' : 'Open Camera'}</span>
                </button>
              </div>
            </div>

            {/* Square QR Code Camera Viewfinder */}
            {cameraActive && (
              <QrCameraScanner
                onScan={handleProcessScan}
                onClose={() => setCameraActive(false)}
                onUploadImage={async (file) => {
                  const decoded = await decodeQRCodeFromImageFile(file);
                  if (decoded) {
                    handleProcessScan(decoded);
                  } else {
                    playScanErrorSound();
                    setActionNotice({
                      type: 'error',
                      message: 'Could not decode QR code from the selected image. Please try another photo or enter the ID manually.',
                    });
                  }
                }}
                language={_language}
                themeColor="sky"
                title={_language === 'bn' ? 'গেট কিউআর ক্যামেরা' : 'Gate QR Camera'}
              />
            )}

            {/* Manual ID Input Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleProcessScan(scanInput);
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Registration ID / QR Token
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={scanInput}
                    onChange={(e) => setScanInput(e.target.value)}
                    placeholder="e.g. PLSCF-26F1001"
                    className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-300 text-sm font-mono uppercase tracking-wider focus:border-slate-900 focus:outline-hidden"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all cursor-pointer shadow-xs flex items-center justify-center gap-2"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Verify Gate Access</span>
              </button>
            </form>

            {/* Quick Demo Student Buttons */}
            <div className="pt-2 border-t border-slate-100">
              <span className="text-[11px] font-bold text-slate-500 block mb-2">
                Quick Test Student Tickets:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {['PLSCF-26F1001', 'PLSCF-26F1002', 'PLSCF-26C2001'].map((demoId) => (
                  <button
                    key={demoId}
                    type="button"
                    onClick={() => {
                      setScanInput(demoId);
                      handleProcessScan(demoId);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-mono font-bold transition-colors cursor-pointer"
                  >
                    {demoId}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Visual Photo Verification & Dual Action Controls */}
        <div className="lg:col-span-7">
          {actionNotice && (
            <div
              className={`p-4 rounded-2xl mb-4 text-xs font-bold flex items-center gap-2.5 ${
                actionNotice.type === 'success'
                  ? 'bg-emerald-50 border border-emerald-300 text-emerald-900'
                  : 'bg-rose-50 border border-rose-300 text-rose-900'
              }`}
            >
              {actionNotice.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{actionNotice.message}</span>
            </div>
          )}

          {scannedStudent ? (
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
              {/* Visual Photo Comparison Card (Requirement 4.6) */}
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 pb-6 border-b border-slate-100 text-center sm:text-left">
                <div className="relative">
                  <img
                    src={scannedStudent.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300'}
                    alt={scannedStudent.fullName}
                    className="w-28 h-36 object-cover rounded-2xl border-4 border-slate-200 shadow-md bg-slate-100"
                  />
                  <span className="absolute -bottom-2 inset-x-0 bg-slate-900 text-white text-[9px] font-bold uppercase tracking-wider py-0.5 text-center rounded-full">
                    Official Photo
                  </span>
                </div>

                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-900 text-white">
                      {scannedStudent.category === 'former' ? 'Former Student' : 'Current Student'}
                    </span>
                    <span className="font-mono text-xs font-black text-emerald-700">
                      {scannedStudent.id}
                    </span>
                  </div>

                  <h3 className="text-2xl font-black text-slate-900 truncate">
                    {scannedStudent.fullName}
                  </h3>

                  <p className="text-xs text-slate-500 font-medium">
                    Graduation / Batch: <strong className="text-slate-800">{scannedStudent.batchName}</strong>
                    {scannedStudent.passingYear && ` (${scannedStudent.passingYear})`}
                  </p>

                  <div className="pt-1 flex items-center justify-center sm:justify-start gap-2 text-xs">
                    <span className="font-bold text-slate-500">TOKEN:</span>
                    <span className="font-mono font-black tracking-widest text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-300">
                      {scannedStudent.qrToken}
                    </span>
                  </div>

                  <div className="pt-2 flex items-center justify-center sm:justify-start gap-2">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                        isInside
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-slate-100 text-slate-700 border border-slate-300'
                      }`}
                    >
                      {isInside ? '● CURRENTLY INSIDE VENUE' : '○ CURRENTLY OUTSIDE'}
                    </span>

                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                        scannedStudent.paymentStatus === 'paid'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      Payment: {scannedStudent.paymentStatus}
                    </span>
                  </div>
                </div>
              </div>

              {/* Instructions Callout */}
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                <p>
                  <strong>Visual Verification Protocol:</strong> Staff must visually compare the student's face with the official registration photograph above before permitting entry.
                </p>
              </div>

              {/* Dual Gate Action Controls (Requirement 4.6) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => handleGateAction('ENTRY')}
                  disabled={isInside || scannedStudent.paymentStatus !== 'paid'}
                  className={`py-4 px-6 rounded-2xl font-black text-sm tracking-wider uppercase flex items-center justify-center gap-2 transition-all shadow-md ${
                    !isInside && scannedStudent.paymentStatus === 'paid'
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer hover:shadow-lg'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                  }`}
                >
                  <UserCheck className="w-5 h-5" />
                  <span>[ MARK ENTRY ]</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleGateAction('EXIT')}
                  disabled={!isInside || scannedStudent.paymentStatus !== 'paid'}
                  className={`py-4 px-6 rounded-2xl font-black text-sm tracking-wider uppercase flex items-center justify-center gap-2 transition-all shadow-md ${
                    isInside && scannedStudent.paymentStatus === 'paid'
                      ? 'bg-slate-900 hover:bg-slate-800 text-white cursor-pointer hover:shadow-lg'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                  }`}
                >
                  <UserX className="w-5 h-5" />
                  <span>[ MARK EXIT ]</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 rounded-3xl p-12 border-2 border-dashed border-slate-200 text-center space-y-3">
              <ShieldCheck className="w-10 h-10 text-slate-300 mx-auto" />
              <h4 className="text-sm font-bold text-slate-700">Awaiting Gate Scan</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Scan the student's QR pass or input their Registration ID to verify identity, compare photograph, and mark entry or exit.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Gate Events History Table */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-4">
        <div className="flex justify-between items-center border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
              Gate Entry & Exit History Log
            </h3>
          </div>
          <span className="text-xs font-bold text-slate-500 font-mono">
            {gateEvents.length} events
          </span>
        </div>

        {gateEvents.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center">
            No gate entry or exit events recorded yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">Student ID</th>
                  <th className="py-2.5 px-3">Student Name</th>
                  <th className="py-2.5 px-3">Event</th>
                  <th className="py-2.5 px-3">Gate Station</th>
                  <th className="py-2.5 px-3">Staff Incharge</th>
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Status</th>
                  {isSuperAdmin && <th className="py-2.5 px-3 text-right">Admin Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginate(gateEvents, logPage, logPageSize).map((evt) => (
                  <tr key={evt.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                      {evt.registrationId}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800">
                      {evt.studentName}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          evt.eventType === 'ENTRY'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-indigo-100 text-indigo-800'
                        }`}
                      >
                        {evt.eventType}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">{evt.gateId}</td>
                    <td className="py-2.5 px-3 text-slate-600">{evt.staffName}</td>
                    <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                      {new Date(evt.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          evt.status === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {evt.status}
                      </span>
                    </td>
                    {isSuperAdmin && (
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => {
                            setSelectedEventForCorrection(evt);
                            setNewCorrectionStatus(evt.status === 'APPROVED' ? 'DENIED' : 'APPROVED');
                          }}
                          className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 ml-auto cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Correct</span>
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Global Pagination */}
        <GlobalPagination
          currentPage={logPage}
          totalRecords={gateEvents.length}
          pageSize={logPageSize}
          onPageChange={setLogPage}
          onPageSizeChange={setLogPageSize}
        />
      </div>

      {/* Super Admin Correction Modal with Mandatory Audit Reason */}
      {selectedEventForCorrection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-sm text-slate-900">
                  Super Admin Gate Record Correction
                </h3>
              </div>
              <button
                onClick={() => setSelectedEventForCorrection(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-1 bg-slate-50 p-3 rounded-2xl border border-slate-200">
              <p>Student: <strong>{selectedEventForCorrection.studentName}</strong> ({selectedEventForCorrection.registrationId})</p>
              <p>Action: <strong>{selectedEventForCorrection.eventType}</strong> at {selectedEventForCorrection.gateId}</p>
              <p>Current Status: <strong>{selectedEventForCorrection.status}</strong></p>
            </div>

            <form onSubmit={handleSaveAdminCorrection} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">New Status</label>
                <select
                  value={newCorrectionStatus}
                  onChange={(e) => setNewCorrectionStatus(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold"
                >
                  <option value="REVISED">REVISED (Revise entry/exit state)</option>
                  <option value="DENIED">DENIED (Cancel scan)</option>
                  <option value="APPROVED">APPROVED (Confirm valid scan)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mandatory Audit Reason *
                </label>
                <textarea
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  placeholder="State the verifiable reason for correcting this gate record (e.g. accidental double-tap or emergency exit bypass)..."
                  required
                  rows={3}
                  className="w-full p-3 rounded-xl border border-slate-300 text-xs focus:border-indigo-600 focus:outline-hidden"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedEventForCorrection(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer"
                >
                  Save & Log Correction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ── HIGH-VISIBILITY POPUP SCREEN FOR SCANNED OUTPUT ── */}
      {isResultPopupOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-backdrop-in overflow-y-auto">
          <div
            className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-pop-in my-auto"
            role="dialog"
            aria-modal="true"
          >
            {/* Modal Header Bar */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-900 to-sky-950 text-white">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-sky-500/20 border border-sky-400/30">
                  <ShieldCheck className="w-5 h-5 text-sky-300" />
                </div>
                <div>
                  <h3 className="text-sm font-black tracking-wide">
                    {_language === 'bn' ? 'গেট নিরাপত্তা যাচাই ফলাফল' : 'Gate Access Security Result'}
                  </h3>
                  <span className="text-[10px] text-slate-300 font-mono">
                    Official Reunion 2026/2027 Security Gate
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsResultPopupOpen(false);
                  setScannedStudent(null);
                  setActionNotice(null);
                }}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body Content */}
            <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              {/* Feedback Alert Notice */}
              {actionNotice && (
                <div
                  className={`p-4 rounded-2xl text-xs font-bold flex items-center gap-2.5 ${
                    actionNotice.type === 'success'
                      ? 'bg-emerald-50 border border-emerald-300 text-emerald-900'
                      : 'bg-rose-50 border border-rose-300 text-rose-900'
                  }`}
                >
                  {actionNotice.type === 'success' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
                  )}
                  <span>{actionNotice.message}</span>
                </div>
              )}

              {scannedStudent ? (
                <>
                  {/* Student Profile Card */}
                  <div className="flex items-start gap-4 pb-5 border-b border-slate-100">
                    <img
                      src={
                        scannedStudent.photoUrl ||
                        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300'
                      }
                      alt={scannedStudent.fullName}
                      className="w-20 h-24 object-cover rounded-2xl border-2 border-slate-200 shadow-xs bg-slate-100 shrink-0"
                    />

                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-900 text-white">
                          {scannedStudent.category === 'former' ? 'Former Student' : 'Current Student'}
                        </span>
                        <span className="font-mono text-xs font-black text-sky-700">
                          {scannedStudent.id}
                        </span>
                      </div>

                      <h4 className="text-lg font-black text-slate-900 truncate">
                        {scannedStudent.fullName}
                      </h4>

                      <p className="text-xs text-slate-500 font-medium">
                        Batch: <span className="font-bold text-slate-800">{scannedStudent.batchName}</span>
                        {scannedStudent.passingYear && ` • Passing Year: ${scannedStudent.passingYear}`}
                      </p>

                      <div className="pt-1 flex items-center gap-2 text-xs">
                        <span className="font-bold text-slate-500">TOKEN:</span>
                        <span className="font-mono font-black tracking-widest text-amber-900 bg-amber-100/80 px-2.5 py-0.5 rounded border border-amber-300">
                          {scannedStudent.qrToken}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Gate State & Location Callout Box */}
                  <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-sky-700 tracking-wider block">
                        Current Campus Location
                      </span>
                      <span className="text-base font-black text-slate-900 block flex items-center gap-1.5 mt-0.5">
                        {isInside ? (
                          <>
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span>INSIDE VENUE CAMPUS</span>
                          </>
                        ) : (
                          <>
                            <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                            <span>OUTSIDE / NOT CHECKED IN</span>
                          </>
                        )}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Ticket</span>
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
                        {scannedStudent.paymentStatus}
                      </span>
                    </div>
                  </div>

                  {/* Gate Dual Actions: Record Entry / Record Exit */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => handleGateAction('ENTRY')}
                      disabled={isInside}
                      className={`py-3.5 px-4 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                        isInside
                          ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/25 cursor-pointer active:scale-[0.98]'
                      }`}
                    >
                      <UserCheck className="w-4 h-4" />
                      <span>{isInside ? 'Already Inside' : 'Record Entry'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleGateAction('EXIT')}
                      disabled={!isInside}
                      className={`py-3.5 px-4 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                        !isInside
                          ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60'
                          : 'bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-900/25 cursor-pointer active:scale-[0.98]'
                      }`}
                    >
                      <UserX className="w-4 h-4" />
                      <span>{!isInside ? 'Already Outside' : 'Record Exit'}</span>
                    </button>
                  </div>
                </>
              ) : (
                /* Ticket Not Found State */
                <div className="p-6 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
                    <XCircle className="w-6 h-6" />
                  </div>
                  <h4 className="text-base font-bold text-slate-900">
                    {_language === 'bn' ? 'কোনো টিকিট পাওয়া যায়নি' : 'Ticket Not Found'}
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Please verify the QR code image or check the registration ID number.
                  </p>
                </div>
              )}

              {/* Close / Scan Next Student Button */}
              <button
                type="button"
                onClick={() => {
                  setIsResultPopupOpen(false);
                  setScannedStudent(null);
                  setActionNotice(null);
                }}
                className="w-full py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
              >
                {_language === 'bn' ? 'পরবর্তী টিকিট স্ক্যান করুন' : 'Scan Next Student / Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
