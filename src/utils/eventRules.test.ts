import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canStaffAccessModule,
  validateMealCollection,
  validateGateAction,
  validateDressDistribution,
  calculateStaffFinancialSummary,
  validateExpenseSubmission,
  calculateCentralBudgetOverview,
  aggregateRegistrationAnalytics,
  aggregatePaymentAnalytics,
} from './eventRules';
import {
  RegistrationRecord,
  FoodDistributionRecord,
  DressDistributionRecord,
  StaffAllocation,
  StaffExpense,
  FinancialLedgerEntry,
} from '../types';

test('1. RBAC Module Access strictly restricts staff permissions', () => {
  // Super Admin has access to all modules
  assert.equal(canStaffAccessModule('SUPER_ADMIN', 'food_breakfast'), true);
  assert.equal(canStaffAccessModule('SUPER_ADMIN', 'gate_scanner'), true);
  assert.equal(canStaffAccessModule('SUPER_ADMIN', 'staff_finance'), true);
  assert.equal(canStaffAccessModule('SUPER_ADMIN', 'admin_dashboard'), true);

  // Breakfast Staff can ONLY access food_breakfast
  assert.equal(canStaffAccessModule('BREAKFAST_STAFF', 'food_breakfast'), true);
  assert.equal(canStaffAccessModule('BREAKFAST_STAFF', 'food_lunch'), false);
  assert.equal(canStaffAccessModule('BREAKFAST_STAFF', 'gate_scanner'), false);
  assert.equal(canStaffAccessModule('BREAKFAST_STAFF', 'staff_finance'), false);

  // Gate Staff can ONLY access gate_scanner
  assert.equal(canStaffAccessModule('GATE_STAFF', 'gate_scanner'), true);
  assert.equal(canStaffAccessModule('GATE_STAFF', 'food_dinner'), false);
  assert.equal(canStaffAccessModule('GATE_STAFF', 'dress_distribution'), false);
  assert.equal(canStaffAccessModule('GATE_STAFF', 'staff_finance'), false);

  // Dress Staff can ONLY access dress_distribution
  assert.equal(canStaffAccessModule('DRESS_STAFF', 'dress_distribution'), true);
  assert.equal(canStaffAccessModule('DRESS_STAFF', 'staff_finance'), false);
  assert.equal(canStaffAccessModule('DRESS_STAFF', 'gate_scanner'), false);

  // Finance Staff can ONLY access staff_finance
  assert.equal(canStaffAccessModule('FINANCE_STAFF', 'staff_finance'), true);
  assert.equal(canStaffAccessModule('FINANCE_STAFF', 'food_breakfast'), false);
  assert.equal(canStaffAccessModule('FINANCE_STAFF', 'gate_scanner'), false);
});

test('2. Food Distribution handles independent meal types and prevents duplicate collections', () => {
  const student: RegistrationRecord = {
    id: 'PLSCF-26F1001',
    fullName: 'Rahim Ahmed',
    photoUrl: 'https://example.com/p.jpg',
    mobileNumber: '01711223344',
    email: 'rahim@test.com',
    address: 'Faridpur',
    category: 'former',
    passingYear: '2010',
    batchName: 'SSC 2010',
    tShirtSize: 'XL',
    registrationFee: 1500,
    donationAmount: 0,
    totalPaid: 1500,
    paymentStatus: 'paid',
    transactionId: 'BK-TRX-101',
    paymentMethod: 'bkash',
    registeredAt: '2026-02-01T10:00:00Z',
    qrToken: 'QR-TOKEN-1',
    isTShirtCollected: false,
  };

  const existing: FoodDistributionRecord[] = [
    {
      id: 'FOOD-1',
      registrationId: 'PLSCF-26F1001',
      studentName: 'Rahim Ahmed',
      batchName: 'SSC 2010',
      mealType: 'breakfast',
      status: 'COLLECTED',
      collectedAt: '2026-12-25T08:30:00Z',
      staffId: 'STF-002',
      staffName: 'Breakfast Incharge',
    },
  ];

  // Breakfast already collected -> BLOCKED
  const resBreakfast = validateMealCollection(student, 'breakfast', existing);
  assert.equal(resBreakfast.canCollect, false);
  assert.equal(resBreakfast.status, 'ALREADY_COLLECTED');

  // Lunch NOT yet collected -> ELIGIBLE (independent status!)
  const resLunch = validateMealCollection(student, 'lunch', existing);
  assert.equal(resLunch.canCollect, true);
  assert.equal(resLunch.status, 'ELIGIBLE');

  // Dinner NOT yet collected -> ELIGIBLE
  const resDinner = validateMealCollection(student, 'dinner', existing);
  assert.equal(resDinner.canCollect, true);
  assert.equal(resDinner.status, 'ELIGIBLE');

  // Unpaid student blocked
  const unpaidStudent = { ...student, paymentStatus: 'pending' as const };
  const resUnpaid = validateMealCollection(unpaidStudent, 'lunch', existing);
  assert.equal(resUnpaid.canCollect, false);
  assert.equal(resUnpaid.status, 'UNPAID');
});

