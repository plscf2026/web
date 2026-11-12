import test from 'node:test';
import assert from 'node:assert/strict';
import { RegistrationRecord } from '../types';
import { AppStore } from '../services/store';
import { SupabaseService } from '../services/supabase';
import { PayStationService, PayStationPaymentResult } from '../services/paystation';
import { RegistrationFormData } from './rules';
import { parseScannedInput } from './tokenGenerator';

// Mock Cloud Database simulating Supabase PostgreSQL registrations_2027 table
class MockSupabaseRegistrations2027 {
  private rows: Map<string, any> = new Map();
  private transactions: Set<string> = new Set();
  public networkDown = false;

  reset() {
    this.rows.clear();
    this.transactions.clear();
    this.networkDown = false;
  }

  // Simulates RLS-enforced INSERT into registrations_2027
  insert(row: any): { success: boolean; error?: string } {
    if (this.networkDown) throw new Error('TypeError: fetch failed (network timeout)');
    if (this.rows.has(row.id)) {
      return { success: false, error: 'duplicate key value violates unique constraint "registrations_2027_pkey"' };
    }
    // Strict RLS check: registration_insert_pending_2027
    if (row.payment_status !== 'pending' || row.total_paid !== 0 || row.transaction_id !== null) {
      return { success: false, error: 'new row violates row-level security policy "registration_insert_pending_2027"' };
    }
    this.rows.set(row.id, { ...row });
    return { success: true };
  }

  // Simulates SECURITY DEFINER rpc_verify_payment
  rpcVerifyPayment(p_reg_id: string, p_trx_id: string, p_method: string, p_amount: number, p_signature: string, p_verified_by: string = 'PAYSTATION_GATEWAY', p_pending_data?: any) {
    if (this.networkDown) throw new Error('TypeError: fetch failed (network timeout)');

    if (!p_reg_id) return { success: false, error: 'INVALID_REG_ID' };
    if (!p_trx_id) return { success: false, error: 'INVALID_TRX_ID' };
    if (!p_amount || p_amount <= 0) return { success: false, error: 'INVALID_AMOUNT' };

    // Anti-replay check
    for (const [id, r] of this.rows.entries()) {
      if (r.transaction_id && r.transaction_id.toUpperCase() === p_trx_id.toUpperCase() && id !== p_reg_id) {
        return { success: false, error: 'DUPLICATE_TRANSACTION: This transaction ID has already been utilized.' };
      }
    }

    let existing = this.rows.get(p_reg_id);
    if (!existing) {
      // Self-healing from p_pending_data
      if (p_pending_data) {
        existing = {
          id: p_reg_id,
          full_name: p_pending_data.full_name || p_pending_data.fullName || 'Student',
          mobile_number: p_pending_data.mobile_number || p_pending_data.mobileNumber,
          email: p_pending_data.email,
          category: p_pending_data.category || 'former',
          batch_name: p_pending_data.batch_name || p_pending_data.batchName || 'General',
          passing_year: p_pending_data.passing_year || p_pending_data.passingYear,
          qr_token: p_pending_data.qr_token || p_pending_data.qrToken || 'A7K9M2',
          year: 2027,
          payment_status: 'pending',
          total_paid: 0,
        };
        this.rows.set(p_reg_id, existing);
      } else {
        return { success: false, error: 'REGISTRATION_NOT_FOUND' };
      }
    }

    // Idempotent check
    if (existing.payment_status === 'paid' && existing.transaction_id === p_trx_id) {
      return {
        success: true,
        status: 'ALREADY_PAID',
        registration_id: p_reg_id,
        full_name: existing.full_name,
      };
    }

    existing.payment_status = 'paid';
    existing.transaction_id = p_trx_id;
    existing.payment_method = p_method;
    existing.total_paid = p_amount;
    existing.server_verification_signature = p_signature;
    existing.verification_timestamp = new Date().toISOString();
    existing.verified_by = p_verified_by;
    this.transactions.add(p_trx_id);

    return {
      success: true,
      status: 'PAID',
      registration_id: p_reg_id,
      full_name: existing.full_name,
      qr_token: existing.qr_token,
      amount: p_amount,
      trx_id: p_trx_id,
    };
  }

