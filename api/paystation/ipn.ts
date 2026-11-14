import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'failed', message: 'Method Not Allowed' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ status: 'failed', message: 'Supabase backend configuration missing' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const invoiceNumber = body.invoice_number;
    const trxId = body.trx_id;
    const trxAmount = Number(body.trx_amount || body.payment_amount || 0);
    const trxStatus = (body.trx_status || '').toLowerCase().trim();
    const paymentMethod = body.payment_method || 'bkash';
    const orderDateTime = body.order_date_time || new Date().toISOString();
    const reference = body.reference || null;

    if (!invoiceNumber || !trxId) {
      return res.status(400).json({ status: 'failed', message: 'Missing invoice_number or trx_id' });
    }

    if (trxStatus !== 'success' && trxStatus !== 'successful') {
      return res.status(200).json({ status: 'ignored', message: `Non-success status (${body.trx_status}) ignored` });
    }

    const { data, error } = await supabase.rpc('rpc_handle_paystation_ipn', {
      p_invoice_number: invoiceNumber,
      p_trx_id: trxId,
      p_amount: trxAmount,
      p_method: paymentMethod,
      p_order_date_time: orderDateTime,
      p_reference: reference,
      p_raw_payload: body
    });

    if (error) {
      console.error('[IPN] Database execution error:', error);
      return res.status(500).json({ status: 'failed', error: error.message });
    }

    return res.status(200).json({ status: 'success', data });
  } catch (err: any) {
    console.error('[IPN] Unhandled exception:', err);
    return res.status(500).json({ status: 'failed', message: err.message });
  }
}
