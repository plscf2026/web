import test from 'node:test';
import assert from 'node:assert/strict';
import { EventStore } from '../services/eventStore';
import { AppStore } from '../services/store';
import { validateGateAction } from './eventRules';
import { RegistrationRecord } from '../types';

test('Gate Attendance & Record Back Synchronization', async (t) => {
  const mockStudent: RegistrationRecord = {
    id: 'PLSCF-2027-F9999',
    fullName: 'Test Gate Student',
    photoUrl: '',
    address: 'Faridpur',
    category: 'former',
    batchName: 'SSC 2015',
    mobileNumber: '01700000000',
    tShirtSize: 'L',
    registrationFee: 1500,
    donationAmount: 0,
    totalPaid: 1500,
    paymentStatus: 'paid',
    transactionId: 'TRX-TEST-999',
    paymentMethod: 'bkash',
    qrToken: 'GT9999',
    registeredAt: new Date().toISOString(),
    year: 2027,
    isTShirtCollected: false,
    isCheckedIn: false,
    gateStatus: 'NOT_ENTERED',
  };

  AppStore.saveRegistrations([mockStudent]);

  await t.test('1. When student has not entered, validateGateAction permits ENTRY and blocks BACK', () => {
    const entryValidation = validateGateAction(mockStudent, false, 'ENTRY');
    assert.equal(entryValidation.allowed, true, 'ENTRY must be allowed when outside');

    const backValidation = validateGateAction(mockStudent, false, 'BACK');
    assert.equal(backValidation.allowed, false, 'BACK must be blocked when student is outside');
    assert.equal(backValidation.code, 'NOT_INSIDE');
  });

  await t.test('2. Gate operator records ENTRY -> status becomes ENTRY and isInside is true', () => {
    const res = EventStore.recordGateEvent(
      mockStudent.id,
      mockStudent.fullName,
      mockStudent.batchName,
      undefined,
      'ENTRY',
      'Gate 01 - Main Entrance',
      'SCANNER-01',
      'STF-GATE-01',
      'Gate Operator'
    );

    assert.equal(res.success, true);
    assert.equal(res.event?.eventType, 'ENTRY');

    const liveStatus = EventStore.getStudentGateStatus(mockStudent.id);
    assert.equal(liveStatus, 'ENTRY');
    assert.equal(EventStore.isStudentCurrentlyInside(mockStudent.id), true);

    const updatedReg = AppStore.findRegistration(mockStudent.id);
    assert.equal(updatedReg?.isCheckedIn, true);
    assert.equal(updatedReg?.gateStatus, 'ENTRY');
  });

  await t.test('3. When student is INSIDE, validateGateAction permits BACK and blocks duplicate ENTRY', () => {
    const entryValidation = validateGateAction(mockStudent, true, 'ENTRY');
    assert.equal(entryValidation.allowed, false, 'Duplicate ENTRY must be blocked');
    assert.equal(entryValidation.code, 'ALREADY_INSIDE');

    const backValidation = validateGateAction(mockStudent, true, 'BACK');
    assert.equal(backValidation.allowed, true, 'BACK must be permitted when student is inside');
  });

  await t.test('4. Gate operator records BACK -> status becomes BACK and isInside is false', () => {
    const res = EventStore.recordGateEvent(
      mockStudent.id,
      mockStudent.fullName,
      mockStudent.batchName,
      undefined,
      'BACK',
      'Gate 01 - Main Entrance',
      'SCANNER-01',
      'STF-GATE-01',
      'Gate Operator'
    );

    assert.equal(res.success, true);
    assert.equal(res.event?.eventType, 'BACK');

    const liveStatus = EventStore.getStudentGateStatus(mockStudent.id);
    assert.equal(liveStatus, 'BACK', 'Live gate status must be BACK');
    assert.equal(EventStore.isStudentCurrentlyInside(mockStudent.id), false, 'Student must no longer be inside');

    const updatedReg = AppStore.findRegistration(mockStudent.id);
    assert.equal(updatedReg?.isCheckedIn, false, 'isCheckedIn must be false after BACK');
    assert.equal(updatedReg?.gateStatus, 'BACK', 'gateStatus must be BACK in store');
  });

  await t.test('5. Re-entry after BACK works seamlessly: student can record ENTRY again', () => {
    const entryValidation = validateGateAction(mockStudent, false, 'ENTRY');
    assert.equal(entryValidation.allowed, true, 'ENTRY must be allowed again after BACK');

    const res = EventStore.recordGateEvent(
      mockStudent.id,
      mockStudent.fullName,
      mockStudent.batchName,
      undefined,
      'ENTRY',
      'Gate 01 - Main Entrance',
      'SCANNER-01',
      'STF-GATE-01',
      'Gate Operator'
    );

    assert.equal(res.success, true);
    assert.equal(EventStore.getStudentGateStatus(mockStudent.id), 'ENTRY');
    assert.equal(EventStore.isStudentCurrentlyInside(mockStudent.id), true);
  });
});