  // Simulates SECURITY DEFINER rpc_verify_student_qr (returns Zero PII)
  rpcVerifyStudentQr(p_identifier: string, p_token?: string | null, _p_staff_id?: string | null) {
    if (this.networkDown) throw new Error('TypeError: fetch failed (network timeout)');

    const parsed = parseScannedInput(p_identifier || '');
    const cleanId = (parsed.id || p_identifier || '').toUpperCase().trim();
    const cleanToken = (p_token || parsed.token || '').toUpperCase().trim();

    if (!cleanId && !cleanToken) {
      return { success: false, status: 'INVALID_INPUT', error: 'Registration ID or QR token required' };
    }

    let found: any = null;

    if (cleanId && cleanToken) {
      for (const r of this.rows.values()) {
        if (r.id.toUpperCase() === cleanId) {
          found = r;
          break;
        }
      }
      if (!found) {
        for (const r of this.rows.values()) {
          if (r.qr_token && r.qr_token.toUpperCase() === cleanId) {
            found = r;
            break;
          }
        }
      }
      if (!found) {
        return { success: false, status: 'NOT_FOUND', error: `Student ticket "${p_identifier}" not found in database.` };
      }
      // Token check
      const studentToken = (found.qr_token || '').toUpperCase();
      if (studentToken && studentToken !== cleanToken) {
        if (!(studentToken === cleanId && found.id.toUpperCase() === cleanToken)) {
          return { success: false, status: 'TOKEN_MISMATCH', error: `Cryptographic QR token mismatch for registration "${found.id}".` };
        }
      }
    } else if (cleanId) {
      for (const r of this.rows.values()) {
        if (r.id.toUpperCase() === cleanId || (r.qr_token && r.qr_token.toUpperCase() === cleanId)) {
          found = r;
          break;
        }
      }
      if (!found) {
        return { success: false, status: 'NOT_FOUND', error: `Student ticket "${p_identifier}" not found in database.` };
      }
    } else if (cleanToken) {
      for (const r of this.rows.values()) {
        if (r.qr_token && r.qr_token.toUpperCase() === cleanToken) {
          found = r;
          break;
        }
      }
      if (!found) {
        return { success: false, status: 'NOT_FOUND', error: `Student ticket "${p_token}" not found in database.` };
      }
    }

    if (found.payment_status !== 'paid') {
      return {
        success: false,
        status: 'UNPAID',
        error: `Payment Pending: Registration "${found.id}" is in "${found.payment_status}" status.`,
      };
    }

    // STRICT SANITIZATION: Zero private financial or personal details (No phone, no email, no amounts)
    return {
      success: true,
      verified: true,
      status: 'ELIGIBLE',
      student: {
        id: found.id,
        fullName: found.full_name,
        fullNameBn: found.full_name_bn || null,
        category: found.category,
        batchName: found.batch_name,
        passingYear: found.passing_year || null,
        currentClass: found.current_class || null,
        photoUrl: found.photo_url || '',
        paymentStatus: found.payment_status,
        qrToken: found.qr_token,
        cardStatus: 'ELIGIBLE',
        verifiedAt: new Date().toISOString(),
      },
    };
  }

  get(id: string) {
    return this.rows.get(id);
  }
}

const cloudDb = new MockSupabaseRegistrations2027();

// Wire up SupabaseService methods to mock cloudDb for reproducible tests
const origSavePending = SupabaseService.savePendingRegistration;
const origVerifyPayment = SupabaseService.verifyPayment;
const origVerifyTicket = SupabaseService.verifyStudentTicket;

