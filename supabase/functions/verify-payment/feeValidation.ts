// Shared pure fee validation & server-authoritative amount calculation.
// Used by supabase/functions/verify-payment/index.ts and unit tests.
// ZERO hardcoded fallback fees: missing or invalid system_settings fails closed.

export interface AuthoritativeFeeSettings {
  currentStudentFee: number;
  formerStudentFee: number;
  parentFee: number;
  minDonation: number;
  maxDonation: number;
  maxTotalPayable: number;
  gatewayChargeRates: Record<string, number>;
  registrationOpen?: boolean;
  donationOpen?: boolean;
  paymentEnabled?: boolean;
}

export interface OrderFeeInput {
  orderType: unknown;
  category?: unknown;
  gender?: unknown;
  currentClass?: unknown;
  hasParent?: unknown;
  donationAmount?: unknown;
  paymentMethod?: unknown;
  payWithCharge?: unknown;
  clientPaymentAmount?: unknown;
  clientRegistrationFee?: unknown;
  clientParentFee?: unknown;
  clientGatewayCharge?: unknown;
}

export function isStudentBelowClass6Server(className?: unknown): boolean {
  if (typeof className !== 'string' || !className.trim()) return false;
  const clean = className.trim().toLowerCase();
  if (/^(play|nursery|kg|kindergarten|pre|shishu|baby|infant)/i.test(clean)) return true;
  if (/^(class\s*|std\s*|grade\s*)?(i|ii|iii|iv|v)$/i.test(clean)) return true;
  if (/[১-৫]/.test(clean)) return true;
  if (/\b(one|two|three|four|five)\b/i.test(clean)) return true;
  const match = clean.match(/\d+/);
  if (match) {
    const classNum = parseInt(match[0], 10);
    if (classNum >= 1 && classNum <= 5) return true;
  }
  return ['play', 'nursery', 'kg', '1', '2', '3', '4', '5', 'class 1', 'class 2', 'class 3', 'class 4', 'class 5'].includes(clean);
}

export function isGuardianEligibleServer(
  category: unknown,
  gender: unknown,
  currentClass: unknown
): boolean {
  const cat = typeof category === 'string' ? category.trim().toLowerCase() : '';
  if (cat !== 'current') return false;
  const gen = typeof gender === 'string' ? gender.trim().toLowerCase() : '';
  if (gen === 'female') return true;
  return isStudentBelowClass6Server(currentClass);
}

