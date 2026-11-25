import React, { useState, useEffect } from 'react';
import {
  Utensils,
  Coffee,
  Sun,
  Moon,
  Search,
  Camera,
  CheckCircle,
  AlertTriangle,
  AlertOctagon,
  DoorOpen,
  XCircle,
  Clock,
  Shield,
  Edit3,
  QrCode,
  X,
  KeyRound,
  ShieldCheck,
  Crown,
  Ban,
} from 'lucide-react';
import {
  RegistrationRecord,
  FoodDistributionRecord,
  StaffAccount,
  Language,
} from '../types';
import { AppStore } from '../services/store';
import { EventStore, hasDepartmentPermission } from '../services/eventStore';
import { GuestService } from '../services/guestService';
import { GuestCard, GuestMealFacilities } from '../types/guest';
import { StaffCardService } from '../services/staffCardService';
import { StaffCard, StaffMealFacilitiesStatus } from '../types/staffCard';
import { parseScannedInput, getCleanPassDisplayLabel } from '../utils/tokenGenerator';
import { validateMealCollection } from '../utils/eventRules';
import { playScanSuccessSound, playScanErrorSound } from '../utils/audioAlert';
import { QrCameraScanner } from './common/QrCameraScanner';
import { GlobalPagination } from './common/GlobalPagination';
import { paginate } from '../utils/pagination';
import { DEFAULT_STUDENT_AVATAR_PLACEHOLDER } from '../services/studentPhotoStorageService';
import { MealControlService, EVENT_MEAL_CONTROL_SYNC } from '../services/mealControlService';
import { MealTimeScannerControlPanel } from './admin/MealTimeScannerControlPanel';

interface FoodScannerModuleProps {
  language: Language;
  staffUser: StaffAccount;
  defaultMealType?: 'breakfast' | 'lunch' | 'dinner';
  isSuperAdmin?: boolean;
}

