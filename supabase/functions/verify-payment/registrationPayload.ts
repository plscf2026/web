// Strict authoritative registration payload validator & normalizer for pending_orders.form_data.
// Ensures no fabricated placeholder fallbacks (e.g. 'General', 'L', 'Faridpur', placeholder URLs)
// are needed or persisted during online checkout initiation or promotion.

export const ALLOWED_TSHIRT_SIZES = new Set([
  'XS',
  'S',
  'M',
  'L',
  'XL',
  'XXL',
  'XXXL',
  'Oversize 50',
]);

export interface NormalizedRegistrationFormData {
  registrationId: string;
  qrToken: string;
  fullName: string;
  fullNameBn?: string | null;
  mobileNumber: string;
  email: string | null;
  address: string;
  gender: 'male' | 'female' | 'other';
  bloodGroup: string | null;
  photoUrl: string;
  photoStoragePath: string | null;
  category: 'current' | 'former';
  studentId: string | null;
  passingYear: string | null;
  lastClassAttended: string | null;
  currentClass: string | null;
  batchName: string;
  groupOrSection: string | null;
  rollNumber: string | null;
  tShirtSize: string;
  hasParent: boolean;
  parentName: string | null;
  parentAge: string | null;
  parentPhone: string | null;
  parentRelation: string | null;
  parentPhotoUrl: string | null;
  parentPhotoStoragePath: string | null;
  year: number;
}

export interface RegistrationValidationResult {
  valid: boolean;
  error?: string;
  message?: string;
  data?: NormalizedRegistrationFormData;
}

function cleanStr(val: unknown, maxLen = 250): string {
  if (typeof val !== 'string') return '';
  return val.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, maxLen);
}

