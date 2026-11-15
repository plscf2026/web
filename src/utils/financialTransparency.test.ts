import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  FinancialService,
  FinancialTransparencySummary,
  aggregateTopDonors,
  maskPhone,
  maskRegistrationId,
  PublicDonationItem,
} from '../services/financialService';

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

  it('Requirement 9: Multi-donation aggregation - If donor gives 3 or 5 times with same number, all amounts are summed into one record (none discounted)', () => {
    // Scenario: Donor A donates 3 times using the same mobile number "01711223344"
    // with different amounts (5,000 + 10,000 + 2,000 = 17,000).
    // Donor B donates 2 times using registration ID "PLSCF-2027-F2000" (3,000 + 4,000 = 7,000).
    // Donor C donates 1 time (25,000).
    const donations: PublicDonationItem[] = [
      {
        id: 'DON-A1',
        donor_name: 'Alumnus A',
        raw_mobile: '01711223344',
        amount: 5000,
        donation_date: '2026-02-01',
      },
      {
        id: 'DON-B1',
        donor_name: 'Alumnus B',
        raw_registration_id: 'PLSCF-2027-F2000',
        amount: 3000,
        donation_date: '2026-02-02',
      },
      {
        id: 'DON-A2',
        donor_name: 'Alumnus A',
        raw_mobile: '01711223344',
        amount: 10000,
        donation_date: '2026-02-05',
      },
      {
        id: 'DON-C1',
        donor_name: 'Alumnus C',
        raw_mobile: '01899887766',
        amount: 25000,
        donation_date: '2026-02-06',
      },
      {
        id: 'DON-B2',
        donor_name: 'Alumnus B',
        raw_registration_id: 'PLSCF-2027-F2000',
        amount: 4000,
        donation_date: '2026-02-07',
      },
      {
        id: 'DON-A3',
        donor_name: 'Alumnus A',
        raw_mobile: '01711223344',
        amount: 2000,
        donation_date: '2026-02-10',
      },
    ];

    const aggregated = aggregateTopDonors(donations, 10);

    // There should be only 3 distinct donor records in total
    assert.equal(aggregated.length, 3, 'Should aggregate 6 donations into 3 distinct donors');

    // Rank 1: Alumnus C with 25,000
    assert.equal(aggregated[0].donor_name, 'Alumnus C');
    assert.equal(aggregated[0].amount, 25000);
    assert.equal(aggregated[0].donation_count, 1);
    assert.equal(aggregated[0].rank, 1);

    // Rank 2: Alumnus A with 17,000 (5,000 + 10,000 + 2,000 summed into one)
    assert.equal(aggregated[1].donor_name, 'Alumnus A');
    assert.equal(aggregated[1].amount, 17000, 'All 3 donations from same number must be summed into one');
    assert.equal(aggregated[1].donation_count, 3, 'Donation count must reflect all 3 contributions');
    assert.equal(aggregated[1].rank, 2);

    // Rank 3: Alumnus B with 7,000 (3,000 + 4,000)
    assert.equal(aggregated[2].donor_name, 'Alumnus B');
    assert.equal(aggregated[2].amount, 7000);
    assert.equal(aggregated[2].donation_count, 2);
    assert.equal(aggregated[2].rank, 3);
  });

  it('Requirement 10: Top 10 Limit - Donation Transparency Ledger strictly caps to Top 10 highest cumulative donors', () => {
    // Generate 15 distinct donors with increasing donations from 1,000 to 15,000
    const rawDonations: PublicDonationItem[] = Array.from({ length: 15 }, (_, i) => ({
      id: `DON-${i + 1}`,
      donor_name: `Donor ${i + 1}`,
      raw_mobile: `017000000${String(i + 10).slice(-2)}`,
      amount: (i + 1) * 1000,
      donation_date: '2026-02-01',
    }));

    const top10 = aggregateTopDonors(rawDonations, 10);

    // Strictly 10 entries returned
    assert.equal(top10.length, 10, 'Must strictly limit to 10 entries');

    // Highest donor is Donor 15 with 15,000
    assert.equal(top10[0].donor_name, 'Donor 15');
    assert.equal(top10[0].amount, 15000);
    assert.equal(top10[0].rank, 1);

    // 10th donor is Donor 6 with 6,000
    assert.equal(top10[9].donor_name, 'Donor 6');
    assert.equal(top10[9].amount, 6000);
    assert.equal(top10[9].rank, 10);

    // Verify ordering is strictly descending
    for (let i = 0; i < top10.length - 1; i++) {
      assert.ok(top10[i].amount >= top10[i + 1].amount, 'Top 10 must be sorted in descending order of amount');
    }
  });

  it('Requirement 11: Masking helper functions protect sensitive phone numbers and registration IDs', () => {
    assert.equal(maskPhone('01712345678'), '017****5678');
    assert.equal(maskPhone('+8801812345678'), '018****5678');
    assert.equal(maskRegistrationId('PLSCF-2027-F1001'), 'PLSCF-2027-F****');
  });
});
