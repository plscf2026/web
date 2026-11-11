import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateSixCharToken,
  isValidSixCharToken,
  generateUniqueSixCharToken,
  formatSafeQrPayload,
  parseScannedInput,
  findRegistrationByTokenOrId,
} from './tokenGenerator';
import {
  EventStore,
  hasDepartmentPermission,
} from '../services/eventStore';
import { AppStore } from '../services/store';
import { StaffAccount } from '../types';

test('1. 6-Character QR Token: Exactly 6 alphanumeric characters with zero collisions', () => {
  // Test individual token format
  for (let i = 0; i < 100; i++) {
    const token = generateSixCharToken();
    assert.equal(token.length, 6, `Token length should be exactly 6, got "${token}"`);
    assert.match(token, /^[A-Z0-9]{6}$/, `Token should only contain uppercase letters and numbers: "${token}"`);
    assert.equal(isValidSixCharToken(token), true);
  }

  // Test validation rejects invalid tokens
  assert.equal(isValidSixCharToken(null), false);
  assert.equal(isValidSixCharToken(''), false);
  assert.equal(isValidSixCharToken('ABCDE'), false); // 5 chars
  assert.equal(isValidSixCharToken('ABCDEF7'), false); // 7 chars
  assert.equal(isValidSixCharToken('abc123'), false); // lowercase rejected
  assert.equal(isValidSixCharToken('AB@123'), false); // special char rejected

  // High-volume collision test: 2,000 generated tokens must have zero collisions
  const set = new Set<string>();
  for (let i = 0; i < 2000; i++) {
    const token = generateSixCharToken();
    assert.equal(set.has(token), false, `Collision detected on token: ${token}`);
    set.add(token);
  }
  assert.equal(set.size, 2000);
});

test('2. Collision retry generator automatically avoids pre-existing tokens', () => {
  const existing = new Set<string>(['A1B2C3', 'X9Y8Z7', 'M4N5P6']);
  const uniqueToken = generateUniqueSixCharToken(existing);
  assert.equal(isValidSixCharToken(uniqueToken), true);
  assert.equal(existing.has(uniqueToken), false);
});

test('3. Safe QR Payload: Encodes only verification token & ID, zero PII', () => {
  const token = 'A7K9M2';
  const regId = 'PLSCF-2026-F1001';
  const payload = formatSafeQrPayload(token, regId);

  // Must be valid JSON
  const parsed = JSON.parse(payload);
  assert.equal(parsed.token, token);
  assert.equal(parsed.id, regId);

  // Must NOT leak private student information
  assert.equal(payload.includes('phone'), false);
  assert.equal(payload.includes('01711223344'), false);
  assert.equal(payload.includes('email'), false);
  assert.equal(payload.includes('password'), false);
  assert.equal(payload.includes('address'), false);
});

test('4. Resilient input parser handles direct 6-char token, ID, JSON payload, and URL query strings', () => {
  // Direct 6-char token
  const t1 = parseScannedInput('A7K9M2');
  assert.equal(t1.token, 'A7K9M2');

  // Direct registration ID
  const t2 = parseScannedInput('PLSCF-2026-F1001');
  assert.equal(t2.id, 'PLSCF-2026-F1001');

  // JSON safe payload
  const jsonPayload = JSON.stringify({ token: 'B9F2Q7', id: 'PLSCF-2026-F1003' });
  const t3 = parseScannedInput(jsonPayload);
  assert.equal(t3.token, 'B9F2Q7');
  assert.equal(t3.id, 'PLSCF-2026-F1003');

  // Scanned full URL
  const t4 = parseScannedInput('https://plscf.org/verify?token=R8W3N5');
  assert.equal(t4.token, 'R8W3N5');
});

test('5. findRegistrationByTokenOrId matches accurately by 6-char token or ID', () => {
  const registrations = AppStore.getRegistrations();
  assert.ok(registrations.length > 0);

  // Find by 6-character token
  const byToken = findRegistrationByTokenOrId(registrations, 'A7K9M2');
  assert.ok(byToken, 'Should find student with token A7K9M2');
  assert.equal(byToken?.id, 'PLSCF-2026-F1001');

  // Find by registration ID
  const byId = findRegistrationByTokenOrId(registrations, 'PLSCF-2026-F1002');
  assert.ok(byId, 'Should find student with ID PLSCF-2026-F1002');
  assert.equal(byId?.qrToken, 'R8W3N5');

  // Find by JSON QR payload
  const jsonInput = JSON.stringify({ token: 'B9F2Q7', id: 'PLSCF-2026-F1003' });
  const byJson = findRegistrationByTokenOrId(registrations, jsonInput);
  assert.ok(byJson);
  assert.equal(byJson?.fullName, 'Md. Asaduzzaman');
});

