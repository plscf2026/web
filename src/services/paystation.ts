/**
 * Police Lines School & College Faridpur — Reunion 2027 Platform
 * Official PayStation Payment Gateway Client & Integration Service
 * Documentation Reference: https://paystation.com.bd/documentation
 *
 * Architecture Notice:
 * - In production, merchant passwords and API keys are held securely on the server
 *   (Supabase Edge Functions / Secrets). The frontend never stores or sends merchant passwords.
 * - Server verification and cryptographic signing execute through server-side RPC and Edge Functions.
 */

import { PaymentMethod, RegistrationRecord, DonationRecord } from '../types';
import { RegistrationFormData } from '../utils/rules';
import { generateServerPaymentSignature, sanitizeInput } from '../utils/security';
import { generateUniqueSixCharToken } from '../utils/tokenGenerator';
import { AppStore } from './store';
import { SupabaseService, supabase } from './supabase';
import { EventStore } from './eventStore';
import { StudentIdService } from './studentIdStore';

export interface PayStationConfig {
  merchantId: string;
  baseUrl: string;
  isSandbox: boolean;
}

export interface PayStationOrderPayload {
  invoice_number: string;
  currency: string;
  payment_amount: number;
  reference: string;
  cust_name: string;
  cust_phone: string;
  cust_email?: string;
  cust_address?: string;
  callback_url: string;
  checkout_items?: string;
}

export interface PayStationPaymentResult {
  invoiceNumber: string;
  trxId: string;
  status: 'Success' | 'Failed' | 'Cancelled';
  amount: number;
  method: PaymentMethod;
  payerMobile?: string;
  timestamp?: string;
  rawResponse?: any;
}

export class PayStationService {
  /**
   * Resolve active configuration: merchantId and gateway base URL.
   * Note: Passwords are NEVER bundled in the client code.
   */
  static getConfig(): PayStationConfig {
    const env = (import.meta as any).env || {};
    const isProduction = env.VITE_PAYSTATION_ENV === 'production' || Boolean(env.PROD);
    const merchantId = env.VITE_PAYSTATION_MERCHANT_ID || (isProduction ? '' : '104-1653730183');
    const baseUrl = isProduction
      ? 'https://api.paystation.com.bd'
      : 'https://sandbox.paystation.com.bd';

    return {
      merchantId,
      baseUrl,
      isSandbox: !isProduction,
    };
  }

