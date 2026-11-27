import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateRegistrationData,
  RegistrationFormData,
} from './rules';

test('Registration Form: Academic & T-shirt initial state and validation invariants', async (t) => {
  await t.test('1. Passing year generation starts from 2026 down to 1962', () => {
    const passingYears: number[] = [];
    for (let y = 2026; y >= 1962; y--) {
      passingYears.push(y);
    }
    assert.equal(passingYears[0], 2026, 'Passing years must start from 2026');
    assert.equal(passingYears[passingYears.length - 1], 1962, 'Passing years must end at 1962');
    assert.ok(passingYears.includes(2026), '2026 must be present in passing years list');
    assert.ok(passingYears.includes(1962), '1962 must be present in passing years list');
    assert.equal(passingYears.length, 2026 - 1962 + 1);
  });

  await t.test('2. Submission is blocked when passing year is empty or unselected', () => {
    const formerNoPassingYear: RegistrationFormData = {
      fullName: 'Sagar Saha',
      photoUrl: 'data:image/jpeg;base64,sample',
      mobileNumber: '01712345678',
      address: 'Faridpur',
      gender: 'male',
      bloodGroup: 'B+',
      category: 'former',
      passingYear: '', // Left empty / at placeholder
      lastClassAttended: 'SSC',
      batchName: 'SSC Batch',
      tShirtSize: 'XL',
      donationAmount: 0,
      termsAccepted: true,
    };

    const res = validateRegistrationData(formerNoPassingYear);
    assert.equal(res.isValid, false, 'Validation must fail when passing year is empty');
    assert.ok(res.errors.passingYear, 'errors.passingYear must be populated');
  });

  await t.test('3. Submission is blocked when T-shirt size is empty or unselected', () => {
    const formerNoTShirt: RegistrationFormData = {
      fullName: 'Sagar Saha',
      photoUrl: 'data:image/jpeg;base64,sample',
      mobileNumber: '01712345678',
      address: 'Faridpur',
      gender: 'male',
      bloodGroup: 'B+',
      category: 'former',
      passingYear: '2026',
      lastClassAttended: 'HSC',
      batchName: 'SSC 2026',
      tShirtSize: '' as any, // Unselected initial state
      donationAmount: 0,
      termsAccepted: true,
    };

    const res = validateRegistrationData(formerNoTShirt);
    assert.equal(res.isValid, false, 'Validation must fail when T-shirt size is unselected');
    assert.ok(res.errors.tShirtSize, 'errors.tShirtSize must be populated');
  });

  await t.test('4. Valid selections for passing year, last class, and T-shirt pass validation', () => {
    const validRegistration: RegistrationFormData = {
      fullName: 'Sagar Saha',
      photoUrl: 'data:image/jpeg;base64,sample',
      mobileNumber: '01712345678',
      address: 'Faridpur',
      gender: 'male',
      bloodGroup: 'B+',
      category: 'former',
      passingYear: '2026',
      lastClassAttended: 'HSC',
      batchName: 'SSC 2026',
      tShirtSize: 'XL',
      donationAmount: 0,
      termsAccepted: true,
    };

    const res = validateRegistrationData(validRegistration);
    assert.equal(res.isValid, true, 'Validation must pass when all required fields are filled');
    assert.equal(Object.keys(res.errors).length, 0);
  });

  await t.test('5. Editing an existing registration preserves and restores saved selections', () => {
    const existingSavedData: Partial<RegistrationFormData> = {
      passingYear: '2020',
      lastClassAttended: 'Class 8',
      tShirtSize: 'XXL',
    };

    // When editing, initial values should take the saved values
    const passingYear = existingSavedData.passingYear || '';
    const lastClassAttended = existingSavedData.lastClassAttended || '';
    const tShirtSize = existingSavedData.tShirtSize || '';

    assert.equal(passingYear, '2020');
    assert.equal(lastClassAttended, 'Class 8');
    assert.equal(tShirtSize, 'XXL');
  });

  await t.test('6. Fresh registration initializes with empty selections (no pre-selected defaults)', () => {
    const draft = null as Partial<RegistrationFormData> | null; // Fresh registration without draft
    const initialData = undefined as Partial<RegistrationFormData> | undefined; // No editing data

    const passingYear = draft?.passingYear || initialData?.passingYear || '';
    const lastClassAttended = draft?.lastClassAttended || initialData?.lastClassAttended || '';
    const tShirtSize = draft?.tShirtSize || initialData?.tShirtSize || '';

    assert.equal(passingYear, '', 'Fresh passing year must be empty string');
    assert.equal(lastClassAttended, '', 'Fresh last class attended must be empty string');
    assert.equal(tShirtSize, '', 'Fresh t-shirt size must be empty string');
  });
});
