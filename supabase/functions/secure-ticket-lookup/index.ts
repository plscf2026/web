import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const allowedOrigins = (Deno.env.get('APP_ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

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

function normalizeMobile(value: string): string {
  const digits = value.replace(/\D/g, '');
  return digits.startsWith('880') ? `0${digits.slice(3)}` : digits;
}

async function hmacHex(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };

  if (origin && (allowedOrigins.length === 0 || allowedOrigins.includes(origin))) {
    headers['Access-Control-Allow-Origin'] = origin;
  } else if (origin && allowedOrigins.length > 0) {
    return jsonResponse({ error: 'Origin not allowed' }, 403, headers);
  }
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, headers);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const rateLimitSecret = Deno.env.get('RATE_LIMIT_HMAC_SECRET');
  if (!supabaseUrl || !serviceRoleKey || !rateLimitSecret || rateLimitSecret.length < 32) {
    console.error('Ticket lookup function is missing required server secrets.');
    return jsonResponse({ error: 'Ticket lookup is not configured.' }, 503, headers);
  }

  try {
    const requestBody = await req.text();
    if (new TextEncoder().encode(requestBody).length > 4096) {
      return jsonResponse({ error: 'Request is too large.' }, 413, headers);
    }
    const body = JSON.parse(requestBody);
    const registrationId = typeof body.registrationId === 'string' ? body.registrationId.trim() : '';
    const mobileNumber = typeof body.mobileNumber === 'string' ? normalizeMobile(body.mobileNumber) : '';
    const year = Number(body.year ?? 2026);
    if (
      !/^[A-Za-z0-9-]{3,60}$/.test(registrationId) ||
      !/^0\d{10}$/.test(mobileNumber) ||
      !Number.isInteger(year) ||
      year < 2026 ||
      year > 2100
    ) {
      return jsonResponse(
        { success: false, error: 'Enter a valid registration ID and mobile number.' },
        400,
        headers
      );
    }

    const clientIp =
      req.headers.get('cf-connecting-ip')?.trim() ||
      req.headers.get('x-real-ip')?.trim() ||
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      'unavailable';
    const [ipHash, subjectHash] = await Promise.all([
      hmacHex(rateLimitSecret, `ip|${clientIp}`),
      hmacHex(rateLimitSecret, `ticket|${clientIp}|${registrationId}`),
    ]);

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const rateLimitResults = await Promise.all([
      supabase.rpc('consume_ticket_lookup_rate_limit', {
        p_subject_hash: ipHash,
        p_max_attempts: 20,
        p_window_seconds: 60,
      }),
      supabase.rpc('consume_ticket_lookup_rate_limit', {
        p_subject_hash: subjectHash,
        p_max_attempts: 5,
        p_window_seconds: 60,
      }),
    ]);
    const rateLimitError = rateLimitResults.find((result) => result.error)?.error;
    if (rateLimitError) {
      console.error('Ticket lookup rate limiter failed:', rateLimitError.message);
      return jsonResponse({ error: 'Ticket lookup is temporarily unavailable.' }, 503, headers);
    }
    if (rateLimitResults.some((result) => !result.data)) {
      return jsonResponse(
        { success: false, error: 'Too many attempts. Please wait one minute and try again.' },
        429,
        headers
      );
    }

    const { data: registration, error } = await supabase
      .from(`registrations_${year}`)
      .select(
        'id, full_name, full_name_bn, photo_url, mobile_number, category, passing_year, current_class, batch_name, t_shirt_size, registration_fee, donation_amount, total_paid, payment_status, transaction_id, payment_method, registered_at, qr_token, year'
      )
      .eq('id', registrationId)
      .maybeSingle();

    if (error) {
      console.error('Ticket lookup query failed:', error.message);
      return jsonResponse({ error: 'Ticket lookup is temporarily unavailable.' }, 503, headers);
    }

    if (
      !registration ||
      normalizeMobile(String(registration.mobile_number ?? '')) !== mobileNumber ||
      registration.payment_status !== 'paid' ||
      !registration.qr_token
    ) {
      return jsonResponse(
        { success: false, error: 'No verified ticket matched those details.' },
        404,
        headers
      );
    }

    const photoUrl = String(registration.photo_url ?? '');
    const safePhotoUrl =
      /^data:image\/(?:jpeg|png|webp);base64,/i.test(photoUrl) ||
      /^https:\/\//i.test(photoUrl)
        ? photoUrl
        : '';

    return jsonResponse(
      {
        success: true,
        ticket: {
          ...registration,
          photo_url: safePhotoUrl,
          email: null,
          address: '',
          student_id: null,
          roll_number: null,
          group_or_section: null,
          is_tshirt_collected: false,
        },
      },
      200,
      headers
    );
  } catch (error) {
    console.error('Ticket lookup request failed:', error);
    return jsonResponse({ error: 'Unable to process ticket lookup.' }, 400, headers);
  }
});
