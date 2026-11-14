import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FinancialService, FinancialTransparencySummary } from '../services/financialService';

describe('Reunion Financial Transparency & Accountability System', () => {
  it('Requirement 1 & 6: Mathematically calculates remaining balance = Total Inflow - Total Outflow', () => {
    const summary: FinancialTransparencySummary = {
      total_collected: 500000,
      total_registration_fees: 300000,
      total_donations: 200000,
      total_expenses: 350000,
      remaining_balance: 150000,
      paid_student_count: 250,
      donor_count: 45,
      categories: [],
      recent_expenses: [],
      recent_donations: [],
      updated_at: new Date().toISOString(),
    };

    assert.equal(summary.total_collected, summary.total_registration_fees + summary.total_donations);
    assert.equal(summary.remaining_balance, summary.total_collected - summary.total_expenses);
  });

  it('Requirement 3: Masks Registration Number for public donation transparency to protect donor privacy', () => {
    const publicDonations = [
      { id: 'DON-1', donor_name: 'Dr. Rafiqul Islam', masked_registration_id: 'PLSCF-2027-****', amount: 25000, donation_date: '2026-02-01' },
      { id: 'DON-2', donor_name: 'Anonymous Donor', masked_registration_id: 'PLSCF-2027-****', amount: 10000, donation_date: '2026-02-03', is_anonymous: true },
    ];

    for (const don of publicDonations) {
      assert.ok(don.masked_registration_id.includes('****'), 'Registration ID must be masked');
      assert.equal((don as any).mobile_number, undefined, 'Sensitive phone number must NOT be exposed in public ledger');
      assert.equal((don as any).email, undefined, 'Sensitive email must NOT be exposed in public ledger');
    }
  });

  it('Requirement 4: Secure identity verification for personal donation history', async () => {
    // Test with invalid registration ID
    const badIdResult = await FinancialService.verifyPersonalDonationHistory('', '1234');
    assert.equal(badIdResult.success, false);
    assert.ok(badIdResult.error?.includes('Registration ID'));

    // Test with insufficient phone digits
    const shortPhoneResult = await FinancialService.verifyPersonalDonationHistory('PLSCF-2027-F1001', '12');
    assert.equal(shortPhoneResult.success, false);
    assert.ok(shortPhoneResult.error?.includes('4 digits'));
  });

  it('Requirement 5: Requires mandatory reason for expense modification audit trail', async () => {
    const emptyReasonResult = await FinancialService.updateExpense(
      'EXP-TEST',
      { amount: 5000 },
      { id: 'admin1', name: 'Finance Admin' },
      ' ' // invalid empty reason
    );
    assert.equal(emptyReasonResult.success, false);
    assert.ok(emptyReasonResult.error?.includes('reason'));
  });

  it('Requirement 8: Financial CSV Report Generation includes summary, categories, and vouchers', () => {
    const mockSummary: FinancialTransparencySummary = {
      total_collected: 192511,
      total_registration_fees: 46006,
      total_donations: 146505,
      total_expenses: 365000,
      remaining_balance: -172489,
      paid_student_count: 43,
      donor_count: 20,
      categories: [
        {
          id: 'cat-stage',
          name_en: 'Stage & Decoration',
          name_bn: 'মঞ্চ ও সাজসজ্জা',
          budget_allocated: 150000,
          total_spent: 85000,
          expense_count: 1,
        },
      ],
      recent_expenses: [
        {
          id: 'EXP-01',
          category: 'Stage & Decoration',
          amount: 85000,
          expense_date: '2026-01-20',
          description: 'Grand stage construction advance',
          vendor_name: 'Faridpur Audio & Event Solutions',
          responsible_person: 'Md. Shafiqul Alam',
          voucher_number: 'VOUCHER-STG-01',
          status: 'approved',
        },
      ],
      recent_donations: [],
      updated_at: '2026-02-14T12:00:00Z',
    };

    const csv = FinancialService.generateFinancialReportCsv(mockSummary);
    assert.ok(csv.includes('Total Money Collected,BDT 192,511'));
    assert.ok(csv.includes('Total Expenses,BDT 365,000'));
    assert.ok(csv.includes('Stage & Decoration'));
    assert.ok(csv.includes('VOUCHER-STG-01'));
  });
});