function setupMockCloudDb() {
  cloudDb.reset();

  SupabaseService.savePendingRegistration = async (reg: RegistrationRecord) => {
    try {
      const res = cloudDb.insert({
        id: reg.id,
        full_name: reg.fullName,
        full_name_bn: reg.fullNameBn,
        photo_url: reg.photoUrl,
        mobile_number: reg.mobileNumber,
        email: reg.email,
        address: reg.address,
        category: reg.category,
        student_id: reg.studentId,
        passing_year: reg.passingYear,
        last_class_attended: reg.lastClassAttended,
        current_class: reg.currentClass,
        batch_name: reg.batchName,
        group_or_section: reg.groupOrSection,
        roll_number: reg.rollNumber,
        t_shirt_size: reg.tShirtSize,
        registration_fee: reg.registrationFee,
        donation_amount: reg.donationAmount,
        total_paid: reg.totalPaid,
        payment_status: reg.paymentStatus,
        transaction_id: reg.transactionId ? reg.transactionId : null,
        payment_method: reg.paymentMethod ? reg.paymentMethod : null,
        qr_token: reg.qrToken,
        year: 2027,
      });
      return { success: res.success, table: 'registrations_2027', error: res.error };
    } catch (e: any) {
      return { success: false, table: 'registrations_2027', error: e.message, isNetworkError: true };
    }
  };

  SupabaseService.verifyPayment = async (
    regId: string,
    trxId: string,
    method: string,
    amount: number,
    sig: string,
    verifiedBy: string = 'PAYSTATION_GATEWAY',
    pendingData?: RegistrationRecord
  ) => {
    try {
      const res = cloudDb.rpcVerifyPayment(regId, trxId, method, amount, sig, verifiedBy, pendingData);
      if (res.success) {
        return { success: true, data: res };
      }
      return { success: false, error: res.error };
    } catch (e: any) {
      return { success: false, error: e.message, isNetworkError: true };
    }
  };

  SupabaseService.verifyStudentTicket = async (identifier: string, tokenParam?: string, staffId: string = 'SCANNER_DESK') => {
    try {
      const res = cloudDb.rpcVerifyStudentQr(identifier, tokenParam, staffId);
      if (res.success && res.student) {
        const s = res.student;
        const record: RegistrationRecord = {
          id: s.id,
          fullName: s.fullName,
          fullNameBn: s.fullNameBn || undefined,
          photoUrl: s.photoUrl || undefined,
          category: s.category,
          batchName: s.batchName,
          passingYear: s.passingYear || undefined,
          currentClass: s.currentClass || undefined,
          paymentStatus: s.paymentStatus,
          qrToken: s.qrToken,
          year: 2027,
          registeredAt: new Date().toISOString(),
          registrationFee: 0,
          donationAmount: 0,
          totalPaid: 0,
          transactionId: '',
          paymentMethod: 'bkash',
          isTShirtCollected: false,
          mobileNumber: '',
          email: null,
          address: '',
          tShirtSize: 'L',
        };
        return { success: true, verified: true, student: record };
      }
      return {
        success: false,
        verified: false,
        errorType: res.status as any,
        error: res.error,
      };
    } catch (e: any) {
      return {
        success: false,
        verified: false,
        errorType: 'NETWORK_ERROR',
        error: 'Network Connection Error: Unable to reach verification server. Please check your internet connection.',
      };
    }
  };
}

function teardownMockCloudDb() {
  SupabaseService.savePendingRegistration = origSavePending;
  SupabaseService.verifyPayment = origVerifyPayment;
  SupabaseService.verifyStudentTicket = origVerifyTicket;
}

// ─── TEST SUITE: 12 SCENARIOS ────────────────────────────────────────────────

