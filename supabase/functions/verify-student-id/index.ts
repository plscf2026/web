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

serve(async (req) => {
  const origin = req.headers.get('origin');
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Vary': 'Origin',
  };

  if (origin && (allowedOrigins.length === 0 || allowedOrigins.includes(origin))) {
    headers['Access-Control-Allow-Origin'] = origin;
  } else if (origin && allowedOrigins.length > 0) {
    return jsonResponse({ error: 'Origin not allowed' }, 403, headers);
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, headers);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Student ID verification is missing required Supabase server keys.');
    return jsonResponse({ error: 'Verification service is temporarily unavailable.' }, 503, headers);
  }

  try {
    let studentId = '';
    let qrToken = '';
    let year = 2027;

    if (req.method === 'GET') {
      const url = new URL(req.url);
      studentId = url.searchParams.get('id')?.trim() || '';
      qrToken = url.searchParams.get('token')?.trim() || '';
      const parsedYear = Number(url.searchParams.get('year') || '2027');
      if (Number.isInteger(parsedYear) && parsedYear >= 2020 && parsedYear <= 2100) {
        year = parsedYear;
      }
    } else {
      const body = await req.json();
      studentId = typeof body.id === 'string' ? body.id.trim() : '';
      qrToken = typeof body.token === 'string' ? body.token.trim() : '';
      const parsedYear = Number(body.year || '2027');
      if (Number.isInteger(parsedYear) && parsedYear >= 2020 && parsedYear <= 2100) {
        year = parsedYear;
      }
    }

    if (!studentId || !/^[A-Za-z0-9-]{3,60}$/.test(studentId)) {
      return jsonResponse(
        { success: false, verified: false, error: 'Invalid or missing student registration ID.' },
        400,
        headers
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 1. Query consolidated registrations_2027 table
    const targetTable = 'registrations_2027';
    const { data: registration, error } = await supabase
      .from(targetTable)
      .select('id, full_name, full_name_bn, photo_url, category, passing_year, current_class, batch_name, payment_status, qr_token, year')
      .eq('id', studentId)
      .maybeSingle();

    if (error || !registration) {
      return jsonResponse(
        { success: false, verified: false, error: 'Student ID not found or registration record does not exist.' },
        404,
        headers
      );
    }

    // 2. Validate payment status
    if (registration.payment_status !== 'paid') {
      return jsonResponse(
        {
          success: false,
          verified: false,
          error: 'Student registration is not yet confirmed (pending payment).',
        },
        403,
        headers
      );
    }

    // 3. If QR token is provided, verify matching
    if (qrToken && registration.qr_token && qrToken !== registration.qr_token) {
      return jsonResponse(
        { success: false, verified: false, error: 'Cryptographic QR token mismatch. Pass is invalid.' },
        403,
        headers
      );
    }

    // 4. Sanitize photo URL (accepts base64 or HTTPS only)
    const photoUrl = String(registration.photo_url ?? '');
    const safePhotoUrl =
      /^data:image\/(?:jpeg|png|webp);base64,/i.test(photoUrl) ||
      /^https:\/\//i.test(photoUrl)
        ? photoUrl
        : '';

    // 5. Check if card generation record exists
    let cardStatus = 'ELIGIBLE';
    const { data: idCardRecord } = await supabase
      .from('student_id_cards')
      .select('card_status, generated_at')
      .eq('registration_id', studentId)
      .maybeSingle();

    if (idCardRecord?.card_status) {
      cardStatus = idCardRecord.card_status;
    }

    // Return safe, sanitized verification badge (excluding personal phone/email/financial records)
    return jsonResponse(
      {
        success: true,
        verified: true,
        institution: 'Police Lines School & College, Faridpur',
        event: `Grand Reunion ${registration.year || year}`,
        student: {
          id: registration.id,
          fullName: registration.full_name,
          fullNameBn: registration.full_name_bn || null,
          category: registration.category,
          batchName: registration.batch_name,
          passingYear: registration.passing_year || null,
          currentClass: registration.current_class || null,
          photoUrl: safePhotoUrl,
          cardStatus: cardStatus,
          verifiedAt: new Date().toISOString(),
        },
      },
      200,
      headers
    );
  } catch (err: any) {
    console.error('Student ID verification exception:', err);
    return jsonResponse({ error: 'Internal verification error.' }, 500, headers);
  }
});

