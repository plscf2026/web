import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isGuardianEligible,
  isStudentBelowClass6,
  validateRegistrationData,
  RegistrationFormData,
} from './rules';
import { computeAuthoritativeOrderAmount } from '../../supabase/functions/verify-payment/feeValidation.ts';
import { validateAndBuildPendingRegistrationData } from '../../supabase/functions/verify-payment/registrationPayload.ts';
import { executeInitiatePayment } from '../../supabase/functions/verify-payment/initiationHandler.ts';
import { EventStore } from '../services/eventStore';
import { AppStore } from '../services/store';
import { normalizePublicReunionStats } from '../services/reunionStatsService';
import { StaffAccount, RegistrationRecord } from '../types';

const FEE_SETTINGS = {
  currentStudentFee: 500,
  formerStudentFee: 1500,
  parentFee: 500,
  minDonation: 100,
  maxDonation: 500000,
  maxTotalPayable: 550000,
  paymentEnabled: true,
  registrationOpen: true,
  alumniRegistrationOpen: true,
  currentStudentRegistrationOpen: true,
  donationOpen: true,
  gatewayChargeRates: {
    bkash: 0.018,
    nagad: 0.018,
    rocket: 0.018,
    card: 0.018,
    paystation: 0.018,
  },
};

const BASE_STAFF_GATE: StaffAccount = {
  id: 'STAFF-GATE-1',
  fullName: 'Gate Officer',
  username: 'gate1',
  passwordHash: 'x',
  role: 'GATE_STAFF',
  department: 'GATE',
  permissions: ['VIEW', 'SCAN', 'APPROVE', 'VERIFY'],
  status: 'ACTIVE',
  createdAt: new Date().toISOString(),
} as any;

const BASE_STAFF_LUNCH: StaffAccount = {
  id: 'STAFF-LUNCH-1',
  fullName: 'Lunch Officer',
  username: 'lunch1',
  passwordHash: 'x',
  role: 'LUNCH_STAFF',
  department: 'LUNCH',
  permissions: ['VIEW', 'SCAN', 'APPROVE', 'VERIFY'],
  status: 'ACTIVE',
  createdAt: new Date().toISOString(),
} as any;

const BASE_STAFF_DRESS: StaffAccount = {
  id: 'STAFF-DRESS-1',
  fullName: 'Dress Officer',
  username: 'dress1',
  passwordHash: 'x',
  role: 'DRESS_STAFF',
  department: 'DRESS',
  permissions: ['VIEW', 'SCAN', 'APPROVE', 'VERIFY'],
  status: 'ACTIVE',
  createdAt: new Date().toISOString(),
} as any;

test('1. Guardian Eligibility: female current students & male current students strictly below Class 6', () => {
  // Female current students: eligible at every class
  assert.equal(isGuardianEligible('current', 'female', 'Class 1'), true);
  assert.equal(isGuardianEligible('current', 'female', 'Class 5'), true);
  assert.equal(isGuardianEligible('current', 'female', 'Class 6'), true);
  assert.equal(isGuardianEligible('current', 'female', 'Class 10'), true);
  assert.equal(isGuardianEligible('current', 'female', 'Class 12 (HSC)'), true);

  // Male current students: strictly below Class 6 (cutoff Class 6 is NOT included)
  assert.equal(isStudentBelowClass6('Class 5'), true);
  assert.equal(isGuardianEligible('current', 'male', 'Play'), true);
  assert.equal(isGuardianEligible('current', 'male', 'Class 1'), true);
  assert.equal(isGuardianEligible('current', 'male', 'Class 5'), true);
  assert.equal(isGuardianEligible('current', 'male', 'Class 6'), false);
  assert.equal(isGuardianEligible('current', 'male', 'Class 7'), false);
  assert.equal(isGuardianEligible('current', 'male', 'Class 10'), false);

  // Former female student: ALSO eligible ("open in both side"); Former male student: NOT eligible
  assert.equal(isGuardianEligible('former', 'female', ''), true);
  assert.equal(isGuardianEligible('former', 'male', ''), false);
});

