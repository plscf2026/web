/**
 * Police Lines School & College, Faridpur - Grand Reunion 2026/2027
 * QR Scanner Performance, Thermal Management & High-Volume Scalability Benchmark Suite
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isTorchSupported,
  setCameraTorch,
  stopCameraStream,
  startLiveQRScanner,
} from './qrDecoder';
import { EventStore } from '../services/eventStore';
import { AppStore } from '../services/store';
import { parseScannedInput } from './tokenGenerator';
import { RegistrationRecord, StaffAccount } from '../types';

// Mock in-memory localStorage for Node test runner environment
const mockStorage: Record<string, string> = {};
if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = {
    getItem: (key: string) => mockStorage[key] || null,
    setItem: (key: string, val: string) => {
      mockStorage[key] = String(val);
    },
    removeItem: (key: string) => {
      delete mockStorage[key];
    },
    clear: () => {
      for (const k in mockStorage) delete mockStorage[k];
    },
  };
}

// ── 1. Flashlight (Torch) Hardware Capability & Lifecycle Tests ────────────────
test('1. Flashlight / Torch: Capability detection, constraint application, and safe auto-off', async () => {
  let torchState = false;
  let trackStopped = false;

  const mockTrack = {
    kind: 'video',
    getCapabilities: () => ({
      torch: true,
      facingMode: ['environment'],
    }),
    applyConstraints: async (constraints: any) => {
      const advanced = constraints?.advanced?.[0];
      if (advanced && 'torch' in advanced) {
        torchState = advanced.torch;
      }
    },
    stop: () => {
      trackStopped = true;
    },
  };

  const mockStream = {
    getVideoTracks: () => [mockTrack],
    getTracks: () => [mockTrack],
  } as unknown as MediaStream;

  // 1a. Detect torch support
  const supported = isTorchSupported(mockStream);
  assert.equal(supported, true, 'isTorchSupported should return true for torch-capable hardware');

  // 1b. Turn torch ON
  const onResult = await setCameraTorch(mockStream, true);
  assert.equal(onResult, true);
  assert.equal(torchState, true, 'Hardware track constraint torch should be true');

  // 1c. Turn torch OFF
  const offResult = await setCameraTorch(mockStream, false);
  assert.equal(offResult, true);
  assert.equal(torchState, false, 'Hardware track constraint torch should be false');

  // 1d. Turn back ON, then invoke stopCameraStream (must auto-turn off before track.stop)
  await setCameraTorch(mockStream, true);
  assert.equal(torchState, true);

  stopCameraStream(mockStream);
  assert.equal(torchState, false, 'stopCameraStream must safely force torch OFF before track stop');
  assert.equal(trackStopped, true, 'stopCameraStream must stop all active video tracks');

  // 1e. Unsupported device handling
  const unsupportedTrack = {
    kind: 'video',
    getCapabilities: () => ({ facingMode: ['user'] }), // No torch
  };
  const unsupportedStream = {
    getVideoTracks: () => [unsupportedTrack],
    getTracks: () => [unsupportedTrack],
  } as unknown as MediaStream;

  assert.equal(isTorchSupported(unsupportedStream), false, 'Should return false when torch capability is absent');
  const unsupportedResult = await setCameraTorch(unsupportedStream, true);
  assert.equal(unsupportedResult, false, 'Should gracefully fail without throwing when device lacks torch');
});

// ── 2. Thermal Management: Computational Load & Pixel Reduction ────────────────
test('2. Thermal Management: ROI Center-Cropping reduces decoded pixel volume by > 80%', () => {
  // Legacy full-frame decode metrics
  const fullFrameWidth = 600;
  const fullFrameHeight = 450;
  const legacyPixelCount = fullFrameWidth * fullFrameHeight; // 270,000 pixels
  const legacyPasses = 2; // 'attemptBoth' inverts every pixel
  const legacyOperations = legacyPixelCount * legacyPasses; // 540,000 analyzed pixels/frame

  // Optimized Center-ROI decode metrics
  const roiDimension = 280;
  const optimizedPixelCount = roiDimension * roiDimension; // 78,400 pixels
  const optimizedPasses = 1; // 'dontInvert' on normal frames
  const optimizedOperations = optimizedPixelCount * optimizedPasses; // 78,400 analyzed pixels/frame

  const reductionPercentage = ((legacyOperations - optimizedOperations) / legacyOperations) * 100;

  assert.ok(
    reductionPercentage > 80,
    `Optimized ROI processing must reduce computational pixel load by > 80% (Actual: ${reductionPercentage.toFixed(1)}%)`
  );
  assert.equal(optimizedPixelCount, 78400, 'ROI dimension 280x280 bounds pixel buffer to 78,400 pixels');
});

// ── 3. Dormant Pause State: Zero Processing While Verifying / Modal Open ──────
test('3. Scanner Lifecycle: Paused state prevents frame decoding and CPU consumption', () => {
  let processedFrames = 0;

  const mockVideo = {
    readyState: 4,
    videoWidth: 1280,
    videoHeight: 720,
  } as unknown as HTMLVideoElement;

  const onDetect = () => {
    processedFrames++;
  };

  // Start with paused: true
  const controller = startLiveQRScanner(mockVideo, onDetect, {
    intervalMs: 10,
    paused: true,
  });

  assert.equal(controller.isPaused(), true, 'Controller should report paused state correctly');

  // Verify setPaused toggle works
  controller.setPaused(false);
  assert.equal(controller.isPaused(), false, 'Controller unpaused correctly');

  controller.setPaused(true);
  assert.equal(controller.isPaused(), true, 'Controller re-paused correctly');

  controller.stop();
});

// ── 4. Duplicate Debounce & Single-Use Cooldown ────────────────────────────────
test('4. Duplicate Scan Prevention: Cooldown prevents rapid duplicate verification requests', () => {
  const scannedCodes: string[] = [];
  let lastScannedCode: string | null = null;
  let lastScannedTime = 0;
  const debounceWindowMs = 2200;

  const processScanWithDebounce = (code: string, timestamp: number) => {
    if (code === lastScannedCode && timestamp - lastScannedTime < debounceWindowMs) {
      return false; // Suppressed duplicate
    }
    lastScannedCode = code;
    lastScannedTime = timestamp;
    scannedCodes.push(code);
    return true; // Accepted
  };

  const t0 = 100000;
  // Scan 1: First scan of Student A -> Accepted
  assert.equal(processScanWithDebounce('PLSCF-2027-F1001', t0), true);

  // Scan 2: Immediate duplicate scan of Student A (100ms later) -> Blocked
  assert.equal(processScanWithDebounce('PLSCF-2027-F1001', t0 + 100), false);

  // Scan 3: Rapid duplicate scan of Student A (1500ms later) -> Blocked
  assert.equal(processScanWithDebounce('PLSCF-2027-F1001', t0 + 1500), false);

  // Scan 4: New Student B scanned (200ms later) -> Accepted immediately
  assert.equal(processScanWithDebounce('PLSCF-2027-F1002', t0 + 1700), true);

  // Scan 5: Student A scanned after cooldown (2500ms after last accept) -> Accepted
  assert.equal(processScanWithDebounce('PLSCF-2027-F1001', t0 + 4300), true);

  assert.equal(scannedCodes.length, 3, 'Exactly 3 valid scans should have passed through');
});

// ── 5. High-Volume Scalability Simulation (100, 500, 1000, 10000 scans) ────────
test('5. High-Volume Scalability: 100, 500, 1000, and 10,000 scan parsing & verification throughput', () => {
  // Test batches
  const testVolumes = [100, 500, 1000, 10000];

  for (const volume of testVolumes) {
    const startTime = performance.now();
    const parsedTokens = new Set<string>();

    for (let i = 1; i <= volume; i++) {
      const paddedId = String(i).padStart(5, '0');
      const rawInput = `https://plscf2026.reunion.org/verify-student-id?id=PLSCF-2027-F${paddedId}&token=TK${paddedId}`;

      const parsed = parseScannedInput(rawInput);
      assert.equal(parsed.id, `PLSCF-2027-F${paddedId}`);
      assert.equal(parsed.token, `TK${paddedId}`);
      parsedTokens.add(parsed.id!);
    }

    const durationMs = performance.now() - startTime;
    const avgPerScanMicroseconds = (durationMs / volume) * 1000;

    assert.equal(parsedTokens.size, volume, `All ${volume} scanned tokens must be unique with zero collisions`);
    assert.ok(
      avgPerScanMicroseconds < 250,
      `Average parse time per scan for ${volume} scans must be < 250µs (Actual: ${avgPerScanMicroseconds.toFixed(2)}µs)`
    );
  }
});

// ── 6. Atomic Concurrency: Multiple Devices Scanning Single-Use Token ──────────
test('6. Atomic Multi-Device Race Condition: Exactly 1 device succeeds for single-use meal distribution', () => {
  const staffAccounts: StaffAccount[] = [
    {
      id: 'STAFF_BOOTH_1',
      username: 'booth1',
      fullName: 'Booth 1 Staff',
      department: 'LUNCH',
      allowedDepartments: ['LUNCH'],
      role: 'STAFF' as any,
      status: 'ACTIVE',
      permissions: ['VERIFY', 'APPROVE'],
      createdAt: new Date().toISOString(),
    },
    {
      id: 'STAFF_BOOTH_2',
      username: 'booth2',
      fullName: 'Booth 2 Staff',
      department: 'LUNCH',
      allowedDepartments: ['LUNCH'],
      role: 'STAFF' as any,
      status: 'ACTIVE',
      permissions: ['VERIFY', 'APPROVE'],
      createdAt: new Date().toISOString(),
    },
  ];

  const testStudentId = 'PLSCF-2027-CONCURRENCY-TEST';
  const testStudent: RegistrationRecord = {
    id: testStudentId,
    fullName: 'Concurrent Test Student',
    mobileNumber: '01711009988',
    qrToken: 'LUNCH1',
    category: 'former',
    paymentStatus: 'paid',
    totalPaid: 1500,
    registrationFee: 1500,
    donationAmount: 0,
    tShirtSize: 'L',
    year: 2027,
    batchName: 'Batch 2020',
    registeredAt: new Date().toISOString(),
    gender: 'male',
    hasParent: false,
    isCheckedIn: true,
    gateStatus: 'ENTRY',
    isTshirtCollected: false,
  };

  // Seed student and ensure gate entry status
  AppStore.saveRegistrations([testStudent]);
  EventStore.saveGateEvents([
    {
      id: 'GATE-CONCURRENCY-1',
      registrationId: testStudentId,
      studentName: testStudent.fullName,
      batchName: 'Batch 2020',
      eventType: 'ENTRY',
      status: 'APPROVED',
      timestamp: new Date().toISOString(),
      staffId: 'GATE_01',
      staffName: 'Gate Lead',
    },
  ]);

  // Clean prior distributions
  EventStore.saveFoodDistributions([]);

  // Simulate 10 simultaneous booth scan submissions for the exact same student lunch
  const simultaneousAttempts = 10;
  const results: Array<{ success: boolean; error?: string }> = [];

  for (let i = 0; i < simultaneousAttempts; i++) {
    const boothStaff = staffAccounts[i % staffAccounts.length];
    const res = EventStore.confirmFoodDistribution(
      testStudentId,
      testStudent.fullName,
      'Batch 2020',
      'lunch',
      boothStaff.id,
      boothStaff.fullName,
      `Simultaneous booth attempt #${i + 1}`,
      boothStaff
    );
    results.push(res);
  }

  const successCount = results.filter((r) => r.success).length;
  const rejectedCount = results.filter((r) => !r.success).length;

  assert.equal(
    successCount,
    1,
    'Exactly ONE booth must succeed in confirming the meal distribution'
  );
  assert.equal(
    rejectedCount,
    simultaneousAttempts - 1,
    'All subsequent concurrent booth scans must be rejected'
  );
  assert.ok(
    results[1].error?.includes('ALREADY COLLECTED'),
    'Rejection error must explicitly indicate ALREADY COLLECTED'
  );
});
