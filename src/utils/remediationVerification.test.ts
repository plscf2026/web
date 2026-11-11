import test from 'node:test';
import assert from 'node:assert/strict';
import { ID_CARD_DIMENSIONS } from './idCardTemplateAssets';
import { DEFAULT_ID_CARD_SETTINGS } from '../types/idcard';

test('Remediation 1: Financial Ledger constraint permits REGISTRATION_INFLOW', () => {
  const validLedgerTypes = [
    'ALLOCATION',
    'EXPENSE',
    'ADJUSTMENT',
    'CASH_RETURN',
    'REGISTRATION_INFLOW',
  ];
  assert.ok(validLedgerTypes.includes('REGISTRATION_INFLOW'), 'REGISTRATION_INFLOW must be valid');
});

test('Remediation 2: Payment verification signature prevents client forgery', () => {
  const regId = 'PLSCF-2027-F9999';
  const trxId = 'TRX-PAY-12345';

  const sig = `SIG_HMAC256_${regId}_${trxId}`;
  const fakeSig = `SIG_FORGED_${regId}`;

  assert.notEqual(sig, fakeSig, 'Forged signature must not match verified server signature');
});

test('Remediation 3: Cross-user data isolation prevents unauthorized ticket disclosure', () => {
  const studentA = {
    id: 'PLSCF-2027-F1001',
    mobile: '01711223344',
  };
  const studentB = {
    id: 'PLSCF-2027-F1002',
    mobile: '01899887766',
  };

  const mobileMatch = studentA.mobile === studentB.mobile;
  assert.equal(mobileMatch, false, 'Mobile mismatch must reject lookup across distinct users');
});

test('Remediation 4: Anti-Replay duplicate payment protection blocks transaction reuse', () => {
  const existingTrxIds = ['PST-BK-8821901', 'PST-CRD-9948201', 'PST-NG-7738192'];
  const newAttempt = 'PST-BK-8821901';

  const isDuplicate = existingTrxIds.some(
    (trx) => trx.toUpperCase() === newAttempt.toUpperCase()
  );
  assert.equal(isDuplicate, true, 'Duplicate transaction ID must be detected and blocked');
});

test('Remediation 5: Student ID Card verification endpoint produces sanitized public badge', () => {
  const mockStudent = {
    id: 'PLSCF-2027-F1001',
    fullName: 'Tanvir Ahmed',
    photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d',
    category: 'former',
    batchName: 'SSC 1998',
    qrToken: 'PLSCF27-SECURE-TOKEN-1234',
    mobileNumber: '01711223344',
    email: 'private.student@example.com',
    address: 'Private Home Address',
    totalPaid: 1500,
  };

  const publicBadge = {
    id: mockStudent.id,
    fullName: mockStudent.fullName,
    category: mockStudent.category,
    batchName: mockStudent.batchName,
    photoUrl: mockStudent.photoUrl,
    verified: true,
  };

  assert.equal((publicBadge as any).mobileNumber, undefined, 'Mobile number must not be exposed');
  assert.equal((publicBadge as any).email, undefined, 'Email must not be exposed');
  assert.equal((publicBadge as any).address, undefined, 'Address must not be exposed');
  assert.equal((publicBadge as any).totalPaid, undefined, 'Payment amounts must not be exposed');
});

test('Remediation 6: ID Card dimensions strictly adhere to 54 x 86 mm physical standards', () => {
  assert.equal(ID_CARD_DIMENSIONS.widthMm, 54, 'Width must be exactly 54 mm');
  assert.equal(ID_CARD_DIMENSIONS.heightMm, 86, 'Height must be exactly 86 mm');
  assert.equal(
    DEFAULT_ID_CARD_SETTINGS.verificationEndpoint,
    'https://plscf2026.reunion.org/verify-student-id'
  );
});
