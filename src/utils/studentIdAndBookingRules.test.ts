import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidBangladeshiMobile,
  isValidEmail,
  validateRegistrationData,
  verifyStudentIdAgainstRecords,
  RegistrationFormData,
} from './rules';
import { CurrentStudentIdRecord } from '../types';

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
