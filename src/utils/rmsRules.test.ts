import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hasRmsPermission,
  canTransitionTaskStatus,
  canTransitionBudgetStatus,
  validateExpenseReversal,
  canVolunteerCheckIn,
  calculateIncidentPriorityScore,
} from './rmsRules';
import { RmsExpense, VolunteerRecord, IncidentReport } from '../types/rms';

test('1. RMS RBAC enforces strict permission separation', () => {
  // Super Admin has everything
  assert.equal(hasRmsPermission('SUPER_ADMIN', 'DELETE_COMMITTEE'), true);
  assert.equal(hasRmsPermission('SUPER_ADMIN', 'APPROVE_BUDGET_REQUEST'), true);

  // Chief Adviser is read-only
  assert.equal(hasRmsPermission('CHIEF_ADVISER', 'VIEW_ALL_COMMITTEES'), true);
  assert.equal(hasRmsPermission('CHIEF_ADVISER', 'CREATE_COMMITTEE'), false);
  assert.equal(hasRmsPermission('CHIEF_ADVISER', 'SUBMIT_EXPENSE'), false);

  // Convener can approve budgets, reviews, manage sponsors
  assert.equal(hasRmsPermission('CONVENER', 'APPROVE_BUDGET_REQUEST'), true);
  assert.equal(hasRmsPermission('CONVENER', 'APPROVE_TASK'), true);

  // Committee Director can create tasks and submit budget, but cannot approve central budgets
  assert.equal(hasRmsPermission('COMMITTEE_DIRECTOR', 'CREATE_TASK'), true);
  assert.equal(hasRmsPermission('COMMITTEE_DIRECTOR', 'SUBMIT_BUDGET_REQUEST'), true);
  assert.equal(hasRmsPermission('COMMITTEE_DIRECTOR', 'APPROVE_BUDGET_REQUEST'), false);

  // Finance Officer can verify and recommend, but cannot create committees
  assert.equal(hasRmsPermission('FINANCE_OFFICER', 'VERIFY_EXPENSE'), true);
  assert.equal(hasRmsPermission('FINANCE_OFFICER', 'CREATE_COMMITTEE'), false);

  // Committee Member can update own task, but cannot assign tasks
  assert.equal(hasRmsPermission('COMMITTEE_MEMBER', 'UPDATE_OWN_TASK'), true);
  assert.equal(hasRmsPermission('COMMITTEE_MEMBER', 'ASSIGN_TASK'), false);
});

test('2. Task state machine restricts member vs director completion authority', () => {
  // Member moving assigned task to in progress -> allowed
  const t1 = canTransitionTaskStatus('ASSIGNED', 'IN_PROGRESS', 'COMMITTEE_MEMBER');
  assert.equal(t1.allowed, true);

  // Member moving in progress to under review -> allowed
  const t2 = canTransitionTaskStatus('IN_PROGRESS', 'UNDER_REVIEW', 'COMMITTEE_MEMBER');
  assert.equal(t2.allowed, true);

  // Member attempting to self-approve to completed -> blocked
  const t3 = canTransitionTaskStatus('UNDER_REVIEW', 'COMPLETED', 'COMMITTEE_MEMBER');
  assert.equal(t3.allowed, false);

  // Director approving task to completed -> allowed
  const t4 = canTransitionTaskStatus('UNDER_REVIEW', 'COMPLETED', 'COMMITTEE_DIRECTOR');
  assert.equal(t4.allowed, true);
});

test('3. Budget approval workflow enforces Finance recommendation before Convener approval', () => {
  // Member Secretary / Director cannot directly recommend as Finance Officer
  const b1 = canTransitionBudgetStatus('SUBMITTED', 'RECOMMENDED', 'COMMITTEE_DIRECTOR');
  assert.equal(b1.allowed, false);

  // Finance Officer recommending budget -> allowed
  const b2 = canTransitionBudgetStatus('SUBMITTED', 'RECOMMENDED', 'FINANCE_OFFICER');
  assert.equal(b2.allowed, true);

  // Finance Officer directly issuing final approval -> blocked
  const b3 = canTransitionBudgetStatus('RECOMMENDED', 'APPROVED', 'FINANCE_OFFICER');
  assert.equal(b3.allowed, false);

  // Convener issuing final approval -> allowed
  const b4 = canTransitionBudgetStatus('RECOMMENDED', 'APPROVED', 'CONVENER');
  assert.equal(b4.allowed, true);
});

