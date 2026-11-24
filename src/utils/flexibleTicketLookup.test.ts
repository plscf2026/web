import test from 'node:test';
import assert from 'node:assert/strict';
import { SupabaseService } from '../services/supabase';
import { RegistrationRecord } from '../types';

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

test('Flexible Ticket Lookup: Mobile Number is Enough OR Registration ID / Token', async () => {
  const mockRegistration: RegistrationRecord = {
    id: 'PLSCF-2027-TEST01',
    fullName: 'Test Student',
    mobileNumber: '01799887766',
    qrToken: 'TK7766',
    category: 'former',
    paymentStatus: 'paid',
    totalPaid: 1500,
    registrationFee: 1500,
    donationAmount: 0,
    tShirtSize: 'XL',
    year: 2027,
    batchName: 'Batch 2020',
    registeredAt: new Date().toISOString(),
    gender: 'male',
    hasParent: false,
    isCheckedIn: false,
    isTshirtCollected: false,
  };

  const storageKey = 'plscf_reunion_registrations_v2';
  localStorage.setItem(storageKey, JSON.stringify([mockRegistration]));

  // 1. Validation: both empty returns friendly error
  const emptyRes = await SupabaseService.lookupVerifiedTicket('', '');
  assert.ok(emptyRes.error, 'Empty lookup should return validation error');

  // 2. Mobile number only is enough
  const mobileOnlyRes = await SupabaseService.lookupVerifiedTicket('', '01799887766');
  assert.ok(!mobileOnlyRes.error, 'Mobile-only lookup should succeed');
  assert.equal(mobileOnlyRes.registration?.id, 'PLSCF-2027-TEST01');
  assert.equal(mobileOnlyRes.registration?.fullName, 'Test Student');

  // 3. Registration ID only is enough
  const idOnlyRes = await SupabaseService.lookupVerifiedTicket('PLSCF-2027-TEST01', '');
  assert.ok(!idOnlyRes.error, 'ID-only lookup should succeed');
  assert.equal(idOnlyRes.registration?.id, 'PLSCF-2027-TEST01');

  // 4. Token only is enough
  const tokenOnlyRes = await SupabaseService.lookupVerifiedTicket('TK7766', '');
  assert.ok(!tokenOnlyRes.error, 'Token-only lookup should succeed');
  assert.equal(tokenOnlyRes.registration?.id, 'PLSCF-2027-TEST01');

  // 5. Both Mobile and Registration ID work together
  const bothRes = await SupabaseService.lookupVerifiedTicket('PLSCF-2027-TEST01', '01799887766');
  assert.ok(!bothRes.error, 'Dual lookup should succeed');
  assert.equal(bothRes.registration?.id, 'PLSCF-2027-TEST01');

  localStorage.removeItem(storageKey);
});
