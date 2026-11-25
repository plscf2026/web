import test from 'node:test';
import assert from 'node:assert/strict';
import { FeeSettings } from '../types';
import { AppStore } from '../services/store';
import { PayStationService } from '../services/paystation';
import {
  isGlobalRegistrationOpen,
  isAlumniRegistrationOpen,
  isCurrentStudentRegistrationOpen,
  isCategoryRegistrationOpen,
  isDonationOpen,
  getRegistrationClosedMessage,
  getDonationClosedMessage,
} from './rules';

// Polyfill in-memory localStorage for Node test runner
const mockStorage: Record<string, string> = {};
if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = {
    getItem: (key: string) => mockStorage[key] || null,
    setItem: (key: string, val: string) => {
      mockStorage[key] = String(val);
    },
    removeItem: (key: string) => {
      delete mockStorage[key];
    },
    clear: () => {
      for (const k of Object.keys(mockStorage)) delete mockStorage[k];
    },
  };
}

test('Registration & Donation Governance: 1. Global Registration Master Switch Behavior', () => {
  // Case A: Global Registration is OFF
  const settingsGlobalOff: FeeSettings = {
    formerStudentFee: 1500,
    currentStudentFee: 500,
    registrationOpen: false, // Master switch OFF
    alumniRegistrationOpen: true, // Should be overridden by master switch
    currentStudentRegistrationOpen: true, // Should be overridden by master switch
    donationOpen: true,
    startDate: '2026-01-01',
    endDate: '2027-01-20',
    lateFeeEnabled: false,
    lateFeeAmount: 0,
  };

  assert.equal(isGlobalRegistrationOpen(settingsGlobalOff), false);
  // When Global Registration is OFF, all categories must be strictly disabled
  assert.equal(isAlumniRegistrationOpen(settingsGlobalOff), false);
  assert.equal(isCurrentStudentRegistrationOpen(settingsGlobalOff), false);
  assert.equal(isCategoryRegistrationOpen('former', settingsGlobalOff), false);
  assert.equal(isCategoryRegistrationOpen('current', settingsGlobalOff), false);

  // Advisory message reflects closed status
  const msgEn = getRegistrationClosedMessage(settingsGlobalOff, 'global', 'en');
  assert.ok(msgEn.includes('closed'));
  const msgBn = getRegistrationClosedMessage(settingsGlobalOff, 'global', 'bn');
  assert.ok(msgBn.includes('বন্ধ'));

  // Case B: Global Registration is ON
  const settingsGlobalOn: FeeSettings = {
    ...settingsGlobalOff,
    registrationOpen: true,
  };
  assert.equal(isGlobalRegistrationOpen(settingsGlobalOn), true);
  assert.equal(isAlumniRegistrationOpen(settingsGlobalOn), true);
  assert.equal(isCurrentStudentRegistrationOpen(settingsGlobalOn), true);
});

test('Registration & Donation Governance: 2. Category Combinations when Global is ON', () => {
  const baseSettings: FeeSettings = {
    formerStudentFee: 1500,
    currentStudentFee: 500,
    registrationOpen: true, // Global is ON
    startDate: '2026-01-01',
    endDate: '2027-01-20',
    lateFeeEnabled: false,
    lateFeeAmount: 0,
  };

  // 1. Alumni Only
  const alumniOnly: FeeSettings = {
    ...baseSettings,
    alumniRegistrationOpen: true,
    currentStudentRegistrationOpen: false,
  };
  assert.equal(isAlumniRegistrationOpen(alumniOnly), true);
  assert.equal(isCurrentStudentRegistrationOpen(alumniOnly), false);
  assert.equal(isCategoryRegistrationOpen('former', alumniOnly), true);
  assert.equal(isCategoryRegistrationOpen('current', alumniOnly), false);

  // 2. Current Student Only
  const currentOnly: FeeSettings = {
    ...baseSettings,
    alumniRegistrationOpen: false,
    currentStudentRegistrationOpen: true,
  };
  assert.equal(isAlumniRegistrationOpen(currentOnly), false);
  assert.equal(isCurrentStudentRegistrationOpen(currentOnly), true);
  assert.equal(isCategoryRegistrationOpen('former', currentOnly), false);
  assert.equal(isCategoryRegistrationOpen('current', currentOnly), true);

  // 3. Both Categories Open
  const bothOpen: FeeSettings = {
    ...baseSettings,
    alumniRegistrationOpen: true,
    currentStudentRegistrationOpen: true,
  };
  assert.equal(isAlumniRegistrationOpen(bothOpen), true);
  assert.equal(isCurrentStudentRegistrationOpen(bothOpen), true);

  // 4. Both Categories Closed
  const bothClosed: FeeSettings = {
    ...baseSettings,
    alumniRegistrationOpen: false,
    currentStudentRegistrationOpen: false,
  };
  assert.equal(isAlumniRegistrationOpen(bothClosed), false);
  assert.equal(isCurrentStudentRegistrationOpen(bothClosed), false);
});

