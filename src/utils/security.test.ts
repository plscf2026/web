import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeInput,
  hasSqlInjectionPattern,
  validateTransactionIdFormat,
  isDuplicateTransaction,
  generateServerPaymentSignature,
  verifyServerPaymentSignature,
  hasRolePermission,
  checkClientRateLimit,
  computeAuditChecksum,
  CRITICAL_SECURITY_CHECKLIST,
} from './security';

test('1. XSS Input Sanitization prevents script injection and escapes HTML', () => {
  const dirty1 = '<script>alert("pwned")</script>Sagar Saha';
  const clean1 = sanitizeInput(dirty1);
  assert.equal(clean1.includes('<script>'), false);
  assert.equal(clean1.includes('alert'), false);
  assert.equal(clean1.includes('Sagar Saha'), true);

  const dirty2 = '<img src=x onerror=alert(1)>';
  const clean2 = sanitizeInput(dirty2);
  assert.equal(clean2.includes('onerror'), false);

  const dirty3 = 'javascript:void(0)';
  const clean3 = sanitizeInput(dirty3);
  assert.equal(clean3.includes('javascript:'), false);

  // Escaping test
  const dirty4 = 'Tom & Jerry <friends> "quotes" \'single\'';
  const clean4 = sanitizeInput(dirty4);
  assert.equal(clean4, 'Tom &amp; Jerry &lt;friends&gt; &quot;quotes&quot; &#x27;single&#x27;');
});

test('2. SQL Injection Pattern Detection flags attack vectors', () => {
  assert.equal(hasSqlInjectionPattern("' OR '1'='1"), true);
  assert.equal(hasSqlInjectionPattern("admin'; DROP TABLE registrations_2026; --"), true);
  assert.equal(hasSqlInjectionPattern("UNION SELECT * FROM admin_accounts"), true);
  assert.equal(hasSqlInjectionPattern("/* comment attack */"), true);

  // Legitimate inputs
  assert.equal(hasSqlInjectionPattern("Mohammad Rahim"), false);
  assert.equal(hasSqlInjectionPattern("SSC 2012"), false);
  assert.equal(hasSqlInjectionPattern("01711223344"), false);
});

test('3. Payment Transaction ID Validation enforces gateway formats and rejects injection', () => {
  // bKash: 8 to 12 alphanumeric
  assert.equal(validateTransactionIdFormat('bkash', 'BL9X87K2M1').valid, true);
  assert.equal(validateTransactionIdFormat('bkash', '9A8B7C6D').valid, true);
  assert.equal(validateTransactionIdFormat('bkash', 'SHORT').valid, false); // too short
  assert.equal(validateTransactionIdFormat('bkash', 'BL9X--DROP').valid, false); // injection

  // Nagad: 8 to 12 alphanumeric
  assert.equal(validateTransactionIdFormat('nagad', 'NGD77665544').valid, true);
  assert.equal(validateTransactionIdFormat('nagad', 'TOO_LONG_NAGAD_TRX_1234567890').valid, false);

  // Rocket: 10 to 14 digits
  assert.equal(validateTransactionIdFormat('rocket', '123456789012').valid, true);
  assert.equal(validateTransactionIdFormat('rocket', 'ROCKET_NOT_DIGITS').valid, false);

  // Card
  assert.equal(validateTransactionIdFormat('card', 'TXN-CARD-9841-B7').valid, true);
  assert.equal(validateTransactionIdFormat('card', 'BAD<SCRIPT>').valid, false);
});

test('4. Anti-Replay Duplicate Transaction Detection prevents reuse of payment receipts', () => {
  const existingTrxIds = ['BL9X87K2M1', 'NGD77665544', '123456789012'];

  // Duplicate submission: caught!
  assert.equal(isDuplicateTransaction('BL9X87K2M1', existingTrxIds), true);
  assert.equal(isDuplicateTransaction('bl9x87k2m1', existingTrxIds), true); // case insensitive

  // Fresh unique transaction: accepted!
  assert.equal(isDuplicateTransaction('FRESH999XX', existingTrxIds), false);
});

