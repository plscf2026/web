/**
 * Police Lines School and College, Faridpur - Grand Reunion 2026
 * Cross-Platform QR Decoder & Resilient Camera Stream Starter
 */

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
    const isInsecure = window.location.protocol === 'http:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
    return {
      error: isInsecure
        ? 'Camera access is blocked by browsers on insecure HTTP. Please use HTTPS, localhost, or upload a QR image below.'
        : 'Camera API (getUserMedia) is not supported in this browser.',
      errorType: isInsecure ? 'INSECURE_CONTEXT' : 'UNSUPPORTED',
    };
  }

  // 1. Attempt back camera first (environment)
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
      // Continue to fallback
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
 * Decodes QR code from an uploaded image file (File or Blob)
 * using the native BarcodeDetector API or image canvas fallback.
 */
export async function decodeQRCodeFromImageFile(file: File | Blob): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = async () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = async () => {
        // Native BarcodeDetector API
        if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
          try {
            const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
            const barcodes = await detector.detect(img);
            if (barcodes.length > 0 && barcodes[0].rawValue) {
              return resolve(barcodes[0].rawValue.trim());
            }
          } catch (_) {}
        }

        // Return null if no barcode detected
        resolve(null);
      };

      img.onerror = () => resolve(null);
      img.src = dataUrl;
    };

    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