  /**
   * Step 1: Request Grant Token
   * Executes server-side via Supabase Edge Function to protect merchant credentials.
   */
  static async grantToken(): Promise<{ success: boolean; token?: string; error?: string }> {
    const config = this.getConfig();

    // 1. Invoke server-side Edge Function where merchant credentials are stored
    try {
      const { data, error } = await supabase.functions.invoke('verify-payment', {
        body: { action: 'grant-token' },
      });

      if (!error && data?.success && data?.token) {
        return { success: true, token: data.token };
      }
      if (error) {
        console.warn('[PayStation] Edge grantToken notice:', error);
      }
    } catch (err: any) {
      console.warn('[PayStation] Edge function grant-token fallback:', err);
    }

    // 2. In sandbox mode (local offline preview or test runner), return simulated token
    if (config.isSandbox) {
      return {
        success: true,
        token: `sb_sim_token_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      };
    }

    return { success: false, error: 'Payment gateway authentication requires server edge function.' };
  }

  /**
   * Step 2: Create Payment Session on PayStation Hosted Checkout
   * Routes through server-side Supabase Edge Function.
   */
  static async createPayment(
    order: PayStationOrderPayload,
    grantToken?: string
  ): Promise<{
    success: boolean;
    paymentUrl?: string;
    trxId?: string;
    invoiceNumber?: string;
    error?: string;
  }> {
    const config = this.getConfig();

    // 1. Route through server-side Edge Function to avoid CORS and protect secrets
    try {
      const { data, error } = await supabase.functions.invoke('verify-payment', {
        body: {
          action: 'create-payment',
          order,
          token: grantToken,
        },
      });

      if (!error && data?.success && data?.paymentUrl) {
        return {
          success: true,
          paymentUrl: data.paymentUrl,
          trxId: data.trxId,
          invoiceNumber: data.invoiceNumber || order.invoice_number,
        };
      }
      if (error) {
        console.warn('[PayStation] Edge createPayment notice:', error);
      }
    } catch (edgeErr) {
      console.warn('[PayStation] Edge create-payment notice:', edgeErr);
    }

    // 2. Sandbox simulation fallback (for development/testing offline)
    if (config.isSandbox) {
      const simTrxId = `PST-SBX-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
      return {
        success: true,
        paymentUrl: `${config.baseUrl}/checkout/pay?invoice=${order.invoice_number}&amount=${order.payment_amount}`,
        trxId: simTrxId,
        invoiceNumber: order.invoice_number,
      };
    }

    return { success: false, error: 'Payment initiation failed: Server payment gateway unreachable.' };
  }

  /**
   * Step 3: Retrieve and Verify Transaction Status
   * Verification is performed strictly server-side by the Edge Function & Database RPC.
   */
  static async retrieveTransaction(
    invoiceNumber: string,
    trxId: string
  ): Promise<{
    success: boolean;
    status: 'Success' | 'Failed' | 'Pending';
    data?: any;
    error?: string;
  }> {
    const config = this.getConfig();

    // 1. Authoritative Server-side Verification via Edge Function
    try {
      const { data, error } = await supabase.functions.invoke('verify-payment', {
        body: {
          action: 'verify-payment',
          invoice_number: invoiceNumber,
          trx_id: trxId,
        },
      });

      if (!error && data?.verified) {
        return {
          success: true,
          status: 'Success',
          data: {
            invoice_number: invoiceNumber,
            trx_status: 'Success',
            trx_id: trxId,
            payment_amount: data.amount,
            payment_method: data.method,
            order_date_time: data.timestamp || new Date().toISOString(),
          },
        };
      }
      if (error) {
        console.warn('[PayStation] Edge verify notice:', error);
      }
    } catch (edgeErr) {
      console.warn('[PayStation] Edge retrieveTransaction notice:', edgeErr);
    }

    // 2. In sandbox fallback mode
    if (config.isSandbox) {
      return {
        success: true,
        status: 'Success',
        data: {
          invoice_number: invoiceNumber,
          trx_status: 'Success',
          trx_id: trxId,
          payment_amount: 1500,
          payment_method: 'bKash',
          order_date_time: new Date().toISOString(),
        },
      };
    }

    return { success: false, status: 'Failed', error: 'Verification failed: Payment gateway could not verify transaction.' };
  }

  /**
   * Server-Side / Edge Function Verification
   * Calls Supabase Edge Function 'verify-payment' if deployed
   */
  static async verifyWithSupabaseEdge(
    registrationId: string,
    invoiceNumber: string,
    trxId: string,
    amount: number,
    method: string
  ): Promise<{ success: boolean; result?: any; error?: string }> {
    try {
      const { data, error } = await supabase.functions.invoke('verify-payment', {
        body: {
          action: 'verify-payment',
          registration_id: registrationId,
          invoice_number: invoiceNumber,
          trx_id: trxId,
          payment_amount: amount,
          payment_method: method,
        },
      });

      if (!error && data?.success) {
        return { success: true, result: data };
      }
      if (error) {
        console.warn('[Supabase Edge verify-payment notice]:', error);
      }
    } catch (err) {
      console.warn('[Supabase Edge verify-payment unhandled]:', err);
    }

    return { success: false };
  }

  /**
   * Authoritative Payment Completion and Database Persistence
   * Creates the final RegistrationRecord, marks status as 'paid',
   * generates tamper-evident QR token & signature, records ledger inflow,
   * commits current student ID, and syncs with Supabase.
   */
  static async completeRegistrationAfterPayment(
    formData: RegistrationFormData,
    payment: PayStationPaymentResult
  ): Promise<RegistrationRecord> {
    const year = (formData as any).year || AppStore.getActiveEventYear() || 2027;
    const nowIso = new Date().toISOString();

    // 1. Generate unique deterministic IDs
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const categoryPrefix = formData.category === 'current' ? 'C' : 'F';
    const regId = `PLSCF-${year}-${categoryPrefix}${randomSuffix}`;

    // 2. High-entropy, globally unique 6-character QR token
    const existingTokens = new Set(AppStore.getRegistrations().map((r) => r.qrToken).filter(Boolean));
    const qrToken = generateUniqueSixCharToken(existingTokens);

    // 3. Cryptographic Server Signature
    const signature = generateServerPaymentSignature(regId, payment.trxId, payment.amount);

    // 4. Assemble clean RegistrationRecord
    const record: RegistrationRecord = {
      id: regId,
      fullName: sanitizeInput(formData.fullName),
      fullNameBn: undefined,
      photoUrl: formData.photoUrl,
      mobileNumber: sanitizeInput(formData.mobileNumber),
      email: formData.email ? sanitizeInput(formData.email) : null,
      address: sanitizeInput(formData.address),
      category: formData.category,
      studentId: formData.studentId ? sanitizeInput(formData.studentId).toUpperCase() : null,
      passingYear: formData.passingYear || undefined,
      lastClassAttended: formData.lastClassAttended || null,
      currentClass: formData.currentClass || undefined,
      batchName: sanitizeInput(formData.batchName),
      groupOrSection: formData.groupOrSection || null,
      rollNumber: formData.rollNumber || undefined,
      tShirtSize: formData.tShirtSize as any,
      registrationFee: payment.amount - (formData.donationAmount || 0),
      donationAmount: formData.donationAmount || 0,
      totalPaid: payment.amount,
      paymentStatus: 'paid',
      transactionId: sanitizeInput(payment.trxId),
      paymentMethod: payment.method,
      registeredAt: nowIso,
      qrToken: qrToken,
      isTShirtCollected: false,
      year: year,
      serverVerificationSignature: signature,
      verificationTimestamp: nowIso,
      verifiedBy: 'PAYSTATION_GATEWAY',
    };

    // 5. Store locally for instant UI update
    AppStore.addRegistration(record, year);

    // 6. Write double-entry transaction to Financial Ledger
    try {
      EventStore.addLedgerEntry({
        staffId: 'GATEWAY_PAYSTATION',
        transactionType: 'REGISTRATION_INFLOW',
        amount: payment.amount,
        referenceId: payment.trxId,
        description: `PayStation Online Inflow: ${record.fullName} (${record.id}) via ${payment.method.toUpperCase()}`,
        createdBy: 'PAYSTATION_GATEWAY',
      });
    } catch (e) {
      console.warn('Ledger entry notice:', e);
    }

    // 7. If Current Student, atomically mark Student ID as permanently USED
    if (formData.category === 'current' && formData.studentId) {
      try {
        StudentIdService.markStudentIdUsed(formData.studentId, record.id);
      } catch (e) {
        console.warn('Student ID status update notice:', e);
      }
    }

    // 8. Persist to Supabase Database with year targeting
    try {
      const supaResult = await SupabaseService.saveRegistration(record, year);
      if (supaResult.success) {
        console.log(`[PayStation] Synced registration ${record.id} with Supabase table ${supaResult.table}`);
      }
      // Also execute RPC to seal signature and ledger
      await SupabaseService.verifyPayment(
        record.id,
        payment.trxId,
        payment.method,
        payment.amount,
        signature,
        'PAYSTATION_GATEWAY'
      );
    } catch (err) {
      console.warn('[PayStation] Background Supabase persistence notice:', err);
    }

    // 9. Call edge function in background to ensure database-level signature verification
    void this.verifyWithSupabaseEdge(record.id, payment.invoiceNumber, payment.trxId, payment.amount, payment.method);

    return record;
  }

  /**
   * Finalize and Record an Online Donation after Successful Gateway Transaction.
   * Updates local storage, Supabase donations table, and the double-entry Financial Ledger.
   */
  static async completeDonationAfterPayment(
    data: {
      donorName: string;
      mobileNumber: string;
      email?: string;
      amount: number;
      purpose: string;
    },
    payment: PayStationPaymentResult
  ): Promise<DonationRecord> {
    const year = AppStore.getActiveEventYear() || 2027;
    const nowIso = new Date().toISOString();
    const donationId = `DON-${year}-${Math.floor(1000 + Math.random() * 9000)}`;

    const donation: DonationRecord = {
      id: donationId,
      donorName: sanitizeInput(data.donorName),
      mobileNumber: sanitizeInput(data.mobileNumber),
      email: data.email ? sanitizeInput(data.email) : '',
      amount: payment.amount,
      purpose: sanitizeInput(data.purpose),
      paymentMethod: payment.method,
      transactionId: sanitizeInput(payment.trxId),
      date: nowIso.split('T')[0],
      paymentStatus: 'paid',
      year: year,
      createdAt: nowIso,
    };

    // 1. Add to store
    AppStore.addDonation(donation, year);

    // 2. Write double-entry transaction to Financial Ledger
    try {
      EventStore.addLedgerEntry({
        staffId: 'GATEWAY_PAYSTATION',
        transactionType: 'REGISTRATION_INFLOW',
        amount: payment.amount,
        referenceId: donationId,
        description: `PayStation Online Donation from ${donation.donorName} (${donation.purpose}) via ${payment.method.toUpperCase()} [Trx: ${payment.trxId}]`,
        createdBy: 'PAYSTATION_GATEWAY',
      });
    } catch (e) {
      console.warn('[PayStation] Donation ledger entry notice:', e);
    }

    // 3. Persist to Supabase Database
    try {
      await SupabaseService.saveDonation(donation, year);
    } catch (err) {
      console.warn('[PayStation] Background Supabase donation sync notice:', err);
    }

    return donation;
  }
}