test('5. Cryptographic Server Payment Signature protects ticket authenticity', () => {
  const regId = 'PLSCF-26F1001';
  const trxId = 'BL9X87K2M1';
  const amount = 1500;

  const validSig = generateServerPaymentSignature(regId, trxId, amount);
  assert.ok(validSig.startsWith('SIG_V2_'));

  // Valid verification
  assert.equal(verifyServerPaymentSignature(regId, trxId, amount, validSig), true);

  // Tampered amount: fails!
  assert.equal(verifyServerPaymentSignature(regId, trxId, 500, validSig), false);

  // Tampered registration ID: fails!
  assert.equal(verifyServerPaymentSignature('PLSCF-26F9999', trxId, amount, validSig), false);

  // Tampered transaction ID: fails!
  assert.equal(verifyServerPaymentSignature(regId, 'FORGED_TRX', amount, validSig), false);

  // Forged signature: fails!
  assert.equal(verifyServerPaymentSignature(regId, trxId, amount, 'SIG_V2_FORGED_SIGNATURE'), false);
});

test('6. Role-Based Access Control (RBAC) enforces principle of least privilege', () => {
  // Super Admin: Has all permissions
  assert.equal(hasRolePermission('super_admin', 'VIEW_ALL_BOOKINGS'), true);
  assert.equal(hasRolePermission('super_admin', 'DELETE_STUDENT_DATA'), true);
  assert.equal(hasRolePermission('super_admin', 'UPDATE_FEE_SETTINGS'), true);
  assert.equal(hasRolePermission('super_admin', 'EXECUTE_SECURITY_AUDIT'), true);

  // Gate Scanner: Only SCAN_ENTRY_EXIT, cannot delete or change fees!
  assert.equal(hasRolePermission('gate_scanner', 'SCAN_ENTRY_EXIT'), true);
  assert.equal(hasRolePermission('gate_scanner', 'DELETE_STUDENT_DATA'), false);
  assert.equal(hasRolePermission('gate_scanner', 'UPDATE_FEE_SETTINGS'), false);
  assert.equal(hasRolePermission('gate_scanner', 'VIEW_ALL_BOOKINGS'), false);

  // Registration Officer: Can view and verify, but cannot change system fee settings or delete
  assert.equal(hasRolePermission('registration_officer', 'VIEW_ALL_BOOKINGS'), true);
  assert.equal(hasRolePermission('registration_officer', 'DISTRIBUTE_TSHIRT'), true);
  assert.equal(hasRolePermission('registration_officer', 'UPDATE_FEE_SETTINGS'), false);
  assert.equal(hasRolePermission('registration_officer', 'DELETE_STUDENT_DATA'), false);

  // Finance Manager: Financial reports and backups, cannot delete students
  assert.equal(hasRolePermission('finance_manager', 'VIEW_FINANCIAL_REPORTS'), true);
  assert.equal(hasRolePermission('finance_manager', 'EXPORT_DATABASE_BACKUP'), true);
  assert.equal(hasRolePermission('finance_manager', 'DELETE_STUDENT_DATA'), false);
});

test('7. Rate Limiter blocks abusive request bursts', () => {
  const testKey = 'test_ip_192_168_1_50';

  // First 3 requests permitted with limit 3
  const r1 = checkClientRateLimit(testKey, 3, 60);
  assert.equal(r1.allowed, true);
  assert.equal(r1.remaining, 2);

  const r2 = checkClientRateLimit(testKey, 3, 60);
  assert.equal(r2.allowed, true);
  assert.equal(r2.remaining, 1);

  const r3 = checkClientRateLimit(testKey, 3, 60);
  assert.equal(r3.allowed, true);
  assert.equal(r3.remaining, 0);

  // 4th request must be blocked!
  const r4 = checkClientRateLimit(testKey, 3, 60);
  assert.equal(r4.allowed, false);
  assert.ok(r4.retryAfterSeconds > 0);
});

test('8. Audit Log Checksum is deterministic and tamper-evident', () => {
  const log = {
    id: 'LOG-001',
    adminId: 'ADMIN-01',
    action: 'FEE_SETTINGS_UPDATE',
    targetId: 'CONFIG',
    timestamp: '2026-03-01T10:00:00Z',
  };

  const chk1 = computeAuditChecksum(log);
  const chk2 = computeAuditChecksum(log);
  assert.equal(chk1, chk2);
  assert.ok(chk1.startsWith('CHK-'));

  // Tampered payload produces different checksum
  const tampered = { ...log, action: 'RECORD_DELETED' };
  const chk3 = computeAuditChecksum(tampered);
  assert.notEqual(chk1, chk3);
});

test('9. Critical Security Checklist covers all 14 mandatory requirements', () => {
  assert.equal(CRITICAL_SECURITY_CHECKLIST.length, 14);
  const reqNumbers = CRITICAL_SECURITY_CHECKLIST.map((c) => c.requirementNumber);
  for (let i = 1; i <= 14; i++) {
    assert.ok(reqNumbers.includes(i), `Requirement #${i} must be included in checklist`);
  }
});
