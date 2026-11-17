import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, apikey, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ status: 'failed', message: 'Method Not Allowed. Use GET.' });
  }

  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    'https://hnthoszbkhvygoowtvau.supabase.co';

  const supabaseKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    'sb_publishable_yEnHiM0NTIxuKNQnNHQu3Q_IRJ7zfur';

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 50)));
    const offset = Math.max(0, Number(req.query.offset || 0));

    let query = supabase
      .from('registrations_2027')
      .select('id, full_name, mobile_number, email, category, batch_name, t_shirt_size, total_paid, payment_status, is_checked_in, gate_status, registered_at')
      .order('registered_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (req.query.payment_status) {
      query = query.eq('payment_status', String(req.query.payment_status));
    }

    const { data, error } = await query;

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({
      success: true,
      count: data?.length || 0,
      data: data || [],
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
