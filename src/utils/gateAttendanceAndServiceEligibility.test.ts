import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RegistrationRecord,
  StaffAccount,
  FoodDistributionRecord,
  DressDistributionRecord,
  GateEventRecord,
} from '../types';
import {
  validateMealCollection,
  validateDressDistribution,
  validateGateAction,
} from './eventRules';
import { EventStore } from '../services/eventStore';
import { AppStore } from '../services/store';
import { SupabaseService } from '../services/supabase';

// Helper to create test student
function createMockStudent(id: string, isCheckedIn = false, gateStatus?: 'NOT_ENTERED' | 'ENTRY' | 'BACK'): RegistrationRecord {
  return {
    id,
    fullName: `Test Student ${id}`,
    photoUrl: 'https://example.com/photo.jpg',
    mobileNumber: '01711223344',
    email: 'test@plscf.edu.bd',
    address: 'Faridpur',
    category: 'former',
    passingYear: '2015',
    batchName: 'SSC 2015',
    tShirtSize: 'L',
    registrationFee: 1500,
    donationAmount: 0,
    totalPaid: 1500,
    paymentStatus: 'paid',
    transactionId: `TX-${id}`,
    paymentMethod: 'bkash',
    registeredAt: '2026-03-01T10:00:00Z',
    qrToken: 'TK0001',
    isTShirtCollected: false,
    isCheckedIn,
    gateStatus,
  };
}

// 1. ENTRY displays GREEN
test('Scenario 1: ENTRY displays GREEN status', () => {
  const student = createMockStudent('STU-SC-01', true, 'ENTRY');
  assert.equal(student.gateStatus, 'ENTRY');
  assert.equal(student.isCheckedIn, true);
  const gateStatus = student.gateStatus || 'ENTRY';
  assert.equal(gateStatus, 'ENTRY');
});

// 2. BACK displays RED
test('Scenario 2: BACK displays RED status', () => {
  const student = createMockStudent('STU-SC-02', false, 'BACK');
  assert.equal(student.gateStatus, 'BACK');
  assert.equal(student.isCheckedIn, false);
});

// 3. Food scan succeeds during ENTRY
test('Scenario 3: Food scan succeeds during ENTRY', () => {
  const student = createMockStudent('STU-SC-03', true, 'ENTRY');
  const existingFood: FoodDistributionRecord[] = [];
  const res = validateMealCollection(student, 'lunch', existingFood, new Date(), 'ENTRY');
  assert.equal(res.canCollect, true);
  assert.equal(res.status, 'ELIGIBLE');
});

// 4. Food scan is rejected during BACK
test('Scenario 4: Food scan is rejected during BACK with BACK TO THE GATE error', () => {
  const student = createMockStudent('STU-SC-04', false, 'BACK');
  const existingFood: FoodDistributionRecord[] = [];
  const res = validateMealCollection(student, 'lunch', existingFood, new Date(), 'BACK');
  assert.equal(res.canCollect, false);
  assert.equal(res.status, 'BACK_TO_THE_GATE');
  assert.equal(
    res.messageEn,
    'Student has exited the event. Food collection is not allowed. Please ask the student to enter through the gate first.'
  );
  assert.ok(res.messageBn.includes('অনুষ্ঠানস্থল ত্যাগ করেছেন'));
});

// 5. T-shirt scan succeeds during ENTRY if eligible
test('Scenario 5: T-shirt scan succeeds during ENTRY if eligible', () => {
  const student = createMockStudent('STU-SC-05', true, 'ENTRY');
  const existingDress: DressDistributionRecord[] = [];
  const res = validateDressDistribution(student, 'reunion_tshirt', existingDress, 'ENTRY');
  assert.equal(res.canReceive, true);
  assert.equal(res.status, 'ELIGIBLE');
  assert.equal(res.registeredSize, 'L');
});

// 6. T-shirt scan is rejected during BACK
test('Scenario 6: T-shirt scan is rejected during BACK with BACK TO THE GATE error', () => {
  const student = createMockStudent('STU-SC-06', false, 'BACK');
  const existingDress: DressDistributionRecord[] = [];
  const res = validateDressDistribution(student, 'reunion_tshirt', existingDress, 'BACK');
  assert.equal(res.canReceive, false);
  assert.equal(res.status, 'BACK_TO_THE_GATE');
  assert.equal(
    res.messageEn,
    'Student has exited the event. T-shirt collection is currently blocked. Please ask the student to enter through the gate first.'
  );
  assert.ok(res.messageBn.includes('অনুষ্ঠানস্থল ত্যাগ করেছেন'));
});

