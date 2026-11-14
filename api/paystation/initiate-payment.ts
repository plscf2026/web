export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ status_code: '405', status: 'failed', message: 'Method Not Allowed' });
  }

  const isProduction =
    process.env.PAYSTATION_ENV === 'production' ||
    process.env.VITE_PAYSTATION_ENV === 'production';
  const merchantId =
    process.env.PAYSTATION_MERCHANT_ID ||
    process.env.VITE_PAYSTATION_MERCHANT_ID ||
    '104-1653730183';
  const password =
    process.env.PAYSTATION_PASSWORD ||
    process.env.VITE_PAYSTATION_PASSWORD ||
    'gamecoderstorepass';
  const baseUrl = isProduction
    ? 'https://api.paystation.com.bd'
    : 'https://sandbox.paystation.com.bd';

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const {
      invoice_number,
      currency = 'BDT',
      payment_amount,
      pay_with_charge = 0,
      reference,
      cust_name,
      cust_phone,
      cust_email,
      cust_address,
      callback_url,
      checkout_items,
      opt_a,
      opt_b,
      opt_c
    } = body;

    if (!invoice_number || !payment_amount || !cust_phone) {
      return res.status(400).json({
        status_code: '400',
        status: 'failed',
        message: 'Missing required parameters (invoice_number, payment_amount, cust_phone)'
      });
    }

    const params = new URLSearchParams();
    params.append('merchantId', merchantId);
    params.append('password', password);
    params.append('invoice_number', String(invoice_number));
    params.append('currency', String(currency));
    params.append('payment_amount', String(payment_amount));
    params.append('pay_with_charge', String(pay_with_charge));
    if (reference) params.append('reference', String(reference));
    params.append('cust_name', String(cust_name || 'Student'));
    params.append('cust_phone', String(cust_phone));
    if (cust_email) params.append('cust_email', String(cust_email));
    if (cust_address) params.append('cust_address', String(cust_address));
    params.append('callback_url', String(callback_url));
    if (checkout_items) {
      params.append('checkout_items', typeof checkout_items === 'string' ? checkout_items : JSON.stringify(checkout_items));
    }
    if (opt_a) params.append('opt_a', String(opt_a));
    if (opt_b) params.append('opt_b', String(opt_b));
    if (opt_c) params.append('opt_c', String(opt_c));

    const upstreamRes = await fetch(`${baseUrl}/initiate-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: params.toString()
    });

    const text = await upstreamRes.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }

    if (json) {
      return res.status(upstreamRes.status).json(json);
    }
    return res.status(upstreamRes.status).send(text);
  } catch (err: any) {
    return res.status(500).json({
      status_code: '500',
      status: 'failed',
      message: err.message || 'Payment initiation server error'
    });
  }
}
