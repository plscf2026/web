import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import legacyRegistrationsHandler from '../../api/registrations_2027';
import legacyInitiateHandler from '../../api/paystation/initiate-payment';
import legacyIpnHandler from '../../api/paystation/ipn';
import legacyStatusHandler from '../../api/paystation/transaction-status';
import { validateAndBuildPendingRegistrationData } from '../../supabase/functions/verify-payment/registrationPayload.ts';
import { executeInitiatePayment } from '../../supabase/functions/verify-payment/initiationHandler.ts';
import { SupabaseService, supabase } from '../services/supabase';

function createMockRes() {
  const headers: Record<string, string> = {};
  let statusCode = 200;
  let body: any = null;
  const res = {
    setHeader(k: string, v: string) {
      headers[k.toLowerCase()] = v;
    },
    status(code: number) {
      statusCode = code;
      return res;
    },
    json(payload: any) {
      body = payload;
      return res;
    },
    send(payload: any) {
      body = payload;
      return res;
    },
    end() {
      return res;
    },
    get _status() {
      return statusCode;
    },
    get _body() {
      return body;
    },
    get _headers() {
      return headers;
    },
  };
  return res;
}

test('P0 Legacy Vercel API: all /api/* handlers fail closed with 410 LEGACY_ENDPOINT_DISABLED and return zero PII', async () => {
  const resReg = createMockRes();
  await legacyRegistrationsHandler({ method: 'GET', query: { limit: 100 } }, resReg);
  assert.equal(resReg._status, 410);
  assert.equal(resReg._body?.error, 'LEGACY_ENDPOINT_DISABLED');
  assert.equal(resReg._body?.data, undefined);
  assert.equal(resReg._headers['access-control-allow-origin'], undefined);

  const resInit = createMockRes();
  await legacyInitiateHandler({ method: 'POST', body: { payment_amount: 1, invoice_number: 'INV-1', cust_phone: '01700000000' } }, resInit);
  assert.equal(resInit._status, 410);
  assert.equal(resInit._body?.error, 'LEGACY_ENDPOINT_DISABLED');

  const resIpn = createMockRes();
  await legacyIpnHandler({ method: 'POST', body: { invoice_number: 'INV-1', trx_id: 'TRX-1', trx_status: 'Success', trx_amount: 1 } }, resIpn);
  assert.equal(resIpn._status, 410);
  assert.equal(resIpn._body?.error, 'LEGACY_ENDPOINT_DISABLED');

  const resStatus = createMockRes();
  await legacyStatusHandler({ method: 'POST', body: { invoice_number: 'INV-1' } }, resStatus);
  assert.equal(resStatus._status, 410);
  assert.equal(resStatus._body?.error, 'LEGACY_ENDPOINT_DISABLED');
});

test('P0 Credential Hygiene: safe secret scan detects zero live secrets in source, api/, Edge Functions, and docs', () => {
  const root = process.cwd();
  const bannedPatterns: { label: string; regex: RegExp }[] = [
    { label: 'legacy gateway password', regex: /gamecoderstorepass/i },
    { label: 'legacy hmac salt', regex: /PLSCF_SECURE_PAYMENT_HMAC_SALT/i },
    { label: 'supabase secret key', regex: /sb_secret_[A-Za-z0-9_-]{8,}/ },
    { label: 'exposed postgres url password', regex: /postgresql:\/\/postgres\.[^:]+:(?!\[YOUR-PASSWORD\]|<REDACTED)[A-Za-z0-9@%._-]{6,}@/i },
    { label: 'legacy leaked db pass', regex: /Puja(@|%40)337139/i },
  ];

  const filesToScan: string[] = [];
  const walk = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (/\.(ts|tsx|js|jsx|md|json)$/i.test(entry.name) && !entry.name.endsWith('p0_3_post18dde48Remediation.test.ts')) {
        filesToScan.push(full);
      }
    }
  };

  walk(path.join(root, 'src'));
  walk(path.join(root, 'api'));
  walk(path.join(root, 'supabase', 'functions'));
  walk(path.join(root, 'PROJECT_COMPLETE_AUDIT'));
  for (const md of ['API.md', 'PAYSTATION_INTEGRATION.md', 'REMAINING_MANUAL_ACTIONS.md', 'TECHNICAL_REMEDIATION_PLAN.md', '.env.example']) {
    const p = path.join(root, md);
    if (fs.existsSync(p)) filesToScan.push(p);
  }

  for (const file of filesToScan) {
    const content = fs.readFileSync(file, 'utf8');
    // Skip regex definition line inside test files
    if (file.includes('.test.ts')) continue;
    for (const pat of bannedPatterns) {
      assert.equal(
        pat.regex.test(content),
        false,
        `Detected forbidden ${pat.label} pattern in ${path.relative(root, file)} (value omitted for safety)`
      );
    }
  }
});

