import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { computeAuthoritativeOrderAmount } from '../../supabase/functions/verify-payment/feeValidation.ts';
import { parseAllowlistedOrigins, resolveServerCallbackUrl } from '../../supabase/functions/verify-payment/callbackUrl.ts';
import { SupabaseService, supabase } from '../services/supabase';
import { PayStationService } from '../services/paystation';
import { RegistrationRecord, DonationRecord } from '../types';

const AUTHORITATIVE_FEE_SETTINGS = {
  currentStudentFee: 500,
  formerStudentFee: 1500,
  parentFee: 500,
  minDonation: 100,
  maxDonation: 50000,
  maxTotalPayable: 100000,
  gatewayChargeRates: {
    paystation: 0.018,
    bkash: 0.018,
    nagad: 0.018,
    rocket: 0.018,
    card: 0.018,
    amex: 0.018,
  },
  registrationOpen: true,
  donationOpen: true,
  paymentEnabled: false,
};

test('Server Fee Validation: missing or incomplete system_settings fails closed (no hardcoded fallbacks)', () => {
  const missing = computeAuthoritativeOrderAmount(null, {
    orderType: 'registration',
    category: 'former',
    paymentMethod: 'bkash',
  });
  assert.equal(missing.valid, false);
  assert.equal(missing.error, 'FEE_SETTINGS_MISSING');

  const partial = computeAuthoritativeOrderAmount({ currentStudentFee: 500 }, {
    orderType: 'registration',
    category: 'current',
    paymentMethod: 'bkash',
  });
  assert.equal(partial.valid, false);
  assert.equal(partial.error, 'FEE_SETTINGS_MISSING');
});

test('Server Fee Validation: computes exact totals & rejects unknown types/categories/methods', () => {
  const unknownType = computeAuthoritativeOrderAmount(AUTHORITATIVE_FEE_SETTINGS, {
    orderType: 'vip_bypass',
    paymentMethod: 'bkash',
  });
  assert.equal(unknownType.valid, false);
  assert.equal(unknownType.error, 'INVALID_ORDER_TYPE');

  const badMethod = computeAuthoritativeOrderAmount(AUTHORITATIVE_FEE_SETTINGS, {
    orderType: 'registration',
    category: 'current',
    paymentMethod: 'crypto',
  });
  assert.equal(badMethod.valid, false);
  assert.equal(badMethod.error, 'INVALID_PAYMENT_METHOD');

  const currentWithParentCharge = computeAuthoritativeOrderAmount(AUTHORITATIVE_FEE_SETTINGS, {
    orderType: 'registration',
    category: 'current',
    hasParent: true,
    donationAmount: 200,
    paymentMethod: 'bkash',
    payWithCharge: 1,
  });
  assert.equal(currentWithParentCharge.valid, true);
  assert.equal(currentWithParentCharge.registrationFee, 500);
  assert.equal(currentWithParentCharge.parentFee, 500);
  assert.equal(currentWithParentCharge.donationAmount, 200);
  assert.equal(currentWithParentCharge.subtotal, 1200);
  assert.equal(currentWithParentCharge.gatewayCharge, 21.6);
  assert.equal(currentWithParentCharge.expectedTotal, 1221.6);

  const validDonation = computeAuthoritativeOrderAmount(AUTHORITATIVE_FEE_SETTINGS, {
    orderType: 'donation',
    donationAmount: 500,
    paymentMethod: 'nagad',
    payWithCharge: 0,
  });
  assert.equal(validDonation.valid, true);
  assert.equal(validDonation.gatewayCharge, 9);
  assert.equal(validDonation.expectedTotal, 509);
});

test('Server Fee Validation: rejects client amount tampering, fee decomposition mismatches & overflows', () => {
  const underpaid = computeAuthoritativeOrderAmount(AUTHORITATIVE_FEE_SETTINGS, {
    orderType: 'registration',
    category: 'former',
    paymentMethod: 'bkash',
    payWithCharge: 0,
    clientPaymentAmount: 100,
  });
  assert.equal(underpaid.valid, false);
  assert.equal(underpaid.error, 'AMOUNT_MISMATCH');

  const spoofedParentFee = computeAuthoritativeOrderAmount(AUTHORITATIVE_FEE_SETTINGS, {
    orderType: 'registration',
    category: 'current',
    hasParent: true,
    paymentMethod: 'bkash',
    payWithCharge: 0,
    clientPaymentAmount: 1018,
    clientParentFee: 0,
  });
  assert.equal(spoofedParentFee.valid, false);
  assert.equal(spoofedParentFee.error, 'FEE_DECOMPOSITION_MISMATCH');

  const tooSmallDonation = computeAuthoritativeOrderAmount(AUTHORITATIVE_FEE_SETTINGS, {
    orderType: 'donation',
    donationAmount: 50,
    paymentMethod: 'bkash',
  });
  assert.equal(tooSmallDonation.valid, false);
  assert.equal(tooSmallDonation.error, 'INVALID_DONATION_AMOUNT');

  const overflowDonation = computeAuthoritativeOrderAmount(AUTHORITATIVE_FEE_SETTINGS, {
    orderType: 'donation',
    donationAmount: 999999,
    paymentMethod: 'bkash',
  });
  assert.equal(overflowDonation.valid, false);
  assert.equal(overflowDonation.error, 'INVALID_DONATION_AMOUNT');
});

