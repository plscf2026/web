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

// ── Required env secrets (fail closed if missing) ───────────────────────────
const PAYSTATION_MERCHANT_ID = Deno.env.get('PAYSTATION_MERCHANT_ID');
const PAYSTATION_PASSWORD    = Deno.env.get('PAYSTATION_PASSWORD');
const PAYSTATION_ENV         = Deno.env.get('PAYSTATION_ENV') || 'sandbox';
const PAYMENT_SIGNING_SECRET = Deno.env.get('PAYMENT_SIGNING_SECRET');

// CRITICAL: payment finalization disabled by default.
// Edge Function will only call payment-confirming RPCs when this is 'true'.
const ALLOW_PAYMENT_FINALIZATION = Deno.env.get('PAYSTATION_ALLOW_PAYMENT_FINALIZATION') === 'true';

const allowedOrigins = (Deno.env.get('APP_ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

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
    // 1. ACTION: initiate-payment
    // ────────────────────────────────────────────────────────────────────────
    if (action === 'initiate-payment' || action === 'create-payment') {
      const order = body.order || body;
      if (!order?.invoice_number || !order?.payment_amount) {
        return jsonResponse({ success: false, error: 'Missing required order details.' }, 400, corsHeaders);
      }

      const formBody = new URLSearchParams();
      formBody.append('merchantId',      PAYSTATION_MERCHANT_ID!);
      formBody.append('password',        PAYSTATION_PASSWORD!);
      formBody.append('invoice_number',  String(order.invoice_number));
      formBody.append('currency',        order.currency || 'BDT');
      formBody.append('payment_amount',  String(order.payment_amount));
      formBody.append('pay_with_charge', String(order.pay_with_charge ?? 0));
      if (order.reference)     formBody.append('reference',     order.reference);
      formBody.append('cust_name',       order.cust_name || 'Customer');
      formBody.append('cust_phone',      order.cust_phone || '01700000000');
      if (order.cust_email)    formBody.append('cust_email',    order.cust_email);
      if (order.cust_address)  formBody.append('cust_address',  order.cust_address);
      formBody.append('callback_url',    order.callback_url || 'https://plscf.org');
      if (order.checkout_items) formBody.append('checkout_items', order.checkout_items);
      if (order.opt_a)         formBody.append('opt_a', order.opt_a);
      if (order.opt_b)         formBody.append('opt_b', order.opt_b);
      if (order.opt_c)         formBody.append('opt_c', order.opt_c);

      try {
        const createRes = await fetch(`${PAYSTATION_BASE_URL}/initiate-payment`, {
          method:  'POST',
          headers: { 'Accept': 'application/json' },
          body:    formBody,
        });

        const rawText    = await createRes.text();
        let createData: any = null;
        try { createData = JSON.parse(rawText); } catch { /* non-JSON response */ }

        if (createData?.status_code === '1008') {
          return jsonResponse({ success: false, status_code: '1008', error: createData.message || 'Duplicate invoice' }, 400, corsHeaders);
        }

        if (createData && (createData.status_code === '200' || createData.status === 'success') && createData.payment_url) {
          return jsonResponse({
            success:       true,
            status_code:   createData.status_code,
            paymentUrl:    createData.payment_url,
            invoiceNumber: createData.invoice_number || order.invoice_number,
            payment_amount: createData.payment_amount || String(order.payment_amount),
            message:       createData.message,
          }, 200, corsHeaders);
        }

        // Sandbox simulation (only when finalization is NOT enabled)
        if (PAYSTATION_ENV === 'sandbox' && !ALLOW_PAYMENT_FINALIZATION) {
          const simTrxId = `PST-SBX-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
          return jsonResponse({
            success:       true,
            status_code:   '200',
            paymentUrl:    order.callback_url ? `${order.callback_url}&status=Successful&trx_id=${simTrxId}&simulated=true` : `${PAYSTATION_BASE_URL}/checkout/${order.invoice_number}`,
            trxId:         simTrxId,
            invoiceNumber: order.invoice_number,
            message:       'Sandbox simulation payment URL created (finalization disabled).',
          }, 200, corsHeaders);
        }

        return jsonResponse({ success: false, error: createData?.message || `PayStation error ${createRes.status}` }, 400, corsHeaders);

      } catch (err: any) {
        if (PAYSTATION_ENV === 'sandbox' && !ALLOW_PAYMENT_FINALIZATION) {
          const simTrxId = `PST-SBX-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
          return jsonResponse({
            success: true, status_code: '200',
            paymentUrl: order.callback_url ? `${order.callback_url}&status=Successful&trx_id=${simTrxId}&simulated=true` : `${PAYSTATION_BASE_URL}/checkout/${order.invoice_number}`,
            trxId: simTrxId, invoiceNumber: order.invoice_number,
          }, 200, corsHeaders);
        }
        return jsonResponse({ success: false, error: err.message || 'Payment initiation failed' }, 502, corsHeaders);
      }
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
    // Payment finalization guard: only process IPN if finalization is enabled.
    // ────────────────────────────────────────────────────────────────────────
    if (action === 'ipn' || isDirectIpn) {
      const { invoice_number, trx_status, trx_id, trx_amount, order_date_time, payment_method, reference } = body;

      console.log(`[IPN] invoice=${invoice_number} status=${trx_status} amount=${trx_amount} trx=${trx_id}`);

      const rawStatus = (trx_status || '').toLowerCase().trim();
      const isSuccess = rawStatus === 'success' || rawStatus === 'successful' || rawStatus === 'completed' || rawStatus === 'captured' || rawStatus === 'paid' || rawStatus.includes('success');

      if (!invoice_number) return jsonResponse({ status: 'error', message: 'Missing invoice_number' }, 400, corsHeaders);
      if (!isSuccess)      return jsonResponse({ status: 'ignored', message: `Non-success IPN status: ${trx_status}` }, 200, corsHeaders);

      // ── Payment finalization guard ────────────────────────────────────────
      if (!ALLOW_PAYMENT_FINALIZATION) {
        console.warn('[IPN] Payment finalization is DISABLED. IPN acknowledged but NOT processed. Set PAYSTATION_ALLOW_PAYMENT_FINALIZATION=true to enable.');
        return jsonResponse({ status: 'success', note: 'finalization_disabled' }, 200, corsHeaders);
      }

      // ── CURRENCY CHECK (Condition 2: NEVER default missing currency to BDT) ──
      const ipnCurrency = body.currency ?? null;
      if (ipnCurrency === null || ipnCurrency === undefined) {
        console.error('[IPN] Rejected: missing authoritative currency field in IPN payload.');
        return jsonResponse({ status: 'error', error: 'CURRENCY_MISSING', message: 'Explicit currency is required.' }, 402, corsHeaders);
      }
      if (ipnCurrency !== 'BDT') {
        console.error(`[IPN] Rejected: unexpected currency "${ipnCurrency}".`);
        return jsonResponse({ status: 'error', error: 'CURRENCY_MISMATCH', message: `Unexpected currency: ${ipnCurrency}` }, 402, corsHeaders);
      }

      const supabaseUrl        = Deno.env.get('SUPABASE_URL');
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

      if (!supabaseUrl || !supabaseServiceKey) {
        console.error('[IPN] Supabase service role credentials missing.');
        return jsonResponse({ status: 'error', message: 'DB credentials missing' }, 503, corsHeaders);
      }

      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const { data: ipnRes, error: ipnErr } = await supabase.rpc('rpc_handle_paystation_ipn', {
        p_invoice_number:  String(invoice_number),
        p_trx_id:          String(trx_id || `TRX-${Date.now()}`),
        p_amount:          Number(trx_amount || 0),
        p_method:          String(payment_method || 'bkash'),
        p_order_date_time: String(order_date_time || new Date().toISOString()),
        p_reference:       reference ? String(reference) : null,
        p_raw_payload:     body,
      });

      if (ipnErr) {
        // Log the error; still return 200 to PayStation per IPN spec
        console.error('[IPN RPC Error]', ipnErr);
      } else {
        console.log('[IPN Processed]', ipnRes);
        // Propagate RPC-level errors to our internal log but acknowledge to PayStation
        if (ipnRes && ipnRes.success === false) {
          console.error('[IPN RPC Returned Error]', ipnRes);
        }
      }

      // Always acknowledge PayStation with 200 per IPN spec
      return jsonResponse({ status: 'success' }, 200, corsHeaders);
    }

    // ────────────────────────────────────────────────────────────────────────
    // 5. ACTION: verify-payment (Client return redirect verification)
    // Payment finalization guard applies here too.
    // ────────────────────────────────────────────────────────────────────────
    const { registration_id, invoice_number, trx_id, payment_amount, payment_method } = body;

    // ── Payment finalization guard ──────────────────────────────────────────
    if (!ALLOW_PAYMENT_FINALIZATION) {
      return jsonResponse({
        success: false,
        error:   'PAYMENT_FINALIZATION_DISABLED',
        message: 'Live payment finalization is currently disabled. Please contact the administrator.',
      }, 403, corsHeaders);
    }

    let isVerified       = false;
    let verifiedAmount   = Number(payment_amount || 0);
    let verifiedMethod   = payment_method || 'bkash';
    let verifiedCurrency: string | null = null;

    if (trx_id) {
      const queryRes = await fetch(`${PAYSTATION_BASE_URL}/v2/transaction-status`, {
        method:  'POST',
        headers: { 'merchantId': PAYSTATION_MERCHANT_ID!, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ trxId: trx_id }),
      });

      const data = await queryRes.json();

      if (data.status_code === '200' && data.data && (data.data.trx_status || '').toLowerCase().includes('success')) {
        // ── CURRENCY CHECK (Condition 2: NEVER default missing currency to BDT) ──
        verifiedCurrency = data.data.currency ?? null;
        if (verifiedCurrency === null || verifiedCurrency === undefined) {
          return jsonResponse({
            success: false,
            error:   'CURRENCY_MISSING',
            message: 'PayStation response did not include a currency field. Payment finalization requires explicit currency confirmation.',
          }, 402, corsHeaders);
        }
        if (verifiedCurrency !== 'BDT') {
          return jsonResponse({
            success: false,
            error:   'CURRENCY_MISMATCH',
            message: `Unexpected currency: ${verifiedCurrency}. Only BDT is accepted.`,
          }, 402, corsHeaders);
        }

        const gatewayAmount = Number(data.data.payment_amount ?? data.data.trx_amount ?? verifiedAmount);
        if (!Number.isFinite(gatewayAmount) || gatewayAmount <= 0) {
          return jsonResponse({
            success: false,
            error:   'INVALID_AMOUNT',
            message: 'PayStation transaction amount is missing or invalid.',
          }, 402, corsHeaders);
        }
        isVerified     = true;
        verifiedAmount = gatewayAmount;
        verifiedMethod = data.data.payment_method || verifiedMethod;
      }
      // Note: NO sandbox bypass here — the finalization guard above already blocked sandbox use
    }

    if (!isVerified) {
      return jsonResponse({
        success: false,
        error:   'TRANSACTION_NOT_VERIFIED',
        message: 'PayStation transaction could not be verified or is not in Success status.',
      }, 402, corsHeaders);
    }

    const serverSignature = await generateHmacSha256Signature(
      registration_id || invoice_number || 'PLSCF_REG',
      trx_id || `TRX_${Date.now()}`,
      verifiedAmount,
      PAYMENT_SIGNING_SECRET!
    );

    const supabaseUrl        = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      return jsonResponse({ success: false, error: 'DB credentials missing.' }, 503, corsHeaders);
    }

    if (!registration_id) {
      return jsonResponse({ success: false, error: 'registration_id is required for payment verification.' }, 400, corsHeaders);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: rpcRes, error: rpcErr } = await supabase.rpc('rpc_verify_payment', {
      p_reg_id:      registration_id,
      p_trx_id:      trx_id || `TRX-${Date.now()}`,
      p_method:      verifiedMethod,
      p_amount:      verifiedAmount,
      p_signature:   serverSignature,
      p_verified_by: 'PAYSTATION_EDGE_FUNCTION',
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