export interface ComputedOrderBreakdown {
  valid: boolean;
  error?: string;
  message?: string;
  orderType?: 'registration' | 'donation';
  category?: 'current' | 'former';
  hasParent?: boolean;
  paymentMethod?: string;
  payWithCharge?: 0 | 1;
  registrationFee?: number;
  parentFee?: number;
  donationAmount?: number;
  gatewayCharge?: number;
  subtotal?: number;
  expectedTotal?: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function isFiniteNonNeg(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0;
}

export function computeAuthoritativeOrderAmount(
  rawSettings: unknown,
  input: OrderFeeInput
): ComputedOrderBreakdown {
  if (!rawSettings || typeof rawSettings !== 'object' || Array.isArray(rawSettings)) {
    return {
      valid: false,
      error: 'FEE_SETTINGS_MISSING',
      message: 'Authoritative fee configuration is missing from system_settings.',
    };
  }

  const s = rawSettings as Record<string, unknown>;
  const currentStudentFee = Number(s.currentStudentFee);
  const formerStudentFee = Number(s.formerStudentFee);
  const parentFeeCfg = Number(s.parentFee);
  const minDonation = Number(s.minDonation);
  const maxDonation = Number(s.maxDonation);
  const maxTotalPayable = Number(s.maxTotalPayable);
  const ratesObj = s.gatewayChargeRates as Record<string, unknown> | undefined;

  if (
    !Number.isFinite(currentStudentFee) || currentStudentFee <= 0 ||
    !Number.isFinite(formerStudentFee) || formerStudentFee <= 0 ||
    !isFiniteNonNeg(parentFeeCfg) ||
    !Number.isFinite(minDonation) || minDonation <= 0 ||
    !Number.isFinite(maxDonation) || maxDonation < minDonation ||
    !Number.isFinite(maxTotalPayable) || maxTotalPayable <= 0 ||
    !ratesObj || typeof ratesObj !== 'object' || Array.isArray(ratesObj)
  ) {
    return {
      valid: false,
      error: 'FEE_SETTINGS_MISSING',
      message: 'Required authoritative fee configuration keys are missing or invalid.',
    };
  }

  const rawType = typeof input.orderType === 'string' ? input.orderType.trim().toLowerCase() : '';
  if (rawType !== 'registration' && rawType !== 'donation') {
    return {
      valid: false,
      error: 'INVALID_ORDER_TYPE',
      message: 'Unsupported or missing order_type. Must be "registration" or "donation".',
    };
  }

  const rawMethod = typeof input.paymentMethod === 'string' ? input.paymentMethod.trim().toLowerCase() : '';
  const method = rawMethod || 'paystation';
  let rate: number;
  if (method in ratesObj) {
    rate = Number(ratesObj[method]);
  } else if (method === 'paystation' && s.gatewayChargePercent !== undefined && s.gatewayChargePercent !== null) {
    rate = Number(s.gatewayChargePercent) / 100;
  } else {
    return {
      valid: false,
      error: 'INVALID_PAYMENT_METHOD',
      message: `Unsupported or unconfigured payment method: ${String(input.paymentMethod ?? '')}`,
    };
  }
  if (!Number.isFinite(rate) || rate < 0 || rate > 0.25) {
    return {
      valid: false,
      error: 'INVALID_FEE_SETTINGS',
      message: 'Configured gateway charge rate is invalid.',
    };
  }

  const payWithChargeNum = input.payWithCharge === undefined || input.payWithCharge === null ? 0 : Number(input.payWithCharge);
  if (payWithChargeNum !== 0 && payWithChargeNum !== 1) {
    return {
      valid: false,
      error: 'INVALID_PAY_WITH_CHARGE',
      message: 'pay_with_charge must be 0 or 1.',
    };
  }

  const rawDonation = input.donationAmount === undefined || input.donationAmount === null || input.donationAmount === ''
    ? 0
    : Number(input.donationAmount);
  if (!Number.isFinite(rawDonation) || rawDonation < 0 || rawDonation > maxDonation) {
    return {
      valid: false,
      error: 'INVALID_DONATION_AMOUNT',
      message: `Donation amount must be between 0 and ${maxDonation} BDT.`,
    };
  }

  const hasParent = Boolean(input.hasParent);
  let registrationFee = 0;
  let parentFee = 0;
  let resolvedCategory: 'current' | 'former' | undefined;

  if (rawType === 'registration') {
    const rawCat = typeof input.category === 'string' ? input.category.trim().toLowerCase() : '';
    if (rawCat !== 'current' && rawCat !== 'former') {
      return {
        valid: false,
        error: 'INVALID_CATEGORY',
        message: 'Registration category must be "current" or "former".',
      };
    }
    resolvedCategory = rawCat;
    if (hasParent && !isGuardianEligibleServer(rawCat, input.gender, input.currentClass)) {
      return {
        valid: false,
        error: 'GUARDIAN_NOT_ELIGIBLE',
        message: 'Accompanying parent/guardian pass is only available for current female students or current male students below Class 6.',
      };
    }
    registrationFee = rawCat === 'current' ? currentStudentFee : formerStudentFee;
    parentFee = hasParent ? parentFeeCfg : 0;
  } else {
    if (hasParent) {
      return {
        valid: false,
        error: 'INVALID_ORDER_PARAMS',
        message: 'Donation orders cannot include parent pass fees.',
      };
    }
    if (rawDonation < minDonation) {
      return {
        valid: false,
        error: 'INVALID_DONATION_AMOUNT',
        message: `Donation amount must be at least ${minDonation} BDT.`,
      };
    }
  }

  const subtotal = round2(registrationFee + parentFee + rawDonation);
  const gatewayCharge = round2(subtotal * rate);
  const expectedTotal = round2(subtotal + gatewayCharge);

  if (!Number.isFinite(expectedTotal) || expectedTotal <= 0 || expectedTotal > maxTotalPayable) {
    return {
      valid: false,
      error: 'AMOUNT_OVERFLOW',
      message: `Computed payment total ${expectedTotal} exceeds maximum allowed ${maxTotalPayable}.`,
    };
  }

  // Reject any client-supplied amount or fee component that disagrees with server rules
  if (input.clientPaymentAmount !== undefined && input.clientPaymentAmount !== null && input.clientPaymentAmount !== '') {
    const clientTotal = Number(input.clientPaymentAmount);
    if (!Number.isFinite(clientTotal) || Math.abs(clientTotal - expectedTotal) > 0.01) {
      return {
        valid: false,
        error: 'AMOUNT_MISMATCH',
        message: `Client payment_amount (${input.clientPaymentAmount}) does not match authoritative total (${expectedTotal}).`,
      };
    }
  }
  if (input.clientRegistrationFee !== undefined && input.clientRegistrationFee !== null && input.clientRegistrationFee !== '') {
    const clientRegFee = Number(input.clientRegistrationFee);
    if (!Number.isFinite(clientRegFee) || Math.abs(clientRegFee - registrationFee) > 0.01) {
      return {
        valid: false,
        error: 'FEE_DECOMPOSITION_MISMATCH',
        message: `Client registrationFee disagrees with server rule (${registrationFee}).`,
      };
    }
  }
  if (input.clientParentFee !== undefined && input.clientParentFee !== null && input.clientParentFee !== '') {
    const clientPFee = Number(input.clientParentFee);
    if (!Number.isFinite(clientPFee) || Math.abs(clientPFee - parentFee) > 0.01) {
      return {
        valid: false,
        error: 'FEE_DECOMPOSITION_MISMATCH',
        message: `Client parentFee disagrees with server rule (${parentFee}).`,
      };
    }
  }
  if (input.clientGatewayCharge !== undefined && input.clientGatewayCharge !== null && input.clientGatewayCharge !== '') {
    const clientGw = Number(input.clientGatewayCharge);
    if (!Number.isFinite(clientGw) || Math.abs(clientGw - gatewayCharge) > 0.01) {
      return {
        valid: false,
        error: 'FEE_DECOMPOSITION_MISMATCH',
        message: `Client gatewayCharge disagrees with server rule (${gatewayCharge}).`,
      };
    }
  }

  return {
    valid: true,
    orderType: rawType,
    category: resolvedCategory,
    hasParent,
    paymentMethod: method,
    payWithCharge: payWithChargeNum as 0 | 1,
    registrationFee,
    parentFee,
    donationAmount: round2(rawDonation),
    gatewayCharge,
    subtotal,
    expectedTotal,
  };
}

/**
 * F-09 fix: Given a verified gateway settlement total (`gatewayPaidAmount`),
 * determine and validate the authoritative principal donation amount (without
 * double-charging the gateway percentage onto an already-charged gateway total).
 */
export function resolveAuthoritativeDonationPrincipal(
  rawSettings: unknown,
  gatewayPaidAmount: number,
  paymentMethod: unknown,
  pendingOrderFees?: { donationAmount?: unknown; gatewayCharge?: unknown } | null
): ComputedOrderBreakdown {
  if (!Number.isFinite(gatewayPaidAmount) || gatewayPaidAmount <= 0) {
    return {
      valid: false,
      error: 'INVALID_DONATION_AMOUNT',
      message: 'Verified gateway payment amount must be positive.',
    };
  }

  const s = (rawSettings && typeof rawSettings === 'object' && !Array.isArray(rawSettings))
    ? (rawSettings as Record<string, unknown>)
    : null;
  const ratesObj = (s?.gatewayChargeRates && typeof s.gatewayChargeRates === 'object' && !Array.isArray(s.gatewayChargeRates))
    ? (s.gatewayChargeRates as Record<string, unknown>)
    : null;

  const rawMethod = typeof paymentMethod === 'string' ? paymentMethod.trim().toLowerCase() : '';
  const method = rawMethod || 'paystation';
  let rate = 0;
  if (ratesObj && method in ratesObj) {
    rate = Number(ratesObj[method]);
  } else if (method === 'paystation' && s?.gatewayChargePercent !== undefined && s?.gatewayChargePercent !== null) {
    rate = Number(s.gatewayChargePercent) / 100;
  }

  let candidatePrincipal: number | undefined;
  if (pendingOrderFees && pendingOrderFees.donationAmount !== undefined && pendingOrderFees.donationAmount !== null) {
    const orderDon = Number(pendingOrderFees.donationAmount);
    if (Number.isFinite(orderDon) && orderDon > 0) {
      candidatePrincipal = orderDon;
    }
  }
  if (candidatePrincipal === undefined) {
    candidatePrincipal = Number.isFinite(rate) && rate >= 0 ? round2(gatewayPaidAmount / (1 + rate)) : gatewayPaidAmount;
  }

  return computeAuthoritativeOrderAmount(rawSettings, {
    orderType: 'donation',
    donationAmount: candidatePrincipal,
    paymentMethod: method,
    payWithCharge: 0,
    clientPaymentAmount: gatewayPaidAmount,
  });
}
