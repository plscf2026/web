import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidBangladeshiMobile,
  isValidEmail,
  validateRegistrationData,
  calculateTotalFee,
  verifyGateScan,
  calculateFinancialSummary,
  getGatewayChargeRate,
  calculateGatewayCharge,
  RegistrationFormData,
} from './rules';
import { RegistrationRecord, DonationRecord, ExpenseRecord, FeeSettings } from '../types';

test('Bangladeshi mobile number validation', () => {
  assert.equal(isValidBangladeshiMobile('01712345678'), true);
  assert.equal(isValidBangladeshiMobile('+8801812345678'), true);
  assert.equal(isValidBangladeshiMobile('8801912345678'), true);
  assert.equal(isValidBangladeshiMobile('01300000000'), true);
  assert.equal(isValidBangladeshiMobile('01511111111'), true);

  // Invalid cases
  assert.equal(isValidBangladeshiMobile('01212345678'), false); // 012 is not a valid BD operator prefix
  assert.equal(isValidBangladeshiMobile('0171234567'), false); // 10 digits
  assert.equal(isValidBangladeshiMobile('017123456789'), false); // 12 digits
  assert.equal(isValidBangladeshiMobile(''), false);
  assert.equal(isValidBangladeshiMobile('abcdefghijk'), false);
});

test('Email address validation', () => {
  assert.equal(isValidEmail('student@plscf.edu.bd'), true);
  assert.equal(isValidEmail('alumni.1998@gmail.com'), true);
  assert.equal(isValidEmail('not-an-email'), false);
  assert.equal(isValidEmail('missing@domain'), false);
  assert.equal(isValidEmail(''), true); // Optional: empty email is considered valid
});

test('validateRegistrationData for former and current students', () => {
  const validFormer: RegistrationFormData = {
    fullName: 'Mohammad Rahim',
    photoUrl: 'data:image/png;base64,sample',
    mobileNumber: '01711223344',
    email: 'rahim@example.com',
    address: 'Faridpur Sadar',
    gender: 'male',
    bloodGroup: 'B+',
    category: 'former',
    passingYear: '2010',
    batchName: 'SSC 2010',
    tShirtSize: 'L',
    donationAmount: 500,
    termsAccepted: true,
  };

  const res1 = validateRegistrationData(validFormer);
  assert.equal(res1.isValid, true);
  assert.equal(Object.keys(res1.errors).length, 0);

  // Missing photo and invalid mobile
  const invalidData: RegistrationFormData = {
    fullName: 'A',
    photoUrl: '',
    mobileNumber: '12345',
    email: 'bad-email',
    address: '',
    category: 'former',
    passingYear: '',
    batchName: '',
    tShirtSize: '',
    donationAmount: 0,
    termsAccepted: false,
  };

  const res2 = validateRegistrationData(invalidData);
  assert.equal(res2.isValid, false);
  assert.ok(res2.errors.fullName);
  assert.ok(res2.errors.photoUrl);
  assert.ok(res2.errors.mobileNumber);
  assert.ok(res2.errors.email);
  assert.ok(res2.errors.passingYear);
  assert.ok(res2.errors.tShirtSize);
  assert.ok(res2.errors.termsAccepted);
});

test('calculateTotalFee computes correct amounts', () => {
  const feeSettings: FeeSettings = {
    formerStudentFee: 1500,
    currentStudentFee: 500,
    registrationOpen: true,
    startDate: '2026-01-01',
    endDate: '2026-12-01',
    lateFeeEnabled: false,
    lateFeeAmount: 0,
  };

  const former = calculateTotalFee('former', feeSettings, 1000);
  assert.equal(former.registrationFee, 1500);
  assert.equal(former.donationAmount, 1000);
  assert.equal(former.totalPayable, 2500);

  const current = calculateTotalFee('current', feeSettings, 0);
  assert.equal(current.registrationFee, 500);
  assert.equal(current.totalPayable, 500);
});

test('verifyGateScan prevents duplicate entries and unauthorized access', () => {
  const paidStudent: RegistrationRecord = {
    id: 'PLSCF-26F1001',
    fullName: 'Shakil Ahmed',
    photoUrl: 'https://example.com/photo.jpg',
    mobileNumber: '01711223344',
    email: 'shakil@example.com',
    address: 'Faridpur',
    category: 'former',
    passingYear: '2005',
    batchName: 'SSC 2005',
    tShirtSize: 'XL',
    registrationFee: 1500,
    donationAmount: 0,
    totalPaid: 1500,
    paymentStatus: 'paid',
    transactionId: 'TRX999',
    paymentMethod: 'bkash',
    registeredAt: '2026-02-01',
    qrToken: 'QR-TOKEN-123',
    isTShirtCollected: false,
  };

  // 1. Initial entry: allowed
  const entry1 = verifyGateScan(paidStudent, false, 'entry');
  assert.equal(entry1.allowed, true);
  assert.equal(entry1.code, 'APPROVED');

  // 2. Duplicate entry while already inside: blocked!
  const duplicateEntry = verifyGateScan(paidStudent, true, 'entry');
  assert.equal(duplicateEntry.allowed, false);
  assert.equal(duplicateEntry.code, 'ALREADY_INSIDE');

  // 3. Exit while inside: allowed
  const exit1 = verifyGateScan(paidStudent, true, 'exit');
  assert.equal(exit1.allowed, true);
  assert.equal(exit1.code, 'APPROVED');

  // 4. Exit when not inside: blocked!
  const invalidExit = verifyGateScan(paidStudent, false, 'exit');
  assert.equal(invalidExit.allowed, false);
  assert.equal(exit1.code, 'APPROVED');
  assert.equal(invalidExit.code, 'NOT_INSIDE');

  // 5. Unpaid student: blocked
  const unpaidStudent = { ...paidStudent, paymentStatus: 'pending' as const };
  const unpaidEntry = verifyGateScan(unpaidStudent, false, 'entry');
  assert.equal(unpaidEntry.allowed, false);
  assert.equal(unpaidEntry.code, 'UNPAID');
});

