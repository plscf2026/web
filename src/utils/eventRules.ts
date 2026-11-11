/**
 * Police Lines School and College, Faridpur - Grand Reunion 2026
 * Pure Logic & Rules Engine for Event Management System:
 * - RBAC permissions
 * - Meal distribution validation
 * - Gate entry/exit state machine
 * - Dress distribution rules
 * - Financial ledger balance calculation & overspending validation
 * - Daily registration & payment analytics (Asia/Dhaka timezone)
 */

import {
  EventStaffRole,
  FoodDistributionRecord,
  DressDistributionRecord,
  StaffAllocation,
  StaffExpense,
  FinancialLedgerEntry,
  RegistrationRecord,
} from '../types';

/**
 * 1. RBAC Module Access Checks
 */
export const ROLE_ALLOWED_MODULES: Record<EventStaffRole, string[]> = {
  SUPER_ADMIN: [
    'food_breakfast',
    'food_lunch',
    'food_dinner',
    'gate_scanner',
    'dress_distribution',
    'staff_finance',
    'admin_dashboard',
  ],
  BREAKFAST_STAFF: ['food_breakfast'],
  LUNCH_STAFF: ['food_lunch'],
  DINNER_STAFF: ['food_dinner'],
  GATE_STAFF: ['gate_scanner'],
  DRESS_STAFF: ['dress_distribution'],
  FINANCE_STAFF: ['staff_finance'],
};

export function canStaffAccessModule(role: EventStaffRole, moduleName: string): boolean {
  const allowed = ROLE_ALLOWED_MODULES[role];
  if (!allowed) return false;
  return allowed.includes(moduleName);
}

export function isBreakfastCollectionOpen(now: Date = new Date()): boolean {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dhaka',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value);
  return hour < 13;
}

/**
 * 2. Food Distribution Rules: Independent meal check & duplicate prevention
 */
export interface FoodValidationResult {
  canCollect: boolean;
  status: 'ELIGIBLE' | 'ALREADY_COLLECTED' | 'INVALID_REGISTRATION' | 'UNPAID' | 'CLOSED';
  messageEn: string;
  messageBn: string;
}

export function validateMealCollection(
  registration: RegistrationRecord | undefined | null,
  mealType: 'breakfast' | 'lunch' | 'dinner',
  existingDistributions: FoodDistributionRecord[],
  now: Date = new Date()
): FoodValidationResult {
  if (!registration) {
    return {
      canCollect: false,
      status: 'INVALID_REGISTRATION',
      messageEn: 'Student ticket not found in registration database.',
      messageBn: 'শিক্ষার্থীর টিকিট নিবন্ধন ডেটাবেজে পাওয়া যায়নি।',
    };
  }

  if (registration.paymentStatus !== 'paid') {
    return {
      canCollect: false,
      status: 'UNPAID',
      messageEn: `Registration fee unpaid (Status: ${registration.paymentStatus.toUpperCase()}). Meal collection blocked.`,
      messageBn: `রেজিস্ট্রেশন ফি অপরিশোধিত (${registration.paymentStatus})। খাবার সংগ্রহ নিষিদ্ধ।`,
    };
  }

  const already = existingDistributions.find(
    (d) =>
      d.registrationId === registration.id &&
      d.mealType === mealType &&
      d.status === 'COLLECTED'
  );

  if (already) {
    return {
      canCollect: false,
      status: 'ALREADY_COLLECTED',
      messageEn: `ALREADY COLLECTED: ${mealType.toUpperCase()} has already been collected on ${new Date(already.collectedAt).toLocaleTimeString()}.`,
      messageBn: `ইতোমধ্যে সংগৃহীত: এই শিক্ষার্থীর ${mealType} খাবার ইতোমধ্যে সংগ্রহ করা হয়েছে।`,
    };
  }

  if (mealType === 'breakfast' && !isBreakfastCollectionOpen(now)) {
    return {
      canCollect: false,
      status: 'CLOSED',
      messageEn: 'Breakfast service is closed after 1:00 PM Bangladesh time.',
      messageBn: 'বাংলাদেশ সময় দুপুর ১টার পর সকালের নাস্তা বিতরণ বন্ধ।',
    };
  }

  return {
    canCollect: true,
    status: 'ELIGIBLE',
    messageEn: `Eligible for ${mealType.toUpperCase()} collection.`,
    messageBn: `${mealType} খাবার সংগ্রহের জন্য উপযুক্ত।`,
  };
}

/**
 * 3. Gate Entry & Exit Consecutive State Machine
 */
export interface GateActionValidation {
  allowed: boolean;
  code: 'APPROVED' | 'ALREADY_INSIDE' | 'NOT_INSIDE' | 'UNPAID' | 'INVALID_TICKET';
  messageEn: string;
  messageBn: string;
}

