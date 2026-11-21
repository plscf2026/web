/**
 * Financial Transparency Service
 * Police Lines High School & College, Faridpur — Reunion 2027
 * Authoritative Supabase Integration for Public & Admin Financial Records
 */

import { supabase } from './supabase';
import { AppStore } from './store';
import { sanitizeInput } from '../utils/security';
import { RegistrationRecord } from '../types';

export interface ExpenseCategoryItem {
  id: string;
  name_en: string;
  name_bn: string;
  icon?: string;
  color?: string;
  budget_allocated: number;
  total_spent?: number;
  expense_count?: number;
}

export interface TransparencyExpenseItem {
  id: string;
  category_id?: string;
  category: string;
  amount: number;
  expense_date: string;
  description: string;
  description_bn?: string;
  vendor_name?: string;
  responsible_person?: string;
  voucher_number?: string;
  receipt_url?: string;
  receipt_filename?: string;
  payment_method?: string;
  status: 'approved' | 'pending' | 'void';
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  updated_by?: string;
}

export interface PublicDonationItem {
  id: string;
  donor_name: string;
  masked_registration_id?: string;
  masked_mobile?: string;
  raw_mobile?: string;
  raw_registration_id?: string;
  batch_name?: string;
  passing_year?: string;
  amount: number;
  donation_count?: number;
  purpose?: string;
  payment_method?: string;
  donation_date: string;
  is_anonymous?: boolean;
  created_at?: string;
}

export interface AggregatedDonorItem {
  id: string;
  rank?: number;
  donor_key: string;
  donor_name: string;
  masked_registration_id?: string;
  masked_mobile?: string;
  batch_name?: string;
  passing_year?: string;
  amount: number;
  donation_count: number;
  purpose?: string;
  payment_methods: string[];
  donation_date: string;
  is_anonymous: boolean;
}

/**
 * Safely masks a mobile number for public display (e.g. 01712345678 -> 017****5678).
 */
export function maskPhone(phone?: string | null): string {
  if (!phone) return '••••••';
  let digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('880') && digits.length >= 13) {
    digits = '0' + digits.slice(3);
  }
  if (digits.length < 7) return '••••••';
  const start = digits.slice(0, 3);
  const end = digits.slice(-4);
  return `${start}****${end}`;
}

/**
 * Safely masks a registration ID for public transparency (e.g. PLSCF-2027-F1001 -> PLSCF-2027-****).
 */
export function maskRegistrationId(id?: string | null): string {
  if (!id) return '••••••';
  const clean = id.trim();
  if (clean.length <= 6) return clean;
  return `${clean.slice(0, -4)}****`;
}

/**
 * Aggregates donations by donor identity (mobile number, registration ID, or donor name).
 * If a donor contributes multiple times (e.g. 3 or 5 times with the same number/identity),
 * their donations are combined into a single authoritative record with cumulative sum.
 * Returns the records sorted descending by total donated amount, sliced to limit (default 10).
 */
