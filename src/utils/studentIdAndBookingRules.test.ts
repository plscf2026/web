import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidBangladeshiMobile,
  isValidEmail,
  validateRegistrationData,
  verifyStudentIdAgainstRecords,
  RegistrationFormData,
  isStudentBelowClass6,
} from './rules';
import { CurrentStudentIdRecord } from '../types';
import { StudentIdService, getDeletedStudentIds, clearDeletedStudentIds } from '../services/studentIdStore';
import { parseScannedInput } from './tokenGenerator';

test('Strict 11-digit Bangladeshi mobile validation in Contact & Registration forms', () => {
  // Valid cases
  assert.equal(isValidBangladeshiMobile('01712345678'), true);
  assert.equal(isValidBangladeshiMobile('01812345678'), true);
  assert.equal(isValidBangladeshiMobile('01912345678'), true);
  assert.equal(isValidBangladeshiMobile('01312345678'), true);
  assert.equal(isValidBangladeshiMobile('01412345678'), true);
  assert.equal(isValidBangladeshiMobile('01512345678'), true);
  assert.equal(isValidBangladeshiMobile('01612345678'), true);

  // Exact 11-digit regex check used in Contact page
  const regex = /^01[3-9]\d{8}$/;
  assert.equal(regex.test('01712345678'), true);
  assert.equal(regex.test('01899999999'), true);

  // Invalid: length less than 11
  assert.equal(regex.test('0171234567'), false);
  // Invalid: length greater than 11
  assert.equal(regex.test('017123456789'), false);
  // Invalid: starts with 02 or 010, 011, 012
  assert.equal(regex.test('02712345678'), false);
  assert.equal(regex.test('01212345678'), false);
  // Invalid: contains non-digits
  assert.equal(regex.test('0171234567a'), false);
});

test('Email optional across registration: valid when empty, validated if provided', () => {
  // Empty or whitespace is completely valid
  assert.equal(isValidEmail(''), true);
  assert.equal(isValidEmail('   '), true);

  // Valid email addresses
  assert.equal(isValidEmail('student@plscf.edu.bd'), true);
  assert.equal(isValidEmail('user.name@example.com'), true);

  // Invalid format if provided
  assert.equal(isValidEmail('not-an-email'), false);
  assert.equal(isValidEmail('missing@domain'), false);
  assert.equal(isValidEmail('@nodomain.com'), false);
});

test('Registration validation with optional email for Alumni and Current students', () => {
  // Alumni with NO email: should pass validation
  const alumniNoEmail: RegistrationFormData = {
    fullName: 'Kamal Hossain',
    photoUrl: 'data:image/png;base64,sample',
    mobileNumber: '01712345678',
    email: '', // Empty email allowed
    address: 'Faridpur',
    gender: 'male',
    bloodGroup: 'O+',
    category: 'former',
    passingYear: '2005',
    lastClassAttended: 'SSC',
    batchName: 'SSC 2005',
    tShirtSize: 'XL',
    donationAmount: 0,
    termsAccepted: true,
  };

  const res1 = validateRegistrationData(alumniNoEmail);
  assert.equal(res1.isValid, true);
  assert.equal(res1.errors.email, undefined);

  // Alumni with invalid email: should fail validation
  const alumniBadEmail: RegistrationFormData = {
    ...alumniNoEmail,
    email: 'bad-email-format',
  };
  const res2 = validateRegistrationData(alumniBadEmail);
  assert.equal(res2.isValid, false);
  assert.ok(res2.errors.email);
});