test('Callback URL Allowlisting: rejects missing config, malicious origins & malformed URLs', () => {
  const missingCfg = resolveServerCallbackUrl({
    allowedOriginsRaw: '',
    paystationEnv: 'production',
    orderType: 'registration',
    invoiceNumber: 'INV-12345',
  });
  assert.equal(missingCfg.valid, false);
  assert.equal(missingCfg.error, 'CALLBACK_ORIGIN_NOT_CONFIGURED');

  // Production blocks http:// even in APP_ALLOWED_ORIGINS
  const prodHttpOnly = parseAllowlistedOrigins('http://plscf.org,http://localhost:5173', 'production');
  assert.deepEqual(prodHttpOnly, []);

  // Malicious attacker domain rejected even if query/path resembles valid URL
  const maliciousOrigin = resolveServerCallbackUrl({
    allowedOriginsRaw: 'https://plscf.org,https://www.plscf.org',
    paystationEnv: 'production',
    requestedCallbackUrl: 'https://evil-attacker.example/steal?next=https://plscf.org',
    orderType: 'registration',
    invoiceNumber: 'INV-12345',
  });
  assert.equal(maliciousOrigin.valid, false);
  assert.equal(maliciousOrigin.error, 'UNAPPROVED_CALLBACK_ORIGIN');

  // JavaScript / malformed URL rejected
  const malformed = resolveServerCallbackUrl({
    allowedOriginsRaw: 'https://plscf.org',
    paystationEnv: 'production',
    requestedCallbackUrl: 'not-a-valid-url',
    orderType: 'registration',
    invoiceNumber: 'INV-12345',
  });
  assert.equal(malformed.valid, false);
  assert.equal(malformed.error, 'INVALID_CALLBACK_URL');

  // Bad invoice characters rejected
  const badInvoice = resolveServerCallbackUrl({
    allowedOriginsRaw: 'https://plscf.org',
    paystationEnv: 'production',
    requestedOrigin: 'https://plscf.org',
    orderType: 'registration',
    invoiceNumber: '../admin?x=1',
  });
  assert.equal(badInvoice.valid, false);
  assert.equal(badInvoice.error, 'INVALID_INVOICE_NUMBER');

  // Valid allowlisted origin reconstructs canonical server-side callback URL (ignores client query/path)
  const validCb = resolveServerCallbackUrl({
    allowedOriginsRaw: 'https://plscf.org,https://staging.plscf.org',
    paystationEnv: 'production',
    requestedCallbackUrl: 'https://staging.plscf.org/arbitrary/path?injected=1',
    orderType: 'donation',
    invoiceNumber: 'INV-DON-2027-01',
  });
  assert.equal(validCb.valid, true);
  assert.equal(validCb.callbackUrl, 'https://staging.plscf.org/?payment_return=1&type=donation&invoice=INV-DON-2027-01');
});

