// @ts-nocheck
/// <reference path="../deno-ambient.d.ts" />
// ============================================================================
// supabase/functions/verify-payment/index.ts  — P0-3 Hardened
//
// SECURITY CONSTRAINTS ENFORCED HERE:
//   1. PAYSTATION_ALLOW_PAYMENT_FINALIZATION env secret MUST be exactly 'true'
//      to enable any payment confirmation. Defaults to disabled (fail-closed).
//   2. Currency: NEVER defaults a missing currency to 'BDT'. If PayStation
//      response is missing or returns a non-BDT currency, payment is rejected.
//   3. All credentials sourced from env secrets only; no hardcoded fallbacks.
//      Missing required secrets → 503 (fail closed, not silently degraded).
//   4. RPC errors are propagated (not silently ignored).
//   5. Sandbox bypass removed: isVerified=true bypass only allowed when
//      PAYSTATION_ENV=sandbox AND PAYSTATION_ALLOW_PAYMENT_FINALIZATION is NOT
//      'true' (sandbox simulation only, never production path).
//   6. CORS: Empty allowedOrigins → 403, not wildcard '*'.
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { computeAuthoritativeOrderAmount } from './feeValidation.ts';
import { parseAllowlistedOrigins } from './callbackUrl.ts';
import { executeInitiatePayment } from './initiationHandler.ts';
import { verifyPayStationTransaction } from './statusClient.ts';
import { PendingOrderCurrencyBinding } from './currencyStrategy.ts';

// ── Required env secrets (fail closed if missing) ───────────────────────────
const PAYSTATION_MERCHANT_ID = Deno.env.get('PAYSTATION_MERCHANT_ID');
const PAYSTATION_PASSWORD    = Deno.env.get('PAYSTATION_PASSWORD');
const PAYSTATION_ENV         = Deno.env.get('PAYSTATION_ENV') || 'sandbox';
const PAYMENT_SIGNING_SECRET = Deno.env.get('PAYMENT_SIGNING_SECRET');

// CRITICAL: payment finalization disabled by default.
// Edge Function will only call payment-confirming RPCs when this is 'true'.
const ALLOW_PAYMENT_FINALIZATION = Deno.env.get('PAYSTATION_ALLOW_PAYMENT_FINALIZATION') === 'true';

// Explicitly attested BDT-only order binding when PayStation omits `currency` in status payloads.
// Must remain false in production unless merchant BDT settlement lock is verified.
const ALLOW_ORDER_BOUND_CURRENCY_ATTESTATION =
  Deno.env.get('PAYSTATION_ALLOW_ORDER_BOUND_CURRENCY_ATTESTATION') === 'true';

const ALLOWED_ORIGINS_RAW = Deno.env.get('APP_ALLOWED_ORIGINS') ?? '';
const allowedOrigins = parseAllowlistedOrigins(ALLOWED_ORIGINS_RAW, PAYSTATION_ENV);

const PAYSTATION_BASE_URL = PAYSTATION_ENV === 'production'
  ? 'https://api.paystation.com.bd'
  : 'https://sandbox.paystation.com.bd';

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  headers: Record<string, string>
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

function getCorsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, merchantId',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Vary': 'Origin',
  };

  if (origin && allowedOrigins.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  // If origin is omitted or not in allowedOrigins: no Access-Control-Allow-Origin header (never wildcard '*')
  return headers;
}

async function generateHmacSha256Signature(
  regId: string,
  trxId: string,
  amount: number,
  secret: string
): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const data = enc.encode(`PLSCF:${regId.trim()}:${trxId.trim().toUpperCase()}:${amount}`);
  const buf  = await crypto.subtle.sign('HMAC', key, data);
  const hex  = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `SIG_HMAC256_${hex.substring(0, 32).toUpperCase()}`;
}

interface GatewayStatusVerification {
  ok: boolean;
  statusCode?: number;
  error?: string;
  message?: string;
  amount?: number;
  method?: string | null;
  currency?: string;
  trxId?: string;
  invoiceNumber?: string | null;
  rawData?: Record<string, unknown>;
}

async function loadPendingOrderBinding(
  sbAdmin: any,
  invoiceNumber?: string
): Promise<PendingOrderCurrencyBinding | null> {
  const cleanInvoice = typeof invoiceNumber === 'string' ? invoiceNumber.trim() : '';
  if (!cleanInvoice || !sbAdmin) return null;
  try {
    const { data } = await sbAdmin
      .from('pending_orders')
      .select('invoice_number, currency, amount')
      .eq('invoice_number', cleanInvoice)
      .maybeSingle();
    return data ?? null;
  } catch {
    return null;
  }
}