test('2. Client & Server Eligibility + Fee Enforcement: rejects ineligible guardian and computes single combined order', async () => {
  // Ineligible male Class 6 student attempting hasParent=true
  const ineligibleClient: RegistrationFormData = {
    fullName: 'Tariqul Islam',
    photoUrl: 'https://example.com/student.jpg',
    mobileNumber: '01711111111',
    address: 'Faridpur',
    gender: 'male',
    bloodGroup: 'A+',
    category: 'current',
    studentId: 'PLSC-2026-101',
    currentClass: 'Class 6',
    batchName: 'Class 6',
    tShirtSize: 'M',
    donationAmount: 0,
    termsAccepted: true,
    hasParent: true,
    parentName: 'Kamrul Islam',
    parentAge: 45,
    parentPhone: '01722222222',
    parentRelation: 'Father',
    parentPhotoUrl: 'https://example.com/parent.jpg',
  };
  const clientRes = validateRegistrationData(ineligibleClient);
  assert.equal(clientRes.isValid, false);
  assert.ok(clientRes.errors.hasParent);

  const serverIneligible = computeAuthoritativeOrderAmount(FEE_SETTINGS, {
    orderType: 'registration',
    category: 'current',
    gender: 'male',
    currentClass: 'Class 6',
    hasParent: true,
    paymentMethod: 'bkash',
    payWithCharge: 0,
  });
  assert.equal(serverIneligible.valid, false);
  assert.equal(serverIneligible.error, 'GUARDIAN_NOT_ELIGIBLE');

  // Eligible current male Class 5 student combined checkout (500 + 500 = 1000 + 18 = 1018)
  const serverCombined = computeAuthoritativeOrderAmount(FEE_SETTINGS, {
    orderType: 'registration',
    category: 'current',
    gender: 'male',
    currentClass: 'Class 5',
    hasParent: true,
    paymentMethod: 'bkash',
    payWithCharge: 0,
  });
  assert.equal(serverCombined.valid, true);
  assert.equal(serverCombined.registrationFee, 500);
  assert.equal(serverCombined.parentFee, 500);
  assert.equal(serverCombined.gatewayCharge, 18);
  assert.equal(serverCombined.expectedTotal, 1018);

  // Student-only checkout produces zero parentFee and no guardian identity
  const studentOnlyPayload = validateAndBuildPendingRegistrationData(
    {
      fullName: 'Nusrat Jahan',
      mobileNumber: '01711111112',
      address: 'Faridpur',
      gender: 'female',
      category: 'current',
      studentId: 'PLSC-2026-102',
      currentClass: 'Class 8',
      batchName: 'Class 8',
      tShirtSize: 'S',
      photoUrl: 'https://example.com/s2.jpg',
    },
    'current',
    false
  );
  assert.equal(studentOnlyPayload.valid, true);
  assert.equal(studentOnlyPayload.data?.guardianRegistrationId, null);
  assert.equal(studentOnlyPayload.data?.guardianQrToken, null);

  // Combined checkout generates independent guardianRegistrationId and guardianQrToken (not PAR-/P- prefix)
  const combinedPayload = validateAndBuildPendingRegistrationData(
    {
      fullName: 'Nusrat Jahan',
      mobileNumber: '01711111112',
      address: 'Faridpur',
      gender: 'female',
      category: 'current',
      studentId: 'PLSC-2026-102',
      currentClass: 'Class 8',
      batchName: 'Class 8',
      tShirtSize: 'S',
      photoUrl: 'https://example.com/s2.jpg',
      parentName: 'Rahima Begum',
      parentRelation: 'Mother',
      parentPhone: '01733333333',
      parentPhotoUrl: 'https://example.com/p2.jpg',
    },
    'current',
    true
  );
  assert.equal(combinedPayload.valid, true);
  assert.ok(combinedPayload.data?.guardianRegistrationId?.startsWith('PLSCF-2027-G'));
  assert.notEqual(combinedPayload.data?.guardianRegistrationId, combinedPayload.data?.registrationId);
  assert.equal(combinedPayload.data?.guardianQrToken?.length, 6);
  assert.notEqual(combinedPayload.data?.guardianQrToken, combinedPayload.data?.qrToken);

  // Initiate payment persists guardian details in pending_orders before gateway redirect
  let savedPendingRow: Record<string, unknown> | null = null;
  const initRes = await executeInitiatePayment(
    {
      invoice_number: 'PLSCF27-TEST-GUARD-01',
      order_type: 'registration',
      category: 'current',
      gender: 'female',
      current_class: 'Class 8',
      has_parent: true,
      payment_method: 'bkash',
      payment_amount: 1018,
      registration_fee: 500,
      parent_fee: 500,
      gateway_charge: 18,
      cust_name: 'Nusrat Jahan',
      cust_phone: '01711111112',
      callback_url: 'https://www.plscf65.online/?payment=callback',
      form_data: {
        fullName: 'Nusrat Jahan',
        mobileNumber: '01711111112',
        address: 'Faridpur',
        gender: 'female',
        category: 'current',
        studentId: 'PLSC-2026-102',
        currentClass: 'Class 8',
        batchName: 'Class 8',
        tShirtSize: 'S',
        photoUrl: 'https://example.com/s2.jpg',
        hasParent: true,
        parentName: 'Rahima Begum',
        parentRelation: 'Mother',
        parentPhone: '01733333333',
        parentPhotoUrl: 'https://example.com/p2.jpg',
      },
    },
    {
      loadSettings: async () => ({ value: FEE_SETTINGS }),
      upsertPendingOrder: async (row) => {
        savedPendingRow = row;
        return {};
      },
      fetchGateway: async () => ({
        status: 200,
        text: JSON.stringify({
          status_code: '200',
          payment_url: 'https://sandbox.paystation.com.bd/checkout/test-123',
          invoice_number: 'PLSCF27-TEST-GUARD-01',
        }),
      }),
      config: {
        paystationEnv: 'sandbox',
        paystationBaseUrl: 'https://sandbox.paystation.com.bd',
        merchantId: 'M1',
        password: 'P1',
        allowedOriginsRaw: 'https://www.plscf65.online',
        allowPaymentFinalization: false,
      },
    }
  );
  assert.equal(initRes.status, 200);
  assert.equal(initRes.body.success, true);
  assert.ok(savedPendingRow);
  const savedFormData = (savedPendingRow as any).form_data;
  assert.equal(savedFormData.parentName, 'Rahima Begum');
  assert.ok(savedFormData.guardianRegistrationId.startsWith('PLSCF-2027-G'));
  assert.equal(savedFormData.guardianQrToken.length, 6);
});

