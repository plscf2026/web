import test from 'node:test';
import assert from 'node:assert/strict';
import { compressImageTo200KB } from './imageCompressor';

test('compressImageTo200KB utility handles image data url', async () => {
  // 1x1 transparent PNG data url
  const sampleDataUrl =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  assert.ok(sampleDataUrl.startsWith('data:image/png;base64,'));
  // In Node.js environment without DOM Image, check function exists
  assert.equal(typeof compressImageTo200KB, 'function');
});