test('3. Gate Management enforces entry/exit state machine and prevents duplicate entries', () => {
  const student: RegistrationRecord = {
    id: 'PLSCF-26F2002',
    fullName: 'Kamal Hossain',
    photoUrl: 'https://example.com/k.jpg',
    mobileNumber: '01811223344',
    email: 'kamal@test.com',
    address: 'Faridpur',
    category: 'former',
    passingYear: '2005',
    batchName: 'SSC 2005',
    tShirtSize: 'L',
    registrationFee: 1500,
    donationAmount: 0,
    totalPaid: 1500,
    paymentStatus: 'paid',
    transactionId: 'NG-TRX-202',
    paymentMethod: 'nagad',
    registeredAt: '2026-02-01T10:00:00Z',
    qrToken: 'QR-TOKEN-2',
    isTShirtCollected: false,
  };

  // Student outside: ENTRY is allowed
  const entry1 = validateGateAction(student, false, 'ENTRY');
  assert.equal(entry1.allowed, true);
  assert.equal(entry1.code, 'APPROVED');

  // Student already inside: duplicate ENTRY is blocked!
  const entryDuplicate = validateGateAction(student, true, 'ENTRY');
  assert.equal(entryDuplicate.allowed, false);
  assert.equal(entryDuplicate.code, 'ALREADY_INSIDE');

  // Student inside: EXIT is allowed
  const exit1 = validateGateAction(student, true, 'EXIT');
  assert.equal(exit1.allowed, true);
  assert.equal(exit1.code, 'APPROVED');

  // Student outside: EXIT without prior entry is blocked!
  const exitInvalid = validateGateAction(student, false, 'EXIT');
  assert.equal(exitInvalid.allowed, false);
  assert.equal(exitInvalid.code, 'NOT_INSIDE');
});

test('4. Dress / T-shirt Distribution checks size and blocks duplicate issuance', () => {
  const student: RegistrationRecord = {
    id: 'PLSCF-26F3003',
    fullName: 'Nasrin Sultana',
    photoUrl: 'https://example.com/n.jpg',
    mobileNumber: '01911223344',
    email: 'nasrin@test.com',
    address: 'Faridpur',
    category: 'former',
    passingYear: '2015',
    batchName: 'SSC 2015',
    tShirtSize: 'M',
    registrationFee: 1500,
    donationAmount: 0,
    totalPaid: 1500,
    paymentStatus: 'paid',
    transactionId: 'RK-TRX-303',
    paymentMethod: 'rocket',
    registeredAt: '2026-02-01T10:00:00Z',
    qrToken: 'QR-TOKEN-3',
    isTShirtCollected: false,
  };

  const existingDistributions: DressDistributionRecord[] = [];

  // 1st request: Eligible
  const firstCheck = validateDressDistribution(student, 'reunion_tshirt', existingDistributions);
  assert.equal(firstCheck.canReceive, true);
  assert.equal(firstCheck.status, 'ELIGIBLE');
  assert.equal(firstCheck.registeredSize, 'M');

  // After record exists: Duplicate blocked
  const recordedList: DressDistributionRecord[] = [
    {
      id: 'DRS-01',
      registrationId: 'PLSCF-26F3003',
      studentName: 'Nasrin Sultana',
      itemType: 'reunion_tshirt',
      registeredSize: 'M',
      status: 'RECEIVED',
      receivedAt: '2026-12-25T09:00:00Z',
      staffId: 'STF-005',
      staffName: 'Dress Staff 1',
    },
  ];

  const duplicateCheck = validateDressDistribution(student, 'reunion_tshirt', recordedList);
  assert.equal(duplicateCheck.canReceive, false);
  assert.equal(duplicateCheck.status, 'ALREADY_RECEIVED');
  assert.equal(duplicateCheck.registeredSize, 'M');
});

