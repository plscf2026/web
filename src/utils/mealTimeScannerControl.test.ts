import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_MEAL_SCHEDULE_CONFIG,
  getDhakaTimeParts,
  formatTime24to12,
  evaluateMealScannerStatus,
  MealScheduleConfig,
} from '../types/mealControl';
import { MealControlService } from '../services/mealControlService';
import { validateMealCollection } from './eventRules';
import { EventStore } from '../services/eventStore';
import { GuestService } from '../services/guestService';
import { StudentRegistration } from '../types';

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

// ==========================================
// TEST SUITE: MEAL TIME & SCANNER CONTROL SYSTEM
// ==========================================

test('1. Timezone: Bangladesh Standard Time (Asia/Dhaka) Extraction', () => {
  // 2027-01-01 04:30:00 UTC -> 10:30:00 AM Asia/Dhaka (+6 hours)
  const utcDate = new Date('2027-01-01T04:30:00.000Z');
  const dhakaParts = getDhakaTimeParts(utcDate);

  assert.equal(dhakaParts.hours, 10);
  assert.equal(dhakaParts.minutes, 30);
  assert.equal(dhakaParts.time24, '10:30');
  assert.equal(dhakaParts.time12, '10:30 AM');

  // 12-hour format helper
  assert.equal(formatTime24to12('07:00'), '7:00 AM');
  assert.equal(formatTime24to12('12:00'), '12:00 PM');
  assert.equal(formatTime24to12('15:00'), '3:00 PM');
  assert.equal(formatTime24to12('19:00'), '7:00 PM');
  assert.equal(formatTime24to12('22:00'), '10:00 PM');
});

test('2. SCHEDULED Mode: Active within schedule window', () => {
  const schedule = {
    enabled: true,
    mode: 'SCHEDULED' as const,
    startTime: '07:00',
    endTime: '10:00',
  };

  // Exactly inside window at 08:30 AM Dhaka (02:30 UTC)
  const insideDate = new Date('2027-01-01T02:30:00.000Z');
  const status = evaluateMealScannerStatus('breakfast', schedule, insideDate);

  assert.equal(status.isOpen, true);
  assert.equal(status.status, 'ACTIVE');
  assert.equal(status.mode, 'SCHEDULED');
});

test('3. SCHEDULED Mode: Timeout when before or after schedule window', () => {
  const schedule = {
    enabled: true,
    mode: 'SCHEDULED' as const,
    startTime: '07:00',
    endTime: '10:00',
  };

  // 06:15 AM Dhaka (00:15 UTC) -> Before start
  const beforeDate = new Date('2027-01-01T00:15:00.000Z');
  const statusBefore = evaluateMealScannerStatus('breakfast', schedule, beforeDate);

  assert.equal(statusBefore.isOpen, false);
  assert.equal(statusBefore.status, 'TIMEOUT');
  assert.ok(statusBefore.reasonEn.includes('Time Out'));
  assert.ok(statusBefore.reasonEn.includes('7:00 AM'));

  // 10:15 AM Dhaka (04:15 UTC) -> After end
  const afterDate = new Date('2027-01-01T04:15:00.000Z');
  const statusAfter = evaluateMealScannerStatus('breakfast', schedule, afterDate);

  assert.equal(statusAfter.isOpen, false);
  assert.equal(statusAfter.status, 'TIMEOUT');
  assert.ok(statusAfter.reasonEn.includes('Time Out'));
  assert.ok(statusAfter.reasonEn.includes('closed at'));
});

test('4. MANUAL_ON Mode: Active outside scheduled hours', () => {
  const schedule = {
    enabled: true,
    mode: 'MANUAL_ON' as const,
    startTime: '07:00',
    endTime: '10:00',
  };

  // 02:00 AM Dhaka (20:00 UTC previous day) - Normally closed, but Manual ON forces active
  const nightDate = new Date('2027-01-01T20:00:00.000Z');
  const status = evaluateMealScannerStatus('breakfast', schedule, nightDate);

  assert.equal(status.isOpen, true);
  assert.equal(status.status, 'ACTIVE');
  assert.equal(status.mode, 'MANUAL_ON');
  assert.ok(status.reasonEn.includes('Manual override'));
});

test('5. MANUAL_OFF Mode: Timeout even during scheduled hours', () => {
  const schedule = {
    enabled: true,
    mode: 'MANUAL_OFF' as const,
    startTime: '07:00',
    endTime: '10:00',
  };

  // 08:30 AM Dhaka - Inside window, but Manual OFF strictly overrides and halts scanner
  const insideDate = new Date('2027-01-01T02:30:00.000Z');
  const status = evaluateMealScannerStatus('breakfast', schedule, insideDate);

  assert.equal(status.isOpen, false);
  assert.equal(status.status, 'TIMEOUT');
  assert.equal(status.mode, 'MANUAL_OFF');
  assert.ok(status.reasonEn.includes('Time Out'));
  assert.ok(status.reasonEn.includes('disabled by Super Admin'));
});