test('Frontend Fallback Removal: saveRegistration & saveDonation reject anon fallbacks on failure/permission denied', async () => {
  const origFunctionsDesc =
    Object.getOwnPropertyDescriptor(supabase, 'functions') ||
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(supabase), 'functions');
  const origRpc = supabase.rpc.bind(supabase);
  const origFrom = supabase.from.bind(supabase);
  const origGetSession = supabase.auth.getSession.bind(supabase.auth);

  let directTableWriteAttempted = false;
  let directRpcWriteAttempted = false;
  let fakeInvoke: any = async () => ({
    data: { success: false, error: 'PAYMENT_FINALIZATION_DISABLED' },
    error: null,
  });

  Object.defineProperty(supabase, 'functions', {
    configurable: true,
    get: () => ({ invoke: (...args: any[]) => fakeInvoke(...args) }),
  });

  const paidReg: RegistrationRecord = {
    id: 'PLSCF-2027-F9001',
    fullName: 'Fallback Guard Student',
    photoUrl: 'https://example.com/p.jpg',
    mobileNumber: '01711111111',
    address: 'Faridpur',
    category: 'former',
    batchName: '2015',
    tShirtSize: 'L',
    registrationFee: 1500,
    donationAmount: 0,
    totalPaid: 1500,
    paymentStatus: 'paid',
    transactionId: 'TRX-GUARD-1',
    paymentMethod: 'bkash',
    registeredAt: new Date().toISOString(),
    qrToken: 'GRD001',
    isTShirtCollected: false,
    year: 2027,
  };

  const sampleDonation: DonationRecord = {
    id: 'DON-2027-9001',
    donorName: 'Test Donor',
    mobileNumber: '01711111111',
    email: '',
    amount: 500,
    purpose: 'General Fund',
    paymentMethod: 'bkash',
    transactionId: 'TRX-DON-1',
    date: '2026-11-26',
    year: 2027,
    paymentStatus: 'paid',
  };

  try {
    // 1. Permission-denied / unauthenticated scenario: Edge Function rejects, anon session absent -> NO table upsert
    fakeInvoke = async () => ({
      data: { success: false, error: 'PAYMENT_FINALIZATION_DISABLED' },
      error: null,
    });
    (supabase.auth as any).getSession = async () => ({ data: { session: null }, error: null });
    (supabase as any).rpc = async (fnName: string) => {
      if (fnName === 'rpc_record_donation') directRpcWriteAttempted = true;
      return { data: null, error: { code: '42501', message: 'permission denied for function' } };
    };
    (supabase as any).from = () => ({
      upsert: async () => {
        directTableWriteAttempted = true;
        return { error: null };
      },
    });

    const regFail = await SupabaseService.saveRegistration(paidReg, 2027);
    assert.equal(regFail.success, false);
    assert.equal(directTableWriteAttempted, false, 'Must NEVER fall back to direct registrations_2027 upsert');

    const manualAnon = await SupabaseService.saveRegistration({
      ...paidReg,
      paymentStatus: 'pending',
      isManualRegistration: true,
      registrationType: 'manual_venue',
    }, 2027);
    assert.equal(manualAnon.success, false);
    assert.ok(manualAnon.error?.includes('PERMISSION_DENIED'));

    const donFail = await SupabaseService.saveDonation(sampleDonation, 2027);
    assert.equal(donFail.success, false);
    assert.equal(directRpcWriteAttempted, false, 'Must NEVER fall back to anon rpc_record_donation');
    assert.equal(directTableWriteAttempted, false, 'Must NEVER fall back to anon donations table upsert');

    // 2. Success path via Edge Function
    fakeInvoke = async (_fn: string, opts: any) => {
      if (opts?.body?.action === 'record-donation') {
        return {
          data: {
            success: true,
            donation: {
              id: sampleDonation.id,
              donor_name: sampleDonation.donorName,
              mobile_number: sampleDonation.mobileNumber,
              amount: sampleDonation.amount,
              purpose: sampleDonation.purpose,
              payment_method: 'bkash',
              transaction_id: sampleDonation.transactionId,
              payment_status: 'paid',
              year: 2027,
            },
          },
          error: null,
        };
      }
      return { data: { success: true, verified: true }, error: null };
    };

    const regOk = await SupabaseService.saveRegistration(paidReg, 2027);
    assert.equal(regOk.success, true);

    const donOk = await SupabaseService.saveDonation(sampleDonation, 2027);
    assert.equal(donOk.success, true);
    assert.equal(donOk.donation?.id, sampleDonation.id);
  } finally {
    if (origFunctionsDesc) {
      Object.defineProperty(supabase, 'functions', origFunctionsDesc);
    } else {
      delete (supabase as any).functions;
    }
    (supabase as any).rpc = origRpc;
    (supabase as any).from = origFrom;
    (supabase.auth as any).getSession = origGetSession;
  }
});

test('Credential Hygiene: zero VITE_PAYSTATION_PASSWORD in env/src and zero passwords in client config', () => {
  const rootDir = path.resolve(process.cwd());
  for (const envName of ['.env', '.env.local', '.env.example']) {
    const fullPath = path.join(rootDir, envName);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const activeLines = content
        .split('\n')
        .filter((l) => l.trim() && !l.trim().startsWith('#'));
      for (const line of activeLines) {
        assert.ok(
          !line.startsWith('VITE_PAYSTATION_PASSWORD='),
          `${envName} must NOT define active VITE_PAYSTATION_PASSWORD`
        );
      }
    }
  }

  const cfg = PayStationService.getConfig() as unknown as Record<string, unknown>;
  assert.equal('password' in cfg, false);
  assert.equal('merchantId' in cfg, true);
});
