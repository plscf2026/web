import { useState, useEffect, useRef } from 'react';
import {
  QrCode,
  ShieldCheck,
  Utensils,
  Shirt,
  Search,
  Camera,
  CheckCircle,
  AlertTriangle,
  Coffee,
  Sun,
  Moon,
  Layers,
  MapPin,
} from 'lucide-react';
import {
  RegistrationRecord,
  StaffAccount,
  Language,
  GateEventRecord,
  FoodDistributionRecord,
  DressDistributionRecord,
} from '../types';
import { AppStore } from '../services/store';
import { EventStore } from '../services/eventStore';
import { findRegistrationByTokenOrId } from '../utils/tokenGenerator';
import { playScanSuccessSound, playScanErrorSound } from '../utils/audioAlert';
import { startResilientCameraStream, decodeQRCodeFromImageFile } from '../utils/qrDecoder';

export type DeskStationId =
  | 'MASTER_DESK'
  | 'GATE_01'
  | 'GATE_02'
  | 'BREAKFAST_PAVILION'
  | 'LUNCH_PAVILION'
  | 'DINNER_PAVILION'
  | 'DRESS_BOOTH';

interface MultiStationDeskProps {
  language: Language;
  staffUser: StaffAccount;
  isSuperAdmin?: boolean;
}