test('P1 Registration Payload Validation: rejects missing required fields and preserves complete data without placeholders', () => {
  const incomplete = validateAndBuildPendingRegistrationData(
    {
      cust_name: 'Student Name',
      cust_phone: '01712345678',
      category: 'former',
    },
    'former',
    false
  );
  assert.equal(incomplete.valid, false);
  assert.equal(incomplete.error, 'INVALID_REGISTRATION_DATA');

  const placeholderPhoto = validateAndBuildPendingRegistrationData(
    {
      form_data: {
        fullName: 'Student Name',
        mobileNumber: '01712345678',
        address: 'Faridpur Sadar',
        batchName: 'SSC 2015',
        tShirtSize: 'L',
        photoUrl: 'https://via.placeholder.com/150',
      },
    },
    'former',
    false
  );
  assert.equal(placeholderPhoto.valid, false);

  const missingStudentIdForCurrent = validateAndBuildPendingRegistrationData(
    {
      form_data: {
        fullName: 'Current Student',
        mobileNumber: '01712345678',
        address: 'Faridpur',
        batchName: 'Class 10',
        tShirtSize: 'M',
        photoUrl: 'https://hnthoszbkhvygoowtvau.supabase.co/storage/v1/object/public/student-photos/2027/profile.webp',
      },
    },
    'current',
    false
  );
  assert.equal(missingStudentIdForCurrent.valid, false);

  const validFull = validateAndBuildPendingRegistrationData(
    {
      form_data: {
        registrationId: 'PLSCF-2027-F4321',
        qrToken: 'AB12CD',
        fullName: 'Alumnus Verified',
        mobileNumber: '+8801712345678',
        email: 'alumnus@example.com',
        address: 'Goalchamot, Faridpur',
        batchName: 'Batch 2014',
        passingYear: '2014',
        tShirtSize: 'XL',
        photoUrl: 'https://hnthoszbkhvygoowtvau.supabase.co/storage/v1/object/public/student-photos/2014/PLSCF-2027-F4321/profile.webp',
        photoStoragePath: '2014/PLSCF-2027-F4321/profile.webp',
        hasParent: true,
        parentName: 'Parent Name',
        parentPhone: '01812345678',
        parentRelation: 'Father',
      },
    },
    'former',
    true
  );
  assert.equal(validFull.valid, true);
  assert.equal(validFull.data?.registrationId, 'PLSCF-2027-F4321');
  assert.equal(validFull.data?.qrToken, 'AB12CD');
  assert.equal(validFull.data?.mobileNumber, '01712345678');
  assert.equal(validFull.data?.batchName, 'Batch 2014');
  assert.equal(validFull.data?.tShirtSize, 'XL');
  assert.equal(validFull.data?.parentName, 'Parent Name');
});

test('P1 Donation Lookup Privacy: lookupDonation consumes minimal response without exposing PII or falling back on denial', async () => {
  const originalRpc = supabase.rpc;
  let capturedRpcName = '';

  (supabase as any).rpc = async (fn: string, params: any) => {
    capturedRpcName = fn;
    if (params.p_identifier === 'DON-2027-DENIED') {
      return { data: null, error: { code: '42501', message: 'permission denied' } };
    }
    return {
      data: {
        success: true,
        donation: {
          id: 'DON-2027-9001',
          donor_name: 'Generous Patron',
          amount: 2000,
          purpose: 'General Reunion Fund',
          payment_status: 'paid',
          year: 2027,
          donation_date: '2027-02-01',
          token: 'DON6QR',
        },
      },
      error: null,
    };
  };

  try {
    const okRes = await SupabaseService.lookupDonation('DON-2027-9001', '01711111111');
    assert.equal(capturedRpcName, 'rpc_lookup_donation');
    assert.ok(okRes.donation);
    assert.equal(okRes.donation?.donorName, 'Generous Patron');
    assert.equal(okRes.donation?.mobileNumber, '');
    assert.equal(okRes.donation?.email, '');

    const deniedRes = await SupabaseService.lookupDonation('DON-2027-DENIED', '');
    assert.equal(deniedRes.donation, undefined);
    assert.ok(deniedRes.error);
  } finally {
    (supabase as any).rpc = originalRpc;
  }
});

