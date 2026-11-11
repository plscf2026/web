# Payment system audit

## Status

**Disabled / no provider integration.** The application does not currently initiate PayStation payments or any other online payment. There is no configured merchant ID, credential, or provider base URL in source. A credential shared in conversation was not used or copied into these documents.

## Checkout path

1. `RegistrationPage` validates form values and calls `onInitiatePayment(formData, fees)`.
2. `App.tsx` sets pending state, attempts a local current-student ID reservation, then opens `PaymentModal`.
3. `PaymentModal` explicitly states payment is unavailable. It never uses pending registration fields beyond displaying student name and fee totals.
4. Closing cancels and releases the reservation.

No persisted registration is created through this checkout path. The registration-save helper exists separately but is not called by the modal.

## Component status checklist

| Capability | Status | Evidence |
|---|---|---|
| Current gateway | Not configured | No provider client, API URL, or credentials in repository. |
| PayStation Sandbox | Not implemented | No PayStation URL/SDK/request/reference in source. |
| Checkout initiation | Not implemented | UI opens notice-only `PaymentModal`. |
| Amount | Display only | Fee total calculated/displayed in BDT; not sent to any provider. |
| Invoice/order number | Not implemented | No provider invoice/order flow. |
| Currency | Display uses taka/BDT-style labels; no provider currency field. | `RegistrationPage` fee calculation/`PaymentModal` display only. |
| Customer fields | Form collects name, mobile, optional email/address; no provider request sends them. | `src/utils/rules.ts`, `RegistrationPage.tsx`. |
| Transaction ID | No provider ID generated or received in checkout. | Payment modal has no callback. |
| Provider response | None. | No request is sent. |
| Return/callback/webhook/IPN | Not implemented | No callback or webhook endpoint. |
| Verification | Disabled | `verify-payment` responds 503 without inspecting provider evidence. |
| Status update | No successful payment update through checkout. | SQL helper exists but is not wired to this flow. |
| Ticket on payment | Not implemented in current flow | Ticket view and QR components exist separately. |
| Email confirmation | Simulated UI only | `TicketView` toggles a fake success modal. |
| Refund/cancel | No provider refund; modal close only cancels pending local UI/reservation. | No refund API. |

## Verification security

The current Edge Function is safely non-success-shaped: it returns a fixed 503 and does not mark a payment as paid. No browser redirect or callback is trusted because none is implemented.

There is a legacy `rpc_verify_payment` SQL routine that can update payment fields when called by a privileged server role. Its code does not call PayStation, validate a provider response, or compare the supplied amount with expected registration total. The Nov. 10 hardening migration restricts it to `service_role`. It is not invoked from current app code and must not be exposed as a client payment-verification API.

`src/utils/security.ts` includes a client-side hash/signature helper and checklist but is not a trusted payment verifier; client logic can be modified. Do not rely on it for payment authorization.

## Sandbox/merchant status

No live request was made and no backend logs were available. Therefore Sandbox URL validity, merchant/account activation, merchant credentials, payment-channel enablement, and the reported provider error cannot be verified from this repository. PayStation activation is a merchant-support question, separate from this code’s disabled state.

## Safe future integration outline

Before enabling payment, obtain PayStation’s current Sandbox API specification and merchant-approved test credentials through a secure channel. Implement initiation and provider verification entirely server-side, persist a pending registration/order before redirect, correlate immutable invoice/amount/currency, verify provider signature/status/amount before updating paid state, make callbacks idempotent, and issue tickets only after server verification. Preserve Sandbox-only configuration in a server secret store and enforce explicit environment guardrails. See [FUTURE_IMPLEMENTATION_ROADMAP.md](./FUTURE_IMPLEMENTATION_ROADMAP.md).

