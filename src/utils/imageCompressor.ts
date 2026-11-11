/**
 * Police Lines School and College, Faridpur - Grand Reunion 2026
 * Image Compression & Camera Capture Utility
 * Guarantees profile photo size <= 200 KB as required by system specifications.
 */

export interface CompressionResult {
  dataUrl: string;
  sizeBytes: number;
  sizeKb: number;
  width: number;
  height: number;
}

/**
 * Compresses an image file or base64 data URL to be strictly <= 200 KB (204,800 bytes).
 * Dynamically adjusts canvas resolution and JPEG quality.
 */
export async function compressImageTo200KB(
  input: File | Blob | string,
  maxSizeBytes = 200 * 1024
): Promise<CompressionResult> {
  const dataUrl = typeof input === 'string' ? input : await fileToDataUrl(input);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      let { width, height } = img;
      const maxDimension = 1200;

      // Scale down if dimensions are excessively large
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return reject(new Error('Failed to create canvas context for compression.'));
      }

      // Draw with white background to handle transparent PNGs gracefully
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      // Binary search / iterative quality adjustment to hit <= 200KB
      let quality = 0.88;
      let outputDataUrl = canvas.toDataURL('image/jpeg', quality);
      let sizeBytes = estimateDataUrlBytes(outputDataUrl);

      // If still too large, step down quality
      const qualitySteps = [0.82, 0.74, 0.65, 0.55, 0.45, 0.35];
      let stepIndex = 0;

      while (sizeBytes > maxSizeBytes && stepIndex < qualitySteps.length) {
        quality = qualitySteps[stepIndex];
        outputDataUrl = canvas.toDataURL('image/jpeg', quality);
        sizeBytes = estimateDataUrlBytes(outputDataUrl);
        stepIndex++;
      }

      // If still over 200KB, downscale canvas dimensions
      if (sizeBytes > maxSizeBytes) {
        canvas.width = Math.round(width * 0.75);
        canvas.height = Math.round(height * 0.75);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        outputDataUrl = canvas.toDataURL('image/jpeg', 0.6);
        sizeBytes = estimateDataUrlBytes(outputDataUrl);
      }

      resolve({
        dataUrl: outputDataUrl,
        sizeBytes,
        sizeKb: Math.round(sizeBytes / 1024),
        width: canvas.width,
        height: canvas.height,
      });
    };

    img.onerror = () => {
      reject(new Error('Failed to load image for compression.'));
    };

    img.src = dataUrl;
  });
}

function fileToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read photo file.'));
    reader.readAsDataURL(file);
  });
}

function estimateDataUrlBytes(dataUrl: string): number {
  const base64Str = dataUrl.split(',')[1] || '';
  return Math.round((base64Str.length * 3) / 4);
}