test('5. Financial Ledger & Staff Remaining Balance Calculation is mathematically authoritative', () => {
  const staffId = 'STF-001';
  const staffName = 'Rahim Logistics';

  const allocations: StaffAllocation[] = [
    {
      id: 'ALC-01',
      staffId,
      staffName,
      allocatedAmount: 10000,
      academicYear: 2026,
      status: 'ACTIVE',
      allocatedAt: '2026-12-01T00:00:00Z',
      allocatedBy: 'SUPER_ADMIN',
    },
    {
      id: 'ALC-02',
      staffId,
      staffName,
      allocatedAmount: 5000,
      academicYear: 2026,
      status: 'ACTIVE',
      allocatedAt: '2026-12-05T00:00:00Z',
      allocatedBy: 'SUPER_ADMIN',
    },
  ];

  const expenses: StaffExpense[] = [
    {
      id: 'EXP-01',
      staffId,
      staffName,
      amount: 4000,
      category: 'Food Delivery',
      description: 'Van hire',
      expenseDate: '2026-12-20',
      expenseTime: '10:00',
      status: 'APPROVED',
      createdAt: '2026-12-20T10:00:00Z',
    },
    {
      id: 'EXP-02',
      staffId,
      staffName,
      amount: 2500,
      category: 'Drinking Water',
      description: 'Water jars',
      expenseDate: '2026-12-21',
      expenseTime: '11:00',
      status: 'SUBMITTED', // Pending approval locks spendable balance
      createdAt: '2026-12-21T11:00:00Z',
    },
    {
      id: 'EXP-03',
      staffId,
      staffName,
      amount: 1000,
      category: 'Unauthorized',
      description: 'Personal',
      expenseDate: '2026-12-22',
      expenseTime: '12:00',
      status: 'REJECTED', // Rejected does NOT deduct from balance
      createdAt: '2026-12-22T12:00:00Z',
    },
  ];

  const ledger: FinancialLedgerEntry[] = [
    {
      id: 'LDG-01',
      staffId,
      transactionType: 'CASH_RETURN',
      amount: 1500,
      referenceId: 'RET-01',
      description: 'Returned unused cash to admin',
      createdAt: '2026-12-23T14:00:00Z',
      createdBy: 'SUPER_ADMIN',
    },
  ];

  const summary = calculateStaffFinancialSummary(
    staffId,
    staffName,
    allocations,
    expenses,
    ledger
  );

  // Total Allocated = 10,000 + 5,000 = 15,000
  assert.equal(summary.totalAllocated, 15000);
  assert.equal(summary.totalApprovedExpenses, 4000);
  assert.equal(summary.totalSubmittedExpenses, 2500);
  assert.equal(summary.totalRejectedExpenses, 1000);
  assert.equal(summary.totalCashReturned, 1500);

  // Remaining Balance = 15,000 - 4,000 (approved) - 2,500 (submitted) - 1,500 (cash returned) = 7,000
  assert.equal(summary.remainingSpendableBalance, 7000);

  // Overspending validation test
  const validExp = validateExpenseSubmission(7000, summary.remainingSpendableBalance);
  assert.equal(validExp.allowed, true);

  const overspendExp = validateExpenseSubmission(7001, summary.remainingSpendableBalance);
  assert.equal(overspendExp.allowed, false);
  assert.ok(overspendExp.error?.includes('Overspending Prohibited'));
});