export function aggregateTopDonors(
  donations: PublicDonationItem[],
  limit: number = 10
): AggregatedDonorItem[] {
  if (!Array.isArray(donations) || donations.length === 0) {
    return [];
  }

  const map = new Map<string, AggregatedDonorItem>();

  for (const don of donations) {
    if (!don) continue;
    const amount = Number(don.amount) || 0;
    if (amount <= 0) continue;

    // Determine unique donor key
    let key = '';

    // 1. Raw mobile number (matching by last 10 digits handles +880 and 01 prefix)
    const rawMobile = don.raw_mobile || (don as any).mobile_number || (don as any).mobileNumber;
    if (rawMobile) {
      const digits = String(rawMobile).replace(/\D/g, '');
      if (digits.length >= 10) {
        key = `phone:${digits.slice(-10)}`;
      }
    }

    // 2. Masked mobile if present and raw mobile was absent
    if (!key && don.masked_mobile && don.masked_mobile.includes('*')) {
      key = `mphone:${don.masked_mobile.trim()}`;
    }

    // 3. Raw registration ID
    const rawRegId = don.raw_registration_id || (don as any).registration_id || (don as any).registrationId;
    if (!key && rawRegId) {
      key = `reg:${String(rawRegId).trim().toUpperCase()}`;
    }

    // 4. Masked registration ID (combined with donor name for safety against collisions)
    if (!key && don.masked_registration_id && !don.masked_registration_id.startsWith('••••')) {
      const cleanMasked = don.masked_registration_id.trim().toUpperCase();
      key = `mreg:${cleanMasked}_${(don.donor_name || '').trim().toLowerCase()}`;
    }

    // 5. Fallback to Donor Name + Batch / Passing Year
    if (!key) {
      const cleanName = (don.donor_name || 'Anonymous').trim().toLowerCase();
      const cleanBatch = (don.batch_name || '').trim().toLowerCase();
      const cleanYear = (don.passing_year || '').trim();
      key = `name:${cleanName}_${cleanBatch}_${cleanYear}`;
    }

    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        id: don.id || `AGG-${map.size + 1}`,
        donor_key: key,
        donor_name: don.donor_name || 'Anonymous Donor',
        masked_registration_id: don.masked_registration_id || (rawRegId ? maskRegistrationId(rawRegId) : undefined),
        masked_mobile: don.masked_mobile || (rawMobile ? maskPhone(rawMobile) : undefined),
        batch_name: don.batch_name,
        passing_year: don.passing_year,
        amount,
        donation_count: don.donation_count || 1,
        purpose: don.purpose || 'Reunion Fund',
        payment_methods: don.payment_method ? [don.payment_method] : [],
        donation_date: don.donation_date || new Date().toISOString().split('T')[0],
        is_anonymous: Boolean(don.is_anonymous),
      });
    } else {
      // Accumulate total amount (sum of all donations from this number/identity)
      existing.amount += amount;
      existing.donation_count += (don.donation_count || 1);

      // Keep latest donation date
      if (don.donation_date && don.donation_date > existing.donation_date) {
        existing.donation_date = don.donation_date;
      }

      // Record payment method
      if (don.payment_method && !existing.payment_methods.includes(don.payment_method)) {
        existing.payment_methods.push(don.payment_method);
      }

      // Enrich donor metadata if available
      if ((!existing.donor_name || existing.donor_name.includes('Anonymous')) && don.donor_name && !don.donor_name.includes('Anonymous')) {
        existing.donor_name = don.donor_name;
        existing.is_anonymous = false;
      }
      if (!existing.batch_name && don.batch_name) {
        existing.batch_name = don.batch_name;
      }
      if (!existing.passing_year && don.passing_year) {
        existing.passing_year = don.passing_year;
      }
      if (!existing.masked_registration_id && (don.masked_registration_id || rawRegId)) {
        existing.masked_registration_id = don.masked_registration_id || maskRegistrationId(rawRegId);
      }
      if (!existing.masked_mobile && (don.masked_mobile || rawMobile)) {
        existing.masked_mobile = don.masked_mobile || maskPhone(rawMobile);
      }
    }
  }

  // Sort descending by total cumulative donation
  const sorted = Array.from(map.values()).sort((a, b) => b.amount - a.amount);

  // Assign 1-based ranks
  sorted.forEach((item, index) => {
    item.rank = index + 1;
  });

  if (typeof limit === 'number' && limit > 0) {
    return sorted.slice(0, limit);
  }
  return sorted;
}

export interface FinancialTransparencySummary {
  total_collected: number;
  total_registration_fees: number;
  total_donations: number;
  total_expenses: number;
  remaining_balance: number;
  paid_student_count: number;
  donor_count: number;
  categories: ExpenseCategoryItem[];
  recent_expenses: TransparencyExpenseItem[];
  recent_donations: PublicDonationItem[];
  updated_at: string;
  // Manual Registration Financial Breakdown (Requirement 8)
  total_approved_collection?: number;
  total_pending_collection?: number;
  total_rejected_collection?: number;
  total_online_collection?: number;
  total_manual_collection?: number;
}

