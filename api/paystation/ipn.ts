// Legacy Vercel IPN webhook permanently disabled (P0 security remediation).
// Unauthenticated IPN endpoints without PAYSTATION_ALLOW_PAYMENT_FINALIZATION guards,
// gateway currency checks, and server-to-server verification are strictly prohibited.

export default async function handler(_req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(410).json({
    success: false,
    status: 'disabled',
    error: 'LEGACY_ENDPOINT_DISABLED',
    message: 'Legacy /api/paystation/ipn endpoint is permanently disabled. Route webhooks to the hardened Edge Function.',
  });
}
