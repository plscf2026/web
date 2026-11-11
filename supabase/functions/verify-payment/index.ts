import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const allowedOrigins = (Deno.env.get('APP_ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const PAYSTATION_MERCHANT_ID = Deno.env.get('PAYSTATION_MERCHANT_ID') || '104-1653730183';
const PAYSTATION_PASSWORD = Deno.env.get('PAYSTATION_PASSWORD');
if (!PAYSTATION_PASSWORD) {
  console.error('CRITICAL: PAYSTATION_PASSWORD secret is not configured in Edge Function secrets. Payment gateway cannot authenticate.');
}
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

async function requestGrantToken(): Promise<{ success: boolean; token?: string; error?: string }> {
  if (!PAYSTATION_PASSWORD) {
    if (PAYSTATION_ENV === 'sandbox') {
      return {
        success: true,
        token: `sb_edge_sim_token_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      };
    }
    return { success: false, error: 'Payment gateway configuration error: merchant password not configured.' };
  }
  try {
    const res = await fetch(`${PAYSTATION_BASE_URL}/grant-token`, {
      method: 'POST',
      headers: {
        'merchantId': PAYSTATION_MERCHANT_ID,
        'password': PAYSTATION_PASSWORD,
        'Content-Type': 'application/json',
      },
    });
    const data = await res.json();
    if ((data.status_code === '200' || data.status === 'success') && data.token) {
      return { success: true, token: data.token };
    }
    return { success: false, error: data.message || `Failed to acquire grant token (status ${data.status_code})` };
  } catch (err: any) {
    if (PAYSTATION_ENV === 'sandbox') {
      return {
        success: true,
        token: `sb_edge_sim_token_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      };
    }
    return { success: false, error: err.message || 'Error reaching PayStation /grant-token' };
  }
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };

  if (origin && (allowedOrigins.length === 0 || allowedOrigins.includes(origin))) {
    corsHeaders['Access-Control-Allow-Origin'] = origin;
  } else if (origin && allowedOrigins.length > 0) {
    return jsonResponse({ error: 'Origin not allowed' }, 403, corsHeaders);
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, corsHeaders);
  }

  try {
    const body = await req.json();
    const action = body.action || (body.order ? 'create-payment' : 'verify-payment');

    // -------------------------------------------------------------
    // ACTION: grant-token
    // -------------------------------------------------------------
    if (action === 'grant-token') {
      const tokenRes = await requestGrantToken();
      if (!tokenRes.success) {
        return jsonResponse({ success: false, error: tokenRes.error }, 502, corsHeaders);
      }
      return jsonResponse({ success: true, token: tokenRes.token }, 200, corsHeaders);
    }

    // -------------------------------------------------------------
    // ACTION: create-payment (Hosted Checkout Initiation)
    // -------------------------------------------------------------
    if (action === 'create-payment') {
      const order = body.order;
      if (!order || !order.invoice_number || !order.payment_amount) {
        return jsonResponse({ success: false, error: 'Missing required order details.' }, 400, corsHeaders);
      }

      let token = body.token;
      if (!token) {
        const tokenRes = await requestGrantToken();
        if (!tokenRes.success || !tokenRes.token) {
          return jsonResponse({ success: false, error: tokenRes.error || 'Failed to authenticate with gateway' }, 502, corsHeaders);
        }
        token = tokenRes.token;
      }

      try {
        const createRes = await fetch(`${PAYSTATION_BASE_URL}/create-payment`, {
          method: 'POST',
          headers: {
            'token': token,
            'merchantId': PAYSTATION_MERCHANT_ID,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(order),
        });

        const createData = await createRes.json();
        if ((createData.status_code === '200' || createData.status === 'success') && createData.payment_url) {
          return jsonResponse({
            success: true,
            paymentUrl: createData.payment_url,
            trxId: createData.trx_id,
            invoiceNumber: createData.invoice_number || order.invoice_number,
          }, 200, corsHeaders);
        }

        if (PAYSTATION_ENV === 'sandbox') {
          return jsonResponse({
            success: true,
            paymentUrl: `${PAYSTATION_BASE_URL}/checkout/pay?token=${token}&invoice=${order.invoice_number}&amount=${order.payment_amount}`,
            trxId: `PST-SBX-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`,
            invoiceNumber: order.invoice_number,
          }, 200, corsHeaders);
        }

        return jsonResponse({
          success: false,
          error: createData.message || `PayStation returned status ${createData.status_code}`,
        }, 400, corsHeaders);
      } catch (err: any) {
        if (PAYSTATION_ENV === 'sandbox') {
          return jsonResponse({
            success: true,
            paymentUrl: `${PAYSTATION_BASE_URL}/checkout/pay?token=${token}&invoice=${order.invoice_number}&amount=${order.payment_amount}`,
            trxId: `PST-SBX-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`,
            invoiceNumber: order.invoice_number,
          }, 200, corsHeaders);
        }
        return jsonResponse({ success: false, error: err.message || 'Payment initiation failed' }, 502, corsHeaders);
      }
    }

    // -------------------------------------------------------------
    // ACTION: verify-payment (Default / Transaction Verification)
    // -------------------------------------------------------------
    const { registration_id, invoice_number, trx_id, payment_amount, payment_method, year } = body;

    if (!invoice_number && !trx_id && !registration_id) {
      return jsonResponse({ success: false, error: 'Missing mandatory payment verification identifiers.' }, 400, corsHeaders);
    }

    let isVerified = false;
    let verifiedAmount = Number(payment_amount || 0);
    let verifiedMethod = payment_method || 'bkash';

    // 1. Query PayStation API if trx_id is present
    if (trx_id) {
      try {
        const paystationRes = await fetch(`${PAYSTATION_BASE_URL}/retrive-transaction`, {
          method: 'POST',
          headers: {
            'merchantId': PAYSTATION_MERCHANT_ID,
            'password': PAYSTATION_PASSWORD,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            invoice_number: invoice_number || registration_id,
            trx_id: trx_id,
          }),
        });

        const data = await paystationRes.json();
        if (data.status_code === '200' && data.data && data.data.trx_status === 'Success') {
          isVerified = true;
          verifiedAmount = Number(data.data.payment_amount || verifiedAmount);
          verifiedMethod = data.data.payment_method || verifiedMethod;
        } else if (PAYSTATION_ENV === 'sandbox') {
          isVerified = true;
        }
      } catch (err) {
        console.warn('PayStation Gateway query error:', err);
        if (PAYSTATION_ENV === 'sandbox') {
          isVerified = true;
        }
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

    // 2. Generate Authoritative Server Cryptographic Signature
    const serverSignature = await generateHmacSha256Signature(
      registration_id || invoice_number || 'PLSCF_REG',
      trx_id || `TRX_${Date.now()}`,
      verifiedAmount,
      PAYMENT_SIGNING_SECRET
    );

    // 3. Perform Database updates if Supabase service role is present
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (supabaseUrl && supabaseServiceKey && registration_id) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Invoke atomic RPC verify payment
      const { data: rpcData, error: rpcError } = await supabase.rpc('rpc_verify_payment', {
        p_reg_id: registration_id,
        p_trx_id: trx_id || `TRX-SBX-${Date.now()}`,
        p_method: verifiedMethod,
        p_amount: verifiedAmount,
        p_signature: serverSignature,
        p_verified_by: 'PAYSTATION_EDGE_FUNCTION',
      });

      if (rpcError) {
        console.warn('rpc_verify_payment notice in edge function:', rpcError);
      } else {
        console.log('rpc_verify_payment successfully executed:', rpcData);
      }
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
      error: err.message || 'Internal payment verification error',
    }, 500, corsHeaders);
  }
});
