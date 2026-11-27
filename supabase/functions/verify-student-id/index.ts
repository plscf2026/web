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

  if (origin) {
    if (allowedOrigins.includes(origin)) {
      headers['Access-Control-Allow-Origin'] = origin;
    } else {
      return jsonResponse({ error: 'Origin not allowed' }, 403, headers);
    }
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
    const authorization = req.headers.get('authorization') ?? '';
    const tokenMatch = authorization.match(/^Bearer\s+(\S+)$/i);
    if (!tokenMatch) {
      return jsonResponse({ error: 'Staff or administrator authentication is required.' }, 401, headers);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: authData, error: authError } = await supabase.auth.getUser(tokenMatch[1]);
    if (authError || !authData.user) {
      return jsonResponse({ error: 'Authentication token is invalid or expired.' }, 401, headers);
    }

    const [{ data: adminProfile }, { data: staffProfile }] = await Promise.all([
      supabase
        .from('admin_accounts')
        .select('id, role, status, is_locked')
        .eq('auth_user_id', authData.user.id)
        .maybeSingle(),
      supabase
        .from('staff_accounts')
        .select('id, role, status')
        .eq('auth_user_id', authData.user.id)
        .maybeSingle(),
    ]);

    const hasActiveAdmin = Boolean(
      adminProfile &&
      !adminProfile.is_locked &&
      (!adminProfile.status || adminProfile.status.toUpperCase() === 'ACTIVE')
    );
    const hasActiveStaff = Boolean(staffProfile && staffProfile.status === 'ACTIVE');

    if (!hasActiveAdmin && !hasActiveStaff) {
      return jsonResponse({ error: 'Active staff or administrator authorization is required.' }, 403, headers);
    }

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

    // Auto-parse if full URL was passed in studentId
    const parsedFromUrl = parseUrlOrToken(studentId);
    if (parsedFromUrl.id) studentId = parsedFromUrl.id;
    if (!qrToken && parsedFromUrl.token) qrToken = parsedFromUrl.token;

    // Strict input sanitization (prevent filter injection)
    studentId = studentId.toUpperCase().trim();
    qrToken = qrToken.toUpperCase().trim();

    if ((!studentId && !qrToken) || (studentId && !/^[A-Z0-9_-]{3,64}$/.test(studentId)) || (qrToken && !/^[A-Z0-9_-]{4,64}$/.test(qrToken))) {
      return jsonResponse(
        {
          success: false,
          verified: false,
          status: 'INVALID_INPUT',
          error: 'Valid registration ID or QR token is required for verification.',
        },
        400,
        headers
      );
    }

    // 1. Parameterized authoritative lookup in registrations_2027 (zero photo_url / zero PII)
    const selectCols = 'id, full_name, full_name_bn, category, passing_year, current_class, batch_name, payment_status, registration_approval_status, qr_token, year';
    let registration: any = null;
    let error: any = null;

    if (studentId) {
      const byIdRes = await supabase
        .from('registrations_2027')
        .select(selectCols)
        .eq('id', studentId)
        .limit(1)
        .maybeSingle();
      registration = byIdRes.data;
      error = byIdRes.error;

      if (!registration && !error) {
        const byTokenRes = await supabase
          .from('registrations_2027')
          .select(selectCols)
          .eq('qr_token', studentId)
          .limit(1)
          .maybeSingle();
        registration = byTokenRes.data;
        error = byTokenRes.error;
      }
    } else {
      const byQrRes = await supabase
        .from('registrations_2027')
        .select(selectCols)
        .eq('qr_token', qrToken)
        .limit(1)
        .maybeSingle();
      registration = byQrRes.data;
      error = byQrRes.error;
    }

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

    // 2. Enforce approval & payment status validation
    if (registration.registration_approval_status === 'pending') {
      return jsonResponse(
        {
          success: false,
          verified: false,
          status: 'PENDING_APPROVAL',
          error: `Registration "${registration.id}" is pending Super Admin approval.`,
        },
        403,
        headers
      );
    }

    if (registration.registration_approval_status === 'rejected') {
      return jsonResponse(
        {
          success: false,
          verified: false,
          status: 'REGISTRATION_REJECTED',
          error: `Registration "${registration.id}" has been rejected by Super Admin.`,
        },
        403,
        headers
      );
    }

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

    // 3. Mandatory cryptographic token matching (case-insensitive)
    if (registration.qr_token) {
      const regToken = String(registration.qr_token).trim().toUpperCase();
      if (qrToken && regToken !== qrToken) {
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
      if (!qrToken && regToken !== studentId) {
        return jsonResponse(
          {
            success: false,
            verified: false,
            status: 'TOKEN_REQUIRED',
            error: 'Cryptographic QR token is required for ID verification.',
          },
          403,
          headers
        );
      }
    }

    // 4. Check if card generation record exists
    let cardStatus = 'ELIGIBLE';
    const { data: idCardRecord } = await supabase
      .from('student_id_cards')
      .select('card_status, generated_at')
      .eq('registration_id', registration.id)
      .maybeSingle();

    if (idCardRecord?.card_status) {
      cardStatus = idCardRecord.card_status;
    }

    // Return safe, sanitized verification payload (zero PII, omit raw qrToken)
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
          paymentStatus: registration.payment_status,
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