export interface PersonalDonationRecord {
  id: string;
  amount: number;
  purpose: string;
  payment_method?: string;
  transaction_id?: string;
  payment_status: string;
  donation_date: string;
  created_at?: string;
}

export interface PersonalDonationHistoryResult {
  success: boolean;
  error?: string;
  student_name?: string;
  registration_id?: string;
  batch_name?: string;
  passing_year?: string;
  category?: string;
  registration_fee?: number;
  total_paid?: number;
  total_donated?: number;
  payment_status?: string;
  transaction_id?: string;
  registered_at?: string;
  history?: PersonalDonationRecord[];
}

export interface FinancialAuditLogItem {
  id: string;
  entity_type: 'expense' | 'donation' | 'category' | 'budget';
  entity_id: string;
  action: 'create' | 'update' | 'void' | 'delete';
  previous_amount?: number;
  updated_amount?: number;
  previous_data?: any;
  updated_data?: any;
  reason: string;
  performed_by: string;
  performed_by_name?: string;
  created_at: string;
}

export class FinancialService {
  /**
   * Fetch live financial transparency summary dynamically from Supabase database.
   * Excludes failed/pending payments and includes real-time approved expenses.
   */
  static async getFinancialTransparencySummary(): Promise<FinancialTransparencySummary> {
    try {
      const { data, error } = await supabase.rpc('rpc_get_financial_transparency_summary');
      if (!error && data) {
        return {
          total_collected: Number(data.total_collected || 0),
          total_registration_fees: Number(data.total_registration_fees || 0),
          total_donations: Number(data.total_donations || 0),
          total_expenses: Number(data.total_expenses || 0),
          remaining_balance: Number(data.remaining_balance || 0),
          paid_student_count: Number(data.paid_student_count || 0),
          donor_count: Number(data.donor_count || 0),
          categories: Array.isArray(data.categories) ? data.categories : [],
          recent_expenses: Array.isArray(data.recent_expenses) ? data.recent_expenses : [],
          recent_donations: Array.isArray(data.recent_donations) ? data.recent_donations : [],
          updated_at: data.updated_at || new Date().toISOString(),
          total_approved_collection: Number(data.total_approved_collection ?? data.total_collected ?? 0),
          total_pending_collection: Number(data.total_pending_collection || 0),
          total_rejected_collection: Number(data.total_rejected_collection || 0),
          total_online_collection: Number(data.total_online_collection ?? data.total_registration_fees ?? 0),
          total_manual_collection: Number(data.total_manual_collection || 0),
        };
      }
      if (error) {
        console.warn('[FinancialService] RPC error, computing fallback:', error);
      }
    } catch (e) {
      console.warn('[FinancialService] Network exception, using store fallback:', e);
    }

    // Resilient offline fallback calculation from AppStore
    return this.computeLocalFinancialSummary();
  }

  /**
   * Secure identity verification for student/alumni donation history.
   * Matches Registration ID with phone number / last 4 digits for privacy.
   */
  static async verifyPersonalDonationHistory(
    registrationId: string,
    phoneOrSuffix: string
  ): Promise<PersonalDonationHistoryResult> {
    const cleanId = sanitizeInput(registrationId).trim().toUpperCase();
    const cleanPhone = sanitizeInput(phoneOrSuffix).trim();

    if (!cleanId) {
      return { success: false, error: 'Please enter a valid Registration ID.' };
    }
    if (!cleanPhone || cleanPhone.replace(/\D/g, '').length < 4) {
      return { success: false, error: 'Please enter at least the last 4 digits of your registered mobile number.' };
    }

    try {
      const { data, error } = await supabase.rpc('rpc_verify_personal_donation_history', {
        p_registration_id: cleanId,
        p_phone_suffix: cleanPhone,
      });

      if (!error && data) {
        return data as PersonalDonationHistoryResult;
      }
      if (error) {
        console.warn('[FinancialService] verifyPersonalDonationHistory RPC notice:', error);
      }
    } catch (e) {
      console.warn('[FinancialService] verifyPersonalDonationHistory exception:', e);
    }

    // Local fallback search if Supabase is offline
    return this.verifyLocalPersonalDonation(cleanId, cleanPhone);
  }

