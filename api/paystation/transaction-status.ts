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
  const baseUrl = isProduction
    ? 'https://api.paystation.com.bd'
    : 'https://sandbox.paystation.com.bd';

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { invoice_number } = body;

    if (!invoice_number) {
      return res.status(400).json({
        status_code: '400',
        status: 'failed',
        message: 'Missing invoice_number parameter'
      });
    }

    const params = new URLSearchParams();
    params.append('invoice_number', String(invoice_number));

    const upstreamRes = await fetch(`${baseUrl}/transaction-status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'merchantId': merchantId
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
      message: err.message || 'Transaction status check failed'
    });
  }
}
