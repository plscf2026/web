import test from 'node:test';
import assert from 'node:assert/strict';
import { parseScannedInput, findRegistrationByTokenOrId } from './tokenGenerator';
import { AppStore } from '../services/store';
import { SupabaseService } from '../services/supabase';
import { RegistrationRecord } from '../types';

test('1. parseScannedInput parses full verification URLs, case variations, path IDs, and tokens', () => {
  // Full verification URL from Student ID card QR code
  const urlInput = 'https://plscf2026.reunion.org/verify-student-id?id=PLSCF-2027-F8472&token=FJJG4G';
  const parsed1 = parseScannedInput(urlInput);
  assert.equal(parsed1.id, 'PLSCF-2027-F8472');
  assert.equal(parsed1.token, 'FJJG4G');

  // Case variation in URL query parameters
  const urlUpper = 'https://plscf2026.reunion.org/verify-student-id?ID=PLSCF-2027-F8472&TOKEN=FJJG4G';
  const parsedUpper = parseScannedInput(urlUpper);
  assert.equal(parsedUpper.id, 'PLSCF-2027-F8472');
  assert.equal(parsedUpper.token, 'FJJG4G');

  // Direct 6-char token
  const tokenInput = 'FJJG4G';
  const parsed2 = parseScannedInput(tokenInput);
  assert.equal(parsed2.token, 'FJJG4G');

  // Direct registration ID
  const idInput = 'PLSCF-2027-F8472';
  const parsed3 = parseScannedInput(idInput);
  assert.equal(parsed3.id, 'PLSCF-2027-F8472');

  // Path-based URL
  const pathUrl = 'https://plscf2026.reunion.org/verify-student-id/PLSCF-2027-F8472';
  const parsedPath = parseScannedInput(pathUrl);
  assert.equal(parsedPath.id, 'PLSCF-2027-F8472');

  // Friendly ticket display identifier
  const displayId = parsed1.id || parsed1.token || urlInput;
  assert.equal(displayId, 'PLSCF-2027-F8472');
  assert.ok(!displayId.startsWith('http'), 'Friendly display ID should never be a raw URL');
});

test('2. findRegistrationByTokenOrId matches accurately with camelCase and snake_case records', () => {
  const mockStudents: Array<{ id: string; fullName: string; qrToken?: string; qr_token?: string }> = [
    {
      id: 'PLSCF-2027-F8472',
      fullName: 'aaaaaaaaaa',
      qrToken: 'FJJG4G',
    },
    {
      id: 'PLSCF-2026-F1019',
      fullName: 'Md. Al-Amin',
      qr_token: 'MDK92X', // snake_case from DB
    },
  ];

  // Match by full URL
  const match1 = findRegistrationByTokenOrId(
    mockStudents,
    'https://plscf2026.reunion.org/verify-student-id?id=PLSCF-2027-F8472&token=FJJG4G'
  );
  assert.ok(match1);
  assert.equal(match1?.id, 'PLSCF-2027-F8472');

  // Match snake_case DB row by token
  const match2 = findRegistrationByTokenOrId(mockStudents, 'MDK92X');
  assert.ok(match2);
  assert.equal(match2?.id, 'PLSCF-2026-F1019');

  // Match by ID
  const match3 = findRegistrationByTokenOrId(mockStudents, 'PLSCF-2027-F8472');
  assert.ok(match3);
  assert.equal(match3?.fullName, 'aaaaaaaaaa');
});

test('3. AppStore.findRegistrationAsync checks local memory and caches cloud-retrieved attendees', async () => {
  const testStudent: RegistrationRecord = {
    id: 'PLSCF-2027-TEST99',
    fullName: 'Test Cloud Attendee',
    photoUrl: 'https://example.com/photo.jpg',
    mobileNumber: '01700000000',
    address: 'Faridpur',
    category: 'former',
    batchName: 'SSC 2016',
    passingYear: '2016',
    tShirtSize: 'L',
    registrationFee: 1500,
    donationAmount: 0,
    totalPaid: 1500,
    paymentStatus: 'paid',
    transactionId: 'TRX-TEST-99',
    paymentMethod: 'bkash',
    registeredAt: new Date().toISOString(),
    qrToken: 'CLD999',
    isTShirtCollected: false,
    year: 2027,
  };

  // Mock cloud lookup returning the attendee
  const origLookup = SupabaseService.lookupRegistrationByIdOrToken;
  SupabaseService.lookupRegistrationByIdOrToken = async (identifier: string) => {
    if (identifier.includes('PLSCF-2027-TEST99') || identifier.includes('CLD999')) {
      return testStudent;
    }
    return null;
  };

  try {
    // 1. Initial state: not in AppStore local memory
    const existing = AppStore.getRegistrations();
    AppStore.saveRegistrations(existing.filter((r) => r.id !== testStudent.id));

    assert.equal(AppStore.findRegistration(testStudent.id), undefined);

    // 2. Async search with full URL triggers cloud lookup and auto-caches
    const scannedUrl = `https://plscf2026.reunion.org/verify-student-id?id=${testStudent.id}&token=${testStudent.qrToken}`;
    const found = await AppStore.findRegistrationAsync(scannedUrl);

    assert.ok(found, 'Should find student from cloud lookup');
    assert.equal(found?.id, 'PLSCF-2027-TEST99');
    assert.equal(found?.fullName, 'Test Cloud Attendee');

    // 3. Now verify it is cached in local memory for offline use
    const cached = AppStore.findRegistration(testStudent.id);
    assert.ok(cached, 'Student should now be cached in AppStore local memory');
    assert.equal(cached?.id, 'PLSCF-2027-TEST99');
  } finally {
    SupabaseService.lookupRegistrationByIdOrToken = origLookup;
    // Cleanup
    const cleaned = AppStore.getRegistrations().filter((r) => r.id !== testStudent.id);
    AppStore.saveRegistrations(cleaned);
  }
});