test('calculateFinancialSummary correctly aggregates numbers', () => {
  const registrations: RegistrationRecord[] = [
    {
      id: 'PLSCF-1',
      fullName: 'A',
      photoUrl: '',
      mobileNumber: '',
      email: '',
      address: '',
      category: 'former',
      batchName: '2010',
      tShirtSize: 'L',
      registrationFee: 1500,
      donationAmount: 500,
      totalPaid: 2000,
      paymentStatus: 'paid',
      transactionId: 'T1',
      paymentMethod: 'bkash',
      registeredAt: '',
      qrToken: '',
      isTShirtCollected: true,
    },
    {
      id: 'PLSCF-2',
      fullName: 'B',
      photoUrl: '',
      mobileNumber: '',
      email: '',
      address: '',
      category: 'current',
      batchName: 'Class 10',
      tShirtSize: 'M',
      registrationFee: 500,
      donationAmount: 0,
      totalPaid: 500,
      paymentStatus: 'paid',
      transactionId: 'T2',
      paymentMethod: 'nagad',
      registeredAt: '',
      qrToken: '',
      isTShirtCollected: false,
    },
    {
      id: 'PLSCF-3',
      fullName: 'C',
      photoUrl: '',
      mobileNumber: '',
      email: '',
      address: '',
      category: 'former',
      batchName: '2015',
      registrationFee: 1500,
      donationAmount: 0,
      totalPaid: 0,
      paymentStatus: 'pending', // Pending, should NOT count towards paid revenue
      transactionId: 'T3',
      paymentMethod: 'rocket',
      registeredAt: '',
      qrToken: '',
      tShirtSize: 'XL',
      isTShirtCollected: false,
    },
  ];

  const donations: DonationRecord[] = [
    {
      id: 'DON-1',
      donorName: 'Patron',
      mobileNumber: '',
      email: '',
      amount: 10000,
      purpose: 'Souvenir',
      paymentMethod: 'bkash',
      transactionId: 'TD1',
      date: '2026-02-01',
    },
  ];

  const expenses: ExpenseRecord[] = [
    {
      id: 'EXP-1',
      category: 'Stage',
      amount: 4000,
      reason: 'Stage advance',
      date: '2026-02-02',
      responsiblePerson: 'Admin',
      receiptRef: 'REC-01',
    },
  ];

  const summary = calculateFinancialSummary(registrations, donations, expenses);

  assert.equal(summary.paidRegistrationsCount, 2);
  assert.equal(summary.formerStudentsCount, 1);
  assert.equal(summary.currentStudentsCount, 1);
  assert.equal(summary.totalRegistrationRevenue, 2000); // 1500 + 500
  assert.equal(summary.totalDonations, 10500); // 500 from registration + 10000 independent
  assert.equal(summary.totalIncome, 12500); // 2000 + 10500
  assert.equal(summary.totalExpenses, 4000);
  assert.equal(summary.remainingBalance, 8500);
});

test('Blood Group validation in registration rules', () => {
  const baseData: RegistrationFormData = {
    fullName: 'Ananya Sen',
    photoUrl: 'data:image/png;base64,sample',
    mobileNumber: '01711223344',
    address: 'Faridpur',
    gender: 'female',
    category: 'former',
    passingYear: '2015',
    batchName: 'SSC 2015',
    tShirtSize: 'M',
    donationAmount: 0,
    termsAccepted: true,
  };

  // Missing blood group: fails
  const resNoBlood = validateRegistrationData({ ...baseData, bloodGroup: '' });
  assert.equal(resNoBlood.isValid, false);
  assert.ok(resNoBlood.errors.bloodGroup);

  // Valid blood group: passes
  const resValidBlood = validateRegistrationData({ ...baseData, bloodGroup: 'AB+' });
  assert.equal(resValidBlood.isValid, true);
  assert.equal(resValidBlood.errors.bloodGroup, undefined);
});