export const FoodScannerModule: React.FC<FoodScannerModuleProps> = ({
  language,
  staffUser,
  defaultMealType = 'breakfast',
  isSuperAdmin = false,
}) => {
  const [mealType, setMealType] = useState<'breakfast' | 'lunch' | 'dinner'>(() => {
    if (staffUser.role === 'BREAKFAST_STAFF') return 'breakfast';
    if (staffUser.role === 'LUNCH_STAFF') return 'lunch';
    if (staffUser.role === 'DINNER_STAFF') return 'dinner';
    return defaultMealType;
  });

  const [scanInput, setScanInput] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [scannedStudent, setScannedStudent] = useState<RegistrationRecord | null>(null);
  const [scannedGuest, setScannedGuest] = useState<GuestCard | null>(null);
  const [guestFacilities, setGuestFacilities] = useState<GuestMealFacilities | null>(null);
  const [guestNotice, setGuestNotice] = useState<{
    type: 'success' | 'error' | 'warning';
    message: string;
    messageBn?: string;
  } | null>(null);
  const [scannedStaff, setScannedStaff] = useState<StaffCard | null>(null);
  const [staffFacilities, setStaffFacilities] = useState<StaffMealFacilitiesStatus | null>(null);
  const [staffNotice, setStaffNotice] = useState<{
    type: 'success' | 'error' | 'warning';
    message: string;
    messageBn?: string;
  } | null>(null);
  const [validationResult, setValidationResult] = useState<any | null>(null);
  const [distributions, setDistributions] = useState<FoodDistributionRecord[]>(() =>
    EventStore.getFoodDistributions()
  );
  const [cameraActive, setCameraActive] = useState(false);

  // Global Pagination State (Default 10, options 10, 20, 30, 40)
  const [logPage, setLogPage] = useState(1);
  const [logPageSize, setLogPageSize] = useState(10);

  // Meal Time & Scanner Control System state
  const [isMealControlOpen, setIsMealControlOpen] = useState(false);
  const [_mealControlTick, setMealControlTick] = useState(0);

  // Re-evaluate whenever sync happens
  useEffect(() => {
    const onControlSync = () => setMealControlTick((t) => t + 1);
    window.addEventListener(EVENT_MEAL_CONTROL_SYNC, onControlSync);
    const cleanupRealtime = MealControlService.initRealtimeSync();
    return () => {
      window.removeEventListener(EVENT_MEAL_CONTROL_SYNC, onControlSync);
      cleanupRealtime();
    };
  }, []);

  const currentMealStatus = MealControlService.evaluateMealStatus(mealType);

  // Reset page when mealType changes
  React.useEffect(() => {
    setLogPage(1);
  }, [mealType]);
  const [feedbackNotice, setFeedbackNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isResultPopupOpen, setIsResultPopupOpen] = useState(false);
  const [isProcessingScan, setIsProcessingScan] = useState(false);

  // Correction modal state for Super Admin
  const [selectedRecordForCorrection, setSelectedRecordForCorrection] = useState<FoodDistributionRecord | null>(null);
  const [correctionReason, setCorrectionReason] = useState('');
  const [newCorrectionStatus, setNewCorrectionStatus] = useState<'COLLECTED' | 'CANCELLED'>('CANCELLED');

  const refreshDistributions = () => {
    setDistributions(EventStore.getFoodDistributions());
  };

  useEffect(() => {
    EventStore.initRealtimeSync();
    EventStore.syncDistributionsWithSupabase().then(refreshDistributions);
    GuestService.syncWithSupabase();

    const onSync = () => refreshDistributions();
    window.addEventListener('plscf_food_sync', onSync);
    window.addEventListener('plscf_all_stations_synced', onSync);
    window.addEventListener('plscf_guest_sync', onSync);
    return () => {
      window.removeEventListener('plscf_food_sync', onSync);
      window.removeEventListener('plscf_all_stations_synced', onSync);
      window.removeEventListener('plscf_guest_sync', onSync);
    };
  }, []);

  // Handle QR Camera scan or manual Registration ID + QR Token verification
  const handleProcessScan = async (codeToSearch: string, tokenParam?: string) => {
    if (!codeToSearch.trim() || isProcessingScan) return;
    setIsProcessingScan(true);
    refreshDistributions();

    try {

    const clean = codeToSearch.trim();
    const parsed = parseScannedInput(clean);
    const displayTicket = parsed.id || clean;
    const expectedToken = tokenParam?.trim().toUpperCase() || parsed.token;

    // =========================================================================
    // 0. GUEST PASS VERIFICATION & FOOD WORKFLOW (Requirement 4)
    // =========================================================================
    const isGuestCode =
      parsed.isGuestPass ||
      clean.toUpperCase().startsWith('GUEST-') ||
      clean.toUpperCase().startsWith('PLSCF-GST-') ||
      clean.toUpperCase().startsWith('GST-') ||
      clean.toUpperCase().includes('"TYPE":"GUEST"');

    if (isGuestCode) {
      setScannedStudent(null);
      setValidationResult(null);

      const cleanLabel = getCleanPassDisplayLabel(clean, parsed);
      const guest = await GuestService.findGuestByCode(clean, expectedToken);
      if (!guest) {
        playScanErrorSound();
        setScannedGuest(null);
        setGuestFacilities(null);
        setValidationResult({
          canCollect: false,
          status: 'INVALID_REGISTRATION',
          messageEn: `Guest Pass "${cleanLabel}" not found in system database.`,
          messageBn: `গেস্ট পাস "${cleanLabel}" সিস্টেমে পাওয়া যায়নি।`,
        });
        setGuestNotice({
          type: 'error',
          message: `Guest Pass "${cleanLabel}" not found in system database.`,
          messageBn: `গেস্ট পাস "${cleanLabel}" সিস্টেমে পাওয়া যায়নি।`,
        });
        setIsResultPopupOpen(true);
        return;
      }

      // Check Meal Time & Scanner Control System for Guest (Requirement 4)
      const guestTimeControl = MealControlService.evaluateMealStatus(mealType);
      if (!guestTimeControl.isOpen) {
        playScanErrorSound();
        setScannedGuest(guest);
        const facilities = GuestService.getMealFacilities(guest.id);
        setGuestFacilities(facilities);
        setGuestNotice({
          type: 'error',
          message: `Time Out: ${guestTimeControl.reasonEn}`,
          messageBn: `Time Out (সময় শেষ): ${guestTimeControl.reasonBn}`,
        });
        setIsResultPopupOpen(true);
        return;
      }

      if (guest.status === 'REVOKED') {
        playScanErrorSound();
        setScannedGuest(guest);
        setGuestFacilities(null);
        setGuestNotice({
          type: 'error',
          message: `REVOKED GUEST CARD: This card was revoked by administration (${guest.revocationReason || 'Security Revocation'}). Food collection denied.`,
          messageBn: 'বাতিলকৃত গেস্ট কার্ড: প্রশাসন কর্তৃক এই কার্ডটি বাতিল করা হয়েছে। খাবার বিতরণ নিষিদ্ধ।',
        });
        setIsResultPopupOpen(true);
        return;
      }

      if (guest.status === 'INACTIVE' || !guest.isActivated) {
        playScanErrorSound();
        setScannedGuest(guest);
        setGuestFacilities(null);
        setGuestNotice({
          type: 'error',
          message: 'INACTIVE GUEST CARD: Please activate card at Main Gate first before collecting food.',
          messageBn: 'নিষ্ক্রিয় গেস্ট কার্ড: খাবার গ্রহণের পূর্বে অনুগ্রহ করে প্রধান গেটে কার্ডটি সক্রিয় করান।',
        });
        setIsResultPopupOpen(true);
        return;
      }

      // Guest card is ACTIVE! Query independent meal facilities
      const facilities = await GuestService.getMealFacilities(guest.id);
      setScannedGuest(guest);
      setGuestFacilities(facilities);

      const isAlreadyCollected = facilities[mealType] === 'Collected';

      if (isAlreadyCollected) {
        playScanErrorSound();
        setGuestNotice({
          type: 'warning',
          message: `ALREADY COLLECTED: Guest ${guest.id} has already collected ${mealType.toUpperCase()}.`,
          messageBn: `ইতিমধ্যেই সংগৃহীত: গেস্ট ${guest.id} ইতিপূর্বে ${mealType === 'breakfast' ? 'সকালের নাস্তা' : mealType === 'lunch' ? 'দুপুরের খাবার' : 'রাতের খাবার'} গ্রহণ করেছেন।`,
        });
      } else {
        playScanSuccessSound();
        setGuestNotice({
          type: 'success',
          message: `ELIGIBLE: Guest card active. Ready to collect ${mealType.toUpperCase()}.`,
          messageBn: `যোগ্য: গেস্ট কার্ড সক্রিয় ও বৈধ। ${mealType === 'breakfast' ? 'সকালের নাস্তা' : mealType === 'lunch' ? 'দুপুরের খাবার' : 'রাতের খাবার'} বিতরণের জন্য প্রস্তুত।`,
        });
      }

      setIsResultPopupOpen(true);
      return;
    }

    // =========================================================================
    // 0.5. STAFF CARD VERIFICATION & FOOD WORKFLOW
    // =========================================================================
    const isStaffCode =
      parsed.type === 'STAFF' ||
      clean.toUpperCase().startsWith('STF-') ||
      clean.toUpperCase().startsWith('PLSCF-STF-') ||
      clean.includes('"type":"STAFF"');

    const knownStaff = isStaffCode ? true : await StaffCardService.findStaffCardByCode(clean, expectedToken);

    if (isStaffCode || knownStaff) {
      setScannedStudent(null);
      setScannedGuest(null);
      setValidationResult(null);

      const cleanLabel = getCleanPassDisplayLabel(clean, parsed);
      const staffCard = await StaffCardService.findStaffCardByCode(clean, expectedToken);

      if (!staffCard) {
        playScanErrorSound();
        setScannedStaff(null);
        setStaffFacilities(null);
        setValidationResult({
          canCollect: false,
          status: 'INVALID_REGISTRATION',
          messageEn: `Staff Card "${cleanLabel}" not found in system database.`,
          messageBn: `স্টাফ কার্ড "${cleanLabel}" সিস্টেমে পাওয়া যায়নি।`,
        });
        setStaffNotice({
          type: 'error',
          message: `Staff Card "${cleanLabel}" not found in system database.`,
          messageBn: `স্টাফ কার্ড "${cleanLabel}" সিস্টেমে পাওয়া যায়নি।`,
        });
        setIsResultPopupOpen(true);
        return;
      }

      // Check Meal Time & Scanner Control System for Staff
      const staffTimeControl = MealControlService.evaluateMealStatus(mealType);
      if (!staffTimeControl.isOpen) {
        playScanErrorSound();
        setScannedStaff(staffCard);
        const facilities = await StaffCardService.getStaffMealFacilities(staffCard.id);
        setStaffFacilities(facilities);
        setStaffNotice({
          type: 'error',
          message: 'Time Out',
          messageBn: `Time Out (সময় শেষ): ${staffTimeControl.reasonBn}`,
        });
        setIsResultPopupOpen(true);
        return;
      }

      if (staffCard.status === 'REVOKED') {
        playScanErrorSound();
        setScannedStaff(staffCard);
        setStaffFacilities(null);
        setStaffNotice({
          type: 'error',
          message: `REVOKED STAFF CARD: This card was revoked by administration (${staffCard.revocationReason || 'Security Revocation'}). Food collection denied.`,
          messageBn: 'বাতিলকৃত স্টাফ কার্ড: প্রশাসন কর্তৃক এই কার্ডটি বাতিল করা হয়েছে। খাবার বিতরণ নিষিদ্ধ।',
        });
        setIsResultPopupOpen(true);
        return;
      }

      if (staffCard.status === 'INACTIVE' || !staffCard.isActivated) {
        playScanErrorSound();
        setScannedStaff(staffCard);
        setStaffFacilities(null);
        setStaffNotice({
          type: 'error',
          message: 'Card Not Activated',
          messageBn: 'Card Not Activated: কার্ডটি এখনও সক্রিয় করা হয়নি।',
        });
        setIsResultPopupOpen(true);
        return;
      }

      // Check if Card has Required Meal Entitlement
      const hasMeal = staffCard.mealEntitlements && staffCard.mealEntitlements.includes(mealType);
      if (!hasMeal) {
        playScanErrorSound();
        setScannedStaff(staffCard);
        const facilities = await StaffCardService.getStaffMealFacilities(staffCard.id);
        setStaffFacilities(facilities);
        setStaffNotice({
          type: 'error',
          message: 'Meal Not Assigned',
          messageBn: 'Meal Not Assigned: এই খাবারের সুবিধা কার্ডটিতে বরাদ্দ নেই।',
        });
        setIsResultPopupOpen(true);
        return;
      }

      // Staff card is ACTIVE and authorized! Query meal facilities
      const facilities = await StaffCardService.getStaffMealFacilities(staffCard.id);
      setScannedStaff(staffCard);
      setStaffFacilities(facilities);

      const isAlreadyCollected = facilities[mealType] === 'Collected';

      if (isAlreadyCollected) {
        playScanErrorSound();
        setStaffNotice({
          type: 'warning',
          message: `ALREADY COLLECTED: Staff member ${staffCard.staffName || staffCard.id} has already collected ${mealType.toUpperCase()}.`,
          messageBn: `ALREADY COLLECTED: স্টাফ সদস্য ${staffCard.staffName || staffCard.id} ইতিপূর্বে ${mealType === 'breakfast' ? 'সকালের নাস্তা' : mealType === 'lunch' ? 'দুপুরের খাবার' : 'রাতের খাবার'} গ্রহণ করেছেন।`,
        });
      } else {
        playScanSuccessSound();
        setStaffNotice({
          type: 'success',
          message: `ELIGIBLE: Staff card active & entitled. Ready to collect ${mealType.toUpperCase()}.`,
          messageBn: `যোগ্য: স্টাফ কার্ড সক্রিয় ও খাবার অনুমোদিত। ${mealType === 'breakfast' ? 'সকালের নাস্তা' : mealType === 'lunch' ? 'দুপুরের খাবার' : 'রাতের খাবার'} বিতরণের জন্য প্রস্তুত।`,
        });
      }

      setIsResultPopupOpen(true);
      return;
    }

    // Reset guest & staff state when processing a regular student
    setScannedGuest(null);
    setGuestFacilities(null);
    setGuestNotice(null);
    setScannedStaff(null);
    setStaffFacilities(null);
    setStaffNotice(null);

    const verifyRes = await AppStore.verifyStudentTicketAsync(clean, expectedToken, staffUser?.id || 'FOOD_STAFF');

    if (!verifyRes.verified || !verifyRes.student) {
      playScanErrorSound();
      setScannedStudent(null);
      if (verifyRes.errorType === 'NETWORK_ERROR') {
        setValidationResult({
          canCollect: false,
          status: 'NETWORK_ERROR' as any,
          messageEn: 'Network Connection Error: Unable to reach verification server. Please check your internet connection.',
          messageBn: 'নেটওয়ার্ক সংযোগ ত্রুটি: সার্ভারের সাথে যোগাযোগ করা যায়নি। ইন্টারনেট সংযোগ পরীক্ষা করুন।',
        });
        setFeedbackNotice({
          type: 'error',
          message: 'Network Connection Error: Unable to reach verification server. Please check your internet connection.',
        });
      } else if (verifyRes.errorType === 'UNPAID') {
        setValidationResult({
          canCollect: false,
          status: 'INVALID_REGISTRATION',
          messageEn: verifyRes.error || `Payment Pending: Student registration is not paid. Food coupon is not eligible.`,
          messageBn: 'পেমেন্ট মুলতুবি: নিবন্ধন ফি পরিশোধ করা হয়নি। খাবার কুপন প্রযোজ্য নয়।',
        });
        setFeedbackNotice({
          type: 'error',
          message: verifyRes.error || `Payment Pending: Student registration is not paid. Food coupon is not eligible.`,
        });
      } else if (verifyRes.errorType === 'TOKEN_MISMATCH') {
        setValidationResult({
          canCollect: false,
          status: 'INVALID_REGISTRATION',
          messageEn: verifyRes.error || `QR Token "${expectedToken}" does not match Registration ID "${clean}".`,
          messageBn: `কিউআর টোকেন "${expectedToken}" রেজিস্ট্রেশনের সাথে মেলেনি।`,
        });
        setFeedbackNotice({
          type: 'error',
          message: verifyRes.error || `Security Warning: Cryptographic QR token mismatch. Pass is invalid.`,
        });
      } else {
        setValidationResult({
          canCollect: false,
          status: 'INVALID_REGISTRATION',
          messageEn: `Student ticket "${displayTicket}" not found.`,
          messageBn: `"${displayTicket}" নম্বরের কোনো টিকিট পাওয়া যায়নি।`,
        });
        setFeedbackNotice({
          type: 'error',
          message: verifyRes.error || `Student ticket "${displayTicket}" not found in database.`,
        });
      }
      setIsResultPopupOpen(true);
      return;
    }

    const student = verifyRes.student;
    const gateStatus = EventStore.getStudentGateStatus(student.id);
    const isInside = gateStatus === 'ENTRY';

    // 1. Meal Time & Scanner Control System check (Requirement 4: Time Out)
    const mealControl = MealControlService.evaluateMealStatus(mealType);
    if (!mealControl.isOpen) {
      playScanErrorSound();
      setScannedStudent(student);
      setValidationResult({
        canCollect: false,
        status: 'TIMEOUT',
        messageEn: mealControl.reasonEn,
        messageBn: mealControl.reasonBn,
      });
      setFeedbackNotice({
        type: 'error',
        message: mealControl.reasonEn,
      });
      setIsResultPopupOpen(true);
      return;
    }

    const currentDistributions = EventStore.getFoodDistributions();
    const result = validateMealCollection(student, mealType, currentDistributions, new Date(), gateStatus, { checkMealSchedule: true });

    if (!isInside) {
      playScanErrorSound();
      setScannedStudent(student);
      setValidationResult(result);
      setFeedbackNotice({
        type: 'error',
        message:
          gateStatus === 'BACK'
            ? 'Student has exited the event. Food collection is not allowed. Please ask the student to enter through the gate first.'
            : 'Student has not entered the event. Please complete gate entry first.',
      });
      setIsResultPopupOpen(true);
      return;
    }

    if (result.canCollect) {
      playScanSuccessSound();
    } else {
      playScanErrorSound();
    }

    setScannedStudent(student);
    setValidationResult(result);
    setFeedbackNotice(null);
    setIsResultPopupOpen(true);
    } finally {
      setIsProcessingScan(false);
    }
  };

  // Confirm Received Handler
  const handleConfirmReceived = () => {
    if (!scannedStudent || !validationResult?.canCollect) return;

    // Gate Entry check: Student must currently have ENTRY status
    const gateStatus = EventStore.getStudentGateStatus(scannedStudent.id);
    if (gateStatus !== 'ENTRY') {
      playScanErrorSound();
      setFeedbackNotice({
        type: 'error',
        message:
          gateStatus === 'BACK'
            ? 'Student has exited the event. Food collection is not allowed. Please ask the student to enter through the gate first.'
            : 'Student has not entered the event. Please complete gate entry first.',
      });
      return;
    }

    // Check Department RBAC permission
    const targetDept = mealType.toUpperCase() as any;
    if (!hasDepartmentPermission(staffUser, targetDept, 'APPROVE')) {
      playScanErrorSound();
      setFeedbackNotice({
        type: 'error',
        message: `PERMISSION_DENIED: Your staff account is not authorized to approve ${mealType.toUpperCase()} distribution.`,
      });
      return;
    }

    // Meal Time & Scanner Control System check (Asia/Dhaka)
    const mealControl = MealControlService.evaluateMealStatus(mealType);
    if (!mealControl.isOpen) {
      playScanErrorSound();
      setFeedbackNotice({
        type: 'error',
        message: mealControl.reasonEn,
      });
      return;
    }

    const res = EventStore.confirmFoodDistribution(
      scannedStudent.id,
      scannedStudent.fullName,
      scannedStudent.batchName,
      mealType,
      staffUser.id,
      staffUser.fullName,
      undefined,
      staffUser,
      { checkSchedule: true }
    );

    if (res.success && res.record) {
      playScanSuccessSound();
      refreshDistributions();
      EventStore.broadcastStationEvent('plscf_food_sync', res.record);
      setFeedbackNotice({
        type: 'success',
        message: `${mealType.toUpperCase()} marked as COLLECTED for ${scannedStudent.fullName}.`,
      });
      // Revalidate to show updated state
      const currentDistributions = EventStore.getFoodDistributions();
      const updatedValidation = validateMealCollection(scannedStudent, mealType, currentDistributions);
      setValidationResult(updatedValidation);

      // Auto-dismiss after success so staff can scan next student
      setTimeout(() => {
        setIsResultPopupOpen(false);
        setScannedStudent(null);
        setFeedbackNotice(null);
      }, 1600);
    } else {
      setFeedbackNotice({
        type: 'error',
        message: res.error || 'Failed to record meal collection.',
      });
    }
  };

  // Guest Meal Collection Handler (Requirement 4)
  const handleConfirmGuestFoodCollection = async () => {
    if (!scannedGuest || !guestFacilities) return;

    const isAlready = guestFacilities[mealType] === 'Collected';

    if (isAlready) {
      playScanErrorSound();
      setGuestNotice({
        type: 'error',
        message: `ALREADY COLLECTED: Guest has already collected ${mealType.toUpperCase()}.`,
      });
      return;
    }

    // Meal Time & Scanner Control System check (Asia/Dhaka)
    const mealControl = MealControlService.evaluateMealStatus(mealType);
    if (!mealControl.isOpen) {
      playScanErrorSound();
      setGuestNotice({
        type: 'error',
        message: mealControl.reasonEn,
      });
      return;
    }

    const res = await GuestService.collectMeal(
      scannedGuest.id,
      mealType,
      scannedGuest.token,
      staffUser.id,
      staffUser.fullName,
      staffUser.assignedGate || 'Food Counter',
      { checkSchedule: true }
    );

    if (res.success && res.record) {
      playScanSuccessSound();
      const updatedFacilities = await GuestService.getMealFacilities(scannedGuest.id);
      setGuestFacilities(updatedFacilities);
      setGuestNotice({
        type: 'success',
        message: `[COLLECTION RECORDED] ${mealType.toUpperCase()} marked as COLLECTED for Guest ${scannedGuest.id} (${scannedGuest.category}).`,
        messageBn: `[সফল] গেস্ট ${scannedGuest.id}-এর ${mealType === 'breakfast' ? 'সকালের নাস্তা' : mealType === 'lunch' ? 'দুপুরের খাবার' : 'রাতের খাবার'} সফলভাবে সম্পন্ন হয়েছে।`,
      });

      // Auto-dismiss after success so staff can scan next pass
      setTimeout(() => {
        setIsResultPopupOpen(false);
        setScannedGuest(null);
        setGuestFacilities(null);
        setGuestNotice(null);
      }, 1800);
    } else {
      playScanErrorSound();
      setGuestNotice({
        type: 'error',
        message: res.error || 'Failed to record meal collection.',
      });
    }
  };

  // Staff Meal Collection Handler
  const handleConfirmStaffFoodCollection = async () => {
    if (!scannedStaff || !staffFacilities) return;

    const isAlready = staffFacilities[mealType] === 'Collected';

    if (isAlready) {
      playScanErrorSound();
      setStaffNotice({
        type: 'error',
        message: `ALREADY COLLECTED: Staff member has already collected ${mealType.toUpperCase()}.`,
      });
      return;
    }

    // Meal Time & Scanner Control System check (Asia/Dhaka)
    const mealControl = MealControlService.evaluateMealStatus(mealType);
    if (!mealControl.isOpen) {
      playScanErrorSound();
      setStaffNotice({
        type: 'error',
        message: 'Time Out',
      });
      return;
    }

    // Entitlement check
    if (!scannedStaff.mealEntitlements?.includes(mealType)) {
      playScanErrorSound();
      setStaffNotice({
        type: 'error',
        message: 'Meal Not Assigned',
      });
      return;
    }

    const res = await StaffCardService.collectStaffMeal(
      scannedStaff.id,
      mealType,
      scannedStaff.token,
      staffUser.id,
      staffUser.fullName,
      staffUser.assignedGate || 'Food Counter',
      { checkSchedule: true }
    );

    if (res.success && res.record) {
      playScanSuccessSound();
      const updatedFacilities = await StaffCardService.getStaffMealFacilities(scannedStaff.id);
      setStaffFacilities(updatedFacilities);
      setStaffNotice({
        type: 'success',
        message: `[COLLECTION RECORDED] ${mealType.toUpperCase()} marked as COLLECTED for Staff ${scannedStaff.staffName || scannedStaff.id}.`,
        messageBn: `[সফল] স্টাফ ${scannedStaff.staffName || scannedStaff.id}-এর ${mealType === 'breakfast' ? 'সকালের নাস্তা' : mealType === 'lunch' ? 'দুপুরের খাবার' : 'রাতের খাবার'} সফলভাবে সম্পন্ন হয়েছে।`,
      });

      // Auto-dismiss after success so staff can scan next pass
      setTimeout(() => {
        setIsResultPopupOpen(false);
        setScannedStaff(null);
        setStaffFacilities(null);
        setStaffNotice(null);
      }, 1800);
    } else {
      playScanErrorSound();
      setStaffNotice({
        type: 'error',
        message: res.error || 'Failed to record meal collection.',
      });
    }
  };

  // Super Admin Correction Execution
  const handleSaveAdminCorrection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecordForCorrection || !correctionReason.trim()) return;

    EventStore.adminCorrectFoodDistribution(
      selectedRecordForCorrection.id,
      newCorrectionStatus,
      correctionReason.trim(),
      staffUser.id,
      staffUser.fullName
    );

    refreshDistributions();
    setSelectedRecordForCorrection(null);
    setCorrectionReason('');
    setFeedbackNotice({
      type: 'success',
      message: 'Meal record corrected and recorded in administrative audit history.',
    });
    setTimeout(() => setFeedbackNotice(null), 4000);
  };

  // Meal KPI counts
  const currentMealCount = distributions.filter(
    (d) => d.mealType === mealType && d.status === 'COLLECTED'
  ).length;

  const mealIcons = {
    breakfast: Coffee,
    lunch: Sun,
    dinner: Moon,
  };
  const MealIcon = mealIcons[mealType];

  return (
    <div className="space-y-6">
      {/* Module Header Bar */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow-xs">
              <MealIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight capitalize">
                {mealType} Distribution Scanner
              </h2>
              <p className="text-xs text-slate-500">
                Staff Incharge: <span className="font-semibold text-slate-800">{staffUser.fullName}</span> ({staffUser.role})
              </p>
            </div>
          </div>
        </div>

        {/* Meal Type Switcher (Accessible if Super Admin) */}
        {isSuperAdmin && (
          <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200 text-xs font-bold">
            {(['breakfast', 'lunch', 'dinner'] as const).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMealType(m);
                  setScannedStudent(null);
                  setValidationResult(null);
                }}
                className={`px-3.5 py-1.5 rounded-xl capitalize transition-all cursor-pointer ${
                  mealType === m
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        )}

        {/* Real-time Distributed Counter */}
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 px-4 py-2.5 rounded-2xl">
          <Utensils className="w-4 h-4 text-amber-700" />
          <div>
            <span className="text-[10px] font-bold text-amber-800 uppercase block tracking-wider">
              Total {mealType} Served
            </span>
            <span className="text-lg font-black text-amber-950 font-mono">
              {currentMealCount} <span className="text-xs font-normal text-amber-700">students</span>
            </span>
          </div>
        </div>
      </div>

      {/* Live Meal Scanner Time & Status Strip */}
      <div
        className={`p-4 rounded-3xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs transition-all ${
          currentMealStatus.isOpen
            ? 'bg-gradient-to-r from-emerald-50/80 via-white to-emerald-50/40 border-emerald-300 text-emerald-950'
            : 'bg-gradient-to-r from-rose-50/90 via-white to-rose-50/50 border-rose-300 text-rose-950'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-3.5 h-3.5 rounded-full shrink-0 ${
              currentMealStatus.isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
            }`}
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider">
                {currentMealStatus.isOpen ? '● SCANNER ACTIVE' : '● SCANNER TIME OUT'}
              </span>
              <span
                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border ${
                  currentMealStatus.isOpen
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : 'bg-rose-100 text-rose-800 border-rose-300'
                }`}
              >
                Mode: {currentMealStatus.mode}
              </span>
              <span className="text-[10px] font-mono text-slate-500 hidden sm:inline">
                {currentMealStatus.timeString12} BST
              </span>
            </div>
            <p className="text-xs font-semibold mt-0.5">
              {language === 'bn' ? currentMealStatus.reasonBn : currentMealStatus.reasonEn}
            </p>
          </div>
        </div>

        {/* Super Admin Control Toggle */}
        {(isSuperAdmin || staffUser.role === 'SUPER_ADMIN') && (
          <button
            type="button"
            onClick={() => setIsMealControlOpen(!isMealControlOpen)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shrink-0 transition-all cursor-pointer shadow-xs"
          >
            <Clock className="w-3.5 h-3.5 text-sky-400" />
            <span>
              {isMealControlOpen
                ? (language === 'bn' ? 'কন্ট্রোল প্যানেল লুকান' : 'Hide Control Panel')
                : (language === 'bn' ? 'সময়সূচী ও স্ক্যানার নিয়ন্ত্রণ' : 'Meal Time & Scanner Controls')}
            </span>
          </button>
        )}
      </div>

      {/* Expandable Super Admin Meal Time & Scanner Control Panel */}
      {(isSuperAdmin || staffUser.role === 'SUPER_ADMIN') && isMealControlOpen && (
        <div className="animate-fade-in">
          <MealTimeScannerControlPanel
            language={language}
            adminName={staffUser.fullName}
          />
        </div>
      )}

      {/* Main Scanner & Verification Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: QR Code Scan & Search */}
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <QrCode className="w-4 h-4 text-amber-600" />
                <span>Food QR Scanner Desk</span>
              </h3>

              <div className="flex items-center gap-2">
                {/* OPTION 1: OPEN CAMERA */}
                <button
                  type="button"
                  onClick={() => setCameraActive(!cameraActive)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs ${
                    cameraActive
                      ? 'bg-rose-100 text-rose-700 border border-rose-300'
                      : 'bg-slate-900 text-white hover:bg-slate-800'
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>{cameraActive ? 'Stop Camera' : 'Open Camera'}</span>
                </button>
              </div>
            </div>

            {/* OPTION 1: Square QR Code Camera Viewfinder */}
            {cameraActive && (
              <QrCameraScanner
                onScan={handleProcessScan}
                onClose={() => setCameraActive(false)}
                language={language}
                themeColor="amber"
                title={language === 'bn' ? 'খাবার বিতরণ কিউআর ক্যামেরা' : 'Food QR Camera Scanner'}
                paused={isResultPopupOpen || isProcessingScan}
              />
            )}

            {/* OPTION 2: REGISTRATION ID + QR TOKEN (Server-Verified Manual Entry) */}
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                  <span>Manual Verification (ID + Token)</span>
                </span>
                <span className="text-[10px] text-slate-500 font-medium">
                  Enter both credentials
                </span>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleProcessScan(scanInput, tokenInput);
                }}
                className="space-y-3"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Registration ID *
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={scanInput}
                        onChange={(e) => setScanInput(e.target.value)}
                        placeholder="e.g. PLSCF-2027-F8472"
                        required
                        className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-slate-300 text-xs font-mono uppercase tracking-wider focus:border-amber-500 focus:outline-hidden"
                      />
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      QR Token *
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={tokenInput}
                        onChange={(e) => setTokenInput(e.target.value)}
                        placeholder="e.g. FJJG4G"
                        maxLength={10}
                        required
                        className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-slate-300 text-xs font-mono uppercase tracking-wider focus:border-amber-500 focus:outline-hidden"
                      />
                      <KeyRound className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3" />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all cursor-pointer shadow-xs flex items-center justify-center gap-2"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                  <span>Verify Registration ID + QR Token</span>
                </button>
              </form>
            </div>

            {/* Quick Demo Student Buttons for testing without camera */}
            <div className="pt-2 border-t border-slate-100">
              <span className="text-[11px] font-bold text-slate-500 block mb-2">
                Quick Test Student Tickets:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'PLSCF-2026-F1001', token: 'A7K9M2' },
                  { id: 'PLSCF-2026-F1002', token: 'R8W3N5' },
                  { id: 'PLSCF-2026-C2001', token: 'C3P7X9' },
                ].map((demo) => (
                  <button
                    key={demo.id}
                    type="button"
                    onClick={() => {
                      setScanInput(demo.id);
                      setTokenInput(demo.token);
                      handleProcessScan(demo.id, demo.token);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-amber-100 hover:text-amber-900 text-slate-700 text-[11px] font-mono font-bold transition-colors cursor-pointer border border-slate-200"
                  >
                    {demo.id}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Student / Guest Verification Card & Confirmation */}
        <div className="lg:col-span-7">
          {feedbackNotice && (
            <div
              className={`p-4 rounded-2xl mb-4 text-xs font-bold flex items-center gap-2.5 ${
                feedbackNotice.type === 'success'
                  ? 'bg-emerald-50 border border-emerald-300 text-emerald-900'
                  : 'bg-rose-50 border border-rose-300 text-rose-900'
              }`}
            >
              {feedbackNotice.type === 'success' ? (
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{feedbackNotice.message}</span>
            </div>
          )}

          {guestNotice && (
            <div
              className={`p-4 rounded-2xl mb-4 text-xs font-bold flex items-center gap-2.5 ${
                guestNotice.type === 'success'
                  ? 'bg-emerald-50 border border-emerald-300 text-emerald-900'
                  : guestNotice.type === 'warning'
                  ? 'bg-amber-50 border border-amber-300 text-amber-900'
                  : 'bg-rose-50 border border-rose-300 text-rose-900'
              }`}
            >
              {guestNotice.type === 'success' ? (
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : guestNotice.type === 'warning' ? (
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <div>
                <p>{guestNotice.message}</p>
                {guestNotice.messageBn && (
                  <p className="text-[11px] font-normal opacity-90 mt-0.5">{guestNotice.messageBn}</p>
                )}
              </div>
            </div>
          )}

          {scannedGuest ? (
            /* GUEST PASS FOOD VERIFICATION CARD (INLINE) */
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-amber-200/80 shadow-md space-y-6">
              {/* Guest Header */}
              <div className="flex items-start gap-4 pb-6 border-b border-amber-100">
                <div className="w-20 h-24 rounded-2xl bg-gradient-to-br from-amber-500 via-amber-600 to-orange-700 flex flex-col items-center justify-center text-white shadow-md border-2 border-amber-300 shrink-0">
                  <Crown className="w-8 h-8 text-amber-200 mb-1" />
                  <span className="text-[9px] font-black uppercase tracking-wider">Guest Pass</span>
                </div>

                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500 text-slate-950">
                      {scannedGuest.category}
                    </span>
                    <span className="font-mono text-xs font-black text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded">
                      {scannedGuest.id}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        scannedGuest.status === 'ACTIVE'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : scannedGuest.status === 'INACTIVE'
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : 'bg-rose-100 text-rose-800 border border-rose-300'
                      }`}
                    >
                      {scannedGuest.status}
                    </span>
                  </div>

                  <h3 className="text-xl font-black text-slate-900 truncate">
                    {scannedGuest.regNumber}
                  </h3>

                  <div className="pt-1 flex items-center gap-2 text-xs">
                    <span className="font-bold text-slate-500">TOKEN:</span>
                    <span className="font-mono font-black tracking-widest text-amber-900 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                      {scannedGuest.token}
                    </span>
                  </div>
                </div>
              </div>

              {/* Gate Activation Info */}
              <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/60 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="font-bold text-slate-500">Gate Activation:</span>
                  <span className="font-bold text-slate-800">
                    {scannedGuest.activatedGate || 'Main Gate 01'} (
                    {scannedGuest.activatedAt ? new Date(scannedGuest.activatedAt).toLocaleTimeString() : 'Verified'}
                    )
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-slate-500">Activated By:</span>
                  <span className="font-medium text-slate-700">{scannedGuest.activatedByStaffName || 'Gate Operator'}</span>
                </div>
              </div>

              {/* Food Facilities Matrix */}
              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                  Guest Meal Facilities Status
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                  <div
                    className={`p-3 rounded-2xl border ${
                      guestFacilities?.breakfast === 'Collected'
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                        : 'bg-blue-50 border-blue-200 text-blue-900'
                    }`}
                  >
                    <Utensils className="w-4 h-4 mx-auto mb-1 text-slate-600" />
                    <span className="font-bold block text-xs">Breakfast</span>
                    <span
                      className={`text-[10px] font-black uppercase mt-1 inline-block px-2 py-0.5 rounded-full ${
                        guestFacilities?.breakfast === 'Collected'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-blue-600 text-white'
                      }`}
                    >
                      {guestFacilities?.breakfast === 'Collected' ? 'Collected' : 'Available'}
                    </span>
                  </div>

                  <div
                    className={`p-3 rounded-2xl border ${
                      guestFacilities?.lunch === 'Collected'
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                        : 'bg-blue-50 border-blue-200 text-blue-900'
                    }`}
                  >
                    <Utensils className="w-4 h-4 mx-auto mb-1 text-slate-600" />
                    <span className="font-bold block text-xs">Lunch</span>
                    <span
                      className={`text-[10px] font-black uppercase mt-1 inline-block px-2 py-0.5 rounded-full ${
                        guestFacilities?.lunch === 'Collected'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-blue-600 text-white'
                      }`}
                    >
                      {guestFacilities?.lunch === 'Collected' ? 'Collected' : 'Available'}
                    </span>
                  </div>

                  <div
                    className={`p-3 rounded-2xl border ${
                      guestFacilities?.dinner === 'Collected'
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                        : 'bg-blue-50 border-blue-200 text-blue-900'
                    }`}
                  >
                    <Utensils className="w-4 h-4 mx-auto mb-1 text-slate-600" />
                    <span className="font-bold block text-xs">Dinner</span>
                    <span
                      className={`text-[10px] font-black uppercase mt-1 inline-block px-2 py-0.5 rounded-full ${
                        guestFacilities?.dinner === 'Collected'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-blue-600 text-white'
                      }`}
                    >
                      {guestFacilities?.dinner === 'Collected' ? 'Collected' : 'Available'}
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl border bg-rose-50 border-rose-200 text-rose-900">
                    <Ban className="w-4 h-4 mx-auto mb-1 text-rose-600" />
                    <span className="font-bold block text-xs">Dress / Gift</span>
                    <span className="text-[10px] font-black uppercase mt-1 inline-block px-2 py-0.5 rounded-full bg-rose-600 text-white">
                      Not Eligible
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Button / Duplicate Warning */}
              {scannedGuest.status === 'ACTIVE' ? (
                guestFacilities?.[mealType] === 'Collected' ? (
                  <div className="p-4 rounded-2xl bg-rose-50 border-2 border-rose-300 text-rose-900 text-center font-bold text-xs space-y-1">
                    <div className="flex items-center justify-center gap-1.5 text-rose-700 text-sm font-black">
                      <XCircle className="w-5 h-5 text-rose-600" />
                      <span>ALREADY COLLECTED</span>
                    </div>
                    <p className="text-xs text-rose-800 font-extrabold">
                      Guest has already collected {mealType.toUpperCase()}.
                    </p>
                    <p className="text-[11px] font-normal text-rose-700">
                      Duplicate meal collection is strictly prohibited. Each meal can only be collected once.
                    </p>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleConfirmGuestFoodCollection}
                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 active:scale-[0.99] text-white font-black text-sm tracking-wider uppercase transition-all shadow-lg shadow-amber-600/25 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Utensils className="w-5 h-5" />
                    <span>[ CONFIRM GUEST {mealType.toUpperCase()} COLLECTION ]</span>
                  </button>
                )
              ) : (
                <div className="p-4 rounded-2xl bg-rose-50 border-2 border-rose-300 text-rose-900 text-center font-bold text-xs space-y-1">
                  <div className="flex items-center justify-center gap-1.5 text-rose-700 text-sm font-black">
                    <DoorOpen className="w-5 h-5 text-rose-600" />
                    <span>GATE ENTRY REQUIRED</span>
                  </div>
                  <p className="text-xs text-rose-800 font-bold">
                    Guest card must be activated at the Main Gate first before collecting food.
                  </p>
                </div>
              )}
            </div>
          ) : scannedStudent ? (
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
              {/* Student Header with Photograph */}
              <div className="flex items-start gap-4 pb-6 border-b border-slate-100">
                <img
                  src={scannedStudent.photoUrl || DEFAULT_STUDENT_AVATAR_PLACEHOLDER}
                  alt={scannedStudent.fullName}
                  className="w-20 h-24 object-cover rounded-2xl border-2 border-slate-200 shadow-xs bg-slate-100 shrink-0"
                />

                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-900 text-white">
                      {scannedStudent.category === 'former' ? 'Former Student' : 'Current Student'}
                    </span>
                    <span className="font-mono text-xs font-black text-amber-600">
                      {scannedStudent.id}
                    </span>
                  </div>

                  <h3 className="text-xl font-black text-slate-900 truncate">
                    {scannedStudent.fullName}
                  </h3>

                  <p className="text-xs text-slate-500 font-medium">
                    Batch: <span className="font-bold text-slate-800">{scannedStudent.batchName}</span>
                    {scannedStudent.passingYear && ` • Passing Year: ${scannedStudent.passingYear}`}
                  </p>

                  <div className="pt-1 flex items-center gap-2 text-xs">
                    <span className="font-bold text-slate-500">TOKEN:</span>
                    <span className="font-mono font-black tracking-widest text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded border border-amber-300">
                      {scannedStudent.qrToken}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status Badge */}
              <div className="p-4 rounded-2xl border flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">
                    {mealType} Collection Status
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    {validationResult?.status === 'ALREADY_COLLECTED' ? (
                      <span className="text-sm font-black text-rose-600 flex items-center gap-1.5">
                        <XCircle className="w-4 h-4" /> ALREADY COLLECTED
                      </span>
                    ) : validationResult?.status === 'ELIGIBLE' ? (
                      <span className="text-sm font-black text-emerald-600 flex items-center gap-1.5">
                        <CheckCircle className="w-4 h-4" /> NOT COLLECTED (ELIGIBLE)
                      </span>
                    ) : validationResult?.status === 'TIMEOUT' ? (
                <div className="p-4 rounded-2xl bg-rose-50 border-2 border-rose-500 text-rose-950 text-center font-bold text-xs space-y-2 shadow-md">
                  <div className="flex items-center justify-center gap-2 text-rose-700 text-sm font-black uppercase tracking-wider">
                    <Clock className="w-5 h-5 text-rose-600 animate-pulse" />
                    <span>TIME OUT</span>
                  </div>
                  <p className="text-xs text-rose-900 font-extrabold leading-snug">
                    {language === 'bn'
                      ? 'খাবার বিতরণের সময় শেষ অথবা স্ক্যানার নিষ্ক্রিয় রয়েছে।'
                      : 'Meal scanner is inactive or scheduled time has expired.'}
                  </p>
                  <p className="text-[11px] font-semibold text-rose-700">
                    {language === 'bn' ? validationResult.messageBn : validationResult.messageEn}
                  </p>
                </div>
              ) : validationResult?.status === 'BACK_TO_THE_GATE' ? (
                      <span className="text-sm font-black text-rose-600 flex items-center gap-1.5 animate-pulse">
                        <AlertOctagon className="w-4 h-4 text-rose-600" /> GATE ENTRY REQUIRED (BACK)
                      </span>
                    ) : validationResult?.status === 'GATE_ENTRY_REQUIRED' ? (
                      <span className="text-sm font-black text-rose-600 flex items-center gap-1.5">
                        <DoorOpen className="w-4 h-4 text-rose-600" /> GATE ENTRY REQUIRED (NOT ENTERED)
                      </span>
                    ) : validationResult?.status === 'TIMEOUT' ? (
                      <span className="text-sm font-black text-rose-600 flex items-center gap-1.5 animate-pulse">
                        <Clock className="w-4 h-4 text-rose-600" /> TIME OUT
                      </span>
                    ) : (
                      <span className="text-sm font-black text-rose-700 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4" /> {validationResult?.status}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {language === 'bn' ? validationResult?.messageBn : validationResult?.messageEn}
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Payment Status</span>
                  <span
                    className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      scannedStudent.paymentStatus === 'paid'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {scannedStudent.paymentStatus}
                  </span>
                </div>
              </div>

              {/* Primary Action Button: [ CONFIRM RECEIVED ] */}
              {validationResult?.canCollect ? (
                <button
                  type="button"
                  onClick={handleConfirmReceived}
                  className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm tracking-wider uppercase transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-5 h-5" />
                  <span>[ CONFIRM {mealType.toUpperCase()} RECEIVED ]</span>
                </button>
              ) : validationResult?.status === 'TIMEOUT' ? (
                <div className="p-4 rounded-2xl bg-rose-50 border-2 border-rose-500 text-rose-950 text-center font-bold text-xs space-y-2 shadow-md">
                  <div className="flex items-center justify-center gap-2 text-rose-700 text-sm font-black uppercase tracking-wider">
                    <Clock className="w-5 h-5 text-rose-600 animate-pulse" />
                    <span>TIME OUT</span>
                  </div>
                  <p className="text-xs text-rose-900 font-extrabold leading-snug">
                    {language === 'bn'
                      ? 'খাবার বিতরণের সময় শেষ অথবা স্ক্যানার নিষ্ক্রিয় রয়েছে।'
                      : 'Meal scanner is inactive or scheduled time has expired.'}
                  </p>
                  <p className="text-[11px] font-semibold text-rose-700">
                    {language === 'bn' ? validationResult.messageBn : validationResult.messageEn}
                  </p>
                </div>
              ) : validationResult?.status === 'BACK_TO_THE_GATE' ? (
                <div className="p-4 rounded-2xl bg-rose-50 border-2 border-rose-500 text-rose-950 text-center font-bold text-xs space-y-2 shadow-md">
                  <div className="flex items-center justify-center gap-2 text-rose-700 text-sm font-black uppercase tracking-wider">
                    <AlertOctagon className="w-5 h-5 text-rose-600" />
                    <span>BACK TO THE GATE</span>
                  </div>
                  <p className="text-xs text-rose-900 font-extrabold leading-snug">
                    Student has exited the event. Food collection is not allowed. Please ask the student to enter through the gate first.
                  </p>
                  <p className="text-[11px] font-semibold text-rose-700">
                    শিক্ষার্থী অনুষ্ঠানস্থল ত্যাগ করেছেন। পুনরায় ভেতরে প্রবেশের জন্য অনুগ্রহ করে আগে গেটে যান।
                  </p>
                </div>
              ) : validationResult?.status === 'GATE_ENTRY_REQUIRED' ? (
                <div className="p-4 rounded-2xl bg-rose-50 border-2 border-rose-300 text-rose-900 text-center font-bold text-xs space-y-1.5 shadow-xs">
                  <div className="flex items-center justify-center gap-1.5 text-rose-700 text-sm font-black">
                    <DoorOpen className="w-5 h-5 text-rose-600" />
                    <span>GATE ENTRY REQUIRED</span>
                  </div>
                  <p className="text-xs text-rose-800 font-bold">
                    Student has not entered the event. Please complete gate entry first.
                  </p>
                  <p className="text-[11px] font-medium text-rose-700">
                    শিক্ষার্থী এখনও অনুষ্ঠানে প্রবেশ করেননি। অনুগ্রহ করে আগে গেটে প্রবেশ সম্পন্ন করুন।
                  </p>
                </div>
              ) : validationResult?.status === 'ALREADY_COLLECTED' ? (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-center font-bold text-xs space-y-1">
                  <p>Duplicate Prevention: Student has already collected this meal.</p>
                  <p className="text-[11px] font-normal text-rose-700">
                    Staff members cannot reverse confirmed collections. If an administrative correction is needed, please contact Super Admin.
                  </p>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="bg-slate-50 rounded-3xl p-12 border-2 border-dashed border-slate-200 text-center space-y-3">
              <Utensils className="w-10 h-10 text-slate-300 mx-auto" />
              <h4 className="text-sm font-bold text-slate-700">Awaiting Student Scan</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Scan the student's digital QR ticket or enter their Registration ID on the left to verify meal collection status.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Meal Distributions Table & Admin Correction */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-4">
        <div className="flex justify-between items-center border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
              Recent {mealType} Distribution Log
            </h3>
          </div>
          <span className="text-xs font-bold text-slate-500 font-mono">
            {distributions.filter((d) => d.mealType === mealType).length} records
          </span>
        </div>

        {distributions.filter((d) => d.mealType === mealType).length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center">
            No {mealType} distributions recorded yet.
          </p>
        ) : (
          <>
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">Student ID</th>
                  <th className="py-2.5 px-3">Student Name</th>
                  <th className="py-2.5 px-3">Batch</th>
                  <th className="py-2.5 px-3">Collected Time</th>
                  <th className="py-2.5 px-3">Staff Incharge</th>
                  <th className="py-2.5 px-3">Status</th>
                  {isSuperAdmin && <th className="py-2.5 px-3 text-right">Admin Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginate(
                  distributions.filter((d) => d.mealType === mealType),
                  logPage,
                  logPageSize
                ).map((record) => (
                    <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                        {record.registrationId}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">
                        {record.studentName}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">{record.batchName}</td>
                      <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                        {new Date(record.collectedAt).toLocaleTimeString()}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{record.staffName}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            record.status === 'COLLECTED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {record.status}
                        </span>
                      </td>
                      {isSuperAdmin && (
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={() => {
                              setSelectedRecordForCorrection(record);
                              setNewCorrectionStatus(record.status === 'COLLECTED' ? 'CANCELLED' : 'COLLECTED');
                            }}
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 ml-auto cursor-pointer"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Correct</span>
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-2.5">
            {paginate(
              distributions.filter((d) => d.mealType === mealType),
              logPage,
              logPageSize
            ).map((record) => (
              <div key={record.id} className="rounded-xl border border-slate-200 bg-white p-3 space-y-2 shadow-xs">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-mono font-bold text-slate-900 text-xs">{record.registrationId}</p>
                    <p className="text-xs font-semibold text-slate-700">{record.studentName}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${record.status === 'COLLECTED' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                    {record.status}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1 text-[10px] text-slate-500">
                  <div><span className="uppercase tracking-wider block">Batch</span><p className="text-slate-700 font-semibold">{record.batchName}</p></div>
                  <div><span className="uppercase tracking-wider block">Staff</span><p className="text-slate-700 font-semibold">{record.staffName}</p></div>
                  <div><span className="uppercase tracking-wider block">Time</span><p className="text-slate-700 font-mono">{new Date(record.collectedAt).toLocaleTimeString()}</p></div>
                </div>
                {isSuperAdmin && (
                  <button
                    onClick={() => { setSelectedRecordForCorrection(record); setNewCorrectionStatus(record.status === 'COLLECTED' ? 'CANCELLED' : 'COLLECTED'); }}
                    className="w-full py-2.5 rounded-lg border border-indigo-200 text-indigo-600 text-xs font-bold flex items-center justify-center gap-1.5 min-h-[44px]"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Correct Status
                  </button>
                )}
              </div>
            ))}
          </div>
          </>
        )}

        {/* Global Pagination */}
        <GlobalPagination
          currentPage={logPage}
          totalRecords={distributions.filter((d) => d.mealType === mealType).length}
          pageSize={logPageSize}
          onPageChange={setLogPage}
          onPageSizeChange={setLogPageSize}
          language={language}
        />
      </div>

      {/* Super Admin Correction Modal with Mandatory Reason */}
      {selectedRecordForCorrection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-sm text-slate-900">
                  Super Admin Meal Record Correction
                </h3>
              </div>
              <button
                onClick={() => setSelectedRecordForCorrection(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-1 bg-slate-50 p-3 rounded-2xl border border-slate-200">
              <p>Student: <strong>{selectedRecordForCorrection.studentName}</strong> ({selectedRecordForCorrection.registrationId})</p>
              <p>Meal: <strong className="uppercase">{selectedRecordForCorrection.mealType}</strong></p>
              <p>Current Status: <strong>{selectedRecordForCorrection.status}</strong></p>
            </div>

            <form onSubmit={handleSaveAdminCorrection} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">New Status</label>
                <select
                  value={newCorrectionStatus}
                  onChange={(e) => setNewCorrectionStatus(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold"
                >
                  <option value="CANCELLED">CANCELLED (Void collection)</option>
                  <option value="COLLECTED">COLLECTED (Mark as collected)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mandatory Audit Reason *
                </label>
                <textarea
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  placeholder="State the verifiable reason for correcting this meal collection record..."
                  required
                  rows={3}
                  className="w-full p-3 rounded-xl border border-slate-300 text-xs focus:border-indigo-600 focus:outline-hidden"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedRecordForCorrection(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer"
                >
                  Save & Log Correction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ── HIGH-VISIBILITY POPUP SCREEN FOR SCANNED OUTPUT ── */}
      {isResultPopupOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-backdrop-in overflow-y-auto">
          <div
            className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-pop-in my-auto"
            role="dialog"
            aria-modal="true"
          >
            {/* Modal Header Bar */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-900 to-amber-950 text-white">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-400/30">
                  <Utensils className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h3 className="text-sm font-black tracking-wide">
                    {language === 'bn'
                      ? `${mealType === 'breakfast' ? 'সকালের নাস্তা' : mealType === 'lunch' ? 'দুপুরের খাবার' : 'রাতের খাবার'} যাচাই ফলাফল`
                      : `${mealType.toUpperCase()} Distribution Result`}
                  </h3>
                  <span className="text-[10px] text-slate-300 font-mono">
                    Official Reunion 2026/2027 Food Desk
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsResultPopupOpen(false);
                  setScannedStudent(null);
                  setScannedGuest(null);
                  setGuestFacilities(null);
                  setGuestNotice(null);
                  setScannedStaff(null);
                  setStaffFacilities(null);
                  setStaffNotice(null);
                  setFeedbackNotice(null);
                }}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body Content */}
            <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              {/* Feedback Alert Notice */}
              {feedbackNotice && (
                <div
                  className={`p-4 rounded-2xl text-xs font-bold flex items-center gap-2.5 ${
                    feedbackNotice.type === 'success'
                      ? 'bg-emerald-50 border border-emerald-300 text-emerald-900'
                      : 'bg-rose-50 border border-rose-300 text-rose-900'
                  }`}
                >
                  {feedbackNotice.type === 'success' ? (
                    <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
                  )}
                  <span>{feedbackNotice.message}</span>
                </div>
              )}

              {/* Guest Feedback Alert Notice */}
              {guestNotice && (
                <div
                  className={`p-4 rounded-2xl text-xs font-bold flex items-center gap-2.5 ${
                    guestNotice.type === 'success'
                      ? 'bg-emerald-50 border border-emerald-300 text-emerald-900'
                      : guestNotice.type === 'warning'
                      ? 'bg-amber-50 border border-amber-300 text-amber-900'
                      : 'bg-rose-50 border border-rose-300 text-rose-900'
                  }`}
                >
                  {guestNotice.type === 'success' ? (
                    <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                  ) : guestNotice.type === 'warning' ? (
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
                  )}
                  <div>
                    <p>{guestNotice.message}</p>
                    {guestNotice.messageBn && (
                      <p className="text-[11px] font-normal opacity-90 mt-0.5">{guestNotice.messageBn}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Staff Feedback Alert Notice */}
              {staffNotice && (
                <div
                  className={`p-4 rounded-2xl text-xs font-bold flex items-center gap-2.5 ${
                    staffNotice.type === 'success'
                      ? 'bg-emerald-50 border border-emerald-300 text-emerald-900'
                      : staffNotice.type === 'warning'
                      ? 'bg-amber-50 border border-amber-300 text-amber-900'
                      : 'bg-rose-50 border border-rose-300 text-rose-900'
                  }`}
                >
                  {staffNotice.type === 'success' ? (
                    <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                  ) : staffNotice.type === 'warning' ? (
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
                  )}
                  <div>
                    <p>{staffNotice.message}</p>
                    {staffNotice.messageBn && (
                      <p className="text-[11px] font-normal opacity-90 mt-0.5">{staffNotice.messageBn}</p>
                    )}
                  </div>
                </div>
              )}

              {scannedGuest ? (
                <>
                  {/* Guest Profile Card */}
                  <div className="flex items-start gap-4 pb-5 border-b border-amber-100">
                    <div className="w-20 h-24 rounded-2xl bg-gradient-to-br from-amber-500 via-amber-600 to-orange-700 flex flex-col items-center justify-center text-white shadow-md border-2 border-amber-300 shrink-0">
                      <Crown className="w-8 h-8 text-amber-200 mb-1" />
                      <span className="text-[9px] font-black uppercase tracking-wider">Guest Pass</span>
                    </div>

                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500 text-slate-950">
                          {scannedGuest.category}
                        </span>
                        <span className="font-mono text-xs font-black text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded">
                          {scannedGuest.id}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            scannedGuest.status === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : scannedGuest.status === 'INACTIVE'
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : 'bg-rose-100 text-rose-800 border border-rose-300'
                          }`}
                        >
                          {scannedGuest.status}
                        </span>
                      </div>

                      <h4 className="text-lg font-black text-slate-900 truncate">
                        {scannedGuest.regNumber}
                      </h4>

                      <div className="pt-1 flex items-center gap-2 text-xs">
                        <span className="font-bold text-slate-500">TOKEN:</span>
                        <span className="font-mono font-black tracking-widest text-amber-900 bg-amber-100 px-2.5 py-0.5 rounded border border-amber-300">
                          {scannedGuest.token}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Gate Activation Info */}
                  <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/60 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="font-bold text-slate-500">Gate Activation:</span>
                      <span className="font-bold text-slate-800">
                        {scannedGuest.activatedGate || 'Main Gate 01'} (
                        {scannedGuest.activatedAt ? new Date(scannedGuest.activatedAt).toLocaleTimeString() : 'Verified'}
                        )
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-bold text-slate-500">Activated By:</span>
                      <span className="font-medium text-slate-700">{scannedGuest.activatedByStaffName || 'Gate Operator'}</span>
                    </div>
                  </div>

                  {/* Food Facilities Matrix */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                      Guest Meal Facilities Status
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                      <div
                        className={`p-3 rounded-2xl border ${
                          guestFacilities?.breakfast === 'Collected'
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                            : 'bg-blue-50 border-blue-200 text-blue-900'
                        }`}
                      >
                        <Utensils className="w-4 h-4 mx-auto mb-1 text-slate-600" />
                        <span className="font-bold block text-xs">Breakfast</span>
                        <span
                          className={`text-[10px] font-black uppercase mt-1 inline-block px-2 py-0.5 rounded-full ${
                            guestFacilities?.breakfast === 'Collected'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-blue-600 text-white'
                          }`}
                        >
                          {guestFacilities?.breakfast === 'Collected' ? 'Collected' : 'Available'}
                        </span>
                      </div>

                      <div
                        className={`p-3 rounded-2xl border ${
                          guestFacilities?.lunch === 'Collected'
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                            : 'bg-blue-50 border-blue-200 text-blue-900'
                        }`}
                      >
                        <Utensils className="w-4 h-4 mx-auto mb-1 text-slate-600" />
                        <span className="font-bold block text-xs">Lunch</span>
                        <span
                          className={`text-[10px] font-black uppercase mt-1 inline-block px-2 py-0.5 rounded-full ${
                            guestFacilities?.lunch === 'Collected'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-blue-600 text-white'
                          }`}
                        >
                          {guestFacilities?.lunch === 'Collected' ? 'Collected' : 'Available'}
                        </span>
                      </div>

                      <div
                        className={`p-3 rounded-2xl border ${
                          guestFacilities?.dinner === 'Collected'
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                            : 'bg-blue-50 border-blue-200 text-blue-900'
                        }`}
                      >
                        <Utensils className="w-4 h-4 mx-auto mb-1 text-slate-600" />
                        <span className="font-bold block text-xs">Dinner</span>
                        <span
                          className={`text-[10px] font-black uppercase mt-1 inline-block px-2 py-0.5 rounded-full ${
                            guestFacilities?.dinner === 'Collected'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-blue-600 text-white'
                          }`}
                        >
                          {guestFacilities?.dinner === 'Collected' ? 'Collected' : 'Available'}
                        </span>
                      </div>

                      <div className="p-3 rounded-2xl border bg-rose-50 border-rose-200 text-rose-900">
                        <Ban className="w-4 h-4 mx-auto mb-1 text-rose-600" />
                        <span className="font-bold block text-xs">Dress / Gift</span>
                        <span className="text-[10px] font-black uppercase mt-1 inline-block px-2 py-0.5 rounded-full bg-rose-600 text-white">
                          Not Eligible
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Action Button / Duplicate Warning */}
                  {scannedGuest.status === 'ACTIVE' ? (
                    (mealType === 'breakfast' && guestFacilities?.breakfast === 'Collected') ||
                    (mealType === 'lunch' && guestFacilities?.lunch === 'Collected') ||
                    (mealType === 'dinner' && guestFacilities?.dinner === 'Collected') ? (
                      <div className="p-4 rounded-2xl bg-rose-50 border-2 border-rose-300 text-rose-900 text-center font-bold text-xs space-y-1">
                        <div className="flex items-center justify-center gap-1.5 text-rose-700 text-sm font-black">
                          <XCircle className="w-5 h-5 text-rose-600" />
                          <span>ALREADY COLLECTED</span>
                        </div>
                        <p className="text-xs text-rose-800 font-extrabold">
                          Guest {scannedGuest.id} has already collected {mealType.toUpperCase()}.
                        </p>
                        <p className="text-[11px] font-normal text-rose-700">
                          Duplicate meal collection is strictly prohibited. Each meal can only be collected once.
                        </p>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleConfirmGuestFoodCollection}
                        className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 active:scale-[0.99] text-white font-black text-sm tracking-wider uppercase transition-all shadow-lg shadow-amber-600/25 cursor-pointer flex items-center justify-center gap-2"
                      >
                        <Utensils className="w-5 h-5" />
                        <span>[ CONFIRM GUEST {mealType.toUpperCase()} COLLECTION ]</span>
                      </button>
                    )
                  ) : (
                    <div className="p-4 rounded-2xl bg-rose-50 border-2 border-rose-300 text-rose-900 text-center font-bold text-xs space-y-1">
                      <div className="flex items-center justify-center gap-1.5 text-rose-700 text-sm font-black">
                        <DoorOpen className="w-5 h-5 text-rose-600" />
                        <span>GATE ENTRY REQUIRED</span>
                      </div>
                      <p className="text-xs text-rose-800 font-bold">
                        Guest card must be activated at the Main Gate first before collecting food.
                      </p>
                    </div>
                  )}
                </>
              ) : scannedStaff ? (
                <>
                  {/* Staff Profile Card */}
                  <div className="flex items-start gap-4 pb-5 border-b border-amber-100">
                    <div className="w-20 h-24 rounded-2xl bg-gradient-to-br from-yellow-400 via-amber-500 to-amber-700 flex flex-col items-center justify-center text-slate-950 shadow-md border-2 border-amber-300 shrink-0 font-sans">
                      <Shield className="w-8 h-8 text-slate-950 mb-1" />
                      <span className="text-[9px] font-black uppercase tracking-wider">Staff Pass</span>
                    </div>

                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-950">
                          {scannedStaff.designation || 'Staff Member'}
                        </span>
                        <span className="font-mono text-xs font-black text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded">
                          {scannedStaff.id}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            scannedStaff.status === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : scannedStaff.status === 'INACTIVE'
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : 'bg-rose-100 text-rose-800 border border-rose-300'
                          }`}
                        >
                          {scannedStaff.status}
                        </span>
                      </div>

                      <h4 className="text-lg font-black text-slate-900 truncate">
                        {scannedStaff.staffName || scannedStaff.regNumber}
                      </h4>

                      <div className="text-xs text-slate-500">
                        <span>{scannedStaff.department || 'Operations Team'}</span>
                        {(scannedStaff.mobileNumber || scannedStaff.phone) && <span> • {scannedStaff.mobileNumber || scannedStaff.phone}</span>}
                      </div>

                      <div className="pt-1 flex items-center gap-2 text-xs">
                        <span className="font-bold text-slate-500">TOKEN:</span>
                        <span className="font-mono font-black tracking-widest text-amber-900 bg-amber-100 px-2.5 py-0.5 rounded border border-amber-300">
                          {scannedStaff.token}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Staff Meal Facilities Matrix */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                      Assigned Meal Entitlements
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                      {/* Breakfast */}
                      <div
                        className={`p-3 rounded-2xl border ${
                          staffFacilities?.breakfast === 'Collected'
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                            : staffFacilities?.breakfast === 'Available'
                            ? 'bg-blue-50 border-blue-200 text-blue-900'
                            : 'bg-slate-50 border-slate-200 text-slate-500'
                        }`}
                      >
                        <Utensils className="w-4 h-4 mx-auto mb-1 text-slate-600" />
                        <span className="font-bold block text-xs">Breakfast</span>
                        <span
                          className={`text-[10px] font-black uppercase mt-1 inline-block px-2 py-0.5 rounded-full ${
                            staffFacilities?.breakfast === 'Collected'
                              ? 'bg-emerald-600 text-white'
                              : staffFacilities?.breakfast === 'Available'
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {staffFacilities?.breakfast === 'Collected'
                            ? 'Collected'
                            : staffFacilities?.breakfast === 'Available'
                            ? 'Authorized'
                            : 'Not Assigned'}
                        </span>
                      </div>

                      {/* Lunch */}
                      <div
                        className={`p-3 rounded-2xl border ${
                          staffFacilities?.lunch === 'Collected'
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                            : staffFacilities?.lunch === 'Available'
                            ? 'bg-blue-50 border-blue-200 text-blue-900'
                            : 'bg-slate-50 border-slate-200 text-slate-500'
                        }`}
                      >
                        <Utensils className="w-4 h-4 mx-auto mb-1 text-slate-600" />
                        <span className="font-bold block text-xs">Lunch</span>
                        <span
                          className={`text-[10px] font-black uppercase mt-1 inline-block px-2 py-0.5 rounded-full ${
                            staffFacilities?.lunch === 'Collected'
                              ? 'bg-emerald-600 text-white'
                              : staffFacilities?.lunch === 'Available'
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {staffFacilities?.lunch === 'Collected'
                            ? 'Collected'
                            : staffFacilities?.lunch === 'Available'
                            ? 'Authorized'
                            : 'Not Assigned'}
                        </span>
                      </div>

                      {/* Dinner */}
                      <div
                        className={`p-3 rounded-2xl border ${
                          staffFacilities?.dinner === 'Collected'
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                            : staffFacilities?.dinner === 'Available'
                            ? 'bg-blue-50 border-blue-200 text-blue-900'
                            : 'bg-slate-50 border-slate-200 text-slate-500'
                        }`}
                      >
                        <Utensils className="w-4 h-4 mx-auto mb-1 text-slate-600" />
                        <span className="font-bold block text-xs">Dinner</span>
                        <span
                          className={`text-[10px] font-black uppercase mt-1 inline-block px-2 py-0.5 rounded-full ${
                            staffFacilities?.dinner === 'Collected'
                              ? 'bg-emerald-600 text-white'
                              : staffFacilities?.dinner === 'Available'
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {staffFacilities?.dinner === 'Collected'
                            ? 'Collected'
                            : staffFacilities?.dinner === 'Available'
                            ? 'Authorized'
                            : 'Not Assigned'}
                        </span>
                      </div>

                      {/* Dress / Gift */}
                      <div className="p-3 rounded-2xl border bg-rose-50 border-rose-200 text-rose-900">
                        <Ban className="w-4 h-4 mx-auto mb-1 text-rose-600" />
                        <span className="font-bold block text-xs">Dress / Gift</span>
                        <span className="text-[10px] font-black uppercase mt-1 inline-block px-2 py-0.5 rounded-full bg-rose-600 text-white">
                          Not Eligible
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Action Button / Duplicate Warning / Inactive Warning */}
                  {scannedStaff.status === 'ACTIVE' ? (
                    !scannedStaff.mealEntitlements?.includes(mealType) ? (
                      <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-900 text-center font-bold text-xs space-y-1">
                        <div className="flex items-center justify-center gap-1.5 text-amber-800 text-sm font-black">
                          <AlertTriangle className="w-5 h-5 text-amber-600" />
                          <span>MEAL NOT ASSIGNED</span>
                        </div>
                        <p className="text-xs text-amber-800 font-extrabold">
                          Staff card is not authorized for {mealType.toUpperCase()}.
                        </p>
                        <p className="text-[11px] font-normal text-amber-700">
                          Super Admin can assign or update meal entitlements from the Staff Pass Suite.
                        </p>
                      </div>
                    ) : staffFacilities?.[mealType] === 'Collected' ? (
                      <div className="p-4 rounded-2xl bg-rose-50 border-2 border-rose-300 text-rose-900 text-center font-bold text-xs space-y-1">
                        <div className="flex items-center justify-center gap-1.5 text-rose-700 text-sm font-black">
                          <XCircle className="w-5 h-5 text-rose-600" />
                          <span>ALREADY COLLECTED</span>
                        </div>
                        <p className="text-xs text-rose-800 font-extrabold">
                          Staff member {scannedStaff.staffName || scannedStaff.id} has already collected {mealType.toUpperCase()}.
                        </p>
                        <p className="text-[11px] font-normal text-rose-700">
                          Duplicate meal collection is strictly prohibited. Each meal can only be collected once.
                        </p>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleConfirmStaffFoodCollection}
                        className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 hover:from-amber-600 hover:to-amber-800 active:scale-[0.99] text-slate-950 font-black text-sm tracking-wider uppercase transition-all shadow-lg shadow-amber-500/25 cursor-pointer flex items-center justify-center gap-2"
                      >
                        <Utensils className="w-5 h-5" />
                        <span>[ CONFIRM STAFF {mealType.toUpperCase()} COLLECTION ]</span>
                      </button>
                    )
                  ) : (
                    <div className="p-4 rounded-2xl bg-rose-50 border-2 border-rose-300 text-rose-900 text-center font-bold text-xs space-y-1">
                      <div className="flex items-center justify-center gap-1.5 text-rose-700 text-sm font-black">
                        <Shield className="w-5 h-5 text-rose-600" />
                        <span>CARD NOT ACTIVATED</span>
                      </div>
                      <p className="text-xs text-rose-800 font-bold">
                        Staff card must be activated by Super Admin before collecting meals.
                      </p>
                    </div>
                  )}
                </>
              ) : scannedStudent ? (
                <>
                  {/* Student Profile Card */}
                  <div className="flex items-start gap-4 pb-5 border-b border-slate-100">
                    <img
                      src={scannedStudent.photoUrl || DEFAULT_STUDENT_AVATAR_PLACEHOLDER}
                      alt={scannedStudent.fullName}
                      className="w-20 h-24 object-cover rounded-2xl border-2 border-slate-200 shadow-xs bg-slate-100 shrink-0"
                    />

                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-900 text-white">
                          {scannedStudent.category === 'former' ? 'Former Student' : 'Current Student'}
                        </span>
                        <span className="font-mono text-xs font-black text-amber-600">
                          {scannedStudent.id}
                        </span>
                      </div>

                      <h4 className="text-lg font-black text-slate-900 truncate">
                        {scannedStudent.fullName}
                      </h4>

                      <p className="text-xs text-slate-500 font-medium">
                        Batch: <span className="font-bold text-slate-800">{scannedStudent.batchName}</span>
                        {scannedStudent.passingYear && ` • Passing Year: ${scannedStudent.passingYear}`}
                      </p>

                      <div className="pt-1 flex items-center gap-2 text-xs">
                        <span className="font-bold text-slate-500">TOKEN:</span>
                        <span className="font-mono font-black tracking-widest text-amber-900 bg-amber-100/80 px-2.5 py-0.5 rounded border border-amber-300">
                          {scannedStudent.qrToken}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Meal Station & Status Box */}
                  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-amber-700 tracking-wider block">
                        Assigned Food Station
                      </span>
                      <span className="text-sm font-black text-amber-950 block capitalize">
                        Official {mealType} Meal Voucher
                      </span>
                    </div>

                    <div className="text-center bg-white px-4 py-2 rounded-xl border border-amber-300 shadow-2xs">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Meal</span>
                      <span className="text-sm font-black text-amber-700 font-mono capitalize">
                        {mealType}
                      </span>
                    </div>
                  </div>

                  {/* Eligibility & Payment Status */}
                  <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">
                        Collection Status
                      </span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {validationResult?.status === 'ALREADY_COLLECTED' ? (
                          <span className="text-xs font-black text-rose-600 flex items-center gap-1">
                            <XCircle className="w-4 h-4" /> ALREADY COLLECTED
                          </span>
                        ) : validationResult?.status === 'ELIGIBLE' ? (
                          <span className="text-xs font-black text-emerald-600 flex items-center gap-1">
                            <CheckCircle className="w-4 h-4" /> NOT COLLECTED (ELIGIBLE)
                          </span>
                        ) : validationResult?.status === 'TIMEOUT' ? (
                          <span className="text-xs font-black text-rose-600 flex items-center gap-1 animate-pulse">
                            <Clock className="w-4 h-4 text-rose-600" /> TIME OUT
                          </span>
                        ) : validationResult?.status === 'BACK_TO_THE_GATE' ? (
                          <span className="text-xs font-black text-rose-600 flex items-center gap-1 animate-pulse">
                            <AlertOctagon className="w-4 h-4 text-rose-600" /> GATE ENTRY REQUIRED (BACK)
                          </span>
                        ) : validationResult?.status === 'GATE_ENTRY_REQUIRED' ? (
                          <span className="text-xs font-black text-rose-600 flex items-center gap-1">
                            <DoorOpen className="w-4 h-4 text-rose-600" /> GATE ENTRY REQUIRED (NOT ENTERED)
                          </span>
                        ) : (
                          <span className="text-xs font-black text-amber-700 flex items-center gap-1">
                            <AlertTriangle className="w-4 h-4" /> {validationResult?.status}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Payment</span>
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                          scannedStudent.paymentStatus === 'paid'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {scannedStudent.paymentStatus}
                      </span>
                    </div>
                  </div>

                  {/* Primary Action Button */}
                  {validationResult?.canCollect ? (
                    <button
                      type="button"
                      onClick={handleConfirmReceived}
                      className="w-full py-4 rounded-2xl bg-amber-600 hover:bg-amber-700 active:scale-[0.99] text-white font-black text-sm tracking-wider uppercase transition-all shadow-lg shadow-amber-600/25 cursor-pointer flex items-center justify-center gap-2"
                    >
                      <CheckCircle className="w-5 h-5" />
                      <span>[ CONFIRM {mealType.toUpperCase()} COLLECTED ]</span>
                    </button>
                  ) : validationResult?.status === 'TIMEOUT' ? (
                <div className="p-4 rounded-2xl bg-rose-50 border-2 border-rose-500 text-rose-950 text-center font-bold text-xs space-y-2 shadow-md">
                  <div className="flex items-center justify-center gap-2 text-rose-700 text-sm font-black uppercase tracking-wider">
                    <Clock className="w-5 h-5 text-rose-600 animate-pulse" />
                    <span>TIME OUT</span>
                  </div>
                  <p className="text-xs text-rose-900 font-extrabold leading-snug">
                    {language === 'bn'
                      ? 'খাবার বিতরণের সময় শেষ অথবা স্ক্যানার নিষ্ক্রিয় রয়েছে।'
                      : 'Meal scanner is inactive or scheduled time has expired.'}
                  </p>
                  <p className="text-[11px] font-semibold text-rose-700">
                    {language === 'bn' ? validationResult.messageBn : validationResult.messageEn}
                  </p>
                </div>
              ) : validationResult?.status === 'BACK_TO_THE_GATE' ? (
                    <div className="p-4 rounded-2xl bg-rose-600 text-white text-center font-bold text-xs space-y-1.5 shadow-md">
                      <div className="flex items-center justify-center gap-1.5 text-amber-300 text-sm font-black tracking-wider uppercase">
                        <AlertOctagon className="w-5 h-5 text-amber-300" />
                        <span>GATE ENTRY REQUIRED (BACK TO THE GATE)</span>
                      </div>
                      <p className="text-xs text-white font-extrabold leading-snug">
                        Student has exited the event. Food collection is not allowed. Please ask the student to enter through the gate first.
                      </p>
                      <p className="text-[11px] font-medium text-rose-100">
                        গেট এন্ট্রি আবশ্যক: শিক্ষার্থী অনুষ্ঠানস্থল ত্যাগ করেছেন (BACK)। পুনরায় খাবার নিতে হলে আগে গেট দিয়ে প্রবেশ (ENTRY) করতে হবে।
                      </p>
                    </div>
                  ) : validationResult?.status === 'GATE_ENTRY_REQUIRED' ? (
                    <div className="p-4 rounded-2xl bg-rose-600 text-white text-center font-bold text-xs space-y-1.5 shadow-md">
                      <div className="flex items-center justify-center gap-1.5 text-amber-300 text-sm font-black tracking-wider uppercase">
                        <DoorOpen className="w-5 h-5 text-amber-300" />
                        <span>GATE ENTRY REQUIRED</span>
                      </div>
                      <p className="text-xs text-white font-extrabold leading-snug">
                        Student has not entered the event. Please complete gate entry first.
                      </p>
                      <p className="text-[11px] font-medium text-rose-100">
                        গেট এন্ট্রি আবশ্যক: শিক্ষার্থী এখনও অনুষ্ঠানে প্রবেশ করেননি। খাবার নেওয়ার আগে গেট দিয়ে প্রবেশ (ENTRY) সম্পন্ন করুন।
                      </p>
                    </div>
                  ) : validationResult?.status === 'ALREADY_COLLECTED' ? (
                    <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-center font-bold text-xs space-y-1">
                      <p>Student has already collected this {mealType} meal.</p>
                      <p className="text-[11px] font-normal text-rose-700">
                        Duplicate food collections are blocked by event security rules.
                      </p>
                    </div>
                  ) : null}
                </>
              ) : (
                /* Ticket Not Found State */
                <div className="p-6 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
                    <XCircle className="w-6 h-6" />
                  </div>
                  <h4 className="text-base font-bold text-slate-900">
                    {validationResult?.messageEn?.includes('Guest Pass') || guestNotice
                      ? (language === 'bn' ? 'গেস্ট পাস পাওয়া যায়নি' : 'Guest Pass Not Found')
                      : (language === 'bn' ? 'কোনো টিকিট পাওয়া যায়নি' : 'Ticket Not Found')}
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {validationResult?.messageEn ||
                      'Please verify the QR code image or check the registration ID number.'}
                  </p>
                </div>
              )}

              {/* Close / Scan Next Student Button */}
              <button
                type="button"
                onClick={() => {
                  setIsResultPopupOpen(false);
                  setScannedStudent(null);
                  setScannedGuest(null);
                  setGuestFacilities(null);
                  setGuestNotice(null);
                  setScannedStaff(null);
                  setStaffFacilities(null);
                  setStaffNotice(null);
                  setFeedbackNotice(null);
                }}
                className="w-full py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
              >
                {language === 'bn' ? 'পরবর্তী টিকিট স্ক্যান করুন' : 'Scan Next Ticket / Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
