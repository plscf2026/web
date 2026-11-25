import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, X, AlertTriangle, QrCode, Flashlight } from 'lucide-react';
import {
  startResilientCameraStream,
  startLiveQRScanner,
  stopCameraStream,
  setCameraTorch,
  isTorchSupported,
  ScannerStopFn,
} from '../../utils/qrDecoder';

interface QrCameraScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
  language?: 'en' | 'bn';
  title?: string;
  themeColor?: 'amber' | 'emerald' | 'sky';
  paused?: boolean;
}

export const QrCameraScanner: React.FC<QrCameraScannerProps> = ({
  onScan,
  onClose,
  language = 'en',
  title,
  themeColor = 'amber',
  paused = false,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scannerRef = useRef<ScannerStopFn | null>(null);

  const [preferRear, setPreferRear] = useState(true);
  const [isInitializing, setIsInitializing] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isDetectedSuccess, setIsDetectedSuccess] = useState(false);
  const [isTorchAvailable, setIsTorchAvailable] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [isHardwareEngine, setIsHardwareEngine] = useState(false);

  // Keep callback and scan state in stable refs so parent re-renders never tear down or restart the camera stream
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const lastScannedRef = useRef<string | null>(null);
  const lastScannedTimeRef = useRef<number>(0);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync paused state into scanner controller without restarting stream
  useEffect(() => {
    if (scannerRef.current) {
      scannerRef.current.setPaused(Boolean(paused));
    }
  }, [paused]);

  const themeBorderColor =
    themeColor === 'emerald'
      ? 'border-emerald-400'
      : themeColor === 'sky'
      ? 'border-sky-400'
      : 'border-amber-400';

  const themeLaserColor =
    themeColor === 'emerald'
      ? 'via-emerald-400 shadow-[0_0_12px_#34d399]'
      : themeColor === 'sky'
      ? 'via-sky-400 shadow-[0_0_12px_#38bdf8]'
      : 'via-amber-400 shadow-[0_0_12px_#fbbf24]';

  // Toggle Hardware Flashlight (Torch)
  const handleToggleTorch = async () => {
    const nextState = !isTorchOn;
    setIsTorchOn(nextState);
    if (streamRef.current) {
      try {
        await setCameraTorch(streamRef.current, nextState);
      } catch (err) {
        console.warn('[Flashlight] Hardware torch warning:', err);
      }
    }
  };

  // Master camera stream lifecycle: strictly depends on hardware facing mode (preferRear)
  useEffect(() => {
    let stream: MediaStream | null = null;
    let stopScanner: ScannerStopFn | null = null;
    let isCancelled = false;

    setIsInitializing(true);
    setCameraError(null);
    setIsTorchOn(false);

    startResilientCameraStream(preferRear)
      .then((res) => {
        if (isCancelled) {
          if (res.stream) stopCameraStream(res.stream);
          return;
        }

        setIsInitializing(false);

        if (res.error) {
          setCameraError(res.error);
          return;
        }

        if (res.stream && videoRef.current) {
          stream = res.stream;
          streamRef.current = res.stream;
          setIsTorchAvailable(Boolean(res.torchSupported || isTorchSupported(res.stream)));

          videoRef.current.srcObject = res.stream;
          videoRef.current.setAttribute('playsinline', 'true');
          videoRef.current.setAttribute('webkit-playsinline', 'true');
          videoRef.current.setAttribute('muted', 'true');

          videoRef.current
            .play()
            .then(() => {
              if (videoRef.current && !isCancelled) {
                // Initialize thermally-regulated live scanner with frame lock & ROI cropping
                stopScanner = startLiveQRScanner(
                  videoRef.current,
                  (code) => {
                    const now = Date.now();
                    const cleanCode = code ? code.trim() : '';
                    if (!cleanCode) return;

                    // Throttle identical scans to prevent rapid re-triggering (2.2s debounce)
                    if (
                      cleanCode === lastScannedRef.current &&
                      now - lastScannedTimeRef.current < 2200
                    ) {
                      return;
                    }

                    lastScannedRef.current = cleanCode;
                    lastScannedTimeRef.current = now;

                    // Gentle haptic feedback on successful scan
                    if (typeof navigator !== 'undefined' && navigator.vibrate) {
                      try {
                        navigator.vibrate(40);
                      } catch (_) {}
                    }

                    // Trigger non-intrusive green glow feedback without shifting layout
                    setIsDetectedSuccess(true);
                    if (successTimeoutRef.current) {
                      clearTimeout(successTimeoutRef.current);
                    }
                    successTimeoutRef.current = setTimeout(() => {
                      setIsDetectedSuccess(false);
                    }, 650);

                    // Execute latest onScan handler safely
                    if (onScanRef.current) {
                      onScanRef.current(cleanCode);
                    }
                  },
                  {
                    intervalMs: 180,
                    paused: Boolean(paused),
                    roiCropRatio: 0.65,
                  }
                );

                scannerRef.current = stopScanner;
                setIsHardwareEngine(stopScanner.isNativeSupported());
              }
            })
            .catch((e) => {
              console.warn('Video playback warning:', e);
            });
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          setIsInitializing(false);
          setCameraError(err?.message || 'Unable to access camera.');
        }
      });

    return () => {
      isCancelled = true;
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
      if (stopScanner) stopScanner();
      scannerRef.current = null;
      if (stream) {
        stopCameraStream(stream);
      }
      streamRef.current = null;
      setIsTorchOn(false);
    };
  }, [preferRear]);

  const handleToggleFacing = () => {
    // If torch is on, turn off before switching facing mode
    if (isTorchOn && streamRef.current) {
      setCameraTorch(streamRef.current, false).catch(() => {});
      setIsTorchOn(false);
    }
    setPreferRear((prev) => !prev);
  };

  return (
    <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-2xl select-none">
      {/* Sleek Top Floating Controls Bar */}
      <div className="absolute top-3 inset-x-3 z-20 flex items-center justify-between pointer-events-auto">
        {/* Left: Compact Camera Label */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-white text-xs font-medium shadow-sm">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>{title || (language === 'bn' ? 'কিউআর স্ক্যানার' : 'QR Scanner')}</span>
          {isHardwareEngine && (
            <span className="hidden sm:inline text-[9px] font-bold uppercase text-emerald-400/90 ml-0.5">
              • GPU
            </span>
          )}
        </div>

        {/* Right: Sleek Circular Action Buttons (Flash, Flip, Close) */}
        <div className="flex items-center gap-1.5">
          {/* 1. Hardware Flashlight (Torch) Toggle */}
          {isTorchAvailable && (
            <button
              type="button"
              onClick={handleToggleTorch}
              title={
                isTorchOn
                  ? language === 'bn'
                    ? 'ফ্ল্যাশ লাইট বন্ধ করুন (Flash OFF)'
                    : 'Turn Flashlight OFF'
                  : language === 'bn'
                  ? 'ফ্ল্যাশ লাইট চালু করুন (Flash ON)'
                  : 'Turn Flashlight ON'
              }
              aria-label={isTorchOn ? 'Flashlight OFF' : 'Flashlight ON'}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer backdrop-blur-md ${
                isTorchOn
                  ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.5)]'
                  : 'bg-black/50 hover:bg-black/70 text-white/80 hover:text-white border border-white/15'
              }`}
            >
              <Flashlight className={`w-4 h-4 ${isTorchOn ? 'fill-current' : ''}`} />
            </button>
          )}

          {/* 2. Switch Camera Button (Front / Rear) */}
          <button
            type="button"
            onClick={handleToggleFacing}
            title={language === 'bn' ? 'ক্যামেরা পরিবর্তন করুন' : 'Switch Camera'}
            aria-label="Switch Camera"
            className="w-9 h-9 rounded-full flex items-center justify-center bg-black/50 hover:bg-black/70 text-white/80 hover:text-white border border-white/15 backdrop-blur-md transition-all cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* 3. Close Camera Button */}
          <button
            type="button"
            onClick={onClose}
            title={language === 'bn' ? 'ক্যামেরা বন্ধ করুন' : 'Close Camera'}
            aria-label="Close Camera"
            className="w-9 h-9 rounded-full flex items-center justify-center bg-black/50 hover:bg-rose-950/80 text-white/80 hover:text-rose-200 border border-white/15 backdrop-blur-md transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Viewport Container */}
      <div className="relative w-full aspect-square max-h-[380px] sm:max-h-[440px] flex items-center justify-center overflow-hidden isolate select-none bg-black">
        {/* Loading Spinner */}
        {isInitializing && (
          <div className="z-10 flex flex-col items-center justify-center gap-3 text-white text-xs font-mono p-4 text-center">
            <div className="w-8 h-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
            <span className="text-slate-300">
              {language === 'bn' ? 'ক্যামেরা চালু করা হচ্ছে...' : 'Initializing camera...'}
            </span>
          </div>
        )}

        {/* Camera Error Message */}
        {cameraError ? (
          <div className="z-10 p-6 text-center space-y-3 max-w-sm mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-white">
              {language === 'bn' ? 'ক্যামেরা সংযোগ পাওয়া যায়নি' : 'Camera Unavailable'}
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">{cameraError}</p>

            <div className="pt-2">
              <span className="text-xs text-amber-300 font-medium">
                {language === 'bn'
                  ? 'নিচে রেজিস্ট্রেশন আইডি এবং কিউআর টোকেন দিয়ে ম্যানুয়াল যাচাই করুন।'
                  : 'Please use the manual Registration ID & QR Token verification below.'}
              </span>
            </div>
          </div>
        ) : (
          <>
            {/* Live Camera Video Feed */}
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
              style={{
                transform: 'translateZ(0)',
                WebkitTransform: 'translateZ(0)',
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
              }}
              autoPlay
              playsInline
              muted
            />

            {/* Darkened Vignette Overlay (Stays clean & natural) */}
            <div className="absolute inset-0 bg-slate-950/35 pointer-events-none" />

            {/* Modern Reticle Target Box with Dark Outer Mask */}
            <div
              className={`relative z-10 w-60 h-60 sm:w-68 sm:h-68 rounded-2xl pointer-events-none shadow-[0_0_0_9999px_rgba(15,23,42,0.6)] transition-all duration-200 ${
                isDetectedSuccess
                  ? 'ring-2 ring-emerald-400 bg-emerald-500/10'
                  : paused
                  ? 'ring-2 ring-amber-400/60 bg-amber-500/5'
                  : 'ring-1 ring-white/15 bg-transparent'
              }`}
              style={{ boxSizing: 'border-box' }}
            >
              {/* Corner 1: Top-Left */}
              <div
                className={`absolute -top-0.5 -left-0.5 w-7 h-7 border-t-3 border-l-3 rounded-tl-xl transition-colors duration-200 ${
                  isDetectedSuccess
                    ? 'border-emerald-400'
                    : paused
                    ? 'border-amber-400'
                    : themeBorderColor
                }`}
              />
              {/* Corner 2: Top-Right */}
              <div
                className={`absolute -top-0.5 -right-0.5 w-7 h-7 border-t-3 border-r-3 rounded-tr-xl transition-colors duration-200 ${
                  isDetectedSuccess
                    ? 'border-emerald-400'
                    : paused
                    ? 'border-amber-400'
                    : themeBorderColor
                }`}
              />
              {/* Corner 3: Bottom-Left */}
              <div
                className={`absolute -bottom-0.5 -left-0.5 w-7 h-7 border-b-3 border-l-3 rounded-bl-xl transition-colors duration-200 ${
                  isDetectedSuccess
                    ? 'border-emerald-400'
                    : paused
                    ? 'border-amber-400'
                    : themeBorderColor
                }`}
              />
              {/* Corner 4: Bottom-Right */}
              <div
                className={`absolute -bottom-0.5 -right-0.5 w-7 h-7 border-b-3 border-r-3 rounded-br-xl transition-colors duration-200 ${
                  isDetectedSuccess
                    ? 'border-emerald-400'
                    : paused
                    ? 'border-amber-400'
                    : themeBorderColor
                }`}
              />

              {/* Animated Laser Scanning Line */}
              <div
                className={`absolute top-0 inset-x-2 h-0.5 bg-gradient-to-r from-transparent ${themeLaserColor} to-transparent animate-qr-laser transition-opacity duration-200 ${
                  isDetectedSuccess || paused ? 'opacity-0' : 'opacity-100'
                }`}
              />

              {/* Center Target Crosshair / Watermark */}
              <div className="absolute inset-0 flex items-center justify-center opacity-20">
                <QrCode className="w-14 h-14 text-white" />
              </div>
            </div>

            {/* Bottom Target Alignment Pill */}
            <div className="absolute bottom-3 inset-x-0 z-20 flex justify-center pointer-events-none px-4">
              <span
                className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[11px] font-medium tracking-wide backdrop-blur-md border shadow-md transition-colors duration-200 ${
                  isDetectedSuccess
                    ? 'bg-emerald-500/90 text-white border-emerald-400 shadow-emerald-500/20'
                    : paused
                    ? 'bg-amber-500/90 text-slate-950 border-amber-400 font-bold'
                    : 'bg-black/60 text-slate-300 border-white/10'
                }`}
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>
                  {isDetectedSuccess
                    ? language === 'bn'
                      ? '✓ শনাক্ত হয়েছে'
                      : '✓ Recognized'
                    : paused
                    ? language === 'bn'
                      ? 'যাচাই করা হচ্ছে...'
                      : 'Verifying...'
                    : language === 'bn'
                    ? 'কিউআর কোড স্কয়ার বক্সে সোজা রাখুন'
                    : 'Align QR Code Inside Square Frame'}
                </span>
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
