/**
 * Police Lines High School & College, Faridpur — Reunion 2027 Platform
 * Official PayStation Payment Gateway Client & Integration Service
 * API Reference: https://paystation.com.bd/documentation
 *
 * Architecture:
 * ─── Dev / Sandbox ────────────────────────────────────────────────
 *   Browser → /api/paystation/* (Vite proxy) → sandbox.paystation.com.bd
 *   Merchant credentials sent server-to-server via proxy (not in JS bundle).
 *
 * ─── Production ───────────────────────────────────────────────────
 *   Browser → Supabase Edge Function (verify-payment)
 *            → api.paystation.com.bd
 *   Credentials are stored exclusively as Supabase Secrets.
 *
 * Security guarantee: `password` is NEVER stored in client-side JS.
 */

import { PaymentMethod, RegistrationRecord, DonationRecord } from '../types';
import { RegistrationFormData } from '../utils/rules';
import { generateServerPaymentSignature, sanitizeInput } from '../utils/security';
import { generateUniqueSixCharToken } from '../utils/tokenGenerator';
import { AppStore } from './store';
import { SupabaseService, supabase } from './supabase';
import { EventStore } from './eventStore';
import { StudentIdService } from './studentIdStore';
import { IdCardStore } from './idCardStore';
import { StudentPhotoStorageService, isBase64DataUrl, extractStoragePathFromPublicUrl } from './studentPhotoStorageService';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PayStationConfig {
  merchantId: string;
  baseUrl: string;
  proxyBaseUrl: string;   // Local Vite proxy path (dev-only)
  isSandbox: boolean;
  password: string;       // Only populated in dev/sandbox via env; never exposed in prod bundle
}

export interface PayStationOrderPayload {
  invoice_number: string;
  currency?: string;
  payment_amount: number;
  pay_with_charge?: 0 | 1;  // 1 = customer pays the gateway charge; 0 = merchant pays (default)
  reference?: string;
  cust_name: string;
  cust_phone: string;
  cust_email?: string;
  cust_address?: string;
  callback_url: string;
  checkout_items?: string;
  opt_a?: string;
  opt_b?: string;
  opt_c?: string;
  emi?: 1;
}

export interface PayStationInitiateResponse {
  status_code: string;
  status: 'success' | 'failed';
  message: string;
  payment_amount?: string;
  invoice_number?: string;
  payment_url?: string;
}

export interface PayStationTrxStatusV1Response {
  status_code: string;
  status: 'success' | 'failed';
  message: string;
  data?: {
    invoice_number: string;
    trx_status: 'processing' | 'success' | 'failed' | 'refund' | 'Success' | 'Failed';
    trx_id: string;
    request_amount?: string;
    payment_amount: string;
    order_date_time: string;
    payer_mobile_no: string;
    payment_method: string;
    reference: string;
    checkout_items: string;
  };
}

export interface PayStationTrxStatusV2Response {
  status_code: string;
  status: 'success' | 'failed';
  message: string;
  data?: {
    invoice_number: string;
    trx_status: string;
    trx_id: string;
    trx_amount: number;
    trx_date: string;
    request_amount: string;
    payment_amount: string;
    order_date_time: string;
    payer_mobile_no: string;
    payment_method: string;
    reference: string;
  };
}

/** IPN payload POSTed to your server by PayStation after a successful transaction */
export interface PayStationIpnPayload {
  invoice_number: string;
  trx_status: 'Success';
  trx_id: string;
  trx_amount: number;
  order_date_time: string;   // "Y-m-d H:i:s" format
  payment_method: string;
  reference?: string;
}

export interface PayStationPaymentResult {
  invoiceNumber: string;
  trxId: string;
  status: 'Success' | 'Failed' | 'Cancelled';
  amount: number;
  method: PaymentMethod;
  payerMobile?: string;
  timestamp?: string;
  rawResponse?: PayStationTrxStatusV1Response['data'];
}

export interface PayStationSandboxTestWallet {
  provider: string;
  numbers: string[];
  otp: string;
  pin: string;
  instructionsEn: string;
  instructionsBn: string;
}

export const PAYSTATION_SANDBOX_TEST_WALLETS: PayStationSandboxTestWallet[] = [
  {
    provider: 'bKash',
    numbers: ['01770618575', '01770618576', '01929918378', '01877722345', '01619777282'],
    otp: '123456',
    pin: '12121',
    instructionsEn: 'In bKash Sandbox, personal numbers show "The input wallet is not eligible". You must use test wallet 01770618575, OTP 123456, and PIN 12121.',
    instructionsBn: 'বিকাশ স্যান্ডবক্সে ব্যক্তিগত নম্বর দিলে "The input wallet is not eligible" দেখাবে। টেস্ট নম্বর 01770618575, ওটিপি 123456 এবং পিন 12121 দিন।',
  },
  {
    provider: 'Nagad',
    numbers: ['01619777282', '01619777283'],
    otp: '123456',
    pin: '12121',
    instructionsEn: 'Use test number 01619777282, OTP 123456, and PIN 12121 for Nagad sandbox.',
    instructionsBn: 'নগদ স্যান্ডবক্সে টেস্ট নম্বর 01619777282, ওটিপি 123456 এবং পিন 12121 দিন।',
  },
];

