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
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };

  if (origin && allowedOrigins.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  } else if (origin) {
    return jsonResponse({ error: 'Origin not allowed' }, 403, headers);
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, headers);
  }

  const authorization = req.headers.get('authorization') ?? '';
  const tokenMatch = authorization.match(/^Bearer\s+(\S+)$/i);
  if (!tokenMatch) {
    return jsonResponse({ error: 'Administrator authentication is required.' }, 401, headers);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const signingSecret = Deno.env.get('AUDIT_SIGNING_SECRET');
  if (!supabaseUrl || !serviceRoleKey || !signingSecret || signingSecret.length < 32) {
    console.error('Admin audit function is missing required server secrets.');
    return jsonResponse({ error: 'Audit service is not configured.' }, 503, headers);
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: authData, error: authError } = await supabase.auth.getUser(tokenMatch[1]);
    if (authError || !authData.user) {
      return jsonResponse({ error: 'Administrator authentication is invalid.' }, 401, headers);
    }

    const { data: admin, error: adminError } = await supabase
      .from('admin_accounts')
      .select('id, username, role')
      .eq('auth_user_id', authData.user.id)
      .maybeSingle();

    if (adminError) {
      console.error('Admin profile lookup failed:', adminError.message);
      return jsonResponse({ error: 'Unable to verify administrator permissions.' }, 500, headers);
    }
    if (!admin || admin.role !== 'super_admin') {
      return jsonResponse({ error: 'Administrator permission is required.' }, 403, headers);
    }

    const body = await req.json();
    const action = typeof body.action === 'string' ? body.action : '';
    const targetType = typeof body.targetType === 'string' ? body.targetType : '';
    const targetId = typeof body.targetId === 'string' ? body.targetId : '';
    const details = typeof body.details === 'string' ? body.details : '';
    if (
      !/^[A-Z][A-Z0-9_]{1,63}$/.test(action) ||
      !/^[a-z][a-z0-9_]{1,39}$/.test(targetType) ||
      !targetId.trim() ||
      targetId.length > 200 ||
      details.length > 2000
    ) {
      return jsonResponse({ error: 'Invalid audit event.' }, 400, headers);
    }

    const timestamp = new Date().toISOString();
    const id = crypto.randomUUID();
    const auditPayload = JSON.stringify({
      id,
      adminId: admin.id,
      action,
      targetType,
      targetId,
      details,
      timestamp,
    });
    const hmacKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(signingSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signature = await crypto.subtle.sign(
      'HMAC',
      hmacKey,
      new TextEncoder().encode(auditPayload)
    );
    const checksum = Array.from(new Uint8Array(signature))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();

    const { error: insertError } = await supabase.from('admin_audit_logs').insert({
      id,
      admin_id: admin.id,
      admin_username: admin.username,
      admin_role: admin.role,
      action,
      target_type: targetType,
      target_id: targetId,
      details,
      ip_address: 'unavailable',
      user_agent: (req.headers.get('user-agent') ?? 'unknown').slice(0, 500),
      checksum: `HMAC-SHA256-${checksum}`,
      created_at: timestamp,
    });

    if (insertError) {
      console.error('Admin audit insert failed:', insertError.message);
      return jsonResponse({ error: 'Unable to persist audit event.' }, 500, headers);
    }

    return jsonResponse(
      {
        success: true,
        id,
        checksum: `HMAC-SHA256-${checksum}`,
        timestamp,
        actor: { id: admin.id, username: admin.username, role: admin.role },
      },
      200,
      headers
    );
  } catch (error) {
    console.error('Admin audit request failed:', error);
    return jsonResponse({ error: 'Unable to process audit event.' }, 500, headers);
  }
});
