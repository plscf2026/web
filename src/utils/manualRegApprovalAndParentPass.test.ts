import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ManualRegistrationService } from '../services/manualRegistrationService';
import { AppStore } from '../services/store';
import { AdminAccount } from '../types';

test('Manual Registration Cross-Device Persistence, Deactivated QR & Parent Pass Verification', async (t) => {
  const superAdmin: AdminAccount = {
    id: 'ADM-SUPER-01',
    username: 'superadmin',
    fullName: 'Spider-Man Super Admin',
    email: 'superadmin@plscf.edu.bd',
    role: 'super_admin',
    createdAt: new Date().toISOString(),
  };

  const deskAdmin: AdminAccount = {
    id: 'ADM-VENUE-01',
    username: 'venuedesk',
    fullName: 'Venue Desk Admin',
    email: 'venuedesk@plscf.edu.bd',
    role: 'registration_officer',
    createdAt: new Date().toISOString(),
  };

  const deskUser = { id: deskAdmin.id, name: deskAdmin.fullName };
  const superUser = { id: superAdmin.id, name: superAdmin.fullName };

  let manualRegId = '';
  let manualQrToken = '';

  await t.test('1. Manual Venue Registration is created with PENDING_APPROVAL and saved', async () => {
    const res = await ManualRegistrationService.createManualRegistration(
      {
        fullName: 'Zubair Al Mahmud',
        mobileNumber: '01711223344',
        category: 'former',
        batchName: 'SSC 2012',
        tShirtSize: 'XL',
        hasParent: true,
        parentName: 'Md. Mahmudul Hasan',
        parentRelation: 'Father',
        parentPhone: '01811223344',
      },
      deskUser
    );

    assert.equal(res.success, true);
    assert.ok(res.registration);
    assert.equal(res.registration.isManualRegistration, true);
    assert.equal(res.registration.registrationApprovalStatus, 'pending');
    assert.equal(res.registration.paymentStatus, 'pending');
    assert.equal(res.registration.hasParent, true);
    assert.equal(res.registration.parentName, 'Md. Mahmudul Hasan');

    manualRegId = res.registration.id;
    manualQrToken = res.registration.qrToken;
    assert.equal(manualQrToken.length, 6);
  });

  await t.test('2. Unapproved Manual Registration QR is DEACTIVATED in Scanner', async () => {
    // Attempt verification of the student ticket before Super Admin approval
    const verifyRes = await AppStore.verifyStudentTicketAsync(manualRegId, manualQrToken, 'GATE_SCANNER_01');
    assert.equal(verifyRes.verified, false);
    assert.equal(verifyRes.status, 'PENDING_APPROVAL');
    assert.ok(
      verifyRes.error?.includes('PENDING APPROVAL') || verifyRes.error?.includes('awaiting Super Admin approval'),
      'Must notify scanner that QR is inactive pending Super Admin approval'
    );
  });

  await t.test('3. Super Admin approves registration -> Sets status APPROVED & PAID', async () => {
    const approveRes = await ManualRegistrationService.approveRegistration(
      manualRegId,
      superUser,
      'Approved at venue by Spider-Man'
    );

    assert.equal(approveRes.success, true);
    assert.ok(approveRes.registration);
    assert.equal(approveRes.registration.registrationApprovalStatus, 'approved');
    assert.equal(approveRes.registration.paymentStatus, 'paid');
    assert.ok(approveRes.registration.totalPaid > 0);
  });

  await t.test('4. Approved student ticket QR is now VERIFIED and active in Scanner', async () => {
    const verifyRes = await AppStore.verifyStudentTicketAsync(manualRegId, manualQrToken, 'GATE_SCANNER_01');
    assert.equal(verifyRes.verified, true);
    assert.equal(verifyRes.status, 'VERIFIED');
    assert.equal(verifyRes.student?.id, manualRegId);
    assert.equal(verifyRes.student?.hasParent, true);
    assert.equal(verifyRes.student?.parentName, 'Md. Mahmudul Hasan');
  });

  await t.test('5. Accompanying Parent Pass (PAR- prefix) is recognized and verified', async () => {
    const parentPassId = `PAR-${manualRegId}`;
    const parentToken = `P-${manualQrToken}`;

    const parentVerify = await AppStore.verifyStudentTicketAsync(parentPassId, parentToken, 'GATE_SCANNER_01');
    assert.equal(parentVerify.verified, true);
    assert.equal(parentVerify.student?.id, manualRegId);
    assert.equal(parentVerify.student?.parentName, 'Md. Mahmudul Hasan');
    assert.equal(parentVerify.student?.parentRelation, 'Father');
  });

  await t.test('6. Student without registered parent fails when scanned with PAR- prefix', async () => {
    const soloRes = await ManualRegistrationService.createManualRegistration(
      {
        fullName: 'Tanvir Hossain Solo',
        mobileNumber: '01511223344',
        category: 'current',
        currentClass: 'Class 9',
        batchName: 'Class 9',
        tShirtSize: 'M',
        hasParent: false,
      },
      deskUser
    );
    assert.equal(soloRes.success, true);
    const soloId = soloRes.registration!.id;
    const soloToken = soloRes.registration!.qrToken;

    // Approve the solo student
    await ManualRegistrationService.approveRegistration(soloId, superUser);

    // Student themselves scans fine
    const studentVerify = await AppStore.verifyStudentTicketAsync(soloId, soloToken, 'GATE_SCANNER_01');
    assert.equal(studentVerify.verified, true);

    // Parent pass fails because student has no registered parent
    const parentPassId = `PAR-${soloId}`;
    const parentVerify = await AppStore.verifyStudentTicketAsync(parentPassId, `P-${soloToken}`, 'GATE_SCANNER_01');
    assert.equal(parentVerify.verified, false);
  });
});
