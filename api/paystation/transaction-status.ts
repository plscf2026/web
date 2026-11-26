// Legacy Vercel transaction-status proxy permanently disabled (P0 security remediation).
// Transaction status queries execute exclusively through the hardened Supabase Edge Function.

export default async function handler(_req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(410).json({
    success: false,
    status: 'disabled',
    error: 'LEGACY_ENDPOINT_DISABLED',
    message: 'Legacy /api/paystation/transaction-status endpoint is permanently disabled. Use the hardened Edge Function.',
  });
}