test('6. Department RBAC: Strict isolation (Breakfast staff rejected for Lunch/Dinner/Dress/Gate)', () => {
  const breakfastStaff: StaffAccount = {
    id: 'STF-TEST-BF',
    authUserId: 'bf-user-uuid',
    fullName: 'Breakfast Officer',
    username: 'bf_officer',
    email: 'bf@plscf.edu.bd',
    role: 'BREAKFAST_STAFF',
    department: 'BREAKFAST',
    permissions: ['VIEW', 'SCAN', 'VERIFY', 'APPROVE'],
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
  };

  // Breakfast staff CAN approve breakfast
  assert.equal(hasDepartmentPermission(breakfastStaff, 'BREAKFAST', 'APPROVE'), true);
  assert.equal(hasDepartmentPermission(breakfastStaff, 'BREAKFAST', 'VERIFY'), true);

  // Breakfast staff CANNOT access Lunch, Dinner, Dress, Gate, or Finance
  assert.equal(hasDepartmentPermission(breakfastStaff, 'LUNCH', 'APPROVE'), false);
  assert.equal(hasDepartmentPermission(breakfastStaff, 'DINNER', 'APPROVE'), false);
  assert.equal(hasDepartmentPermission(breakfastStaff, 'DRESS', 'APPROVE'), false);
  assert.equal(hasDepartmentPermission(breakfastStaff, 'GATE', 'APPROVE'), false);
  assert.equal(hasDepartmentPermission(breakfastStaff, 'FINANCE', 'APPROVE'), false);

  // Breakfast staff CANNOT execute MANAGE action
  assert.equal(hasDepartmentPermission(breakfastStaff, 'BREAKFAST', 'MANAGE'), false);
});

test('7. Department RBAC: Deactivated staff account is immediately denied all operations', () => {
  const disabledStaff: StaffAccount = {
    id: 'STF-DISABLED',
    authUserId: 'disabled-user-uuid',
    fullName: 'Deactivated Worker',
    username: 'disabled_staff',
    email: 'disabled@plscf.edu.bd',
    role: 'LUNCH_STAFF',
    department: 'LUNCH',
    permissions: ['VIEW', 'SCAN', 'VERIFY', 'APPROVE'],
    status: 'DISABLED',
    createdAt: new Date().toISOString(),
  };

  assert.equal(hasDepartmentPermission(disabledStaff, 'LUNCH', 'VIEW'), false);
  assert.equal(hasDepartmentPermission(disabledStaff, 'LUNCH', 'SCAN'), false);
  assert.equal(hasDepartmentPermission(disabledStaff, 'LUNCH', 'APPROVE'), false);
});

test('8. Department RBAC: Super Admin has global bypass authority', () => {
  const superAdmin: StaffAccount = {
    id: 'STF-ADMIN',
    authUserId: 'super-admin-uuid',
    fullName: 'Chief Super Admin',
    username: 'superadmin',
    email: 'admin@plscf.edu.bd',
    role: 'SUPER_ADMIN',
    department: 'ALL_SERVICES',
    permissions: ['VIEW', 'SCAN', 'VERIFY', 'APPROVE', 'REJECT', 'EXPORT', 'MANAGE'],
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
  };

  assert.equal(hasDepartmentPermission(superAdmin, 'BREAKFAST', 'APPROVE'), true);
  assert.equal(hasDepartmentPermission(superAdmin, 'LUNCH', 'APPROVE'), true);
  assert.equal(hasDepartmentPermission(superAdmin, 'DINNER', 'APPROVE'), true);
  assert.equal(hasDepartmentPermission(superAdmin, 'DRESS', 'APPROVE'), true);
  assert.equal(hasDepartmentPermission(superAdmin, 'GATE', 'APPROVE'), true);
  assert.equal(hasDepartmentPermission(superAdmin, 'FINANCE', 'MANAGE'), true);
});

test('9. Operational Isolation: confirmFoodDistribution rejects cross-department staff', () => {
  const dressStaff: StaffAccount = {
    id: 'STF-DRESS-ONLY',
    authUserId: 'dress-user-uuid',
    fullName: 'Dress Kit Officer',
    username: 'dress_officer',
    email: 'dress@plscf.edu.bd',
    role: 'DRESS_STAFF',
    department: 'DRESS',
    permissions: ['VIEW', 'SCAN', 'VERIFY', 'APPROVE'],
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
  };

  const res = EventStore.confirmFoodDistribution(
    'PLSCF-2026-F1001',
    'Tanvir Ahmed',
    'SSC 1998',
    'lunch',
    dressStaff.id,
    dressStaff.fullName,
    undefined,
    dressStaff
  );

  assert.equal(res.success, false);
  assert.ok(res.error?.includes('PERMISSION_DENIED'), `Expected PERMISSION_DENIED error, got: ${res.error}`);
});