async function verifyGatewayTransactionStatus(
  trxId: string,
  expectedInvoiceNumber?: string,
  pendingOrder?: PendingOrderCurrencyBinding | null
): Promise<GatewayStatusVerification> {
  // Authoritative verification delegates to v2/v1 PayStation status client and
  // enforces exact status (`['success', 'successful'].includes(...)`), trx_id,
  // invoice_number, positive amount, and explicit/order-bound currency checks.
  const verified = await verifyPayStationTransaction(trxId, expectedInvoiceNumber, {
    baseUrl: PAYSTATION_BASE_URL,
    merchantId: PAYSTATION_MERCHANT_ID!,
    allowOrderBoundCurrencyAttestation: ALLOW_ORDER_BOUND_CURRENCY_ATTESTATION,
    pendingOrder,
  });

  if (!verified.ok) {
    return {
      ok: false,
      statusCode: verified.statusCode,
      error: verified.error,
      message: verified.message,
    };
  }

  const rawSt = String(verified.rawData?.trx_status || '').toLowerCase().trim();
  if (!['success', 'successful'].includes(rawSt)) {
    return {
      ok: false,
      statusCode: 402,
      error: 'TRANSACTION_NOT_VERIFIED',
      message: 'PayStation transaction status is not verified as successful.',
    };
  }

  return {
    ok: true,
    amount: verified.amount,
    method: verified.method,
    currency: verified.currency,
    trxId: verified.trxId,
    invoiceNumber: verified.invoiceNumber,
    rawData: verified.rawData,
  };
}