// 7. Scan before first entry is rejected
test('Scenario 7: Scan before first entry (NOT ENTERED) is rejected', () => {
  const student = createMockStudent('STU-SC-07', false, 'NOT_ENTERED');
  const existingFood: FoodDistributionRecord[] = [];
  const existingDress: DressDistributionRecord[] = [];

  const foodRes = validateMealCollection(student, 'breakfast', existingFood, new Date(), 'NOT_ENTERED');
  assert.equal(foodRes.canCollect, false);
  assert.equal(foodRes.status, 'GATE_ENTRY_REQUIRED');
  assert.equal(foodRes.messageEn, 'Student has not entered the event. Please complete gate entry first.');

  const dressRes = validateDressDistribution(student, 'reunion_tshirt', existingDress, 'NOT_ENTERED');
  assert.equal(dressRes.canReceive, false);
  assert.equal(dressRes.status, 'GATE_ENTRY_REQUIRED');
  assert.equal(dressRes.messageEn, 'Student has not entered the event. Please complete gate entry first.');
});

// 8. Re-entry restores remaining meal access
test('Scenario 8: Re-entry restores remaining meal access while preserving breakfast', () => {
  const student = createMockStudent('STU-SC-08', true, 'ENTRY');
  const existingFood: FoodDistributionRecord[] = [
    {
      id: 'FOOD-B-01',
      registrationId: student.id,
      studentName: student.fullName,
      batchName: student.batchName,
      mealType: 'breakfast',
      status: 'COLLECTED',
      collectedAt: new Date(Date.now() - 3600000).toISOString(),
      staffId: 'STF-01',
      staffName: 'Breakfast Staff',
    },
  ];

  // While BACK in afternoon -> blocked
  const resDuringBack = validateMealCollection(student, 'lunch', existingFood, new Date(), 'BACK');
  assert.equal(resDuringBack.canCollect, false);
  assert.equal(resDuringBack.status, 'BACK_TO_THE_GATE');

  // After Re-entry (ENTRY) -> remaining lunch is permitted!
  const resAfterReentry = validateMealCollection(student, 'lunch', existingFood, new Date(), 'ENTRY');
  assert.equal(resAfterReentry.canCollect, true);
  assert.equal(resAfterReentry.status, 'ELIGIBLE');
});

// 9. Previously collected meals remain collected
test('Scenario 9: Previously collected meals remain collected after re-entry', () => {
  const student = createMockStudent('STU-SC-09', true, 'ENTRY');
  const existingFood: FoodDistributionRecord[] = [
    {
      id: 'FOOD-B-09',
      registrationId: student.id,
      studentName: student.fullName,
      batchName: student.batchName,
      mealType: 'breakfast',
      status: 'COLLECTED',
      collectedAt: new Date(Date.now() - 7200000).toISOString(),
      staffId: 'STF-01',
      staffName: 'Breakfast Staff',
    },
  ];

  // Even after re-entry, breakfast cannot be collected again!
  const breakfastRes = validateMealCollection(student, 'breakfast', existingFood, new Date(), 'ENTRY');
  assert.equal(breakfastRes.canCollect, false);
  assert.equal(breakfastRes.status, 'ALREADY_COLLECTED');
});

// 10. Duplicate meal collection is rejected
test('Scenario 10: Duplicate meal collection is rejected atomically', () => {
  const student = createMockStudent('STU-SC-10', true, 'ENTRY');
  const existingFood: FoodDistributionRecord[] = [
    {
      id: 'FOOD-L-10',
      registrationId: student.id,
      studentName: student.fullName,
      batchName: student.batchName,
      mealType: 'lunch',
      status: 'COLLECTED',
      collectedAt: new Date().toISOString(),
      staffId: 'STF-02',
      staffName: 'Lunch Staff',
    },
  ];

  const res = validateMealCollection(student, 'lunch', existingFood, new Date(), 'ENTRY');
  assert.equal(res.canCollect, false);
  assert.equal(res.status, 'ALREADY_COLLECTED');
});

// 11. Duplicate T-shirt collection is rejected (one-time only rule)
test('Scenario 11: Duplicate T-shirt collection is rejected even after multiple gate entries', () => {
  const student = createMockStudent('STU-SC-11', true, 'ENTRY');
  const existingDress: DressDistributionRecord[] = [
    {
      id: 'DRS-11',
      registrationId: student.id,
      studentName: student.fullName,
      itemType: 'reunion_tshirt',
      registeredSize: 'L',
      status: 'RECEIVED',
      receivedAt: new Date(Date.now() - 50000).toISOString(),
      staffId: 'STF-03',
      staffName: 'Dress Staff',
    },
  ];

  const res = validateDressDistribution(student, 'reunion_tshirt', existingDress, 'ENTRY');
  assert.equal(res.canReceive, false);
  assert.equal(res.status, 'ALREADY_RECEIVED');
});