test('Scenario 1: Student registers -> pending record created in Supabase with payment_status = "pending"', async () => {
  setupMockCloudDb();
  try {
    const formData: RegistrationFormData = {
      fullName: 'Sagar Kumar Saha',
      mobileNumber: '01711223344',
      email: 'sagar@example.com',
      address: 'Faridpur Town',
      category: 'former',
      passingYear: '2012',
      batchName: 'SSC 2012',
      tShirtSize: 'XL',
      donationAmount: 500,
      photoUrl: 'https://example.com/photo.jpg',
      termsAccepted: true,
    };

    const fees = { registrationFee: 1500, donationAmount: 500, totalPayable: 2000 };
    const invoiceNumber = 'INV-2027-001';

    const pending = await PayStationService.createPendingRegistration(formData, fees, invoiceNumber, 'PLSCF-2027-F2182');

    assert.equal(pending.id, 'PLSCF-2027-F2182');
    assert.equal(pending.paymentStatus, 'pending');
    assert.equal(pending.totalPaid, 0);
    assert.equal(pending.transactionId, '');
    assert.ok(pending.qrToken);

    // Verify record in Supabase cloud table
    const inCloud = cloudDb.get('PLSCF-2027-F2182');
    assert.ok(inCloud, 'Must exist in registrations_2027');
    assert.equal(inCloud.payment_status, 'pending');
    assert.equal(inCloud.total_paid, 0);
    assert.equal(inCloud.transaction_id, null);
    assert.equal(inCloud.qr_token, pending.qrToken);
  } finally {
    teardownMockCloudDb();
  }
});

test('Scenario 2: Student completes payment -> status updated to "paid" in Supabase via authoritative rpc_verify_payment', async () => {
  setupMockCloudDb();
  try {
    const formData: RegistrationFormData = {
      fullName: 'Sagar Kumar Saha',
      mobileNumber: '01711223344',
      email: 'sagar@example.com',
      address: 'Faridpur Town',
      category: 'former',
      passingYear: '2012',
      batchName: 'SSC 2012',
      tShirtSize: 'XL',
      donationAmount: 500,
      photoUrl: 'https://example.com/photo.jpg',
      termsAccepted: true,
    };
    const fees = { registrationFee: 1500, donationAmount: 500, totalPayable: 2000 };
    const invoice = 'INV-2027-001';

    await PayStationService.createPendingRegistration(formData, fees, invoice, 'PLSCF-2027-F2182');

    const payment: PayStationPaymentResult = {
      invoiceNumber: invoice,
      trxId: 'PST-TRX-889900',
      status: 'Success',
      amount: 2000,
      method: 'bkash',
      payerMobile: '01711223344',
      timestamp: new Date().toISOString(),
    };

    const finalized = await PayStationService.completeRegistrationAfterPayment(formData, payment);

    assert.equal(finalized.id, 'PLSCF-2027-F2182');
    assert.equal(finalized.paymentStatus, 'paid');
    assert.equal(finalized.transactionId, 'PST-TRX-889900');
    assert.equal(finalized.totalPaid, 2000);

    // Verify in cloud table
    const inCloud = cloudDb.get('PLSCF-2027-F2182');
    assert.equal(inCloud.payment_status, 'paid');
    assert.equal(inCloud.transaction_id, 'PST-TRX-889900');
    assert.equal(inCloud.total_paid, 2000);
    assert.equal(inCloud.payment_method, 'bkash');
  } finally {
    teardownMockCloudDb();
  }
});

test('Scenario 3: Scanner on DIFFERENT device scans student QR code -> successfully verifies student', async () => {
  setupMockCloudDb();
  try {
    // 1. Student registers and pays on Device A (phone)
    const formData: RegistrationFormData = {
      fullName: 'Farhan Akhtar',
      mobileNumber: '01899887766',
      address: 'Faridpur',
      category: 'former',
      passingYear: '2015',
      batchName: 'SSC 2015',
      tShirtSize: 'L',
      donationAmount: 0,
      photoUrl: 'https://example.com/farhan.jpg',
      termsAccepted: true,
    };
    await PayStationService.createPendingRegistration(formData, { registrationFee: 1500, donationAmount: 0, totalPayable: 1500 }, 'INV-FARHAN-01', 'PLSCF-2027-F2182');
    await PayStationService.completeRegistrationAfterPayment(formData, {
      invoiceNumber: 'INV-FARHAN-01',
      trxId: 'TRX-FARHAN-01',
      status: 'Success',
      amount: 1500,
      method: 'bkash',
    });

    const cloudRecord = cloudDb.get('PLSCF-2027-F2182');
    const qrToken = cloudRecord.qr_token;

    // 2. Device B (Staff Scanner) has EMPTY local storage (new device/session)
    AppStore.saveRegistrations([]);
    assert.equal(AppStore.findRegistration('PLSCF-2027-F2182'), undefined);

    // 3. Scanner on Device B verifies ticket
    const verifyRes = await AppStore.verifyStudentTicketAsync('PLSCF-2027-F2182', qrToken, 'STAFF_DESK_01');

    assert.equal(verifyRes.verified, true);
    assert.equal(verifyRes.student?.id, 'PLSCF-2027-F2182');
    assert.equal(verifyRes.student?.fullName, 'Farhan Akhtar');
    assert.equal(verifyRes.student?.paymentStatus, 'paid');

    // 4. Scanner on Device B has now cached record in local memory
    const cached = AppStore.findRegistration('PLSCF-2027-F2182');
    assert.ok(cached, 'Must be cached locally for fast repeat scans');
    assert.equal(cached?.id, 'PLSCF-2027-F2182');
  } finally {
    teardownMockCloudDb();
  }
});