test('P1/P2 Edge Function hardening checks: IPN server-to-server check, CORS strictness, zero photoUrl in verify-student-id', () => {
  const root = process.cwd();
  const verifyPaymentSrc = fs.readFileSync(path.join(root, 'supabase/functions/verify-payment/index.ts'), 'utf8');
  const initiationHandlerSrc = fs.readFileSync(path.join(root, 'supabase/functions/verify-payment/initiationHandler.ts'), 'utf8');
  const ticketLookupSrc = fs.readFileSync(path.join(root, 'supabase/functions/secure-ticket-lookup/index.ts'), 'utf8');
  const studentIdSrc = fs.readFileSync(path.join(root, 'supabase/functions/verify-student-id/index.ts'), 'utf8');

  assert.ok(verifyPaymentSrc.includes('verifyGatewayTransactionStatus'), 'verify-payment must share server-to-server gateway verification helper');
  assert.ok(verifyPaymentSrc.includes('executeInitiatePayment'), 'verify-payment must delegate initiation to executeInitiatePayment');
  assert.ok(initiationHandlerSrc.includes('validateAndBuildPendingRegistrationData'), 'initiate-payment must enforce strict registration payload validation');
  assert.ok(verifyPaymentSrc.includes("['success', 'successful'].includes"), 'verify-payment must require exact PayStation success status');
  assert.ok(!ticketLookupSrc.includes('allowedOrigins.length === 0 ||'), 'secure-ticket-lookup must not reflect arbitrary Origin when allowlist is empty');
  assert.ok(!studentIdSrc.includes('allowedOrigins.length === 0 ||'), 'verify-student-id must not reflect arbitrary Origin when allowlist is empty');
  assert.ok(!studentIdSrc.includes('photoUrl: safePhotoUrl'), 'verify-student-id must omit photoUrl from public response');
});

const BASE_TEST_FEE_SETTINGS = {
  currentStudentFee: 500,
  formerStudentFee: 1500,
  parentFee: 500,
  minDonation: 100,
  maxDonation: 50000,
  maxTotalPayable: 100000,
  gatewayChargeRates: { bkash: 0.0185, nagad: 0.015 },
  registrationOpen: true,
  alumniRegistrationOpen: true,
  currentStudentRegistrationOpen: true,
  donationOpen: true,
  paymentEnabled: true,
};

const VALID_REG_ORDER = {
  invoice_number: 'INV-GATE-2027-01',
  order_type: 'registration',
  category: 'former',
  has_parent: false,
  donation_amount: 0,
  payment_method: 'bkash',
  pay_with_charge: 0,
  currency: 'BDT',
  return_origin: 'https://staging.plscf.org',
  form_data: {
    registrationId: 'PLSCF-2027-F7777',
    qrToken: 'QR7777',
    fullName: 'Gate Verified Student',
    mobileNumber: '01712345678',
    address: 'Faridpur Sadar',
    batchName: 'SSC 2015',
    tShirtSize: 'L',
    photoUrl: 'https://hnthoszbkhvygoowtvau.supabase.co/storage/v1/object/public/student-photos/2015/PLSCF-2027-F7777/profile.webp',
  },
};

const VALID_DONATION_ORDER = {
  invoice_number: 'INV-DON-2027-01',
  order_type: 'donation',
  donation_amount: 500,
  payment_method: 'bkash',
  pay_with_charge: 0,
  currency: 'BDT',
  cust_name: 'Patron Test',
  cust_phone: '01712345678',
  return_origin: 'https://staging.plscf.org',
};

const BASE_GATE_CONFIG = {
  paystationEnv: 'sandbox',
  paystationBaseUrl: 'https://sandbox.paystation.com.bd',
  merchantId: 'test-merchant',
  password: 'test-password',
  allowedOriginsRaw: 'https://staging.plscf.org',
  allowPaymentFinalization: false,
};