export function validateGateAction(
  registration: RegistrationRecord | undefined | null,
  isCurrentlyInside: boolean,
  action: 'ENTRY' | 'EXIT'
): GateActionValidation {
  if (!registration) {
    return {
      allowed: false,
      code: 'INVALID_TICKET',
      messageEn: 'Student ticket not found or invalid QR code.',
      messageBn: 'শিক্ষার্থীর টিকিট পাওয়া যায়নি বা অবৈধ কিউআর কোড।',
    };
  }

  if (registration.paymentStatus !== 'paid') {
    return {
      allowed: false,
      code: 'UNPAID',
      messageEn: `Gate access denied: Registration status is ${registration.paymentStatus.toUpperCase()}.`,
      messageBn: `প্রবেশ নিষেধ: রেজিস্ট্রেশন ফি পরিশোধিত নয় (${registration.paymentStatus})।`,
    };
  }

  if (action === 'ENTRY') {
    if (isCurrentlyInside) {
      return {
        allowed: false,
        code: 'ALREADY_INSIDE',
        messageEn: 'DUPLICATE ENTRY ALERT: Student is already marked as INSIDE the campus!',
        messageBn: 'দ্বৈত প্রবেশ সতর্কতা: শিক্ষার্থী ইতোমধ্যে ক্যাম্পাসের ভেতরে অবস্থান করছেন!',
      };
    }
    return {
      allowed: true,
      code: 'APPROVED',
      messageEn: 'Entry approved. Identity visually verified.',
      messageBn: 'প্রবেশ অনুমোদিত। ছবি ও তথ্য যাচাই করা হয়েছে।',
    };
  } else {
    // EXIT
    if (!isCurrentlyInside) {
      return {
        allowed: false,
        code: 'NOT_INSIDE',
        messageEn: 'EXIT MISMATCH ALERT: Student does not have an active entry record!',
        messageBn: 'প্রস্থান অসঙ্গতি: শিক্ষার্থীর কোনো সক্রিয় প্রবেশ রেকর্ড নেই!',
      };
    }
    return {
      allowed: true,
      code: 'APPROVED',
      messageEn: 'Exit recorded successfully.',
      messageBn: 'প্রস্থান সফলভাবে লিপিবদ্ধ করা হয়েছে।',
    };
  }
}

/**
 * 4. Dress / T-shirt Distribution Validation
 */
export interface DressValidationResult {
  canReceive: boolean;
  status: 'ELIGIBLE' | 'ALREADY_RECEIVED' | 'UNPAID' | 'INVALID_TICKET';
  messageEn: string;
  messageBn: string;
  registeredSize?: string;
}

export function validateDressDistribution(
  registration: RegistrationRecord | undefined | null,
  itemType: string,
  existingDistributions: DressDistributionRecord[]
): DressValidationResult {
  if (!registration) {
    return {
      canReceive: false,
      status: 'INVALID_TICKET',
      messageEn: 'Registration not found.',
      messageBn: 'নিবন্ধন খুঁজে পাওয়া যায়নি।',
    };
  }

  if (registration.paymentStatus !== 'paid') {
    return {
      canReceive: false,
      status: 'UNPAID',
      messageEn: 'Payment unpaid. Dress distribution blocked.',
      messageBn: 'ফি পরিশোধিত নয়। পোশাক বিতরণ সম্ভব নয়।',
    };
  }

  const already = existingDistributions.find(
    (d) =>
      d.registrationId === registration.id &&
      d.itemType === itemType &&
      d.status === 'RECEIVED'
  );

  if (already) {
    return {
      canReceive: false,
      status: 'ALREADY_RECEIVED',
      messageEn: `ALREADY RECEIVED: Size ${already.registeredSize} was received at ${new Date(already.receivedAt).toLocaleTimeString()}.`,
      messageBn: `ইতোমধ্যে গৃহীত: সাইজ ${already.registeredSize} ইতোমধ্যে প্রদান করা হয়েছে।`,
      registeredSize: already.registeredSize,
    };
  }

  return {
    canReceive: true,
    status: 'ELIGIBLE',
    messageEn: `Eligible for receiving Reunion T-shirt (Size: ${registration.tShirtSize}).`,
    messageBn: `পুনর্মিলনী টি-শার্ট গ্রহণের যোগ্য (সাইজ: ${registration.tShirtSize})।`,
    registeredSize: registration.tShirtSize,
  };
}

/**
 * 5. Authoritative Financial Ledger & Remaining Balance Calculations
 *
 * Balance Formula:
 * STAFF REMAINING BALANCE =
 *   TOTAL ACTIVE ALLOCATIONS
 *   + APPROVED ADJUSTMENTS
 *   - (SUBMITTED + APPROVED EXPENSES)
 *   - CASH RETURNED
 */
