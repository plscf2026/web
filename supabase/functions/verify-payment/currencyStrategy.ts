export type CurrencyVerificationMode =
  | 'GATEWAY_EXPLICIT_BDT'
  | 'ORDER_BOUND_ATTESTED_BDT';

export interface PendingOrderCurrencyBinding {
  invoice_number?: string;
  currency?: string | null;
  amount?: number | string | null;
}

export interface CurrencyVerificationInput {
  rawGatewayCurrency: unknown;
  gatewayAmount: number;
  gatewayRequestAmount?: unknown;
  allowOrderBoundAttestation: boolean;
  pendingOrder?: PendingOrderCurrencyBinding | null;
}

export interface CurrencyVerificationOutcome {
  ok: boolean;
  statusCode?: number;
  error?: string;
  message?: string;
  currency?: 'BDT';
  mode?: CurrencyVerificationMode;
}

/**
 * Documented, fail-closed currency verification strategy for PayStation.
 *
 * Official PayStation `/transaction-status` and `/v2/transaction-status` schemas
 * do NOT include a guaranteed `currency` property in `data`. We NEVER blindly
 * default a missing currency field to `'BDT'`:
 *   1. If gateway returns `currency`, it must strictly equal `'BDT'`.
 *   2. If gateway omits `currency`, verification fails closed with `CURRENCY_MISSING`
 *      unless `allowOrderBoundAttestation` is explicitly enabled AND an authoritative
 *      `pending_orders` record confirms `currency === 'BDT'` plus exact `amount` and
 *      `request_amount` agreement.
 */
export function resolveCurrencyVerification(
  input: CurrencyVerificationInput
): CurrencyVerificationOutcome {
  const rawCurrency = input.rawGatewayCurrency;
  const gwCurrency =
    typeof rawCurrency === 'string' && rawCurrency.trim() !== ''
      ? rawCurrency.trim().toUpperCase()
      : null;

  if (gwCurrency !== null) {
    if (gwCurrency !== 'BDT') {
      return {
        ok: false,
        statusCode: 402,
        error: 'CURRENCY_MISMATCH',
        message: `Unexpected currency: ${gwCurrency}. Only BDT is accepted.`,
      };
    }

    if (input.pendingOrder) {
      const orderCurrency = String(input.pendingOrder.currency || '').trim().toUpperCase();
      if (orderCurrency && orderCurrency !== 'BDT') {
        return {
          ok: false,
          statusCode: 402,
          error: 'CURRENCY_MISMATCH',
          message: `Pending order currency mismatch: ${orderCurrency}.`,
        };
      }
      const orderAmt = Number(input.pendingOrder.amount);
      if (Number.isFinite(orderAmt) && Math.abs(orderAmt - input.gatewayAmount) > 0.01) {
        return {
          ok: false,
          statusCode: 402,
          error: 'AMOUNT_MISMATCH',
          message: `Gateway amount (${input.gatewayAmount}) disagrees with pending order (${orderAmt}).`,
        };
      }
    }

    return {
      ok: true,
      currency: 'BDT',
      mode: 'GATEWAY_EXPLICIT_BDT',
    };
  }

  // Gateway omitted `currency`: fail closed by default.
  if (!input.allowOrderBoundAttestation) {
    return {
      ok: false,
      statusCode: 402,
      error: 'CURRENCY_MISSING',
      message:
        'PayStation response did not include a currency field. Payment finalization requires explicit currency confirmation or attested order binding.',
    };
  }

  // Order-bound attestation requires a valid server-initiated BDT pending_order
  if (!input.pendingOrder) {
    return {
      ok: false,
      statusCode: 402,
      error: 'ORDER_BINDING_MISSING',
      message:
        'PayStation omitted currency and no authoritative pending_orders record was found to bind BDT initiation.',
    };
  }

  const orderCurrency = String(input.pendingOrder.currency || '').trim().toUpperCase();
  if (orderCurrency !== 'BDT') {
    return {
      ok: false,
      statusCode: 402,
      error: 'CURRENCY_MISMATCH',
      message: `Initiated pending_orders currency must be BDT (found: ${orderCurrency || 'EMPTY'}).`,
    };
  }

  const expectedOrderAmount = Number(input.pendingOrder.amount);
  if (!Number.isFinite(expectedOrderAmount) || expectedOrderAmount <= 0) {
    return {
      ok: false,
      statusCode: 402,
      error: 'INVALID_AMOUNT',
      message: 'Authoritative pending_orders amount is invalid.',
    };
  }

  if (Math.abs(input.gatewayAmount - expectedOrderAmount) > 0.01) {
    return {
      ok: false,
      statusCode: 402,
      error: 'AMOUNT_MISMATCH',
      message: `Gateway payment_amount (${input.gatewayAmount}) disagrees with initiated order (${expectedOrderAmount}).`,
    };
  }

  if (
    input.gatewayRequestAmount !== undefined &&
    input.gatewayRequestAmount !== null &&
    String(input.gatewayRequestAmount).trim() !== ''
  ) {
    const reqAmount = Number(input.gatewayRequestAmount);
    if (!Number.isFinite(reqAmount) || Math.abs(reqAmount - expectedOrderAmount) > 0.01) {
      return {
        ok: false,
        statusCode: 402,
        error: 'AMOUNT_MISMATCH',
        message: `Gateway request_amount (${input.gatewayRequestAmount}) disagrees with initiated order (${expectedOrderAmount}).`,
      };
    }
  }

  return {
    ok: true,
    currency: 'BDT',
    mode: 'ORDER_BOUND_ATTESTED_BDT',
  };
}
