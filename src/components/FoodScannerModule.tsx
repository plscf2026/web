import React, { useState, useRef, useEffect } from 'react';
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
} from 'lucide-react';
import {
  RegistrationRecord,
  FoodDistributionRecord,
  StaffAccount,
  Language,
} from '../types';
import { AppStore } from '../services/store';
import { EventStore, hasDepartmentPermission } from '../services/eventStore';
import { findRegistrationByTokenOrId } from '../utils/tokenGenerator';
import { validateMealCollection } from '../utils/eventRules';
import { playScanSuccessSound, playScanErrorSound } from '../utils/audioAlert';
import { startResilientCameraStream, decodeQRCodeFromImageFile } from '../utils/qrDecoder';

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
  const [scannedStudent, setScannedStudent] = useState<RegistrationRecord | null>(null);
  const [validationResult, setValidationResult] = useState<any | null>(null);
  const [distributions, setDistributions] = useState<FoodDistributionRecord[]>(() =>
    EventStore.getFoodDistributions()
  );
  const [cameraActive, setCameraActive] = useState(false);
  const [feedbackNotice, setFeedbackNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Correction modal state for Super Admin
  const [selectedRecordForCorrection, setSelectedRecordForCorrection] = useState<FoodDistributionRecord | null>(null);
  const [correctionReason, setCorrectionReason] = useState('');
  const [newCorrectionStatus, setNewCorrectionStatus] = useState<'COLLECTED' | 'CANCELLED'>('CANCELLED');

  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isStartingCamera, setIsStartingCamera] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastScannedCodeRef = useRef<string>('');
  const lastScannedTimeRef = useRef<number>(0);

  const refreshDistributions = () => {
    setDistributions(EventStore.getFoodDistributions());
  };

  // Camera stream starter & real-time QR code decoding
  useEffect(() => {
    let stream: MediaStream | null = null;
    let detectorInterval: any = null;

    if (cameraActive) {
      setCameraError(null);
      setIsStartingCamera(true);

      startResilientCameraStream(true).then((res) => {
        setIsStartingCamera(false);
        if (res.error || !res.stream) {
          setCameraError(res.error || 'Failed to start camera.');
          return;
        }

        stream = res.stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');
          videoRef.current.setAttribute('muted', 'true');
          videoRef.current.play().catch(() => {});
        }

        // Real-time camera QR decoding using BarcodeDetector API
        if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
          try {
            const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
            detectorInterval = setInterval(async () => {
              if (
                videoRef.current &&
                videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA
              ) {
                try {
                  const barcodes = await detector.detect(videoRef.current);
                  if (barcodes.length > 0) {
                    const code = barcodes[0].rawValue?.trim();
                    const now = Date.now();
                    if (code && (code !== lastScannedCodeRef.current || now - lastScannedTimeRef.current > 3000)) {
                      lastScannedCodeRef.current = code;
                      lastScannedTimeRef.current = now;
                      handleProcessScan(code);
                    }
                  }
                } catch (e) {}
              }
            }, 300);
          } catch (e) {
            console.warn('BarcodeDetector initialization notice:', e);
          }
        }
      });
    }

    return () => {
      if (detectorInterval) clearInterval(detectorInterval);
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [cameraActive]);

  const handleQRImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const decoded = await decodeQRCodeFromImageFile(file);
    if (decoded) {
      handleProcessScan(decoded);
    } else {
      playScanErrorSound();
      setFeedbackNotice({
        type: 'error',
        message: 'Could not decode QR code from the selected image. Please try another photo or enter the ID manually.',
      });
    }
  };

  // Handle Scanning or Code Entry (6-character token, student ID, or scanned QR payload)
  const handleProcessScan = (codeToSearch: string) => {
    if (!codeToSearch.trim()) return;
    refreshDistributions();

    const clean = codeToSearch.trim();
    const registrations = AppStore.getRegistrations();
    const student = findRegistrationByTokenOrId(registrations, clean);

    if (!student) {
      playScanErrorSound();
      setScannedStudent(null);
      setValidationResult({
        canCollect: false,
        status: 'INVALID_REGISTRATION',
        messageEn: `Student ticket "${clean}" not found.`,
        messageBn: `"${clean}" নম্বরের কোনো টিকিট পাওয়া যায়নি।`,
      });
      return;
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

      // Auto-clear notification
      setTimeout(() => setFeedbackNotice(null), 4000);
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

            {/* Camera Viewport & Diagnostic Alerts */}
            {cameraActive && (
              <div className="space-y-2">
                {cameraError ? (
                  <div className="p-4 bg-amber-50 border border-amber-300 text-amber-900 rounded-2xl text-xs space-y-2">
                    <div className="flex items-center gap-1.5 font-bold text-amber-950">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span>Camera Notice</span>
                    </div>
                    <p className="text-[11px] leading-relaxed">{cameraError}</p>
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-200 hover:bg-amber-300 text-amber-950 font-bold rounded-lg cursor-pointer transition-colors text-xs mt-1">
                      <span>📁 Select Ticket / QR Photo File</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleQRImageUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                ) : (
                  <div className="relative rounded-2xl overflow-hidden bg-slate-950 aspect-video border-2 border-dashed border-amber-400 flex items-center justify-center">
                    {isStartingCamera ? (
                      <div className="text-white text-xs flex items-center gap-2 font-mono">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                        <span>Initializing video camera...</span>
                      </div>
                    ) : (
                      <>
                        <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
                        <div className="absolute inset-x-8 inset-y-6 border-2 border-amber-400 rounded-xl pointer-events-none animate-pulse" />
                        <span className="absolute bottom-2 bg-slate-900/80 text-amber-300 px-3 py-1 rounded-full text-[10px] font-mono">
                          Center QR code in viewfinder
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>
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
                  Student Registration ID / QR Token
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={scanInput}
                    onChange={(e) => setScanInput(e.target.value)}
                    placeholder="e.g. PLSCF-26F1001"
                    className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-300 text-sm font-mono uppercase tracking-wider focus:border-amber-500 focus:outline-hidden"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all cursor-pointer shadow-xs flex items-center justify-center gap-2"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Verify Meal Eligibility</span>
              </button>
            </form>

            {/* Quick Demo Student Buttons for testing without camera */}
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
                {distributions
                  .filter((d) => d.mealType === mealType)
                  .slice(0, 15)
                  .map((record) => (
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
    </div>
  );
};