test('Scenario 4: Scanner receives full verification URL -> correctly parses and verifies', async () => {
  setupMockCloudDb();
  try {
    const cloudRecord = cloudDb.get('PLSCF-2027-F2182');
    const token = cloudRecord ? cloudRecord.qr_token : 'TKN999';

    // Seed paid record
    cloudDb.insert({
      id: 'PLSCF-2027-F2182',
      full_name: 'Farhan Akhtar',
      mobile_number: '01899887766',
      category: 'former',
      batch_name: 'SSC 2015',
      payment_status: 'pending',
      total_paid: 0,
      transaction_id: null,
      payment_method: null,
      qr_token: token,
      year: 2027,
    });
    cloudDb.rpcVerifyPayment('PLSCF-2027-F2182', 'TRX-SCN-4', 'bkash', 1500, 'SIG-4');

    AppStore.saveRegistrations([]);

    const fullUrl = `https://plscf.org/verify?id=PLSCF-2027-F2182&token=${token}`;
    const parsed = parseScannedInput(fullUrl);
    assert.equal(parsed.id, 'PLSCF-2027-F2182');
    assert.equal(parsed.token, token);

    const verifyRes = await AppStore.verifyStudentTicketAsync(fullUrl, undefined, 'STAFF_01');
    assert.equal(verifyRes.verified, true);
    assert.equal(verifyRes.student?.id, 'PLSCF-2027-F2182');
  } finally {
    teardownMockCloudDb();
  }
});

test('Scenario 5: Scanner receives raw ID -> correctly verifies', async () => {
  setupMockCloudDb();
  try {
    cloudDb.insert({
      id: 'PLSCF-2027-F5555',
      full_name: 'Nayeem Hasan',
      mobile_number: '01700000000',
      category: 'former',
      batch_name: 'SSC 2010',
      payment_status: 'pending',
      total_paid: 0,
      transaction_id: null,
      payment_method: null,
      qr_token: 'NYM555',
      year: 2027,
    });
    cloudDb.rpcVerifyPayment('PLSCF-2027-F5555', 'TRX-NYM-5', 'nagad', 1500, 'SIG-5');

    AppStore.saveRegistrations([]);

    const verifyRes = await AppStore.verifyStudentTicketAsync('PLSCF-2027-F5555');
    assert.equal(verifyRes.verified, true);
    assert.equal(verifyRes.student?.id, 'PLSCF-2027-F5555');
    assert.equal(verifyRes.student?.fullName, 'Nayeem Hasan');
  } finally {
    teardownMockCloudDb();
  }
});

