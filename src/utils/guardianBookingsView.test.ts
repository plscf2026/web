import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GuardianBookingRecord,
  countConfirmedGuardianBookings,
  getGuardianGateStatus,
  getGuardianMealStatus,
  groupGuardiansByStudent,
  matchesStudentOrGuardianSearch,
  resolveGuardianContact,
  resolveGuardianDisplayId,
  resolveGuardianRelation,
} from './guardianBookingsView';
import { FoodDistributionRecord, GateEventRecord, RegistrationRecord } from '../types';

function makeStudent(overrides: Partial<RegistrationRecord> = {}): RegistrationRecord {
  return {
    id: 'PLSCF-2027-F1001',
    fullName: 'Ayesha Rahman',
    photoUrl: '',
    mobileNumber: '01711111111',
    email: null,
    address: 'Faridpur',
    gender: 'female',
    category: 'former',
    batchName: 'SSC 2020',
    tShirtSize: 'M',
    registrationFee: 1500,
    donationAmount: 0,
    totalPaid: 1500,
    paymentStatus: 'paid',
    transactionId: 'TRX-1',
    paymentMethod: 'card',
    registeredAt: '2026-11-28T00:00:00Z',
    qrToken: 'STU001',
    isTShirtCollected: false,
    year: 2027,
    ...overrides,
  };
}

function makeGuardian(overrides: Partial<GuardianBookingRecord> = {}): GuardianBookingRecord {
  return {
    id: 'PLSCF-2027-G1001',
    registration_id: 'PLSCF-2027-G1001',
    student_registration_id: 'PLSCF-2027-F1001',
    event_id: 'PLSCF-2027',
    year: 2027,
    guardian_name: 'Kamrul Rahman',
    mobile_number: '01911111111',
    guardian_phone: '01911111111',
    relation: 'Father',
    guardian_relation: 'Father',
    guardian_fee: 1500,
    total_paid: 1500,
    payment_status: 'paid',
    registration_approval_status: 'approved',
    gate_status: 'NOT_ENTERED',
    is_checked_in: false,
    ...overrides,
  };
}

test('1. Zero, one, and multiple guardians per student + deduplication against retries/duplicates', () => {
  const g1 = makeGuardian({ id: 'PLSCF-2027-G1001', student_registration_id: 'PLSCF-2027-F1001' });
  const g2 = makeGuardian({
    id: 'PLSCF-2027-G1002',
    registration_id: 'PLSCF-2027-G1002',
    student_registration_id: 'PLSCF-2027-F1001',
    guardian_name: 'Salma Rahman',
    relation: 'Mother',
  });
  // Duplicate retry row with same guardian ID must NOT inflate total
  const g1Retry = makeGuardian({ id: 'PLSCF-2027-G1001', student_registration_id: 'PLSCF-2027-F1001' });
  // Unpaid or rejected or different-year guardians must NOT be counted as confirmed
  const unpaid = makeGuardian({ id: 'PLSCF-2027-G1003', payment_status: 'pending' });
  const rejected = makeGuardian({ id: 'PLSCF-2027-G1004', registration_approval_status: 'rejected' });
  const otherYear = makeGuardian({ id: 'PLSCF-2027-G1005', year: 2026 });

  const all = [g1, g2, g1Retry, unpaid, rejected, otherYear];
  assert.equal(countConfirmedGuardianBookings(all, 2027), 2);

  const grouped = groupGuardiansByStudent(all, 2027);
  // Zero guardians for student without links
  assert.equal((grouped.get('PLSCF-2027-F9999') || []).length, 0);
  // Multiple guardians grouped under the same student, deduplicated by unique ID
  assert.equal((grouped.get('PLSCF-2027-F1001') || []).length, 4); // g1, g2, unpaid, rejected (same year, distinct IDs)
});

test('2. Fallback resolution: registration_id -> id, mobile_number -> guardian_phone, relation -> guardian_relation', () => {
  const blankRegAndMobile = makeGuardian({
    id: 'PLSCF-2027-G9121',
    registration_id: null,
    mobile_number: '',
    guardian_phone: '01987489032',
    relation: 'Guardian',
    guardian_relation: 'Father',
  });

  assert.equal(resolveGuardianDisplayId(blankRegAndMobile), 'PLSCF-2027-G9121');
  assert.equal(resolveGuardianContact(blankRegAndMobile), '01987489032');
  assert.equal(resolveGuardianRelation(blankRegAndMobile), 'Father');
});

test('3. Gate and meal tracking read via guardian own identity and fall back to Unavailable when lacking', () => {
  const g = makeGuardian({
    id: 'PLSCF-2027-G2001',
    registration_id: 'PLSCF-2027-G2001',
    gate_status: null,
    is_checked_in: null,
  });

  // Lacks gate status and food sync -> Unavailable
  assert.equal(getGuardianGateStatus(g, []), 'UNAVAILABLE');
  assert.equal(getGuardianMealStatus(g, 'breakfast', [], false), 'UNAVAILABLE');

  // With guardian-specific gate_events and food_distributions
  const gateEvents: GateEventRecord[] = [
    {
      id: 'GE-1',
      registrationId: 'PLSCF-2027-G2001',
      studentName: 'Kamrul Rahman',
      batchName: 'Guardian',
      eventType: 'ENTRY',
      timestamp: '2026-11-28T09:00:00Z',
      gateId: 'Gate 01',
      staffId: 'STF-1',
      staffName: 'Gate Staff',
      status: 'APPROVED',
    },
  ];
  const foodDistributions: FoodDistributionRecord[] = [
    {
      id: 'FD-1',
      registrationId: 'PLSCF-2027-G2001',
      studentName: 'Kamrul Rahman',
      batchName: 'Guardian',
      mealType: 'breakfast',
      status: 'COLLECTED',
      collectedAt: '2026-11-28T09:30:00Z',
      staffId: 'STF-2',
      staffName: 'Food Staff',
    },
  ];

  assert.equal(getGuardianGateStatus(g, gateEvents), 'ENTRY');
  assert.equal(getGuardianMealStatus(g, 'breakfast', foodDistributions, true), 'TAKEN');
  assert.equal(getGuardianMealStatus(g, 'lunch', foodDistributions, true), 'PENDING');
  assert.equal(getGuardianMealStatus(g, 'dinner', foodDistributions, true), 'PENDING');
});

test('4. Search keeps guardians grouped with their student and pagination/fetch independence holds', () => {
  const s1 = makeStudent({ id: 'PLSCF-2027-F1001', fullName: 'Ayesha Rahman' });
  const s2 = makeStudent({ id: 'PLSCF-2027-F1002', fullName: 'Nadia Islam' });
  const g1 = makeGuardian({ id: 'PLSCF-2027-G1001', student_registration_id: 'PLSCF-2027-F1001', guardian_name: 'Kamrul Rahman' });

  // Searching by guardian name or guardian ID still matches the parent student s1
  assert.equal(matchesStudentOrGuardianSearch(s1, [g1], 'Kamrul'), true);
  assert.equal(matchesStudentOrGuardianSearch(s1, [g1], 'PLSCF-2027-G1001'), true);
  assert.equal(matchesStudentOrGuardianSearch(s2, [], 'Kamrul'), false);

  // Event-wide total across all guardians is independent of which student page is currently rendered
  const guardians = [g1, makeGuardian({ id: 'PLSCF-2027-G1002', student_registration_id: 'PLSCF-2027-F1002' })];
  assert.equal(countConfirmedGuardianBookings(guardians, 2027), 2);
});
