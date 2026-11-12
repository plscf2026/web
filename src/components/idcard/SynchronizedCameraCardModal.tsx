import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  CheckCircle2,
  X,
  AlertCircle,
  Upload,
  Eye,
  Sparkles,
  Loader2,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
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

  // Mode: 'camera' (live webcam) vs 'adjust' (adjusting captured/uploaded photo)
  const [mode, setMode] = useState<'camera' | 'adjust'>('camera');
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isInitializingCamera, setIsInitializingCamera] = useState(false);

  // Video references & stream
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cardPreviewVideoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Captured / Loaded image data
  const [capturedImageSrc, setCapturedImageSrc] = useState<string | null>(null);
  const loadedImageRef = useRef<HTMLImageElement | null>(null);

  // Unified Adjustment State (Zoom & Pan)
  const [zoom, setZoom] = useState<number>(1.0);
  const [panX, setPanX] = useState<number>(0);
  const [panY, setPanY] = useState<number>(0);

  // Real-time cropped data URL synced to ID Card
  const [liveCroppedPhotoUrl, setLiveCroppedPhotoUrl] = useState<string | null>(null);
  const [isProcessingConfirm, setIsProcessingConfirm] = useState(false);
  const [showFaceGuideLabels, setShowFaceGuideLabels] = useState(true);

  // Mobile layout tab: 'camera' | 'card'
  const [mobileTab, setMobileTab] = useState<'camera' | 'card'>('camera');

  // Drag interaction state
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

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
        // If an initial image is provided (e.g. from file upload), open in adjust mode
        setCapturedImageSrc(initialImageUrl);
        setMode('adjust');
        setZoom(1.0);
        setPanX(0);
        setPanY(0);
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
  // ─────────────────────────────────────────────────────────────────────────────
  const handleCapturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    const vWidth = video.videoWidth || 1280;
    const vHeight = video.videoHeight || 720;

    const canvas = document.createElement('canvas');
    canvas.width = vWidth;
    canvas.height = vHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Mirror horizontally if user/selfie camera so capture matches preview
    if (cameraFacing === 'user') {
      ctx.translate(vWidth, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, vWidth, vHeight);

    const rawDataUrl = canvas.toDataURL('image/jpeg', 0.95);

    stopCameraStream();
    setCapturedImageSrc(rawDataUrl);
    setMode('adjust');
    setZoom(1.0);
    setPanX(0);
    setPanY(0);
  };

  // Retake photo: reopen live camera
  const handleRetake = () => {
    setCapturedImageSrc(null);
    setLiveCroppedPhotoUrl(null);
    setZoom(1.0);
    setPanX(0);
    setPanY(0);
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
        stopCameraStream();
        setCapturedImageSrc(dataUrl);
        setMode('adjust');
        setZoom(1.0);
        setPanX(0);
        setPanY(0);
      }
    };
    reader.readAsDataURL(file);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. UNIFIED PHOTO CROP & REAL-TIME CARD SYNCHRONIZATION
  // Calculates high-fidelity crop strictly matching 15.5 : 18.0 card dimensions
  // ─────────────────────────────────────────────────────────────────────────────
  const updateCroppedPreview = useCallback(
    (img: HTMLImageElement, currentZoom: number, currentPanX: number, currentPanY: number) => {
      const imgW = img.naturalWidth || img.width;
      const imgH = img.naturalHeight || img.height;
      if (!imgW || !imgH) return;

      const targetRatio = CARD_PHOTO_ASPECT_RATIO; // 15.5 / 18.0

      // Base crop dimension inside image (leave 5% safety margin)
      let baseW: number;
      let baseH: number;

      if (imgW / imgH > targetRatio) {
        baseH = imgH * 0.92;
        baseW = baseH * targetRatio;
      } else {
        baseW = imgW * 0.92;
        baseH = baseW / targetRatio;
      }

      // Apply zoom (higher zoom = smaller crop window in source image)
      const cropW = baseW / Math.max(1.0, currentZoom);
      const cropH = baseH / Math.max(1.0, currentZoom);

      // Center coords in source image
      const cx = imgW / 2;
      const cy = imgH / 2;

      // Scale pan offset to image coordinate space
      // Normalized: currentPanX and currentPanY are in screen pixels (-150 to +150)
      const panFactor = (baseW / 250);
      const imgPanX = currentPanX * panFactor;
      const imgPanY = currentPanY * panFactor;

      // Bound clamping to prevent pulling in empty borders
      const minX = cropW / 2;
      const maxX = imgW - cropW / 2;
      const minY = cropH / 2;
      const maxY = imgH - cropH / 2;

      const targetCenterX = Math.max(minX, Math.min(maxX, cx - imgPanX));
      const targetCenterY = Math.max(minY, Math.min(maxY, cy - imgPanY));

      const sx = Math.max(0, targetCenterX - cropW / 2);
      const sy = Math.max(0, targetCenterY - cropH / 2);

      // Render to offscreen canvas
      const canvas = document.createElement('canvas');
      canvas.width = OUTPUT_CANVAS_WIDTH;
      canvas.height = OUTPUT_CANVAS_HEIGHT;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, OUTPUT_CANVAS_WIDTH, OUTPUT_CANVAS_HEIGHT);
      ctx.drawImage(img, sx, sy, cropW, cropH, 0, 0, OUTPUT_CANVAS_WIDTH, OUTPUT_CANVAS_HEIGHT);

      const previewDataUrl = canvas.toDataURL('image/jpeg', 0.9);
      setLiveCroppedPhotoUrl(previewDataUrl);
    },
    []
  );

  // Sync crop whenever captured image, zoom, or pan values change
  useEffect(() => {
    if (mode === 'adjust' && capturedImageSrc) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        loadedImageRef.current = img;
        updateCroppedPreview(img, zoom, panX, panY);
      };
      img.src = capturedImageSrc;
    }
  }, [mode, capturedImageSrc, zoom, panX, panY, updateCroppedPreview]);

  // Mouse & Touch Drag Handlers
  const handlePointerDown = (clientX: number, clientY: number) => {
    isDraggingRef.current = true;
    dragStartRef.current = { x: clientX - panX, y: clientY - panY };
  };

  const handlePointerMove = (clientX: number, clientY: number) => {
    if (!isDraggingRef.current) return;
    const nextPanX = Math.round(clientX - dragStartRef.current.x);
    const nextPanY = Math.round(clientY - dragStartRef.current.y);

    // Limit drag radius based on zoom level
    const maxDrag = Math.round(75 * zoom);
    const clampedX = Math.max(-maxDrag, Math.min(maxDrag, nextPanX));
    const clampedY = Math.max(-maxDrag, Math.min(maxDrag, nextPanY));

    setPanX(clampedX);
    setPanY(clampedY);
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
  };

  // Nudge Pan buttons
  const nudgePan = (dx: number, dy: number) => {
    const maxDrag = Math.round(75 * zoom);
    setPanX((prev) => Math.max(-maxDrag, Math.min(maxDrag, prev + dx)));
    setPanY((prev) => Math.max(-maxDrag, Math.min(maxDrag, prev + dy)));
  };

  const resetAdjustment = () => {
    setZoom(1.0);
    setPanX(0);
    setPanY(0);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. CONFIRM PHOTO & EMIT OPTIMIZED IMAGE (<= 200 KB)
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
    photoUrl: mode === 'adjust' && liveCroppedPhotoUrl ? liveCroppedPhotoUrl : studentPreview.photoUrl,
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
            {/* SECTION 1: CAMERA CAPTURE / PHOTO ADJUSTMENT (Left Column)      */}
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
                      <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                      <span>{isBangla ? 'ফটো পজিশন ও জুম অ্যাডজাস্টমেন্ট' : 'Photo Position & Zoom Adjustment'}</span>
                    </>
                  )}
                </span>

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
              </div>

              {/* VIEWPORT CONTAINER */}
              <div className="relative w-full aspect-[4/3] sm:aspect-[16/11] bg-slate-950 rounded-2xl overflow-hidden shadow-inner flex items-center justify-center border-2 border-slate-800 select-none">
                {/* 1A. LIVE CAMERA MODE */}
                {mode === 'camera' && (
                  <>
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
                  </>
                )}

                {/* 1B. ADJUST MODE (Captured / Loaded photo with Drag & Zoom) */}
                {mode === 'adjust' && capturedImageSrc && (
                  <div
                    className="relative w-full h-full overflow-hidden flex items-center justify-center cursor-move"
                    onMouseDown={(e) => handlePointerDown(e.clientX, e.clientY)}
                    onMouseMove={(e) => handlePointerMove(e.clientX, e.clientY)}
                    onMouseUp={handlePointerUp}
                    onMouseLeave={handlePointerUp}
                    onTouchStart={(e) => {
                      const t = e.touches[0];
                      if (t) handlePointerDown(t.clientX, t.clientY);
                    }}
                    onTouchMove={(e) => {
                      const t = e.touches[0];
                      if (t) handlePointerMove(t.clientX, t.clientY);
                    }}
                    onTouchEnd={handlePointerUp}
                  >
                    <img
                      src={capturedImageSrc}
                      alt="Captured Crop Target"
                      draggable={false}
                      className="max-w-none transition-transform duration-75 ease-out select-none pointer-events-none"
                      style={{
                        transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
                      }}
                    />
                  </div>
                )}

                {/* ═══════════════════════════════════════════════════════════ */}
                {/* 1C. TRANSPARENT FACE POSITIONING GUIDE (Requirement B)       */}
                {/* Proportions strictly match ID Card photo frame: 15.5 : 18.0 */}
                {/* ═══════════════════════════════════════════════════════════ */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  {/* Surrounding Scrim Backdrop */}
                  <div className="relative w-[215px] h-[250px] sm:w-[248px] sm:h-[288px] rounded-2xl shadow-[0_0_0_9999px_rgba(15,23,42,0.68)] border-2 border-amber-400">
                    {/* SVG Anatomical Face Positioning Guides */}
                    <svg
                      className="absolute inset-0 w-full h-full overflow-visible"
                      viewBox="0 0 248 288"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      {/* Corner Accents */}
                      <path d="M 8 28 L 8 8 L 28 8" stroke="#F59E0B" strokeWidth="3.5" strokeLinecap="round" />
                      <path d="M 220 8 L 240 8 L 240 28" stroke="#F59E0B" strokeWidth="3.5" strokeLinecap="round" />
                      <path d="M 8 260 L 8 280 L 28 280" stroke="#F59E0B" strokeWidth="3.5" strokeLinecap="round" />
                      <path d="M 220 280 L 240 280 L 240 260" stroke="#F59E0B" strokeWidth="3.5" strokeLinecap="round" />

                      {/* 1. Headroom Guide (Space above head: ~10% from top) */}
                      <line
                        x1="20"
                        y1="28"
                        x2="228"
                        y2="28"
                        stroke="#F59E0B"
                        strokeWidth="1.2"
                        strokeDasharray="4 4"
                        strokeOpacity="0.8"
                      />

                      {/* 2. Head & Face Oval Guide (Where face should be positioned) */}
                      <ellipse
                        cx="124"
                        cy="116"
                        rx="56"
                        ry="74"
                        stroke="#FDE68A"
                        strokeWidth="1.8"
                        strokeDasharray="5 4"
                        strokeOpacity="0.85"
                      />

                      {/* 3. Eye Level Guideline (~42% from top) */}
                      <line
                        x1="76"
                        y1="110"
                        x2="172"
                        y2="110"
                        stroke="#67E8F9"
                        strokeWidth="1.2"
                        strokeDasharray="3 3"
                        strokeOpacity="0.8"
                      />

                      {/* 4. Chin Guideline Bracket (~70% from top) */}
                      <path
                        d="M 96 186 Q 124 200 152 186"
                        stroke="#F59E0B"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeOpacity="0.95"
                      />

                      {/* 5. Shoulders Guide (How much of shoulders should be visible) */}
                      <path
                        d="M 88 206 Q 64 224 16 282"
                        stroke="#FDE68A"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeOpacity="0.8"
                      />
                      <path
                        d="M 160 206 Q 184 224 232 282"
                        stroke="#FDE68A"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeOpacity="0.8"
                      />
                    </svg>

                    {/* Informative Text Labels (Can be toggled) */}
                    {showFaceGuideLabels && (
                      <div className="absolute inset-0 flex flex-col justify-between p-1.5 text-white pointer-events-none text-[9px] font-bold">
                        {/* Headroom Label */}
                        <div className="flex justify-between items-center text-amber-300">
                          <span className="bg-slate-900/80 px-1.5 py-0.5 rounded shadow-xs">
                            {isBangla ? 'মাথার শীর্ষ (খালি রাখুন)' : 'Head Top (Leave Space)'}
                          </span>
                        </div>

                        {/* Eye & Chin Labels */}
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

                        {/* Shoulders Label */}
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

                {/* Floating Hint Overlay */}
                <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[10px] text-white/90 bg-slate-900/75 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-white/10 pointer-events-none">
                  <span>
                    {mode === 'camera'
                      ? isBangla
                        ? 'গাইডের মাঝে মুখ রাখুন'
                        : 'Align face with guidelines'
                      : isBangla
                        ? 'ছবিটি ড্র্যাগ করে ঠিক স্থানে আনুন'
                        : 'Drag to pan • Use slider to zoom'}
                  </span>
                  <span className="font-mono text-amber-300 font-bold">
                    {mode === 'adjust' ? `${zoom.toFixed(1)}x` : '15.5 × 18 mm'}
                  </span>
                </div>
              </div>

              {/* ═══════════════════════════════════════════════════════════ */}
              {/* CONTROLS BAR: CAMERA OR ADJUSTMENT                           */}
              {/* ═══════════════════════════════════════════════════════════ */}
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
                /* ADJUSTMENT CONTROLS (Requirement D) */
                <div className="space-y-3 bg-slate-50 p-3 sm:p-4 rounded-2xl border border-slate-200">
                  {/* Zoom Slider & Steppers */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                      <span className="flex items-center gap-1">
                        <ZoomIn className="w-3.5 h-3.5 text-amber-600" />
                        <span>{isBangla ? 'জুম স্কেল (Zoom Level)' : 'Zoom Level'}</span>
                      </span>
                      <span className="font-mono text-emerald-800 bg-white px-2 py-0.5 rounded border border-slate-200 text-[11px]">
                        {zoom.toFixed(2)}x
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setZoom((z) => Math.max(1.0, Number((z - 0.1).toFixed(2))))}
                        className="w-7 h-7 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 flex items-center justify-center text-slate-700 cursor-pointer"
                        title="Zoom out"
                      >
                        <ZoomOut className="w-3.5 h-3.5" />
                      </button>

                      <input
                        type="range"
                        min="1.0"
                        max="3.0"
                        step="0.05"
                        value={zoom}
                        onChange={(e) => setZoom(parseFloat(e.target.value))}
                        className="flex-1 accent-emerald-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
                      />

                      <button
                        type="button"
                        onClick={() => setZoom((z) => Math.min(3.0, Number((z + 0.1).toFixed(2))))}
                        className="w-7 h-7 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 flex items-center justify-center text-slate-700 cursor-pointer"
                        title="Zoom in"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={resetAdjustment}
                        className="px-2 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-[11px] font-semibold text-slate-600 cursor-pointer flex items-center gap-1"
                        title="Reset zoom & pan"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>{isBangla ? 'রিসেট' : 'Reset'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Fine Nudge Direction Controls */}
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/80">
                    <span className="text-[11px] text-slate-500 font-medium">
                      {isBangla ? 'পজিশন অ্যাডজাস্ট (Nudge):' : 'Fine Position Nudge:'}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => nudgePan(-8, 0)}
                        className="p-1 rounded bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 cursor-pointer"
                        title="Move left"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => nudgePan(0, -8)}
                        className="p-1 rounded bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 cursor-pointer"
                        title="Move up"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => nudgePan(0, 8)}
                        className="p-1 rounded bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 cursor-pointer"
                        title="Move down"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => nudgePan(8, 0)}
                        className="p-1 rounded bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 cursor-pointer"
                        title="Move right"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Over-zoom / Clipping warning */}
                  {zoom > 2.3 && (
                    <div className="text-[11px] text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 flex items-center gap-1.5 font-medium">
                      <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />
                      <span>
                        {isBangla
                          ? 'সতর্কতা: বেশি জুম করলে মাথার শীর্ষ বা চিবুক ফ্রেমের বাইরে চলে যেতে পারে।'
                          : 'Caution: Excessive zoom may clip the top of head or chin.'}
                      </span>
                    </div>
                  )}

                  {/* Confirm or Retake Actions */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={handleRetake}
                      className="px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold cursor-pointer border border-slate-300 transition-colors flex items-center gap-1.5"
                    >
                      <Camera className="w-3.5 h-3.5 text-slate-500" />
                      <span>{isBangla ? 'আবার তুলুন (Retake)' : 'Retake Photo'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleConfirmPhoto}
                      disabled={isProcessingConfirm}
                      className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs sm:text-sm shadow-md cursor-pointer transition-all flex items-center gap-2 active:scale-95 disabled:opacity-60"
                    >
                      {isProcessingConfirm ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-white" />
                          <span>{isBangla ? 'প্রসেসিং হচ্ছে...' : 'Optimizing Photo...'}</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                          <span>{isBangla ? 'ছবি নিশ্চিত করুন (Confirm)' : 'Confirm & Use Photo'}</span>
                        </>
                      )}
                    </button>
                  </div>
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
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping" />
                  <span>{isBangla ? 'রিয়েল-টাইম সিঙ্ক' : 'Live Synced'}</span>
                </div>
              </div>

              {/* ID Card Badge Container */}
              <div className="p-3 bg-slate-50/90 rounded-3xl border border-slate-200 flex flex-col items-center justify-center w-full shadow-xs">
                <StudentIdCardBadge
                  student={activeStudentRecord}
                  language={language}
                  showActions={false}
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
                  {isBangla
                    ? 'আপনার ক্যামেরার অবস্থান অনুযায়ী কার্ডে ছবিটি স্বয়ংক্রিয়ভাবে প্রদর্শন ও সিঙ্ক হচ্ছে।'
                    : 'The photo frame on this card updates dynamically in real time with your camera and adjustments.'}
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
