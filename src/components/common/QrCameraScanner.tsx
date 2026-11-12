import React, { useState, useEffect, useRef } from 'react';
import { Camera, RefreshCw, X, AlertTriangle, QrCode } from 'lucide-react';
import { startResilientCameraStream, startLiveQRScanner } from '../../utils/qrDecoder';

interface QrCameraScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
  language?: 'en' | 'bn';
  title?: string;
  themeColor?: 'amber' | 'emerald' | 'sky';
}

export const QrCameraScanner: React.FC<QrCameraScannerProps> = ({
  onScan,
  onClose,
  language = 'en',
  title,
  themeColor = 'amber',
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [preferRear, setPreferRear] = useState(true);
  const [isInitializing, setIsInitializing] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isDetectedSuccess, setIsDetectedSuccess] = useState(false);

  // Keep callback and scan state in stable refs so parent re-renders never tear down or restart the camera stream
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const lastScannedRef = useRef<string | null>(null);
  const lastScannedTimeRef = useRef<number>(0);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const themeBorderColor =
    themeColor === 'emerald'
      ? 'border-emerald-400'
      : themeColor === 'sky'
      ? 'border-sky-400'
      : 'border-amber-400';

  const themeBadgeColor =
    themeColor === 'emerald'
      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
      : themeColor === 'sky'
      ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
      : 'bg-amber-500/20 text-amber-300 border-amber-500/40';

  const themeLaserColor =
    themeColor === 'emerald'
      ? 'via-emerald-400 shadow-[0_0_12px_#34d399]'
      : themeColor === 'sky'
      ? 'via-sky-400 shadow-[0_0_12px_#38bdf8]'
      : 'via-amber-400 shadow-[0_0_12px_#fbbf24]';

  // Master camera stream lifecycle: strictly depends on hardware facing mode (preferRear), NOT on scan results
  useEffect(() => {
    let stream: MediaStream | null = null;
    let stopScanner: (() => void) | null = null;
    let isCancelled = false;

    setIsInitializing(true);
    setCameraError(null);

    startResilientCameraStream(preferRear)
      .then((res) => {
        if (isCancelled) {
          if (res.stream) res.stream.getTracks().forEach((t) => t.stop());
          return;
        }

        setIsInitializing(false);

        if (res.error) {
          setCameraError(res.error);
          return;
        }

        if (res.stream && videoRef.current) {
          stream = res.stream;
          videoRef.current.srcObject = res.stream;
          videoRef.current.setAttribute('playsinline', 'true');
          videoRef.current.setAttribute('webkit-playsinline', 'true');
          videoRef.current.setAttribute('muted', 'true');

          videoRef.current
            .play()
            .then(() => {
              if (videoRef.current && !isCancelled) {
                // Initialize high-speed live scanner with frame lock
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
                  150
                );
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
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [preferRear]);

  const handleToggleFacing = () => {
    setPreferRear((prev) => !prev);
  };

  return (
    <div className="relative rounded-3xl overflow-hidden bg-slate-950 border-2 border-slate-800 shadow-2xl space-y-2 select-none">
      {/* Top Floating Controls Bar */}
      <div className="absolute top-3 inset-x-3 z-20 flex items-center justify-between pointer-events-auto">
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/80 backdrop-blur-md border border-slate-700/80 text-[11px] font-bold text-white shadow-md">
          <Camera className="w-3.5 h-3.5 text-amber-400" />
          <span>{title || (language === 'bn' ? 'কিউআর কোড স্ক্যানার' : 'Live QR Scanner')}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Switch Camera Button (Front / Back) */}
          <button
            type="button"
            onClick={handleToggleFacing}
            title={language === 'bn' ? 'ক্যামেরা পরিবর্তন করুন' : 'Switch Camera'}
            className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 backdrop-blur-md border border-slate-700/80 text-slate-200 hover:text-white transition-colors cursor-pointer shadow-md"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Close Camera Button */}
          <button
            type="button"
            onClick={onClose}
            title={language === 'bn' ? 'ক্যামেরা বন্ধ করুন' : 'Close Camera'}
            className="p-2 rounded-xl bg-rose-950/80 hover:bg-rose-900 backdrop-blur-md border border-rose-700/80 text-rose-300 hover:text-white transition-colors cursor-pointer shadow-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Viewport Container - hardware isolated to prevent DOM reflow jitter */}
      <div className="relative w-full aspect-square max-h-[380px] sm:max-h-[440px] flex items-center justify-center overflow-hidden isolate select-none">
        {/* Loading Spinner */}
        {isInitializing && (
          <div className="z-10 flex flex-col items-center justify-center gap-3 text-white text-xs font-mono p-4 text-center">
            <div className="w-8 h-8 rounded-full border-3 border-amber-400 border-t-transparent animate-spin" />
            <span className="text-amber-200">
              {language === 'bn' ? 'ক্যামেরা চালু করা হচ্ছে...' : 'Initializing device camera...'}
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
            {/* Live Camera Video Feed (Hardware-accelerated texture layer) */}
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

            {/* Darkened Vignette Overlay */}
            <div className="absolute inset-0 bg-slate-950/45 pointer-events-none" />

            {/* ROCK-SOLID RETICLE TARGET BOX (Zero layout shift on scan) */}
            <div
              className={`relative z-10 w-60 h-60 sm:w-68 sm:h-68 rounded-3xl pointer-events-none shadow-[0_0_0_9999px_rgba(15,23,42,0.55)] transition-colors duration-200 ${
                isDetectedSuccess
                  ? 'ring-4 ring-emerald-400/90 bg-emerald-500/10'
                  : 'ring-1 ring-white/15 bg-transparent'
              }`}
              style={{ boxSizing: 'border-box' }}
            >
              {/* Corner 1: Top-Left */}
              <div
                className={`absolute -top-0.5 -left-0.5 w-9 h-9 border-t-4 border-l-4 rounded-tl-2xl transition-colors duration-200 ${
                  isDetectedSuccess ? 'border-emerald-400 drop-shadow-[0_0_8px_#10b981]' : themeBorderColor
                }`}
              />
              {/* Corner 2: Top-Right */}
              <div
                className={`absolute -top-0.5 -right-0.5 w-9 h-9 border-t-4 border-r-4 rounded-tr-2xl transition-colors duration-200 ${
                  isDetectedSuccess ? 'border-emerald-400 drop-shadow-[0_0_8px_#10b981]' : themeBorderColor
                }`}
              />
              {/* Corner 3: Bottom-Left */}
              <div
                className={`absolute -bottom-0.5 -left-0.5 w-9 h-9 border-b-4 border-l-4 rounded-bl-2xl transition-colors duration-200 ${
                  isDetectedSuccess ? 'border-emerald-400 drop-shadow-[0_0_8px_#10b981]' : themeBorderColor
                }`}
              />
              {/* Corner 4: Bottom-Right */}
              <div
                className={`absolute -bottom-0.5 -right-0.5 w-9 h-9 border-b-4 border-r-4 rounded-br-2xl transition-colors duration-200 ${
                  isDetectedSuccess ? 'border-emerald-400 drop-shadow-[0_0_8px_#10b981]' : themeBorderColor
                }`}
              />

              {/* Animated Laser Scanning Line (GPU-accelerated, suppressed during recognition) */}
              <div
                className={`absolute top-0 inset-x-3 h-0.5 bg-gradient-to-r from-transparent ${themeLaserColor} to-transparent animate-qr-laser transition-opacity duration-200 ${
                  isDetectedSuccess ? 'opacity-0' : 'opacity-100'
                }`}
              />

              {/* Center Target Crosshair / Watermark */}
              <div className="absolute inset-0 flex items-center justify-center opacity-25">
                <QrCode className="w-16 h-16 text-white" />
              </div>
            </div>

            {/* Bottom Target Alignment Pill */}
            <div className="absolute bottom-3 inset-x-0 z-20 flex justify-center pointer-events-none px-4">
              <span
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11px] font-bold tracking-wide backdrop-blur-md border shadow-lg transition-colors duration-200 ${
                  isDetectedSuccess
                    ? 'bg-emerald-500/30 text-emerald-200 border-emerald-400/60 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                    : themeBadgeColor
                }`}
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>
                  {isDetectedSuccess
                    ? language === 'bn'
                      ? '✓ কিউআর কোড শনাক্ত হয়েছে!'
                      : '✓ QR Code Recognized!'
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