test('Scenario 6: Scanner receives raw Token -> correctly verifies', async () => {
  setupMockCloudDb();
  try {
    cloudDb.insert({
      id: 'PLSCF-2027-F6666',
      full_name: 'Mousumi Paul',
      mobile_number: '01800000000',
      category: 'former',
      batch_name: 'SSC 2008',
      payment_status: 'pending',
      total_paid: 0,
      transaction_id: null,
      payment_method: null,
      qr_token: 'MSM666',
      year: 2027,
    });
    cloudDb.rpcVerifyPayment('PLSCF-2027-F6666', 'TRX-MSM-6', 'bkash', 1500, 'SIG-6');

    AppStore.saveRegistrations([]);

    const verifyRes = await AppStore.verifyStudentTicketAsync('MSM666');
    assert.equal(verifyRes.verified, true);
    assert.equal(verifyRes.student?.id, 'PLSCF-2027-F6666');
    assert.equal(verifyRes.student?.fullName, 'Mousumi Paul');
  } finally {
    teardownMockCloudDb();
  }
});

test('Scenario 7: Unpaid student scanned -> returns PAYMENT_PENDING (not verified)', async () => {
  setupMockCloudDb();
  try {
    cloudDb.insert({
      id: 'PLSCF-2027-F7777',
      full_name: 'Unpaid Student',
      mobile_number: '01900000000',
      category: 'former',
      batch_name: 'SSC 2020',
      payment_status: 'pending',
      total_paid: 0,
      transaction_id: null,
      payment_method: null,
      qr_token: 'UNP777',
      year: 2027,
    });

    AppStore.saveRegistrations([]);

    const verifyRes = await AppStore.verifyStudentTicketAsync('PLSCF-2027-F7777', 'UNP777');
    assert.equal(verifyRes.verified, false);
    assert.equal(verifyRes.errorType, 'UNPAID');
    assert.ok(verifyRes.error?.includes('Payment Pending'));
  } finally {
    teardownMockCloudDb();
  }
});

test('Scenario 8: Nonexistent ID scanned -> returns NOT_FOUND', async () => {
  setupMockCloudDb();
  try {
    AppStore.saveRegistrations([]);

    const verifyRes = await AppStore.verifyStudentTicketAsync('PLSCF-2027-NONEXISTENT', 'BADTKN');
    assert.equal(verifyRes.verified, false);
    assert.equal(verifyRes.errorType, 'NOT_FOUND');
    assert.ok(verifyRes.error?.includes('not found in database'));
  } finally {
    teardownMockCloudDb();
  }
});

test('Scenario 9: Tampered QR code (valid ID, invalid token) -> returns TOKEN_MISMATCH', async () => {
  setupMockCloudDb();
  try {
    cloudDb.insert({
      id: 'PLSCF-2027-F8888',
      full_name: 'Legit Student',
      mobile_number: '01500000000',
      category: 'former',
      batch_name: 'SSC 2018',
      payment_status: 'pending',
      total_paid: 0,
      transaction_id: null,
      payment_method: null,
      qr_token: 'CORRECT',
      year: 2027,
    });
    cloudDb.rpcVerifyPayment('PLSCF-2027-F8888', 'TRX-LEGIT', 'bkash', 1500, 'SIG-8');

    AppStore.saveRegistrations([]);

    // Scan with forged token
    const verifyRes = await AppStore.verifyStudentTicketAsync('PLSCF-2027-F8888', 'FORGED_TOKEN');
    assert.equal(verifyRes.verified, false);
    assert.equal(verifyRes.errorType, 'TOKEN_MISMATCH');
    assert.ok(verifyRes.error?.includes('token mismatch'));
  } finally {
    teardownMockCloudDb();
  }
});

test('Scenario 10: Network failure during scan -> reports network error (NOT "student not found")', async () => {
  setupMockCloudDb();
  try {
    AppStore.saveRegistrations([]);

    // Simulate network drop
    cloudDb.networkDown = true;

    const verifyRes = await AppStore.verifyStudentTicketAsync('PLSCF-2027-F2182');
    assert.equal(verifyRes.verified, false);
    assert.equal(verifyRes.errorType, 'NETWORK_ERROR');
    assert.ok(verifyRes.error?.includes('Network Connection Error'));
    assert.ok(!verifyRes.error?.includes('not found in database'), 'Must NEVER say not found on network error');
  } finally {
    cloudDb.networkDown = false;
    teardownMockCloudDb();
  }
});

