/**
 * Police Lines School and College, Faridpur - Grand Reunion 2026/2027
 * Cross-Platform Universal QR Decoder & Resilient Camera Stream Starter
 * Powered by native BarcodeDetector API with high-accuracy jsQR pure-JS fallback
 */

import jsQR from 'jsqr';

export interface CameraStreamResult {
  stream?: MediaStream;
  error?: string;
  errorType?: 'UNSUPPORTED' | 'NOT_ALLOWED' | 'NOT_FOUND' | 'INSECURE_CONTEXT';
}

/**
 * Robust camera stream initializer with automatic front/rear fallback
 * and explicit context/permission diagnostics.
 */
export async function startResilientCameraStream(
  preferRearCamera = true
): Promise<CameraStreamResult> {
  // Check browser support and Secure Context (HTTPS / localhost)
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
        ? 'Camera access is blocked by browsers on insecure HTTP. Please use HTTPS or upload a QR image below.'
        : 'Camera API (getUserMedia) is not supported in this browser.',
      errorType: isInsecure ? 'INSECURE_CONTEXT' : 'UNSUPPORTED',
    };
  }

  // 1. Attempt back camera with high-resolution constraints
  if (preferRearCamera) {
    try {
      const rearStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      return { stream: rearStream };
    } catch (_) {
      // 1b. Fallback to basic environment camera for strict mobile webviews (iOS Safari, WeChat, etc.)
      try {
        const simpleRear = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        return { stream: simpleRear };
      } catch (_) {
        // Continue to generic fallback
      }
    }
  }

  // 2. Fallback to any available video camera
  try {
    const fallbackStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    });
    return { stream: fallbackStream };
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
 * High-performance real-time QR code scanner for live HTMLVideoElement.
 * Runs on every platform (iOS Safari, Android Chrome, Mac/PC) by combining
 * native BarcodeDetector with a fast offscreen canvas jsQR analyzer.
 */
export function startLiveQRScanner(
  video: HTMLVideoElement,
  onDetected: (code: string) => void,
  intervalMs = 150
): () => void {
  let isScanning = true;
  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let nativeDetector: any = null;

  if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
    try {
      nativeDetector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
    } catch (_) {
      nativeDetector = null;
    }
  }

  const scanFrame = async () => {
    if (!isScanning || !video) return;

    // Check if video is loaded and playing with valid dimensions
    if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
      let detectedCode: string | null = null;

      // 1. Try native BarcodeDetector first if available
      if (nativeDetector) {
        try {
          const barcodes = await nativeDetector.detect(video);
          if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
            detectedCode = barcodes[0].rawValue.trim();
          }
        } catch (_) {
          // Native detector error or unhandled frame -> fallback to jsQR
        }
      }

      // 2. jsQR canvas fallback (Universal across iOS Safari, Firefox, and Android)
      if (!detectedCode && typeof document !== 'undefined') {
        try {
          if (!canvas) {
            canvas = document.createElement('canvas');
          }
          // Downscale to 600px max dimension for ultra-fast 60fps frame rate without CPU lag
          const targetWidth = Math.min(video.videoWidth, 600);
          const scale = targetWidth / video.videoWidth;
          const targetHeight = Math.floor(video.videoHeight * scale);

          if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            ctx = canvas.getContext('2d', { willReadFrequently: true });
          }

          if (ctx) {
            ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
            const imgData = ctx.getImageData(0, 0, targetWidth, targetHeight);
            const qr = jsQR(imgData.data, imgData.width, imgData.height, {
              inversionAttempts: 'attemptBoth',
            });
            if (qr && qr.data && qr.data.trim()) {
              detectedCode = qr.data.trim();
            }
          }
        } catch (_) {
          // Ignore transient frame read errors
        }
      }

      if (detectedCode && isScanning) {
        onDetected(detectedCode);
      }
    }
  };

  const timerId = window.setInterval(scanFrame, intervalMs);

  return () => {
    isScanning = false;
    window.clearInterval(timerId);
    canvas = null;
    ctx = null;
  };
}

/**
 * Universal QR code decoder for uploaded image files (File or Blob).
 * Employs native BarcodeDetector and multi-scale + binarized jsQR canvas passes
 * to reliably decode photos taken on mobile cameras (even if skewed, low contrast, or high res).
 */
export async function decodeQRCodeFromImageFile(file: File | Blob): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = async () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = async () => {
        // 1. Try native BarcodeDetector API if available
        if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
          try {
            const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
            const barcodes = await detector.detect(img);
            if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
              const code = barcodes[0].rawValue.trim();
              if (code) return resolve(code);
            }
          } catch (_) {
            // Fall through to jsQR
          }
        }

        // 2. Pure JavaScript multi-scale canvas scanning with jsQR
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) return resolve(null);

          const maxDim = Math.max(img.width, img.height);
          // Try original size, 1200px, 800px, 500px scales for optimal detection
          const scalesToTry = [1];
          if (maxDim > 1200) scalesToTry.push(1200 / maxDim);
          if (maxDim > 800) scalesToTry.push(800 / maxDim);
          if (maxDim > 500) scalesToTry.push(500 / maxDim);

          for (const scale of scalesToTry) {
            const w = Math.round(img.width * scale);
            const h = Math.round(img.height * scale);
            canvas.width = w;
            canvas.height = h;
            ctx.drawImage(img, 0, 0, w, h);

            const imageData = ctx.getImageData(0, 0, w, h);
            const qr = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: 'attemptBoth',
            });

            if (qr && qr.data && qr.data.trim()) {
              return resolve(qr.data.trim());
            }
          }

          // 3. High-contrast binarization pass for washed-out or low-contrast paper/ticket photos
          const w = Math.min(img.width, 800);
          const h = Math.round(img.height * (w / img.width));
          canvas.width = w;
          canvas.height = h;
          ctx.drawImage(img, 0, 0, w, h);

          const imgData = ctx.getImageData(0, 0, w, h);
          const data = imgData.data;
          for (let i = 0; i < data.length; i += 4) {
            // Perceived luminance calculation
            const brightness = (data[i] * 77 + data[i + 1] * 150 + data[i + 2] * 29) >> 8;
            const val = brightness > 128 ? 255 : 0;
            data[i] = val;
            data[i + 1] = val;
            data[i + 2] = val;
          }

          const binarizedQr = jsQR(data, w, h, { inversionAttempts: 'attemptBoth' });
          if (binarizedQr && binarizedQr.data && binarizedQr.data.trim()) {
            return resolve(binarizedQr.data.trim());
          }
        } catch (err) {
          console.warn('Canvas jsQR image decode notice:', err);
        }

        // Return null if all passes fail
        resolve(null);
      };

      img.onerror = () => resolve(null);
      img.src = dataUrl;
    };

    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}