test('10. Operational Isolation: confirmDressDistribution rejects food staff', () => {
  const lunchStaff: StaffAccount = {
    id: 'STF-LUNCH-ONLY',
    authUserId: 'lunch-user-uuid',
    fullName: 'Lunch Meal Officer',
    username: 'lunch_officer',
    email: 'lunch@plscf.edu.bd',
    role: 'LUNCH_STAFF',
    department: 'LUNCH',
    permissions: ['VIEW', 'SCAN', 'VERIFY', 'APPROVE'],
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
  };

  const res = EventStore.confirmDressDistribution(
    'PLSCF-2026-F1001',
    'Tanvir Ahmed',
    'reunion_tshirt',
    'XL',
    lunchStaff.id,
    lunchStaff.fullName,
    undefined,
    lunchStaff
  );

  assert.equal(res.success, false);
  assert.ok(res.error?.includes('PERMISSION_DENIED'), `Expected PERMISSION_DENIED error, got: ${res.error}`);
});

test('11. Atomic duplicate distribution prevention blocks second collection', () => {
  const lunchStaff: StaffAccount = {
    id: 'STF-LUNCH-AUTH',
    authUserId: 'lunch-auth-uuid',
    fullName: 'Lunch Authorized Officer',
    username: 'lunch_authorized',
    email: 'lunch_auth@plscf.edu.bd',
    role: 'LUNCH_STAFF',
    department: 'LUNCH',
    permissions: ['VIEW', 'SCAN', 'VERIFY', 'APPROVE'],
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
  };

  const uniqueRegId = `PLSCF-TEST-DUP-${Date.now()}`;

  // 1st attempt: should succeed
  const firstRes = EventStore.confirmFoodDistribution(
    uniqueRegId,
    'Duplicate Test Student',
    'SSC 2012',
    'lunch',
    lunchStaff.id,
    lunchStaff.fullName,
    undefined,
    lunchStaff
  );
  assert.equal(firstRes.success, true);
  assert.ok(firstRes.record);

  // 2nd attempt: must fail with ALREADY COLLECTED
  const secondRes = EventStore.confirmFoodDistribution(
    uniqueRegId,
    'Duplicate Test Student',
    'SSC 2012',
    'lunch',
    lunchStaff.id,
    lunchStaff.fullName,
    undefined,
    lunchStaff
  );
  assert.equal(secondRes.success, false);
  assert.ok(secondRes.error?.includes('ALREADY COLLECTED'));
});

test('12. Information Minimization: verifyStudentTokenForDepartment redacts phone, email, and PII', () => {
  const lunchStaff: StaffAccount = {
    id: 'STF-LUNCH-VERIFY',
    authUserId: 'lunch-verify-uuid',
    fullName: 'Lunch Verification Officer',
    username: 'lunch_verifier',
    email: 'verifier@plscf.edu.bd',
    role: 'LUNCH_STAFF',
    department: 'LUNCH',
    permissions: ['VIEW', 'SCAN', 'VERIFY'],
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
  };

  // Student Tanvir Ahmed has token A7K9M2
  const verification = EventStore.verifyStudentTokenForDepartment('A7K9M2', 'LUNCH', lunchStaff);

  assert.equal(verification.valid, true);
  assert.ok(verification.student);
  assert.equal(verification.student?.fullName, 'Tanvir Ahmed');
  assert.equal(verification.student?.qrToken, 'A7K9M2');
  assert.equal(verification.student?.departmentStatus.department, 'LUNCH');

  // Verify that private PII fields are strictly omitted
  const studentObj = verification.student as any;
  assert.equal(studentObj.mobileNumber, undefined, 'Mobile number must be redacted');
  assert.equal(studentObj.email, undefined, 'Email must be redacted');
  assert.equal(studentObj.address, undefined, 'Address must be redacted');
  assert.equal(studentObj.registrationFee, undefined, 'Financial fee must be redacted');
  assert.equal(studentObj.serverVerificationSignature, undefined, 'Server signatures must not be exposed');
});

test('13. Information Minimization: Cross-department verification query is strictly rejected', () => {
  const dressStaff: StaffAccount = {
    id: 'STF-DRESS-PROBE',
    authUserId: 'probe-uuid',
    fullName: 'Dress Kit Probe',
    username: 'dress_probe',
    email: 'probe@plscf.edu.bd',
    role: 'DRESS_STAFF',
    department: 'DRESS',
    permissions: ['VIEW', 'SCAN', 'VERIFY'],
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
  };

  // Dress staff tries to probe lunch department data
  const result = EventStore.verifyStudentTokenForDepartment('A7K9M2', 'LUNCH', dressStaff);
  assert.equal(result.valid, false);
  assert.equal(result.status, 'UNAUTHORIZED_DEPARTMENT');
  assert.equal(result.student, undefined);
});

