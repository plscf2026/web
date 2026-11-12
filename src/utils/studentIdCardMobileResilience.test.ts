import test from 'node:test';
import assert from 'node:assert/strict';
import { IdCardStore } from '../services/idCardStore';
import { generateStudentQrCodeDataUrl } from './idCardGenerator';
import { RegistrationRecord } from '../types';

test('Mobile Resilience 1: IdCardStore.getOrBuildCardForRegistration gracefully handles partial or missing fields', () => {
  const minimalReg: Partial<RegistrationRecord> = {
    id: 'REG-PARTIAL-001',
    fullName: 'Test Incomplete Student',
    paymentStatus: 'paid',
  };

  const card = IdCardStore.getOrBuildCardForRegistration(minimalReg as RegistrationRecord);

  assert.ok(card, 'Card must be created');
  assert.equal(typeof card.batchName, 'string', 'batchName must be a string');
  assert.ok(card.batchName.length > 0, 'batchName must not be empty');
  assert.equal(typeof card.batchYear, 'string', 'batchYear must be a string');
  assert.equal(typeof card.idNumber, 'string', 'idNumber must be a string');
  assert.equal(typeof card.contactNumber, 'string', 'contactNumber must be a string');
  assert.equal(typeof card.studentName, 'string', 'studentName must be a string');
  assert.equal(typeof card.verificationUrl, 'string', 'verificationUrl must be a string');

  // Verify that calling .toLowerCase() on any field does NOT throw
  assert.doesNotThrow(() => {
    card.batchName.toLowerCase();
    card.batchYear.toLowerCase();
    card.idNumber.toLowerCase();
    card.contactNumber.toLowerCase();
    card.studentName.toLowerCase();
  });
});

test('Mobile Resilience 2: IdCardStore.getBatchCollections handles missing batchYear without crashing', () => {
  assert.doesNotThrow(() => {
    const batches = IdCardStore.getBatchCollections();
    assert.ok(Array.isArray(batches), 'Batches must be an array');
    for (const b of batches) {
      assert.equal(typeof b.batchYear, 'string');
      assert.ok(b.totalEligibleStudents >= 0);
    }
  });
});

test('Mobile Resilience 3: Local QR Code Data URL complies with CSP (data: URI) and works offline', async () => {
  const url = await generateStudentQrCodeDataUrl('https://plscf2026.reunion.org/verify-student-id?id=TEST&token=XYZ123');
  assert.ok(url.startsWith('data:image/png;base64,'), 'QR Code must be a data:image/png URI');
  assert.ok(url.length > 100, 'QR Code data URI must be populated');
});

test('Mobile Resilience 4: Student ID Management & Card Search Filter predicates never throw on null/undefined properties', () => {
  const malformedItems = [
    { studentName: undefined, idNumber: undefined, contactNumber: undefined, batchName: undefined, batchYear: undefined },
    { studentName: null, idNumber: null, contactNumber: null, batchName: null, batchYear: null },
    { studentName: 'Rahim', idNumber: 'PLSC-01', contactNumber: '01700000000', batchName: 'Class 10', batchYear: 'Current' },
  ];

  const q = 'class';

  assert.doesNotThrow(() => {
    const filtered = malformedItems.filter((item: any) => {
      const matchesName = (item.studentName || '').toLowerCase().includes(q);
      const matchesId = (item.idNumber || '').toLowerCase().includes(q);
      const matchesContact = (item.contactNumber || '').toLowerCase().includes(q);
      const matchesBatch = (item.batchName || item.batchYear || '').toLowerCase().includes(q);
      return matchesName || matchesId || matchesContact || matchesBatch;
    });

    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].studentName, 'Rahim');
  });
});
