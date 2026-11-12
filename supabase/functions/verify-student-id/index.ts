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

function parseUrlOrToken(raw: string): { id?: string; token?: string } {
  if (!raw) return {};
  const trimmed = raw.trim();
  if (trimmed.includes('?') || trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const u = new URL(trimmed.startsWith('http') ? trimmed : `https://plscf.org/${trimmed.startsWith('/') ? '' : '/'}${trimmed}`);
      const id =
        u.searchParams.get('id') ||
        u.searchParams.get('ID') ||
        u.searchParams.get('student_id') ||
        u.searchParams.get('registration_id');
      const token =
        u.searchParams.get('token') ||
        u.searchParams.get('TOKEN') ||
        u.searchParams.get('qr_token');

      // Check path segment for PLSCF-XXXX-XXXX
      let pathId: string | undefined;
      for (const seg of u.pathname.split('/').filter(Boolean)) {
        if (/^PLSCF-\d{4}-[A-Z0-9]+$/i.test(seg)) {
          pathId = seg.toUpperCase();
          break;
        }
      }

      return {
        id: (id || pathId)?.trim().toUpperCase(),
        token: token?.trim().toUpperCase(),
      };
    } catch {}
  }
  return {};
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
    let staffId = '';
    let staffRole = '';

    if (req.method === 'GET') {
      const url = new URL(req.url);
      studentId = url.searchParams.get('id')?.trim() || '';
      qrToken = url.searchParams.get('token')?.trim() || '';
      staffId = url.searchParams.get('staff_id')?.trim() || '';
      staffRole = url.searchParams.get('staff_role')?.trim() || '';
      const parsedYear = Number(url.searchParams.get('year') || '2027');
      if (Number.isInteger(parsedYear) && parsedYear >= 2020 && parsedYear <= 2100) {
        year = parsedYear;
      }
    } else {
      const body = await req.json();
      studentId = typeof body.id === 'string' ? body.id.trim() : '';
      qrToken = typeof body.token === 'string' ? body.token.trim() : '';
      staffId = typeof body.staff_id === 'string' ? body.staff_id.trim() : '';
      staffRole = typeof body.staff_role === 'string' ? body.staff_role.trim() : '';
      const parsedYear = Number(body.year || '2027');
      if (Number.isInteger(parsedYear) && parsedYear >= 2020 && parsedYear <= 2100) {
        year = parsedYear;
      }
    }

    // Auto-parse if full URL was passed in studentId
    const parsedFromUrl = parseUrlOrToken(studentId);
    if (parsedFromUrl.id) studentId = parsedFromUrl.id;
    if (!qrToken && parsedFromUrl.token) qrToken = parsedFromUrl.token;

    // Normalization
    studentId = studentId.toUpperCase().trim();
    qrToken = qrToken.toUpperCase().trim();

    if (!studentId && !qrToken) {
      return jsonResponse(
        {
          success: false,
          verified: false,
          status: 'INVALID_INPUT',
          error: 'Registration ID or QR token is required for verification.',
        },
        400,
        headers
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 1. Authoritative lookup in registrations_2027
    const targetTable = 'registrations_2027';
    let query = supabase
      .from(targetTable)
      .select('id, full_name, full_name_bn, photo_url, category, passing_year, current_class, batch_name, payment_status, qr_token, year');

    if (studentId && qrToken) {
      query = query.eq('id', studentId);
    } else if (studentId) {
      query = query.or(`id.ilike.${studentId},qr_token.ilike.${studentId}`);
    } else {
      query = query.eq('qr_token', qrToken);
    }

    const { data: registration, error } = await query.limit(1).maybeSingle();

    if (error || !registration) {
      return jsonResponse(
        {
          success: false,
          verified: false,
          status: 'NOT_FOUND',
          error: `Student ticket "${studentId || qrToken}" not found in database.`,
        },
        404,
        headers
      );
    }

    // 2. Enforce payment status validation
    if (registration.payment_status !== 'paid') {
      return jsonResponse(
        {
          success: false,
          verified: false,
          status: 'UNPAID',
          error: `Payment Pending: Registration "${registration.id}" is in "${registration.payment_status}" status.`,
        },
        403,
        headers
      );
    }

    // 3. Cryptographic token matching (case-insensitive)
    if (qrToken && registration.qr_token) {
      const regToken = String(registration.qr_token).trim().toUpperCase();
      if (regToken !== qrToken && registration.id.toUpperCase() !== studentId) {
        return jsonResponse(
          {
            success: false,
            verified: false,
            status: 'TOKEN_MISMATCH',
            error: `Cryptographic QR token mismatch for registration "${registration.id}".`,
          },
          403,
          headers
        );
      }
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
      .eq('registration_id', registration.id)
      .maybeSingle();

    if (idCardRecord?.card_status) {
      cardStatus = idCardRecord.card_status;
    }

    // Return safe, sanitized verification payload with zero PII
    return jsonResponse(
      {
        success: true,
        verified: true,
        status: 'ELIGIBLE',
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
          paymentStatus: registration.payment_status,
          qrToken: registration.qr_token,
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
