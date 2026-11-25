import test from 'node:test';
import assert from 'node:assert/strict';
import { ManualRegistrationService } from '../services/manualRegistrationService';
import { AppStore } from '../services/store';
import { IdCardStore } from '../services/idCardStore';

test('Enhanced Manual Registration, Staff Ownership, Financial Protection, QR Lifecycle & Centralized Cards', async (t) => {
  const staffA = { id: 'STF-DESK-A', name: 'Desk Staff Alpha', role: 'registration_officer' };
  const staffB = { id: 'STF-DESK-B', name: 'Desk Staff Beta', role: 'registration_officer' };
  const superAdmin = { id: 'ADM-SUPER-MAIN', name: 'Principal Super Admin', role: 'super_admin' };

  let bKashRegId = '';
  let bKashQrToken = '';

  await t.test('1. bKash & Bank Transfer require Transaction ID; slip upload is optional', async () => {
    const missingTrx = await ManualRegistrationService.createManualRegistration(
      {
        fullName: 'Missing Trx Student',
        mobileNumber: '01744556677',
        category: 'former',
        batchName: 'SSC 2010',
        tShirtSize: 'L',
        financialAmount: 1500,
        financialMethod: 'bKash',
        financialReference: '',
      },
      staffA
    );
    assert.equal(missingTrx.success, false);
    assert.match(missingTrx.error || '', /Transaction ID/i);

    const missingBankTrx = await ManualRegistrationService.createManualRegistration(
      {
        fullName: 'Missing Bank Trx Student',
        mobileNumber: '01744556688',
        category: 'former',
        batchName: 'SSC 2011',
        tShirtSize: 'L',
        financialAmount: 1500,
        financialMethod: 'Bank Transfer',
        financialReference: '',
      },
      staffA
    );
    assert.equal(missingBankTrx.success, false);
    assert.match(missingBankTrx.error || '', /Transaction ID/i);

    // Valid bKash without slip succeeds and stays in Manual DB ONLY
    const okRes = await ManualRegistrationService.createManualRegistration(
      {
        fullName: 'Rahim Uddin',
        mobileNumber: '01744556699',
        category: 'former',
        passingYear: '2008',
        batchName: 'SSC 2008',
        tShirtSize: 'XL',
        gender: 'male',
        bloodGroup: 'O+',
        financialAmount: 1500,
        financialMethod: 'bKash',
        financialReference: 'BKS99887766',
      },
      staffA
    );
    assert.equal(okRes.success, true);
    assert.ok(okRes.registration);
    bKashRegId = okRes.registration.id;
    bKashQrToken = okRes.registration.qrToken;

    // Must NOT be in Main DB or Centralized Card Store before approval
    assert.equal(
      AppStore.getRegistrations().some((r) => r.id === bKashRegId),
      false,
      'Unapproved manual registration must not exist in Main DB'
    );
    const cardsBefore = IdCardStore.syncWithRegistrations();
    assert.equal(
      cardsBefore.some((c) => c.registrationId === bKashRegId),
      false,
      'Unapproved manual card must not appear in Centralized Card Management'
    );
  });

  await t.test('2. Staff isolation: Staff A sees own records; Staff B cannot view/edit Staff A records', async () => {
    const staffAList = ManualRegistrationService.getRegistrationsForStaff(staffA.id, false);
    const staffBList = ManualRegistrationService.getRegistrationsForStaff(staffB.id, false);

    assert.ok(staffAList.some((r) => r.id === bKashRegId));
    assert.equal(staffBList.some((r) => r.id === bKashRegId), false);

    // Staff B tries to edit Staff A's record -> REJECTED
    const unauthEdit = await ManualRegistrationService.staffUpdateStudentDetails(
      bKashRegId,
      { fullName: 'Hacked Name' },
      staffB
    );
    assert.equal(unauthEdit.success, false);
    assert.match(unauthEdit.error || '', /UNAUTHORIZED_OWNERSHIP/i);
  });

  await t.test('3. Staff financial protection: Staff A can edit Name/Mobile ONLY, cannot touch financial fields', async () => {
    // Forbidden financial tamper attempt
    const finTamper = await ManualRegistrationService.staffUpdateStudentDetails(
      bKashRegId,
      { fullName: 'Rahim Uddin', financialAmount: 999999, paymentStatus: 'paid' },
      staffA
    );
    assert.equal(finTamper.success, false);
    assert.match(finTamper.error || '', /FORBIDDEN_FINANCIAL_EDIT/i);

    // Allowed contact edit succeeds
    const validEdit = await ManualRegistrationService.staffUpdateStudentDetails(
      bKashRegId,
      { fullName: 'Rahim Uddin Khan', mobileNumber: '01744556600' },
      staffA
    );
    assert.equal(validEdit.success, true);
    assert.equal(validEdit.registration?.fullName, 'Rahim Uddin Khan');
    assert.equal(validEdit.registration?.mobileNumber, '01744556600');
  });

  await t.test('4. QR Scan before approval returns "ID Card Not Approved by Admin"', async () => {
    const scanBefore = await AppStore.verifyStudentTicketAsync(bKashRegId, bKashQrToken, 'GATE_01');
    assert.equal(scanBefore.verified, false);
    assert.equal(scanBefore.status, 'PENDING_APPROVAL');
    assert.match(scanBefore.error || '', /ID Card Not Approved by Admin/i);
  });

  await t.test('5. Super Admin verifyPaymentAndApproveRegistration transfers to Main DB, Centralized Cards, & activates QR (idempotent)', async () => {
    const approve1 = await ManualRegistrationService.verifyPaymentAndApproveRegistration(
      bKashRegId,
      superAdmin,
      'Verified in bKash statement'
    );
    assert.equal(approve1.success, true);
    assert.equal(approve1.registration?.registrationApprovalStatus, 'approved');
    assert.equal(approve1.registration?.paymentStatus, 'paid');
    assert.equal(approve1.registration?.financialApprovalStatus, 'approved');
    assert.equal(approve1.registration?.totalPaid, 1500);

    // Retry approval idempotently -> must NOT duplicate in AppStore
    const approve2 = await ManualRegistrationService.verifyPaymentAndApproveRegistration(
      bKashRegId,
      superAdmin,
      'Idempotent retry'
    );
    assert.equal(approve2.success, true);
    const matchingInMain = AppStore.getRegistrations().filter((r) => r.id === bKashRegId);
    assert.equal(matchingInMain.length, 1, 'Must never create duplicate records on retry');

    // Now in Centralized Card Management
    const cardsAfter = IdCardStore.syncWithRegistrations();
    assert.ok(
      cardsAfter.some((c) => c.registrationId === bKashRegId),
      'Approved manual card must appear automatically in Centralized Card Management'
    );

    // Exact same QR code is now VERIFIED in scanner
    const scanAfter = await AppStore.verifyStudentTicketAsync(bKashRegId, bKashQrToken, 'GATE_01');
    assert.equal(scanAfter.verified, true);
    assert.equal(scanAfter.status, 'VERIFIED');
    assert.equal(scanAfter.student?.id, bKashRegId);
  });
});
