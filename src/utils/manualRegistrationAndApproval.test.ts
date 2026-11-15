/**
 * Comprehensive Test Suite: Admin-Assisted Student Registration, Manual Ticket Generation & Super Admin Approval System
 * Police Lines High School & College, Faridpur — Grand Reunion 2027
 * 
 * Tests all 14 mandatory scenarios specified in Master Prompt Requirement 10:
 *  1. Admin creates a manual student registration without an amount.
 *  2. Ticket and QR code are generated successfully.
 *  3. QR code remains inactive before approval (scanner rejects, facilities blocked).
 *  4. Super Admin approves the registration.
 *  5. QR code becomes active.
 *  6. Student can use the ticket for authorized facilities (Gate, Food, Dress).
 *  7. Admin creates another registration with a financial amount.
 *  8. Amount remains pending (excluded from official treasury collection).
 *  9. Super Admin approves the registration but rejects the amount (Strict Independence).
 * 10. Verify that the rejected amount is not included in the financial dashboard.
 * 11. Super Admin separately approves a financial amount.
 * 12. Verify that the amount is added exactly once to the official total (idempotent, no double counting).
 * 13. Verify that rejected registrations cannot use their QR codes.
 * 14. Verify that existing online registrations and tickets remain unaffected.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { ManualRegistrationService } from '../services/manualRegistrationService';
import { AppStore } from '../services/store';
import { EventStore } from '../services/eventStore';
import { FinancialService } from '../services/financialService';
import { isValidSixCharToken } from './tokenGenerator';
import { RegistrationRecord, StaffAccount } from '../types';

// Authorized Test Staff for Facility Distribution
const gateStaff: StaffAccount = {
  id: 'STF-TEST-GATE',
  authUserId: 'gate-staff',
  fullName: 'Main Gate Officer',
  username: 'gate@plscf.edu.bd',
  email: 'gate@plscf.edu.bd',
  role: 'SUPER_ADMIN',
  department: 'ALL_SERVICES',
  permissions: ['VIEW', 'VERIFY', 'APPROVE'],
  status: 'ACTIVE',
  assignedGate: 'Gate 01',
  createdAt: '2026-01-01T00:00:00Z',
  createdBy: 'SUPER_ADMIN',
};

const foodStaff: StaffAccount = {
  id: 'STF-TEST-FOOD',
  authUserId: 'food-staff',
  fullName: 'Food Hall Officer',
  username: 'food@plscf.edu.bd',
  email: 'food@plscf.edu.bd',
  role: 'SUPER_ADMIN',
  department: 'ALL_SERVICES',
  permissions: ['VIEW', 'VERIFY', 'APPROVE', 'MANAGE'],
  status: 'ACTIVE',
  assignedGate: 'Dining Hall A',
  createdAt: '2026-01-01T00:00:00Z',
  createdBy: 'SUPER_ADMIN',
};

const dressStaff: StaffAccount = {
  id: 'STF-TEST-DRESS',
  authUserId: 'dress-staff',
  fullName: 'Kit Counter Officer',
  username: 'kit@plscf.edu.bd',
  email: 'kit@plscf.edu.bd',
  role: 'SUPER_ADMIN',
  department: 'ALL_SERVICES',
  permissions: ['VIEW', 'VERIFY', 'APPROVE', 'MANAGE'],
  status: 'ACTIVE',
  assignedGate: 'Counter 02',
  createdAt: '2026-01-01T00:00:00Z',
  createdBy: 'SUPER_ADMIN',
};

const deskAdmin = { id: 'ADM-DESK-01', name: 'Venue Desk Admin' };
const superAdmin = { id: 'ADM-SUPER-01', name: 'Convenor Super Admin' };

// Seed initial online registrations
const initialOnlineFixtures: RegistrationRecord[] = [
  {
    id: 'PLSCF-2027-F1001',
    fullName: 'Tanvir Ahmed',
    photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80',
    mobileNumber: '01711223344',
    email: 'tanvir.ahmed@example.com',
    address: 'Faridpur Sadar',
    category: 'former',
    passingYear: '1998',
    batchName: 'SSC 1998',
    tShirtSize: 'XL',
    registrationFee: 1500,
    donationAmount: 500,
    totalPaid: 2000,
    paymentStatus: 'paid',
    transactionId: 'PST-BK-8821901',
    paymentMethod: 'bkash',
    registeredAt: '2026-01-16T10:30:00Z',
    qrToken: 'A7K9M2',
    isTShirtCollected: false,
    isCheckedIn: false,
    gender: 'male',
    year: 2027,
  },
  {
    id: 'PLSCF-2027-F1002',
    fullName: 'Dr. Nusrat Jahan',
    photoUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&auto=format&fit=crop&q=80',
    mobileNumber: '01819887766',
    email: 'dr.nusrat@example.com',
    address: 'Medical College Road, Faridpur',
    category: 'former',
    passingYear: '2005',
    batchName: 'SSC 2005',
    tShirtSize: 'M',
    registrationFee: 1500,
    donationAmount: 0,
    totalPaid: 1500,
    paymentStatus: 'paid',
    transactionId: 'PST-CRD-9948201',
    paymentMethod: 'card',
    registeredAt: '2026-01-18T14:15:00Z',
    qrToken: 'R8W3N5',
    isTShirtCollected: false,
    isCheckedIn: false,
    gender: 'female',
    year: 2027,
  },
];

AppStore.saveRegistrations(initialOnlineFixtures);

test('Master Prompt Verification: 14 Scenarios for Manual Registration & Super Admin Approval', async (t) => {
  // Snapshot initial online registrations for Scenario 14 baseline check
  const initialOnlineCount = AppStore.getRegistrations().filter((r) => !r.isManualRegistration).length;
  assert.ok(initialOnlineCount > 0, 'Existing online registrations fixture must exist');

  let student1RegId = '';
  let student1QrToken = '';

  // --------------------------------------------------------------------------
  // Scenario 1: Admin creates a manual student registration without an amount
  // --------------------------------------------------------------------------
  await t.test('Scenario 1: Admin creates a manual student registration without an amount', async () => {
    const res = await ManualRegistrationService.createManualRegistration(
      {
        fullName: 'Asif Mahmud Joy',
        mobileNumber: '01711998877',
        category: 'former',
        batchName: 'SSC 2012',
        passingYear: '2012',
        tShirtSize: 'XL',
        gender: 'male',
        address: 'Faridpur Sadar',
        // Optional financial omitted
      },
      deskAdmin
    );

    assert.equal(res.success, true, 'Registration must be created successfully');
    assert.ok(res.registration, 'Returned record must exist');
    assert.equal(res.registration.isManualRegistration, true, 'isManualRegistration must be true');
    assert.equal(res.registration.registrationApprovalStatus, 'pending', 'Initial status must be PENDING');
    assert.equal(res.registration.financialApprovalStatus, 'none', 'Financial status must be none');
    assert.equal(res.registration.financialAmount, 0, 'Financial amount must be 0');
    assert.equal(res.registration.createdByAdminId, deskAdmin.id, 'Admin ID must be recorded');
    assert.equal(res.registration.createdByAdminName, deskAdmin.name, 'Admin name must be recorded');

    student1RegId = res.registration.id;
    student1QrToken = res.registration.qrToken;
  });

  // --------------------------------------------------------------------------
  // Scenario 2: Ticket and QR code are generated successfully
  // --------------------------------------------------------------------------
  await t.test('Scenario 2: Ticket and QR code are generated successfully', () => {
    assert.ok(student1RegId.startsWith('PLSCF-2027-F'), 'Unique registration ID formatted correctly');
    assert.equal(isValidSixCharToken(student1QrToken), true, 'QR token must be a valid 6-character token');
    assert.equal(student1QrToken.length, 6, 'Token length is exactly 6');

    // Stored in database
    const saved = AppStore.getRegistrations().find((r) => r.id === student1RegId);
    assert.ok(saved, 'Record must be saved in AppStore registrations');
    assert.equal(saved?.qrToken, student1QrToken, 'Stored QR token matches generated token');
  });

  // --------------------------------------------------------------------------
  // Scenario 3: QR code remains inactive before approval
  // --------------------------------------------------------------------------
  await t.test('Scenario 3: QR code remains inactive before approval (all facility access denied)', () => {
    // 3a. Scanner inspection
    const scanResult = EventStore.verifyStudentTokenForDepartment(student1QrToken, 'GATE', gateStaff);
    assert.equal(scanResult.valid, false, 'Scanner must deny unapproved manual registration');
    assert.equal(scanResult.status, 'NOT_ELIGIBLE', 'Status must be NOT_ELIGIBLE');
    assert.match(
      scanResult.message,
      /REGISTRATION_PENDING_APPROVAL/i,
      'Message must state pending Super Admin approval'
    );

    // 3b. Gate entry blocked
    const gateRes = EventStore.recordGateEvent(
      student1RegId,
      'Asif Mahmud Joy',
      'SSC 2012',
      undefined,
      'ENTRY',
      'Gate 01',
      undefined,
      gateStaff.id,
      gateStaff.fullName,
      gateStaff
    );
    assert.equal(gateRes.success, false, 'Gate entry must be rejected');
    assert.match(gateRes.error || '', /REGISTRATION_PENDING_APPROVAL/i);

    // 3c. Food collection blocked
    const foodRes = EventStore.confirmFoodDistribution(
      student1RegId,
      'Asif Mahmud Joy',
      'SSC 2012',
      'lunch',
      foodStaff.id,
      foodStaff.fullName,
      undefined,
      foodStaff
    );
    assert.equal(foodRes.success, false, 'Food collection must be rejected');
    assert.match(foodRes.error || '', /REGISTRATION_PENDING_APPROVAL/i);

    // 3d. T-shirt collection blocked
    const dressRes = EventStore.confirmDressDistribution(
      student1RegId,
      'Asif Mahmud Joy',
      'T-Shirt',
      'XL',
      dressStaff.id,
      dressStaff.fullName,
      undefined,
      dressStaff
    );
    assert.equal(dressRes.success, false, 'Dress collection must be rejected');
    assert.match(dressRes.error || '', /REGISTRATION_PENDING_APPROVAL/i);
  });

  // --------------------------------------------------------------------------
  // Scenario 4: Super Admin approves the registration
  // --------------------------------------------------------------------------
  await t.test('Scenario 4: Super Admin approves the registration', async () => {
    const approveRes = await ManualRegistrationService.approveRegistration(
      student1RegId,
      superAdmin,
      'Identity and passing certificate verified by Super Admin'
    );

    assert.equal(approveRes.success, true, 'Registration approval must succeed');
    assert.equal(approveRes.registration?.registrationApprovalStatus, 'approved');
    assert.equal(approveRes.registration?.approvedBy, superAdmin.name);
    assert.ok(approveRes.registration?.approvedAt, 'Timestamp must be recorded');
  });

  // --------------------------------------------------------------------------
  // Scenario 5: QR code becomes active
  // --------------------------------------------------------------------------
  await t.test('Scenario 5: QR code becomes active after approval', () => {
    const scanResult = EventStore.verifyStudentTokenForDepartment(student1QrToken, 'GATE', gateStaff);
    assert.equal(scanResult.valid, true, 'QR scanner must authorize approved student');
    assert.equal(scanResult.status, 'AUTHORIZED', 'Status must be AUTHORIZED');
    assert.equal(scanResult.student?.id, student1RegId);
  });

  // --------------------------------------------------------------------------
  // Scenario 6: Student can use the ticket for authorized facilities
  // --------------------------------------------------------------------------
  await t.test('Scenario 6: Student can use ticket for Gate, Food, and Dress facilities', () => {
    // 6a. Gate Entry
    const gateRes = EventStore.recordGateEvent(
      student1RegId,
      'Asif Mahmud Joy',
      'SSC 2012',
      undefined,
      'ENTRY',
      'Gate 01',
      undefined,
      gateStaff.id,
      gateStaff.fullName,
      gateStaff
    );
    assert.equal(gateRes.success, true, 'Gate entry must succeed');

    // 6b. Food Lunch Collection
    const foodRes = EventStore.confirmFoodDistribution(
      student1RegId,
      'Asif Mahmud Joy',
      'SSC 2012',
      'lunch',
      foodStaff.id,
      foodStaff.fullName,
      undefined,
      foodStaff
    );
    assert.equal(foodRes.success, true, 'Food collection must succeed');

    // 6c. T-shirt Collection
    const dressRes = EventStore.confirmDressDistribution(
      student1RegId,
      'Asif Mahmud Joy',
      'T-Shirt',
      'XL',
      dressStaff.id,
      dressStaff.fullName,
      undefined,
      dressStaff
    );
    assert.equal(dressRes.success, true, 'Dress collection must succeed');
  });

  // --------------------------------------------------------------------------
  // Scenario 7: Admin creates another registration with a financial amount
  // --------------------------------------------------------------------------
  let student2RegId = '';
  let student2QrToken = '';

  await t.test('Scenario 7: Admin creates registration with financial amount', async () => {
    const res = await ManualRegistrationService.createManualRegistration(
      {
        fullName: 'Nusrat Jahan Mim',
        mobileNumber: '01822334455',
        category: 'current',
        studentId: 'PLSC-STU-2027-88',
        currentClass: 'Class 10',
        batchName: 'Class 10',
        tShirtSize: 'M',
        // Optional financial amount entered
        financialAmount: 1500,
        financialMethod: 'Cash',
        financialReference: 'REC-DESK-7741',
        financialDescription: 'On-site venue cash payment at counter 1',
      },
      deskAdmin
    );

    assert.equal(res.success, true);
    assert.ok(res.registration);
    assert.equal(res.registration.financialAmount, 1500);
    assert.equal(res.registration.financialApprovalStatus, 'pending', 'Financial status must be pending');
    assert.equal(res.registration.totalPaid, 0, 'totalPaid must remain 0 until Super Admin approves');

    student2RegId = res.registration.id;
    student2QrToken = res.registration.qrToken;
    assert.equal(student2QrToken.length, 6);
  });

  // --------------------------------------------------------------------------
  // Scenario 8: Amount remains pending
  // --------------------------------------------------------------------------
  await t.test('Scenario 8: Amount remains pending and excluded from official collection', async () => {
    const breakdown = ManualRegistrationService.getFinancialBreakdown();
    assert.ok(breakdown.totalPendingCollection >= 1500, 'Pending amount must include student 2 amount');

    // Official treasury summary
    const finSummary = await FinancialService.getFinancialTransparencySummary();
    assert.equal(finSummary.total_pending_collection, breakdown.totalPendingCollection);
    const student2Record = AppStore.getRegistrations().find((r) => r.id === student2RegId);
    assert.equal(student2Record?.financialApprovalStatus, 'pending');
    assert.equal(student2Record?.totalPaid, 0, 'Unapproved manual funds do not contribute to totalPaid');
  });

  // --------------------------------------------------------------------------
  // Scenario 9: Super Admin approves registration but rejects the amount
  // --------------------------------------------------------------------------
  await t.test('Scenario 9: Super Admin approves registration but rejects amount independently', async () => {
    // 9a. Super Admin approves registration
    const regApprove = await ManualRegistrationService.approveRegistration(student2RegId, superAdmin);
    assert.equal(regApprove.success, true);
    assert.equal(regApprove.registration?.registrationApprovalStatus, 'approved');

    // 9b. Super Admin rejects financial amount
    const finReject = await ManualRegistrationService.rejectFinancial(
      student2RegId,
      superAdmin,
      'Invalid voucher receipt, cash was not deposited'
    );
    assert.equal(finReject.success, true);
    assert.equal(finReject.registration?.financialApprovalStatus, 'rejected');

    // Confirm independence: Registration is APPROVED, Financial is REJECTED
    const updated = AppStore.getRegistrations().find((r) => r.id === student2RegId);
    assert.equal(updated?.registrationApprovalStatus, 'approved', 'Registration remains approved');
    assert.equal(updated?.financialApprovalStatus, 'rejected', 'Financial remains rejected');
  });

  // --------------------------------------------------------------------------
  // Scenario 10: Verify that amount is not included in the financial dashboard
  // --------------------------------------------------------------------------
  await t.test('Scenario 10: Verify rejected amount is excluded from official total', () => {
    const breakdown = ManualRegistrationService.getFinancialBreakdown();
    assert.ok(breakdown.totalRejectedCollection >= 1500, 'Rejected collection tracks rejected amount');

    // Ensure student 2's totalPaid is 0 and does not count toward official collection
    const updated = AppStore.getRegistrations().find((r) => r.id === student2RegId);
    assert.equal(updated?.totalPaid, 0);
  });

  // --------------------------------------------------------------------------
  // Scenario 11: Super Admin separately approves a financial amount
  // --------------------------------------------------------------------------
  let student3RegId = '';
  let student3QrToken = '';

  await t.test('Scenario 11: Super Admin separately approves financial amount', async () => {
    const res = await ManualRegistrationService.createManualRegistration(
      {
        fullName: 'Kamal Hossain',
        mobileNumber: '01933445566',
        category: 'former',
        batchName: 'SSC 2005',
        tShirtSize: 'L',
        financialAmount: 2000,
        financialMethod: 'bKash',
        financialReference: 'TRX99881122',
      },
      deskAdmin
    );
    assert.equal(res.success, true);
    student3RegId = res.registration!.id;
    student3QrToken = res.registration!.qrToken;
    assert.equal(student3QrToken.length, 6);

    // Approve financial amount
    const finApprove = await ManualRegistrationService.approveFinancial(
      student3RegId,
      superAdmin,
      'Confirmed in official bKash merchant statement'
    );
    assert.equal(finApprove.success, true);
    assert.equal(finApprove.registration?.financialApprovalStatus, 'approved');
    assert.equal(finApprove.registration?.totalPaid, 2000);
    assert.equal(finApprove.registration?.paymentStatus, 'paid');
  });

  // --------------------------------------------------------------------------
  // Scenario 12: Verify that amount is added exactly once (idempotent, no double count)
  // --------------------------------------------------------------------------
  await t.test('Scenario 12: Approved amount is added exactly once with idempotent re-approval', async () => {
    const breakdown1 = ManualRegistrationService.getFinancialBreakdown();
    const initialApproved = breakdown1.totalManualCollection;

    // Idempotent secondary approval call
    const finReApprove = await ManualRegistrationService.approveFinancial(
      student3RegId,
      superAdmin,
      'Duplicate approval click test'
    );
    assert.equal(finReApprove.success, true);

    const breakdown2 = ManualRegistrationService.getFinancialBreakdown();
    assert.equal(
      breakdown2.totalManualCollection,
      initialApproved,
      'Re-approving must NOT double-count the financial amount'
    );
  });

  // --------------------------------------------------------------------------
  // Scenario 13: Verify that rejected registrations cannot use their QR codes
  // --------------------------------------------------------------------------
  await t.test('Scenario 13: Rejected registrations cannot use QR codes (permanently inactive)', async () => {
    let student4RegId = '';
    let student4QrToken = '';

    const res = await ManualRegistrationService.createManualRegistration(
      {
        fullName: 'Fake Imposter Attendee',
        mobileNumber: '01655667788',
        category: 'former',
        batchName: 'SSC 1999',
        tShirtSize: 'M',
      },
      deskAdmin
    );
    student4RegId = res.registration!.id;
    student4QrToken = res.registration!.qrToken;

    // Super Admin explicitly rejects this registration
    const rejectRes = await ManualRegistrationService.rejectRegistration(
      student4RegId,
      superAdmin,
      'Suspicious attendee, not on alumni registry, forged credentials'
    );
    assert.equal(rejectRes.success, true);
    assert.equal(rejectRes.registration?.registrationApprovalStatus, 'rejected');

    // Scanner verification must reject
    const scanResult = EventStore.verifyStudentTokenForDepartment(student4QrToken, 'GATE', gateStaff);
    assert.equal(scanResult.valid, false, 'Rejected registration must be invalid');
    assert.match(scanResult.message, /REGISTRATION_REJECTED/i);

    // Gate entry must fail
    const gateRes = EventStore.recordGateEvent(
      student4RegId,
      'Fake Imposter Attendee',
      'SSC 1999',
      undefined,
      'ENTRY',
      'Gate 01',
      undefined,
      gateStaff.id,
      gateStaff.fullName,
      gateStaff
    );
    assert.equal(gateRes.success, false);
    assert.match(gateRes.error || '', /REGISTRATION_REJECTED/i);
  });

  // --------------------------------------------------------------------------
  // Scenario 14: Verify existing online registrations and tickets remain unaffected
  // --------------------------------------------------------------------------
  await t.test('Scenario 14: Existing online registrations remain completely unaffected', () => {
    const allRegistrations = AppStore.getRegistrations();
    const onlineRegistrations = allRegistrations.filter((r) => !r.isManualRegistration);

    assert.equal(
      onlineRegistrations.length,
      initialOnlineCount,
      'Online registration count must be unchanged'
    );

    // Pick an existing paid online student and test their ticket and QR scanner
    const onlineStudent = onlineRegistrations.find((r) => r.paymentStatus === 'paid');
    assert.ok(onlineStudent, 'At least one paid online student exists');

    // Verification must pass directly without needing manual approval
    const scanResult = EventStore.verifyStudentTokenForDepartment(
      onlineStudent!.qrToken,
      'GATE',
      gateStaff
    );
    assert.equal(scanResult.valid, true, 'Online paid student QR code must be valid and verified');
  });
});
