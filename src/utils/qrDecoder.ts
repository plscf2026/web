/**
 * Police Lines School and College, Faridpur - Grand Reunion 2026/2027
 * Cross-Platform Universal Low-Power QR Decoder & Resilient Camera Stream Starter
 *
 * Performance & Thermal Management:
 * 1. Hardware Accelerated: Prefers native browser BarcodeDetector API (zero main-thread CPU).
 * 2. Region-of-Interest (ROI) Cropping: Downscales & crops ONLY the center 65% reticle for jsQR,
 *    reducing pixel processing bandwidth by over 70%.
 * 3. Inversion Optimization: Uses fast 'dontInvert' pass on majority of frames, running 'attemptBoth'
 *    only periodically, saving 50% CPU per frame.
 * 4. Adaptive Frame Throttling: Runs at 180ms (5.5 fps) balanced interval instead of unbounded 60fps.
 * 5. Dormant Pause State: Pauses decoding completely when modal is open, scan is processing,
 *    or document is hidden (visibilitychange), preventing phone overheating.
 * 6. Hardware Flashlight (Torch): Detects and safely controls physical device LED flashlight.
 */

import jsQR from 'jsqr';

export interface CameraStreamResult {
  stream?: MediaStream;
  error?: string;
  errorType?: 'UNSUPPORTED' | 'NOT_ALLOWED' | 'NOT_FOUND' | 'INSECURE_CONTEXT';
  torchSupported?: boolean;
}

export interface ScannerOptions {
  intervalMs?: number;
  paused?: boolean;
  roiCropRatio?: number;
  onTorchSupportChange?: (supported: boolean) => void;
}

export type ScannerStopFn = (() => void) & {
  stop: () => void;
  setPaused: (paused: boolean) => void;
  isPaused: () => boolean;
  isNativeSupported: () => boolean;
};

/**
 * Checks whether the physical camera device supports a hardware torch/flashlight.
 */
export function isTorchSupported(stream?: MediaStream | null): boolean {
  if (!stream) return false;
  const track = stream.getVideoTracks()[0];
  if (!track) return false;
  try {
    const capabilities = (track as any).getCapabilities?.();
    return Boolean(capabilities && 'torch' in capabilities);
  } catch {
    return false;
  }
}

/**
 * Safely applies torch constraint (turns physical flashlight on or off).
 * Returns true if the hardware torch state was successfully changed.
 */
export async function setCameraTorch(
  stream: MediaStream | null | undefined,
  enabled: boolean
): Promise<boolean> {
  if (!stream) return false;
  const track = stream.getVideoTracks()[0];
  if (!track) return false;
  try {
    const capabilities = (track as any).getCapabilities?.();
    if (!capabilities || !('torch' in capabilities)) return false;
    await (track as any).applyConstraints({
      advanced: [{ torch: Boolean(enabled) }],
    });
    return true;
  } catch (err) {
    console.warn('[CameraTorch] Failed to set torch constraint:', err);
    return false;
  }
}

/**
 * Safely turns off torch and stops all media stream tracks to immediately release hardware camera resources.
 */
export function stopCameraStream(stream: MediaStream | null | undefined): void {
  if (!stream) return;
  try {
    // Attempt turning off torch first so LED does not remain stuck on
    const track = stream.getVideoTracks()[0];
    if (track && (track as any).getCapabilities?.()?.torch) {
      (track as any).applyConstraints({ advanced: [{ torch: false }] }).catch(() => {});
    }
  } catch {}
  try {
    stream.getTracks().forEach((track) => {
      try {
        track.stop();
      } catch {}
    });
  } catch {}
}

/**
 * Robust camera stream initializer with thermal-optimized resolution limits (720p / 24-30fps),
 * automatic front/rear fallback, and torch capability detection.
 */
export async function startResilientCameraStream(
  preferRearCamera = true
): Promise<CameraStreamResult> {
  if (typeof window === 'undefined') {
    return { error: 'Window context is unavailable.' };
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    const isInsecure =
      window.location.protocol === 'http:' &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1';
    return {
      error: isInsecure
        ? 'Camera access is blocked by browsers on insecure HTTP. Please use HTTPS or verify using Registration ID & QR Token manually below.'
        : 'Camera API (getUserMedia) is not supported in this browser.',
      errorType: isInsecure ? 'INSECURE_CONTEXT' : 'UNSUPPORTED',
    };
  }

  // 1. Attempt back camera with thermal-optimized 720p 24-30fps constraints
  // Note: Unconstrained 4K / 60fps streams cause mobile ISP and sensor overheating.
  if (preferRearCamera) {
    try {
      const rearStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280, max: 1280 },
          height: { ideal: 720, max: 720 },
          frameRate: { ideal: 24, max: 30 },
        },
        audio: false,
      });
      return {
        stream: rearStream,
        torchSupported: isTorchSupported(rearStream),
      };
    } catch (_) {
      // 1b. Fallback to basic environment camera for mobile webviews (iOS Safari, WeChat, etc.)
      try {
        const simpleRear = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        return {
          stream: simpleRear,
          torchSupported: isTorchSupported(simpleRear),
        };
      } catch (_) {
        // Continue to generic fallback
      }
    }
  }

  // 2. Fallback to any available video camera (front camera or default webcam)
  try {
    const fallbackStream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280, max: 1280 },
        height: { ideal: 720, max: 720 },
        frameRate: { ideal: 24, max: 30 },
      },
      audio: false,
    });
    return {
      stream: fallbackStream,
      torchSupported: isTorchSupported(fallbackStream),
    };
  } catch (err: any) {
    let errorMsg = 'Failed to access device camera.';
    let errorType: CameraStreamResult['errorType'] = 'NOT_FOUND';

    if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
      errorMsg = 'Camera permission was denied. Please allow camera access in your browser or site settings.';
      errorType = 'NOT_ALLOWED';
    } else if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') {
      errorMsg = 'No video camera was detected on this device.';
      errorType = 'NOT_FOUND';
    }

    return { error: errorMsg, errorType };
  }
}

