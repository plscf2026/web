import {
  resolveCurrencyVerification,
  CurrencyVerificationMode,
  PendingOrderCurrencyBinding,
} from './currencyStrategy.ts';

export type GatewayStatusSource = 'v2/transaction-status' | 'transaction-status-v1';

export interface GatewayStatusQueryResult {
  ok: boolean;
  statusCode?: number;
  error?: string;
  message?: string;
  amount?: number;
  method?: string | null;
  currency?: 'BDT';
  currencyVerificationMode?: CurrencyVerificationMode;
  verificationSource?: GatewayStatusSource;
  trxId?: string;
  invoiceNumber?: string | null;
  rawData?: Record<string, unknown>;
}

export interface VerifyGatewayStatusDeps {
  baseUrl: string;
  merchantId: string;
  allowOrderBoundCurrencyAttestation: boolean;
  fetchFn?: typeof fetch;
  pendingOrder?: PendingOrderCurrencyBinding | null;
}

export async function verifyPayStationTransaction(
  trxId: string,
  expectedInvoiceNumber: string | undefined,
  deps: VerifyGatewayStatusDeps
): Promise<GatewayStatusQueryResult> {
  const cleanTrx = trxId.trim();
  if (!cleanTrx) {
    return { ok: false, statusCode: 400, error: 'INVALID_TRX_ID', message: 'Transaction ID is required.' };
  }

  const doFetch = deps.fetchFn || fetch;
  let data: any = null;
  let source: GatewayStatusSource = 'v2/transaction-status';
  let needV1Fallback = false;

  // 1. Official PayStation v2 Transaction Status API (by trxId)
  try {
    const v2Res = await doFetch(`${deps.baseUrl}/v2/transaction-status`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'merchantId': deps.merchantId,
      },
      body: JSON.stringify({ trxId: cleanTrx }),
    });
    const v2Text = await v2Res.text();
    try {
      data = JSON.parse(v2Text);
    } catch {
      data = null;
    }

    // PayStation Sandbox `/v2/transaction-status` can return HTTP 500 Server Error
    // even for completed transactions; fall back cleanly to official `/transaction-status` v1
    // only when an authoritative invoice_number is available to cross-verify.
    if (!v2Res.ok || !data || typeof data.status_code !== 'string') {
      if (v2Res.status >= 500 && expectedInvoiceNumber) {
        needV1Fallback = true;
      } else {
        return {
          ok: false,
          statusCode: 502,
          error: 'GATEWAY_ERROR',
          message: `PayStation v2 status returned HTTP ${v2Res.status}.`,
        };
      }
    }
  } catch (err: any) {
    if (expectedInvoiceNumber) {
      needV1Fallback = true;
    } else {
      return {
        ok: false,
        statusCode: 502,
        error: 'GATEWAY_UNREACHABLE',
        message: err?.message || 'Failed to verify transaction with PayStation.',
      };
    }
  }

  // 2. Official PayStation v1 Transaction Status API fallback (by invoice_number)
  if (needV1Fallback && expectedInvoiceNumber) {
    source = 'transaction-status-v1';
    try {
      const formBody = new URLSearchParams();
      formBody.append('invoice_number', expectedInvoiceNumber.trim());
      const v1Res = await doFetch(`${deps.baseUrl}/transaction-status`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
          'merchantId': deps.merchantId,
        },
        body: formBody,
      });
      data = await v1Res.json();
    } catch (err: any) {
      return {
        ok: false,
        statusCode: 502,
        error: 'GATEWAY_UNREACHABLE',
        message: err?.message || 'Failed to verify transaction with PayStation v1 status.',
      };
    }
  }

  const rawTrxStatus = typeof data?.data?.trx_status === 'string' ? data.data.trx_status.toLowerCase().trim() : '';
  if (data?.status_code !== '200' || !data?.data || !['success', 'successful'].includes(rawTrxStatus)) {
    return {
      ok: false,
      statusCode: 402,
      error: 'TRANSACTION_NOT_VERIFIED',
      message: 'PayStation transaction could not be verified or is not in Success status.',
    };
  }

  const gatewayAmount = Number(data.data.payment_amount ?? data.data.trx_amount);
  if (!Number.isFinite(gatewayAmount) || gatewayAmount <= 0) {
    return {
      ok: false,
      statusCode: 402,
      error: 'INVALID_AMOUNT',
      message: 'PayStation transaction amount is missing or invalid.',
    };
  }

  const gwTrxId = data.data.trx_id ? String(data.data.trx_id).trim() : '';
  if (!gwTrxId || gwTrxId.toUpperCase() !== cleanTrx.toUpperCase()) {
    return {
      ok: false,
      statusCode: 402,
      error: 'TRX_ID_MISMATCH',
      message: 'PayStation returned a missing or mismatched transaction ID.',
    };
  }

  const gwInvoice = data.data.invoice_number ? String(data.data.invoice_number).trim() : null;
  if (expectedInvoiceNumber && gwInvoice && gwInvoice !== expectedInvoiceNumber.trim()) {
    return {
      ok: false,
      statusCode: 402,
      error: 'INVOICE_MISMATCH',
      message: 'PayStation transaction invoice does not match the requested order.',
    };
  }

  const currencyOutcome = resolveCurrencyVerification({
    rawGatewayCurrency: data.data.currency,
    gatewayAmount,
    gatewayRequestAmount: data.data.request_amount,
    allowOrderBoundAttestation: deps.allowOrderBoundCurrencyAttestation,
    pendingOrder: deps.pendingOrder,
  });

  if (!currencyOutcome.ok) {
    return {
      ok: false,
      statusCode: currencyOutcome.statusCode || 402,
      error: currencyOutcome.error,
      message: currencyOutcome.message,
    };
  }

  return {
    ok: true,
    amount: gatewayAmount,
    method: data.data.payment_method ? String(data.data.payment_method) : null,
    currency: currencyOutcome.currency,
    currencyVerificationMode: currencyOutcome.mode,
    verificationSource: source,
    trxId: gwTrxId,
    invoiceNumber: gwInvoice,
    rawData: {
      ...data.data,
      _verification_source: source,
      _currency_verification_mode: currencyOutcome.mode,
    },
  };
}
