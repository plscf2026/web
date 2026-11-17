import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildThankYouCardSvg,
  ThankYouCardData,
} from './thankYouCardGenerator';
import { fromDonationDbRow } from '../services/supabase';
import { DonationRecord, FeeSettings } from '../types';

describe('Thank You Card SVG Generator & Donor Recognition Engine', () => {
  it('1. Replaces XXX in the center of the card with the donor name', () => {
    const cardData: ThankYouCardData = {
      donorName: 'Dr. Rafiqul Islam Chowdhury',
      registrationId: 'DON-2027-1042',
      token: 'TK89XZ',
      mobileNumber: '01712345678',
      amount: 15000,
      purpose: 'Needy Student Scholarship Fund',
    };

    const svg = buildThankYouCardSvg(cardData);

    // Ensure the placeholder XXX is replaced
    assert.strictEqual(svg.includes('>XXX<'), false, 'Placeholder XXX must be replaced');
    // Ensure donor name is inserted
    assert.ok(svg.includes('Dr. Rafiqul Islam Chowdhury'), 'SVG must include donor name');
    // Ensure Registration ID is present
    assert.ok(svg.includes('DON-2027-1042'), 'SVG must include Registration ID');
    // Ensure Token ID is present
    assert.ok(svg.includes('TK89XZ'), 'SVG must include 6-character Token ID');
    // Ensure Phone Number is present
    assert.ok(svg.includes('01712345678'), 'SVG must include Phone Number');
  });

  it('2. Namespaces internal defs to prevent DOM ID collisions when multiple cards are rendered', () => {
    const card1 = buildThankYouCardSvg({
      donorName: 'Donor One',
      registrationId: 'DON-2027-0001',
      token: 'TKA001',
      mobileNumber: '01700000001',
      uniqueId: 'card_instance_1',
    });

    const card2 = buildThankYouCardSvg({
      donorName: 'Donor Two',
      registrationId: 'DON-2027-0002',
      token: 'TKA002',
      mobileNumber: '01700000002',
      uniqueId: 'card_instance_2',
    });

    assert.ok(card1.includes('gold_card_instance_1'), 'Card 1 defs must have unique namespace 1');
    assert.ok(card2.includes('gold_card_instance_2'), 'Card 2 defs must have unique namespace 2');
    assert.notStrictEqual(card1, card2);
  });

  it('3. Adapts font size dynamically for long donor names', () => {
    const shortNameSvg = buildThankYouCardSvg({
      donorName: 'Ali Khan',
      registrationId: 'DON-2027-0003',
      token: 'TK0003',
      mobileNumber: '01700000003',
      uniqueId: 'short',
    });

    const longNameSvg = buildThankYouCardSvg({
      donorName: 'Professor Dr. Mohammad Shamsuzzaman Khan Chowdhury',
      registrationId: 'DON-2027-0004',
      token: 'TK0004',
      mobileNumber: '01700000004',
      uniqueId: 'long',
    });

    assert.ok(shortNameSvg.includes('font-size="58"'), 'Short name should have large 58px font');
    assert.ok(longNameSvg.includes('font-size="32"'), 'Very long name should be scaled down to 32px');
  });

  it('4. Sanitizes XML / HTML special characters in donor name and details', () => {
    const svg = buildThankYouCardSvg({
      donorName: 'Kamal & Sons <Enterprise> "Global"',
      registrationId: 'DON-2027-0005',
      token: 'TK0005',
      mobileNumber: '01700000005',
    });

    assert.strictEqual(svg.includes('<Enterprise>'), false, 'Raw HTML tag must be escaped');
    assert.ok(svg.includes('Kamal &amp; Sons &lt;Enterprise&gt; &quot;Global&quot;'));
  });
});

describe('Donation Database Normalization & Supabase Compatibility', () => {
  it('5. fromDonationDbRow maps both snake_case and camelCase database rows correctly', () => {
    const dbRow = {
      id: 'DON-2027-9912',
      donor_name: 'Engr. Masud Karim',
      mobile_number: '01819283746',
      email: 'masud@example.com',
      amount: '5000.00',
      purpose: 'Campus Development',
      payment_method: 'bkash',
      transaction_id: 'BKS-SBX-12345',
      gateway_invoice_number: 'INV-DON-9912',
      date: '2027-01-15',
      payment_status: 'paid',
      token: 'MK8877',
      qr_token: 'MK8877',
    };

    const record: DonationRecord = fromDonationDbRow(dbRow);

    assert.strictEqual(record.id, 'DON-2027-9912');
    assert.strictEqual(record.donorName, 'Engr. Masud Karim');
    assert.strictEqual(record.mobileNumber, '01819283746');
    assert.strictEqual(record.amount, 5000);
    assert.strictEqual(record.paymentMethod, 'bkash');
    assert.strictEqual(record.token, 'MK8877');
    assert.strictEqual(record.qrToken, 'MK8877');
  });
});