export interface StaffFinancialSummary {
  staffId: string;
  staffName: string;
  totalAllocated: number;
  totalSubmittedExpenses: number;
  totalApprovedExpenses: number;
  totalRejectedExpenses: number;
  totalVoidedExpenses: number;
  totalCashReturned: number;
  remainingSpendableBalance: number;
}

export function calculateStaffFinancialSummary(
  staffId: string,
  staffName: string,
  allocations: StaffAllocation[],
  expenses: StaffExpense[],
  ledgerEntries: FinancialLedgerEntry[]
): StaffFinancialSummary {
  // Sum active allocations
  const staffAllocs = allocations.filter(
    (a) => a.staffId === staffId && a.status === 'ACTIVE'
  );
  const totalAllocated = staffAllocs.reduce((sum, a) => sum + Number(a.allocatedAmount), 0);

  // Sum expenses by status
  const staffExps = expenses.filter((e) => e.staffId === staffId);
  const submittedExps = staffExps.filter((e) => e.status === 'SUBMITTED');
  const approvedExps = staffExps.filter((e) => e.status === 'APPROVED');
  const rejectedExps = staffExps.filter((e) => e.status === 'REJECTED');
  const voidedExps = staffExps.filter((e) => e.status === 'VOIDED');

  const totalSubmittedExpenses = submittedExps.reduce((sum, e) => sum + Number(e.amount), 0);
  const totalApprovedExpenses = approvedExps.reduce((sum, e) => sum + Number(e.amount), 0);
  const totalRejectedExpenses = rejectedExps.reduce((sum, e) => sum + Number(e.amount), 0);
  const totalVoidedExpenses = voidedExps.reduce((sum, e) => sum + Number(e.amount), 0);

  // Sum cash returned or adjustments from authoritative ledger
  const staffLedger = ledgerEntries.filter((l) => l.staffId === staffId);
  const totalCashReturned = staffLedger
    .filter((l) => l.transactionType === 'CASH_RETURN')
    .reduce((sum, l) => sum + Number(l.amount), 0);

  const adjustments = staffLedger
    .filter((l) => l.transactionType === 'ADJUSTMENT')
    .reduce((sum, l) => sum + Number(l.amount), 0);

  // Remaining spendable balance locks both submitted and approved expenses
  const remainingSpendableBalance =
    totalAllocated +
    adjustments -
    (totalSubmittedExpenses + totalApprovedExpenses) -
    totalCashReturned;

  return {
    staffId,
    staffName,
    totalAllocated,
    totalSubmittedExpenses,
    totalApprovedExpenses,
    totalRejectedExpenses,
    totalVoidedExpenses,
    totalCashReturned,
    remainingSpendableBalance: Math.max(0, remainingSpendableBalance),
  };
}

/**
 * Overspending Validation
 */
export function validateExpenseSubmission(
  requestedAmount: number,
  currentRemainingBalance: number
): { allowed: boolean; error?: string } {
  if (requestedAmount <= 0) {
    return { allowed: false, error: 'Expense amount must be greater than BDT 0.' };
  }
  if (requestedAmount > currentRemainingBalance) {
    return {
      allowed: false,
      error: `Overspending Prohibited: Requested amount BDT ${requestedAmount} exceeds your available allocated balance of BDT ${currentRemainingBalance}. Please request additional budget allocation from Super Admin.`,
    };
  }
  return { allowed: true };
}

/**
 * 6. Central Event Budget Metrics
 */
export function calculateCentralBudgetOverview(
  totalCentralBudget: number,
  allocations: StaffAllocation[],
  expenses: StaffExpense[],
  ledgerEntries: FinancialLedgerEntry[]
) {
  const activeAllocs = allocations.filter((a) => a.status === 'ACTIVE');
  const totalAllocatedToStaff = activeAllocs.reduce((sum, a) => sum + Number(a.allocatedAmount), 0);
  const totalExpensesRecorded = expenses
    .filter((e) => e.status !== 'VOIDED' && e.status !== 'REJECTED')
    .reduce((sum, e) => sum + Number(e.amount), 0);
  const totalApprovedExpenses = expenses
    .filter((e) => e.status === 'APPROVED')
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const totalCashReturned = ledgerEntries
    .filter((l) => l.transactionType === 'CASH_RETURN')
    .reduce((sum, l) => sum + Number(l.amount), 0);

  const remainingUnallocatedBudget = Math.max(
    0,
    totalCentralBudget - totalAllocatedToStaff + totalCashReturned
  );

  return {
    totalCentralBudget,
    totalAllocatedToStaff,
    totalExpensesRecorded,
    totalApprovedExpenses,
    totalCashReturned,
    remainingUnallocatedBudget,
  };
}

/**
 * 7. Asia/Dhaka Date Utility (UTC+6)
 */
