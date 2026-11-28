import { FoodDistributionRecord, GateEventRecord, RegistrationRecord } from '../types';

export interface GuardianBookingRecord {
  id: string;
  registration_id?: string | null;
  student_registration_id: string;
  event_id?: string | null;
  year?: number | null;
  guardian_name: string;
  guardian_name_bn?: string | null;
  mobile_number?: string | null;
  guardian_phone?: string | null;
  relation?: string | null;
  guardian_relation?: string | null;
  guardian_age?: string | null;
  photo_url?: string | null;
  qr_token?: string | null;
  registration_fee?: number | string | null;
  guardian_fee?: number | string | null;
  total_paid?: number | string | null;
  payment_status?: string | null;
  registration_approval_status?: string | null;
  transaction_id?: string | null;
  payment_method?: string | null;
  gateway_invoice_number?: string | null;
  is_checked_in?: boolean | null;
  gate_status?: string | null;
  registered_at?: string | null;
}

export type GuardianGateStatus = 'ENTRY' | 'BACK' | 'NOT_ENTERED' | 'UNAVAILABLE';
export type GuardianMealStatus = 'TAKEN' | 'PENDING' | 'UNAVAILABLE';

/**
 * Resolve the guardian's display registration ID, falling back to `id` when `registration_id` is blank.
 */
export function resolveGuardianDisplayId(guardian: GuardianBookingRecord): string {
  const regId = typeof guardian.registration_id === 'string' ? guardian.registration_id.trim() : '';
  return regId || String(guardian.id || '').trim();
}

/**
 * Resolve the guardian's contact number, falling back to `guardian_phone` when `mobile_number` is blank.
 */
export function resolveGuardianContact(guardian: GuardianBookingRecord): string {
  const mob = typeof guardian.mobile_number === 'string' ? guardian.mobile_number.trim() : '';
  if (mob) return mob;
  const gPhone = typeof guardian.guardian_phone === 'string' ? guardian.guardian_phone.trim() : '';
  return gPhone;
}

/**
 * Resolve the guardian's relationship label, preferring a specific relation over generic 'Guardian'.
 */
export function resolveGuardianRelation(guardian: GuardianBookingRecord): string {
  const rel = typeof guardian.relation === 'string' ? guardian.relation.trim() : '';
  const gRel = typeof guardian.guardian_relation === 'string' ? guardian.guardian_relation.trim() : '';
  if (rel && rel.toLowerCase() !== 'guardian') return rel;
  if (gRel && gRel.toLowerCase() !== 'guardian') return gRel;
  return rel || gRel || 'Guardian';
}

/**
 * App confirmation rules for guardian bookings:
 * - payment_status must be 'paid'
 * - registration_approval_status must not be 'pending' or 'rejected'
 * - year must match selectedYear (defaults to 2027 if omitted on row)
 */
export function isConfirmedGuardianBooking(
  guardian: GuardianBookingRecord,
  selectedYear?: number
): boolean {
  if (!guardian || !String(guardian.id || '').trim()) return false;
  if (selectedYear !== undefined && Number(guardian.year ?? 2027) !== selectedYear) {
    return false;
  }
  const paymentStatus = String(guardian.payment_status ?? '').trim().toLowerCase();
  if (paymentStatus !== 'paid') return false;

  const approvalStatus = String(guardian.registration_approval_status ?? 'approved')
    .trim()
    .toLowerCase();
  if (approvalStatus === 'pending' || approvalStatus === 'rejected') {
    return false;
  }
  return true;
}

/**
 * Count unique confirmed guardian bookings for the selected event year.
 * Deduplicates by unique guardian record `id` so retries or joined rows never inflate the total.
 */
export function countConfirmedGuardianBookings(
  guardians: GuardianBookingRecord[],
  selectedYear: number
): number {
  const uniqueIds = new Set<string>();
  for (const g of guardians) {
    if (!isConfirmedGuardianBooking(g, selectedYear)) continue;
    const key = String(g.id).trim().toUpperCase();
    if (key) uniqueIds.add(key);
  }
  return uniqueIds.size;
}

/**
 * Group guardians by their verified `student_registration_id` foreign key for the selected event year.
 * Deduplicates each guardian by unique record `id`.
 */