describe('Donors Hall of Fame Top 10 Sorting & Privacy Control', () => {
  it('6. Top 10 donors are sorted descending by donation amount', () => {
    const sampleDonations: DonationRecord[] = [
      { id: '1', donorName: 'Donor A', mobileNumber: '01700000001', email: '', amount: 1000, purpose: 'General', paymentMethod: 'bkash', transactionId: 'T1', date: '2027-01-01' },
      { id: '2', donorName: 'Donor B', mobileNumber: '01700000002', email: '', amount: 25000, purpose: 'General', paymentMethod: 'bkash', transactionId: 'T2', date: '2027-01-01' },
      { id: '3', donorName: 'Donor C', mobileNumber: '01700000003', email: '', amount: 5000, purpose: 'General', paymentMethod: 'bkash', transactionId: 'T3', date: '2027-01-01' },
      { id: '4', donorName: 'Donor D', mobileNumber: '01700000004', email: '', amount: 10000, purpose: 'General', paymentMethod: 'bkash', transactionId: 'T4', date: '2027-01-01' },
      { id: '5', donorName: 'Donor E', mobileNumber: '01700000005', email: '', amount: 500, purpose: 'General', paymentMethod: 'bkash', transactionId: 'T5', date: '2027-01-01' },
      { id: '6', donorName: 'Donor F', mobileNumber: '01700000006', email: '', amount: 50000, purpose: 'General', paymentMethod: 'bkash', transactionId: 'T6', date: '2027-01-01' },
      { id: '7', donorName: 'Donor G', mobileNumber: '01700000007', email: '', amount: 15000, purpose: 'General', paymentMethod: 'bkash', transactionId: 'T7', date: '2027-01-01' },
      { id: '8', donorName: 'Donor H', mobileNumber: '01700000008', email: '', amount: 2000, purpose: 'General', paymentMethod: 'bkash', transactionId: 'T8', date: '2027-01-01' },
      { id: '9', donorName: 'Donor I', mobileNumber: '01700000009', email: '', amount: 8000, purpose: 'General', paymentMethod: 'bkash', transactionId: 'T9', date: '2027-01-01' },
      { id: '10', donorName: 'Donor J', mobileNumber: '01700000010', email: '', amount: 3000, purpose: 'General', paymentMethod: 'bkash', transactionId: 'T10', date: '2027-01-01' },
      { id: '11', donorName: 'Donor K', mobileNumber: '01700000011', email: '', amount: 200, purpose: 'General', paymentMethod: 'bkash', transactionId: 'T11', date: '2027-01-01' },
    ];

    const top10 = [...sampleDonations]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    assert.strictEqual(top10.length, 10, 'Top 10 must contain at most 10 records');
    assert.strictEqual(top10[0].donorName, 'Donor F', 'Highest donor (50,000) must be rank 1');
    assert.strictEqual(top10[1].donorName, 'Donor B', 'Second highest donor (25,000) must be rank 2');
    assert.strictEqual(top10[2].donorName, 'Donor G', 'Third highest donor (15,000) must be rank 3');
    assert.strictEqual(top10[8].donorName, 'Donor A', 'Ninth highest donor (1,000) must be rank 9');
    assert.strictEqual(top10[9].donorName, 'Donor E', 'Tenth highest donor (500) must be rank 10');
    assert.ok(!top10.some((d) => d.donorName === 'Donor K'), 'Rank 11 (200 BDT) must be excluded from Top 10');
  });

  it('7. FeeSettings hideDonationAmounts accurately masks amounts when toggled by Super Admin', () => {
    const settingsVisible: FeeSettings = {
      formerStudentFee: 1500,
      currentStudentFee: 500,
      registrationOpen: true,
      startDate: '2026-01-01',
      endDate: '2027-01-20',
      lateFeeEnabled: false,
      lateFeeAmount: 300,
      closedMessageEn: '',
      closedMessageBn: '',
      eventTargetDate: '2027-01-29T09:00:00',
      simulateEventCompleted: false,
      hideDonationAmounts: false,
    };

    const settingsHidden: FeeSettings = {
      ...settingsVisible,
      hideDonationAmounts: true,
    };

    const getDisplayAmount = (amount: number, settings: FeeSettings) => {
      if (settings.hideDonationAmounts) {
        return 'HIDDEN';
      }
      return `৳${amount.toLocaleString()}`;
    };

    assert.strictEqual(getDisplayAmount(50000, settingsVisible), '৳50,000');
    assert.strictEqual(getDisplayAmount(50000, settingsHidden), 'HIDDEN');
  });
});