test('6. Disabled Toggle: Master OFF overrides all modes to Timeout', () => {
  const schedule = {
    enabled: false,
    mode: 'MANUAL_ON' as const, // Even if set to Manual ON, enabled=false halts
    startTime: '07:00',
    endTime: '10:00',
  };

  const testDate = new Date('2027-01-01T02:30:00.000Z');
  const status = evaluateMealScannerStatus('breakfast', schedule, testDate);

  assert.equal(status.isOpen, false);
  assert.equal(status.status, 'TIMEOUT');
  assert.ok(status.reasonEn.includes('Time Out'));
  assert.ok(status.reasonEn.includes('disabled'));
});

test('7. MealControlService: State mutations & live evaluation', () => {
  // Test mode changes
  MealControlService.setScannerMode('lunch', 'MANUAL_OFF');
  assert.equal(MealControlService.isMealScannerOpen('lunch'), false);

  MealControlService.setScannerMode('lunch', 'MANUAL_ON');
  assert.equal(MealControlService.isMealScannerOpen('lunch'), true);

  // Toggle enable
  MealControlService.toggleEnabled('lunch', false);
  assert.equal(MealControlService.isMealScannerOpen('lunch'), false);

  // Reset to default
  MealControlService.toggleEnabled('lunch', true);
  MealControlService.setScannerMode('lunch', 'SCHEDULED');
});

test('8. validateMealCollection: Rejects with TIMEOUT when scanner is closed', () => {
  const mockStudent: StudentRegistration = {
    id: 'PLSCF-2027-MOCK1',
    fullName: 'Test Attendee',
    email: 'test@example.com',
    phone: '01700000000',
    passingYear: '2015',
    category: 'alumni',
    paymentStatus: 'paid',
    registrationFee: 1000,
    registrationDate: new Date().toISOString(),
    gender: 'male',
  };

  // Set dinner to MANUAL_OFF
  MealControlService.setScannerMode('dinner', 'MANUAL_OFF');

  // Verify validateMealCollection with checkMealSchedule flag returns TIMEOUT
  const res = validateMealCollection(
    mockStudent,
    'dinner',
    [],
    new Date(),
    'ENTRY',
    { checkMealSchedule: true }
  );

  assert.equal(res.canCollect, false);
  assert.equal(res.status, 'TIMEOUT');
  assert.ok(res.messageEn.includes('Time Out'));

  // Reset dinner to SCHEDULED
  MealControlService.setScannerMode('dinner', 'SCHEDULED');
});

test('9. EventStore.confirmFoodDistribution: Rejects when scanner is in TIMEOUT', () => {
  // Set breakfast to MANUAL_OFF
  MealControlService.setScannerMode('breakfast', 'MANUAL_OFF');

  const res = EventStore.confirmFoodDistribution(
    'PLSCF-2027-TIMEOUT-TEST',
    'Timeout Attendee',
    'Class 10',
    'breakfast',
    'STAFF-01',
    'Staff Desk',
    undefined,
    undefined,
    { checkSchedule: true }
  );

  assert.equal(res.success, false);
  assert.ok(res.error?.includes('Time Out'));

  // Reset breakfast
  MealControlService.setScannerMode('breakfast', 'SCHEDULED');
});

test('10. GuestService.collectMeal: Rejects with TIMEOUT when scanner is in TIMEOUT', async () => {
  // Generate a test guest card batch
  const batchRes = await GuestService.generateBatch(1, 'VIP Chief Guest', 'Super Admin', 'Test VIP Batch');
  assert.equal(batchRes.success, true);
  const card = batchRes.cards![0];

  // Activate guest at gate first so they are eligible
  const activateRes = await GuestService.activateGuestCard(card.id, card.token);
  assert.equal(activateRes.success, true);

  // Set lunch to MANUAL_OFF
  MealControlService.setScannerMode('lunch', 'MANUAL_OFF');

  const collectRes = await GuestService.collectMeal(
    card.id,
    'lunch',
    card.token,
    'OPERATOR-01',
    'Staff Desk',
    'Counter 1',
    { checkSchedule: true }
  );

  assert.equal(collectRes.success, false);
  assert.equal(collectRes.errorType, 'TIMEOUT');
  assert.ok(collectRes.error?.includes('Time Out'));

  // Set lunch to MANUAL_ON
  MealControlService.setScannerMode('lunch', 'MANUAL_ON');

  const activeRes = await GuestService.collectMeal(
    card.id,
    'lunch',
    card.token,
    'OPERATOR-01',
    'Staff Desk',
    'Counter 1',
    { checkSchedule: true }
  );
  assert.equal(activeRes.success, true);

  // Reset lunch
  MealControlService.setScannerMode('lunch', 'SCHEDULED');
});