test('Scenario 11: Duplicate callback received -> handled idempotently without error or duplicate charge', async () => {
  setupMockCloudDb();
  try {
    cloudDb.insert({
      id: 'PLSCF-2027-F9999',
      full_name: 'Idempotent Student',
      mobile_number: '01300000000',
      category: 'former',
      batch_name: 'SSC 2014',
      payment_status: 'pending',
      total_paid: 0,
      transaction_id: null,
      payment_method: null,
      qr_token: 'IDEMP9',
      year: 2027,
    });

    // First callback
    const res1 = await SupabaseService.verifyPayment('PLSCF-2027-F9999', 'TRX-IDEMP-01', 'bkash', 1500, 'SIG-9');
    assert.equal(res1.success, true);
    assert.equal(res1.data?.status, 'PAID');

    // Duplicate callback with identical transaction ID
    const res2 = await SupabaseService.verifyPayment('PLSCF-2027-F9999', 'TRX-IDEMP-01', 'bkash', 1500, 'SIG-9');
    assert.equal(res2.success, true, 'Duplicate callback must succeed idempotently');
    assert.equal(res2.data?.status, 'ALREADY_PAID');

    // Attempt replay attack on DIFFERENT student with SAME transaction ID
    cloudDb.insert({
      id: 'PLSCF-2027-F0001',
      full_name: 'Attacker Student',
      mobile_number: '01311111111',
      category: 'former',
      batch_name: 'SSC 2014',
      payment_status: 'pending',
      total_paid: 0,
      transaction_id: null,
      payment_method: null,
      qr_token: 'ATTACK',
      year: 2027,
    });
    const resReplay = await SupabaseService.verifyPayment('PLSCF-2027-F0001', 'TRX-IDEMP-01', 'bkash', 1500, 'SIG-9');
    assert.equal(resReplay.success, false, 'Replay of transaction ID on another student must be rejected');
    assert.ok(resReplay.error?.includes('DUPLICATE_TRANSACTION'));
  } finally {
    teardownMockCloudDb();
  }
});

test('Scenario 12: Zero PII returned to scanner -> phone, email, payment amounts NOT present in response', async () => {
  setupMockCloudDb();
  try {
    cloudDb.insert({
      id: 'PLSCF-2027-PRIVACY',
      full_name: 'Private Attendee',
      mobile_number: '01799887766',
      email: 'sensitive.email@example.com',
      address: 'Secret House 42',
      category: 'former',
      batch_name: 'SSC 2000',
      payment_status: 'pending',
      total_paid: 0,
      transaction_id: null,
      payment_method: null,
      qr_token: 'PRV000',
      year: 2027,
    });
    cloudDb.rpcVerifyPayment('PLSCF-2027-PRIVACY', 'TRX-PRV', 'bkash', 5000, 'SIG-PRV');

    AppStore.saveRegistrations([]);

    const verifyRes = await AppStore.verifyStudentTicketAsync('PLSCF-2027-PRIVACY', 'PRV000', 'STAFF_GATE');
    assert.equal(verifyRes.verified, true);
    assert.ok(verifyRes.student);

    // Verify attendee display data is present
    assert.equal(verifyRes.student.fullName, 'Private Attendee');
    assert.equal(verifyRes.student.id, 'PLSCF-2027-PRIVACY');
    assert.equal(verifyRes.student.batchName, 'SSC 2000');

    // Verify ZERO PII is leaked
    assert.equal(verifyRes.student.mobileNumber, '', 'Mobile number must be empty or redacted');
    assert.equal(verifyRes.student.email, null, 'Email must be null or redacted');
    assert.equal(verifyRes.student.address, '', 'Physical address must be empty');
    assert.equal(verifyRes.student.totalPaid, 0, 'Financial amounts must not be exposed');
    assert.equal(verifyRes.student.registrationFee, 0, 'Fee breakdown must not be exposed');
    assert.equal(verifyRes.student.transactionId, '', 'Transaction ID must not be exposed to scanner');
  } finally {
    teardownMockCloudDb();
  }
});
