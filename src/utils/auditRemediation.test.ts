import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { resolveAuthoritativeDonationPrincipal } from '../../supabase/functions/verify-payment/feeValidation.ts';
import { calculateTotalFee } from './rules';
import { sanitizeSvg } from './security';
import { buildOfficialCardSvg } from './officialCardTemplates';
import { validateStudentImage } from '../services/studentPhotoStorageService';
import { SupabaseService, isDevTestBypassAllowed } from '../services/supabase';
import { EventStore } from '../services/eventStore';
import { PORTAL_ROLE_CONFIGS } from '../types';

const TEST_FEE_SETTINGS = {
  currentStudentFee: 500,
  formerStudentFee: 1500,
  parentFee: 500,
  minDonation: 100,
  maxDonation: 50000,
  maxTotalPayable: 100000,
  gatewayChargeRates: { paystation: 0.018, bkash: 0.018, nagad: 0.018 },
};

test('F-09: resolveAuthoritativeDonationPrincipal recovers exact net donation without double 1.8% charge', () => {
  // 50,000 BDT max donation + 1.8% charge (900) = 50,900 BDT reported by PayStation
  const resWithOrder = resolveAuthoritativeDonationPrincipal(
    TEST_FEE_SETTINGS,
    50900,
    'bkash',
    { donationAmount: 50000, gatewayCharge: 900 }
  );
  assert.equal(resWithOrder.valid, true);
  assert.equal(resWithOrder.donationAmount, 50000);
  assert.equal(resWithOrder.gatewayCharge, 900);
  assert.equal(resWithOrder.expectedTotal, 50900);

  // Without pendingOrder.fees, recovers 2,500 BDT net principal from 2,545 BDT paid
  const resInferred = resolveAuthoritativeDonationPrincipal(TEST_FEE_SETTINGS, 2545, 'paystation');
  assert.equal(resInferred.valid, true);
  assert.equal(resInferred.donationAmount, 2500);
  assert.equal(resInferred.expectedTotal, 2545);
});

test('F-05: calculateTotalFee dynamically reads feeSettings.parentFee', () => {
  const resDefault = calculateTotalFee('former', {
    formerStudentFee: 1500,
    currentStudentFee: 500,
    parentFee: 500,
    registrationOpen: true,
    startDate: '2026-01-01',
    endDate: '2027-01-20',
    lateFeeEnabled: false,
    lateFeeAmount: 0,
  }, 0, true);
  assert.equal(resDefault.parentFee, 500);
  assert.equal(resDefault.totalPayable, 2000);

  const resHigher = calculateTotalFee('current', {
    formerStudentFee: 1500,
    currentStudentFee: 500,
    parentFee: 750,
    registrationOpen: true,
    startDate: '2026-01-01',
    endDate: '2027-01-20',
    lateFeeEnabled: false,
    lateFeeAmount: 0,
  }, 100, true);
  assert.equal(resHigher.parentFee, 750);
  assert.equal(resHigher.totalPayable, 1350);
});

test('F-04: Spoofed localStorage session keys are ignored & cleared when dev bypass is disabled', async () => {
  const prevFlag = process.env.VITE_ENABLE_TEST_BYPASS;
  const prevUrl = process.env.VITE_SUPABASE_URL;
  process.env.VITE_ENABLE_TEST_BYPASS = 'false';
  process.env.VITE_SUPABASE_URL = 'https://hnthoszbkhvygoowtvau.supabase.co';

  const localStore: Record<string, string> = {
    plscf_test_admin_session: JSON.stringify({ id: 'spoofed-id', role: 'super_admin' }),
    plscf_test_staff_session: JSON.stringify({ id: 'spoofed-staff', role: 'GATE_STAFF' }),
  };

  const origWindow = (globalThis as any).window;
  const origLocalStorage = (globalThis as any).localStorage;
  const mockLs = {
    getItem: (k: string) => localStore[k] ?? null,
    setItem: (k: string, v: string) => { localStore[k] = String(v); },
    removeItem: (k: string) => { delete localStore[k]; },
  };
  (globalThis as any).localStorage = mockLs;
  (globalThis as any).window = { ...(origWindow || {}), localStorage: mockLs };

  try {
    assert.equal(isDevTestBypassAllowed(), false);
    const adminSess = await SupabaseService.getActiveAdminSession();
    const staffSess = await EventStore.getActiveStaffSession();
    assert.equal(adminSess, null);
    assert.equal(staffSess, null);
    assert.equal(localStore.plscf_test_admin_session, undefined);
    assert.equal(localStore.plscf_test_staff_session, undefined);
  } finally {
    if (origWindow === undefined) delete (globalThis as any).window;
    else (globalThis as any).window = origWindow;
    if (origLocalStorage === undefined) delete (globalThis as any).localStorage;
    else (globalThis as any).localStorage = origLocalStorage;
    if (prevFlag === undefined) delete process.env.VITE_ENABLE_TEST_BYPASS;
    else process.env.VITE_ENABLE_TEST_BYPASS = prevFlag;
    if (prevUrl === undefined) delete process.env.VITE_SUPABASE_URL;
    else process.env.VITE_SUPABASE_URL = prevUrl;
  }
});

