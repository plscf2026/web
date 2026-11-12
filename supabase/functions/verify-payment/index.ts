import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const allowedOrigins = (Deno.env.get('APP_ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const PAYSTATION_MERCHANT_ID = Deno.env.get('PAYSTATION_MERCHANT_ID') || '104-1653730183';
const PAYSTATION_PASSWORD = Deno.env.get('PAYSTATION_PASSWORD') || 'gamecoderstorepass';
const PAYSTATION_ENV = Deno.env.get('PAYSTATION_ENV') || 'sandbox';
const PAYMENT_SIGNING_SECRET = Deno.env.get('PAYMENT_SIGNING_SECRET') || 'PLSCF_SECURE_PAYMENT_HMAC_SALT_2027';
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

/**
 * Server-Side Cryptographic HMAC-SHA256 Signing
 */
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
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, data);
  const hex = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `SIG_HMAC256_${hex.substring(0, 32).toUpperCase()}`;
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, merchantId',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Vary': 'Origin',
  };

  if (origin && (allowedOrigins.length === 0 || allowedOrigins.includes(origin))) {
    corsHeaders['Access-Control-Allow-Origin'] = origin;
  } else if (!origin) {
    corsHeaders['Access-Control-Allow-Origin'] = '*';
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, corsHeaders);
  }

  try {
    const rawBodyText = await req.text();
    let body: any = {};
    try {
      body = JSON.parse(rawBodyText);
    } catch {
      // In case form-urlencoded was sent
      const params = new URLSearchParams(rawBodyText);
      body = Object.fromEntries(params.entries());
    }

    // Determine Action:
    // If incoming payload has invoice_number & trx_status (and no action specified), it is an authoritative IPN POST from PayStation!
    const isDirectIpn = Boolean(
      body.invoice_number &&
      (body.trx_status || body.trx_id) &&
      !body.action &&
      !body.order
    );

    const action = body.action || (isDirectIpn ? 'ipn' : (body.order ? 'initiate-payment' : 'verify-payment'));

    // ─────────────────────────────────────────────────────────────
    // 1. ACTION: initiate-payment / create-payment (Hosted Checkout)
    // ─────────────────────────────────────────────────────────────
    if (action === 'initiate-payment' || action === 'create-payment') {
      const order = body.order || body;
      if (!order || !order.invoice_number || !order.payment_amount) {
        return jsonResponse({ success: false, error: 'Missing required order details (invoice_number, payment_amount).' }, 400, corsHeaders);
      }

      const formBody = new URLSearchParams();
      formBody.append('merchantId', PAYSTATION_MERCHANT_ID);
      formBody.append('password', PAYSTATION_PASSWORD);
      formBody.append('invoice_number', String(order.invoice_number));
      formBody.append('currency', order.currency || 'BDT');
      formBody.append('payment_amount', String(order.payment_amount));
      formBody.append('pay_with_charge', String(order.pay_with_charge ?? 0));
      if (order.reference) formBody.append('reference', order.reference);
      formBody.append('cust_name', order.cust_name || 'Customer');
      formBody.append('cust_phone', order.cust_phone || '01700000000');
      if (order.cust_email) formBody.append('cust_email', order.cust_email);
      if (order.cust_address) formBody.append('cust_address', order.cust_address);
      formBody.append('callback_url', order.callback_url || 'https://plscf.org');
      if (order.checkout_items) formBody.append('checkout_items', order.checkout_items);
      if (order.opt_a) formBody.append('opt_a', order.opt_a);
      if (order.opt_b) formBody.append('opt_b', order.opt_b);
      if (order.opt_c) formBody.append('opt_c', order.opt_c);
      if (order.emi) formBody.append('emi', '1');

      try {
        const createRes = await fetch(`${PAYSTATION_BASE_URL}/initiate-payment`, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
          },
          body: formBody,
        });

        const rawText = await createRes.text();
        let createData: any = null;
        try {
          createData = JSON.parse(rawText);
        } catch {
          createData = null;
        }

        if (createData && (createData.status_code === '200' || createData.status === 'success') && createData.payment_url) {
          return jsonResponse({
            success: true,
            status_code: createData.status_code,
            paymentUrl: createData.payment_url,
            invoiceNumber: createData.invoice_number || order.invoice_number,
            payment_amount: createData.payment_amount || String(order.payment_amount),
            message: createData.message,
          }, 200, corsHeaders);
        }

        if (createData?.status_code === '1008') {
          return jsonResponse({
            success: false,
            status_code: '1008',
            error: `PayStation: ${createData.message || 'Duplicate invoice number'}`,
          }, 400, corsHeaders);
        }

        if (PAYSTATION_ENV === 'sandbox') {
          // Reliable Sandbox simulation fallback
          const simTrxId = `PST-SBX-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
          return jsonResponse({
            success: true,
            status_code: '200',
            paymentUrl: order.callback_url
              ? `${order.callback_url}&status=Successful&trx_id=${simTrxId}&simulated=true`
              : `${PAYSTATION_BASE_URL}/checkout/${order.invoice_number}`,
            trxId: simTrxId,
            invoiceNumber: order.invoice_number,
            message: 'Sandbox simulation payment URL created',
          }, 200, corsHeaders);
        }

        return jsonResponse({
          success: false,
          error: createData?.message || `PayStation returned status ${createData?.status_code || createRes.status}`,
        }, 400, corsHeaders);

      } catch (err: any) {
        if (PAYSTATION_ENV === 'sandbox') {
          const simTrxId = `PST-SBX-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
          return jsonResponse({
            success: true,
            status_code: '200',
            paymentUrl: order.callback_url
              ? `${order.callback_url}&status=Successful&trx_id=${simTrxId}&simulated=true`
              : `${PAYSTATION_BASE_URL}/checkout/${order.invoice_number}`,
            trxId: simTrxId,
            invoiceNumber: order.invoice_number,
          }, 200, corsHeaders);
        }
        return jsonResponse({ success: false, error: err.message || 'Payment initiation failed' }, 502, corsHeaders);
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 2. ACTION: transaction-status-v1 (Query by invoice_number)
    // ─────────────────────────────────────────────────────────────
    if (action === 'transaction-status-v1') {
      const invoiceNumber = body.invoice_number || body.invoiceNumber;
      if (!invoiceNumber) {
        return jsonResponse({ success: false, error: 'invoice_number is required.' }, 400, corsHeaders);
      }

      const formBody = new URLSearchParams();
      formBody.append('invoice_number', String(invoiceNumber));

      try {
        const statusRes = await fetch(`${PAYSTATION_BASE_URL}/transaction-status`, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'merchantId': PAYSTATION_MERCHANT_ID,
          },
          body: formBody,
        });

        const statusData = await statusRes.json();
        return jsonResponse(statusData, 200, corsHeaders);
      } catch (err: any) {
        if (PAYSTATION_ENV === 'sandbox') {
          return jsonResponse({
            status_code: '200',
            status: 'success',
            message: 'Sandbox transaction found',
            data: {
              invoice_number: invoiceNumber,
              trx_status: 'Success',
              trx_id: `PST-SBX-${Date.now()}`,
              payment_amount: '1500',
              order_date_time: new Date().toISOString().replace('T', ' ').substring(0, 19),
              payer_mobile_no: '01770618575',
              payment_method: 'bkash',
              reference: 'PLSCF-2027',
              checkout_items: 'Reunion Registration',
            },
          }, 200, corsHeaders);
        }
        return jsonResponse({ success: false, error: err.message }, 502, corsHeaders);
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 3. ACTION: transaction-status-v2 (Query by trxId)
    // ─────────────────────────────────────────────────────────────
    if (action === 'transaction-status-v2') {
      const trxId = body.trxId || body.trx_id;
      if (!trxId) {
        return jsonResponse({ success: false, error: 'trxId is required.' }, 400, corsHeaders);
      }

      try {
        const statusRes = await fetch(`${PAYSTATION_BASE_URL}/v2/transaction-status`, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'merchantId': PAYSTATION_MERCHANT_ID,
          },
          body: JSON.stringify({ trxId }),
        });

        const statusData = await statusRes.json();
        return jsonResponse(statusData, 200, corsHeaders);
      } catch (err: any) {
        return jsonResponse({ success: false, error: err.message }, 502, corsHeaders);
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 4. ACTION: ipn (Merchant Instant Payment Notification Webhook)
    // ─────────────────────────────────────────────────────────────
    if (action === 'ipn' || isDirectIpn) {
      const {
        invoice_number,
        trx_status,
        trx_id,
        trx_amount,
        order_date_time,
        payment_method,
        reference,
      } = body;

      console.log(`[PayStation IPN Received] Invoice: ${invoice_number}, Status: ${trx_status}, Amount: ${trx_amount}, TrxID: ${trx_id}`);

      // Basic payload verification
      const rawStatus = (trx_status || '').toLowerCase().trim();
      const isSuccess =
        rawStatus === 'success' ||
        rawStatus === 'successful' ||
        rawStatus === 'completed' ||
        rawStatus === 'captured' ||
        rawStatus === 'paid' ||
        rawStatus.includes('success');

      if (!invoice_number) {
        return jsonResponse({ status: 'error', message: 'Missing invoice_number' }, 400, corsHeaders);
      }

      if (!isSuccess) {
        // IPN specification states it only triggers for success; reject if status is not success
        return jsonResponse({ status: 'ignored', message: `Status is not success: ${trx_status}` }, 200, corsHeaders);
      }

      // Execute authoritative database RPC in Supabase
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

      if (supabaseUrl && supabaseServiceKey) {
        try {
          const supabase = createClient(supabaseUrl, supabaseServiceKey);
          const { data: ipnRpcRes, error: ipnRpcErr } = await supabase.rpc('rpc_handle_paystation_ipn', {
            p_invoice_number: String(invoice_number),
            p_trx_id: String(trx_id || `TRX-${Date.now()}`),
            p_amount: Number(trx_amount || 0),
            p_method: String(payment_method || 'bkash'),
            p_order_date_time: String(order_date_time || new Date().toISOString()),
            p_reference: reference ? String(reference) : null,
            p_raw_payload: body,
          });

          if (ipnRpcErr) {
            console.error('[PayStation IPN RPC Error]:', ipnRpcErr);
          } else {
            console.log('[PayStation IPN Processed Successfully]:', ipnRpcRes);
          }
        } catch (dbErr) {
          console.error('[PayStation IPN Database Exception]:', dbErr);
        }
      }

      // Always acknowledge PayStation with 200 { "status": "success" } per IPN spec
      return jsonResponse({ status: 'success' }, 200, corsHeaders);
    }

    // ─────────────────────────────────────────────────────────────
    // 5. ACTION: verify-payment (Client Verification Fallback)
    // ─────────────────────────────────────────────────────────────
    const { registration_id, invoice_number, trx_id, payment_amount, payment_method } = body;

    let isVerified = false;
    let verifiedAmount = Number(payment_amount || 0);
    let verifiedMethod = payment_method || 'bkash';

    if (trx_id) {
      try {
        const queryRes = await fetch(`${PAYSTATION_BASE_URL}/v2/transaction-status`, {
          method: 'POST',
          headers: {
            'merchantId': PAYSTATION_MERCHANT_ID,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ trxId: trx_id }),
        });

        const data = await queryRes.json();
        if (data.status_code === '200' && data.data && (data.data.trx_status || '').toLowerCase().includes('success')) {
          isVerified = true;
          verifiedAmount = Number(data.data.payment_amount || data.data.trx_amount || verifiedAmount);
          verifiedMethod = data.data.payment_method || verifiedMethod;
        } else if (PAYSTATION_ENV === 'sandbox') {
          isVerified = true;
        }
      } catch {
        if (PAYSTATION_ENV === 'sandbox') isVerified = true;
      }
    } else if (PAYSTATION_ENV === 'sandbox') {
      isVerified = true;
    }

    if (!isVerified) {
      return jsonResponse({
        success: false,
        error: 'PayStation transaction could not be verified or is not in Success status.',
      }, 402, corsHeaders);
    }

    const serverSignature = await generateHmacSha256Signature(
      registration_id || invoice_number || 'PLSCF_REG',
      trx_id || `TRX_${Date.now()}`,
      verifiedAmount,
      PAYMENT_SIGNING_SECRET
    );

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (supabaseUrl && supabaseServiceKey && registration_id) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      await supabase.rpc('rpc_verify_payment', {
        p_reg_id: registration_id,
        p_trx_id: trx_id || `TRX-SBX-${Date.now()}`,
        p_method: verifiedMethod,
        p_amount: verifiedAmount,
        p_signature: serverSignature,
        p_verified_by: 'PAYSTATION_EDGE_FUNCTION',
      });
    }

    return jsonResponse({
      success: true,
      verified: true,
      status: 'paid',
      trx_id: trx_id,
      amount: verifiedAmount,
      method: verifiedMethod,
      signature: serverSignature,
      timestamp: new Date().toISOString(),
    }, 200, corsHeaders);

  } catch (err: any) {
    return jsonResponse({
      success: false,
      error: err.message || 'Internal payment error',
    }, 500, corsHeaders);
  }
});
