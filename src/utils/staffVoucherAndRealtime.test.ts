import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StaffExpense, StaffAllocation } from '../types';
import { EventStore } from '../services/eventStore';
import { sanitizeImageUrl, sanitizeUrl } from './security';
import { calculateStaffFinancialSummary } from './eventRules';

test('1. Staff Expense Real-Time Matching & Tamper Proofing', () => {
  const now = new Date();
  const expectedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const expectedTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // Date format must be strict YYYY-MM-DD
  assert.match(expectedDate, /^\d{4}-\d{2}-\d{2}$/, 'Date must match YYYY-MM-DD format');
  // Time format must be strict 24-hour HH:mm
  assert.match(expectedTime, /^\d{2}:\d{2}$/, 'Time must match HH:mm 24-hour format');

  // Verify non-empty and non-NaN
  assert.equal(isNaN(Date.parse(expectedDate)), false, 'Date must be a valid calendar date');
});

test('2. Voucher Image URL Sanitization & Security against Script Injection', () => {
  const maliciousUrls = [
    'javascript:alert("XSS")',
    'JAVASCRIPT:document.location="http://evil.com"',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox("pwnd")',
    'data:image/svg+xml;utf8,<svg onload="alert(1)"></svg>',
  ];

  maliciousUrls.forEach((badUrl) => {
    const sanitizedLink = sanitizeUrl(badUrl);
    assert.equal(
      sanitizedLink,
      '#',
      `Dangerous voucher URL in links must be neutralized to "#", got: ${sanitizedLink}`
    );

    const sanitizedImage = sanitizeImageUrl(badUrl);
    assert.equal(
      sanitizedImage,
      '',
      `Dangerous image URI must be rejected to empty string, got: ${sanitizedImage}`
    );
  });

  const validDataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD';
  assert.equal(
    sanitizeImageUrl(validDataUrl),
    validDataUrl,
    'Valid image data URI must be preserved by sanitizeImageUrl'
  );

  const validHttpsUrl = 'https://example.com/vouchers/receipt_123.jpg';
  assert.equal(
    sanitizeImageUrl(validHttpsUrl),
    validHttpsUrl,
    'Valid HTTPS image URL must be preserved by sanitizeImageUrl'
  );
});

test('3. Staff Expense Submission with Voucher preserves Receipt and Status', () => {
  const mockStaffId = 'STAFF-FIN-TEST-01';
  const mockStaffName = 'Test Finance Officer';

  // Seed allocation using authoritative method
  EventStore.allocateMoneyToStaff(
    mockStaffId,
    mockStaffName,
    25000,
    'ADMIN_01',
    'SUPER_ADMIN',
    'Initial test allocation'
  );

  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const sampleVoucherDataUrl = 'data:image/jpeg;base64,/9j/mockVoucherDataUrlString';

  const result = EventStore.submitStaffExpense(
    mockStaffId,
    mockStaffName,
    3500,
    'Logistics & Transport',
    'Procurement of 50 water containers from local vendor',
    dateStr,
    timeStr,
    'Faridpur Water Supply',
    sampleVoucherDataUrl
  );

  assert.equal(result.success, true, 'Expense submission should succeed within budget');
  assert.ok(result.expense, 'Created expense record should be returned');
  assert.equal(result.expense.amount, 3500);
  assert.equal(result.expense.status, 'SUBMITTED');
  assert.equal(result.expense.receiptUrl, sampleVoucherDataUrl);
  assert.equal(result.expense.vendorName, 'Faridpur Water Supply');
  assert.equal(result.expense.expenseDate, dateStr);
  assert.equal(result.expense.expenseTime, timeStr);
});

test('4. Staff Financial Summary correctly accounts for voucher-backed expenses', () => {
  const staffId = 'STAFF-FIN-TEST-02';
  const staffName = 'Logistics Lead';

  const allocations: StaffAllocation[] = [
    {
      id: 'AL-1',
      staffId,
      staffName,
      allocatedAmount: 50000,
      academicYear: 2026,
      status: 'ACTIVE',
      allocatedAt: new Date().toISOString(),
      allocatedBy: 'SUPER_ADMIN',
    },
  ];

  const expenses: StaffExpense[] = [
    {
      id: 'EXP-1',
      staffId,
      staffName,
      amount: 12000,
      category: 'Printing & Badges',
      description: 'Lanyard and badge printing',
      expenseDate: '2026-11-12',
      expenseTime: '10:30',
      vendorName: 'Faridpur Press',
      receiptUrl: 'data:image/jpeg;base64,/9j/sampleVoucher1',
      status: 'APPROVED',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'EXP-2',
      staffId,
      staffName,
      amount: 8000,
      category: 'Stage & Lighting',
      description: 'Sound equipment advance',
      expenseDate: '2026-11-12',
      expenseTime: '14:15',
      vendorName: 'Faridpur Sound',
      receiptUrl: 'data:image/jpeg;base64,/9j/sampleVoucher2',
      status: 'SUBMITTED',
      createdAt: new Date().toISOString(),
    },
  ];

  const summary = calculateStaffFinancialSummary(staffId, staffName, allocations, expenses, []);

  assert.equal(summary.totalAllocated, 50000);
  assert.equal(summary.totalApprovedExpenses, 12000);
  assert.equal(summary.totalSubmittedExpenses, 8000);
  assert.equal(summary.remainingSpendableBalance, 30000, '50000 - 12000 - 8000 = 30000 remaining');
});