test('Accompanying Parent / Guardian validation & fee calculation rules', () => {
  const feeSettings: FeeSettings = {
    formerStudentFee: 1500,
    currentStudentFee: 1000,
    registrationOpen: true,
    startDate: '2026-01-01',
    endDate: '2026-12-01',
    lateFeeEnabled: false,
    lateFeeAmount: 0,
  };

  // 1. Fee calculation without parent
  const feesWithoutParent = calculateTotalFee('former', feeSettings, 500, false);
  assert.equal(feesWithoutParent.registrationFee, 1500);
  assert.equal(feesWithoutParent.parentFee, 0);
  assert.equal(feesWithoutParent.donationAmount, 500);
  assert.equal(feesWithoutParent.totalPayable, 2000);

  // 2. Fee calculation WITH accompanying parent (+৳1,500)
  const feesWithParent = calculateTotalFee('former', feeSettings, 500, true);
  assert.equal(feesWithParent.registrationFee, 1500);
  assert.equal(feesWithParent.parentFee, 1500);
  assert.equal(feesWithParent.donationAmount, 500);
  assert.equal(feesWithParent.totalPayable, 3500); // 1500 + 1500 + 500

  // 3. Parent field validation when hasParent is true
  const baseStudent: RegistrationFormData = {
    fullName: 'Fatema Begum',
    photoUrl: 'data:image/png;base64,sample',
    mobileNumber: '01811223344',
    address: 'Faridpur',
    gender: 'female',
    bloodGroup: 'O+',
    category: 'former',
    passingYear: '2018',
    batchName: 'SSC 2018',
    tShirtSize: 'S',
    donationAmount: 0,
    termsAccepted: true,
    hasParent: true,
  };

  // Missing parent fields (including photo)
  const resMissingParent = validateRegistrationData(baseStudent);
  assert.equal(resMissingParent.isValid, false);
  assert.ok(resMissingParent.errors.parentName);
  assert.ok(resMissingParent.errors.parentPhotoUrl);
  assert.ok(resMissingParent.errors.parentAge);
  assert.ok(resMissingParent.errors.parentPhone);
  assert.ok(resMissingParent.errors.parentRelation);

  // Invalid parent relation (only Guardian, Father, Mother, Sister, Brother allowed)
  const resInvalidRelation = validateRegistrationData({
    ...baseStudent,
    parentName: 'Abdul Malek',
    parentPhotoUrl: 'https://example.com/parent.jpg',
    parentAge: 52,
    parentPhone: '01700000000',
    parentRelation: 'Cousin',
  });
  assert.equal(resInvalidRelation.isValid, false);
  assert.ok(resInvalidRelation.errors.parentRelation);

  // Valid parent fields provided with Guardian default
  const resValidGuardian = validateRegistrationData({
    ...baseStudent,
    parentName: 'Abdul Malek',
    parentPhotoUrl: 'https://example.com/parent.jpg',
    parentAge: 52,
    parentPhone: '01700000000',
    parentRelation: 'Guardian',
  });
  assert.equal(resValidGuardian.isValid, true);
  assert.equal(resValidGuardian.errors.parentName, undefined);
  assert.equal(resValidGuardian.errors.parentPhotoUrl, undefined);
  assert.equal(resValidGuardian.errors.parentPhone, undefined);
  assert.equal(resValidGuardian.errors.parentRelation, undefined);

  // Valid with Sister
  const resValidSister = validateRegistrationData({
    ...baseStudent,
    parentName: 'Fatema Begum',
    parentPhotoUrl: 'https://example.com/sister.jpg',
    parentAge: 24,
    parentPhone: '01700000000',
    parentRelation: 'Sister',
  });
  assert.equal(resValidSister.isValid, true);
});

test('Dynamic Payment Gateway Service Charges: bKash 1.85%, Other MFS 1.50%, Card 2.10%, Amex 3.10%', () => {
  // 1. Rate lookups
  assert.equal(getGatewayChargeRate('bkash'), 0.0185);
  assert.equal(getGatewayChargeRate('nagad'), 0.0150);
  assert.equal(getGatewayChargeRate('rocket'), 0.0150);
  assert.equal(getGatewayChargeRate('card'), 0.0210);
  assert.equal(getGatewayChargeRate('amex'), 0.0310);

  // 2. Exact charge calculation on ৳1,500 base amount
  assert.equal(calculateGatewayCharge(1500, 'bkash'), 27.75); // 1500 * 1.85%
  assert.equal(calculateGatewayCharge(1500, 'nagad'), 22.5);  // 1500 * 1.50%
  assert.equal(calculateGatewayCharge(1500, 'rocket'), 22.5); // 1500 * 1.50%
  assert.equal(calculateGatewayCharge(1500, 'card'), 31.5);   // 1500 * 2.10%
  assert.equal(calculateGatewayCharge(1500, 'amex'), 46.5);   // 1500 * 3.10%

  // 3. Exact charge calculation on ৳3,000 (Student + Parent: 1500 + 1500)
  assert.equal(calculateGatewayCharge(3000, 'bkash'), 55.5);
  assert.equal(calculateGatewayCharge(3000, 'nagad'), 45.0);
  assert.equal(calculateGatewayCharge(3000, 'card'), 63.0);
  assert.equal(calculateGatewayCharge(3000, 'amex'), 93.0);
});
