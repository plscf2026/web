/**
 * Staff Card Generation, Activation & Meal Entitlement Management System Types
 * Police Lines School & College, Faridpur — Grand Reunion 2027
 */

export type StaffCardStatus = 'INACTIVE' | 'ACTIVE' | 'REVOKED';

export type StaffMealType = 'breakfast' | 'lunch' | 'dinner';

export interface StaffCard {
  id: string; // e.g. "STF-0001"
  batchId: string; // e.g. "STF-BATCH-2027-001"
  regNumber: string; // e.g. "PLSCF-STF-2027-0001"
  token: string; // e.g. "STF-9X4M2K-B71"
  qrPayload: string; // JSON QR string
  category: string; // e.g. "Event Staff", "Security", "Catering", "Volunteer"
  status: StaffCardStatus;
  isActivated: boolean;

  // Staff Member Details (Configured upon Super Admin activation)
  staffName?: string | null;
  designation?: string | null;
  mobileNumber?: string | null;
  phone?: string | null;
  department?: string | null;
  notes?: string | null;

  // Meal Entitlements / Facilities Assigned
  mealFacilities: StaffMealType[]; // Subset of ['breakfast', 'lunch', 'dinner']
  mealEntitlements?: StaffMealType[]; // Alias for mealFacilities

  // Activation Audit Trail
  activatedAt?: string | null;
  activatedGate?: string | null;
  activatedByStaffId?: string | null;
  activatedByStaffName?: string | null;

  // Revocation Audit Trail
  revocationReason?: string | null;
  revokedAt?: string | null;
  revokedBy?: string | null;

  generationDate: string;
  createdAt: string;
  updatedAt?: string;
}

export interface StaffBatch {
  id: string; // e.g. "STF-BATCH-2027-001"
  batchName: string;
  batchNumber: number;
  totalCards: number;
  category: string;
  createdBy: string;
  createdAt: string;
}

export interface StaffGateActivation {
  id: string;
  cardId: string;
  token: string;
  gateId: string;
  scannerId?: string;
  operatorId: string;
  operatorName: string;
  activationTime: string;
  status: string;
}

export interface StaffFoodCollection {
  id: string;
  cardId: string;
  token: string;
  mealType: StaffMealType;
  status: 'COLLECTED';
  collectedAt: string;
  staffId: string;
  staffName: string;
  counterId?: string;
  staffMemberName?: string;
}

export interface StaffMealFacilitiesStatus {
  breakfast: 'Available' | 'Collected' | 'Not Assigned';
  lunch: 'Available' | 'Collected' | 'Not Assigned';
  dinner: 'Available' | 'Collected' | 'Not Assigned';
  dress: 'Not Eligible';
  breakfastCollectedAt?: string;
  lunchCollectedAt?: string;
  dinnerCollectedAt?: string;
}

export interface StaffPortalStatistics {
  totalGenerated: number;
  totalCards?: number;
  totalActive: number;
  activeCards?: number;
  totalInactive: number;
  inactiveCards?: number;
  totalRevoked: number;
  revokedCards?: number;
  totalBreakfastEligible: number;
  totalLunchEligible: number;
  totalDinnerEligible: number;
  totalBreakfastCollected: number;
  totalLunchCollected: number;
  totalDinnerCollected: number;
}
