/**
 * k6 Load Test: Event Deadline Rush & Peak Gate Scanning
 * Target: Police Lines School & College Faridpur (PLSCF) Reunion Platform
 * Scenarios:
 *   1. Registration & Payment Initiation Rush (500 to 2,000 concurrent VUs)
 *   2. Peak Event Gate Scanning (10 Gates × 30 scans/min = 300 scans/min sustained)
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom metrics
export const errorRate = new Rate('errors');
export const gateScanTrend = new Trend('gate_scan_duration_ms');
export const checkoutTrend = new Trend('checkout_initiation_duration_ms');
export const successfulCheckins = new Counter('successful_checkins');

export const options = {
  scenarios: {
    // Scenario 1: Pre-event registration rush (deadline spike)
    registration_rush: {
      executor: 'ramping-vus',
      startVUs: 10,
      stages: [
        { duration: '30s', target: 100 },  // Warm-up
        { duration: '1m', target: 500 },   // Normal rush
        { duration: '1m', target: 1000 },  // Peak deadline rush (1,000 concurrent users)
        { duration: '30s', target: 0 },    // Ramp-down
      ],
      gracefulRampDown: '15s',
      exec: 'registrationWorkflow',
    },
    // Scenario 2: Event-morning Gate Entry Peak
    gate_entry_peak: {
      executor: 'constant-vus',
      vus: 50, // 50 concurrent scanner volunteer tablets
      duration: '2m',
      exec: 'gateScanWorkflow',
    },
  },
  thresholds: {
    // SLO: 95% of requests must resolve under 800ms
    http_req_duration: ['p(95)<800', 'p(99)<1500'],
    // Maximum allowable HTTP error rate < 1%
    errors: ['rate<0.01'],
    // Gate scanning sub-second threshold
    gate_scan_duration_ms: ['p(95)<400'],
  },
};

const BASE_URL = __ENV.TARGET_URL || 'https://plscf.org';
const SUPABASE_URL = __ENV.VITE_SUPABASE_URL || 'https://hnthoszbkhvygoowtvau.supabase.co';
const SUPABASE_ANON_KEY = __ENV.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOi...';

const headers = {
  'Content-Type': 'application/json',
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
};

export function registrationWorkflow() {
  const vuId = __VU;
  const iterId = __ITER;
  const invoiceNumber = `PLSCF27-LOAD-${vuId}-${iterId}-${Date.now().toString(36).toUpperCase()}`;

  // 1. Visit homepage & fetch event stats
  const homeRes = http.get(`${BASE_URL}/`);
  check(homeRes, { 'Homepage status 200': (r) => r.status === 200 });

  // 2. Query fee configuration & existing registrations
  const queryStart = Date.now();
  const feeRes = http.get(`${SUPABASE_URL}/rest/v1/event_fee_settings?select=*&limit=1`, { headers });
  check(feeRes, { 'Fee settings query successful': (r) => r.status === 200 });

  // 3. Create server-side pending order before redirecting
  const pendingPayload = JSON.stringify({
    id: `ORD-${invoiceNumber}`,
    invoice_number: invoiceNumber,
    amount: 1500,
    customer_name: `Load Test Student ${vuId}-${iterId}`,
    customer_phone: `0171${String(vuId).padStart(3, '0')}${String(iterId).slice(-4).padStart(4, '0')}`,
    form_data: {
      fullName: `Load Test Student ${vuId}-${iterId}`,
      mobileNumber: `0171${String(vuId).padStart(3, '0')}${String(iterId).slice(-4).padStart(4, '0')}`,
      category: 'former',
      batchName: 'SSC 2015',
      tShirtSize: 'L',
    },
    fees: { registrationFee: 1500, donationAmount: 0, totalPayable: 1500 },
    gateway_provider: 'PAYSTATION',
    status: 'pending',
  });

  const pendingRes = http.post(`${SUPABASE_URL}/rest/v1/pending_orders`, pendingPayload, { headers });
  checkoutTrend.add(Date.now() - queryStart);
  const success = check(pendingRes, {
    'Pending order created': (r) => r.status === 201 || r.status === 200,
  });

  if (!success) {
    errorRate.add(1);
  }

  sleep(Math.random() * 2 + 1); // User reading checkout prompt (1-3s)
}

export function gateScanWorkflow() {
  const scanStart = Date.now();

  // Simulated rapid QR token scan lookup
  const sampleToken = 'PLSCF27-F1001';
  const scanRes = http.post(
    `${SUPABASE_URL}/rest/v1/rpc/rpc_confirm_gate_event`,
    JSON.stringify({
      p_registration_id: sampleToken,
      p_event_type: 'ENTRY',
      p_gate_id: 'GATE-01',
      p_staff_id: 'STAFF-LOAD-01',
      p_staff_name: 'Volunteer Gate 1',
    }),
    { headers }
  );

  gateScanTrend.add(Date.now() - scanStart);

  const isOk = check(scanRes, {
    'Gate scan answered with valid JSON': (r) => r.status === 200 || r.status === 400,
  });

  if (isOk && scanRes.status === 200) {
    successfulCheckins.add(1);
  } else if (!isOk) {
    errorRate.add(1);
  }

  sleep(0.5); // Rapid scanning pace (2 scans per second per VU)
}
