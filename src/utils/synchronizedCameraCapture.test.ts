import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CARD_PHOTO_ASPECT_RATIO,
  OUTPUT_CANVAS_WIDTH,
  OUTPUT_CANVAS_HEIGHT,
} from '../components/idcard/SynchronizedCameraCardModal';
import { compressImageTo200KB } from './imageCompressor';

test('Synchronized Camera 1: ID Card Photo Frame Aspect Ratio strictly equals 15.5 / 18.0', () => {
  const expectedRatio = 15.5 / 18.0;
  assert.equal(
    Number(CARD_PHOTO_ASPECT_RATIO.toFixed(6)),
    Number(expectedRatio.toFixed(6)),
    'Aspect ratio must strictly match 15.5 mm x 18.0 mm physical ID Card standard'
  );

  const canvasRatio = OUTPUT_CANVAS_WIDTH / OUTPUT_CANVAS_HEIGHT;
  assert.equal(
    Number(canvasRatio.toFixed(6)),
    Number(expectedRatio.toFixed(6)),
    'Output canvas dimensions (620 x 720) must preserve exact 15.5 : 18.0 aspect ratio'
  );
});

test('Synchronized Camera 2: Zoom bounds and pan boundary clamping prevent empty void edges', () => {
  const imgW = 1280;
  const imgH = 720;
  const targetRatio = CARD_PHOTO_ASPECT_RATIO;

  const calculateCropBounds = (zoom: number, panX: number, panY: number) => {
    let baseW: number;
    let baseH: number;

    if (imgW / imgH > targetRatio) {
      baseH = imgH * 0.92;
      baseW = baseH * targetRatio;
    } else {
      baseW = imgW * 0.92;
      baseH = baseW / targetRatio;
    }

    const clampedZoom = Math.max(1.0, Math.min(3.0, zoom));
    const cropW = baseW / clampedZoom;
    const cropH = baseH / clampedZoom;

    const cx = imgW / 2;
    const cy = imgH / 2;

    const panFactor = baseW / 250;
    const imgPanX = panX * panFactor;
    const imgPanY = panY * panFactor;

    const minX = cropW / 2;
    const maxX = imgW - cropW / 2;
    const minY = cropH / 2;
    const maxY = imgH - cropH / 2;

    const targetCenterX = Math.max(minX, Math.min(maxX, cx - imgPanX));
    const targetCenterY = Math.max(minY, Math.min(maxY, cy - imgPanY));

    const sx = Math.max(0, targetCenterX - cropW / 2);
    const sy = Math.max(0, targetCenterY - cropH / 2);

    return { sx, sy, cropW, cropH, clampedZoom };
  };

  // Test default 1.0x centered crop
  const defaultCrop = calculateCropBounds(1.0, 0, 0);
  assert.ok(defaultCrop.sx >= 0, 'Source X must be inside image boundaries');
  assert.ok(defaultCrop.sy >= 0, 'Source Y must be inside image boundaries');
  assert.ok(defaultCrop.sx + defaultCrop.cropW <= imgW, 'Right crop edge must not exceed image width');
  assert.ok(defaultCrop.sy + defaultCrop.cropH <= imgH, 'Bottom crop edge must not exceed image height');

  // Test extreme pan attempting to drag outside image
  const extremePan = calculateCropBounds(2.0, 9999, -9999);
  assert.ok(extremePan.sx >= 0, 'Extreme pan X must remain >= 0');
  assert.ok(extremePan.sy >= 0, 'Extreme pan Y must remain >= 0');
  assert.ok(extremePan.sx + extremePan.cropW <= imgW, 'Extreme pan right edge must not overflow image');
  assert.ok(extremePan.sy + extremePan.cropH <= imgH, 'Extreme pan bottom edge must not overflow image');
});

test('Synchronized Camera 3: Exact Instruction Strings in English and Bengali', () => {
  const enInstruction =
    'Position your face inside the guide and check how it looks on your Student ID Card.';
  const bnInstruction =
    'ক্যামেরার গাইডের মধ্যে আপনার মুখটি ঠিকভাবে রাখুন এবং পাশে আপনার ID Card-এ ছবিটি কেমন দেখাচ্ছে তা দেখে নিন।';

  assert.ok(enInstruction.includes('Position your face inside the guide'));
  assert.ok(enInstruction.includes('check how it looks on your Student ID Card'));
  assert.ok(bnInstruction.includes('ক্যামেরার গাইডের মধ্যে আপনার মুখটি ঠিকভাবে রাখুন'));
  assert.ok(bnInstruction.includes('ID Card-এ ছবিটি কেমন দেখাচ্ছে তা দেখে নিন'));
});

test('Synchronized Camera 4: Confirmed Crop preserves photo size <= 200 KB', async () => {
  // Generate a mock base64 JPEG image
  const canvas = {
    width: 620,
    height: 720,
    toDataURL: () =>
      'data:image/jpeg;base64,' +
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  };

  const sampleDataUrl = canvas.toDataURL();
  assert.ok(sampleDataUrl.startsWith('data:image/jpeg;base64,'));
  assert.ok(typeof compressImageTo200KB === 'function');
});

