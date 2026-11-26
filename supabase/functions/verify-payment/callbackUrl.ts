// Strict server-side callback URL builder & origin allowlist validator.
// Never forwards arbitrary client-supplied callback URLs to PayStation.

export interface CallbackResolutionInput {
  allowedOriginsRaw: string | undefined;
  paystationEnv: string;
  requestedCallbackUrl?: unknown;
  requestedOrigin?: unknown;
  orderType: 'registration' | 'donation';
  invoiceNumber: string;
}

export interface CallbackResolutionResult {
  valid: boolean;
  error?: string;
  message?: string;
  callbackUrl?: string;
  origin?: string;
}

export function parseAllowlistedOrigins(
  allowedOriginsRaw: string | undefined,
  paystationEnv: string
): string[] {
  if (!allowedOriginsRaw || typeof allowedOriginsRaw !== 'string') return [];
  const isSandbox = paystationEnv !== 'production';
  const result: string[] = [];

  for (const entry of allowedOriginsRaw.split(',')) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    try {
      const parsed = new URL(trimmed);
      if (parsed.origin === 'null') continue;
      if (parsed.protocol === 'https:') {
        result.push(parsed.origin);
      } else if (isSandbox && parsed.protocol === 'http:' && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')) {
        result.push(parsed.origin);
      }
    } catch {
      // Ignore invalid origin entries; will fail closed if result is empty
    }
  }
  return Array.from(new Set(result));
}

export function resolveServerCallbackUrl(input: CallbackResolutionInput): CallbackResolutionResult {
  const allowlist = parseAllowlistedOrigins(input.allowedOriginsRaw, input.paystationEnv);
  if (allowlist.length === 0) {
    return {
      valid: false,
      error: 'CALLBACK_ORIGIN_NOT_CONFIGURED',
      message: 'APP_ALLOWED_ORIGINS is missing or contains no valid allowlisted origins.',
    };
  }

  const cleanInvoice = typeof input.invoiceNumber === 'string' ? input.invoiceNumber.trim() : '';
  if (!/^[A-Za-z0-9_-]{3,80}$/.test(cleanInvoice)) {
    return {
      valid: false,
      error: 'INVALID_INVOICE_NUMBER',
      message: 'Invoice number contains invalid characters.',
    };
  }

  let selectedOrigin = allowlist[0];
  const candidate = input.requestedOrigin ?? input.requestedCallbackUrl;

  if (candidate !== undefined && candidate !== null && String(candidate).trim() !== '') {
    const rawCandidate = String(candidate).trim();
    let parsedCandidate: URL;
    try {
      parsedCandidate = new URL(rawCandidate);
    } catch {
      return {
        valid: false,
        error: 'INVALID_CALLBACK_URL',
        message: 'Callback URL/origin is malformed.',
      };
    }

    if (
      (parsedCandidate.protocol !== 'https:' && parsedCandidate.protocol !== 'http:') ||
      !allowlist.includes(parsedCandidate.origin)
    ) {
      return {
        valid: false,
        error: 'UNAPPROVED_CALLBACK_ORIGIN',
        message: `Origin "${parsedCandidate.origin}" is not in APP_ALLOWED_ORIGINS.`,
      };
    }

    selectedOrigin = parsedCandidate.origin;
  }

  const returnParams = new URLSearchParams({
    payment_return: '1',
    type: input.orderType,
    invoice: cleanInvoice,
  });

  return {
    valid: true,
    origin: selectedOrigin,
    callbackUrl: `${selectedOrigin}/?${returnParams.toString()}`,
  };
}