export function groupGuardiansByStudent(
  guardians: GuardianBookingRecord[],
  selectedYear: number
): Map<string, GuardianBookingRecord[]> {
  const grouped = new Map<string, GuardianBookingRecord[]>();
  const seenGuardianIds = new Set<string>();

  for (const g of guardians) {
    if (!g || !String(g.id || '').trim()) continue;
    if (Number(g.year ?? 2027) !== selectedYear) continue;

    const studentFk = String(g.student_registration_id || '').trim().toUpperCase();
    if (!studentFk) continue;

    const gKey = String(g.id).trim().toUpperCase();
    if (seenGuardianIds.has(gKey)) continue;
    seenGuardianIds.add(gKey);

    const bucket = grouped.get(studentFk);
    if (bucket) {
      bucket.push(g);
    } else {
      grouped.set(studentFk, [g]);
    }
  }

  return grouped;
}

/**
 * Check whether a guardian's tracking ID matches an activity row's `registrationId`.
 */
function matchesGuardianActivityId(guardian: GuardianBookingRecord, activityRegId?: string | null): boolean {
  const target = String(activityRegId || '').trim().toUpperCase();
  if (!target) return false;
  const primaryId = String(guardian.id || '').trim().toUpperCase();
  const displayRegId = String(guardian.registration_id || '').trim().toUpperCase();
  return target === primaryId || (Boolean(displayRegId) && target === displayRegId);
}

/**
 * Resolve guardian gate status using the guardian's own identity from `gate_events`
 * or the guardian row's `gate_status` / `is_checked_in` fields.
 */
export function getGuardianGateStatus(
  guardian: GuardianBookingRecord,
  gateEvents: GateEventRecord[]
): GuardianGateStatus {
  const matchingEvents = gateEvents.filter(
    (e) => e.status === 'APPROVED' && matchesGuardianActivityId(guardian, e.registrationId)
  );
  if (matchingEvents.length > 0) {
    const latest = matchingEvents[0].eventType;
    if (latest === 'ENTRY') return 'ENTRY';
    if (latest === 'BACK' || latest === 'EXIT') return 'BACK';
  }

  const rawStatus = String(guardian.gate_status ?? '').trim().toUpperCase();
  if (rawStatus === 'ENTRY') return 'ENTRY';
  if (rawStatus === 'BACK' || rawStatus === 'EXIT') return 'BACK';
  if (rawStatus === 'NOT_ENTERED') return 'NOT_ENTERED';
  if (guardian.is_checked_in === true) return 'ENTRY';
  if (guardian.is_checked_in === false) return 'NOT_ENTERED';

  return 'UNAVAILABLE';
}

/**
 * Resolve guardian meal usage (breakfast / lunch / dinner) from `food_distributions`
 * using the guardian's own identity.
 */
export function getGuardianMealStatus(
  guardian: GuardianBookingRecord,
  mealType: 'breakfast' | 'lunch' | 'dinner',
  foodDistributions: FoodDistributionRecord[],
  isTrackingAvailable: boolean = true
): GuardianMealStatus {
  const collected = foodDistributions.some(
    (d) =>
      matchesGuardianActivityId(guardian, d.registrationId) &&
      d.mealType === mealType &&
      d.status === 'COLLECTED'
  );
  if (collected) return 'TAKEN';
  if (!isTrackingAvailable) return 'UNAVAILABLE';
  return 'PENDING';
}

/**
 * Match a student row against searchTerm, including any of their linked guardians'
 * name, registration ID, or contact number so guardians remain grouped with their student.
 */
export function matchesStudentOrGuardianSearch(
  reg: RegistrationRecord,
  linkedGuardians: GuardianBookingRecord[],
  searchTerm: string
): boolean {
  const q = searchTerm.trim().toLowerCase();
  if (!q) return true;

  const studentMatch =
    reg.fullName.toLowerCase().includes(q) ||
    reg.id.toLowerCase().includes(q) ||
    (reg.mobileNumber || '').includes(searchTerm.trim()) ||
    Boolean(reg.email?.toLowerCase().includes(q)) ||
    (reg.batchName || '').toLowerCase().includes(q);

  if (studentMatch) return true;

  return linkedGuardians.some((g) => {
    const gName = (g.guardian_name || '').toLowerCase();
    const gId = resolveGuardianDisplayId(g).toLowerCase();
    const gAltId = (g.id || '').toLowerCase();
    const gContact = resolveGuardianContact(g);
    const gRel = resolveGuardianRelation(g).toLowerCase();
    return (
      gName.includes(q) ||
      gId.includes(q) ||
      gAltId.includes(q) ||
      gContact.includes(searchTerm.trim()) ||
      gRel.includes(q)
    );
  });
}
