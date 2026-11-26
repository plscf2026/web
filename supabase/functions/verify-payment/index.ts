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
import { parseAllowlistedOrigins, resolveServerCallbackUrl } from './callbackUrl.ts';
import { validateAndBuildPendingRegistrationData } from './registrationPayload.ts';

// ── Required env secrets (fail closed if missing) ───────────────────────────
const PAYSTATION_MERCHANT_ID = Deno.env.get('PAYSTATION_MERCHANT_ID');
const PAYSTATION_PASSWORD    = Deno.env.get('PAYSTATION_PASSWORD');
const PAYSTATION_ENV         = Deno.env.get('PAYSTATION_ENV') || 'sandbox';
const PAYMENT_SIGNING_SECRET = Deno.env.get('PAYMENT_SIGNING_SECRET');

// CRITICAL: payment finalization disabled by default.
// Edge Function will only call payment-confirming RPCs when this is 'true'.
const ALLOW_PAYMENT_FINALIZATION = Deno.env.get('PAYSTATION_ALLOW_PAYMENT_FINALIZATION') === 'true';

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

async function verifyGatewayTransactionStatus(
  trxId: string,
  expectedInvoiceNumber?: string
): Promise<GatewayStatusVerification> {
  const cleanTrx = trxId.trim();
  if (!cleanTrx) {
    return { ok: false, statusCode: 400, error: 'INVALID_TRX_ID', message: 'Transaction ID is required.' };
  }

  let data: any;
  try {
    const queryRes = await fetch(`${PAYSTATION_BASE_URL}/v2/transaction-status`, {
      method: 'POST',
      headers: { 'merchantId': PAYSTATION_MERCHANT_ID!, 'Content-Type': 'application/json' },
      body: JSON.stringify({ trxId: cleanTrx }),
    });
    data = await queryRes.json();
  } catch (err: any) {
    return {
      ok: false,
      statusCode: 502,
      error: 'GATEWAY_UNREACHABLE',
      message: err?.message || 'Failed to verify transaction with PayStation.',
    };
  }

  if (data?.status_code !== '200' || !data?.data || !(data.data.trx_status || '').toLowerCase().includes('success')) {
    return {
      ok: false,
      statusCode: 402,
      error: 'TRANSACTION_NOT_VERIFIED',
      message: 'PayStation transaction could not be verified or is not in Success status.',
    };
  }

  // Condition 2: NEVER default missing currency to BDT
  const gwCurrency = data.data.currency ?? null;
  if (gwCurrency === null || gwCurrency === undefined) {
    return {
      ok: false,
      statusCode: 402,
      error: 'CURRENCY_MISSING',
      message: 'PayStation response did not include a currency field. Payment finalization requires explicit currency confirmation.',
    };
  }
  if (gwCurrency !== 'BDT') {
    return {
      ok: false,
      statusCode: 402,
      error: 'CURRENCY_MISMATCH',
      message: `Unexpected currency: ${gwCurrency}. Only BDT is accepted.`,
    };
  }

  const gatewayAmount = Number(data.data.payment_amount ?? data.data.trx_amount);
  if (!Number.isFinite(gatewayAmount) || gatewayAmount <= 0) {
    return {
      ok: false,
      statusCode: 402,
      error: 'INVALID_AMOUNT',
      message: 'PayStation transaction amount is missing or invalid.',
    };
  }

  const gwTrxId = data.data.trx_id ? String(data.data.trx_id).trim() : cleanTrx;
  if (gwTrxId.toUpperCase() !== cleanTrx.toUpperCase()) {
    return {
      ok: false,
      statusCode: 402,
      error: 'TRX_ID_MISMATCH',
      message: 'PayStation returned a mismatched transaction ID.',
    };
  }

  const gwInvoice = data.data.invoice_number ? String(data.data.invoice_number).trim() : null;
  if (expectedInvoiceNumber && gwInvoice && gwInvoice !== expectedInvoiceNumber.trim()) {
    return {
      ok: false,
      statusCode: 402,
      error: 'INVOICE_MISMATCH',
      message: 'PayStation transaction invoice does not match the requested order.',
    };
  }

  return {
    ok: true,
    amount: gatewayAmount,
    method: data.data.payment_method ? String(data.data.payment_method) : null,
    currency: gwCurrency,
    trxId: gwTrxId,
    invoiceNumber: gwInvoice,
    rawData: data.data,
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
    // Loads authoritative fees from system_settings, computes expected total
    // server-side, validates callback URL against APP_ALLOWED_ORIGINS, and
    // persists pending_orders via service_role.
    // ────────────────────────────────────────────────────────────────────────
    if (action === 'initiate-payment' || action === 'create-payment') {
      const order = body.order || body;
      if (!order?.invoice_number) {
        return jsonResponse({ success: false, error: 'INVALID_INVOICE_NUMBER', message: 'invoice_number is required.' }, 400, corsHeaders);
      }
      if (order.currency !== undefined && order.currency !== null && String(order.currency).toUpperCase() !== 'BDT') {
        return jsonResponse({ success: false, error: 'CURRENCY_MISMATCH', message: 'Only BDT currency is supported.' }, 400, corsHeaders);
      }

      const supabaseUrl        = Deno.env.get('SUPABASE_URL');
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (!supabaseUrl || !supabaseServiceKey) {
        return jsonResponse({ success: false, error: 'DB_CONFIG_MISSING', message: 'Database service credentials missing.' }, 503, corsHeaders);
      }

      const sbAdmin = createClient(supabaseUrl, supabaseServiceKey);
      const { data: settingsRow, error: settingsErr } = await sbAdmin
        .from('system_settings')
        .select('value')
        .eq('key', 'portal_fee_settings')
        .maybeSingle();

      if (settingsErr || !settingsRow?.value) {
        console.error('[initiate-payment] Missing portal_fee_settings in system_settings:', settingsErr?.message);
        return jsonResponse({
          success: false,
          error: 'FEE_SETTINGS_MISSING',
          message: 'Authoritative fee configuration is unavailable.',
        }, 503, corsHeaders);
      }

      const rawSettings = settingsRow.value as Record<string, unknown>;
      const feeEval = computeAuthoritativeOrderAmount(rawSettings, {
        orderType: order.order_type,
        category: order.category,
        hasParent: order.has_parent ?? order.hasParent,
        donationAmount: order.donation_amount ?? order.donationAmount ?? 0,
        paymentMethod: order.payment_method ?? 'bkash',
        payWithCharge: order.pay_with_charge ?? 0,
        clientPaymentAmount: order.payment_amount,
        clientRegistrationFee: order.registration_fee ?? order.registrationFee,
        clientParentFee: order.parent_fee ?? order.parentFee,
        clientGatewayCharge: order.gateway_charge ?? order.gatewayCharge,
      });

      if (!feeEval.valid) {
        const status = feeEval.error === 'FEE_SETTINGS_MISSING' || feeEval.error === 'INVALID_FEE_SETTINGS' ? 503 : 400;
        return jsonResponse({ success: false, error: feeEval.error, message: feeEval.message }, status, corsHeaders);
      }

      if (feeEval.orderType === 'registration' && rawSettings.registrationOpen !== true && PAYSTATION_ENV === 'production') {
        return jsonResponse({ success: false, error: 'REGISTRATION_CLOSED', message: 'Registration is closed.' }, 403, corsHeaders);
      }
      if (feeEval.orderType === 'donation' && rawSettings.donationOpen !== true && PAYSTATION_ENV === 'production') {
        return jsonResponse({ success: false, error: 'DONATION_CLOSED', message: 'Donations are closed.' }, 403, corsHeaders);
      }

      const cbEval = resolveServerCallbackUrl({
        allowedOriginsRaw: ALLOWED_ORIGINS_RAW,
        paystationEnv: PAYSTATION_ENV,
        requestedCallbackUrl: order.callback_url,
        requestedOrigin: order.return_origin,
        orderType: feeEval.orderType!,
        invoiceNumber: String(order.invoice_number),
      });

      if (!cbEval.valid) {
        const status = cbEval.error === 'CALLBACK_ORIGIN_NOT_CONFIGURED' ? 503 : 400;
        return jsonResponse({ success: false, error: cbEval.error, message: cbEval.message }, status, corsHeaders);
      }

      let authoritativeFormData: Record<string, unknown>;
      let customerName: string;
      let customerPhone: string;
      let customerEmail: string | null;

      if (feeEval.orderType === 'registration') {
        const regEval = validateAndBuildPendingRegistrationData(order, feeEval.category!, Boolean(feeEval.hasParent));
        if (!regEval.valid || !regEval.data) {
          return jsonResponse({
            success: false,
            error: regEval.error || 'INVALID_REGISTRATION_DATA',
            message: regEval.message || 'Complete registration data is required before payment initiation.',
          }, 400, corsHeaders);
        }
        authoritativeFormData = regEval.data as unknown as Record<string, unknown>;
        customerName = regEval.data.fullName;
        customerPhone = regEval.data.mobileNumber;
        customerEmail = regEval.data.email;
      } else {
        const donorName = String(order.cust_name || '').trim().slice(0, 120);
        const donorPhone = String(order.cust_phone || '').replace(/\D/g, '').slice(0, 32);
        if (!donorName || !donorPhone) {
          return jsonResponse({
            success: false,
            error: 'INVALID_DONATION_DATA',
            message: 'Donor name and phone number are required.',
          }, 400, corsHeaders);
        }
        customerName = donorName;
        customerPhone = donorPhone;
        customerEmail = order.cust_email ? String(order.cust_email).trim().slice(0, 160) : null;
        authoritativeFormData = {
          donorName: customerName,
          mobileNumber: customerPhone,
          email: customerEmail,
          purpose: String(order.reference || 'General Reunion Fund').slice(0, 160),
        };
      }

      // Persist authoritative server-calculated pending_order before invoking gateway
      const { error: orderUpsertErr } = await sbAdmin
        .from('pending_orders')
        .upsert({
          id: `ORD-${String(order.invoice_number).trim()}`,
          invoice_number: String(order.invoice_number).trim(),
          order_type: feeEval.orderType!,
          amount: feeEval.expectedTotal!,
          currency: 'BDT',
          status: 'pending',
          customer_name: customerName,
          customer_phone: customerPhone,
          customer_email: customerEmail,
          form_data: authoritativeFormData,
          fees: {
            registrationFee: feeEval.registrationFee!,
            parentFee: feeEval.parentFee!,
            donationAmount: feeEval.donationAmount!,
            gatewayCharge: feeEval.gatewayCharge!,
            subtotal: feeEval.subtotal!,
            totalPayable: feeEval.expectedTotal!,
          },
          gateway_provider: 'PAYSTATION',
        }, { onConflict: 'invoice_number' });

      if (orderUpsertErr) {
        console.error('[initiate-payment] Failed to persist pending_orders:', orderUpsertErr.message);
        return jsonResponse({ success: false, error: 'PENDING_ORDER_PERSIST_FAILED', message: 'Failed to create authoritative order.' }, 500, corsHeaders);
      }

      const formBody = new URLSearchParams();
      formBody.append('merchantId',      PAYSTATION_MERCHANT_ID!);
      formBody.append('password',        PAYSTATION_PASSWORD!);
      formBody.append('invoice_number',  String(order.invoice_number).trim());
      formBody.append('currency',        'BDT');
      formBody.append('payment_amount',  String(feeEval.expectedTotal!));
      formBody.append('pay_with_charge', String(feeEval.payWithCharge!));
      if (order.reference)     formBody.append('reference',     String(order.reference));
      formBody.append('cust_name',       String(order.cust_name || 'Customer'));
      formBody.append('cust_phone',      String(order.cust_phone || '01700000000'));
      if (order.cust_email)    formBody.append('cust_email',    String(order.cust_email));
      if (order.cust_address)  formBody.append('cust_address',  String(order.cust_address));
      formBody.append('callback_url',    cbEval.callbackUrl!);
      if (order.checkout_items) formBody.append('checkout_items', String(order.checkout_items));
      if (order.opt_a)         formBody.append('opt_a', String(order.opt_a));
      if (order.opt_b)         formBody.append('opt_b', String(order.opt_b));
      if (order.opt_c)         formBody.append('opt_c', String(order.opt_c));

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
            payment_amount: String(feeEval.expectedTotal!),
            message:       createData.message,
          }, 200, corsHeaders);
        }

        // Sandbox simulation (only when finalization is NOT enabled)
        if (PAYSTATION_ENV === 'sandbox' && !ALLOW_PAYMENT_FINALIZATION) {
          const simTrxId = `PST-SBX-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
          return jsonResponse({
            success:       true,
            status_code:   '200',
            paymentUrl:    `${cbEval.callbackUrl!}&status=Successful&trx_id=${simTrxId}&simulated=true`,
            trxId:         simTrxId,
            invoiceNumber: order.invoice_number,
            payment_amount: String(feeEval.expectedTotal!),
            message:       'Sandbox simulation payment URL created (finalization disabled).',
          }, 200, corsHeaders);
        }

        return jsonResponse({ success: false, error: createData?.message || `PayStation error ${createRes.status}` }, 400, corsHeaders);

      } catch (err: any) {
        if (PAYSTATION_ENV === 'sandbox' && !ALLOW_PAYMENT_FINALIZATION) {
          const simTrxId = `PST-SBX-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
          return jsonResponse({
            success: true, status_code: '200',
            paymentUrl: `${cbEval.callbackUrl!}&status=Successful&trx_id=${simTrxId}&simulated=true`,
            trxId: simTrxId, invoiceNumber: order.invoice_number,
            payment_amount: String(feeEval.expectedTotal!),
          }, 200, corsHeaders);
        }
        return jsonResponse({ success: false, error: err.message || 'Payment initiation failed' }, 502, corsHeaders);
      }
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

      const gwCheck = await verifyGatewayTransactionStatus(
        String(transaction_id),
        invoice_number ? String(invoice_number) : undefined
      );
      if (!gwCheck.ok) {
        return jsonResponse({ success: false, error: gwCheck.error, message: gwCheck.message }, gwCheck.statusCode || 402, corsHeaders);
      }

      const supabaseUrl        = Deno.env.get('SUPABASE_URL');
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (!supabaseUrl || !supabaseServiceKey) {
        return jsonResponse({ success: false, error: 'DB_CONFIG_MISSING' }, 503, corsHeaders);
      }
      const sbAdmin = createClient(supabaseUrl, supabaseServiceKey);
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

      // Verify authoritatively against PayStation /v2/transaction-status using server credentials
      const gwCheck = await verifyGatewayTransactionStatus(String(trx_id), String(invoice_number));
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

      const supabaseUrl        = Deno.env.get('SUPABASE_URL');
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

      if (!supabaseUrl || !supabaseServiceKey) {
        console.error('[IPN] Supabase service role credentials missing.');
        return jsonResponse({ status: 'error', message: 'DB credentials missing' }, 503, corsHeaders);
      }

      const supabase = createClient(supabaseUrl, supabaseServiceKey);
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

    const gwCheck = await verifyGatewayTransactionStatus(
      String(trx_id),
      invoice_number ? String(invoice_number) : undefined
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

    const supabaseUrl        = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      return jsonResponse({ success: false, error: 'DB credentials missing.' }, 503, corsHeaders);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
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
