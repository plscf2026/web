import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera,
  RefreshCw,
  X,
  Check,
  AlertCircle,
  Upload,
  Sparkles,
} from 'lucide-react';
import { compressImageTo200KB } from '../../utils/imageCompressor';

export interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (imageDataUrl: string) => void;
  title?: string;
  instructions?: string;
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  isOpen,
  onClose,
  onCapture,
  title = 'Capture Receipt / Voucher Photo',
  instructions = 'Align the paper receipt, cash memo, or voucher clearly within the frame.',
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const fallbackFileInputRef = useRef<HTMLInputElement | null>(null);

  const [isInitializing, setIsInitializing] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);

  // Facing mode state: default to 'environment' (rear camera for photographing documents)
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);

  // Stop camera helper
  const stopCamera = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Start camera with requested facingMode
  const startCamera = useCallback(async (desiredFacing: 'environment' | 'user') => {
    setIsInitializing(true);
    setCameraError(null);
    stopCamera();

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported by your browser.');
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: desiredFacing },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
      } catch {
        // Fallback to basic video constraint
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      // Check available video devices
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((d) => d.kind === 'videoinput');
        setAvailableDevices(videoInputs);
      } catch {
        // ignore device enumeration errors
      }
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Unable to access camera. Please ensure permissions are granted.';
      setCameraError(msg);
    } finally {
      setIsInitializing(false);
    }
  }, [stopCamera]);

  // Lifecycle
  useEffect(() => {
    if (isOpen) {
      setCapturedPreview(null);
      startCamera(facingMode);
    } else {
      stopCamera();
      setCapturedPreview(null);
      setCameraError(null);
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode, startCamera, stopCamera]);

  // Switch between front/back camera
  const toggleFacingMode = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
  };

  // Capture frame from video feed
  const takeSnapshot = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setCameraError('Camera stream not ready. Please try again.');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setCameraError('Canvas rendering failed.');
      return;
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedPreview(dataUrl);
    stopCamera();
  };

  // Retake photo
  const handleRetake = () => {
    setCapturedPreview(null);
    startCamera(facingMode);
  };

  // Confirm photo & compress to <= 200 KB
  const handleConfirmPhoto = async () => {
    if (!capturedPreview) return;
    setIsCompressing(true);
    try {
      const compressed = await compressImageTo200KB(capturedPreview, 200 * 1024);
      onCapture(compressed.dataUrl);
      onClose();
    } catch (err) {
      // Fallback: pass raw captured preview if compression failed
      onCapture(capturedPreview);
      onClose();
    } finally {
      setIsCompressing(false);
    }
  };

  // Fallback direct file input
  const handleFallbackFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result === 'string') {
        try {
          const compressed = await compressImageTo200KB(reader.result, 200 * 1024);
          onCapture(compressed.dataUrl);
          onClose();
        } catch {
          onCapture(reader.result as string);
          onClose();
        }
      }
    };
    reader.readAsDataURL(file);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black tracking-tight">{title}</h3>
              <p className="text-[11px] text-slate-300">Live Camera Document Scanner</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {/* Instructions banner */}
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">{instructions}</p>
          </div>

          {/* Camera Viewfinder / Preview */}
          <div className="relative aspect-4/3 bg-slate-950 rounded-2xl overflow-hidden shadow-inner flex items-center justify-center">
            {capturedPreview ? (
              // Captured preview screen
              <img
                src={capturedPreview}
                alt="Captured voucher preview"
                className="w-full h-full object-contain"
              />
            ) : cameraError ? (
              // Error display
              <div className="p-6 text-center space-y-3">
                <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
                <p className="text-xs text-rose-300 font-bold max-w-xs mx-auto">
                  {cameraError}
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => fallbackFileInputRef.current?.click()}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 mx-auto cursor-pointer"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Upload Voucher Photo Instead</span>
                  </button>
                  <input
                    ref={fallbackFileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFallbackFile}
                    className="hidden"
                  />
                </div>
              </div>
            ) : (
              // Live camera stream
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />

                {/* Viewfinder Guide Overlay */}
                <div className="absolute inset-4 sm:inset-6 border-2 border-dashed border-emerald-400/80 rounded-2xl pointer-events-none flex flex-col justify-between p-3">
                  <div className="flex justify-between">
                    <div className="w-4 h-4 border-t-2 border-l-2 border-emerald-400" />
                    <div className="w-4 h-4 border-t-2 border-r-2 border-emerald-400" />
                  </div>
                  <div className="text-center">
                    <span className="text-[10px] font-bold text-white/90 bg-black/60 px-3 py-1 rounded-full backdrop-blur-xs">
                      Center Voucher / Receipt in View
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <div className="w-4 h-4 border-b-2 border-l-2 border-emerald-400" />
                    <div className="w-4 h-4 border-b-2 border-r-2 border-emerald-400" />
                  </div>
                </div>

                {/* Switch Camera Button if multiple devices or mobile */}
                {availableDevices.length > 1 && (
                  <button
                    type="button"
                    onClick={toggleFacingMode}
                    className="absolute top-3 right-3 p-2 rounded-xl bg-black/60 hover:bg-black/80 text-white backdrop-blur-xs transition cursor-pointer border border-white/20"
                    title="Switch Camera (Front/Rear)"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                )}

                {isInitializing && (
                  <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                    <span className="text-xs text-white font-bold animate-pulse">
                      Initializing camera...
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Footer Action Buttons */}
        <div className="p-4 sm:px-6 sm:py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            Cancel
          </button>

          {capturedPreview ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRetake}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retake</span>
              </button>
              <button
                type="button"
                onClick={handleConfirmPhoto}
                disabled={isCompressing}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{isCompressing ? 'Compressing...' : 'Use This Photo'}</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={takeSnapshot}
              disabled={isInitializing || Boolean(cameraError)}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider transition cursor-pointer flex items-center gap-2 shadow-xs disabled:opacity-50"
            >
              <Camera className="w-4 h-4" />
              <span>Capture Photo</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

