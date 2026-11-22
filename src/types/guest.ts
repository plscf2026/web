/**
 * Dynamic Guest Pass & Food Management System Types
 * Police Lines School & College, Faridpur — Grand Reunion 2027
 */

export type GuestCardStatus = 'INACTIVE' | 'ACTIVE' | 'REVOKED';

export type GuestMealType = 'breakfast' | 'lunch' | 'dinner';

export interface GuestCard {
  id: string; // e.g. "GUEST-0001"
  batchId: string; // e.g. "BATCH-2027-001"
  regNumber: string; // e.g. "PLSCF-GST-2027-0001"
  token: string; // e.g. "GST-7K9M2X-F84"
  qrPayload: string; // JSON QR string
  category: string; // e.g. "Honorary Guest", "VIP Guest", "Special Invite"
  status: GuestCardStatus;
  isActivated: boolean;
  activatedAt?: string | null;
  activatedGate?: string | null;
  activatedByStaffId?: string | null;
  activatedByStaffName?: string | null;
  revocationReason?: string | null;
  revokedAt?: string | null;
  revokedBy?: string | null;
  generationDate: string;
  createdAt: string;
  updatedAt?: string;
}

export interface GuestBatch {
  id: string; // e.g. "BATCH-2027-001"
  batchName: string;
  batchNumber: number;
  totalCards: number;
  category: string;
  createdBy: string;
  createdAt: string;
}

export interface GuestGateActivation {
  id: string;
  guestId: string;
  token: string;
  gateId: string;
  scannerId?: string;
  operatorId: string;
  operatorName: string;
  activationTime: string;
  status: string;
}

export interface GuestFoodCollection {
  id: string;
  guestId: string;
  token: string;
  mealType: GuestMealType;
  status: 'COLLECTED';
  collectedAt: string;
  staffId: string;
  staffName: string;
  counterId?: string;
}

export interface GuestMealFacilities {
  breakfast: 'Available' | 'Collected';
  lunch: 'Available' | 'Collected';
  dinner: 'Available' | 'Collected';
  dress: 'Not Eligible';
  breakfastCollectedAt?: string;
  lunchCollectedAt?: string;
  dinnerCollectedAt?: string;
}

export interface GuestPortalStatistics {
  totalGenerated: number;
  totalActive: number;
  totalInactive: number;
  totalGateEntered: number;
  totalBreakfast: number;
  totalLunch: number;
  totalDinner: number;
  totalRevoked: number;
}