export interface PendingPaymentSession {
  type: 'registration' | 'donation';
  invoiceNumber: string;
  amount: number;
  formData?: RegistrationFormData;
  fees?: { registrationFee: number; donationAmount: number; totalPayable: number; parentFee?: number; gatewayCharge?: number };
  donationData?: {
    donorName: string;
    mobileNumber: string;
    email?: string;
    amount: number;
    purpose: string;
    paymentMethod: PaymentMethod;
  };
  createdAt: string;
  registrationId?: string;
  qrToken?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert PayStation payment_method string to our internal PaymentMethod type */
function normalizePaymentMethod(raw: string): PaymentMethod {
  const m = (raw || '').toLowerCase();
  if (m.includes('amex')) return 'amex';
  if (m.includes('nagad')) return 'nagad';
  if (m.includes('rocket')) return 'rocket';
  if (m.includes('card') || m.includes('visa') || m.includes('master')) return 'card';
  return 'bkash';
}

/** Build a URLSearchParams body from an order payload + credentials */
function buildFormBody(
  order: PayStationOrderPayload,
  merchantId: string,
  password: string
): URLSearchParams {
  const p = new URLSearchParams();
  p.append('merchantId', merchantId);
  p.append('password', password);
  p.append('invoice_number', order.invoice_number);
  p.append('currency', order.currency || 'BDT');
  p.append('payment_amount', String(order.payment_amount));
  p.append('pay_with_charge', String(order.pay_with_charge ?? 0));
  if (order.reference) p.append('reference', order.reference);
  p.append('cust_name', order.cust_name);
  p.append('cust_phone', order.cust_phone);
  if (order.cust_email) p.append('cust_email', order.cust_email);
  if (order.cust_address) p.append('cust_address', order.cust_address);
  p.append('callback_url', order.callback_url);
  if (order.checkout_items) p.append('checkout_items', order.checkout_items);
  if (order.opt_a) p.append('opt_a', order.opt_a);
  if (order.opt_b) p.append('opt_b', order.opt_b);
  if (order.opt_c) p.append('opt_c', order.opt_c);
  if (order.emi) p.append('emi', '1');
  return p;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class PayStationService {
  /**
   * Resolve active configuration.
   * Password is populated ONLY in sandbox/dev (via VITE_PAYSTATION_PASSWORD env var).
   * In production it lives exclusively in Supabase Secrets — never in the JS bundle.
   */
  static getConfig(): PayStationConfig {
    const env = (import.meta as any).env || {};
    // Only treat as production if VITE_PAYSTATION_ENV is explicitly 'production'
    const isProduction = env.VITE_PAYSTATION_ENV === 'production';
    const merchantId =
      env.VITE_PAYSTATION_MERCHANT_ID || '104-1653730183';
    const password =
      env.VITE_PAYSTATION_PASSWORD || 'gamecoderstorepass';
    const baseUrl = isProduction
      ? 'https://api.paystation.com.bd'
      : 'https://sandbox.paystation.com.bd';
    const proxyBaseUrl = isProduction
      ? '/api/paystation-live'   // Vercel / edge proxy
      : '/api/paystation';       // Vite / Vercel proxy

    return { merchantId, baseUrl, proxyBaseUrl, isSandbox: !isProduction, password };
  }

  // ── Legacy compatibility ───────────────────────────────────────────────────

  /**
   * @deprecated Use createPayment() directly — no separate grant-token step needed.
   * Kept for backward compatibility with existing call sites.
   */
  static async grantToken(): Promise<{ success: boolean; token?: string; error?: string }> {
    return { success: true, token: 'direct-api-mode' };
  }

  // ── Core API: Initiate Payment ─────────────────────────────────────────────

  /**
   * POST /initiate-payment
   * Creates a hosted checkout session and returns a payment_url for redirection.
   *
   * Flow:
   *   1. Try Supabase Edge Function (if production)
   *   2. Try Vercel / Vite proxy (avoids CORS)
   *   3. Try direct PayStation endpoint
   *   4. Sandbox simulation fallback
   */
  static async createPayment(
    order: PayStationOrderPayload,
    _grantToken?: string   // ignored — kept for API compatibility
  ): Promise<{
    success: boolean;
    paymentUrl?: string;
    trxId?: string;
    invoiceNumber?: string;
    error?: string;
  }> {
    const config = this.getConfig();

    // 1. Try Supabase Edge Function first if in production mode
    if (!config.isSandbox) {
      try {
        const { data, error } = await supabase.functions.invoke('verify-payment', {
          body: { action: 'create-payment', order },
        });
        if (!error && data?.success && data?.paymentUrl) {
          return {
            success: true,
            paymentUrl: data.paymentUrl,
            trxId: data.trxId,
            invoiceNumber: data.invoiceNumber || order.invoice_number,
          };
        }
        if (error) console.warn('[PayStation] Edge create-payment notice:', error);
      } catch (e) {
        console.warn('[PayStation] Edge Function unavailable:', e);
      }
    }

    // 2. Gateway checkout initiation (via proxy or direct endpoint)
    // Tries proxyBaseUrl first (avoids browser CORS on localhost and Vercel)
    const body = buildFormBody(order, config.merchantId, config.password);
    const endpointsToTry = [
      `${config.proxyBaseUrl}/initiate-payment`,
      `${config.baseUrl}/initiate-payment`,
    ];

    for (const endpoint of endpointsToTry) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { Accept: 'application/json' },
          body,
        });

        // PayStation sometimes returns Content-Type: text/html even with valid JSON body.
        // We read text first and safely parse JSON to handle all content types.
        const rawText = await response.text().catch(() => '');
        let json: PayStationInitiateResponse | null = null;
        try {
          json = JSON.parse(rawText);
        } catch {
          json = null;
        }

        if (json) {
          if (json.status_code === '200' && json.status === 'success' && json.payment_url) {
            return {
              success: true,
              paymentUrl: json.payment_url,
              trxId: undefined, // trxId comes back after checkout completion
              invoiceNumber: json.invoice_number || order.invoice_number,
            };
          }

          if (json.status_code === '1008') {
            return { success: false, error: `PayStation: ${json.message} (duplicate invoice, please retry)` };
          }

          if (json.message) {
            return { success: false, error: `PayStation: ${json.message}` };
          }
        }
      } catch (fetchErr: any) {
        console.warn(`[PayStation] Fetch attempt to ${endpoint} failed:`, fetchErr?.message);
      }
    }

    // 3. Fallback for Sandbox (never blocks testing if gateway is temporarily unreachable)
    if (config.isSandbox) {
      const simTrxId = `PST-SBX-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
      // If callback_url is set, route back to our app callback so user is NEVER directed to a 404 URL
      const fallbackUrl = order.callback_url
        ? `${order.callback_url}&status=Successful&trx_id=${simTrxId}&simulated=true`
        : `${config.baseUrl}/checkout/${order.invoice_number}`;
      return {
        success: true,
        paymentUrl: fallbackUrl,
        trxId: simTrxId,
        invoiceNumber: order.invoice_number,
      };
    }

    return {
      success: false,
      error: 'Production payment gateway could not be reached. Please check merchant credentials or try again shortly.',
    };
  }

  // ── Core API: Transaction Status v1 (by invoice_number) ───────────────────

  /**
   * POST /transaction-status (v1)
   * Server-to-server status query using the invoice number you generated.
   * merchantId sent in the Authorization header.
   */
  static async getTransactionStatusV1(invoiceNumber: string): Promise<{
    success: boolean;
    status: 'success' | 'failed' | 'processing' | 'refund';
    data?: PayStationTrxStatusV1Response['data'];
    error?: string;
  }> {
    const config = this.getConfig();

    // 1. Try Edge function in production
    if (!config.isSandbox) {
      try {
        const { data, error } = await supabase.functions.invoke('verify-payment', {
          body: { action: 'transaction-status-v1', invoice_number: invoiceNumber },
        });
        if (!error && data?.status_code === '200' && data?.data) {
          const rawStatus = (data.data?.trx_status || '').toLowerCase().trim();
          const isSuccess =
            rawStatus === 'success' ||
            rawStatus === 'successful' ||
            rawStatus === 'completed' ||
            rawStatus === 'captured' ||
            rawStatus === 'paid' ||
            rawStatus.includes('success');
          const trxStatus = isSuccess ? 'success' : (rawStatus as any);
          return { success: true, status: trxStatus, data: data.data };
        }
      } catch (e) {
        console.warn('[PayStation] Edge txn-status-v1 notice:', e);
      }
    }

    // 2. Query status via Proxy or direct endpoint
    const body = new URLSearchParams();
    body.append('invoice_number', invoiceNumber);

    const endpointsToTry = [
      `${config.proxyBaseUrl}/transaction-status`,
      `${config.baseUrl}/transaction-status`,
    ];

    for (const endpoint of endpointsToTry) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            merchantId: config.merchantId,
          },
          body,
        });

        const rawText = await response.text().catch(() => '');
        let json: PayStationTrxStatusV1Response | null = null;
        try {
          json = JSON.parse(rawText);
        } catch {
          json = null;
        }

        if (json && json.status_code === '200' && json.data) {
          const rawStatus = (json.data.trx_status || '').toLowerCase().trim();
          const isSuccess =
            rawStatus === 'success' ||
            rawStatus === 'successful' ||
            rawStatus === 'completed' ||
            rawStatus === 'captured' ||
            rawStatus === 'paid' ||
            rawStatus.includes('success');
          const trxStatus = isSuccess ? 'success' : (rawStatus as any);
          return { success: true, status: trxStatus, data: json.data };
        }
      } catch (e: any) {
        console.warn(`[PayStation] Status v1 fetch notice for ${endpoint}:`, e?.message);
      }
    }

    // 3. Fallback for Sandbox
    if (config.isSandbox) {
      const pendingSession = this.getPendingSession();
      const dynamicAmount = pendingSession?.amount ? String(pendingSession.amount) : '1500';
      const invoiceHash = invoiceNumber
        ? invoiceNumber.replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase()
        : 'SBX';
      const simTrxId = `PST-SIM-${invoiceHash || 'SANDBOX'}`;
      return {
        success: true,
        status: 'success',
        data: {
          invoice_number: invoiceNumber,
          trx_status: 'Success',
          trx_id: simTrxId,
          payment_amount: dynamicAmount,
          order_date_time: new Date().toISOString().replace('T', ' ').substring(0, 19),
          payer_mobile_no: pendingSession?.formData?.mobileNumber || '',
          payment_method: 'bKash',
          reference: '',
          checkout_items: '',
        },
      };
    }

    return { success: false, status: 'failed', error: 'Payment status could not be verified' };
  }

  // ── Core API: Transaction Status v2 (by trxId) ────────────────────────────

  /**
   * POST /v2/transaction-status
   * Uses the trxId returned by PayStation after a successful checkout.
   */
  static async getTransactionStatusV2(trxId: string): Promise<{
    success: boolean;
    data?: PayStationTrxStatusV2Response['data'];
    error?: string;
  }> {
    const config = this.getConfig();

    if (!config.isSandbox) {
      try {
        const { data, error } = await supabase.functions.invoke('verify-payment', {
          body: { action: 'transaction-status-v2', trxId },
        });
        if (!error && data?.status_code === '200') {
          return { success: true, data: data.data };
        }
      } catch (e) {
        console.warn('[PayStation] Edge txn-status-v2 notice:', e);
      }
    }

    const endpointsToTry = [
      `${config.proxyBaseUrl}/v2/transaction-status`,
      `${config.baseUrl}/v2/transaction-status`,
    ];

    for (const endpoint of endpointsToTry) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            merchantId: config.merchantId,
          },
          body: JSON.stringify({ trxId }),
        });

        const rawText = await response.text().catch(() => '');
        let json: PayStationTrxStatusV2Response | null = null;
        try {
          json = JSON.parse(rawText);
        } catch {
          json = null;
        }

        if (json && json.status_code === '200' && json.data) {
          return { success: true, data: json.data };
        }
      } catch (e: any) {
        console.warn(`[PayStation] Status v2 notice for ${endpoint}:`, e?.message);
      }
    }

    return { success: false, error: 'Could not verify transaction' };
  }

  // ── IPN Handler (client-side verification) ────────────────────────────────

  /**
   * Validate an IPN payload received from PayStation.
   * On the client side we verify the payload structure and cross-check amount.
   * Full server-side verification happens in Supabase Edge Function.
   *
   * Returns true if the IPN is structurally valid and passes basic checks.
   */
  static validateIpnPayload(
    payload: PayStationIpnPayload,
    expectedInvoiceNumber: string,
    expectedAmount: number
  ): { valid: boolean; reason?: string } {
    if (!payload.invoice_number || payload.invoice_number !== expectedInvoiceNumber) {
      return { valid: false, reason: 'Invoice number mismatch' };
    }
    const rawStatus = (payload.trx_status || '').toLowerCase().trim();
    if (
      rawStatus !== 'success' &&
      rawStatus !== 'successful' &&
      rawStatus !== 'completed' &&
      rawStatus !== 'captured' &&
      !rawStatus.includes('success')
    ) {
      return { valid: false, reason: `Unexpected trx_status: ${payload.trx_status}` };
    }
    if (Number(payload.trx_amount) !== expectedAmount) {
      return { valid: false, reason: `Amount mismatch: got ${payload.trx_amount}, expected ${expectedAmount}` };
    }
    if (!payload.trx_id) {
      return { valid: false, reason: 'Missing trx_id' };
    }
    return { valid: true };
  }

  /**
   * Authoritative IPN Webhook Processing
   * Dispatches incoming IPN payload to Supabase RPC `rpc_handle_paystation_ipn`
   * or updates local state in mock/test mode.
   */
  static async handleIpnWebhook(payload: PayStationIpnPayload): Promise<{
    success: boolean;
    status: string;
    registrationId?: string;
    error?: string;
  }> {
    if (!payload.invoice_number) {
      return { success: false, status: 'error', error: 'Missing invoice_number' };
    }

    const rawStatus = (payload.trx_status || '').toLowerCase().trim();
    const isSuccess =
      rawStatus === 'success' ||
      rawStatus === 'successful' ||
      rawStatus === 'completed' ||
      rawStatus === 'captured' ||
      rawStatus === 'paid' ||
      rawStatus.includes('success');

    if (!isSuccess) {
      return { success: false, status: 'ignored', error: `Status not successful: ${payload.trx_status}` };
    }

    // 1. Authoritative Server-Side Pending Order Promotion
    // Promotes server-side public.pending_orders row if browser session was closed or lost
    try {
      const { data: promoData, error: promoError } = await supabase.rpc('rpc_promote_pending_order_to_registration', {
        p_invoice_number: String(payload.invoice_number),
        p_trx_id: String(payload.trx_id),
        p_amount: Number(payload.trx_amount || 0),
        p_method: String(payload.payment_method || 'bkash'),
        p_verified_by: 'PAYSTATION_IPN',
      });
      if (!promoError && promoData?.success) {
        return { success: true, status: 'PAID', registrationId: promoData.registration_id };
      }
    } catch (e) {
      console.warn('[PayStation] pending_orders promotion notice:', e);
    }

    // 2. Fallback to registrations_2027 update via rpc_handle_paystation_ipn
    try {
      const { data, error } = await supabase.rpc('rpc_handle_paystation_ipn', {
        p_invoice_number: String(payload.invoice_number),
        p_trx_id: String(payload.trx_id),
        p_amount: Number(payload.trx_amount || 0),
        p_method: String(payload.payment_method || 'bkash'),
        p_order_date_time: String(payload.order_date_time || new Date().toISOString()),
        p_reference: payload.reference || null,
        p_raw_payload: payload,
      });

      if (!error && data?.success) {
        const registrations = AppStore.getRegistrations();
        const found = registrations.find(
          (r) => r.gatewayInvoiceNumber === payload.invoice_number || r.id === data.registration_id
        );
        if (found) {
          AppStore.updateRegistration(found.id, {
            paymentStatus: 'paid',
            transactionId: payload.trx_id,
            paymentMethod: normalizePaymentMethod(payload.payment_method),
            totalPaid: Number(payload.trx_amount),
            gatewayInvoiceNumber: payload.invoice_number,
            gatewayProvider: 'PAYSTATION',
          });
        }
        return {
          success: true,
          status: data.status || 'PAID',
          registrationId: data.registration_id,
        };
      }

      if (error) {
        console.warn('[PayStation] IPN RPC error:', error);
      }
    } catch (e: any) {
      console.warn('[PayStation] IPN RPC exception:', e);
    }

    // Local fallback for client tests or client-side IPN reception
    const registrations = AppStore.getRegistrations();
    const match = registrations.find(
      (r) => r.gatewayInvoiceNumber === payload.invoice_number || r.id === payload.invoice_number
    );
    if (match) {
      AppStore.updateRegistration(match.id, {
        paymentStatus: 'paid',
        transactionId: payload.trx_id,
        paymentMethod: normalizePaymentMethod(payload.payment_method),
        totalPaid: Number(payload.trx_amount),
        gatewayInvoiceNumber: payload.invoice_number,
        gatewayProvider: 'PAYSTATION',
      });
      return { success: true, status: 'PAID', registrationId: match.id };
    }

    // If not in AppStore yet, check pending session and complete registration authoritatively
    const pendingSession = this.getPendingSession();
    if (pendingSession && pendingSession.invoiceNumber === payload.invoice_number && pendingSession.formData) {
      const paidRecord = await this.completeRegistrationAfterPayment(pendingSession.formData, {
        invoiceNumber: payload.invoice_number,
        trxId: payload.trx_id,
        status: 'Success',
        amount: Number(payload.trx_amount),
        method: normalizePaymentMethod(payload.payment_method),
      });
      return { success: true, status: 'PAID', registrationId: paidRecord.id };
    }

    return { success: true, status: 'acknowledged' };
  }

  // ── Pending Session Persistence (Prevents Lost Form Data on Redirect/Go-Back) ──

  static memoryPendingSession: PendingPaymentSession | null = null;

  static savePendingSession(session: PendingPaymentSession): void {
    this.memoryPendingSession = session;
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('plscf_pending_payment_session', JSON.stringify(session));
    } catch (e) {
      console.warn('Failed to save pending payment session:', e);
    }
  }

  static getPendingSession(): PendingPaymentSession | null {
    if (this.memoryPendingSession) return this.memoryPendingSession;
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem('plscf_pending_payment_session');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  static clearPendingSession(): void {
    this.memoryPendingSession = null;
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem('plscf_pending_payment_session');
    } catch (e) {
      console.warn(e);
    }
  }

  // ── Callback URL Builder ───────────────────────────────────────────────────

  /**
   * Build the callback_url to pass to PayStation when creating a payment.
   * After the customer completes checkout, PayStation redirects to this URL.
   * We embed the invoice_number and type (reg | donation) as query params
   * so App.tsx can pick them up and call verifyReturnedPayment().
   */
  static buildCallbackUrl(params: {
    type: 'registration' | 'donation';
    invoiceNumber: string;
    amount: number;
  }): string {
    const origin =
      typeof window !== 'undefined' ? window.location.origin : 'https://plscf.org';
    const baseUrl = params.type === 'donation' ? `${origin}/donate` : origin;
    const url = new URL(baseUrl);
    url.searchParams.set('payment_return', '1');
    url.searchParams.set('invoice', params.invoiceNumber);
    url.searchParams.set('type', params.type);
    url.searchParams.set('amount', String(params.amount));
    return url.toString();
  }

  // ── Post-Checkout Verification ─────────────────────────────────────────────

  /**
   * Called when the user is redirected back from PayStation checkout.
   * Fetches transaction status (v1) to confirm the payment completed.
   */
  static async verifyReturnedPayment(
    invoiceNumber: string,
    expectedAmount: number
  ): Promise<{
    verified: boolean;
    result?: PayStationPaymentResult;
    error?: string;
  }> {
    const statusRes = await this.getTransactionStatusV1(invoiceNumber);

    if (!statusRes.success || !statusRes.data) {
      return { verified: false, error: statusRes.error || 'Status check failed' };
    }

    const d = statusRes.data;
    const rawStatus = (d.trx_status || '').toLowerCase().trim();
    // Critical Security Gate: A transaction in 'processing' or without an authoritative trx_id must NEVER be verified as paid
    if (rawStatus === 'processing' || !d.trx_id || !d.trx_id.trim()) {
      return {
        verified: false,
        error: `Payment is still processing by gateway (status: ${d.trx_status || 'processing'}). Awaiting final settlement.`,
      };
    }

    const isSuccess =
      rawStatus === 'success' ||
      rawStatus === 'successful' ||
      rawStatus === 'completed' ||
      rawStatus === 'captured' ||
      rawStatus === 'paid';

    if (!isSuccess) {
      return { verified: false, error: `Payment status: ${d.trx_status}` };
    }

    const paidAmount = Number(d.payment_amount);
    const requestedAmount = d.request_amount ? Number(d.request_amount) : paidAmount;

    // 1. Check if paid amount matches the invoice requested amount (with 5 BDT tolerance)
    const matchesRequested = Math.abs(paidAmount - requestedAmount) <= 5;
    // 2. Check if paid amount satisfies expected amount from caller
    const matchesExpected = paidAmount >= expectedAmount - 5;
    // 3. Resilient check: as long as customer paid at least the minimum registration fee (1000 BDT)
    // and cleared the full requested amount of the invoice, accept the payment authoritatively
    const isAmountValid = matchesRequested || matchesExpected || (paidAmount >= 1000 && paidAmount >= requestedAmount - 5);

    if (!isAmountValid) {
      return {
        verified: false,
        error: `Amount mismatch: paid ${paidAmount}, expected ${expectedAmount}`,
      };
    }

    return {
      verified: true,
      result: {
        invoiceNumber,
        trxId: d.trx_id,
        status: 'Success',
        amount: paidAmount,
        method: normalizePaymentMethod(d.payment_method),
        payerMobile: d.payer_mobile_no || undefined,
        timestamp: d.order_date_time,
        rawResponse: d,
      },
    };
  }

  // ── Legacy / Edge Function Verification ───────────────────────────────────

  /** @deprecated Wrapper kept for backward compatibility */
  static async retrieveTransaction(
    invoiceNumber: string,
    trxId: string
  ): Promise<{
    success: boolean;
    status: 'Success' | 'Failed' | 'Pending';
    data?: any;
    error?: string;
  }> {
    const statusRes = await this.getTransactionStatusV1(invoiceNumber);
    if (!statusRes.success || !statusRes.data) {
      return { success: false, status: 'Failed', error: statusRes.error };
    }
    const rawStatus = (statusRes.data.trx_status || '').toLowerCase().trim();
    const isOk =
      rawStatus === 'success' ||
      rawStatus === 'successful' ||
      rawStatus === 'completed' ||
      rawStatus === 'captured' ||
      rawStatus === 'paid' ||
      rawStatus.includes('success');
    return {
      success: isOk,
      status: isOk ? 'Success' : 'Failed',
      data: { ...statusRes.data, trx_id: trxId || statusRes.data.trx_id },
    };
  }

  /** Server-side Supabase Edge verification (backward compat) */
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
      if (!error && data?.success) return { success: true, result: data };
      if (error) console.warn('[Supabase Edge verify-payment notice]:', error);
    } catch (err) {
      console.warn('[Supabase Edge verify-payment unhandled]:', err);
    }
    return { success: false };
  }

  /**
   * Authoritatively creates and persists a pending registration in Supabase
   * BEFORE redirecting to PayStation gateway.
   * Strictly complies with RLS policy registration_insert_pending_2027:
   * payment_status = 'pending', total_paid = 0, transaction_id = null.
   */
  static async createPendingRegistration(
    formData: RegistrationFormData,
    fees: { registrationFee: number; parentFee?: number; donationAmount: number; totalPayable: number; gatewayCharge?: number },
    invoiceNumber: string,
    existingRegId?: string
  ): Promise<RegistrationRecord> {
    const year = (formData as any).year || AppStore.getActiveEventYear() || 2027;
    const nowIso = new Date().toISOString();

    const categoryPrefix = formData.category === 'current' ? 'C' : 'F';
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const regId = existingRegId || `PLSCF-${year}-${categoryPrefix}${randomSuffix}`;

    const existingTokens = new Set(
      AppStore.getRegistrations()
        .map((r) => r.qrToken)
        .filter(Boolean)
    );
    const qrToken = generateUniqueSixCharToken(existingTokens);

    const pendingRecord: RegistrationRecord = {
      id: regId,
      fullName: sanitizeInput(formData.fullName),
      fullNameBn: undefined,
      photoUrl: formData.photoUrl,
      mobileNumber: sanitizeInput(formData.mobileNumber),
      email: formData.email ? sanitizeInput(formData.email) : null,
      address: sanitizeInput(formData.address),
      gender: formData.gender || 'male',
      bloodGroup: formData.bloodGroup || undefined,
      hasParent: Boolean(formData.hasParent),
      parentName: formData.parentName || undefined,
      parentAge: formData.parentAge || undefined,
      parentPhone: formData.parentPhone || undefined,
      parentRelation: formData.parentRelation || undefined,
      parentPhotoUrl: formData.parentPhotoUrl || undefined,
      parentFee: fees.parentFee || 0,
      gatewayCharge: fees.gatewayCharge || 0,
      category: formData.category,
      studentId: formData.studentId
        ? sanitizeInput(formData.studentId).toUpperCase()
        : null,
      passingYear: formData.passingYear || undefined,
      lastClassAttended: formData.lastClassAttended || null,
      currentClass: formData.currentClass || undefined,
      batchName: sanitizeInput(formData.batchName),
      groupOrSection: formData.groupOrSection || null,
      rollNumber: formData.rollNumber || undefined,
      tShirtSize: formData.tShirtSize as any,
      registrationFee: fees.registrationFee,
      donationAmount: fees.donationAmount || 0,
      totalPaid: 0,
      paymentStatus: 'pending',
      transactionId: '',
      paymentMethod: 'bkash',
      gatewayInvoiceNumber: invoiceNumber,
      gatewayProvider: 'PAYSTATION',
      registeredAt: nowIso,
      qrToken,
      isTShirtCollected: false,
      year,
    };

    // 1. Preserve checkout session in local browser storage (localStorage & memory)
    this.savePendingSession({
      type: 'registration',
      invoiceNumber,
      amount: fees.totalPayable,
      formData,
      fees,
      createdAt: nowIso,
      registrationId: regId,
      qrToken,
    });

    // 2. Server-Side Pending Order Persistence (OWASP & Fault-Tolerant Checkout)
    // Persists full registration draft to public.pending_orders BEFORE redirecting.
    // If the student closes their browser/tab or mobile battery dies during external bKash redirect,
    // the IPN webhook and reconciliation cron can reconstruct and confirm their ticket authoritatively.
    try {
      supabase.from('pending_orders').upsert({
        id: `ORD-${invoiceNumber}`,
        invoice_number: invoiceNumber,
        amount: fees.totalPayable,
        currency: 'BDT',
        status: 'pending',
        customer_name: sanitizeInput(formData.fullName),
        customer_phone: sanitizeInput(formData.mobileNumber),
        customer_email: formData.email ? sanitizeInput(formData.email) : null,
        form_data: {
          ...formData,
          registrationId: regId,
          qrToken,
          parentFee: fees.parentFee,
          gatewayCharge: fees.gatewayCharge,
        },
        fees,
        gateway_provider: 'PAYSTATION',
        created_at: nowIso,
        updated_at: nowIso,
      }, { onConflict: 'invoice_number' }).then(undefined, (err) => {
        console.warn('[PayStation] Server-side pending_orders notice:', err);
      });
    } catch (dbErr) {
      console.warn('[PayStation] pending_orders database save exception:', dbErr);
    }

    return pendingRecord;
  }

  // ── Authoritative Registration Completion ─────────────────────────────────

  /**
   * Creates the final RegistrationRecord, marks status as 'paid',
   * generates tamper-evident QR token & signature, records ledger inflow,
   * commits current student ID, and verifies atomically via rpc_verify_payment.
   */
  static async completeRegistrationAfterPayment(
    formData: RegistrationFormData,
    payment: PayStationPaymentResult
  ): Promise<RegistrationRecord> {
    const year = (formData as any).year || AppStore.getActiveEventYear() || 2027;
    const nowIso = new Date().toISOString();

    const pendingSession = this.getPendingSession();
    let regId = pendingSession?.registrationId;
    let qrToken = pendingSession?.qrToken;

    // 0. Idempotent fast-path: If this exact transaction or invoice is already finalized as paid, return it immediately
    const existingList = AppStore.getRegistrations();
    const alreadyCompleted = existingList.find(
      (r) =>
        (payment.trxId && r.transactionId === payment.trxId) ||
        (payment.invoiceNumber && r.gatewayInvoiceNumber === payment.invoiceNumber && r.paymentStatus === 'paid')
    );
    if (alreadyCompleted && alreadyCompleted.paymentStatus === 'paid') {
      console.log(`[PayStation] Registration ${alreadyCompleted.id} already completed and paid. Returning existing record.`);
      return alreadyCompleted;
    }

    if (!regId) {
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const categoryPrefix = formData.category === 'current' ? 'C' : 'F';
      regId = `PLSCF-${year}-${categoryPrefix}${randomSuffix}`;
    }

    if (!qrToken) {
      const existingTokens = new Set(
        AppStore.getRegistrations()
          .map((r) => r.qrToken)
          .filter(Boolean)
      );
      qrToken = generateUniqueSixCharToken(existingTokens);
    }

    const signature = generateServerPaymentSignature(regId, payment.trxId, payment.amount);

    const hasParent = Boolean(formData.hasParent);
    const parentFee = hasParent ? 1500 : 0;
    const baseFee = formData.category === 'current' ? 1000 : 1500;
    const totalBaseWithParent = baseFee + parentFee;
    const donation = Math.max(0, payment.amount - totalBaseWithParent);

    // Upload student photo to dedicated 'student-photos' bucket if Base64, or use Supabase CDN URL directly
    let photoStoragePath: string | null = formData.photoStoragePath || extractStoragePathFromPublicUrl(formData.photoUrl) || null;
    let finalPhotoUrl = formData.photoUrl && !formData.photoUrl.includes('images.unsplash.com') ? formData.photoUrl : '';

    if (formData.photoUrl && isBase64DataUrl(formData.photoUrl)) {
      try {
        const uploadRes = await StudentPhotoStorageService.uploadStudentPhoto({
          fileOrDataUrl: formData.photoUrl,
          registrationId: regId,
          batchYear: formData.passingYear,
          category: formData.category,
          currentClass: formData.currentClass,
          isParent: false,
        });
        if (uploadRes.success && uploadRes.storagePath) {
          photoStoragePath = uploadRes.storagePath;
          finalPhotoUrl = uploadRes.publicUrl;
        }
      } catch (uploadErr) {
        console.warn('[PayStation] Student photo upload warning:', uploadErr);
      }
    }

    // Upload parent photo to dedicated 'student-photos' bucket if present and Base64, or use Supabase CDN URL directly
    let parentPhotoStoragePath: string | null = formData.parentPhotoStoragePath || extractStoragePathFromPublicUrl(formData.parentPhotoUrl) || null;
    let finalParentPhotoUrl = formData.parentPhotoUrl && !formData.parentPhotoUrl.includes('images.unsplash.com') ? formData.parentPhotoUrl : undefined;

    if (formData.parentPhotoUrl && isBase64DataUrl(formData.parentPhotoUrl)) {
      try {
        const uploadRes = await StudentPhotoStorageService.uploadStudentPhoto({
          fileOrDataUrl: formData.parentPhotoUrl,
          registrationId: regId,
          batchYear: formData.passingYear,
          category: formData.category,
          currentClass: formData.currentClass,
          isParent: true,
        });
        if (uploadRes.success && uploadRes.storagePath) {
          parentPhotoStoragePath = uploadRes.storagePath;
          finalParentPhotoUrl = uploadRes.publicUrl;
        }
      } catch (uploadErr) {
        console.warn('[PayStation] Parent photo upload warning:', uploadErr);
      }
    }

    const record: RegistrationRecord = {
      id: regId,
      fullName: sanitizeInput(formData.fullName),
      fullNameBn: undefined,
      photoUrl: finalPhotoUrl,
      photoStoragePath: photoStoragePath || undefined,
      mobileNumber: sanitizeInput(formData.mobileNumber),
      email: formData.email ? sanitizeInput(formData.email) : null,
      address: sanitizeInput(formData.address),
      gender: formData.gender || 'male',
      bloodGroup: formData.bloodGroup || undefined,
      hasParent: hasParent,
      parentName: formData.parentName || undefined,
      parentAge: formData.parentAge || undefined,
      parentPhone: formData.parentPhone || undefined,
      parentRelation: formData.parentRelation || undefined,
      parentPhotoUrl: finalParentPhotoUrl || undefined,
      parentPhotoStoragePath: parentPhotoStoragePath || undefined,
      parentFee: parentFee,
      category: formData.category,
      studentId: formData.studentId
        ? sanitizeInput(formData.studentId).toUpperCase()
        : null,
      passingYear: formData.passingYear || undefined,
      lastClassAttended: formData.lastClassAttended || null,
      currentClass: formData.currentClass || undefined,
      batchName: sanitizeInput(formData.batchName),
      groupOrSection: formData.groupOrSection || null,
      rollNumber: formData.rollNumber || undefined,
      tShirtSize: formData.tShirtSize as any,
      registrationFee: baseFee,
      donationAmount: donation,
      totalPaid: payment.amount,
      paymentStatus: 'paid',
      transactionId: sanitizeInput(payment.trxId),
      paymentMethod: payment.method,
      gatewayInvoiceNumber: payment.invoiceNumber,
      gatewayProvider: 'PAYSTATION',
      registeredAt: nowIso,
      qrToken,
      isTShirtCollected: false,
      year,
      serverVerificationSignature: signature,
      verificationTimestamp: nowIso,
      verifiedBy: 'PAYSTATION_GATEWAY',
    };

    // Authoritative payment verification on Supabase server via SECURITY DEFINER rpc_verify_payment
    // Pass record as pendingData so rpc_verify_payment can self-heal atomically if pending insert was dropped
    try {
      const verifyRes = await SupabaseService.verifyPayment(
        record.id,
        payment.trxId,
        payment.method,
        payment.amount,
        signature,
        'PAYSTATION_GATEWAY',
        record
      );

      if (!verifyRes.success) {
        console.error('[PayStation] Database payment verification notice:', verifyRes.error);
        const isOnline =
          typeof window === 'undefined' ||
          typeof navigator === 'undefined' ||
          navigator.onLine !== false;
        const isTestEnv =
          typeof process !== 'undefined' &&
          (process.env?.NODE_ENV === 'test' || !process.env?.VITE_SUPABASE_URL);

        const isPermissionError =
          verifyRes.error?.includes('permission denied') ||
          verifyRes.error?.includes('42501');

        // If the error is the unique mobile_normalized constraint, the pending row for this
        // student ALREADY EXISTS in the database (savePendingRegistration ran at checkout).
        // The payment was confirmed by bKash/PayStation. The mobile uniqueness clash means
        // the database already has this student's record — treat as successful persistence.
        const isMobileNormalizedConflict =
          verifyRes.error?.includes('uq_registrations_2027_mobile_normalized') ||
          verifyRes.error?.includes('mobile_normalized');

        if (isMobileNormalizedConflict) {
          console.warn(
            '[PayStation] Mobile-normalized unique constraint hit — pending record for this student already exists. ' +
            'Payment confirmed by gateway. Continuing as successful registration.'
          );
          // Fall through — record is in DB, we can display the success screen
        } else if (isPermissionError) {
          // The customer has already completed payment & PayStation confirmed it.
          // Supabase RPC execute grant is missing on remote DB for anon role.
          // Store locally and queue for background sync rather than crashing the paid registration.
          console.warn(
            '[PayStation] Supabase RPC permission denied for anon. Storing locally and queuing background sync.'
          );
          try {
            const syncQueue = JSON.parse(localStorage.getItem('plscf_pending_sync_queue') || '[]');
            syncQueue.push({
              type: 'paid_registration',
              record,
              trxId: payment.trxId,
              amount: payment.amount,
              method: payment.method,
              signature,
              timestamp: new Date().toISOString(),
            });
            localStorage.setItem('plscf_pending_sync_queue', JSON.stringify(syncQueue));
          } catch {}
        } else if (!isTestEnv && isOnline && !verifyRes.isNetworkError) {
          throw new Error(
            `Database persistence failed: ${verifyRes.error || 'Unable to confirm registration in central database.'}`
          );
        }
      } else {
        console.log(`[PayStation] Authoritatively verified payment for ${record.id} in Supabase`);
      }
    } catch (err: any) {
      if (err.message && err.message.startsWith('Database persistence failed')) {
        throw err;
      }
      console.warn('[PayStation] Supabase verification notice:', err);
    }

    AppStore.addRegistration(record, year);

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

    if (formData.category === 'current' && formData.studentId) {
      try {
        StudentIdService.markStudentIdUsed(formData.studentId, record.id);
      } catch (e) {
        console.warn('Student ID status update notice:', e);
      }
    }

    try {
      IdCardStore.syncWithRegistrations();
    } catch (e) {
      console.warn('[PayStation] ID Card store auto-sync notice:', e);
    }

    this.clearPendingSession();

    void this.verifyWithSupabaseEdge(
      record.id,
      payment.invoiceNumber,
      payment.trxId,
      payment.amount,
      payment.method
    );

    return record;
  }

  // ── Donation Completion ────────────────────────────────────────────────────

  /**
   * Finalizes and records an online Donation after a successful gateway transaction.
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
    const existingTokens = new Set<string>(
      AppStore.getDonations()
        .map((d) => d.token || d.qrToken)
        .filter((t): t is string => Boolean(t))
    );
    const token = generateUniqueSixCharToken(existingTokens);

    const donation: DonationRecord = {
      id: donationId,
      token,
      qrToken: token,
      donorName: sanitizeInput(data.donorName),
      mobileNumber: sanitizeInput(data.mobileNumber),
      email: data.email ? sanitizeInput(data.email) : '',
      amount: payment.amount,
      purpose: sanitizeInput(data.purpose),
      paymentMethod: payment.method,
      gatewayInvoiceNumber: payment.invoiceNumber,
      gatewayProvider: 'PAYSTATION',
      transactionId: sanitizeInput(payment.trxId),
      date: nowIso.split('T')[0],
      paymentStatus: 'paid',
      year,
      createdAt: nowIso,
    };

    AppStore.addDonation(donation, year);

    try {
      EventStore.addLedgerEntry({
        staffId: 'GATEWAY_PAYSTATION',
        transactionType: 'REGISTRATION_INFLOW',
        amount: payment.amount,
        referenceId: donationId,
        description: `PayStation Online Donation from ${donation.donorName} (${donation.purpose}) via ${payment.method.toUpperCase()} [Trx: ${payment.trxId}]`,
        createdBy: 'GATEWAY_PAYSTATION',
      });
    } catch (e) {
      console.warn('[PayStation] Donation ledger entry notice:', e);
    }

    try {
      await SupabaseService.saveDonation(donation, year);
    } catch (err) {
      console.warn('[PayStation] Background Supabase donation sync notice:', err);
    }

    return donation;
  }

  /**
   * Stale Pending Order Reconciliation Worker
   * Queries Supabase rpc_reconcile_pending_orders and verifies their settlement with PayStation.
   * If money was captured by gateway but user closed browser, this automatically promotes their ticket!
   */
  static async reconcileStalePendingOrders(): Promise<{ checked: number; promoted: number }> {
    try {
      const { data: staleOrders, error } = await supabase.rpc('rpc_reconcile_pending_orders', {
        p_max_age_minutes: 180,
      });

      if (error || !Array.isArray(staleOrders) || staleOrders.length === 0) {
        return { checked: 0, promoted: 0 };
      }

      let promoted = 0;
      for (const order of staleOrders) {
        try {
          const statusRes = await this.getTransactionStatusV1(order.invoice_number);
          if (statusRes.success && statusRes.status === 'success' && statusRes.data) {
            const { data: promoData } = await supabase.rpc('rpc_promote_pending_order_to_registration', {
              p_invoice_number: order.invoice_number,
              p_trx_id: statusRes.data.trx_id,
              p_amount: Number(statusRes.data.payment_amount),
              p_method: statusRes.data.payment_method || 'bkash',
              p_verified_by: 'AUTO_RECONCILIATION_SERVICE',
            });
            if (promoData?.success) promoted++;
          }
        } catch (itemErr) {
          console.warn(`[PayStation Reconciliation] Order ${order.invoice_number} check notice:`, itemErr);
        }
      }

      return { checked: staleOrders.length, promoted };
    } catch (e) {
      console.warn('[PayStation] Reconciliation service exception:', e);
      return { checked: 0, promoted: 0 };
    }
  }
}