test('F-22: validateStudentImage rejects bare RIFF non-WebP files and missing MIME', async () => {
  // RIFF + WAVE header masquerading as image/webp
  const riffWav = new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00,
    0x57, 0x41, 0x56, 0x45, 0x00, 0x00, 0x00, 0x00,
  ]);
  const fakeWebpBlob = new Blob([riffWav], { type: 'image/webp' });
  const wavRes = await validateStudentImage(fakeWebpBlob);
  assert.equal(wavRes.valid, false);

  // Genuine RIFF + WEBP header succeeds
  const realWebp = new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00,
    0x57, 0x45, 0x42, 0x50, 0x00, 0x00, 0x00, 0x00,
  ]);
  const realWebpBlob = new Blob([realWebp], { type: 'image/webp' });
  const webpRes = await validateStudentImage(realWebpBlob);
  assert.equal(webpRes.valid, true);

  // Empty MIME rejected
  const noMimeBlob = new Blob([realWebp], { type: '' });
  const noMimeRes = await validateStudentImage(noMimeBlob);
  assert.equal(noMimeRes.valid, false);
});

test('F-30: SVG sanitization strips dangerous elements and official card blocks unsafe photoUrl schemes', () => {
  const dirtySvg = '<svg><script>alert(1)</script><circle cx="10" cy="10" r="5" onload="alert(2)" /></svg>';
  const cleanSvg = sanitizeSvg(dirtySvg);
  assert.equal(cleanSvg.includes('<script'), false);
  assert.equal(cleanSvg.includes('onload='), false);

  const unsafeCardSvg = buildOfficialCardSvg({
    name: 'Test Student',
    photoUrl: 'javascript:alert(1)',
    registrationId: 'PLSCF-2027-F1001',
    uniqueId: 'test_card',
  });
  assert.equal(unsafeCardSvg.includes('javascript:'), false);
});

test('Edge Function, CSP, and SQL Migration remediation invariants hold', () => {
  const root = process.cwd();
  const verifyStudentSrc = fs.readFileSync(path.join(root, 'supabase/functions/verify-student-id/index.ts'), 'utf8');
  const verifyPaySrc = fs.readFileSync(path.join(root, 'supabase/functions/verify-payment/index.ts'), 'utf8');
  const auditFnSrc = fs.readFileSync(path.join(root, 'supabase/functions/admin-audit/index.ts'), 'utf8');
  const vercelSrc = fs.readFileSync(path.join(root, 'vercel.json'), 'utf8');
  const mig1Src = fs.readFileSync(path.join(root, 'supabase/migrations/20270322000000_security_rpc_and_rls_hardening.sql'), 'utf8');
  const mig2Src = fs.readFileSync(path.join(root, 'supabase/migrations/20270322010000_donation_ipn_promotion_and_logs.sql'), 'utf8');
  const rb1Src = fs.readFileSync(path.join(root, 'supabase/rollback/20270322000000_rollback.sql'), 'utf8');
  const rb2Src = fs.readFileSync(path.join(root, 'supabase/rollback/20270322010000_rollback.sql'), 'utf8');

  // F-03: verify-student-id requires auth + avoids raw .or interpolation + omits qrToken
  assert.ok(verifyStudentSrc.includes('auth.getUser'));
  assert.equal(verifyStudentSrc.includes('id.ilike.${'), false);
  assert.equal(verifyStudentSrc.includes('qrToken: registration.qr_token'), false);

  // F-09 & F-16: verify-payment origin rejection, sanitized 500s, status sanitization, no double charge
  assert.ok(verifyPaySrc.includes('if (origin && !allowedOrigins.includes(origin))'));
  assert.ok(verifyPaySrc.includes('sanitizeGatewayStatusResponse'));
  assert.ok(verifyPaySrc.includes('resolveAuthoritativeDonationPrincipal'));
  assert.equal(verifyPaySrc.includes('error: err.message'), false);

  // F-29: admin-audit checks status & is_locked
  assert.ok(auditFnSrc.includes('is_locked'));

  // F-10: vercel.json CSP includes media-src
  assert.ok(vercelSrc.includes("media-src 'self' blob: data: mediastream:;"));

  // F-13: super_admin allowedTabs drops nonexistent tabs
  assert.equal((PORTAL_ROLE_CONFIGS.super_admin.allowedTabs as string[]).includes('securityAudit'), false);
  assert.equal((PORTAL_ROLE_CONFIGS.super_admin.allowedTabs as string[]).includes('reunionManagement'), false);

  // Migrations & rollbacks exist and wrap inside transactions
  assert.ok(mig1Src.includes('BEGIN;') && mig1Src.includes('COMMIT;'));
  assert.ok(mig2Src.includes('BEGIN;') && mig2Src.includes('COMMIT;') && mig2Src.includes("v_order.order_type = 'donation'"));
  assert.ok(rb1Src.includes('BEGIN;') && rb1Src.includes('COMMIT;'));
  assert.ok(rb2Src.includes('BEGIN;') && rb2Src.includes('COMMIT;'));
});