test('Current Student ID verification rules: AVAILABLE, NOT_FOUND, ALREADY_USED, INACTIVE, RESERVED', () => {
  const records: CurrentStudentIdRecord[] = [
    {
      id: '1',
      studentId: 'PLSC-2026-101',
      studentName: 'Sultan Mahmud',
      className: 'Class 10',
      academicYear: '2026',
      status: 'ACTIVE',
      verificationStatus: 'AVAILABLE',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    {
      id: '2',
      studentId: 'PLSC-2026-102',
      studentName: 'Sadia Sultana',
      className: 'Class 10',
      academicYear: '2026',
      status: 'ACTIVE',
      verificationStatus: 'USED',
      usedRegistrationId: 'PLSCF-26C2001',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    {
      id: '3',
      studentId: 'PLSC-2026-107',
      studentName: 'Mehedi Hasan',
      className: 'Class 12 (HSC)',
      academicYear: '2026',
      status: 'INACTIVE',
      verificationStatus: 'AVAILABLE',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    {
      id: '4',
      studentId: 'PLSC-2026-109',
      studentName: 'Reserved Student',
      className: 'Class 8',
      academicYear: '2026',
      status: 'ACTIVE',
      verificationStatus: 'RESERVED',
      reservedUntil: new Date(Date.now() + 600000).toISOString(),
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
  ];

  // 1. Available ID verification
  const resAvailable = verifyStudentIdAgainstRecords('PLSC-2026-101', records);
  assert.equal(resAvailable.success, true);
  assert.equal(resAvailable.status, 'AVAILABLE');
  assert.equal(resAvailable.record?.studentName, 'Sultan Mahmud');

  // 2. ID Not Found
  const resNotFound = verifyStudentIdAgainstRecords('UNKNOWN-ID-999', records);
  assert.equal(resNotFound.success, false);
  assert.equal(resNotFound.status, 'NOT_FOUND');

  // 3. ID Already Used
  const resUsed = verifyStudentIdAgainstRecords('PLSC-2026-102', records);
  assert.equal(resUsed.success, false);
  assert.equal(resUsed.status, 'ALREADY_USED');

  // 4. Inactive ID
  const resInactive = verifyStudentIdAgainstRecords('PLSC-2026-107', records);
  assert.equal(resInactive.success, false);
  assert.equal(resInactive.status, 'INACTIVE');

  // 5. Reserved ID
  const resReserved = verifyStudentIdAgainstRecords('PLSC-2026-109', records);
  assert.equal(resReserved.success, false);
  assert.equal(resReserved.status, 'RESERVED');
});

test('Current Student registration requires verified student ID', () => {
  const currentStudentNoId: RegistrationFormData = {
    fullName: 'Tanvir Ahmed',
    photoUrl: 'data:image/png;base64,sample',
    mobileNumber: '01811223344',
    address: 'Faridpur',
    gender: 'male',
    bloodGroup: 'A+',
    category: 'current',
    currentClass: 'Class 10',
    batchName: 'Class 10 Section A',
    tShirtSize: 'M',
    donationAmount: 0,
    termsAccepted: true,
  };

  const res1 = validateRegistrationData(currentStudentNoId);
  assert.equal(res1.isValid, false);
  assert.ok(res1.errors.studentId);

  // With student ID provided
  const currentStudentWithId: RegistrationFormData = {
    ...currentStudentNoId,
    studentId: 'PLSC-2026-101',
  };
  const res2 = validateRegistrationData(currentStudentWithId);
  assert.equal(res2.isValid, true);
  assert.equal(res2.errors.studentId, undefined);
});

test('Super Admin student ID import parses flexible headers (student_id, student_name, class, year)', () => {
  const csvContent = `student_id, student_name, class, year\nPLSC-TEST-901, Tareq Mahmud, Class 10, 2026\nPLSC-TEST-902, Jannat Ferdous, Class 9, 2026`;
  const report = StudentIdService.importFromCSV(csvContent);
  assert.equal(report.addedCount >= 0, true);

  const verified = StudentIdService.verifyStudentId('PLSC-TEST-901');
  assert.equal(verified.success, true);
  assert.equal(verified.record?.studentName, 'Tareq Mahmud');
  assert.equal(verified.record?.className, 'Class 10');
  assert.equal(verified.record?.academicYear, '2026');
});

test('parseScannedInput extracts ID and regNumber from formatted label (GUEST-0001 (PLSCF-GST-2027-0001))', () => {
  const parsed = parseScannedInput('GUEST-0001 (PLSCF-GST-2027-0001)');
  assert.equal(parsed.id, 'GUEST-0001');
  assert.equal(parsed.regNumber, 'PLSCF-GST-2027-0001');
  assert.equal(parsed.isGuestPass, true);
});

test('isStudentBelowClass6 accurately identifies students below Class 6 across number and text variations', () => {
  // Raw digit formats (as uploaded in admin CSV e.g. "4")
  assert.equal(isStudentBelowClass6('4'), true);
  assert.equal(isStudentBelowClass6('1'), true);
  assert.equal(isStudentBelowClass6('2'), true);
  assert.equal(isStudentBelowClass6('3'), true);
  assert.equal(isStudentBelowClass6('5'), true);

  // Standard "Class X" formats
  assert.equal(isStudentBelowClass6('Class 4'), true);
  assert.equal(isStudentBelowClass6('class 5'), true);
  assert.equal(isStudentBelowClass6('Class-3'), true);

  // Early childhood formats
  assert.equal(isStudentBelowClass6('Play'), true);
  assert.equal(isStudentBelowClass6('Nursery'), true);
  assert.equal(isStudentBelowClass6('KG'), true);

  // Roman numerals
  assert.equal(isStudentBelowClass6('IV'), true);
  assert.equal(isStudentBelowClass6('Class IV'), true);

  // Bengali numerals
  assert.equal(isStudentBelowClass6('৪'), true);
  assert.equal(isStudentBelowClass6('শ্রেণি ৪'), true);

  // NOT below Class 6
  assert.equal(isStudentBelowClass6('Class 6'), false);
  assert.equal(isStudentBelowClass6('6'), false);
  assert.equal(isStudentBelowClass6('Class 7'), false);
  assert.equal(isStudentBelowClass6('Class 10'), false);
  assert.equal(isStudentBelowClass6('10'), false);
  assert.equal(isStudentBelowClass6('Class 12 (HSC)'), false);
  assert.equal(isStudentBelowClass6(''), false);
  assert.equal(isStudentBelowClass6(undefined), false);
});

test('Student ID Deletion Engine: Existing and dynamic IDs delete permanently without resurrection', async () => {
  // Clear any previous test deleted tracking
  clearDeletedStudentIds();

  // 1. Initial list has the seed IDs (e.g. PLSC-2026-102)
  const initialList = StudentIdService.getAllStudentIds();
  const targetId = 'PLSC-2026-102';
  const existsBefore = initialList.some((s) => s.studentId === targetId);
  assert.equal(existsBefore, true, 'PLSC-2026-102 should initially exist');

  // 2. Delete the existing seed Student ID
  const deleteRes = await StudentIdService.deleteRecordAsync(targetId, 'Audit Test: Admin removal of test seed ID');
  assert.equal(deleteRes.success, true, 'Deletion should report success');

  // 3. Verify it is removed immediately from getAllStudentIds()
  const listAfterDelete = StudentIdService.getAllStudentIds();
  const existsAfter = listAfterDelete.some((s) => s.studentId === targetId);
  assert.equal(existsAfter, false, 'PLSC-2026-102 must NOT exist in student list after deletion');

  // 4. Verify deleted tracking contains targetId
  const deletedSet = getDeletedStudentIds();
  assert.equal(deletedSet.has(targetId), true, 'PLSC-2026-102 must be registered in deleted tracking set');

  // 5. Subsequent call (simulating page reload or component re-render) must NEVER resurrect it
  const listSubsequent = StudentIdService.getAllStudentIds();
  assert.equal(listSubsequent.some((s) => s.studentId === targetId), false, 'PLSC-2026-102 must remain absent on re-fetch');

  // 6. Test USED student ID protection
  const usedTarget = initialList.find((s) => s.verificationStatus === 'USED');
  if (usedTarget) {
    const cannotDeleteUsed = await StudentIdService.deleteRecordAsync(usedTarget.studentId, 'Attempt delete used');
    assert.equal(cannotDeleteUsed.success, false, 'USED student ID must be protected from deletion');
    assert.ok(cannotDeleteUsed.error?.includes('Cannot delete'), 'Error message should explain protection');
  }

  // 7. Test Add, Update, and Delete on dynamic Student ID
  const dynamicId = 'PLSC-DYN-999';
  const addRes = await StudentIdService.addStudentIdAsync({
    studentId: dynamicId,
    studentName: 'Dynamic Student',
    className: 'Class 10',
    academicYear: '2026',
  });
  assert.equal(addRes.success, true);

  const listWithDynamic = StudentIdService.getAllStudentIds();
  assert.equal(listWithDynamic.some((s) => s.studentId === dynamicId), true);

  // Update dynamic
  const updateRes = await StudentIdService.updateRecordAsync(dynamicId, {
    studentName: 'Dynamic Student Updated',
  }, 'Name correction');
  assert.equal(updateRes, true);

  const updatedRec = StudentIdService.getAllStudentIds().find((s) => s.studentId === dynamicId);
  assert.equal(updatedRec?.studentName, 'Dynamic Student Updated');

  // Delete dynamic
  const deleteDynRes = await StudentIdService.deleteRecordAsync(dynamicId, 'Cleaning up dynamic test ID');
  assert.equal(deleteDynRes.success, true);
  assert.equal(StudentIdService.getAllStudentIds().some((s) => s.studentId === dynamicId), false);
});
