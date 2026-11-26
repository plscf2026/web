// Legacy Vercel serverless route permanently disabled (P0 security remediation).
// Direct service-role database reads without authentication bypass RLS and expose PII.
// Authorized callers must use authenticated Supabase sessions or Edge Functions.

export default async function handler(_req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(410).json({
    success: false,
    error: 'LEGACY_ENDPOINT_DISABLED',
    message: 'Unauthenticated registration dump endpoint has been permanently disabled.',
  });
}