test('3. Independent Scanner Resolution, Gate Entry/Exit, Meal Limits, and Guardian T-shirt Rejection', () => {
  const prevRegs = AppStore.getRegistrations();
  const prevGate = EventStore.getGateEvents();
  const prevFood = EventStore.getFoodDistributions();
  const prevDress = EventStore.getDressDistributions();

  try {
    const studentId = 'PLSCF-2027-C9001';
    const studentToken = 'STU901';
    const guardianId = 'PLSCF-2027-G9002';
    const guardianToken = 'GRD902';

    const combinedRecord: RegistrationRecord = {
      id: studentId,
      fullName: 'Ayesha Siddiqua',
      photoUrl: 'https://example.com/ayesha.jpg',
      mobileNumber: '01711000001',
      address: 'Faridpur',
      category: 'current',
      studentId: 'PLSC-2026-901',
      currentClass: 'Class 8',
      batchName: 'Class 8',
      tShirtSize: 'M',
      registrationFee: 500,
      parentFee: 500,
      donationAmount: 0,
      totalPaid: 1018,
      paymentStatus: 'paid',
      transactionId: 'TRX-GUARD-901',
      paymentMethod: 'bkash',
      registeredAt: new Date().toISOString(),
      qrToken: studentToken,
      isTShirtCollected: false,
      hasParent: true,
      parentName: 'Salma Khatun',
      parentRelation: 'Mother',
      parentPhone: '01711000002',
      parentPhotoUrl: 'https://example.com/salma.jpg',
      guardianRegistrationId: guardianId,
      guardianQrToken: guardianToken,
      registrationApprovalStatus: 'approved',
    };

    AppStore.saveRegistrations([combinedRecord, ...prevRegs.filter((r) => r.id !== studentId)]);

    // 1. Both QR tokens resolve to their respective separate identities
    const sScan = EventStore.verifyStudentTokenForDepartment(studentToken, 'GATE', BASE_STAFF_GATE);
    assert.equal(sScan.valid, true);
    assert.equal(sScan.student?.id, studentId);
    assert.equal(sScan.student?.fullName, 'Ayesha Siddiqua');

    const gScan = EventStore.verifyStudentTokenForDepartment(guardianToken, 'GATE', BASE_STAFF_GATE);
    assert.equal(gScan.valid, true);
    assert.equal(gScan.student?.id, guardianId);
    assert.equal(gScan.student?.fullName, 'Salma Khatun');

    // 2. Student enters gate; Guardian has NOT entered yet -> Guardian lunch must be blocked
    const sEntry = EventStore.recordGateEvent(studentId, 'Ayesha Siddiqua', 'Class 8', undefined, 'ENTRY', 'G1', 'S1', BASE_STAFF_GATE.id, BASE_STAFF_GATE.fullName, BASE_STAFF_GATE);
    assert.equal(sEntry.success, true);

    const gLunchBeforeEntry = EventStore.verifyStudentTokenForDepartment(guardianToken, 'LUNCH', BASE_STAFF_LUNCH);
    assert.equal(gLunchBeforeEntry.status, 'NOT_ELIGIBLE');
    assert.equal(gLunchBeforeEntry.student?.departmentStatus.canDistribute, false);

    // 3. Guardian enters gate -> Guardian can collect lunch independently of student
    const gEntry = EventStore.recordGateEvent(guardianId, 'Salma Khatun', 'Class 8', undefined, 'ENTRY', 'G1', 'S1', BASE_STAFF_GATE.id, BASE_STAFF_GATE.fullName, BASE_STAFF_GATE);
    assert.equal(gEntry.success, true);

    const gLunchAfterEntry = EventStore.verifyStudentTokenForDepartment(guardianToken, 'LUNCH', BASE_STAFF_LUNCH);
    assert.equal(gLunchAfterEntry.status, 'AUTHORIZED');
    assert.equal(gLunchAfterEntry.student?.departmentStatus.canDistribute, true);

    const gLunchCollect = EventStore.confirmFoodDistribution(guardianId, 'Salma Khatun', 'Class 8', 'lunch', BASE_STAFF_LUNCH.id, BASE_STAFF_LUNCH.fullName, undefined, BASE_STAFF_LUNCH);
    assert.equal(gLunchCollect.success, true);

    // Duplicate lunch for guardian blocked, while student's own lunch is still available
    const gLunchDup = EventStore.confirmFoodDistribution(guardianId, 'Salma Khatun', 'Class 8', 'lunch', BASE_STAFF_LUNCH.id, BASE_STAFF_LUNCH.fullName, undefined, BASE_STAFF_LUNCH);
    assert.equal(gLunchDup.success, false);

    const sLunchAvailable = EventStore.verifyStudentTokenForDepartment(studentToken, 'LUNCH', BASE_STAFF_LUNCH);
    assert.equal(sLunchAvailable.status, 'AUTHORIZED');

    // 4. Guardian T-shirt redemption is strictly rejected, while Student T-shirt succeeds
    const gDressScan = EventStore.verifyStudentTokenForDepartment(guardianToken, 'DRESS', BASE_STAFF_DRESS);
    assert.equal(gDressScan.valid, false);
    assert.equal(gDressScan.status, 'NOT_ELIGIBLE');
    assert.ok(gDressScan.message.includes('GUARDIAN_TSHIRT_NOT_ELIGIBLE'));

    const gDressConfirm = EventStore.confirmDressDistribution(guardianId, 'Salma Khatun', 'reunion_tshirt', 'M', BASE_STAFF_DRESS.id, BASE_STAFF_DRESS.fullName, undefined, BASE_STAFF_DRESS);
    assert.equal(gDressConfirm.success, false);
    assert.ok(gDressConfirm.error?.includes('GUARDIAN_TSHIRT_NOT_ELIGIBLE'));

    const sDressConfirm = EventStore.confirmDressDistribution(studentId, 'Ayesha Siddiqua', 'reunion_tshirt', 'M', BASE_STAFF_DRESS.id, BASE_STAFF_DRESS.fullName, undefined, BASE_STAFF_DRESS);
    assert.equal(sDressConfirm.success, true);
  } finally {
    AppStore.saveRegistrations(prevRegs);
    EventStore.saveGateEvents(prevGate);
    EventStore.saveFoodDistributions(prevFood);
    EventStore.saveDressDistributions(prevDress);
  }
});

test('4. Homepage Counters: 2 former + 1 current + 1 guardian => Total Registered 4, Total Students 3, Batches unchanged', () => {
  const normalized = normalizePublicReunionStats({
    total_registered: 4,
    total_students: 3,
    former_students: 2,
    current_students: 1,
    guardians: 1,
    batches_represented: 2,
    updated_at: '2026-11-28T05:00:00Z',
  });
  assert.deepEqual(normalized, {
    totalRegistered: 4,
    totalStudents: 3,
    formerStudents: 2,
    currentStudents: 1,
    guardians: 1,
    batchesRepresented: 2,
    updatedAt: '2026-11-28T05:00:00Z',
  });

  // Derived fallback calculation when only component counts are supplied
  const derived = normalizePublicReunionStats({
    former_students: 2,
    current_students: 1,
    guardians: 1,
    batches_represented: 2,
  });
  assert.equal(derived?.totalStudents, 3);
  assert.equal(derived?.totalRegistered, 4);
  assert.equal(derived?.guardians, 1);
  assert.equal(derived?.batchesRepresented, 2);
});