test('P0-3 Initiation Gate: rejects when paymentEnabled is false or non-true, creating zero pending orders or gateway calls', async () => {
  for (const disabledVal of [false, undefined, null, 'true', 0]) {
    let upserts = 0;
    let fetches = 0;
    const res = await executeInitiatePayment(VALID_REG_ORDER, {
      loadSettings: async () => ({ value: { ...BASE_TEST_FEE_SETTINGS, paymentEnabled: disabledVal } }),
      upsertPendingOrder: async () => {
        upserts++;
        return {};
      },
      fetchGateway: async () => {
        fetches++;
        return { status: 200, text: '{}' };
      },
      config: BASE_GATE_CONFIG,
    });

    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error, 'PAYMENT_DISABLED');
    assert.equal(upserts, 0, 'Must never write pending_orders when paymentEnabled is false/invalid');
    assert.equal(fetches, 0, 'Must never call PayStation gateway when paymentEnabled is false/invalid');
  }
});

test('P0-3 Initiation Gate: fails closed when portal_fee_settings is missing, unreadable, or throws', async () => {
  for (const loader of [
    async () => ({ value: null }),
    async () => ({ value: null, error: 'DB read timeout' }),
    async () => { throw new Error('Connection refused'); },
  ]) {
    let upserts = 0;
    let fetches = 0;
    const res = await executeInitiatePayment(VALID_REG_ORDER, {
      loadSettings: loader,
      upsertPendingOrder: async () => {
        upserts++;
        return {};
      },
      fetchGateway: async () => {
        fetches++;
        return { status: 200, text: '{}' };
      },
      config: BASE_GATE_CONFIG,
    });

    assert.equal(res.status, 503);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error, 'FEE_SETTINGS_MISSING');
    assert.equal(upserts, 0);
    assert.equal(fetches, 0);
  }
});

test('P0-3 Initiation Gate: enforces registrationOpen, category open flags, donationOpen & valid data without gateway or DB writes', async () => {
  const cases: { name: string; settings: Record<string, unknown>; order: Record<string, unknown>; expectedStatus: number; expectedError: string }[] = [
    {
      name: 'registrationOpen=false',
      settings: { ...BASE_TEST_FEE_SETTINGS, registrationOpen: false },
      order: VALID_REG_ORDER,
      expectedStatus: 403,
      expectedError: 'REGISTRATION_CLOSED',
    },
    {
      name: 'alumniRegistrationOpen=false',
      settings: { ...BASE_TEST_FEE_SETTINGS, alumniRegistrationOpen: false },
      order: VALID_REG_ORDER,
      expectedStatus: 403,
      expectedError: 'ALUMNI_REGISTRATION_CLOSED',
    },
    {
      name: 'currentStudentRegistrationOpen=false',
      settings: { ...BASE_TEST_FEE_SETTINGS, currentStudentRegistrationOpen: false },
      order: {
        ...VALID_REG_ORDER,
        category: 'current',
        form_data: { ...VALID_REG_ORDER.form_data, category: 'current', studentId: 'PLSC-2026-101' },
      },
      expectedStatus: 403,
      expectedError: 'CURRENT_STUDENT_REGISTRATION_CLOSED',
    },
    {
      name: 'donationOpen=false',
      settings: { ...BASE_TEST_FEE_SETTINGS, donationOpen: false },
      order: VALID_DONATION_ORDER,
      expectedStatus: 403,
      expectedError: 'DONATION_CLOSED',
    },
    {
      name: 'invalid registration data (missing address)',
      settings: BASE_TEST_FEE_SETTINGS,
      order: {
        ...VALID_REG_ORDER,
        form_data: { ...VALID_REG_ORDER.form_data, address: '' },
      },
      expectedStatus: 400,
      expectedError: 'INVALID_REGISTRATION_DATA',
    },
  ];

  for (const tc of cases) {
    let upserts = 0;
    let fetches = 0;
    const res = await executeInitiatePayment(tc.order, {
      loadSettings: async () => ({ value: tc.settings }),
      upsertPendingOrder: async () => {
        upserts++;
        return {};
      },
      fetchGateway: async () => {
        fetches++;
        return { status: 200, text: '{}' };
      },
      config: BASE_GATE_CONFIG,
    });

    assert.equal(res.status, tc.expectedStatus, `${tc.name} status mismatch`);
    assert.equal(res.body.success, false, `${tc.name} must fail`);
    assert.equal(res.body.error, tc.expectedError, `${tc.name} error mismatch`);
    assert.equal(upserts, 0, `${tc.name} must not create pending_orders`);
    assert.equal(fetches, 0, `${tc.name} must not invoke gateway`);
  }
});