export function getDhakaDateString(isoDateString?: string): string {
  const date = isoDateString ? new Date(isoDateString) : new Date();
  // Adjust to UTC+6
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  const dhakaTime = new Date(utc + 3600000 * 6);
  return dhakaTime.toISOString().split('T')[0];
}

/**
 * 8. Daily Registration & Payment Analytics Aggregator
 */
export function aggregateRegistrationAnalytics(
  registrations: RegistrationRecord[] = [],
  targetDateStr?: string
) {
  const safeList = Array.isArray(registrations) ? registrations : [];
  const todayDhaka = targetDateStr || getDhakaDateString();
  const d = new Date(todayDhaka);
  const yesterdayDate = new Date(d);
  yesterdayDate.setDate(d.getDate() - 1);
  const yesterdayDhaka = yesterdayDate.toISOString().split('T')[0];

  const sevenDaysAgo = new Date(d);
  sevenDaysAgo.setDate(d.getDate() - 7);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

  const thirtyDaysAgo = new Date(d);
  thirtyDaysAgo.setDate(d.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

  let todayCount = 0;
  let yesterdayCount = 0;
  let weekCount = 0;
  let monthCount = 0;
  const yearGroupMap: Record<string, number> = {};

  safeList.forEach((r) => {
    const regDate = getDhakaDateString(r.registeredAt);

    if (regDate === todayDhaka) todayCount++;
    if (regDate === yesterdayDhaka) yesterdayCount++;
    if (regDate >= sevenDaysAgoStr && regDate <= todayDhaka) weekCount++;
    if (regDate >= thirtyDaysAgoStr && regDate <= todayDhaka) monthCount++;

    // Group by graduation year or category
    const yr = r.passingYear || (r.category === 'current' ? `Current (${r.currentClass || 'Enrolled'})` : 'Other');
    yearGroupMap[yr] = (yearGroupMap[yr] || 0) + 1;
  });

  const yearBreakdown = Object.entries(yearGroupMap)
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => b.count - a.count);

  return {
    todayCount,
    yesterdayCount,
    weekCount,
    monthCount,
    totalCount: safeList.length,
    yearBreakdown,
  };
}

export function aggregatePaymentAnalytics(
  registrations: RegistrationRecord[] = [],
  targetDateStr?: string
) {
  const safeList = Array.isArray(registrations) ? registrations : [];
  const todayDhaka = targetDateStr || getDhakaDateString();
  const d = new Date(todayDhaka);
  const yesterdayDate = new Date(d);
  yesterdayDate.setDate(d.getDate() - 1);
  const yesterdayDhaka = yesterdayDate.toISOString().split('T')[0];

  const sevenDaysAgo = new Date(d);
  sevenDaysAgo.setDate(d.getDate() - 7);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

  const thirtyDaysAgo = new Date(d);
  thirtyDaysAgo.setDate(d.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

  let todayPaymentsCount = 0;
  let yesterdayPaymentsCount = 0;
  let weekPaymentsCount = 0;
  let monthPaymentsCount = 0;
  let totalSuccessfulPayments = 0;
  let totalAmountCollected = 0;
  let pendingCount = 0;
  let failedCount = 0;
  let refundedCount = 0;

  const paymentYearMap: Record<string, { count: number; amount: number }> = {};

  safeList.forEach((r) => {
    const pDate = getDhakaDateString(r.registeredAt);

    if (r.paymentStatus === 'paid') {
      totalSuccessfulPayments++;
      totalAmountCollected += Number(r.totalPaid || 0);

      if (pDate === todayDhaka) todayPaymentsCount++;
      if (pDate === yesterdayDhaka) yesterdayPaymentsCount++;
      if (pDate >= sevenDaysAgoStr && pDate <= todayDhaka) weekPaymentsCount++;
      if (pDate >= thirtyDaysAgoStr && pDate <= todayDhaka) monthPaymentsCount++;

      const yr = r.passingYear || (r.category === 'current' ? 'Current' : 'Other');
      if (!paymentYearMap[yr]) paymentYearMap[yr] = { count: 0, amount: 0 };
      paymentYearMap[yr].count++;
      paymentYearMap[yr].amount += Number(r.totalPaid || 0);
    } else if (r.paymentStatus === 'pending') {
      pendingCount++;
    } else if (r.paymentStatus === 'failed') {
      failedCount++;
    } else if (r.paymentStatus === 'refunded') {
      refundedCount++;
    }
  });

  const paymentByYear = Object.entries(paymentYearMap)
    .map(([year, stats]) => ({ year, count: stats.count, amount: stats.amount }))
    .sort((a, b) => b.amount - a.amount);

  return {
    todayPaymentsCount,
    yesterdayPaymentsCount,
    weekPaymentsCount,
    monthPaymentsCount,
    totalSuccessfulPayments,
    totalAmountCollected,
    pendingCount,
    failedCount,
    refundedCount,
    paymentByYear,
  };
}
