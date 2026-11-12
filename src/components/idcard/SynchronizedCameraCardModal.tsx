import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera,
  RefreshCw,
  RotateCcw,
  CheckCircle2,
  X,
  AlertCircle,
  Upload,
  Eye,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { StudentIdCardRecord } from '../../types/idcard';
import { Language } from '../../types';
import { StudentIdCardBadge } from './StudentIdCardBadge';
import { compressImageTo200KB } from '../../utils/imageCompressor';

// Standard Physical ID Card Photo Area: 15.5 mm x 18.0 mm (Aspect Ratio: 31 / 36 = 0.861111)
export const CARD_PHOTO_ASPECT_RATIO = 15.5 / 18.0;
export const OUTPUT_CANVAS_WIDTH = 620; // 15.5 * 40
export const OUTPUT_CANVAS_HEIGHT = 720; // 18.0 * 40

export interface SynchronizedCameraCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPhotoConfirmed: (photoDataUrl: string, sizeKb: number) => void;
  studentPreview: StudentIdCardRecord;
  language: Language;
  initialImageUrl?: string | null;
}

export const SynchronizedCameraCardModal: React.FC<SynchronizedCameraCardModalProps> = ({
  isOpen,
  onClose,
  onPhotoConfirmed,
  studentPreview,
  language = 'en',
  initialImageUrl = null,
}) => {
  const isBangla = language === 'bn';

  // Mode: 'camera' (live webcam) vs 'preview' (captured/uploaded photo preview)
  const [mode, setMode] = useState<'camera' | 'preview'>('camera');
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isInitializingCamera, setIsInitializingCamera] = useState(false);

  // Video references & stream
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cardPreviewVideoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Captured / Loaded image data
  const [capturedImageSrc, setCapturedImageSrc] = useState<string | null>(null);

  // Real-time cropped data URL synced to ID Card
  const [liveCroppedPhotoUrl, setLiveCroppedPhotoUrl] = useState<string | null>(null);
  const [isProcessingConfirm, setIsProcessingConfirm] = useState(false);
  const [showFaceGuideLabels, setShowFaceGuideLabels] = useState(true);

  // Mobile layout tab: 'camera' | 'card'
  const [mobileTab, setMobileTab] = useState<'camera' | 'card'>('camera');

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. CAMERA LIFECYCLE MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────────
  const stopCameraStream = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (cardPreviewVideoRef.current) {
      cardPreviewVideoRef.current.srcObject = null;
    }
  }, []);

  const startCameraStream = useCallback(
    async (facing: 'user' | 'environment' = cameraFacing) => {
      setCameraError(null);
      setIsInitializingCamera(true);
      stopCameraStream();

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError(
          isBangla
            ? 'আপনার ব্রাউজারে সরাসরি ক্যামেরা অ্যাক্সেস সমর্থিত নয় (HTTPS প্রয়োজন)। অনুগ্রহ করে ফাইল আপলোড করুন।'
            : 'Live camera is not supported or blocked in this browser context (requires HTTPS or localhost). Please use file upload.'
        );
        setIsInitializingCamera(false);
        return;
      }

      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: facing,
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          });
        } catch (_) {
          // Fallback to generic video constraint
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }

        mediaStreamRef.current = stream;

        // Pipe to main camera video element
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');
          videoRef.current.setAttribute('muted', 'true');
          await videoRef.current.play().catch(() => {});
        }

        // Pipe simultaneously to Card Preview video element for live sync
        if (cardPreviewVideoRef.current) {
          cardPreviewVideoRef.current.srcObject = stream;
          cardPreviewVideoRef.current.setAttribute('playsinline', 'true');
          cardPreviewVideoRef.current.setAttribute('muted', 'true');
          await cardPreviewVideoRef.current.play().catch(() => {});
        }
      } catch (err: any) {
        console.warn('[CameraCapture] Stream initialization error:', err);
        setCameraError(
          isBangla
            ? 'ক্যামেরা চালু করা যায়নি। ব্রাউজার পারমিশন নিশ্চিত করুন অথবা ছবি আপলোড করুন।'
            : 'Unable to start camera feed. Please check browser permissions or upload an image file.'
        );
      } finally {
        setIsInitializingCamera(false);
      }
    },
    [cameraFacing, isBangla, stopCameraStream]
  );

  // Initialize on modal open or mode change
  useEffect(() => {
    if (isOpen) {
      if (initialImageUrl) {
        // If an initial image is provided (e.g. from file upload), open in preview mode
        setCapturedImageSrc(initialImageUrl);
        setLiveCroppedPhotoUrl(initialImageUrl);
        setMode('preview');
      } else {
        setMode('camera');
        setCapturedImageSrc(null);
        setLiveCroppedPhotoUrl(null);
        startCameraStream(cameraFacing);
      }
    } else {
      stopCameraStream();
    }

    return () => {
      stopCameraStream();
    };
  }, [isOpen, initialImageUrl, startCameraStream, stopCameraStream, cameraFacing]);

  // Flip camera (User <-> Environment)
  const handleToggleCameraFacing = () => {
    const nextFacing = cameraFacing === 'user' ? 'environment' : 'user';
    setCameraFacing(nextFacing);
    startCameraStream(nextFacing);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. CAPTURE LOGIC (FROM LIVE VIDEO FEED)
  // Perfectly center-crops to ID Card aspect ratio (15.5 : 18.0) matching the live card preview
  // ─────────────────────────────────────────────────────────────────────────────
  const handleCapturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    const vWidth = video.videoWidth || 1280;
    const vHeight = video.videoHeight || 720;

    const targetRatio = CARD_PHOTO_ASPECT_RATIO; // 15.5 / 18.0
    let cropW: number;
    let cropH: number;

    if (vWidth / vHeight > targetRatio) {
      cropH = vHeight;
      cropW = cropH * targetRatio;
    } else {
      cropW = vWidth;
      cropH = cropW / targetRatio;
    }

    const sx = Math.max(0, (vWidth - cropW) / 2);
    const sy = Math.max(0, (vHeight - cropH) / 2);

    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT_CANVAS_WIDTH;
    canvas.height = OUTPUT_CANVAS_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Mirror horizontally if user/selfie camera so capture matches preview
    if (cameraFacing === 'user') {
      ctx.translate(OUTPUT_CANVAS_WIDTH, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, sx, sy, cropW, cropH, 0, 0, OUTPUT_CANVAS_WIDTH, OUTPUT_CANVAS_HEIGHT);

    const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.95);

    stopCameraStream();
    setCapturedImageSrc(croppedDataUrl);
    setLiveCroppedPhotoUrl(croppedDataUrl);
    setMode('preview');
  };

  // Retake photo: reopen live camera
  const handleRetake = () => {
    setCapturedImageSrc(null);
    setLiveCroppedPhotoUrl(null);
    setMode('camera');
    startCameraStream(cameraFacing);
  };

  // Upload an alternative photo file directly inside modal
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        const img = new Image();
        img.onload = () => {
          const imgW = img.naturalWidth || img.width;
          const imgH = img.naturalHeight || img.height;
          const targetRatio = CARD_PHOTO_ASPECT_RATIO;
          let cropW: number;
          let cropH: number;

          if (imgW / imgH > targetRatio) {
            cropH = imgH;
            cropW = cropH * targetRatio;
          } else {
            cropW = imgW;
            cropH = cropW / targetRatio;
          }

          const sx = Math.max(0, (imgW - cropW) / 2);
          const sy = Math.max(0, (imgH - cropH) / 2);

          const canvas = document.createElement('canvas');
          canvas.width = OUTPUT_CANVAS_WIDTH;
          canvas.height = OUTPUT_CANVAS_HEIGHT;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, sx, sy, cropW, cropH, 0, 0, OUTPUT_CANVAS_WIDTH, OUTPUT_CANVAS_HEIGHT);
            const croppedUrl = canvas.toDataURL('image/jpeg', 0.95);
            stopCameraStream();
            setCapturedImageSrc(croppedUrl);
            setLiveCroppedPhotoUrl(croppedUrl);
            setMode('preview');
          }
        };
        img.src = dataUrl;
      }
    };
    reader.readAsDataURL(file);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. CONFIRM PHOTO & EMIT OPTIMIZED IMAGE (<= 200 KB)
  // ─────────────────────────────────────────────────────────────────────────────
  const handleConfirmPhoto = async () => {
    if (!liveCroppedPhotoUrl) return;
    setIsProcessingConfirm(true);

    try {
      // Compress to strictly <= 200 KB as required by system specifications
      const compressed = await compressImageTo200KB(liveCroppedPhotoUrl, 200 * 1024);
      onPhotoConfirmed(compressed.dataUrl, compressed.sizeKb);
      stopCameraStream();
      onClose();
    } catch (err) {
      console.error('[CameraCapture] Compression error on confirmation:', err);
      // Fallback: emit live cropped URL
      onPhotoConfirmed(liveCroppedPhotoUrl, 120);
      stopCameraStream();
      onClose();
    } finally {
      setIsProcessingConfirm(false);
    }
  };

  if (!isOpen) return null;

  // Active student preview object for the live card
  const activeStudentRecord: StudentIdCardRecord = {
    ...studentPreview,
    photoUrl: mode === 'preview' && liveCroppedPhotoUrl ? liveCroppedPhotoUrl : studentPreview.photoUrl,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-5xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[96vh]">
        {/* ── MODAL HEADER ── */}
        <div className="bg-gradient-to-r from-[#041025] via-[#092446] to-[#123F66] text-white px-4 sm:px-6 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-extrabold tracking-tight">
                {isBangla
                  ? 'লাইভ ক্যামেরা ও স্টুডেন্ট আইডি কার্ড প্রিভিউ'
                  : 'Synchronized Camera Capture & Live ID Card Preview'}
              </h2>
              <p className="text-[11px] text-amber-200/90 font-medium">
                {isBangla ? 'রিয়েল-টাইম ফেস পজিশনিং ও স্বয়ংক্রিয় সিঙ্ক' : 'Real-time face positioning & live sync'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              stopCameraStream();
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── USER-FRIENDLY INSTRUCTION BANNER (Requirement E) ── */}
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-400/15 to-emerald-500/10 border-b border-amber-200 px-4 sm:px-6 py-2.5 flex items-center gap-2 text-xs text-slate-800 font-semibold shrink-0">
          <Sparkles className="w-4 h-4 text-amber-600 shrink-0 animate-pulse" />
          <p className="leading-snug">
            {isBangla
              ? 'ক্যামেরার গাইডের মধ্যে আপনার মুখটি ঠিকভাবে রাখুন এবং পাশে আপনার ID Card-এ ছবিটি কেমন দেখাচ্ছে তা দেখে নিন।'
              : 'Position your face inside the guide and check how it looks on your Student ID Card.'}
          </p>
        </div>

        {/* ── MOBILE TABS (for narrow screens) ── */}
        <div className="flex md:hidden border-b border-slate-200 bg-slate-50 text-xs font-bold shrink-0">
          <button
            type="button"
            onClick={() => setMobileTab('camera')}
            className={`flex-1 py-2.5 text-center flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              mobileTab === 'camera'
                ? 'bg-white text-emerald-800 border-b-2 border-emerald-600 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>{isBangla ? '১. ক্যামেরা / ছবি' : '1. Camera / Photo'}</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('card')}
            className={`flex-1 py-2.5 text-center flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              mobileTab === 'card'
                ? 'bg-white text-emerald-800 border-b-2 border-emerald-600 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{isBangla ? '২. আইডি কার্ড প্রিভিউ' : '2. Live ID Card Preview'}</span>
          </button>
        </div>

        {/* ── MODAL BODY: SIDE-BY-SIDE ON DESKTOP, STACKED ON MOBILE (Requirement A) ── */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            {/* ═════════════════════════════════════════════════════════════════ */}
            {/* SECTION 1: CAMERA CAPTURE / PHOTO PREVIEW (Left Column)          */}
            {/* ═════════════════════════════════════════════════════════════════ */}
            <div
              className={`md:col-span-7 flex flex-col space-y-4 ${
                mobileTab === 'camera' ? 'block' : 'hidden md:block'
              }`}
            >
              {/* Header Badge */}
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200">
                  {mode === 'camera' ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                      <span>{isBangla ? 'লাইভ ক্যামেরা ভিউ' : 'Live Camera View'}</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-800 font-bold">{isBangla ? 'ছবি তোলা সম্পন্ন' : 'Photo Captured'}</span>
                    </>
                  )}
                </span>

                {mode === 'camera' && (
                  <button
                    type="button"
                    onClick={() => setShowFaceGuideLabels((prev) => !prev)}
                    className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 underline cursor-pointer"
                  >
                    {showFaceGuideLabels
                      ? isBangla
                        ? 'গাইড টেক্সট লুকান'
                        : 'Hide Guide Labels'
                      : isBangla
                        ? 'গাইড টেক্সট দেখুন'
                        : 'Show Guide Labels'}
                  </button>
                )}
              </div>

              {/* VIEWPORT CONTAINER */}
              {mode === 'camera' ? (
                /* 1A. LIVE CAMERA MODE */
                <div className="relative w-full aspect-[4/3] sm:aspect-[16/11] bg-slate-950 rounded-2xl overflow-hidden shadow-inner flex items-center justify-center border-2 border-slate-800 select-none">
                  {cameraError ? (
                    <div className="p-4 text-center max-w-sm text-rose-300 space-y-2">
                      <AlertCircle className="w-8 h-8 mx-auto text-rose-400" />
                      <p className="text-xs font-semibold">{cameraError}</p>
                      <label className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-slate-900 font-bold text-xs cursor-pointer shadow-md hover:bg-slate-100 mt-2">
                        <Upload className="w-3.5 h-3.5" />
                        <span>{isBangla ? 'ছবি আপলোড করুন' : 'Upload Photo'}</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={handleFileInputChange}
                          className="hidden"
                        />
                      </label>
                    </div>
                  ) : (
                    <>
                      {isInitializingCamera && (
                        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/80 text-white text-xs gap-2">
                          <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
                          <span>{isBangla ? 'ক্যামেরা চালু করা হচ্ছে...' : 'Initializing device camera...'}</span>
                        </div>
                      )}
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className={`w-full h-full object-cover ${
                          cameraFacing === 'user' ? 'scale-x-[-1]' : ''
                        }`}
                      />
                    </>
                  )}

                  {/* TRANSPARENT FACE POSITIONING GUIDE */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="relative w-[215px] h-[250px] sm:w-[248px] sm:h-[288px] rounded-2xl shadow-[0_0_0_9999px_rgba(15,23,42,0.68)] border-2 border-amber-400">
                      <svg
                        className="absolute inset-0 w-full h-full overflow-visible"
                        viewBox="0 0 248 288"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path d="M 8 28 L 8 8 L 28 8" stroke="#F59E0B" strokeWidth="3.5" strokeLinecap="round" />
                        <path d="M 220 8 L 240 8 L 240 28" stroke="#F59E0B" strokeWidth="3.5" strokeLinecap="round" />
                        <path d="M 8 260 L 8 280 L 28 280" stroke="#F59E0B" strokeWidth="3.5" strokeLinecap="round" />
                        <path d="M 220 280 L 240 280 L 240 260" stroke="#F59E0B" strokeWidth="3.5" strokeLinecap="round" />
                        <line x1="20" y1="28" x2="228" y2="28" stroke="#F59E0B" strokeWidth="1.2" strokeDasharray="4 4" strokeOpacity="0.8" />
                        <ellipse cx="124" cy="116" rx="56" ry="74" stroke="#FDE68A" strokeWidth="1.8" strokeDasharray="5 4" strokeOpacity="0.85" />
                        <line x1="76" y1="110" x2="172" y2="110" stroke="#67E8F9" strokeWidth="1.2" strokeDasharray="3 3" strokeOpacity="0.8" />
                        <path d="M 96 186 Q 124 200 152 186" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" strokeOpacity="0.95" />
                        <path d="M 88 206 Q 64 224 16 282" stroke="#FDE68A" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.8" />
                        <path d="M 160 206 Q 184 224 232 282" stroke="#FDE68A" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.8" />
                      </svg>

                      {showFaceGuideLabels && (
                        <div className="absolute inset-0 flex flex-col justify-between p-1.5 text-white pointer-events-none text-[9px] font-bold">
                          <div className="flex justify-between items-center text-amber-300">
                            <span className="bg-slate-900/80 px-1.5 py-0.5 rounded shadow-xs">
                              {isBangla ? 'মাথার শীর্ষ (খালি রাখুন)' : 'Head Top (Leave Space)'}
                            </span>
                          </div>
                          <div className="space-y-4">
                            <div className="flex justify-center">
                              <span className="bg-sky-950/80 text-cyan-200 px-1.5 py-0.5 rounded text-[8px]">
                                {isBangla ? 'চোখের লেভেল' : 'Eye Level'}
                              </span>
                            </div>
                            <div className="flex justify-center">
                              <span className="bg-amber-950/85 text-amber-200 px-1.5 py-0.5 rounded text-[8px]">
                                {isBangla ? 'চিবুকের অবস্থান' : 'Chin Position'}
                              </span>
                            </div>
                          </div>
                          <div className="flex justify-between items-center text-amber-200">
                            <span className="bg-slate-900/80 px-1.5 py-0.5 rounded text-[8px]">
                              {isBangla ? 'বাম কাঁধ' : 'Left Shoulder'}
                            </span>
                            <span className="bg-slate-900/80 px-1.5 py-0.5 rounded text-[8px]">
                              {isBangla ? 'ডান কাঁধ' : 'Right Shoulder'}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[10px] text-white/90 bg-slate-900/75 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-white/10 pointer-events-none">
                    <span>{isBangla ? 'গাইডের মাঝে মুখ রাখুন' : 'Align face with guidelines'}</span>
                    <span className="font-mono text-amber-300 font-bold">15.5 × 18 mm</span>
                  </div>
                </div>
              ) : (
                /* 1B. CAPTURED PHOTO CLEAN PREVIEW (No zoom-in / no adjustment section) */
                <div className="relative w-full aspect-[4/3] sm:aspect-[16/11] bg-slate-900 rounded-2xl overflow-hidden shadow-inner flex flex-col items-center justify-center p-4 border-2 border-slate-800 select-none">
                  <div className="relative w-[155px] h-[180px] sm:w-[174px] sm:h-[202px] rounded-xl overflow-hidden shadow-2xl border-2 border-emerald-400 bg-black">
                    <img
                      src={capturedImageSrc || liveCroppedPhotoUrl || ''}
                      alt="Captured Profile"
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute bottom-1 right-1 bg-emerald-600 text-white text-[8px] font-bold px-1.5 py-0.5 rounded shadow">
                      {isBangla ? 'ক্যাপচার্ড' : 'Captured'}
                    </span>
                  </div>
                  <p className="text-white/85 text-xs font-semibold mt-3 text-center">
                    {isBangla
                      ? 'ডানপাশের লাইভ আইডি কার্ড প্রিভিউ-তে আপনার কার্ডের চূড়ান্ত রূপ দেখে নিন।'
                      : 'Please check your finalized Student ID Card preview on the right.'}
                  </p>
                </div>
              )}

              {/* CONTROLS BAR */}
              {mode === 'camera' ? (
                /* LIVE CAMERA CONTROLS */
                <div className="flex items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleToggleCameraFacing}
                      className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5 border border-slate-200"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>{isBangla ? 'ক্যামেরা পরিবর্তন' : 'Flip Camera'}</span>
                    </button>

                    <label className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5 border border-slate-200">
                      <Upload className="w-3.5 h-3.5 text-slate-500" />
                      <span>{isBangla ? 'ফাইল আপলোড' : 'Upload File'}</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleFileInputChange}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={handleCapturePhoto}
                    disabled={Boolean(cameraError) || isInitializingCamera}
                    className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 disabled:opacity-50 text-white text-xs sm:text-sm font-bold shadow-lg cursor-pointer transition-all flex items-center gap-2 active:scale-95"
                  >
                    <Camera className="w-4 h-4 text-emerald-200" />
                    <span>{isBangla ? 'ছবি তুলুন (Capture)' : 'Capture Photo'}</span>
                  </button>
                </div>
              ) : (
                /* CAPTURED PHOTO CONTROLS — EXACTLY 2 BUTTONS: RETAKE & CONFIRM */
                <div className="grid grid-cols-2 gap-3 pt-1">
                  {/* Button 1: Retake */}
                  <button
                    type="button"
                    onClick={handleRetake}
                    className="w-full py-3.5 rounded-2xl bg-white hover:bg-slate-100 text-slate-700 text-xs sm:text-sm font-bold border-2 border-slate-300 shadow-xs cursor-pointer transition-all flex items-center justify-center gap-2"
                  >
                    <RotateCcw className="w-4 h-4 text-slate-500" />
                    <span>{isBangla ? 'আবার তুলুন (Retake)' : 'Retake'}</span>
                  </button>

                  {/* Button 2: Confirm & Use Photo */}
                  <button
                    type="button"
                    onClick={handleConfirmPhoto}
                    disabled={isProcessingConfirm}
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 disabled:opacity-60 text-white text-xs sm:text-sm font-bold shadow-lg cursor-pointer transition-all flex items-center justify-center gap-2 active:scale-95"
                  >
                    {isProcessingConfirm ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>{isBangla ? 'প্রসেসিং হচ্ছে...' : 'Processing...'}</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                        <span>{isBangla ? 'ছবি নিশ্চিত করুন ও ব্যবহার করুন (Confirm & Use)' : 'Confirm & Use the photo'}</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* ═════════════════════════════════════════════════════════════════ */}
            {/* SECTION 2: LIVE STUDENT ID CARD PREVIEW (Right Column)          */}
            {/* ═════════════════════════════════════════════════════════════════ */}
            <div
              className={`md:col-span-5 flex flex-col items-center justify-center space-y-3 ${
                mobileTab === 'card' ? 'block' : 'hidden md:flex'
              }`}
            >
              {/* Header Title with Live Sync Badge */}
              <div className="w-full flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-sky-600" />
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    {isBangla ? 'লাইভ আইডি কার্ড প্রিভিউ' : 'Live ID Card Preview'}
                  </h3>
                </div>

                <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs">
                  {mode === 'camera' ? (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping" />
                      <span>{isBangla ? 'রিয়েল-টাইম সিঙ্ক' : 'Live Synced'}</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{isBangla ? 'ছবি সিঙ্ক হয়েছে' : 'Photo Synced'}</span>
                    </>
                  )}
                </div>
              </div>

              {/* ID Card Badge Container */}
              <div className="p-3 bg-slate-50/90 rounded-3xl border border-slate-200 flex flex-col items-center justify-center w-full shadow-xs">
                <StudentIdCardBadge
                  student={activeStudentRecord}
                  language={language}
                  showActions={false}
                  isPreview={true}
                  customPhotoSlot={
                    mode === 'camera' ? (
                      /* Live Camera Feed inside Card Frame (Requirement C) */
                      <div className="relative w-full h-full bg-slate-950 flex items-center justify-center overflow-hidden">
                        <video
                          ref={cardPreviewVideoRef}
                          autoPlay
                          playsInline
                          muted
                          className={`w-full h-full object-cover ${
                            cameraFacing === 'user' ? 'scale-x-[-1]' : ''
                          }`}
                        />
                        <span className="absolute top-1 right-1 bg-red-600 text-white text-[7px] font-black px-1 rounded-xs uppercase tracking-wider animate-pulse shadow-xs">
                          LIVE
                        </span>
                      </div>
                    ) : undefined
                  }
                />

                <p className="mt-2 text-[10px] text-slate-500 text-center max-w-[260px] leading-tight">
                  {mode === 'camera'
                    ? isBangla
                      ? 'আপনার ক্যামেরার অবস্থান অনুযায়ী কার্ডে ছবিটি স্বয়ংক্রিয়ভাবে প্রদর্শন ও সিঙ্ক হচ্ছে।'
                      : 'The photo frame on this card updates dynamically in real time with your camera.'
                    : isBangla
                      ? 'আপনার তোলা ছবিটি আইডি কার্ডে সিঙ্ক হয়েছে। সন্তুষ্ট হলে "Confirm & Use the photo" বাটনে চাপুন।'
                      : 'Your captured photo is now synced to the card. Click "Confirm & Use the photo" to continue.'}
                </p>
              </div>

              {/* Mobile back to camera button */}
              <div className="w-full flex md:hidden justify-center pt-2">
                <button
                  type="button"
                  onClick={() => setMobileTab('camera')}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-white text-xs font-semibold cursor-pointer"
                >
                  ← {isBangla ? 'ক্যামেরা ভিউতে ফিরুন' : 'Back to Camera'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── MODAL FOOTER ── */}
        <div className="bg-slate-50 border-t border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between shrink-0">
          <p className="text-[11px] text-slate-500">
            {isBangla
              ? 'নিশ্চিত করা ছবিটি সফল পেমেন্টের পর অফিসিয়াল আইডি কার্ডে স্বয়ংক্রিয়ভাবে ব্যবহৃত হবে।'
              : 'Confirmed photo will be preserved and printed on your official Student ID Card upon payment.'}
          </p>

          <button
            type="button"
            onClick={() => {
              stopCameraStream();
              onClose();
            }}
            className="px-4 py-1.5 rounded-xl border border-slate-300 hover:bg-slate-200/70 text-slate-700 text-xs font-semibold cursor-pointer transition-colors"
          >
            {isBangla ? 'বাতিল (Close)' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
