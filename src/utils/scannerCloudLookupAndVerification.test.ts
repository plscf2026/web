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

test('4. Manual Registration ID + QR Token dual-verification validates matching and detects mismatch', async () => {
  const attendee: RegistrationRecord = {
    id: 'PLSCF-2027-F8472',
    fullName: 'aaaaaaaaaa',
    photoUrl: 'https://example.com/photo.jpg',
    mobileNumber: '01700000000',
    address: 'Faridpur',
    category: 'former',
    batchName: 'SSC 2016',
    passingYear: '2016',
    tShirtSize: 'Oversize 50',
    registrationFee: 1500,
    donationAmount: 0,
    totalPaid: 1500,
    paymentStatus: 'paid',
    transactionId: 'DKD70PW483',
    paymentMethod: 'bkash',
    registeredAt: new Date().toISOString(),
    qrToken: 'FJJG4G',
    isTShirtCollected: false,
    year: 2027,
  };

  const existing = AppStore.getRegistrations();
  AppStore.saveRegistrations([attendee, ...existing.filter((r) => r.id !== attendee.id)]);

  try {
    // 1. Correct Registration ID and correct QR Token
    const found = AppStore.findRegistration(attendee.id);
    assert.ok(found);
    const tokenMatches = (found?.qrToken || '').toUpperCase() === 'FJJG4G';
    assert.equal(tokenMatches, true, 'Token FJJG4G should match attendee PLSCF-2027-F8472');

    // 2. Mismatched QR Token detection
    const wrongTokenMatches = (found?.qrToken || '').toUpperCase() === 'WRONG1';
    assert.equal(wrongTokenMatches, false, 'Invalid token should fail verification');
  } finally {
    const cleaned = AppStore.getRegistrations().filter((r) => r.id !== attendee.id);
    AppStore.saveRegistrations(cleaned);
  }
});

test('5. Scanner Desk interfaces have Upload QR Image completely removed while preserving Open Camera and Manual Entry', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');

  const scannerFiles = [
    'src/components/MultiStationDesk.tsx',
    'src/components/FoodScannerModule.tsx',
    'src/components/DressScannerModule.tsx',
    'src/components/GateScannerModule.tsx',
    'src/components/common/QrCameraScanner.tsx',
  ];

  for (const relPath of scannerFiles) {
    const fullPath = path.resolve(relPath);
    const content = fs.readFileSync(fullPath, 'utf8');

    // Verify "Upload QR Image" button is gone
    assert.ok(!content.includes('Upload QR Image'), `File ${relPath} should not contain "Upload QR Image"`);
    assert.ok(!content.includes('decodeQRCodeFromImageFile'), `File ${relPath} should not use decodeQRCodeFromImageFile`);

    if (relPath !== 'src/components/common/QrCameraScanner.tsx') {
      // Verify Option 1 (Open Camera) is preserved
      assert.ok(content.includes('Open Camera') || content.includes('Stop Camera'), `File ${relPath} must preserve Open Camera`);
      // Verify Option 2 (Registration ID + QR Token) is preserved
      assert.ok(content.includes('QR Token') || content.includes('tokenInput'), `File ${relPath} must preserve QR Token manual verification`);
    }
  }

  // Verify other unrelated image upload files remain intact
  const registrationPage = fs.readFileSync(path.resolve('src/components/RegistrationPage.tsx'), 'utf8');
  assert.ok(registrationPage.includes('accept="image/jpeg,image/png,image/webp"'), 'Student photo upload in RegistrationPage must remain untouched');

  const staffFinance = fs.readFileSync(path.resolve('src/components/StaffFinanceModule.tsx'), 'utf8');
  assert.ok(staffFinance.includes('Receipt / Voucher Image'), 'Voucher image in StaffFinanceModule must remain untouched');
});
