import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AppStore } from '../services/store';
import { IdCardStore } from '../services/idCardStore';
import { StudentIdService } from '../services/studentIdStore';
import { RegistrationRecord } from '../types';

test('1. Registration Deletion: AppStore deletes and tombstones registration', () => {
  const testReg: RegistrationRecord = {
    id: 'PLSCF-2027-TEST-DEL01',
    fullName: 'Test Student Deletion',
    mobileNumber: '01700998877',
    category: 'former',
    paymentStatus: 'paid',
    registrationFee: 1500,
    totalPaid: 1500,
    year: 2027,
    tShirtSize: 'XL',
    address: 'Dhaka',
    batchName: 'SSC 2010',
    qrToken: 'DEL001',
    photoUrl: 'data:image/png;base64,sample',
  };

  // Add registration
  AppStore.addRegistration(testReg, 2027);
  assert.ok(AppStore.getRegistrations().some((r) => r.id === testReg.id));

  // Delete registration
  const success = AppStore.deleteRegistration(testReg.id, 2027);
  assert.equal(success, true);

  // Verify it is tombstoned
  assert.equal(AppStore.isRegistrationDeleted(testReg.id), true);
  assert.ok(AppStore.getDeletedRegistrationIds().has(testReg.id));

  // Verify it no longer appears in getRegistrations()
  assert.equal(AppStore.getRegistrations().some((r) => r.id === testReg.id), false);
});

test('2. Registration Deletion: Tombstoned registration is never resurrected during merge', () => {
  const testId = 'PLSCF-2027-TEST-DEL02';
  AppStore.markRegistrationDeleted(testId);
  assert.equal(AppStore.isRegistrationDeleted(testId), true);

  // Even if an external source attempts to pass it in saveRegistrations
  AppStore.saveRegistrations([
    {
      id: testId,
      fullName: 'Zombie Student',
      mobileNumber: '01800112233',
      category: 'former',
      paymentStatus: 'paid',
      registrationFee: 1500,
      totalPaid: 1500,
      year: 2027,
      tShirtSize: 'M',
      address: 'Dhaka',
      batchName: 'SSC 2012',
      qrToken: 'ZMB001',
      photoUrl: 'data:image/png;base64,sample',
    },
  ]);

  // It must be rejected and filtered out
  assert.equal(AppStore.getRegistrations().some((r) => r.id === testId), false);
});

test('3. ID Card Cleanup: IdCardStore removes deleted student ID card', () => {
  const regId = 'PLSCF-2027-TEST-CARD01';
  const sampleCard: any = {
    cardId: 'CARD-TEST-001',
    registrationId: regId,
    studentName: 'Card Student',
    batchName: '2020',
    batchYear: '2020',
    idNumber: 'STU-001',
    category: 'former',
    qrToken: 'CRD001',
    photoUrl: 'data:image/png;base64,sample',
    cardStatus: 'GENERATED',
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  IdCardStore.saveIdCards([sampleCard]);
  assert.ok(IdCardStore.getIdCards().some((c) => c.registrationId === regId));

  // Remove card by registration ID
  IdCardStore.removeCardByRegistrationId(regId);
  assert.equal(IdCardStore.getIdCards().some((c) => c.registrationId === regId), false);
});

test('4. Student ID Release: Used Student ID returns to AVAILABLE upon deletion', () => {
  const sId = 'TEST-SID-999';
  StudentIdService.addStudentId({
    studentId: sId,
    studentName: 'Current Student Test',
    className: 'Class 10',
    academicYear: '2027',
  });

  // Mark as USED
  StudentIdService.markStudentIdUsed(sId, 'PLSCF-2027-F9999');
  assert.equal(StudentIdService.verifyStudentId(sId).status, 'ALREADY_USED');

  // Release on deletion
  const released = StudentIdService.releaseReservation(sId);
  assert.equal(released, true);
  assert.equal(StudentIdService.verifyStudentId(sId).status, 'AVAILABLE');
});