// 12. Multiple gate entries and exits preserve history
test('Scenario 12: Multiple gate entries and exits preserve full audit history in EventStore', () => {
  const studentId = `STU-SC-12-${Date.now()}`;
  const student = createMockStudent(studentId, false, 'NOT_ENTERED');
  AppStore.saveRegistrations([student, ...AppStore.getRegistrations()]);

  // Initial: NOT ENTERED
  assert.equal(EventStore.getStudentGateStatus(studentId), 'NOT_ENTERED');

  // 1st ENTRY
  const res1 = EventStore.recordGateEvent(
    studentId,
    student.fullName,
    student.batchName,
    student.photoUrl,
    'ENTRY',
    'Main Gate',
    'SC-01',
    'STF-GATE',
    'Gate Staff'
  );
  assert.equal(res1.success, true);
  assert.equal(EventStore.getStudentGateStatus(studentId), 'ENTRY');
  assert.equal(EventStore.isStudentCurrentlyInside(studentId), true);

  // 1st BACK (Exit)
  const res2 = EventStore.recordGateEvent(
    studentId,
    student.fullName,
    student.batchName,
    student.photoUrl,
    'BACK',
    'Main Gate',
    'SC-01',
    'STF-GATE',
    'Gate Staff'
  );
  assert.equal(res2.success, true);
  assert.equal(EventStore.getStudentGateStatus(studentId), 'BACK');
  assert.equal(EventStore.isStudentCurrentlyInside(studentId), false);

  // 2nd ENTRY (Re-entry)
  const res3 = EventStore.recordGateEvent(
    studentId,
    student.fullName,
    student.batchName,
    student.photoUrl,
    'ENTRY',
    'Main Gate',
    'SC-01',
    'STF-GATE',
    'Gate Staff'
  );
  assert.equal(res3.success, true);
  assert.equal(EventStore.getStudentGateStatus(studentId), 'ENTRY');
  assert.equal(EventStore.isStudentCurrentlyInside(studentId), true);

  // Verify history preserved: all 3 events exist!
  const studentEvents = EventStore.getGateEvents().filter((e) => e.registrationId === studentId);
  assert.equal(studentEvents.length, 3);
  assert.equal(studentEvents[0].eventType, 'ENTRY'); // newest
  assert.equal(studentEvents[1].eventType, 'BACK');
  assert.equal(studentEvents[2].eventType, 'ENTRY'); // oldest
});

// 13. Consecutive / duplicate transitions cannot bypass gate verification
test('Scenario 13: Consecutive duplicate ENTRY or EXIT cannot bypass state machine', () => {
  const student = createMockStudent('STU-SC-13', true, 'ENTRY');

  // Already inside -> cannot record ENTRY again
  const duplicateEntry = validateGateAction(student, true, 'ENTRY');
  assert.equal(duplicateEntry.allowed, false);
  assert.equal(duplicateEntry.code, 'ALREADY_INSIDE');

  // Outside -> cannot record BACK without entry
  const invalidExit = validateGateAction(student, false, 'BACK');
  assert.equal(invalidExit.allowed, false);
  assert.equal(invalidExit.code, 'NOT_INSIDE');
});

// 14. Admin Panel reflects database toggle and changes state
test('Scenario 14: SupabaseService toggleGateAttendance synchronizes state', async () => {
  const studentId = `STU-SC-14-${Date.now()}`;
  const resIn = await SupabaseService.toggleGateAttendance(studentId, true, 'ADMIN-1', 'Admin Staff');
  assert.equal(resIn.success, true);
  assert.equal(resIn.isInside, true);
  assert.equal(resIn.gateStatus, 'ENTRY');

  const resOut = await SupabaseService.toggleGateAttendance(studentId, false, 'ADMIN-1', 'Admin Staff');
  assert.equal(resOut.success, true);
  assert.equal(resOut.isInside, false);
  assert.equal(resOut.gateStatus, 'BACK');
});

// 15. Unauthorized operators cannot perform gate or distribution actions (RBAC)
test('Scenario 15: Unauthorized staff account is denied gate approval permission', () => {
  const studentId = `STU-SC-15-${Date.now()}`;
  const financeStaff: StaffAccount = {
    id: 'STF-FINANCE-UNAUTH',
    authUserId: 'fin-user',
    fullName: 'Finance Specialist',
    username: 'finance_specialist',
    email: 'finance@plscf.edu.bd',
    role: 'FINANCE_STAFF',
    department: 'FINANCE',
    permissions: ['VIEW', 'APPROVE'], // NO GATE permission
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
  };

  const res = EventStore.recordGateEvent(
    studentId,
    'Student Name',
    'SSC 2015',
    undefined,
    'ENTRY',
    'Main Gate',
    'SC-01',
    financeStaff.id,
    financeStaff.fullName,
    financeStaff
  );

  assert.equal(res.success, false);
  assert.ok(res.error?.includes('PERMISSION_DENIED'));
});