export const MultiStationDesk: React.FC<MultiStationDeskProps> = ({
  language,
  staffUser,
  isSuperAdmin: _isSuperAdmin = true,
}) => {
  const [activeStation, setActiveStation] = useState<DeskStationId>('MASTER_DESK');
  const [scanInput, setScanInput] = useState('');
  const [scannedStudent, setScannedStudent] = useState<RegistrationRecord | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isStartingCamera, setIsStartingCamera] = useState(false);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Real-time state caches
  const [gateEvents, setGateEvents] = useState<GateEventRecord[]>(() => EventStore.getGateEvents());
  const [foodDistributions, setFoodDistributions] = useState<FoodDistributionRecord[]>(() =>
    EventStore.getFoodDistributions()
  );
  const [dressDistributions, setDressDistributions] = useState<DressDistributionRecord[]>(() =>
    EventStore.getDressDistributions()
  );

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastScannedCodeRef = useRef<string>('');
  const lastScannedTimeRef = useRef<number>(0);

  const refreshAllState = () => {
    setGateEvents(EventStore.getGateEvents());
    setFoodDistributions(EventStore.getFoodDistributions());
    setDressDistributions(EventStore.getDressDistributions());
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
          videoRef.current.play().catch(() => { });
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
                } catch (e) { }
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

  // Decode QR from uploaded image file
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

  // Process QR / Token lookup
  const handleProcessScan = (codeToSearch: string) => {
    if (!codeToSearch.trim()) return;
    refreshAllState();

    const clean = codeToSearch.trim();
    const registrations = AppStore.getRegistrations();
    const student = findRegistrationByTokenOrId(registrations, clean);

    if (!student) {
      playScanErrorSound();
      setScannedStudent(null);
      setActionNotice({
        type: 'error',
        message: `Student ticket "${clean}" not found in database.`,
      });
      return;
    }

    playScanSuccessSound();
    setScannedStudent(student);
    setActionNotice(null);
  };

  // Station specific quick actions
  const isInside = scannedStudent ? EventStore.isStudentCurrentlyInside(scannedStudent.id) : false;
  const breakfastRecord = scannedStudent ? EventStore.getMealStatus(scannedStudent.id, 'breakfast') : undefined;
  const lunchRecord = scannedStudent ? EventStore.getMealStatus(scannedStudent.id, 'lunch') : undefined;
  const dinnerRecord = scannedStudent ? EventStore.getMealStatus(scannedStudent.id, 'dinner') : undefined;
  const dressRecord = scannedStudent ? EventStore.getDressStatus(scannedStudent.id) : undefined;

  // Gate Action
  const handleGateAction = (type: 'ENTRY' | 'EXIT') => {
    if (!scannedStudent) return;
    const gateId = activeStation === 'GATE_02' ? 'Gate 02 - East Gate' : 'Gate 01 - Main Entrance';

    const res = EventStore.recordGateEvent(
      scannedStudent.id,
      scannedStudent.fullName,
      scannedStudent.batchName,
      scannedStudent.photoUrl,
      type,
      gateId,
      'SCAN-DESK-01',
      staffUser.id,
      staffUser.fullName,
      staffUser
    );

    if (res.success) {
      playScanSuccessSound();
      refreshAllState();
      setActionNotice({
        type: 'success',
        message: `${type === 'ENTRY' ? 'ENTRY APPROVED' : 'EXIT RECORDED'} for ${scannedStudent.fullName}`,
      });
    } else {
      playScanErrorSound();
      setActionNotice({ type: 'error', message: res.error || 'Action failed.' });
    }
  };

  // Meal Action
  const handleMealAction = (meal: 'breakfast' | 'lunch' | 'dinner') => {
    if (!scannedStudent) return;
    const res = EventStore.confirmFoodDistribution(
      scannedStudent.id,
      scannedStudent.fullName,
      scannedStudent.batchName,
      meal,
      staffUser.id,
      staffUser.fullName,
      undefined,
      staffUser
    );

    if (res.success) {
      playScanSuccessSound();
      refreshAllState();
      setActionNotice({
        type: 'success',
        message: `${meal.toUpperCase()} issued successfully to ${scannedStudent.fullName}`,
      });
    } else {
      playScanErrorSound();
      setActionNotice({ type: 'error', message: res.error || 'Action failed.' });
    }
  };

  // Dress Action
  const handleDressAction = () => {
    if (!scannedStudent) return;
    const res = EventStore.confirmDressDistribution(
      scannedStudent.id,
      scannedStudent.fullName,
      'reunion_tshirt',
      scannedStudent.tShirtSize,
      staffUser.id,
      staffUser.fullName,
      undefined,
      staffUser
    );

    if (res.success) {
      playScanSuccessSound();
      refreshAllState();
      AppStore.updateRegistration(scannedStudent.id, { isTShirtCollected: true });
      setActionNotice({
        type: 'success',
        message: `T-Shirt (Size: ${scannedStudent.tShirtSize}) issued to ${scannedStudent.fullName}`,
      });
    } else {
      playScanErrorSound();
      setActionNotice({ type: 'error', message: res.error || 'Action failed.' });
    }
  };

  const STATIONS_LIST: { id: DeskStationId; nameEn: string; nameBn: string; icon: any }[] = [
    { id: 'MASTER_DESK', nameEn: 'Unified Master Desk', nameBn: 'সেন্ট্রাল মাস্টার ডেস্ক', icon: Layers },
    { id: 'GATE_01', nameEn: 'Main Gate 01 Desk', nameBn: 'মেইন গেট ০১ ডেস্ক', icon: ShieldCheck },
    { id: 'GATE_02', nameEn: 'East Gate 02 Desk', nameBn: 'ইস্ট গেট ০২ ডেস্ক', icon: MapPin },
    { id: 'BREAKFAST_PAVILION', nameEn: 'Breakfast Pavilion', nameBn: 'ব্রেকফাস্ট প্যাভিলিয়ন', icon: Coffee },
    { id: 'LUNCH_PAVILION', nameEn: 'Lunch Buffet Pavilion', nameBn: 'লাঞ্চ বুফে প্যাভিলিয়ন', icon: Sun },
    { id: 'DINNER_PAVILION', nameEn: 'Dinner Pavilion', nameBn: 'ডিনার প্যাভিলিয়ন', icon: Moon },
    { id: 'DRESS_BOOTH', nameEn: 'T-Shirt & Kit Booth', nameBn: 'টি-শার্ট ও কিট বুথ', icon: Shirt },
  ];

  return (
    <div className="space-y-6">
      {/* Desk Header Banner */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-sky-500 text-slate-950 flex items-center justify-center font-black shadow-md">
            <QrCode className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Multi-Station QR Verification Desk
            </h2>
            <p className="text-xs text-slate-400">
              Station Operator: <span className="font-bold text-sky-400">{staffUser.fullName}</span> ({staffUser.role})
            </p>
          </div>
        </div>

        {/* Live Desk Stats */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="bg-slate-800 px-3.5 py-2 rounded-2xl border border-slate-700 text-center">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Gate Entries</span>
            <span className="text-sm font-black text-emerald-400 font-mono">
              {gateEvents.filter((e) => e.eventType === 'ENTRY').length}
            </span>
          </div>
          <div className="bg-slate-800 px-3.5 py-2 rounded-2xl border border-slate-700 text-center">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Meals Served</span>
            <span className="text-sm font-black text-amber-400 font-mono">{foodDistributions.length}</span>
          </div>
          <div className="bg-slate-800 px-3.5 py-2 rounded-2xl border border-slate-700 text-center">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Kits Delivered</span>
            <span className="text-sm font-black text-sky-400 font-mono">{dressDistributions.length}</span>
          </div>
        </div>
      </div>

      {/* Station Selector Bar */}
      <div className="bg-white rounded-2xl p-2 border border-slate-200 shadow-xs flex items-center gap-1.5 overflow-x-auto">
        {STATIONS_LIST.map((station) => {
          const Icon = station.icon;
          const isActive = activeStation === station.id;
          return (
            <button
              key={station.id}
              onClick={() => setActiveStation(station.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${isActive
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-sky-400' : 'text-slate-500'}`} />
              <span>{language === 'bn' ? station.nameBn : station.nameEn}</span>
            </button>
          );
        })}
      </div>

      {/* Notice Banner */}
      {actionNotice && (
        <div
          className={`p-4 rounded-2xl border text-xs font-semibold flex items-center justify-between gap-2 ${actionNotice.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
              : 'bg-rose-50 border-rose-300 text-rose-950'
            }`}
        >
          <div className="flex items-center gap-2">
            {actionNotice.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{actionNotice.message}</span>
          </div>
          <button
            onClick={() => setActionNotice(null)}
            className="text-slate-500 hover:text-slate-800 text-xs cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Scanner & Verification Work Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: QR Scanner & Input Controls */}
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <QrCode className="w-4 h-4 text-sky-700" />
                <span>Station Scanner Viewport</span>
              </h3>

              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer transition-colors border border-slate-200">
                  <span>📁 Upload QR Image</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleQRImageUpload}
                    className="hidden"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => setCameraActive(!cameraActive)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs ${cameraActive
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
                  <div className="relative rounded-2xl overflow-hidden bg-slate-950 aspect-video border-2 border-dashed border-sky-400 flex items-center justify-center">
                    {isStartingCamera ? (
                      <div className="text-white text-xs flex items-center gap-2 font-mono">
                        <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-ping" />
                        <span>Initializing video camera...</span>
                      </div>
                    ) : (
                      <>
                        <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
                        <div className="absolute inset-x-8 inset-y-6 border-2 border-sky-400 rounded-xl pointer-events-none animate-pulse" />
                        <span className="absolute bottom-2 bg-slate-900/80 text-sky-300 px-3 py-1 rounded-full text-[10px] font-mono">
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
                  Registration ID / QR Token
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={scanInput}
                    onChange={(e) => setScanInput(e.target.value)}
                    placeholder="e.g. PLSCF-2026-F1001"
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
                <span>Lookup & Verify Station Access</span>
              </button>
            </form>

            {/* Quick Demo Attendee Pills */}
            <div className="pt-2 border-t border-slate-100">
              <span className="text-[11px] font-bold text-slate-500 block mb-2">
                Quick Demo Attendees:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'PLSCF-2026-F1001', label: 'Tanvir (Alumni)' },
                  { id: 'PLSCF-2026-F1002', label: 'Dr. Nusrat (Alumni)' },
                  { id: 'PLSCF-2026-F1003', label: 'Asad (Alumni)' },
                  { id: 'PLSCF-2026-C2001', label: 'Samiul (Student)' },
                  { id: 'PLSCF-2026-C2002', label: 'Ayesha (Student)' },
                ].map((demo) => (
                  <button
                    key={demo.id}
                    type="button"
                    onClick={() => {
                      setScanInput(demo.id);
                      handleProcessScan(demo.id);
                    }}
                    className="text-[10px] font-mono px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-sky-100 hover:text-sky-900 text-slate-700 transition-colors border border-slate-200 cursor-pointer"
                  >
                    {demo.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Multi-Station Verification Card & Direct Action Buttons */}
        <div className="lg:col-span-7">
          {scannedStudent ? (
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
              {/* Attendee Profile Header */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pb-6 border-b border-slate-100">
                <img
                  src={scannedStudent.photoUrl}
                  alt={scannedStudent.fullName}
                  className="w-20 h-20 rounded-2xl object-cover border-2 border-slate-900 shadow-sm shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-900 text-white">
                      {scannedStudent.category === 'former' ? 'Alumni' : 'Current Student'}
                    </span>
                    <span className="font-mono text-xs text-sky-800 bg-sky-50 px-2 py-0.5 rounded border border-sky-200 font-bold">
                      {scannedStudent.id}
                    </span>
                    <span className="font-mono text-xs text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-300 font-bold tracking-widest">
                      TOKEN: {scannedStudent.qrToken}
                    </span>
                  </div>
                  <h3 className="text-xl font-black text-slate-900 truncate">
                    {scannedStudent.fullName}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Batch: <span className="font-semibold text-slate-800">{scannedStudent.batchName}</span> • Size:{' '}
                    <span className="font-bold text-slate-900">{scannedStudent.tShirtSize}</span>
                  </p>
                </div>
              </div>

              {/* Multi-Station Service Checklist Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 1. Gate Status Card */}
                <div
                  className={`p-4 rounded-2xl border ${isInside ? 'bg-emerald-50 border-emerald-300' : 'bg-slate-50 border-slate-200'
                    }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] uppercase font-bold text-slate-500">Venue Gate</span>
                    <ShieldCheck className={`w-4 h-4 ${isInside ? 'text-emerald-600' : 'text-slate-400'}`} />
                  </div>
                  <span className={`text-base font-black block font-mono ${isInside ? 'text-emerald-900' : 'text-slate-700'}`}>
                    {isInside ? 'INSIDE VENUE' : 'OUTSIDE'}
                  </span>
                  <div className="mt-3 flex gap-1.5">
                    {!isInside ? (
                      <button
                        onClick={() => handleGateAction('ENTRY')}
                        className="w-full py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold cursor-pointer transition-colors shadow-xs"
                      >
                        Approve Entry
                      </button>
                    ) : (
                      <button
                        onClick={() => handleGateAction('EXIT')}
                        className="w-full py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold cursor-pointer transition-colors shadow-xs"
                      >
                        Record Exit
                      </button>
                    )}
                  </div>
                </div>

                {/* 2. Food Status Card */}
                <div className="p-4 rounded-2xl border bg-amber-50/50 border-amber-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] uppercase font-bold text-amber-800">Food / Meals</span>
                    <Utensils className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 text-[11px]">Breakfast:</span>
                      {breakfastRecord ? (
                        <span className="text-emerald-700 font-bold font-mono text-[10px]">COLLECTED</span>
                      ) : (
                        <button
                          onClick={() => handleMealAction('breakfast')}
                          className="px-2 py-0.5 rounded bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[10px] cursor-pointer"
                        >
                          Issue
                        </button>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 text-[11px]">Lunch:</span>
                      {lunchRecord ? (
                        <span className="text-emerald-700 font-bold font-mono text-[10px]">COLLECTED</span>
                      ) : (
                        <button
                          onClick={() => handleMealAction('lunch')}
                          className="px-2 py-0.5 rounded bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[10px] cursor-pointer"
                        >
                          Issue
                        </button>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 text-[11px]">Dinner:</span>
                      {dinnerRecord ? (
                        <span className="text-emerald-700 font-bold font-mono text-[10px]">COLLECTED</span>
                      ) : (
                        <button
                          onClick={() => handleMealAction('dinner')}
                          className="px-2 py-0.5 rounded bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[10px] cursor-pointer"
                        >
                          Issue
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* 3. T-Shirt & Kit Status Card */}
                <div
                  className={`p-4 rounded-2xl border ${dressRecord ? 'bg-indigo-50 border-indigo-300' : 'bg-slate-50 border-slate-200'
                    }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] uppercase font-bold text-slate-500">T-Shirt & Kit</span>
                    <Shirt className={`w-4 h-4 ${dressRecord ? 'text-indigo-600' : 'text-slate-400'}`} />
                  </div>
                  <span className={`text-base font-black block font-mono ${dressRecord ? 'text-indigo-950' : 'text-slate-700'}`}>
                    {dressRecord ? `DELIVERED (${dressRecord.registeredSize})` : 'PENDING'}
                  </span>
                  <div className="mt-3">
                    {!dressRecord ? (
                      <button
                        onClick={handleDressAction}
                        className="w-full py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold cursor-pointer transition-colors shadow-xs"
                      >
                        Issue T-Shirt ({scannedStudent.tShirtSize})
                      </button>
                    ) : (
                      <span className="text-[10px] text-indigo-700 font-semibold block text-center mt-2">
                        ✓ Received at {new Date(dressRecord.receivedAt).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Station Context Banner */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-slate-900 block">Active Operating Desk</span>
                  <span className="text-slate-500">
                    {STATIONS_LIST.find((s) => s.id === activeStation)?.nameEn}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setScannedStudent(null);
                    setScanInput('');
                  }}
                  className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl font-bold cursor-pointer transition-colors"
                >
                  Clear Attendee Card
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-3xl p-12 border border-slate-200 shadow-xs text-center space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <QrCode className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-slate-900">
                  Ready to Verify Attendees
                </h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Scan an attendee&apos;s physical card or digital ticket QR code using the camera, upload a photo, or click one of the quick demo buttons on the left.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