function isValidImageReference(url: string): boolean {
  if (!url) return false;
  if (url.includes('via.placeholder.com') || url.includes('images.unsplash.com')) return false;
  if (/^https:\/\/[a-z0-9.-]+/i.test(url)) return true;
  if (/^data:image\/(?:jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/i.test(url)) return true;
  return false;
}

function normalizeMobile(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  const normalized = digits.startsWith('880') && digits.length === 13 ? `0${digits.slice(3)}` : digits;
  return normalized;
}

function generateServerQrToken(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

export function validateAndBuildPendingRegistrationData(
  order: Record<string, unknown>,
  category: 'current' | 'former',
  hasParent: boolean
): RegistrationValidationResult {
  const rawForm =
    order.form_data && typeof order.form_data === 'object' && !Array.isArray(order.form_data)
      ? (order.form_data as Record<string, unknown>)
      : order;

  const fullName = cleanStr(rawForm.fullName ?? rawForm.full_name ?? order.cust_name, 120);
  if (fullName.length < 2) {
    return { valid: false, error: 'INVALID_REGISTRATION_DATA', message: 'Valid fullName is required.' };
  }

  const rawMobile = cleanStr(rawForm.mobileNumber ?? rawForm.mobile_number ?? order.cust_phone, 32);
  const mobileNumber = normalizeMobile(rawMobile);
  if (!/^01[3-9][0-9]{8}$/.test(mobileNumber)) {
    return {
      valid: false,
      error: 'INVALID_REGISTRATION_DATA',
      message: 'Valid 11-digit Bangladeshi mobileNumber (01XXXXXXXXX) is required.',
    };
  }

  const address = cleanStr(rawForm.address ?? order.cust_address, 300);
  if (address.length < 2) {
    return { valid: false, error: 'INVALID_REGISTRATION_DATA', message: 'Valid address is required.' };
  }

  const batchName = cleanStr(rawForm.batchName ?? rawForm.batch_name, 80);
  if (!batchName) {
    return { valid: false, error: 'INVALID_REGISTRATION_DATA', message: 'batchName is required.' };
  }

  const tShirtSize = cleanStr(rawForm.tShirtSize ?? rawForm.t_shirt_size, 32);
  if (!ALLOWED_TSHIRT_SIZES.has(tShirtSize)) {
    return {
      valid: false,
      error: 'INVALID_REGISTRATION_DATA',
      message: 'Valid tShirtSize is required.',
    };
  }

  const photoUrl = cleanStr(rawForm.photoUrl ?? rawForm.photo_url, 300000);
  if (!isValidImageReference(photoUrl)) {
    return {
      valid: false,
      error: 'INVALID_REGISTRATION_DATA',
      message: 'Valid student photoUrl (HTTPS or data:image base64) is required.',
    };
  }

  const studentId = cleanStr(rawForm.studentId ?? rawForm.student_id ?? order.student_id, 40).toUpperCase() || null;
  if (category === 'current' && !studentId) {
    return {
      valid: false,
      error: 'INVALID_REGISTRATION_DATA',
      message: 'studentId is required for current student registrations.',
    };
  }

  const parentName = cleanStr(rawForm.parentName ?? rawForm.parent_name, 120) || null;
  const parentPhoneRaw = cleanStr(rawForm.parentPhone ?? rawForm.parent_phone, 32);
  const parentPhone = parentPhoneRaw ? normalizeMobile(parentPhoneRaw) : null;
  const parentRelation = cleanStr(rawForm.parentRelation ?? rawForm.parent_relation, 40) || null;
  const parentAge = cleanStr(rawForm.parentAge ?? rawForm.parent_age, 16) || null;
  const parentPhotoUrl = cleanStr(rawForm.parentPhotoUrl ?? rawForm.parent_photo_url, 300000) || null;

  if (hasParent) {
    if (!parentName || !parentRelation || !parentPhone || !/^01[3-9][0-9]{8}$/.test(parentPhone)) {
      return {
        valid: false,
        error: 'INVALID_REGISTRATION_DATA',
        message: 'parentName, parentRelation, and valid parentPhone are required when hasParent is true.',
      };
    }
    if (parentPhotoUrl && !isValidImageReference(parentPhotoUrl)) {
      return {
        valid: false,
        error: 'INVALID_REGISTRATION_DATA',
        message: 'Invalid parentPhotoUrl format.',
      };
    }
  }

  const rawYear = Number(rawForm.year ?? order.year ?? 2027);
  const year = Number.isInteger(rawYear) && rawYear >= 2020 && rawYear <= 2100 ? rawYear : 2027;

  const requestedRegId = cleanStr(rawForm.registrationId ?? rawForm.registration_id ?? order.registration_id, 40).toUpperCase();
  const registrationId = /^PLSCF-\d{4}-[CF][A-Z0-9]{3,10}$/.test(requestedRegId)
    ? requestedRegId
    : `PLSCF-${year}-${category === 'current' ? 'C' : 'F'}${Math.floor(1000 + Math.random() * 9000)}`;

  const requestedQrToken = cleanStr(rawForm.qrToken ?? rawForm.qr_token ?? order.qr_token, 16).toUpperCase();
  const qrToken = /^[A-Z0-9]{6,12}$/.test(requestedQrToken) ? requestedQrToken : generateServerQrToken();

  const rawGender = cleanStr(rawForm.gender, 16).toLowerCase();
  const gender: 'male' | 'female' | 'other' =
    rawGender === 'female' ? 'female' : rawGender === 'other' ? 'other' : 'male';

  const email = cleanStr(rawForm.email ?? order.cust_email, 160) || null;

  return {
    valid: true,
    data: {
      registrationId,
      qrToken,
      fullName,
      fullNameBn: cleanStr(rawForm.fullNameBn ?? rawForm.full_name_bn, 120) || null,
      mobileNumber,
      email,
      address,
      gender,
      bloodGroup: cleanStr(rawForm.bloodGroup ?? rawForm.blood_group, 12) || null,
      photoUrl,
      photoStoragePath: cleanStr(rawForm.photoStoragePath ?? rawForm.photo_storage_path, 300) || null,
      category,
      studentId,
      passingYear: cleanStr(rawForm.passingYear ?? rawForm.passing_year, 16) || null,
      lastClassAttended: cleanStr(rawForm.lastClassAttended ?? rawForm.last_class_attended, 40) || null,
      currentClass: cleanStr(rawForm.currentClass ?? rawForm.current_class, 40) || null,
      batchName,
      groupOrSection: cleanStr(rawForm.groupOrSection ?? rawForm.group_or_section, 40) || null,
      rollNumber: cleanStr(rawForm.rollNumber ?? rawForm.roll_number, 32) || null,
      tShirtSize,
      hasParent,
      parentName,
      parentAge,
      parentPhone,
      parentRelation,
      parentPhotoUrl,
      parentPhotoStoragePath: cleanStr(rawForm.parentPhotoStoragePath ?? rawForm.parent_photo_storage_path, 300) || null,
      year,
    },
  };
}