test('4. Financial reversal requires authorized role and mandatory audit reason', () => {
  const sampleExpense: RmsExpense = {
    id: 'EXP-101',
    committeeId: 'food-catering',
    committeeName: 'Food & Catering',
    expenseTitle: 'Banquet Supplies',
    expenseCategory: 'Catering',
    amount: 25000,
    paymentMethod: 'BKASH',
    vendor: 'Bhai Bhai Catering',
    expenseDate: '2027-01-15',
    voucherNumber: 'VOUCHER-551',
    submittedBy: 'STF-01',
    submittedByName: 'Food Director',
    verificationStatus: 'VERIFIED',
    createdAt: new Date().toISOString(),
  };

  // Reversal without reason -> rejected
  const r1 = validateExpenseReversal(sampleExpense, '', 'FINANCE_OFFICER');
  assert.equal(r1.valid, false);

  // Reversal by unauthorized member -> rejected
  const r2 = validateExpenseReversal(sampleExpense, 'Voucher duplicate entered by error', 'COMMITTEE_MEMBER');
  assert.equal(r2.valid, false);

  // Reversal by Finance Officer with valid reason -> accepted
  const r3 = validateExpenseReversal(sampleExpense, 'Voucher duplicate entered by error, issuing credit adjustment', 'FINANCE_OFFICER');
  assert.equal(r3.valid, true);
});

test('5. Volunteer attendance check enforces proper sequence', () => {
  const volunteer: VolunteerRecord = {
    id: 'VOL-01',
    fullName: 'Tanvir Ahmed',
    phone: '01711223344',
    assignedCommitteeId: 'rally-procession',
    assignedLocation: 'Gate 01 Main Entrance',
    assignedDate: '2027-01-28',
    dutyStartTime: '08:00',
    dutyEndTime: '14:00',
    supervisorName: 'Siddiqur Rahman',
    supervisorPhone: '01811223344',
    attendanceStatus: 'PENDING',
    responsibilities: ['Entry crowd flow control'],
    emergencyContact: {
      name: 'Rahim Ahmed',
      relation: 'Brother',
      phone: '01911223344',
    },
  };

  // First check in
  const c1 = canVolunteerCheckIn(volunteer, 'CHECK_IN');
  assert.equal(c1.allowed, true);

  // Check out before checking in -> blocked
  const c2 = canVolunteerCheckIn(volunteer, 'CHECK_OUT');
  assert.equal(c2.allowed, false);

  // After check in, check out -> allowed
  volunteer.attendanceStatus = 'CHECKED_IN';
  const c3 = canVolunteerCheckIn(volunteer, 'CHECK_OUT');
  assert.equal(c3.allowed, true);
});

test('6. Incident priority score elevates Critical Medical & Security events', () => {
  const incidentLow: IncidentReport = {
    id: 'INC-01',
    incidentType: 'LOST_FOUND',
    severity: 'LOW',
    location: 'North Tent',
    description: 'Found sunglasses',
    reportedBy: 'VOL-01',
    reportedByName: 'Tanvir',
    reportedAt: new Date().toISOString(),
    assignedTeam: 'Lost and Found',
    resolutionStatus: 'RESOLVED',
  };

  const incidentCritical: IncidentReport = {
    id: 'INC-02',
    incidentType: 'MEDICAL',
    severity: 'CRITICAL',
    location: 'Main Field Gate',
    description: 'Attendee feeling dizziness',
    reportedBy: 'VOL-02',
    reportedByName: 'Volunteer',
    reportedAt: new Date().toISOString(),
    assignedTeam: 'Red Crescent Medical Team',
    resolutionStatus: 'REPORTED',
  };

  const scoreLow = calculateIncidentPriorityScore(incidentLow);
  const scoreCrit = calculateIncidentPriorityScore(incidentCritical);

  assert.ok(scoreCrit > scoreLow);
  assert.equal(scoreCrit, 150); // 100 (critical) + 30 (medical) + 20 (reported)
});

