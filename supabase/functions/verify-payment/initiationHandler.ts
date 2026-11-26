import { computeAuthoritativeOrderAmount } from './feeValidation.ts';
import { resolveServerCallbackUrl } from './callbackUrl.ts';
import { validateAndBuildPendingRegistrationData } from './registrationPayload.ts';

export interface InitiatePaymentSettingsResult {
  value: unknown;
  error?: string;
}

export interface InitiatePaymentGatewayResponse {
  status: number;
  text: string;
}

export interface InitiatePaymentDeps {
  loadSettings: () => Promise<InitiatePaymentSettingsResult>;
  upsertPendingOrder: (row: Record<string, unknown>) => Promise<{ error?: string }>;
  fetchGateway: (url: string, init: RequestInit) => Promise<InitiatePaymentGatewayResponse>;
  config: {
    paystationEnv: string;
    paystationBaseUrl: string;
    merchantId: string;
    password: string;
    allowedOriginsRaw: string;
    allowPaymentFinalization: boolean;
  };
}

export interface InitiatePaymentResult {
  status: number;
  body: Record<string, unknown>;
}

function normalizePhoneDigits(raw: unknown): string {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.startsWith('880') && digits.length === 13) {
    return `0${digits.slice(3)}`;
  }
  return digits;
}

