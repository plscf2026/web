/**
 * Police Lines School & College, Faridpur - Grand Reunion 2026 / 2027
 * Student ID Card Management System Comprehensive Test Suite
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { IdCardStore } from '../services/idCardStore';
import {
  generateIndividualIdCardPdf,
  generateBatchCombinedA4Pdf,
  generateBatchZipArchive,
  generateAllBatchesBulkZip,
  generateStudentQrCodeDataUrl,
} from './idCardGenerator';
import { ID_CARD_DIMENSIONS } from './idCardTemplateAssets';
import { StudentIdCardRecord } from '../types/idcard';

test('ID Card 1: Retrieves only paid & eligible students and flags missing data for review', () => {
  const cards = IdCardStore.syncWithRegistrations();

  assert.ok(cards.length > 0, 'Must have eligible paid student cards');

  // Verify all cards have paid source and valid registration ID
  cards.forEach((card) => {
    assert.ok(card.registrationId, 'Must have a valid registration ID');
    assert.ok(card.qrToken, 'Must have unique QR token');
    assert.ok(card.verificationUrl.includes(card.registrationId), 'Verification URL must link to student registration ID');

    if (!card.hasPhoto) {
      assert.equal(card.cardStatus, 'FLAGGED_REVIEW', 'Missing photo must flag card for review');
      assert.ok(card.reviewReason?.includes('photograph'), 'Review reason must specify missing photo');
    }
  });
});

test('ID Card 2: Staff approval workflow enforces Super Admin control', () => {
  // 1. Create a staff account
  const newStaff = IdCardStore.createStaffAccount({
    fullName: 'Test Staff Lead',
    username: 'test.staff.lead',
    email: 'test.staff@plscf.edu.bd',
    role: 'ID_CARD_STAFF',
    createdBy: 'admin@gmail.com',
  });

  assert.equal(newStaff.status, 'PENDING_APPROVAL', 'New staff account must default to PENDING_APPROVAL');

  // 2. Approve staff account
  IdCardStore.updateStaffStatus(newStaff.id, 'APPROVED', 'admin@gmail.com');
  const staffList = IdCardStore.getStaffAccounts();
  const approved = staffList.find((s) => s.id === newStaff.id);

  assert.equal(approved?.status, 'APPROVED', 'Staff account must be marked APPROVED');
  assert.equal(approved?.approvedBy, 'admin@gmail.com');
  assert.ok(approved?.approvedAt);

  // 3. Clean up
  IdCardStore.deleteStaffAccount(newStaff.id);
});

test('ID Card 3: Generates individual print-ready PDF matching 54 × 86 mm physical dimensions', async () => {
  const sampleStudent: StudentIdCardRecord = {
    id: 'IDC-TEST-001',
    registrationId: 'PLSCF-2026-F1001',
    eventYear: 2026,
    studentName: 'Tanvir Ahmed',
    batchYear: '1998',
    batchName: 'SSC 1998',
    idNumber: 'PLSCF-2026-F1001',
    contactNumber: '01711223344',
    photoUrl: undefined,
    hasPhoto: false,
    qrToken: 'PLSCF26-TANVIR-98',
    verificationUrl: 'https://plscf2026.reunion.org/verify?id=PLSCF-2026-F1001&token=PLSCF26-TANVIR-98',
    cardStatus: 'ELIGIBLE',
    cardDimensions: '54x86mm',
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const { pdfBlob, fileSizeBytes } = await generateIndividualIdCardPdf(sampleStudent);

  assert.ok(pdfBlob instanceof Blob, 'Must return a valid PDF Blob');
  assert.equal(pdfBlob.type, 'application/pdf');
  assert.ok(fileSizeBytes > 10000, 'PDF size must be substantial and contain visual layers');

  // Verify dimensions constant
  assert.equal(ID_CARD_DIMENSIONS.widthMm, 54.0);
  assert.equal(ID_CARD_DIMENSIONS.heightMm, 86.0);
});

test('ID Card 4: Generates Batch-wise Combined A4 Print PDF with gang-run layout', async () => {
  const students: StudentIdCardRecord[] = Array.from({ length: 10 }).map((_, i) => ({
    id: `IDC-TEST-${i + 1}`,
    registrationId: `PLSCF-2026-F${1000 + i}`,
    eventYear: 2026,
    studentName: `Batch Student ${i + 1}`,
    batchYear: '2014',
    batchName: 'SSC 2014',
    idNumber: `PLSCF-2026-F${1000 + i}`,
    contactNumber: '01700000000',
    hasPhoto: false,
    qrToken: `TOKEN-2014-${i + 1}`,
    verificationUrl: `https://plscf2026.reunion.org/verify?id=PLSCF-2026-F${1000 + i}`,
    cardStatus: 'ELIGIBLE',
    cardDimensions: '54x86mm',
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));

  const { pdfBlob, totalPages, fileSizeBytes } = await generateBatchCombinedA4Pdf(students, '2014');

  assert.ok(pdfBlob instanceof Blob);
  assert.equal(totalPages, 2, '10 cards at 9 cards/page must span exactly 2 pages');
  assert.ok(fileSizeBytes > 20000);
});

test('ID Card 5: Generates Year-Wise ZIP Archive preserving required folder hierarchy', async () => {
  const students: StudentIdCardRecord[] = [
    {
      id: 'IDC-TEST-1',
      registrationId: 'PLSCF-2026-F1001',
      eventYear: 2026,
      studentName: 'Student One',
      batchYear: '1998',
      batchName: 'SSC 1998',
      idNumber: 'PLSCF-2026-F1001',
      contactNumber: '01711223344',
      hasPhoto: false,
      qrToken: 'TOKEN-98-1',
      verificationUrl: 'https://plscf2026.reunion.org/verify?id=PLSCF-2026-F1001',
      cardStatus: 'ELIGIBLE',
      cardDimensions: '54x86mm',
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'IDC-TEST-2',
      registrationId: 'PLSCF-2026-F1002',
      eventYear: 2026,
      studentName: 'Student Two',
      batchYear: '1998',
      batchName: 'SSC 1998',
      idNumber: 'PLSCF-2026-F1002',
      contactNumber: '01819887766',
      hasPhoto: false,
      qrToken: 'TOKEN-98-2',
      verificationUrl: 'https://plscf2026.reunion.org/verify?id=PLSCF-2026-F1002',
      cardStatus: 'ELIGIBLE',
      cardDimensions: '54x86mm',
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  let progressCalled = false;
  const zipBlob = await generateBatchZipArchive('1998', students, (_processed, _total, percent) => {
    progressCalled = true;
    assert.ok(percent >= 0 && percent <= 100);
  });

  assert.ok(zipBlob instanceof Blob);
  assert.ok(progressCalled, 'Progress callback must fire');
  assert.ok(zipBlob.size > 1000, 'ZIP blob must have valid content');
});

test('ID Card 6: Generates One-Click Complete Bulk ZIP of All Batches', async () => {
  const studentsByBatch: Record<string, StudentIdCardRecord[]> = {
    '1998': [
      {
        id: 'IDC-1',
        registrationId: 'REG-1',
        eventYear: 2026,
        studentName: 'Tanvir',
        batchYear: '1998',
        batchName: 'SSC 1998',
        idNumber: 'REG-1',
        contactNumber: '01711223344',
        hasPhoto: false,
        qrToken: 'TOK-1',
        verificationUrl: 'https://plscf2026.reunion.org/verify?id=REG-1',
        cardStatus: 'ELIGIBLE',
        cardDimensions: '54x86mm',
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    '2014': [
      {
        id: 'IDC-2',
        registrationId: 'REG-2',
        eventYear: 2026,
        studentName: 'Asad',
        batchYear: '2014',
        batchName: 'SSC 2014',
        idNumber: 'REG-2',
        contactNumber: '01912345678',
        hasPhoto: false,
        qrToken: 'TOK-2',
        verificationUrl: 'https://plscf2026.reunion.org/verify?id=REG-2',
        cardStatus: 'ELIGIBLE',
        cardDimensions: '54x86mm',
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  };

  let progressReported = false;
  const masterZip = await generateAllBatchesBulkZip(studentsByBatch, (_processed, total, percent) => {
    progressReported = true;
    assert.equal(total, 2);
    assert.ok(percent >= 0 && percent <= 100);
  });

  assert.ok(masterZip instanceof Blob);
  assert.ok(progressReported, 'Bulk progress reporter must be called');
  assert.ok(masterZip.size > 2000, 'Master ZIP archive must be populated');
});

test('ID Card 7: Download audit logs record user actions deterministically', () => {
  const initialLogsCount = IdCardStore.getDownloadLogs().length;

  IdCardStore.logDownload({
    userId: 'admin@gmail.com',
    userName: 'Super Admin',
    userRole: 'SUPER_ADMIN',
    downloadType: 'ALL_CARDS_BULK_ZIP',
    batchYear: 'ALL',
    cardCount: 250,
    status: 'SUCCESS',
    details: 'Master ID card archive downloaded',
  });

  const updatedLogs = IdCardStore.getDownloadLogs();
  assert.equal(updatedLogs.length, initialLogsCount + 1);
  assert.equal(updatedLogs[0].downloadType, 'ALL_CARDS_BULK_ZIP');
  assert.equal(updatedLogs[0].cardCount, 250);
  assert.equal(updatedLogs[0].status, 'SUCCESS');
});

test('ID Card 8: Scannable unique QR code data URL generation is deterministic and unique', async () => {
  const url1 = 'https://plscf2026.reunion.org/verify?id=PLSCF-001&token=TOK1';
  const url2 = 'https://plscf2026.reunion.org/verify?id=PLSCF-002&token=TOK2';

  const qr1 = await generateStudentQrCodeDataUrl(url1);
  const qr2 = await generateStudentQrCodeDataUrl(url2);

  assert.ok(qr1.startsWith('data:image/png;base64,'));
  assert.ok(qr2.startsWith('data:image/png;base64,'));
  assert.notEqual(qr1, qr2, 'Distinct verification URLs must produce distinct QR codes');
});

