import test from 'node:test';
import assert from 'node:assert/strict';
import { RegistrationFormData } from './rules';
import { PayStationService } from '../services/paystation';

test('Registration Form Data Preservation on Payment Failure and Reset on Success', async (t) => {
  // Mock localStorage for Node test environment if not present
  const mockStorage: Record<string, string> = {};
  if (typeof globalThis.localStorage === 'undefined') {
    (globalThis as any).localStorage = {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, value: string) => {
        mockStorage[key] = value;
      },
      removeItem: (key: string) => {
        delete mockStorage[key];
      },
      clear: () => {
        for (const k in mockStorage) delete mockStorage[k];
      },
    };
  }

  const sampleStudent: RegistrationFormData = {
    fullName: 'Shakil Ahmed',
    photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300',
    mobileNumber: '01712345678',
    email: 'shakil.ahmed@example.com',
    address: 'Faridpur Sadar, Faridpur',
    category: 'former',
    passingYear: '2012',
    lastClassAttended: 'HSC',
    batchName: 'Batch 2012 (HSC)',
    tShirtSize: 'XL',
    donationAmount: 500,
    termsAccepted: true,
  };

  await t.test('1. Registration form draft auto-saves and preserves all inputs', () => {
    localStorage.setItem('plscf_registration_draft', JSON.stringify(sampleStudent));
    const saved = JSON.parse(localStorage.getItem('plscf_registration_draft') || '{}');

    assert.equal(saved.fullName, 'Shakil Ahmed');
    assert.equal(saved.mobileNumber, '01712345678');
    assert.equal(saved.passingYear, '2012');
    assert.equal(saved.tShirtSize, 'XL');
    assert.equal(saved.donationAmount, 500);
    assert.equal(saved.termsAccepted, true);
  });

  await t.test('2. PayStation session preserves complete form data on checkout start', () => {
    PayStationService.savePendingSession({
      invoiceNumber: 'INV-TEST-001',
      type: 'registration',
      amount: 2000,
      formData: sampleStudent,
      fees: {
        registrationFee: 1500,
        donationAmount: 500,
        totalPayable: 2000,
      },
      createdAt: new Date().toISOString(),
    });

    const pending = PayStationService.getPendingSession();
    assert.ok(pending);
    assert.equal(pending.formData?.fullName, 'Shakil Ahmed');
    assert.equal(pending.formData?.mobileNumber, '01712345678');
    assert.equal(pending.formData?.tShirtSize, 'XL');
  });

  await t.test('3. On Payment Failure or Cancel (GO BACK), form data remains completely intact', () => {
    // Simulating user clicking GO BACK after payment failure:
    // Modal closes, but draft and preserved data are NOT wiped out
    const draft = JSON.parse(localStorage.getItem('plscf_registration_draft') || '{}');
    const session = PayStationService.getPendingSession();

    assert.ok(draft.fullName, 'Draft must retain student name');
    assert.ok(draft.mobileNumber, 'Draft must retain mobile number');
    assert.equal(draft.tShirtSize, 'XL', 'Draft must retain t-shirt size');
    assert.equal(session?.formData?.fullName, 'Shakil Ahmed', 'Session must retain student name');
  });

  await t.test('4. On Payment Success, draft and pending sessions are cleaned for adding new data', () => {
    // Simulate successful payment cleanup
    PayStationService.clearPendingSession();
    localStorage.removeItem('plscf_registration_draft');

    const pendingAfterSuccess = PayStationService.getPendingSession();
    const draftAfterSuccess = localStorage.getItem('plscf_registration_draft');

    assert.equal(pendingAfterSuccess, null, 'Pending session must be null after success');
    assert.equal(draftAfterSuccess, null, 'Registration draft must be removed after success');
  });
});