export async function executeInitiatePayment(
  rawOrder: unknown,
  deps: InitiatePaymentDeps
): Promise<InitiatePaymentResult> {
  const order = (rawOrder && typeof rawOrder === 'object' ? rawOrder : {}) as Record<string, unknown>;

  if (!order.invoice_number || typeof order.invoice_number !== 'string' || !order.invoice_number.trim()) {
    return {
      status: 400,
      body: { success: false, error: 'INVALID_INVOICE_NUMBER', message: 'invoice_number is required.' },
    };
  }

  if (order.currency !== undefined && order.currency !== null && String(order.currency).trim().toUpperCase() !== 'BDT') {
    return {
      status: 400,
      body: { success: false, error: 'CURRENCY_MISMATCH', message: 'Only BDT currency is supported.' },
    };
  }

  let settingsRes: InitiatePaymentSettingsResult;
  try {
    settingsRes = await deps.loadSettings();
  } catch (err: any) {
    return {
      status: 503,
      body: {
        success: false,
        error: 'FEE_SETTINGS_MISSING',
        message: err?.message || 'Authoritative fee configuration could not be read.',
      },
    };
  }

  if (
    settingsRes.error ||
    !settingsRes.value ||
    typeof settingsRes.value !== 'object' ||
    Array.isArray(settingsRes.value)
  ) {
    return {
      status: 503,
      body: {
        success: false,
        error: 'FEE_SETTINGS_MISSING',
        message: 'Authoritative fee configuration is unavailable.',
      },
    };
  }

  const rawSettings = settingsRes.value as Record<string, unknown>;

  // Fail closed unless portal_fee_settings.paymentEnabled is explicitly boolean true
  if (rawSettings.paymentEnabled !== true) {
    return {
      status: 403,
      body: {
        success: false,
        error: 'PAYMENT_DISABLED',
        message: 'Online payment initiation is currently disabled.',
      },
    };
  }

  const feeEval = computeAuthoritativeOrderAmount(rawSettings, {
    orderType: order.order_type,
    category: order.category,
    hasParent: order.has_parent ?? order.hasParent,
    donationAmount: order.donation_amount ?? order.donationAmount ?? 0,
    paymentMethod: order.payment_method ?? 'bkash',
    payWithCharge: order.pay_with_charge ?? 0,
    clientPaymentAmount: order.payment_amount,
    clientRegistrationFee: order.registration_fee ?? order.registrationFee,
    clientParentFee: order.parent_fee ?? order.parentFee,
    clientGatewayCharge: order.gateway_charge ?? order.gatewayCharge,
  });

  if (!feeEval.valid) {
    const status = feeEval.error === 'FEE_SETTINGS_MISSING' || feeEval.error === 'INVALID_FEE_SETTINGS' ? 503 : 400;
    return { status, body: { success: false, error: feeEval.error, message: feeEval.message } };
  }

  // Enforce flow open switches across all environments (fail closed if missing/false)
  if (feeEval.orderType === 'registration') {
    if (rawSettings.registrationOpen !== true) {
      return {
        status: 403,
        body: { success: false, error: 'REGISTRATION_CLOSED', message: 'Registration is closed.' },
      };
    }
    if (feeEval.category === 'former' && rawSettings.alumniRegistrationOpen === false) {
      return {
        status: 403,
        body: { success: false, error: 'ALUMNI_REGISTRATION_CLOSED', message: 'Alumni registration is closed.' },
      };
    }
    if (feeEval.category === 'current' && rawSettings.currentStudentRegistrationOpen === false) {
      return {
        status: 403,
        body: {
          success: false,
          error: 'CURRENT_STUDENT_REGISTRATION_CLOSED',
          message: 'Current student registration is closed.',
        },
      };
    }
  } else if (feeEval.orderType === 'donation') {
    if (rawSettings.donationOpen !== true) {
      return {
        status: 403,
        body: { success: false, error: 'DONATION_CLOSED', message: 'Donations are closed.' },
      };
    }
  }

  const cbEval = resolveServerCallbackUrl({
    allowedOriginsRaw: deps.config.allowedOriginsRaw,
    paystationEnv: deps.config.paystationEnv,
    requestedCallbackUrl: order.callback_url,
    requestedOrigin: order.return_origin,
    orderType: feeEval.orderType!,
    invoiceNumber: String(order.invoice_number),
  });

  if (!cbEval.valid) {
    const status = cbEval.error === 'CALLBACK_ORIGIN_NOT_CONFIGURED' ? 503 : 400;
    return { status, body: { success: false, error: cbEval.error, message: cbEval.message } };
  }

  let authoritativeFormData: Record<string, unknown>;
  let customerName: string;
  let customerPhone: string;
  let customerEmail: string | null;
  let registrationId: string | undefined;

  if (feeEval.orderType === 'registration') {
    const regEval = validateAndBuildPendingRegistrationData(order, feeEval.category!, Boolean(feeEval.hasParent));
    if (!regEval.valid || !regEval.data) {
      return {
        status: 400,
        body: {
          success: false,
          error: regEval.error || 'INVALID_REGISTRATION_DATA',
          message: regEval.message || 'Complete registration data is required before payment initiation.',
        },
      };
    }
    authoritativeFormData = regEval.data as unknown as Record<string, unknown>;
    customerName = regEval.data.fullName;
    customerPhone = regEval.data.mobileNumber;
    customerEmail = regEval.data.email;
    registrationId = regEval.data.registrationId;
  } else {
    const donorName = String(order.cust_name ?? '').trim().slice(0, 120);
    const donorPhone = normalizePhoneDigits(order.cust_phone);
    if (donorName.length < 2 || !/^01[3-9][0-9]{8}$/.test(donorPhone)) {
      return {
        status: 400,
        body: {
          success: false,
          error: 'INVALID_DONATION_DATA',
          message: 'Valid donor name and 11-digit Bangladeshi phone number are required.',
        },
      };
    }
    customerName = donorName;
    customerPhone = donorPhone;
    customerEmail = order.cust_email ? String(order.cust_email).trim().slice(0, 160) : null;
    authoritativeFormData = {
      donorName: customerName,
      mobileNumber: customerPhone,
      email: customerEmail,
      purpose: String(order.reference || 'General Reunion Fund').slice(0, 160),
    };
  }

  const cleanInvoice = String(order.invoice_number).trim();
  const upsertRes = await deps.upsertPendingOrder({
    id: `ORD-${cleanInvoice}`,
    invoice_number: cleanInvoice,
    order_type: feeEval.orderType!,
    amount: feeEval.expectedTotal!,
    currency: 'BDT',
    status: 'pending',
    customer_name: customerName,
    customer_phone: customerPhone,
    customer_email: customerEmail,
    form_data: authoritativeFormData,
    fees: {
      registrationFee: feeEval.registrationFee!,
      parentFee: feeEval.parentFee!,
      donationAmount: feeEval.donationAmount!,
      gatewayCharge: feeEval.gatewayCharge!,
      subtotal: feeEval.subtotal!,
      totalPayable: feeEval.expectedTotal!,
    },
    gateway_provider: 'PAYSTATION',
  });

  if (upsertRes.error) {
    return {
      status: 500,
      body: {
        success: false,
        error: 'PENDING_ORDER_PERSIST_FAILED',
        message: 'Failed to create authoritative order.',
      },
    };
  }

  const formBody = new URLSearchParams();
  formBody.append('merchantId', deps.config.merchantId);
  formBody.append('password', deps.config.password);
  formBody.append('invoice_number', cleanInvoice);
  formBody.append('currency', 'BDT');
  formBody.append('payment_amount', String(feeEval.expectedTotal!));
  // expectedTotal already includes our platform gateway charge (1.8%); instruct PayStation not to double-charge.
  formBody.append('pay_with_charge', '0');
  if (order.reference) formBody.append('reference', String(order.reference));
  formBody.append('cust_name', customerName);
  formBody.append('cust_phone', customerPhone);
  if (customerEmail) formBody.append('cust_email', customerEmail);
  if (order.cust_address) formBody.append('cust_address', String(order.cust_address));
  formBody.append('callback_url', cbEval.callbackUrl!);
  if (order.checkout_items) formBody.append('checkout_items', String(order.checkout_items));
  if (order.opt_a) formBody.append('opt_a', String(order.opt_a));
  if (order.opt_b) formBody.append('opt_b', String(order.opt_b));
  if (order.opt_c) formBody.append('opt_c', String(order.opt_c));

  try {
    const createRes = await deps.fetchGateway(`${deps.config.paystationBaseUrl}/initiate-payment`, {
      method: 'POST',
      headers: { 'Accept': 'application/json' },
      body: formBody,
    });

    let createData: any = null;
    try {
      createData = JSON.parse(createRes.text);
    } catch {
      /* non-JSON response */
    }

    if (createData?.status_code === '1008') {
      return {
        status: 400,
        body: {
          success: false,
          status_code: '1008',
          error: createData.message || 'Duplicate invoice',
        },
      };
    }

    if (createData && (createData.status_code === '200' || createData.status === 'success') && createData.payment_url) {
      let validGatewayUrl: URL | null = null;
      try {
        const parsed = new URL(String(createData.payment_url));
        if (parsed.protocol === 'https:' && parsed.hostname.endsWith('paystation.com.bd')) {
          validGatewayUrl = parsed;
        }
      } catch {
        validGatewayUrl = null;
      }

      if (!validGatewayUrl) {
        return {
          status: 502,
          body: {
            success: false,
            error: 'GATEWAY_INVALID_CHECKOUT_URL',
            message: 'PayStation returned an invalid or non-PayStation checkout URL.',
          },
        };
      }

      return {
        status: 200,
        body: {
          success: true,
          status_code: createData.status_code,
          paymentUrl: validGatewayUrl.toString(),
          invoiceNumber: createData.invoice_number || cleanInvoice,
          registrationId,
          payment_amount: String(feeEval.expectedTotal!),
          message: createData.message,
        },
      };
    }

    return {
      status: createRes.status >= 400 && createRes.status < 600 ? createRes.status : 502,
      body: {
        success: false,
        error: 'GATEWAY_INITIATION_FAILED',
        status_code: createData?.status_code,
        message: createData?.message || `PayStation gateway rejected payment initiation (HTTP ${createRes.status}).`,
      },
    };
  } catch (err: any) {
    return {
      status: 502,
      body: {
        success: false,
        error: 'GATEWAY_UNREACHABLE',
        message: err?.message || 'Payment initiation failed to reach PayStation.',
      },
    };
  }
}