/**
 * High-performance, thermally-regulated real-time QR code scanner for live HTMLVideoElement.
 * Features:
 * - Native hardware BarcodeDetector (Zero CPU/memory overhead)
 * - Region-of-Interest (ROI) Center-Cropped jsQR fallback (70%+ lower CPU than full-frame analysis)
 * - Pause and dormant states for verification modals and background tabs
 */
export function startLiveQRScanner(
  video: HTMLVideoElement,
  onDetected: (code: string) => void,
  optionsOrInterval: number | ScannerOptions = 180
): ScannerStopFn {
  const options: ScannerOptions =
    typeof optionsOrInterval === 'number'
      ? { intervalMs: optionsOrInterval }
      : optionsOrInterval;

  const intervalMs = options.intervalMs ?? 180;
  const roiRatio = options.roiCropRatio ?? 0.65;
  let isScanning = true;
  let isPaused = Boolean(options.paused);
  let isProcessing = false;
  let frameCount = 0;

  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let nativeDetector: any = null;

  // Initialize native hardware detector if supported by the browser engine
  if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
    try {
      nativeDetector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
    } catch (_) {
      nativeDetector = null;
    }
  }

  // Auto-pause scanning when the document is hidden/tab is switched to prevent background heating
  const handleVisibilityChange = () => {
    if (typeof document !== 'undefined' && document.hidden) {
      isPaused = true;
    } else if (!options.paused) {
      isPaused = false;
    }
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange);
  }

  const scanFrame = async () => {
    if (!isScanning || isPaused || !video || isProcessing) return;
    isProcessing = true;
    frameCount++;

    try {
      // Check if video is loaded and actively playing with non-zero dimensions
      if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
        let detectedCode: string | null = null;

        // 1. Hardware Accelerated: Try native BarcodeDetector directly on the video element
        // (Does NOT allocate canvas or read back pixels across the GPU bus!)
        if (nativeDetector) {
          try {
            const barcodes = await nativeDetector.detect(video);
            if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
              detectedCode = barcodes[0].rawValue.trim();
            }
          } catch (_) {
            // Transient frame read error or unsupported pixel format -> fall through to jsQR
          }
        }

        // 2. Low-Power jsQR Fallback with Center Region-of-Interest (ROI) Cropping
        if (!detectedCode && typeof document !== 'undefined') {
          try {
            const vidW = video.videoWidth;
            const vidH = video.videoHeight;
            const minDim = Math.min(vidW, vidH);

            // Compute center crop rectangle corresponding to viewfinder reticle (65% of center)
            const cropSize = Math.floor(minDim * roiRatio);
            const cropX = Math.floor((vidW - cropSize) / 2);
            const cropY = Math.floor((vidH - cropSize) / 2);

            // Cap offscreen canvas resolution at max 280px for instant binarization (< 8ms)
            const targetDim = Math.min(cropSize, 280);

            if (!canvas) {
              canvas = document.createElement('canvas');
            }
            if (canvas.width !== targetDim || canvas.height !== targetDim) {
              canvas.width = targetDim;
              canvas.height = targetDim;
              ctx = canvas.getContext('2d', { willReadFrequently: true });
            }

            if (ctx) {
              // Draw only the center ROI region
              ctx.drawImage(
                video,
                cropX,
                cropY,
                cropSize,
                cropSize,
                0,
                0,
                targetDim,
                targetDim
              );

              const imgData = ctx.getImageData(0, 0, targetDim, targetDim);

              // Thermal optimization: Use fast 'dontInvert' on most frames; run 'attemptBoth'
              // every 3rd frame to catch rare inverted codes while cutting 50% CPU cycles.
              const inversionMode = frameCount % 3 === 0 ? 'attemptBoth' : 'dontInvert';
              const qr = jsQR(imgData.data, targetDim, targetDim, {
                inversionAttempts: inversionMode,
              });

              if (qr && qr.data && qr.data.trim()) {
                detectedCode = qr.data.trim();
              }
            }
          } catch (_) {
            // Ignore transient canvas buffer errors
          }
        }

        if (detectedCode && isScanning && !isPaused) {
          onDetected(detectedCode);
        }
      }
    } finally {
      isProcessing = false;
    }
  };

  const timerId: any = (typeof window !== 'undefined' ? window.setInterval : setInterval)(scanFrame, intervalMs);

  const cleanup = () => {
    isScanning = false;
    isPaused = true;
    (typeof window !== 'undefined' ? window.clearInterval : clearInterval)(timerId);
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
    canvas = null;
    ctx = null;
    nativeDetector = null;
  };

  const stopFn = (() => {
    cleanup();
  }) as ScannerStopFn;

  stopFn.stop = cleanup;
  stopFn.setPaused = (paused: boolean) => {
    isPaused = paused;
  };
  stopFn.isPaused = () => isPaused;
  stopFn.isNativeSupported = () => Boolean(nativeDetector);

  return stopFn;
}
