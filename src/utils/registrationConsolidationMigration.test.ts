import test from 'node:test';
import assert from 'node:assert/strict';
import { getRegistrationsTableName } from '../services/supabase';
import { calculateFinancialSummary } from './rules';
import { RegistrationRecord, DonationRecord, ExpenseRecord } from '../types';
import * as fs from 'node:fs';
import * as path from 'node:path';

test('1. Registration Table Routing: Exclusively targets registrations_2027', () => {
  // Regardless of parameter, consolidated routing targets registrations_2027
  assert.equal(getRegistrationsTableName(), 'registrations_2027');
  assert.equal(getRegistrationsTableName(2027), 'registrations_2027');
  assert.equal(getRegistrationsTableName(2026), 'registrations_2027');
});

test('2. Financial Summary: Demo records do not inflate genuine revenue or attendee counts', () => {
  const genuineRecords: RegistrationRecord[] = [
    {
      id: 'PLSCF-2027-F1001',
      fullName: 'Genuine Alumnus 1',
      photoUrl: 'https://example.com/p1.jpg',
      mobileNumber: '01711000001',
      address: 'Faridpur',
      category: 'former',
      batchName: 'SSC 2000',
      tShirtSize: 'XL',
      registrationFee: 1500,
      donationAmount: 500,
      totalPaid: 2000,
      paymentStatus: 'paid',
      transactionId: 'TX1001',
      paymentMethod: 'bkash',
      registeredAt: '2027-01-01T10:00:00Z',
      qrToken: 'TK0001',
      isTShirtCollected: false,
      year: 2027,
      isDemo: false,
    },
    {
      id: 'PLSCF-2027-C1002',
      fullName: 'Genuine Current Student 2',
      photoUrl: 'https://example.com/p2.jpg',
      mobileNumber: '01711000002',
      address: 'Faridpur',
      category: 'current',
      studentId: 'STU-002',
      batchName: 'Class 10',
      tShirtSize: 'M',
      registrationFee: 500,
      donationAmount: 0,
      totalPaid: 500,
      paymentStatus: 'paid',
      transactionId: 'TX1002',
      paymentMethod: 'nagad',
      registeredAt: '2027-01-02T10:00:00Z',
      qrToken: 'TK0002',
      isTShirtCollected: false,
      year: 2027,
      isDemo: false,
    },
  ];

  const demoRecords: RegistrationRecord[] = [
    {
      id: 'PLSCF-2026-F1001',
      fullName: 'Demo Alumnus',
      photoUrl: 'https://example.com/demo.jpg',
      mobileNumber: '01711223344',
      address: 'Faridpur',
      category: 'former',
      batchName: 'SSC 1998',
      tShirtSize: 'XL',
      registrationFee: 1500,
      donationAmount: 10000, // Inflated demo donation
      totalPaid: 11500,
      paymentStatus: 'paid',
      transactionId: 'DEMO-TRX-1',
      paymentMethod: 'bkash',
      registeredAt: '2026-01-16T10:30:00Z',
      qrToken: 'A7K9M2',
      isTShirtCollected: false,
      year: 2026,
      isDemo: true, // Tagged as demo
      isLegacy: true,
    },
  ];

  const donations: DonationRecord[] = [];
  const expenses: ExpenseRecord[] = [];

  const combined = [...genuineRecords, ...demoRecords];

  // Default financial summary excludes demo records
  const summary = calculateFinancialSummary(combined, donations, expenses);

  assert.equal(summary.paidRegistrationsCount, 2, 'Only 2 genuine paid registrations should be counted');
  assert.equal(summary.formerStudentsCount, 1, 'Only 1 genuine former student counted');
  assert.equal(summary.currentStudentsCount, 1, 'Only 1 genuine current student counted');
  assert.equal(summary.totalRegistrationRevenue, 2000, 'Revenue: 1500 + 500 = 2000 BDT');
  assert.equal(summary.totalDonations, 500, 'Donations: 500 BDT from genuine student');
  assert.equal(summary.totalIncome, 2500, 'Total income: 2000 + 500 = 2500 BDT (Demo 10000 BDT excluded)');
});

test('3. Migration Script Integrity: Verifies consolidation migration file exists and is valid', () => {
  const migrationPath = path.resolve(
    process.cwd(),
    'supabase/migrations/20270106000000_consolidate_registrations_2027_and_drop_2026.sql'
  );
  assert.ok(fs.existsSync(migrationPath), 'Consolidation migration file must exist');

  const content = fs.readFileSync(migrationPath, 'utf-8');

  // Verify backup table creation
  assert.ok(
    content.includes('backup_registrations_2026_pre_consolidation'),
    'Must create backup_registrations_2026_pre_consolidation'
  );
  assert.ok(
    content.includes('backup_registrations_2027_pre_consolidation'),
    'Must create backup_registrations_2027_pre_consolidation'
  );

  // Verify metadata tracking columns
  assert.ok(content.includes('ADD COLUMN IF NOT EXISTS is_demo'), 'Must add is_demo column');
  assert.ok(content.includes('ADD COLUMN IF NOT EXISTS is_legacy'), 'Must add is_legacy column');
  assert.ok(content.includes('ADD COLUMN IF NOT EXISTS migration_source'), 'Must add migration_source');

  // Verify safe data copy into registrations_2027
  assert.ok(content.includes('INSERT INTO public.registrations_2027'), 'Must insert into registrations_2027');

  // Verify rpc_verify_payment updated to use single table
  assert.ok(content.includes('CREATE OR REPLACE FUNCTION public.rpc_verify_payment'), 'Must update rpc_verify_payment');

  // Verify DROP TABLE registrations_2026
  assert.ok(content.includes('DROP TABLE public.registrations_2026 RESTRICT'), 'Must drop registrations_2026');
});

test('4. Backup Files Verification: Independent backup archives exist on disk', () => {
  const backupSqlPath = path.resolve(
    process.cwd(),
    'supabase/backups/registrations_2026_pre_consolidation_backup.sql'
  );
  const backupJsonPath = path.resolve(
    process.cwd(),
    'supabase/backups/registrations_2026_records.json'
  );

  assert.ok(fs.existsSync(backupSqlPath), 'Standalone SQL backup must exist');
  assert.ok(fs.existsSync(backupJsonPath), 'Independent JSON records backup must exist');

  const jsonContent = JSON.parse(fs.readFileSync(backupJsonPath, 'utf-8'));
  assert.ok(Array.isArray(jsonContent) && jsonContent.length >= 4, 'Backup JSON must contain valid records array');
});
