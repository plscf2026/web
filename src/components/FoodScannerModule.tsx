import React, { useState } from 'react';
import {
  Utensils,
  Coffee,
  Sun,
  Moon,
  Search,
  Camera,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
  Shield,
  Edit3,
  QrCode,
  X,
  KeyRound,
  ShieldCheck,
} from 'lucide-react';
import {
  RegistrationRecord,
  FoodDistributionRecord,
  StaffAccount,
  Language,
} from '../types';
import { AppStore } from '../services/store';
import { EventStore, hasDepartmentPermission } from '../services/eventStore';
import { findRegistrationByTokenOrId, parseScannedInput } from '../utils/tokenGenerator';
import { validateMealCollection } from '../utils/eventRules';
import { playScanSuccessSound, playScanErrorSound } from '../utils/audioAlert';
import { QrCameraScanner } from './common/QrCameraScanner';
import { GlobalPagination } from './common/GlobalPagination';
import { paginate } from '../utils/pagination';

interface FoodScannerModuleProps {
  language: Language;
  staffUser: StaffAccount;
  defaultMealType?: 'breakfast' | 'lunch' | 'dinner';
  isSuperAdmin?: boolean;
}

export const FoodScannerModule: React.FC<FoodScannerModuleProps> = ({
  language,
  staffUser,
  defaultMealType = 'breakfast',
  isSuperAdmin = false,
}) => {
  const [mealType, setMealType] = useState<'breakfast' | 'lunch' | 'dinner'>(() => {
    if (staffUser.role === 'BREAKFAST_STAFF') return 'breakfast';
    if (staffUser.role === 'LUNCH_STAFF') return 'lunch';
    if (staffUser.role === 'DINNER_STAFF') return 'dinner';
    return defaultMealType;
  });

  const [scanInput, setScanInput] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [scannedStudent, setScannedStudent] = useState<RegistrationRecord | null>(null);
  const [validationResult, setValidationResult] = useState<any | null>(null);
  const [distributions, setDistributions] = useState<FoodDistributionRecord[]>(() =>
    EventStore.getFoodDistributions()
  );
  const [cameraActive, setCameraActive] = useState(false);

  // Global Pagination State (Default 10, options 10, 20, 30, 40)
  const [logPage, setLogPage] = useState(1);
  const [logPageSize, setLogPageSize] = useState(10);

  // Reset page when mealType changes
  React.useEffect(() => {
    setLogPage(1);
  }, [mealType]);
  const [feedbackNotice, setFeedbackNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isResultPopupOpen, setIsResultPopupOpen] = useState(false);

  // Correction modal state for Super Admin
  const [selectedRecordForCorrection, setSelectedRecordForCorrection] = useState<FoodDistributionRecord | null>(null);
  const [correctionReason, setCorrectionReason] = useState('');
  const [newCorrectionStatus, setNewCorrectionStatus] = useState<'COLLECTED' | 'CANCELLED'>('CANCELLED');

  const refreshDistributions = () => {
    setDistributions(EventStore.getFoodDistributions());
  };

  // Handle QR Camera scan or manual Registration ID + QR Token verification
  const handleProcessScan = async (codeToSearch: string, tokenParam?: string) => {
    if (!codeToSearch.trim()) return;
    refreshDistributions();

    const clean = codeToSearch.trim();
    const parsed = parseScannedInput(clean);
    const displayTicket = parsed.id || clean;
    const expectedToken = tokenParam?.trim().toUpperCase() || parsed.token;

    let student = findRegistrationByTokenOrId(AppStore.getRegistrations(), clean);
    if (!student) {
      student = await AppStore.findRegistrationAsync(clean, expectedToken);
    }

    if (!student) {
      playScanErrorSound();
      setScannedStudent(null);
      setValidationResult({
        canCollect: false,
        status: 'INVALID_REGISTRATION',
        messageEn: `Student ticket "${displayTicket}" not found.`,
        messageBn: `"${displayTicket}" নম্বরের কোনো টিকিট পাওয়া যায়নি।`,
      });
      setFeedbackNotice({
        type: 'error',
        message: `Student ticket "${displayTicket}" not found in database.`,
      });
      setIsResultPopupOpen(true);
      return;
    }

    // When QR Token is provided (manual verification or QR payload), verify token matches Registration ID
    if (expectedToken) {
      const studentToken = (student.qrToken || (student as any).qr_token || '').toUpperCase();
      if (studentToken && studentToken !== expectedToken) {
        playScanErrorSound();
        setScannedStudent(null);
        setValidationResult({
          canCollect: false,
          status: 'INVALID_REGISTRATION',
          messageEn: `QR Token "${expectedToken}" does not match Registration ID "${student.id}".`,
          messageBn: `কিউআর টোকেন "${expectedToken}" রেজিস্ট্রেশন আইডি "${student.id}"-এর সাথে মেলেনি।`,
        });
        setFeedbackNotice({
          type: 'error',
          message: `Verification Failed: QR Token "${expectedToken}" does not match Registration ID "${student.id}".`,
        });
        setIsResultPopupOpen(true);
        return;
      }
    }

    const currentDistributions = EventStore.getFoodDistributions();
    const result = validateMealCollection(student, mealType, currentDistributions);

    if (result.canCollect) {
      playScanSuccessSound();
    } else {
      playScanErrorSound();
    }

    setScannedStudent(student);
    setValidationResult(result);
    setFeedbackNotice(null);
    setIsResultPopupOpen(true);
  };

  // Confirm Received Handler
  const handleConfirmReceived = () => {
    if (!scannedStudent || !validationResult?.canCollect) return;

    // Check Department RBAC permission
    const targetDept = mealType.toUpperCase() as any;
    if (!hasDepartmentPermission(staffUser, targetDept, 'APPROVE')) {
      playScanErrorSound();
      setFeedbackNotice({
        type: 'error',
        message: `PERMISSION_DENIED: Your staff account is not authorized to approve ${mealType.toUpperCase()} distribution.`,
      });
      return;
    }

    const res = EventStore.confirmFoodDistribution(
      scannedStudent.id,
      scannedStudent.fullName,
      scannedStudent.batchName,
      mealType,
      staffUser.id,
      staffUser.fullName,
      undefined,
      staffUser
    );

    if (res.success && res.record) {
      playScanSuccessSound();
      refreshDistributions();
      setFeedbackNotice({
        type: 'success',
        message: `${mealType.toUpperCase()} marked as COLLECTED for ${scannedStudent.fullName}.`,
      });
      // Revalidate to show updated state
      const currentDistributions = EventStore.getFoodDistributions();
      const updatedValidation = validateMealCollection(scannedStudent, mealType, currentDistributions);
      setValidationResult(updatedValidation);

      // Auto-dismiss after success so staff can scan next student
      setTimeout(() => {
        setIsResultPopupOpen(false);
        setScannedStudent(null);
        setFeedbackNotice(null);
      }, 1600);
    } else {
      setFeedbackNotice({
        type: 'error',
        message: res.error || 'Failed to record meal collection.',
      });
    }
  };

  // Super Admin Correction Execution
  const handleSaveAdminCorrection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecordForCorrection || !correctionReason.trim()) return;

    EventStore.adminCorrectFoodDistribution(
      selectedRecordForCorrection.id,
      newCorrectionStatus,
      correctionReason.trim(),
      staffUser.id,
      staffUser.fullName
    );

    refreshDistributions();
    setSelectedRecordForCorrection(null);
    setCorrectionReason('');
    setFeedbackNotice({
      type: 'success',
      message: 'Meal record corrected and recorded in administrative audit history.',
    });
    setTimeout(() => setFeedbackNotice(null), 4000);
  };

  // Meal KPI counts
  const currentMealCount = distributions.filter(
    (d) => d.mealType === mealType && d.status === 'COLLECTED'
  ).length;

  const mealIcons = {
    breakfast: Coffee,
    lunch: Sun,
    dinner: Moon,
  };
  const MealIcon = mealIcons[mealType];

  return (
    <div className="space-y-6">
      {/* Module Header Bar */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow-xs">
              <MealIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight capitalize">
                {mealType} Distribution Scanner
              </h2>
              <p className="text-xs text-slate-500">
                Staff Incharge: <span className="font-semibold text-slate-800">{staffUser.fullName}</span> ({staffUser.role})
              </p>
            </div>
          </div>
        </div>

        {/* Meal Type Switcher (Accessible if Super Admin) */}
        {isSuperAdmin && (
          <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200 text-xs font-bold">
            {(['breakfast', 'lunch', 'dinner'] as const).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMealType(m);
                  setScannedStudent(null);
                  setValidationResult(null);
                }}
                className={`px-3.5 py-1.5 rounded-xl capitalize transition-all cursor-pointer ${
                  mealType === m
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        )}

        {/* Real-time Distributed Counter */}
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 px-4 py-2.5 rounded-2xl">
          <Utensils className="w-4 h-4 text-amber-700" />
          <div>
            <span className="text-[10px] font-bold text-amber-800 uppercase block tracking-wider">
              Total {mealType} Served
            </span>
            <span className="text-lg font-black text-amber-950 font-mono">
              {currentMealCount} <span className="text-xs font-normal text-amber-700">students</span>
            </span>
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
                <QrCode className="w-4 h-4 text-amber-600" />
                <span>Food QR Scanner Desk</span>
              </h3>

              <div className="flex items-center gap-2">
                {/* OPTION 1: OPEN CAMERA */}
                <button
                  type="button"
                  onClick={() => setCameraActive(!cameraActive)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs ${
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

            {/* OPTION 1: Square QR Code Camera Viewfinder */}
            {cameraActive && (
              <QrCameraScanner
                onScan={handleProcessScan}
                onClose={() => setCameraActive(false)}
                language={language}
                themeColor="amber"
                title={language === 'bn' ? 'খাবার বিতরণ কিউআর ক্যামেরা' : 'Food QR Camera Scanner'}
              />
            )}

            {/* OPTION 2: REGISTRATION ID + QR TOKEN (Server-Verified Manual Entry) */}
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                  <span>Manual Verification (ID + Token)</span>
                </span>
                <span className="text-[10px] text-slate-500 font-medium">
                  Enter both credentials
                </span>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleProcessScan(scanInput, tokenInput);
                }}
                className="space-y-3"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Registration ID *
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={scanInput}
                        onChange={(e) => setScanInput(e.target.value)}
                        placeholder="e.g. PLSCF-2027-F8472"
                        required
                        className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-slate-300 text-xs font-mono uppercase tracking-wider focus:border-amber-500 focus:outline-hidden"
                      />
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      QR Token *
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={tokenInput}
                        onChange={(e) => setTokenInput(e.target.value)}
                        placeholder="e.g. FJJG4G"
                        maxLength={10}
                        required
                        className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-slate-300 text-xs font-mono uppercase tracking-wider focus:border-amber-500 focus:outline-hidden"
                      />
                      <KeyRound className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3" />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all cursor-pointer shadow-xs flex items-center justify-center gap-2"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                  <span>Verify Registration ID + QR Token</span>
                </button>
              </form>
            </div>

            {/* Quick Demo Student Buttons for testing without camera */}
            <div className="pt-2 border-t border-slate-100">
              <span className="text-[11px] font-bold text-slate-500 block mb-2">
                Quick Test Student Tickets:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'PLSCF-2026-F1001', token: 'A7K9M2' },
                  { id: 'PLSCF-2026-F1002', token: 'R8W3N5' },
                  { id: 'PLSCF-2026-C2001', token: 'C3P7X9' },
                ].map((demo) => (
                  <button
                    key={demo.id}
                    type="button"
                    onClick={() => {
                      setScanInput(demo.id);
                      setTokenInput(demo.token);
                      handleProcessScan(demo.id, demo.token);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-amber-100 hover:text-amber-900 text-slate-700 text-[11px] font-mono font-bold transition-colors cursor-pointer border border-slate-200"
                  >
                    {demo.id}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Student Verification Card & Confirmation */}
        <div className="lg:col-span-7">
          {feedbackNotice && (
            <div
              className={`p-4 rounded-2xl mb-4 text-xs font-bold flex items-center gap-2.5 ${
                feedbackNotice.type === 'success'
                  ? 'bg-emerald-50 border border-emerald-300 text-emerald-900'
                  : 'bg-rose-50 border border-rose-300 text-rose-900'
              }`}
            >
              {feedbackNotice.type === 'success' ? (
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{feedbackNotice.message}</span>
            </div>
          )}

          {scannedStudent ? (
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
              {/* Student Header with Photograph */}
              <div className="flex items-start gap-4 pb-6 border-b border-slate-100">
                <img
                  src={scannedStudent.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300'}
                  alt={scannedStudent.fullName}
                  className="w-20 h-24 object-cover rounded-2xl border-2 border-slate-200 shadow-xs bg-slate-100 shrink-0"
                />

                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-900 text-white">
                      {scannedStudent.category === 'former' ? 'Former Student' : 'Current Student'}
                    </span>
                    <span className="font-mono text-xs font-black text-amber-600">
                      {scannedStudent.id}
                    </span>
                  </div>

                  <h3 className="text-xl font-black text-slate-900 truncate">
                    {scannedStudent.fullName}
                  </h3>

                  <p className="text-xs text-slate-500 font-medium">
                    Batch: <span className="font-bold text-slate-800">{scannedStudent.batchName}</span>
                    {scannedStudent.passingYear && ` • Passing Year: ${scannedStudent.passingYear}`}
                  </p>

                  <div className="pt-1 flex items-center gap-2 text-xs">
                    <span className="font-bold text-slate-500">TOKEN:</span>
                    <span className="font-mono font-black tracking-widest text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded border border-amber-300">
                      {scannedStudent.qrToken}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status Badge */}
              <div className="p-4 rounded-2xl border flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">
                    {mealType} Collection Status
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    {validationResult?.status === 'ALREADY_COLLECTED' ? (
                      <span className="text-sm font-black text-rose-600 flex items-center gap-1.5">
                        <XCircle className="w-4 h-4" /> ALREADY COLLECTED
                      </span>
                    ) : validationResult?.status === 'ELIGIBLE' ? (
                      <span className="text-sm font-black text-emerald-600 flex items-center gap-1.5">
                        <CheckCircle className="w-4 h-4" /> NOT COLLECTED (ELIGIBLE)
                      </span>
                    ) : (
                      <span className="text-sm font-black text-rose-700 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4" /> {validationResult?.status}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {language === 'bn' ? validationResult?.messageBn : validationResult?.messageEn}
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Payment Status</span>
                  <span
                    className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      scannedStudent.paymentStatus === 'paid'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {scannedStudent.paymentStatus}
                  </span>
                </div>
              </div>

              {/* Primary Action Button: [ CONFIRM RECEIVED ] */}
              {validationResult?.canCollect ? (
                <button
                  type="button"
                  onClick={handleConfirmReceived}
                  className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm tracking-wider uppercase transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-5 h-5" />
                  <span>[ CONFIRM {mealType.toUpperCase()} RECEIVED ]</span>
                </button>
              ) : validationResult?.status === 'ALREADY_COLLECTED' ? (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-center font-bold text-xs space-y-1">
                  <p>Duplicate Prevention: Student has already collected this meal.</p>
                  <p className="text-[11px] font-normal text-rose-700">
                    Staff members cannot reverse confirmed collections. If an administrative correction is needed, please contact Super Admin.
                  </p>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="bg-slate-50 rounded-3xl p-12 border-2 border-dashed border-slate-200 text-center space-y-3">
              <Utensils className="w-10 h-10 text-slate-300 mx-auto" />
              <h4 className="text-sm font-bold text-slate-700">Awaiting Student Scan</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Scan the student's digital QR ticket or enter their Registration ID on the left to verify meal collection status.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Meal Distributions Table & Admin Correction */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-4">
        <div className="flex justify-between items-center border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
              Recent {mealType} Distribution Log
            </h3>
          </div>
          <span className="text-xs font-bold text-slate-500 font-mono">
            {distributions.filter((d) => d.mealType === mealType).length} records
          </span>
        </div>

        {distributions.filter((d) => d.mealType === mealType).length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center">
            No {mealType} distributions recorded yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">Student ID</th>
                  <th className="py-2.5 px-3">Student Name</th>
                  <th className="py-2.5 px-3">Batch</th>
                  <th className="py-2.5 px-3">Collected Time</th>
                  <th className="py-2.5 px-3">Staff Incharge</th>
                  <th className="py-2.5 px-3">Status</th>
                  {isSuperAdmin && <th className="py-2.5 px-3 text-right">Admin Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginate(
                  distributions.filter((d) => d.mealType === mealType),
                  logPage,
                  logPageSize
                ).map((record) => (
                    <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                        {record.registrationId}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">
                        {record.studentName}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">{record.batchName}</td>
                      <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                        {new Date(record.collectedAt).toLocaleTimeString()}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{record.staffName}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            record.status === 'COLLECTED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {record.status}
                        </span>
                      </td>
                      {isSuperAdmin && (
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={() => {
                              setSelectedRecordForCorrection(record);
                              setNewCorrectionStatus(record.status === 'COLLECTED' ? 'CANCELLED' : 'COLLECTED');
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
          totalRecords={distributions.filter((d) => d.mealType === mealType).length}
          pageSize={logPageSize}
          onPageChange={setLogPage}
          onPageSizeChange={setLogPageSize}
          language={language}
        />
      </div>

      {/* Super Admin Correction Modal with Mandatory Reason */}
      {selectedRecordForCorrection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-sm text-slate-900">
                  Super Admin Meal Record Correction
                </h3>
              </div>
              <button
                onClick={() => setSelectedRecordForCorrection(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-1 bg-slate-50 p-3 rounded-2xl border border-slate-200">
              <p>Student: <strong>{selectedRecordForCorrection.studentName}</strong> ({selectedRecordForCorrection.registrationId})</p>
              <p>Meal: <strong className="uppercase">{selectedRecordForCorrection.mealType}</strong></p>
              <p>Current Status: <strong>{selectedRecordForCorrection.status}</strong></p>
            </div>

            <form onSubmit={handleSaveAdminCorrection} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">New Status</label>
                <select
                  value={newCorrectionStatus}
                  onChange={(e) => setNewCorrectionStatus(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold"
                >
                  <option value="CANCELLED">CANCELLED (Void collection)</option>
                  <option value="COLLECTED">COLLECTED (Mark as collected)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mandatory Audit Reason *
                </label>
                <textarea
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  placeholder="State the verifiable reason for correcting this meal collection record..."
                  required
                  rows={3}
                  className="w-full p-3 rounded-xl border border-slate-300 text-xs focus:border-indigo-600 focus:outline-hidden"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedRecordForCorrection(null)}
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
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-900 to-amber-950 text-white">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-400/30">
                  <Utensils className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h3 className="text-sm font-black tracking-wide">
                    {language === 'bn'
                      ? `${mealType === 'breakfast' ? 'সকালের নাস্তা' : mealType === 'lunch' ? 'দুপুরের খাবার' : 'রাতের খাবার'} যাচাই ফলাফল`
                      : `${mealType.toUpperCase()} Distribution Result`}
                  </h3>
                  <span className="text-[10px] text-slate-300 font-mono">
                    Official Reunion 2026/2027 Food Desk
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsResultPopupOpen(false);
                  setScannedStudent(null);
                  setFeedbackNotice(null);
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
              {feedbackNotice && (
                <div
                  className={`p-4 rounded-2xl text-xs font-bold flex items-center gap-2.5 ${
                    feedbackNotice.type === 'success'
                      ? 'bg-emerald-50 border border-emerald-300 text-emerald-900'
                      : 'bg-rose-50 border border-rose-300 text-rose-900'
                  }`}
                >
                  {feedbackNotice.type === 'success' ? (
                    <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
                  )}
                  <span>{feedbackNotice.message}</span>
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
                        <span className="font-mono text-xs font-black text-amber-600">
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

                  {/* Meal Station & Status Box */}
                  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-amber-700 tracking-wider block">
                        Assigned Food Station
                      </span>
                      <span className="text-sm font-black text-amber-950 block capitalize">
                        Official {mealType} Meal Voucher
                      </span>
                    </div>

                    <div className="text-center bg-white px-4 py-2 rounded-xl border border-amber-300 shadow-2xs">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Meal</span>
                      <span className="text-sm font-black text-amber-700 font-mono capitalize">
                        {mealType}
                      </span>
                    </div>
                  </div>

                  {/* Eligibility & Payment Status */}
                  <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">
                        Collection Status
                      </span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {validationResult?.status === 'ALREADY_COLLECTED' ? (
                          <span className="text-xs font-black text-rose-600 flex items-center gap-1">
                            <XCircle className="w-4 h-4" /> ALREADY COLLECTED
                          </span>
                        ) : validationResult?.status === 'ELIGIBLE' ? (
                          <span className="text-xs font-black text-emerald-600 flex items-center gap-1">
                            <CheckCircle className="w-4 h-4" /> NOT COLLECTED (ELIGIBLE)
                          </span>
                        ) : (
                          <span className="text-xs font-black text-amber-700 flex items-center gap-1">
                            <AlertTriangle className="w-4 h-4" /> {validationResult?.status}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Payment</span>
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                          scannedStudent.paymentStatus === 'paid'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {scannedStudent.paymentStatus}
                      </span>
                    </div>
                  </div>

                  {/* Primary Action Button */}
                  {validationResult?.canCollect ? (
                    <button
                      type="button"
                      onClick={handleConfirmReceived}
                      className="w-full py-4 rounded-2xl bg-amber-600 hover:bg-amber-700 active:scale-[0.99] text-white font-black text-sm tracking-wider uppercase transition-all shadow-lg shadow-amber-600/25 cursor-pointer flex items-center justify-center gap-2"
                    >
                      <CheckCircle className="w-5 h-5" />
                      <span>[ CONFIRM {mealType.toUpperCase()} COLLECTED ]</span>
                    </button>
                  ) : validationResult?.status === 'ALREADY_COLLECTED' ? (
                    <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-center font-bold text-xs space-y-1">
                      <p>Student has already collected this {mealType} meal.</p>
                      <p className="text-[11px] font-normal text-rose-700">
                        Duplicate food collections are blocked by event security rules.
                      </p>
                    </div>
                  ) : null}
                </>
              ) : (
                /* Ticket Not Found State */
                <div className="p-6 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
                    <XCircle className="w-6 h-6" />
                  </div>
                  <h4 className="text-base font-bold text-slate-900">
                    {language === 'bn' ? 'কোনো টিকিট পাওয়া যায়নি' : 'Ticket Not Found'}
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {validationResult?.messageEn ||
                      'Please verify the QR code image or check the registration ID number.'}
                  </p>
                </div>
              )}

              {/* Close / Scan Next Student Button */}
              <button
                type="button"
                onClick={() => {
                  setIsResultPopupOpen(false);
                  setScannedStudent(null);
                  setFeedbackNotice(null);
                }}
                className="w-full py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
              >
                {language === 'bn' ? 'পরবর্তী টিকিট স্ক্যান করুন' : 'Scan Next Student / Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
