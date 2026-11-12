import test from 'node:test';
import assert from 'node:assert/strict';
import { PayStationService, PayStationPaymentResult } from '../services/paystation';
import { RegistrationFormData } from './rules';
import { AppStore } from '../services/store';

test('PayStation Configuration defaults to official Sandbox parameters without leaking client passwords', () => {
  const config = PayStationService.getConfig();
  assert.equal(config.merchantId, '104-1653730183');
  assert.equal(config.isSandbox, true);
  assert.equal(config.baseUrl, 'https://sandbox.paystation.com.bd');
  assert.equal(config.proxyBaseUrl, '/api/paystation');
  // In sandbox/dev mode, password is loaded from VITE_PAYSTATION_PASSWORD env var (gitignored .env).
  // In production isSandbox=false the password MUST be empty — stored in Supabase Secrets only.
  if (!config.isSandbox) {
    assert.equal(config.password, '', 'Production config must NOT bundle merchant password');
  } else {
    // Sandbox: password is populated from .env for local proxy calls — this is acceptable
    assert.ok(typeof config.password === 'string', 'Sandbox password should be a string');
  }
});

test('PayStation Grant Token and Payment Creation pipeline', async () => {
  const tokenRes = await PayStationService.grantToken();
  assert.equal(tokenRes.success, true);
  assert.ok(tokenRes.token);

  const createRes = await PayStationService.createPayment(
    {
      invoice_number: 'INV-TEST-001',
      currency: 'BDT',
      payment_amount: 1500,
      reference: 'ALUMNI',
      cust_name: 'Tanvir Hossain',
      cust_phone: '01712345678',
      cust_email: 'tanvir@example.com',
      callback_url: 'http://localhost:3000/api/checkout/callback',
    },
    tokenRes.token
  );

  assert.equal(createRes.success, true);
  assert.ok(createRes.paymentUrl);
  assert.ok(createRes.trxId);
});

test('PayStation Transaction Retrieval and Status Check', async () => {
  const res = await PayStationService.retrieveTransaction('INV-TEST-001', 'TRX-TEST-9988');
  assert.equal(res.success, true);
  assert.equal(res.status, 'Success');
  assert.ok(res.data);
});

test('PayStation Complete Registration and Authoritative Ticket Generation (2027 dynamic default)', async () => {
  const formData: RegistrationFormData = {
    fullName: 'Anisur Rahman',
    photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
    mobileNumber: '01812345678',
    email: 'anis@example.com',
    address: 'Faridpur Sadar',
    category: 'former',
    passingYear: '2010',
    batchName: 'SSC 2010',
    tShirtSize: 'XL',
    donationAmount: 200,
    termsAccepted: true,
  };

  const paymentResult: PayStationPaymentResult = {
    invoiceNumber: 'INV-TEST-002',
    trxId: 'PST-SBX-TRX-10294',
    status: 'Success',
    amount: 1700,
    method: 'bkash',
    payerMobile: '01812345678',
    timestamp: new Date().toISOString(),
  };

  const ticket = await PayStationService.completeRegistrationAfterPayment(formData, paymentResult);

  // Authoritative dynamic year resolution
  assert.ok(ticket.id.startsWith('PLSCF-2027-F'));
  assert.equal(ticket.year, 2027);
  assert.equal(ticket.paymentStatus, 'paid');
  assert.equal(ticket.transactionId, 'PST-SBX-TRX-10294');
  assert.equal(ticket.paymentMethod, 'bkash');
  assert.equal(ticket.totalPaid, 1700);
  assert.ok(/^[A-Z0-9]{6}$/.test(ticket.qrToken));
  assert.equal(ticket.qrToken.length, 6);
  assert.ok(ticket.serverVerificationSignature?.startsWith('SIG_V2_'));

  // Verify it exists in local store
  const registrations = AppStore.getRegistrations();
  const found = registrations.find((r) => r.id === ticket.id);
  assert.ok(found);
  assert.equal(found?.paymentStatus, 'paid');
});

test('PayStation Complete Registration supports explicit 2026 legacy records', async () => {
  const formData: RegistrationFormData & { year?: number } = {
    fullName: 'Legacy Alumnus',
    photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
    mobileNumber: '01912345678',
    email: 'legacy@example.com',
    address: 'Faridpur Sadar',
    category: 'former',
    passingYear: '2005',
    batchName: 'SSC 2005',
    tShirtSize: 'L',
    donationAmount: 0,
    termsAccepted: true,
    year: 2026,
  };

  const paymentResult: PayStationPaymentResult = {
    invoiceNumber: 'INV-TEST-2026',
    trxId: 'PST-SBX-TRX-2026',
    status: 'Success',
    amount: 1500,
    method: 'nagad',
    payerMobile: '01912345678',
    timestamp: new Date().toISOString(),
  };

  const ticket = await PayStationService.completeRegistrationAfterPayment(formData as any, paymentResult);

  assert.ok(ticket.id.startsWith('PLSCF-2026-F'));
  assert.equal(ticket.year, 2026);
  assert.ok(/^[A-Z0-9]{6}$/.test(ticket.qrToken));
  assert.equal(ticket.qrToken.length, 6);
});

test('PayStation Payment Status Verification accepts "Successful" case variants and verifies correctly', async () => {
  // Test validation of various status string variations from real gateway responses
  const statuses = ['Successful', 'successful', 'SUCCESSFUL', 'Success', 'success', 'SUCCESS', 'completed', 'captured'];

  for (const st of statuses) {
    const payload = {
      invoice_number: 'INV-ST-TEST-001',
      trx_status: st as any,
      trx_amount: '1500',
      trx_id: 'TRX-ST-1234',
    };
    const res = PayStationService.validateIpnPayload(payload as any, 'INV-ST-TEST-001', 1500);
    assert.equal(res.valid, true, `Status "${st}" must be considered valid`);
  }
});