test('6. Central Event Budget Overview correctly tracks unallocated funds', () => {
  const totalBudget = 500000; // BDT 5,00,000
  const allocations: StaffAllocation[] = [
    {
      id: 'A1',
      staffId: 'S1',
      staffName: 'Staff 1',
      allocatedAmount: 100000,
      academicYear: 2026,
      status: 'ACTIVE',
      allocatedAt: '',
      allocatedBy: '',
    },
    {
      id: 'A2',
      staffId: 'S2',
      staffName: 'Staff 2',
      allocatedAmount: 150000,
      academicYear: 2026,
      status: 'ACTIVE',
      allocatedAt: '',
      allocatedBy: '',
    },
  ];

  const expenses: StaffExpense[] = [
    {
      id: 'E1',
      staffId: 'S1',
      staffName: 'Staff 1',
      amount: 80000,
      category: 'Stage',
      description: 'Advance',
      expenseDate: '2026-12-10',
      expenseTime: '10:00',
      status: 'APPROVED',
      createdAt: '',
    },
  ];

  const ledger: FinancialLedgerEntry[] = [
    {
      id: 'L1',
      staffId: 'S2',
      transactionType: 'CASH_RETURN',
      amount: 20000,
      referenceId: 'R1',
      description: 'Unused return',
      createdAt: '',
      createdBy: '',
    },
  ];

  const overview = calculateCentralBudgetOverview(
    totalBudget,
    allocations,
    expenses,
    ledger
  );

  // Total allocated = 100,000 + 150,000 = 250,000
  assert.equal(overview.totalAllocatedToStaff, 250000);
  assert.equal(overview.totalApprovedExpenses, 80000);
  assert.equal(overview.totalCashReturned, 20000);

  // Unallocated = 500,000 - 250,000 + 20,000 (returned cash) = 270,000
  assert.equal(overview.remainingUnallocatedBudget, 270000);
});

test('7. Daily Registration & Payment Analytics aggregates by date and graduation year', () => {
  const registrations: RegistrationRecord[] = [
    {
      id: 'R1',
      fullName: 'A',
      photoUrl: '',
      mobileNumber: '',
      email: '',
      address: '',
      category: 'former',
      passingYear: '2010',
      batchName: '2010',
      tShirtSize: 'L',
      registrationFee: 1500,
      donationAmount: 500,
      totalPaid: 2000,
      paymentStatus: 'paid',
      transactionId: 'T1',
      paymentMethod: 'bkash',
      registeredAt: '2026-11-09T05:00:00Z', // Today
      qrToken: 'Q1',
      isTShirtCollected: false,
    },
    {
      id: 'R2',
      fullName: 'B',
      photoUrl: '',
      mobileNumber: '',
      email: '',
      address: '',
      category: 'former',
      passingYear: '2010',
      batchName: '2010',
      tShirtSize: 'XL',
      registrationFee: 1500,
      donationAmount: 0,
      totalPaid: 1500,
      paymentStatus: 'paid',
      transactionId: 'T2',
      paymentMethod: 'nagad',
      registeredAt: '2026-11-09T06:00:00Z', // Today
      qrToken: 'Q2',
      isTShirtCollected: false,
    },
    {
      id: 'R3',
      fullName: 'C',
      photoUrl: '',
      mobileNumber: '',
      email: '',
      address: '',
      category: 'former',
      passingYear: '2015',
      batchName: '2015',
      tShirtSize: 'M',
      registrationFee: 1500,
      donationAmount: 0,
      totalPaid: 0,
      paymentStatus: 'pending', // Unpaid
      transactionId: 'T3',
      paymentMethod: 'rocket',
      registeredAt: '2026-11-08T05:00:00Z', // Yesterday
      qrToken: 'Q3',
      isTShirtCollected: false,
    },
  ];

  // Pass '2026-11-09' as reference date
  const regAnalytics = aggregateRegistrationAnalytics(registrations, '2026-11-09');
  assert.equal(regAnalytics.todayCount, 2);
  assert.equal(regAnalytics.yesterdayCount, 1);
  assert.equal(regAnalytics.totalCount, 3);
  assert.equal(regAnalytics.yearBreakdown.find((y) => y.year === '2010')?.count, 2);
  assert.equal(regAnalytics.yearBreakdown.find((y) => y.year === '2015')?.count, 1);

  const payAnalytics = aggregatePaymentAnalytics(registrations, '2026-11-09');
  assert.equal(payAnalytics.todayPaymentsCount, 2);
  assert.equal(payAnalytics.totalSuccessfulPayments, 2);
  assert.equal(payAnalytics.totalAmountCollected, 3500); // 2000 + 1500
  assert.equal(payAnalytics.pendingCount, 1);
});
