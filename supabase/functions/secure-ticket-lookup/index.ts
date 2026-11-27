// @ts-nocheck
/// <reference path="../deno-ambient.d.ts" />
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

  if (origin) {
    if (allowedOrigins.includes(origin)) {
      headers['Access-Control-Allow-Origin'] = origin;
    } else {
      return jsonResponse({ error: 'Origin not allowed' }, 403, headers);
    }
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
    // Authoritative reunion year is 2027 (registrations_2026 was consolidated into registrations_2027)
    const rawYear = body.year !== undefined && body.year !== null ? Number(body.year) : 2027;
    const year = Number.isInteger(rawYear) && rawYear >= 2027 && rawYear <= 2030 ? rawYear : 2027;
    const targetTable = 'registrations_2027';

    if (
      !/^[A-Za-z0-9-]{3,60}$/.test(registrationId) ||
      !/^0\d{10}$/.test(mobileNumber)
    ) {
      return jsonResponse(
        { success: false, error: 'Enter a valid registration ID and mobile number.' },
        400,
        headers
      );
    }

    const rawCfIp = req.headers.get('cf-connecting-ip')?.trim();
    const rawRealIp = req.headers.get('x-real-ip')?.trim();
    const rawFwd = req.headers.get('x-forwarded-for')?.split(',').pop()?.trim();
    const clientIpCandidate = rawCfIp || rawRealIp || rawFwd || 'unavailable';
    const clientIp = /^[0-9a-fA-F:.]{3,64}$/.test(clientIpCandidate)
      ? clientIpCandidate
      : 'unavailable';
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
      .from(targetTable)
      .select(
        'id, full_name, full_name_bn, photo_url, mobile_number, category, passing_year, current_class, batch_name, t_shirt_size, registration_fee, donation_amount, total_paid, payment_status, registration_approval_status, transaction_id, payment_method, registered_at, qr_token, year, has_parent, parent_name, parent_phone, parent_relation, parent_photo_url'
      )
      .eq('id', registrationId)
      .eq('year', year)
      .maybeSingle();

    if (error) {
      console.error('Ticket lookup query failed:', error.message);
      return jsonResponse({ error: 'Ticket lookup is temporarily unavailable.' }, 503, headers);
    }

    if (registration) {
      if (
        normalizeMobile(String(registration.mobile_number ?? '')) !== mobileNumber ||
        registration.payment_status !== 'paid' ||
        registration.registration_approval_status === 'pending' ||
        registration.registration_approval_status === 'rejected' ||
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
        /^data:image\/(?:jpeg|jpg|png|webp);base64,/i.test(photoUrl) ||
        /^https:\/\//i.test(photoUrl)
          ? photoUrl
          : '';

      const { data: guardianRow } = await supabase
        .from('guardian_registrations_2027')
        .select('id, student_registration_id, guardian_name, guardian_phone, guardian_relation, photo_url, qr_token, payment_status, registration_approval_status, is_checked_in, gate_status, year')
        .eq('student_registration_id', registration.id)
        .eq('payment_status', 'paid')
        .maybeSingle();

      const parentPhotoUrl = String(guardianRow?.photo_url ?? registration.parent_photo_url ?? '');
      const safeParentPhotoUrl =
        /^data:image\/(?:jpeg|jpg|png|webp);base64,/i.test(parentPhotoUrl) ||
        /^https:\/\//i.test(parentPhotoUrl)
          ? parentPhotoUrl
          : '';

      return jsonResponse(
        {
          success: true,
          ticket: {
            ...registration,
            photo_url: safePhotoUrl,
            parent_photo_url: safeParentPhotoUrl || null,
            guardian_registration_id: guardianRow?.id || null,
            guardian_qr_token: guardianRow?.qr_token || null,
            email: null,
            address: '',
            student_id: null,
            roll_number: null,
            group_or_section: null,
            is_tshirt_collected: false,
          },
          guardian: guardianRow ? { ...guardianRow, photo_url: safeParentPhotoUrl || null } : null,
        },
        200,
        headers
      );
    }

    // Fallback: Direct Guardian lookup by Guardian ID + Guardian Mobile
    const { data: guardianDirect } = await supabase
      .from('guardian_registrations_2027')
      .select('id, student_registration_id, guardian_name, guardian_phone, mobile_number, guardian_relation, photo_url, qr_token, payment_status, registration_approval_status, is_checked_in, gate_status, year, registered_at')
      .eq('id', registrationId)
      .eq('year', year)
      .maybeSingle();

    if (
      !guardianDirect ||
      normalizeMobile(String(guardianDirect.guardian_phone ?? guardianDirect.mobile_number ?? '')) !== mobileNumber ||
      guardianDirect.payment_status !== 'paid' ||
      guardianDirect.registration_approval_status === 'pending' ||
      guardianDirect.registration_approval_status === 'rejected' ||
      !guardianDirect.qr_token
    ) {
      return jsonResponse(
        { success: false, error: 'No verified ticket matched those details.' },
        404,
        headers
      );
    }

    const { data: linkedStudent } = await supabase
      .from(targetTable)
      .select('id, full_name, category, batch_name, current_class, passing_year')
      .eq('id', guardianDirect.student_registration_id)
      .maybeSingle();

    const gPhotoUrl = String(guardianDirect.photo_url ?? '');
    const safeGPhoto =
      /^data:image\/(?:jpeg|jpg|png|webp);base64,/i.test(gPhotoUrl) ||
      /^https:\/\//i.test(gPhotoUrl)
        ? gPhotoUrl
        : '';

    return jsonResponse(
      {
        success: true,
        type: 'guardian',
        ticket: {
          id: guardianDirect.id,
          participant_type: 'guardian',
          student_registration_id: guardianDirect.student_registration_id,
          full_name: guardianDirect.guardian_name,
          photo_url: safeGPhoto,
          mobile_number: guardianDirect.guardian_phone || guardianDirect.mobile_number,
          category: linkedStudent?.category || 'current',
          batch_name: linkedStudent?.batch_name || 'Guardian Pass',
          current_class: linkedStudent?.current_class || null,
          passing_year: linkedStudent?.passing_year || null,
          payment_status: guardianDirect.payment_status,
          qr_token: guardianDirect.qr_token,
          year: guardianDirect.year,
          registered_at: guardianDirect.registered_at,
          has_parent: true,
          parent_name: guardianDirect.guardian_name,
          parent_phone: guardianDirect.guardian_phone || guardianDirect.mobile_number,
          parent_relation: guardianDirect.guardian_relation,
          parent_photo_url: safeGPhoto,
          guardian_registration_id: guardianDirect.id,
          guardian_qr_token: guardianDirect.qr_token,
        },
        guardian: { ...guardianDirect, photo_url: safeGPhoto },
      },
      200,
      headers
    );
  } catch (error) {
    console.error('Ticket lookup request failed:', error);
    return jsonResponse({ error: 'Unable to process ticket lookup.' }, 400, headers);
  }
});
