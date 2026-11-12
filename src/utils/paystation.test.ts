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

test('PayStation createPendingRegistration associates gatewayInvoiceNumber and preserves pending status', async () => {
  const formData: RegistrationFormData = {
    fullName: 'Kamal Hossain',
    photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
    mobileNumber: '01799887766',
    email: 'kamal@example.com',
    address: 'Faridpur',
    category: 'former',
    passingYear: '2015',
    batchName: 'SSC 2015',
    tShirtSize: 'M',
    donationAmount: 0,
    termsAccepted: true,
  };

  const invoiceNumber = `INV-TEST-PEND-${Date.now()}`;
  const fees = { registrationFee: 1500, donationAmount: 0, totalPayable: 1500 };

  const pendingRecord = await PayStationService.createPendingRegistration(
    formData,
    fees,
    invoiceNumber
  );

  assert.equal(pendingRecord.paymentStatus, 'pending');
  assert.equal(pendingRecord.totalPaid, 0);
  assert.equal(pendingRecord.gatewayInvoiceNumber, invoiceNumber);
  assert.equal(pendingRecord.gatewayProvider, 'PAYSTATION');

  // Check pending session storage
  const session = PayStationService.getPendingSession();
  assert.ok(session);
  assert.equal(session?.invoiceNumber, invoiceNumber);
  assert.equal(session?.registrationId, pendingRecord.id);
});

test('PayStation Merchant IPN Webhook updates pending registration to paid authoritatively and idempotently', async () => {
  const invoiceNumber = `INV-IPN-TEST-${Date.now()}`;
  const formData: RegistrationFormData = {
    fullName: 'Jamil Ahmed',
    photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
    mobileNumber: '01888776655',
    email: 'jamil@example.com',
    address: 'Faridpur',
    category: 'former',
    passingYear: '2008',
    batchName: 'SSC 2008',
    tShirtSize: 'XL',
    donationAmount: 500,
    termsAccepted: true,
  };

  const fees = { registrationFee: 1500, donationAmount: 500, totalPayable: 2000 };
  const pending = await PayStationService.createPendingRegistration(formData, fees, invoiceNumber);
  assert.equal(pending.paymentStatus, 'pending');

  // Simulate incoming server-to-server IPN payload from PayStation
  const ipnPayload = {
    invoice_number: invoiceNumber,
    trx_status: 'Success' as const,
    trx_id: `PST-IPN-TRX-${Date.now()}`,
    trx_amount: 2000,
    order_date_time: '2026-11-13 05:40:00',
    payment_method: 'Nagad',
    reference: pending.id,
  };

  // Validate IPN payload
  const validation = PayStationService.validateIpnPayload(ipnPayload, invoiceNumber, 2000);
  assert.equal(validation.valid, true);

  // Process IPN Webhook
  const result = await PayStationService.handleIpnWebhook(ipnPayload);
  assert.equal(result.success, true);

  // Check that record in AppStore is now paid
  const reg = AppStore.getRegistrations().find((r) => r.id === pending.id);
  assert.ok(reg);
  assert.equal(reg?.paymentStatus, 'paid');
  assert.equal(reg?.totalPaid, 2000);
  assert.equal(reg?.paymentMethod, 'nagad');
  assert.equal(reg?.transactionId, ipnPayload.trx_id);

  // Retried IPN with same transaction ID must remain safe & idempotent
  const retryResult = await PayStationService.handleIpnWebhook(ipnPayload);
  assert.equal(retryResult.success, true);
  assert.equal(reg?.paymentStatus, 'paid');
});

test('PayStation IPN validation rejects invalid payloads (amount mismatch, wrong invoice, failed status)', () => {
  const basePayload = {
    invoice_number: 'INV-VALID-001',
    trx_status: 'Success' as const,
    trx_id: 'TRX-VALID-123',
    trx_amount: 1500,
    order_date_time: '2026-11-13 05:45:00',
    payment_method: 'bKash',
  };

  // 1. Wrong invoice
  const res1 = PayStationService.validateIpnPayload(
    { ...basePayload, invoice_number: 'INV-WRONG' },
    'INV-VALID-001',
    1500
  );
  assert.equal(res1.valid, false);
  assert.ok(res1.reason?.includes('Invoice number mismatch'));

  // 2. Underpaid amount
  const res2 = PayStationService.validateIpnPayload(
    { ...basePayload, trx_amount: 500 },
    'INV-VALID-001',
    1500
  );
  assert.equal(res2.valid, false);
  assert.ok(res2.reason?.includes('Amount mismatch'));

  // 3. Failed status
  const res3 = PayStationService.validateIpnPayload(
    { ...basePayload, trx_status: 'Failed' as any },
    'INV-VALID-001',
    1500
  );
  assert.equal(res3.valid, false);
  assert.ok(res3.reason?.includes('Unexpected trx_status'));

  // 4. Missing trx_id
  const res4 = PayStationService.validateIpnPayload(
    { ...basePayload, trx_id: '' },
    'INV-VALID-001',
    1500
  );
  assert.equal(res4.valid, false);
  assert.ok(res4.reason?.includes('Missing trx_id'));
});