test('P0-3 Initiation Gate: succeeds for valid registration & donation when authorized while finalization stays disabled', async () => {
  const persistedOrders: Record<string, unknown>[] = [];
  const gatewayUrls: string[] = [];

  const regRes = await executeInitiatePayment(VALID_REG_ORDER, {
    loadSettings: async () => ({ value: BASE_TEST_FEE_SETTINGS }),
    upsertPendingOrder: async (row) => {
      persistedOrders.push(row);
      return {};
    },
    fetchGateway: async (url) => {
      gatewayUrls.push(url);
      return {
        status: 200,
        text: JSON.stringify({
          status_code: '200',
          status: 'success',
          payment_url: 'https://sandbox.paystation.com.bd/checkout/test-session',
          invoice_number: VALID_REG_ORDER.invoice_number,
        }),
      };
    },
    config: BASE_GATE_CONFIG,
  });

  assert.equal(regRes.status, 200);
  assert.equal(regRes.body.success, true);
  assert.equal(regRes.body.registrationId, 'PLSCF-2027-F7777');
  assert.equal(regRes.body.payment_amount, '1500');
  assert.equal(persistedOrders.length, 1);
  assert.equal(persistedOrders[0].order_type, 'registration');
  assert.equal(gatewayUrls.length, 1);

  const donRes = await executeInitiatePayment(VALID_DONATION_ORDER, {
    loadSettings: async () => ({ value: BASE_TEST_FEE_SETTINGS }),
    upsertPendingOrder: async (row) => {
      persistedOrders.push(row);
      return {};
    },
    fetchGateway: async (url) => {
      gatewayUrls.push(url);
      return {
        status: 200,
        text: JSON.stringify({
          status_code: '200',
          status: 'success',
          payment_url: 'https://sandbox.paystation.com.bd/checkout/don-session',
          invoice_number: VALID_DONATION_ORDER.invoice_number,
        }),
      };
    },
    config: BASE_GATE_CONFIG,
  });

  assert.equal(donRes.status, 200);
  assert.equal(donRes.body.success, true);
  assert.equal(donRes.body.payment_amount, '500');
  assert.equal(persistedOrders.length, 2);
  assert.equal(persistedOrders[1].order_type, 'donation');
  assert.equal(gatewayUrls.length, 2);
});

test('P0-3 Initiation Gate: fails closed when PayStation gateway errors, returns invalid domain, or throws (never simulates)', async () => {
  const errRes = await executeInitiatePayment(VALID_REG_ORDER, {
    loadSettings: async () => ({ value: BASE_TEST_FEE_SETTINGS }),
    upsertPendingOrder: async () => ({}),
    fetchGateway: async () => ({
      status: 200,
      text: JSON.stringify({ status_code: '400', status: 'failed', message: 'Invalid merchant credentials' }),
    }),
    config: BASE_GATE_CONFIG,
  });
  assert.equal(errRes.status, 502);
  assert.equal(errRes.body.success, false);
  assert.equal(errRes.body.error, 'GATEWAY_INITIATION_FAILED');
  assert.equal('simulated' in errRes.body, false);
  assert.equal('paymentUrl' in errRes.body, false);

  const badDomainRes = await executeInitiatePayment(VALID_REG_ORDER, {
    loadSettings: async () => ({ value: BASE_TEST_FEE_SETTINGS }),
    upsertPendingOrder: async () => ({}),
    fetchGateway: async () => ({
      status: 200,
      text: JSON.stringify({ status_code: '200', status: 'success', payment_url: 'https://evil.example/pay' }),
    }),
    config: BASE_GATE_CONFIG,
  });
  assert.equal(badDomainRes.status, 502);
  assert.equal(badDomainRes.body.success, false);
  assert.equal(badDomainRes.body.error, 'GATEWAY_INVALID_CHECKOUT_URL');
  assert.equal('simulated' in badDomainRes.body, false);

  const netRes = await executeInitiatePayment(VALID_REG_ORDER, {
    loadSettings: async () => ({ value: BASE_TEST_FEE_SETTINGS }),
    upsertPendingOrder: async () => ({}),
    fetchGateway: async () => {
      throw new Error('Gateway TCP reset');
    },
    config: BASE_GATE_CONFIG,
  });
  assert.equal(netRes.status, 502);
  assert.equal(netRes.body.success, false);
  assert.equal(netRes.body.error, 'GATEWAY_UNREACHABLE');
  assert.equal('simulated' in netRes.body, false);
});
