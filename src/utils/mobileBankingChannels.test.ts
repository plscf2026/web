import test from 'node:test';
import assert from 'node:assert/strict';
import { PayStationService, PayStationPaymentResult } from '../services/paystation';
import { RegistrationFormData } from './rules';
import { AppStore } from '../services/store';

const testAttendee: RegistrationFormData = {
  fullName: 'Tamim Iqbal',
  photoUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  category: 'former',
  passingYear: '2015',
  batchName: 'SSC 2015',
  mobileNumber: '01811223344',
  email: 'tamim@example.com',
  address: 'Faridpur Sadar',
  tShirtSize: 'L',
  donationAmount: 200,
  termsAccepted: true,
};

test('Mobile Banking Channels End-to-End Suite', async (t) => {
  await t.test('1. Nagad payment creates paid registration with payment_method = "nagad"', async () => {
    const invoice = `TEST-NGD-${Date.now()}`;
    const payment: PayStationPaymentResult = {
      invoiceNumber: invoice,
      trxId: `NGD-TRX-${Date.now().toString(36).toUpperCase()}`,
      status: 'Success',
      amount: 1700,
      method: 'nagad',
      payerMobile: '01811223344',
      timestamp: new Date().toISOString(),
    };

    const ticket = await PayStationService.completeRegistrationAfterPayment(testAttendee, payment);
    assert.ok(ticket);
    assert.equal(ticket.paymentMethod, 'nagad');
    assert.equal(ticket.paymentStatus, 'paid');
    assert.equal(ticket.totalPaid, 1700);
    assert.ok(ticket.qrToken.length >= 6);
    assert.ok(ticket.serverVerificationSignature);

    const stored = AppStore.getRegistrations().find((r) => r.id === ticket.id);
    assert.ok(stored);
    assert.equal(stored.paymentMethod, 'nagad');
  });

  await t.test('2. Rocket payment creates paid registration with payment_method = "rocket"', async () => {
    const invoice = `TEST-RKT-${Date.now()}`;
    const payment: PayStationPaymentResult = {
      invoiceNumber: invoice,
      trxId: `RKT-TRX-${Date.now().toString(36).toUpperCase()}`,
      status: 'Success',
      amount: 1500,
      method: 'rocket',
      payerMobile: '017112233441',
      timestamp: new Date().toISOString(),
    };

    const ticket = await PayStationService.completeRegistrationAfterPayment(testAttendee, payment);
    assert.ok(ticket);
    assert.equal(ticket.paymentMethod, 'rocket');
    assert.equal(ticket.paymentStatus, 'paid');
    assert.equal(ticket.totalPaid, 1500);

    const stored = AppStore.getRegistrations().find((r) => r.id === ticket.id);
    assert.ok(stored);
    assert.equal(stored.paymentMethod, 'rocket');
  });

  await t.test('3. Card payment creates paid registration with payment_method = "card"', async () => {
    const invoice = `TEST-CRD-${Date.now()}`;
    const payment: PayStationPaymentResult = {
      invoiceNumber: invoice,
      trxId: `CRD-TRX-${Date.now().toString(36).toUpperCase()}`,
      status: 'Success',
      amount: 2500,
      method: 'card',
      payerMobile: '01811223344',
      timestamp: new Date().toISOString(),
    };

    const ticket = await PayStationService.completeRegistrationAfterPayment(testAttendee, payment);
    assert.ok(ticket);
    assert.equal(ticket.paymentMethod, 'card');
    assert.equal(ticket.paymentStatus, 'paid');

    const stored = AppStore.getRegistrations().find((r) => r.id === ticket.id);
    assert.ok(stored);
    assert.equal(stored.paymentMethod, 'card');
  });

  await t.test('4. bKash payment creates paid registration with payment_method = "bkash"', async () => {
    const invoice = `TEST-BKS-${Date.now()}`;
    const payment: PayStationPaymentResult = {
      invoiceNumber: invoice,
      trxId: `BKS-TRX-${Date.now().toString(36).toUpperCase()}`,
      status: 'Success',
      amount: 1500,
      method: 'bkash',
      payerMobile: '01929918378',
      timestamp: new Date().toISOString(),
    };

    const ticket = await PayStationService.completeRegistrationAfterPayment(testAttendee, payment);
    assert.ok(ticket);
    assert.equal(ticket.paymentMethod, 'bkash');
    assert.equal(ticket.paymentStatus, 'paid');

    const stored = AppStore.getRegistrations().find((r) => r.id === ticket.id);
    assert.ok(stored);
    assert.equal(stored.paymentMethod, 'bkash');
  });
});