test('Registration & Donation Governance: 3. Independent Donation Switch Behavior', () => {
  // Case A: Donation is OFF while Registration is ON
  const donationOffRegOn: FeeSettings = {
    formerStudentFee: 1500,
    currentStudentFee: 500,
    registrationOpen: true,
    alumniRegistrationOpen: true,
    currentStudentRegistrationOpen: true,
    donationOpen: false, // Donation is OFF
    startDate: '2026-01-01',
    endDate: '2027-01-20',
    lateFeeEnabled: false,
    lateFeeAmount: 0,
  };
  assert.equal(isGlobalRegistrationOpen(donationOffRegOn), true);
  assert.equal(isDonationOpen(donationOffRegOn), false);
  const donationMsg = getDonationClosedMessage(donationOffRegOn, 'en');
  assert.ok(donationMsg.includes('paused') || donationMsg.includes('closed') || donationMsg.includes('Reunion'));

  // Case B: Donation is ON while Registration is OFF (Completely Independent)
  const donationOnRegOff: FeeSettings = {
    ...donationOffRegOn,
    registrationOpen: false,
    donationOpen: true, // Donation is ON
  };
  assert.equal(isGlobalRegistrationOpen(donationOnRegOff), false);
  assert.equal(isDonationOpen(donationOnRegOff), true);
});

test('Registration & Donation Governance: 4. Backend Security & Payment Initiation Blocking', async () => {
  // Configure AppStore with Global Registration OFF
  AppStore.saveFeeSettings({
    formerStudentFee: 1500,
    currentStudentFee: 500,
    registrationOpen: false,
    alumniRegistrationOpen: false,
    currentStudentRegistrationOpen: false,
    donationOpen: true,
    startDate: '2026-01-01',
    endDate: '2027-01-20',
    lateFeeEnabled: false,
    lateFeeAmount: 0,
  });

  // Attempting to initiate registration payment when Global Registration is OFF
  const regPaymentRes = await PayStationService.createPayment({
    invoice_number: `INV-TEST-${Date.now()}`,
    payment_amount: 1500,
    cust_name: 'Test Student',
    cust_phone: '01711111111',
    callback_url: 'https://example.com/callback',
    opt_a: 'REGISTRATION',
    opt_b: 'former',
  });

  assert.equal(regPaymentRes.success, false);
  assert.ok(regPaymentRes.error?.includes('closed') || regPaymentRes.error?.includes('disabled'));

  // Attempting to create pending registration when closed throws error
  await assert.rejects(
    async () => {
      await PayStationService.createPendingRegistration(
        {
          fullName: 'Test Student',
          mobileNumber: '01711111111',
          address: 'Faridpur',
          category: 'former',
          batchName: 'Batch 2015',
          photoUrl: '',
          donationAmount: 0,
          tShirtSize: 'L',
          termsAccepted: true,
        },
        { registrationFee: 1500, donationAmount: 0, totalPayable: 1500 },
        'INV-PENDING-TEST'
      );
    },
    /closed|disabled/i
  );

  // Now turn Global Registration ON, but Alumni OFF, Current ON
  AppStore.saveFeeSettings({
    formerStudentFee: 1500,
    currentStudentFee: 500,
    registrationOpen: true,
    alumniRegistrationOpen: false, // Alumni OFF
    currentStudentRegistrationOpen: true, // Current ON
    donationOpen: false, // Donation OFF
    startDate: '2026-01-01',
    endDate: '2027-01-20',
    lateFeeEnabled: false,
    lateFeeAmount: 0,
  });

  // Former student registration attempt rejected
  const alumniBlockedRes = await PayStationService.createPayment({
    invoice_number: `INV-TEST-${Date.now()}`,
    payment_amount: 1500,
    cust_name: 'Former Student',
    cust_phone: '01711111111',
    callback_url: 'https://example.com/callback',
    opt_a: 'REGISTRATION',
    opt_b: 'former',
  });
  assert.equal(alumniBlockedRes.success, false);
  assert.ok(alumniBlockedRes.error?.includes('Alumni') && alumniBlockedRes.error?.includes('closed'));

  // Donation payment attempt rejected when donationOpen is false
  const donationBlockedRes = await PayStationService.createPayment({
    invoice_number: `INV-TEST-DON-${Date.now()}`,
    payment_amount: 1000,
    cust_name: 'Kind Donor',
    cust_phone: '01722222222',
    callback_url: 'https://example.com/callback',
    opt_a: 'DONATION',
  });
  assert.equal(donationBlockedRes.success, false);
  assert.ok(donationBlockedRes.error?.includes('donations') && donationBlockedRes.error?.includes('disabled'));

  // Reset AppStore back to default open state
  AppStore.saveFeeSettings({
    formerStudentFee: 1500,
    currentStudentFee: 500,
    registrationOpen: true,
    alumniRegistrationOpen: true,
    currentStudentRegistrationOpen: true,
    donationOpen: true,
    startDate: '2026-01-01',
    endDate: '2027-01-20',
    lateFeeEnabled: false,
    lateFeeAmount: 0,
  });
});

test('Registration & Donation Governance: 5. AppStore Default Fallback Safety for Legacy Records', () => {
  localStorage.clear();
  // Simulate legacy stored settings with missing new boolean keys
  localStorage.setItem(
    'plscf_reunion_settings_v1',
    JSON.stringify({
      formerStudentFee: 1500,
      currentStudentFee: 500,
      registrationOpen: true,
      // alumniRegistrationOpen, currentStudentRegistrationOpen, donationOpen missing
    })
  );

  const restored = AppStore.getFeeSettings();
  assert.equal(restored.registrationOpen, true);
  assert.equal(restored.alumniRegistrationOpen, true);
  assert.equal(restored.currentStudentRegistrationOpen, true);
  assert.equal(restored.donationOpen, true);
});