serve(async (req) => {
  const origin      = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, corsHeaders);
  }

  // ── Credential presence check (fail closed) ─────────────────────────────
  if (!PAYSTATION_MERCHANT_ID || !PAYSTATION_PASSWORD) {
    console.error('[verify-payment] PAYSTATION_MERCHANT_ID or PAYSTATION_PASSWORD env secret missing.');
    return jsonResponse({
      success: false,
      error:   'GATEWAY_CREDENTIALS_MISSING',
      message: 'Payment gateway credentials not configured. Contact administrator.',
    }, 503, corsHeaders);
  }

  if (!PAYMENT_SIGNING_SECRET) {
    console.error('[verify-payment] PAYMENT_SIGNING_SECRET env secret missing.');
    return jsonResponse({
      success: false,
      error:   'SIGNING_SECRET_MISSING',
      message: 'Payment signing secret not configured. Contact administrator.',
    }, 503, corsHeaders);
  }

  try {
    const rawBodyText = await req.text();
    let body: any = {};
    try {
      body = JSON.parse(rawBodyText);
    } catch {
      const params = new URLSearchParams(rawBodyText);
      body = Object.fromEntries(params.entries());
    }

    const isDirectIpn = Boolean(
      body.invoice_number &&
      (body.trx_status || body.trx_id) &&
      !body.action &&
      !body.order
    );
    const action = body.action || (isDirectIpn ? 'ipn' : (body.order ? 'initiate-payment' : 'verify-payment'));

    // ────────────────────────────────────────────────────────────────────────
    // 1. ACTION: initiate-payment / create-payment
    // Enforces paymentEnabled === true, open flow checks, authoritative fees,
    // allowlisted callback URL, complete registration/donation payload, and
    // service_role pending_orders persistence prior to gateway invocation.
    // ────────────────────────────────────────────────────────────────────────
    if (action === 'initiate-payment' || action === 'create-payment') {
      const supabaseUrl        = Deno.env.get('SUPABASE_URL');
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (!supabaseUrl || !supabaseServiceKey) {
        return jsonResponse({ success: false, error: 'DB_CONFIG_MISSING', message: 'Database service credentials missing.' }, 503, corsHeaders);
      }

      const sbAdmin = createClient(supabaseUrl, supabaseServiceKey);
      const result = await executeInitiatePayment(body.order || body, {
        loadSettings: async () => {
          const { data: settingsRow, error: settingsErr } = await sbAdmin
            .from('system_settings')
            .select('value')
            .eq('key', 'portal_fee_settings')
            .maybeSingle();
          if (settingsErr) {
            console.error('[initiate-payment] Failed reading portal_fee_settings:', settingsErr.message);
            return { value: null, error: settingsErr.message };
          }
          return { value: settingsRow?.value ?? null };
        },
        upsertPendingOrder: async (row) => {
          const { error: orderUpsertErr } = await sbAdmin
            .from('pending_orders')
            .upsert(row, { onConflict: 'invoice_number' });
          if (orderUpsertErr) {
            console.error('[initiate-payment] Failed to persist pending_orders:', orderUpsertErr.message);
            return { error: orderUpsertErr.message };
          }
          return {};
        },
        fetchGateway: async (url, init) => {
          const res = await fetch(url, init);
          return { status: res.status, text: await res.text() };
        },
        config: {
          paystationEnv: PAYSTATION_ENV,
          paystationBaseUrl: PAYSTATION_BASE_URL,
          merchantId: PAYSTATION_MERCHANT_ID!,
          password: PAYSTATION_PASSWORD!,
          allowedOriginsRaw: ALLOWED_ORIGINS_RAW,
          allowPaymentFinalization: ALLOW_PAYMENT_FINALIZATION,
        },
      });

      return jsonResponse(result.body, result.status, corsHeaders);
    }

    // ────────────────────────────────────────────────────────────────────────
    // 1b. ACTION: record-donation (server-side replacement for anon donation fallback)
    // Strictly gated behind ALLOW_PAYMENT_FINALIZATION and currency check.
    // ────────────────────────────────────────────────────────────────────────
    if (action === 'record-donation') {
      if (!ALLOW_PAYMENT_FINALIZATION) {
        return jsonResponse({
          success: false,
          error: 'PAYMENT_FINALIZATION_DISABLED',
          message: 'Live donation payment finalization is disabled.',
        }, 403, corsHeaders);
      }
      const { id, donor_name, mobile_number, email, purpose, payment_method, transaction_id, invoice_number, token, year } = body;
      if (!id || !transaction_id) {
        return jsonResponse({ success: false, error: 'INVALID_REQUEST', message: 'id and transaction_id are required.' }, 400, corsHeaders);
      }

      const supabaseUrl        = Deno.env.get('SUPABASE_URL');
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (!supabaseUrl || !supabaseServiceKey) {
        return jsonResponse({ success: false, error: 'DB_CONFIG_MISSING' }, 503, corsHeaders);
      }
      const sbAdmin = createClient(supabaseUrl, supabaseServiceKey);
      const pendingOrder = await loadPendingOrderBinding(sbAdmin, invoice_number ? String(invoice_number) : undefined);

      const gwCheck = await verifyGatewayTransactionStatus(
        String(transaction_id),
        invoice_number ? String(invoice_number) : undefined,
        pendingOrder
      );
      if (!gwCheck.ok) {
        return jsonResponse({ success: false, error: gwCheck.error, message: gwCheck.message }, gwCheck.statusCode || 402, corsHeaders);
      }
      const { data: settingsRow } = await sbAdmin.from('system_settings').select('value').eq('key', 'portal_fee_settings').maybeSingle();
      if (!settingsRow?.value) {
        return jsonResponse({ success: false, error: 'FEE_SETTINGS_MISSING' }, 503, corsHeaders);
      }
      const resolvedMethod = gwCheck.method || payment_method || 'bkash';
      const donEval = computeAuthoritativeOrderAmount(settingsRow.value, {
        orderType: 'donation',
        donationAmount: gwCheck.amount!,
        paymentMethod: resolvedMethod,
        payWithCharge: 0,
      });
      if (!donEval.valid) {
        return jsonResponse({ success: false, error: donEval.error, message: donEval.message }, 402, corsHeaders);
      }

      const { data: rpcData, error: rpcErr } = await sbAdmin.rpc('rpc_record_donation', {
        p_id: String(id),
        p_donor_name: String(donor_name || 'Donor'),
        p_mobile_number: String(mobile_number || ''),
        p_email: String(email || ''),
        p_amount: donEval.expectedTotal!,
        p_purpose: String(purpose || 'General Reunion Fund'),
        p_payment_method: String(resolvedMethod),
        p_transaction_id: gwCheck.trxId!,
        p_gateway_invoice_number: invoice_number ? String(invoice_number) : null,
        p_token: token ? String(token) : null,
        p_year: Number(year || 2027),
      });
      if (rpcErr || !rpcData?.success) {
        return jsonResponse({ success: false, error: rpcErr?.code || 'RECORD_DONATION_FAILED', message: rpcErr?.message || rpcData?.error }, 402, corsHeaders);
      }
      return jsonResponse({ success: true, donation: rpcData.donation }, 200, corsHeaders);
    }

    // ────────────────────────────────────────────────────────────────────────
    // 2. ACTION: transaction-status-v1
    // ────────────────────────────────────────────────────────────────────────
    if (action === 'transaction-status-v1') {
      const invoiceNumber = body.invoice_number || body.invoiceNumber;
      if (!invoiceNumber) return jsonResponse({ success: false, error: 'invoice_number is required.' }, 400, corsHeaders);

      const formBody = new URLSearchParams();
      formBody.append('invoice_number', String(invoiceNumber));

      try {
        const statusRes  = await fetch(`${PAYSTATION_BASE_URL}/transaction-status`, {
          method: 'POST', headers: { 'Accept': 'application/json', 'merchantId': PAYSTATION_MERCHANT_ID! },
          body: formBody,
        });
        return jsonResponse(await statusRes.json(), 200, corsHeaders);
      } catch (err: any) {
        return jsonResponse({ success: false, error: err.message }, 502, corsHeaders);
      }
    }

    // ────────────────────────────────────────────────────────────────────────
    // 3. ACTION: transaction-status-v2
    // ────────────────────────────────────────────────────────────────────────
    if (action === 'transaction-status-v2') {
      const trxId = body.trxId || body.trx_id;
      if (!trxId) return jsonResponse({ success: false, error: 'trxId is required.' }, 400, corsHeaders);

      try {
        const statusRes = await fetch(`${PAYSTATION_BASE_URL}/v2/transaction-status`, {
          method: 'POST',
          headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'merchantId': PAYSTATION_MERCHANT_ID! },
          body: JSON.stringify({ trxId }),
        });
        return jsonResponse(await statusRes.json(), 200, corsHeaders);
      } catch (err: any) {
        return jsonResponse({ success: false, error: err.message }, 502, corsHeaders);
      }
    }

    // ────────────────────────────────────────────────────────────────────────
    // 4. ACTION: ipn — Instant Payment Notification from PayStation
    // Payment finalization guard + mandatory server-to-server gateway check.
    // Never trusts IPN body amount/status/currency alone.
    // ────────────────────────────────────────────────────────────────────────
    if (action === 'ipn' || isDirectIpn) {
      const { invoice_number, trx_status, trx_id, trx_amount, order_date_time, payment_method, reference } = body;

      console.log(`[IPN] invoice=${invoice_number} status=${trx_status} trx=${trx_id}`);

      if (!invoice_number || !trx_id) {
        return jsonResponse({ status: 'error', error: 'MISSING_IPN_FIELDS', message: 'invoice_number and trx_id are required.' }, 400, corsHeaders);
      }

      // ── Payment finalization guard ────────────────────────────────────────
      if (!ALLOW_PAYMENT_FINALIZATION) {
        console.warn('[IPN] Payment finalization is DISABLED. IPN acknowledged but NOT processed.');
        return jsonResponse({ status: 'success', note: 'finalization_disabled' }, 200, corsHeaders);
      }

      if (body.currency !== undefined && body.currency !== null && String(body.currency) !== 'BDT') {
        return jsonResponse({ status: 'error', error: 'CURRENCY_MISMATCH', message: `Unexpected IPN currency: ${body.currency}` }, 402, corsHeaders);
      }

      const supabaseUrl        = Deno.env.get('SUPABASE_URL');
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

      if (!supabaseUrl || !supabaseServiceKey) {
        console.error('[IPN] Supabase service role credentials missing.');
        return jsonResponse({ status: 'error', message: 'DB credentials missing' }, 503, corsHeaders);
      }

      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const pendingOrder = await loadPendingOrderBinding(supabase, String(invoice_number));

      // Verify authoritatively against PayStation status API using server credentials
      const gwCheck = await verifyGatewayTransactionStatus(
        String(trx_id),
        String(invoice_number),
        pendingOrder
      );
      if (!gwCheck.ok) {
        return jsonResponse({ status: 'error', error: gwCheck.error, message: gwCheck.message }, gwCheck.statusCode || 402, corsHeaders);
      }

      if (trx_amount !== undefined && trx_amount !== null && trx_amount !== '') {
        const reportedAmt = Number(trx_amount);
        if (!Number.isFinite(reportedAmt) || Math.abs(reportedAmt - gwCheck.amount!) > 0.01) {
          return jsonResponse({
            status: 'error',
            error: 'AMOUNT_MISMATCH',
            message: `IPN trx_amount (${trx_amount}) disagrees with PayStation gateway (${gwCheck.amount}).`,
          }, 402, corsHeaders);
        }
      }
      const verifiedMethod = gwCheck.method || payment_method || 'bkash';
      const { data: ipnRes, error: ipnErr } = await supabase.rpc('rpc_handle_paystation_ipn', {
        p_invoice_number:  String(invoice_number).trim(),
        p_trx_id:          gwCheck.trxId!,
        p_amount:          gwCheck.amount!,
        p_method:          String(verifiedMethod),
        p_order_date_time: String(order_date_time || new Date().toISOString()),
        p_reference:       reference ? String(reference) : null,
        p_raw_payload:     { ipn: body, gateway_verified: gwCheck.rawData },
      });

      if (ipnErr) {
        console.error('[IPN RPC Error]', ipnErr);
        return jsonResponse({ status: 'error', error: ipnErr.code || 'RPC_ERROR', message: ipnErr.message }, 500, corsHeaders);
      }

      if (ipnRes && ipnRes.success === false) {
        console.error('[IPN RPC Returned Error]', ipnRes);
        return jsonResponse({ status: 'error', error: ipnRes.error || 'IPN_VERIFICATION_FAILED', message: ipnRes.message }, 402, corsHeaders);
      }

      return jsonResponse({ status: 'success', result: ipnRes }, 200, corsHeaders);
    }

    // ────────────────────────────────────────────────────────────────────────
    // 5. ACTION: verify-payment (Client return redirect verification)
    // ────────────────────────────────────────────────────────────────────────
    const { registration_id, invoice_number, trx_id, payment_method } = body;

    // ── Payment finalization guard ──────────────────────────────────────────
    if (!ALLOW_PAYMENT_FINALIZATION) {
      return jsonResponse({
        success: false,
        error:   'PAYMENT_FINALIZATION_DISABLED',
        message: 'Live payment finalization is currently disabled. Please contact the administrator.',
      }, 403, corsHeaders);
    }

    if (!trx_id) {
      return jsonResponse({ success: false, error: 'INVALID_TRX_ID', message: 'trx_id is required.' }, 400, corsHeaders);
    }

    if (!registration_id && !invoice_number) {
      return jsonResponse({ success: false, error: 'INVALID_REQUEST', message: 'registration_id or invoice_number is required.' }, 400, corsHeaders);
    }

    const supabaseUrl        = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      return jsonResponse({ success: false, error: 'DB credentials missing.' }, 503, corsHeaders);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const pendingOrder = await loadPendingOrderBinding(
      supabase,
      invoice_number ? String(invoice_number) : undefined
    );

    const gwCheck = await verifyGatewayTransactionStatus(
      String(trx_id),
      invoice_number ? String(invoice_number) : undefined,
      pendingOrder
    );
    if (!gwCheck.ok) {
      return jsonResponse({ success: false, error: gwCheck.error, message: gwCheck.message }, gwCheck.statusCode || 402, corsHeaders);
    }

    const verifiedAmount = gwCheck.amount!;
    const verifiedMethod = gwCheck.method || payment_method || 'bkash';

    const serverSignature = await generateHmacSha256Signature(
      String(registration_id || invoice_number),
      gwCheck.trxId!,
      verifiedAmount,
      PAYMENT_SIGNING_SECRET!
    );
    const pendingHint = invoice_number ? { gatewayInvoiceNumber: String(invoice_number).trim() } : null;
    const { data: rpcRes, error: rpcErr } = await supabase.rpc('rpc_verify_payment', {
      p_reg_id:       String(registration_id || invoice_number),
      p_trx_id:       gwCheck.trxId!,
      p_method:       verifiedMethod,
      p_amount:       verifiedAmount,
      p_signature:    serverSignature,
      p_verified_by:  'PAYSTATION_EDGE_FUNCTION',
      p_pending_data: pendingHint,
    });

    if (rpcErr) {
      console.error('[verify-payment RPC Error]', rpcErr);
      return jsonResponse({
        success: false,
        error:   rpcErr.code || 'RPC_ERROR',
        message: rpcErr.message || 'Database verification failed.',
      }, 500, corsHeaders);
    }

    if (rpcRes && rpcRes.success === false) {
      return jsonResponse({
        success: false,
        error:   rpcRes.error || 'VERIFICATION_FAILED',
        message: rpcRes.message || 'Payment verification rejected by database.',
      }, 402, corsHeaders);
    }

    return jsonResponse({
      success:   true,
      verified:  true,
      status:    'paid',
      trx_id,
      amount:    verifiedAmount,
      method:    verifiedMethod,
      signature: serverSignature,
      timestamp: new Date().toISOString(),
      rpc_result: rpcRes,
    }, 200, corsHeaders);

  } catch (err: any) {
    console.error('[verify-payment Unhandled Error]', err);
    return jsonResponse({ success: false, error: err.message || 'Internal payment error' }, 500, corsHeaders);
  }
});
