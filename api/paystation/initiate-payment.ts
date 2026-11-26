// Legacy Vercel payment initiation proxy permanently disabled (P0 security remediation).
// Payment initiation must flow exclusively through the hardened Supabase Edge Function
// (`verify-payment`) which enforces server-side fee calculation, origin allowlists,
// and fail-closed credential handling.

export default async function handler(_req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(410).json({
    success: false,
    status: 'disabled',
    error: 'LEGACY_ENDPOINT_DISABLED',
    message: 'Legacy /api/paystation/initiate-payment endpoint is permanently disabled. Use the hardened Edge Function.',
  });
}