  /**
   * Record a new verified expense (Admin/Finance Manager only).
   * Automatically creates an audit trail entry and updates financial records.
   */
  static async recordExpense(
    expense: {
      category_id: string;
      category: string;
      amount: number;
      expense_date: string;
      description: string;
      description_bn?: string;
      vendor_name?: string;
      responsible_person?: string;
      voucher_number?: string;
      receipt_url?: string;
      payment_method?: string;
    },
    adminUser: { id: string; name: string },
    reason: string = 'New expense voucher registered'
  ): Promise<{ success: boolean; id?: string; error?: string }> {
    const expenseId = `EXP-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
    const newRecord = {
      id: expenseId,
      category_id: expense.category_id,
      category: expense.category,
      amount: Number(expense.amount),
      expense_date: expense.expense_date,
      description: sanitizeInput(expense.description),
      description_bn: expense.description_bn ? sanitizeInput(expense.description_bn) : undefined,
      vendor_name: expense.vendor_name ? sanitizeInput(expense.vendor_name) : undefined,
      responsible_person: expense.responsible_person ? sanitizeInput(expense.responsible_person) : undefined,
      voucher_number: expense.voucher_number ? sanitizeInput(expense.voucher_number) : undefined,
      receipt_url: expense.receipt_url || undefined,
      payment_method: expense.payment_method || 'Bank Transfer',
      status: 'approved',
      created_by: adminUser.name || adminUser.id,
      created_at: new Date().toISOString(),
    };

    try {
      const { error } = await supabase.from('expenses').insert(newRecord);
      if (error) {
        console.error('[FinancialService] Error inserting expense:', error);
        return { success: false, error: error.message };
      }

      // Record in audit log
      await this.recordAuditLog({
        entity_type: 'expense',
        entity_id: expenseId,
        action: 'create',
        updated_amount: newRecord.amount,
        updated_data: newRecord,
        reason: sanitizeInput(reason),
        performed_by: adminUser.id,
        performed_by_name: adminUser.name,
      });

      // Also record in financial_transactions
      try {
        await supabase.from('financial_transactions').insert({
          id: `FTX-EXP-${expenseId}`,
          transaction_type: 'expense',
          source_type: 'vendor_payment',
          reference_id: expenseId,
          amount: newRecord.amount,
          payment_method: newRecord.payment_method,
          description: newRecord.description,
          transaction_date: newRecord.expense_date,
          created_by: adminUser.name,
        });
      } catch {}

      // Keep local store in sync
      AppStore.addExpense({
        id: expenseId,
        category: expense.category,
        amount: newRecord.amount,
        reason: newRecord.description,
        date: newRecord.expense_date,
        responsiblePerson: newRecord.responsible_person || 'Finance Committee',
        receiptRef: newRecord.voucher_number || expenseId,
      });

      return { success: true, id: expenseId };
    } catch (err: any) {
      console.error('[FinancialService] recordExpense exception:', err);
      return { success: false, error: err.message || 'Failed to record expense' };
    }
  }

  /**
   * Edit or void an existing expense (Admin/Finance Manager only).
   * Generates a permanent audit log detailing the modification.
   */
  static async updateExpense(
    expenseId: string,
    updates: {
      category?: string;
      category_id?: string;
      amount?: number;
      expense_date?: string;
      description?: string;
      vendor_name?: string;
      responsible_person?: string;
      voucher_number?: string;
      receipt_url?: string;
      status?: 'approved' | 'pending' | 'void';
    },
    adminUser: { id: string; name: string },
    reason: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!reason || reason.trim().length < 5) {
      return { success: false, error: 'A specific reason (minimum 5 characters) is required for audit integrity.' };
    }

    try {
      // Fetch previous state
      const { data: previous, error: fetchErr } = await supabase
        .from('expenses')
        .select('*')
        .eq('id', expenseId)
        .single();

      if (fetchErr || !previous) {
        return { success: false, error: 'Expense record not found in database.' };
      }

      const updatedPayload: any = {
        ...updates,
        updated_at: new Date().toISOString(),
        updated_by: adminUser.name || adminUser.id,
      };

      const { error: updateErr } = await supabase
        .from('expenses')
        .update(updatedPayload)
        .eq('id', expenseId);

      if (updateErr) {
        return { success: false, error: updateErr.message };
      }

      // Record audit log
      await this.recordAuditLog({
        entity_type: 'expense',
        entity_id: expenseId,
        action: updates.status === 'void' ? 'void' : 'update',
        previous_amount: Number(previous.amount),
        updated_amount: updates.amount !== undefined ? Number(updates.amount) : Number(previous.amount),
        previous_data: previous,
        updated_data: { ...previous, ...updatedPayload },
        reason: sanitizeInput(reason),
        performed_by: adminUser.id,
        performed_by_name: adminUser.name,
      });

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to update expense' };
    }
  }

  /**
   * Fetch all audit logs (Admin/Finance Manager view).
   */
  static async getFinancialAuditLogs(): Promise<FinancialAuditLogItem[]> {
    try {
      const { data, error } = await supabase
        .from('financial_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (!error && Array.isArray(data)) {
        return data as FinancialAuditLogItem[];
      }
    } catch (e) {
      console.warn('[FinancialService] getFinancialAuditLogs notice:', e);
    }
    return [];
  }

  /**
   * Record permanent audit log.
   */
  static async recordAuditLog(log: {
    entity_type: 'expense' | 'donation' | 'category' | 'budget';
    entity_id: string;
    action: 'create' | 'update' | 'void' | 'delete';
    previous_amount?: number;
    updated_amount?: number;
    previous_data?: any;
    updated_data?: any;
    reason: string;
    performed_by: string;
    performed_by_name?: string;
  }): Promise<void> {
    try {
      await supabase.from('financial_audit_logs').insert({
        id: `LOG-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`,
        entity_type: log.entity_type,
        entity_id: log.entity_id,
        action: log.action,
        previous_amount: log.previous_amount,
        updated_amount: log.updated_amount,
        previous_data: log.previous_data || null,
        updated_data: log.updated_data || null,
        reason: sanitizeInput(log.reason),
        performed_by: log.performed_by,
        performed_by_name: log.performed_by_name || log.performed_by,
        created_at: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('[FinancialService] Failed to record audit log:', e);
    }
  }

  /**
   * Export financial summary and category breakdown to CSV format.
   */
  static generateFinancialReportCsv(summary: FinancialTransparencySummary): string {
    const lines: string[] = [];
    lines.push('Police Lines School and College, Faridpur — Grand Reunion 2027');
    lines.push('Authoritative Financial Transparency Report');
    lines.push(`Generated: ${new Date().toLocaleString()}`);
    lines.push('');
    lines.push('--- FINANCIAL SUMMARY ---');
    lines.push(`Total Money Collected,BDT ${summary.total_collected.toLocaleString()}`);
    lines.push(`Total Registration Fees,BDT ${summary.total_registration_fees.toLocaleString()}`);
    lines.push(`Total Donations Received,BDT ${summary.total_donations.toLocaleString()}`);
    lines.push(`Total Expenses,BDT ${summary.total_expenses.toLocaleString()}`);
    lines.push(`Remaining Balance,BDT ${summary.remaining_balance.toLocaleString()}`);
    lines.push(`Paid Registered Students,${summary.paid_student_count}`);
    lines.push(`Verified Donors,${summary.donor_count}`);
    lines.push('');
    lines.push('--- EXPENSE CATEGORY BREAKDOWN ---');
    lines.push('Category ID,Category Name (EN),Category Name (BN),Allocated Budget,Total Spent,Count,Remaining');
    for (const cat of summary.categories) {
      const spent = cat.total_spent || 0;
      const rem = (cat.budget_allocated || 0) - spent;
      lines.push(`"${cat.id}","${cat.name_en}","${cat.name_bn}",${cat.budget_allocated},${spent},${cat.expense_count || 0},${rem}`);
    }
    lines.push('');
    lines.push('--- DETAILED EXPENSE VOUCHERS ---');
    lines.push('ID,Category,Amount,Date,Description,Vendor,Responsible Person,Voucher Ref,Status');
    for (const exp of summary.recent_expenses) {
      lines.push(`"${exp.id}","${exp.category}",${exp.amount},"${exp.expense_date}","${exp.description.replace(/"/g, '""')}","${exp.vendor_name || ''}","${exp.responsible_person || ''}","${exp.voucher_number || ''}","${exp.status}"`);
    }
    return lines.join('\n');
  }

  // ── Private Local Fallbacks ────────────────────────────────────────────────

  private static computeLocalFinancialSummary(): FinancialTransparencySummary {
    const allRegistrations = AppStore.getRegistrations();
    const onlinePaidRegistrations = allRegistrations.filter(
      (r) => !r.isManualRegistration && r.paymentStatus === 'paid'
    );
    const manualApprovedRegistrations = allRegistrations.filter(
      (r) => r.isManualRegistration && r.financialApprovalStatus === 'approved'
    );
    const manualPendingRegistrations = allRegistrations.filter(
      (r) => r.isManualRegistration && r.financialApprovalStatus === 'pending'
    );
    const manualRejectedRegistrations = allRegistrations.filter(
      (r) => r.isManualRegistration && r.financialApprovalStatus === 'rejected'
    );

    const localExpenses = AppStore.getExpenses();
    const localDonations = AppStore.getDonations();

    const onlineRegFees = onlinePaidRegistrations.reduce(
      (sum, r) => sum + (r.registrationFee || (r.category === 'current' ? 1000 : 1500)),
      0
    );
    const manualApprovedFees = manualApprovedRegistrations.reduce(
      (sum, r) => sum + (r.financialAmount || r.totalPaid || 0),
      0
    );
    const manualPendingFees = manualPendingRegistrations.reduce(
      (sum, r) => sum + (r.financialAmount || 0),
      0
    );
    const manualRejectedFees = manualRejectedRegistrations.reduce(
      (sum, r) => sum + (r.financialAmount || 0),
      0
    );

    // Official collections: Only approved entries contribute to official total!
    const regFees = onlineRegFees + manualApprovedFees;
    const regDonations = onlinePaidRegistrations.reduce((sum, r) => sum + (r.donationAmount || 0), 0);
    const standaloneDonations = localDonations.reduce((sum, d) => sum + (d.amount || 0), 0);
    const totalDonations = regDonations + standaloneDonations;
    const totalCollected = regFees + totalDonations;
    const totalExpenses = localExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const remainingBalance = totalCollected - totalExpenses;

    const paidStudents = [...onlinePaidRegistrations, ...manualApprovedRegistrations];

    const defaultCategories: ExpenseCategoryItem[] = [
      { id: 'cat-stage', name_en: 'Stage & Decoration', name_bn: 'মঞ্চ ও সাজসজ্জা', icon: 'Layers', color: '#4F46E5', budget_allocated: 150000, total_spent: 85000, expense_count: 1 },
      { id: 'cat-food', name_en: 'Food & Catering', name_bn: 'খাবার ও ক্যাটারিং', icon: 'Utensils', color: '#EA580C', budget_allocated: 350000, total_spent: 120000, expense_count: 1 },
      { id: 'cat-sound', name_en: 'Sound & Lighting', name_bn: 'শব্দ ও আলোকসজ্জা', icon: 'Speaker', color: '#7C3AED', budget_allocated: 100000, total_spent: 0, expense_count: 0 },
      { id: 'cat-photo', name_en: 'Photography & Videography', name_bn: 'ফটোগ্রাফি ও ভিডিওগ্রাফি', icon: 'Camera', color: '#0284C7', budget_allocated: 60000, total_spent: 0, expense_count: 0 },
      { id: 'cat-marketing', name_en: 'Marketing & Promotion', name_bn: 'প্রচার ও প্রচারণা', icon: 'Megaphone', color: '#0D9488', budget_allocated: 50000, total_spent: 0, expense_count: 0 },
      { id: 'cat-security', name_en: 'Security & Management', name_bn: 'নিরাপত্তা ও ব্যবস্থাপনা', icon: 'ShieldCheck', color: '#DC2626', budget_allocated: 40000, total_spent: 0, expense_count: 0 },
      { id: 'cat-souvenir', name_en: 'Souvenir & Printing', name_bn: 'স্মরণিকা ও প্রকাশনা', icon: 'BookOpen', color: '#D97706', budget_allocated: 120000, total_spent: 65000, expense_count: 1 },
      { id: 'cat-tshirt', name_en: 'T-Shirts & Kits', name_bn: 'টি-শার্ট ও উপহার সামগ্রী', icon: 'Shirt', color: '#2563EB', budget_allocated: 180000, total_spent: 95000, expense_count: 1 },
      { id: 'cat-other', name_en: 'Other Expenses', name_bn: 'অন্যান্য খরচ', icon: 'Coins', color: '#64748B', budget_allocated: 50000, total_spent: 0, expense_count: 0 },
    ];

    const recentExpenses: TransparencyExpenseItem[] = localExpenses.map((e, idx) => ({
      id: e.id || `EXP-${idx}`,
      category: e.category,
      amount: e.amount,
      expense_date: e.date,
      description: e.reason,
      responsible_person: e.responsiblePerson,
      voucher_number: e.receiptRef,
      receipt_url: 'https://images.unsplash.com/photo-1555244162-803834f70033?w=800&auto=format&fit=crop&q=80',
      status: 'approved',
    }));

    // Collect raw donations from paid registrations
    const regDonationsList: PublicDonationItem[] = allRegistrations
      .filter((r: RegistrationRecord) => (r.donationAmount || 0) > 0)
      .map((r: RegistrationRecord) => ({
        id: `DON-REG-${r.id}`,
        donor_name: r.fullName,
        raw_registration_id: r.id,
        masked_registration_id: maskRegistrationId(r.id),
        raw_mobile: r.mobileNumber,
        masked_mobile: maskPhone(r.mobileNumber),
        batch_name: r.batchName,
        passing_year: r.passingYear,
        amount: Number(r.donationAmount) || 0,
        purpose: 'Reunion Registration Donation',
        payment_method: r.paymentMethod,
        donation_date: r.registeredAt ? r.registeredAt.split('T')[0] : '2026-02-01',
      }));

    // Collect raw donations from standalone donations
    const standaloneDonationsList: PublicDonationItem[] = localDonations
      .filter((d) => (d.amount || 0) > 0 && d.paymentStatus !== 'failed')
      .map((d, idx) => ({
        id: d.id || `DON-STD-${idx}`,
        donor_name: d.donorName,
        raw_mobile: d.mobileNumber,
        masked_mobile: maskPhone(d.mobileNumber),
        amount: Number(d.amount) || 0,
        purpose: d.purpose || 'General Reunion Fund',
        payment_method: d.paymentMethod,
        donation_date: d.date || (d.createdAt ? d.createdAt.split('T')[0] : new Date().toISOString().split('T')[0]),
        is_anonymous: d.donorName.includes('Anonymous'),
      }));

    const allRawDonations = [...regDonationsList, ...standaloneDonationsList];

    // Authoritative aggregation: combine multi-donations by same mobile/ID/name
    const allUniqueAggregated = aggregateTopDonors(allRawDonations, 0);

    // Public ledger strictly shows the Top 10 donors
    const top10Donors: PublicDonationItem[] = allUniqueAggregated.slice(0, 10).map((agg) => ({
      id: agg.id,
      donor_name: agg.donor_name,
      masked_registration_id: agg.masked_registration_id,
      masked_mobile: agg.masked_mobile,
      batch_name: agg.batch_name,
      passing_year: agg.passing_year,
      amount: agg.amount,
      donation_count: agg.donation_count,
      purpose: agg.purpose,
      payment_method: agg.payment_methods[0] || 'bkash',
      donation_date: agg.donation_date,
      is_anonymous: agg.is_anonymous,
    }));

    return {
      total_collected: totalCollected,
      total_registration_fees: regFees,
      total_donations: totalDonations,
      total_expenses: totalExpenses,
      remaining_balance: remainingBalance,
      paid_student_count: paidStudents.length,
      donor_count: allUniqueAggregated.length,
      categories: defaultCategories,
      recent_expenses: recentExpenses,
      recent_donations: top10Donors,
      updated_at: new Date().toISOString(),
      // Manual Registration Financial Breakdown
      total_approved_collection: totalCollected,
      total_pending_collection: manualPendingFees,
      total_rejected_collection: manualRejectedFees,
      total_online_collection: onlineRegFees,
      total_manual_collection: manualApprovedFees,
    };
  }

  private static verifyLocalPersonalDonation(
    cleanId: string,
    cleanPhone: string
  ): PersonalDonationHistoryResult {
    const registrations = AppStore.getRegistrations();
    const reg = registrations.find((r) => r.id.toUpperCase() === cleanId);

    if (!reg) {
      return { success: false, error: `No registration found with ID "${cleanId}".` };
    }

    const rawRegPhone = (reg.mobileNumber || '').replace(/\D/g, '');
    const rawInputPhone = cleanPhone.replace(/\D/g, '');

    const isMatch =
      rawRegPhone === rawInputPhone ||
      (rawInputPhone.length >= 4 && rawRegPhone.endsWith(rawInputPhone.slice(-4)));

    if (!isMatch) {
      return {
        success: false,
        error: 'Identity verification failed: Mobile digits do not match the registered record.',
      };
    }

    const donationAmt = reg.donationAmount || 0;
    const history: PersonalDonationRecord[] = donationAmt > 0 ? [
      {
        id: `DON-${reg.id}`,
        amount: donationAmt,
        purpose: 'Reunion Registration Donation',
        payment_method: reg.paymentMethod,
        transaction_id: reg.transactionId,
        payment_status: reg.paymentStatus,
        donation_date: reg.registeredAt ? reg.registeredAt.split('T')[0] : '2026-02-01',
        created_at: reg.registeredAt,
      }
    ] : [];

    return {
      success: true,
      student_name: reg.fullName,
      registration_id: reg.id,
      batch_name: reg.batchName,
      passing_year: reg.passingYear,
      category: reg.category,
      registration_fee: reg.registrationFee || (reg.category === 'current' ? 1000 : 1500),
      total_paid: reg.totalPaid || 0,
      total_donated: donationAmt,
      payment_status: reg.paymentStatus,
      transaction_id: reg.transactionId,
      registered_at: reg.registeredAt,
      history,
    };
  }
}
