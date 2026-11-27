/**
 * Manual Student Registration Portal (Registration Desk Staff & Super Admin)
 * Police Lines School & College, Faridpur — Grand Reunion 2027
 *
 * Features:
 * - Full registration parity with Main Registration Portal (Current Student ID DB auto-fill,
 *   Alumni batches, Photo upload/camera, Gender/Blood Group, Accompanying Parent Pass, T-Shirt).
 * - Dedicated Manual Payment Workflow (Cash, bKash, Bank Transfer) saved to manual_registrations.
 * - Immediate Card Generation & Printing (with Pending Approval status until Super Admin approves).
 * - Role-scoped Desk Staff Dashboard with Dynamic DB Stats, Search, Reprint, and Restricted Edit
 *   (Name & Mobile ONLY; financial/approval fields protected).
 */

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  Camera,
  Upload,
  QrCode,
  AlertCircle,
  AlertTriangle,
  DollarSign,
  X,
  Sparkles,
  Lock,
  User,
  Shirt,
  RefreshCw,
  ShieldCheck,
  Search,
  GraduationCap,
  CheckCircle2,
  School,
  Users,
  Droplet,
  Printer,
  Edit2,
  Clock,
  XCircle,
  CreditCard,
  Banknote,
  Building2,
  Smartphone,
  ListChecks,
  UserPlus,
} from 'lucide-react';
import {
  Language,
  StudentCategory,
  TShirtSize,
  AdminAccount,
  RegistrationRecord,
  ManualRegistrationInput,
  StudentIdVerificationResult,
} from '../../../types';
import { ManualRegistrationService, EVENT_MANUAL_REG_SYNC } from '../../../services/manualRegistrationService';
import { AppStore } from '../../../services/store';
import { StudentIdService } from '../../../services/studentIdStore';
import { SynchronizedCameraCardModal } from '../../idcard/SynchronizedCameraCardModal';
import { TicketView } from '../../TicketView';
import {
  normalizeBangladeshiMobileNumber,
  isGuardianEligible,
  calculateTotalFee,
  validateRegistrationData,
  RegistrationFormData,
} from '../../../utils/rules';
import { StudentPhotoStorageService } from '../../../services/studentPhotoStorageService';
import { readValidatedImage } from '../../../utils/fileValidation';
import { compressImageTo200KB } from '../../../utils/imageCompressor';
import { DEFAULT_STUDENT_AVATAR_PLACEHOLDER } from '../../../services/studentPhotoStorageService';
import { StudentIdCardRecord } from '../../../types/idcard';

interface ManualRegistrationTabProps {
  language: Language;
  currentAdmin: AdminAccount;
}

type ManualPaymentMethod = 'Cash' | 'bKash' | 'Bank Transfer';

const T_SHIRT_SIZES: TShirtSize[] = ['S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'Oversize 50'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export const ManualRegistrationTab: React.FC<ManualRegistrationTabProps> = ({
  language,
  currentAdmin,
}) => {
  const isBangla = language === 'bn';
  const isSuperAdmin = currentAdmin.role === 'super_admin';
  const feeSettings = useMemo(() => AppStore.getFeeSettings(), []);

  // Sub-navigation: Registration Form vs Staff Desk Dashboard
  const [subView, setSubView] = useState<'form' | 'myRegistrations'>('form');

  // ── Scoped Staff Registrations & Stats ──────────────────────────────────────
  const [myRegistrations, setMyRegistrations] = useState<RegistrationRecord[]>(() =>
    ManualRegistrationService.getRegistrationsForStaff(currentAdmin.id, isSuperAdmin)
  );
  const [isSyncingList, setIsSyncingList] = useState(false);

  const refreshStaffList = useCallback(async (fromCloud = false) => {
    if (fromCloud) {
      setIsSyncingList(true);
      await ManualRegistrationService.syncFromSupabase();
      setIsSyncingList(false);
    }
    setMyRegistrations(
      ManualRegistrationService.getRegistrationsForStaff(currentAdmin.id, isSuperAdmin)
    );
  }, [currentAdmin.id, isSuperAdmin]);

  useEffect(() => {
    refreshStaffList(true);
    StudentIdService.syncWithSupabase().catch(() => { });

    const handleSync = () => {
      setMyRegistrations(
        ManualRegistrationService.getRegistrationsForStaff(currentAdmin.id, isSuperAdmin)
      );
    };
    window.addEventListener(EVENT_MANUAL_REG_SYNC, handleSync);
    window.addEventListener('plscf_registration_updated', handleSync);
    return () => {
      window.removeEventListener(EVENT_MANUAL_REG_SYNC, handleSync);
      window.removeEventListener('plscf_registration_updated', handleSync);
    };
  }, [currentAdmin.id, isSuperAdmin, refreshStaffList]);

  const staffStats = useMemo(
    () => ManualRegistrationService.getStats(myRegistrations),
    [myRegistrations]
  );

  // ── Staff Search & Filter State ─────────────────────────────────────────────
  const [deskSearch, setDeskSearch] = useState('');
  const [deskStatusFilter, setDeskStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  const filteredDeskRegistrations = useMemo(() => {
    const q = deskSearch.trim().toLowerCase();
    return myRegistrations.filter((r) => {
      const regStatus = r.registrationApprovalStatus || 'pending';
      if (deskStatusFilter !== 'all' && regStatus !== deskStatusFilter) return false;
      if (!q) return true;
      return (
        (r.fullName || '').toLowerCase().includes(q) ||
        (r.mobileNumber || '').includes(q) ||
        (r.id || '').toLowerCase().includes(q) ||
        (r.studentId || '').toLowerCase().includes(q)
      );
    });
  }, [myRegistrations, deskSearch, deskStatusFilter]);

  // ── Registration Form State (Matching RegistrationPage.tsx) ────────────────
  const [category, setCategory] = useState<StudentCategory>('former');
  const [fullName, setFullName] = useState('');
  const [fullNameBn, setFullNameBn] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoStoragePath, setPhotoStoragePath] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const photoFileInputRef = useRef<HTMLInputElement | null>(null);

  const [mobileNumber, setMobileNumber] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [bloodGroup, setBloodGroup] = useState('');

  // Academic / Current Student Verification State
  const [passingYear, setPassingYear] = useState('2015');
  const [lastClassAttended, setLastClassAttended] = useState('SSC');
  const [currentClass, setCurrentClass] = useState('Class 10');
  const [studentId, setStudentId] = useState('');
  const [idVerificationResult, setIdVerificationResult] = useState<StudentIdVerificationResult | null>(null);
  const [isVerifyingId, setIsVerifyingId] = useState(false);
  const [batchNameInput, setBatchNameInput] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [groupOrSection, setGroupOrSection] = useState('Section A');
  const [tShirtSize, setTShirtSize] = useState<TShirtSize>('L');

  // Accompanying Parent / Guardian State
  const [hasParent, setHasParent] = useState(false);
  const [parentName, setParentName] = useState('');
  const [parentAge, setParentAge] = useState<number | ''>('');
  const [parentRelation, setParentRelation] = useState('Guardian');
  const [parentPhone, setParentPhone] = useState('');
  const [parentPhotoUrl, setParentPhotoUrl] = useState('');
  const [parentPhotoStoragePath, setParentPhotoStoragePath] = useState<string | null>(null);
  const [isUploadingParentPhoto, setIsUploadingParentPhoto] = useState(false);
  const [isParentCameraOpen, setIsParentCameraOpen] = useState(false);
  const parentPhotoFileRef = useRef<HTMLInputElement | null>(null);

  // Manual Payment Section (Cash, bKash, Bank Transfer)
  const [paymentMethod, setPaymentMethod] = useState<ManualPaymentMethod>('Cash');
  const [submittedAmount, setSubmittedAmount] = useState<string>(String(feeSettings.formerStudentFee || 1500));
  const [transactionOrTokenId, setTransactionOrTokenId] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [documentName, setDocumentName] = useState('');
  const [documentUrl, setDocumentUrl] = useState('');
  const [notes, setNotes] = useState('');

  // Modals & Processing
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [modalInitialImage, setModalInitialImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, { en: string; bn: string }>>({});
  const [generatedRegistration, setGeneratedRegistration] = useState<RegistrationRecord | null>(null);
  const [showTicketModal, setShowTicketModal] = useState(false);

  // Staff Restricted Edit Modal (Name & Mobile ONLY)
  const [staffEditRecord, setStaffEditRecord] = useState<RegistrationRecord | null>(null);
  const [editName, setEditName] = useState('');
  const [editMobile, setEditMobile] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccessMsg, setEditSuccessMsg] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Parent eligibility rule (matches Main Registration Portal)
  const effectiveCurrentClass =
    category === 'current' && idVerificationResult?.record?.className
      ? idVerificationResult.record.className
      : currentClass;
  const isParentEligible = isGuardianEligible(category, gender, effectiveCurrentClass);
  const effectiveHasParent = isParentEligible && hasParent;

  const calculatedFees = useMemo(
    () => calculateTotalFee(category, feeSettings, 0, effectiveHasParent),
    [category, feeSettings, effectiveHasParent]
  );

  // Keep default payment amount synced to calculated registration fee until edited
  const [amountManuallyEdited, setAmountManuallyEdited] = useState(false);
  useEffect(() => {
    if (!amountManuallyEdited) {
      setSubmittedAmount(String(calculatedFees.totalPayable));
    }
  }, [calculatedFees.totalPayable, amountManuallyEdited]);

  const computedBatchName = useMemo(() => {
    if (batchNameInput.trim()) return batchNameInput.trim();
    if (category === 'former') {
      return passingYear ? `SSC ${passingYear}` : 'Alumni';
    }
    return `${effectiveCurrentClass} (${groupOrSection || passingYear || '2026'})`;
  }, [batchNameInput, category, passingYear, effectiveCurrentClass, groupOrSection]);

  // Duplicate check across BOTH Main Registration DB and Manual Registration DB
  const duplicateWarning = useMemo(() => {
    if (!mobileNumber.trim()) return null;
    const cleanPhone = normalizeBangladeshiMobileNumber(mobileNumber.trim());
    if (cleanPhone.length < 11) return null;
    const allCombined = [
      ...AppStore.getRegistrations(),
      ...ManualRegistrationService.getManualRegistrations().filter(
        (r) => r.registrationApprovalStatus !== 'rejected'
      ),
    ];
    const match = allCombined.find(
      (r) => normalizeBangladeshiMobileNumber(r.mobileNumber) === cleanPhone
    );
    if (match) {
      return isBangla
        ? `সতর্কতা: এই মোবাইল নম্বরে (${mobileNumber}) ইতোমধ্যে একজন শিক্ষার্থী নিবন্ধিত: ${match.fullName} (আইডি: ${match.id})`
        : `Warning: Mobile ${mobileNumber} is already registered for ${match.fullName} (ID: ${match.id})`;
    }
    return null;
  }, [mobileNumber, isBangla]);

  const clearValidationError = (field: string) => {
    setValidationErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  // Current Student ID Database Lookup & Auto-fill (Same as Main Portal)
  const handleVerifyStudentId = async (idToVerify?: string) => {
    const rawId = (idToVerify !== undefined ? idToVerify : studentId).trim();
    if (!rawId) {
      setIdVerificationResult(null);
      return;
    }
    setIsVerifyingId(true);
    try {
      const res = await StudentIdService.verifyStudentIdAsync(rawId);

      // Also check if already present in Manual Registrations (pending or approved)
      const manualDup = ManualRegistrationService.getManualRegistrations().find(
        (r) =>
          r.registrationApprovalStatus !== 'rejected' &&
          r.studentId &&
          r.studentId.trim().toUpperCase() === rawId.toUpperCase()
      );
      if (manualDup) {
        setIdVerificationResult({
          success: false,
          status: 'ALREADY_USED',
          messageEn: `Student ID "${rawId.toUpperCase()}" already has a manual registration (${manualDup.id} — ${manualDup.registrationApprovalStatus?.toUpperCase()}).`,
          messageBn: `স্টুডেন্ট আইডি "${rawId.toUpperCase()}" এর বিপরীতে ইতোমধ্যে ম্যানুয়াল নিবন্ধন রয়েছে (${manualDup.id})।`,
        });
        return;
      }

      setIdVerificationResult(res);
      if (res.success && res.record) {
        if (res.record.studentName) setFullName(res.record.studentName);
        if (res.record.className) setCurrentClass(res.record.className);
        if (res.record.academicYear) {
          setPassingYear(res.record.academicYear);
          setBatchNameInput(`${res.record.className} (${res.record.academicYear})`);
        } else if (res.record.className) {
          setBatchNameInput(res.record.className);
        }
        if (res.record.phone && !mobileNumber) {
          setMobileNumber(res.record.phone);
        }
        setValidationErrors((prev) => {
          const next = { ...prev };
          delete next.studentId;
          delete next.fullName;
          delete next.currentClass;
          return next;
        });
      }
    } finally {
      setIsVerifyingId(false);
    }
  };

  const handleResetForm = () => {
    setFullName('');
    setFullNameBn('');
    setMobileNumber('');
    setEmail('');
    setAddress('');
    setGender('male');
    setBloodGroup('');
    setStudentId('');
    setIdVerificationResult(null);
    setBatchNameInput('');
    setRollNumber('');
    setPassingYear('2015');
    setLastClassAttended('SSC');
    setCurrentClass('Class 10');
    setNotes('');
    setHasParent(false);
    setParentName('');
    setParentAge('');
    setParentRelation('Guardian');
    setParentPhone('');
    setParentPhotoUrl('');
    setParentPhotoStoragePath(null);
    setPaymentMethod('Cash');
    setAmountManuallyEdited(false);
    setSubmittedAmount(String(calculateTotalFee(category, feeSettings, 0, false).totalPayable));
    setTransactionOrTokenId('');
    setPaymentNotes('');
    setDocumentName('');
    setDocumentUrl('');
    setPhotoUrl('');
    setPhotoStoragePath(null);
    setErrorMessage(null);
    setValidationErrors({});
    if (photoFileInputRef.current) photoFileInputRef.current.value = '';
    if (parentPhotoFileRef.current) parentPhotoFileRef.current.value = '';
  };

  // Student Photo Upload + Camera Adjuster
  const handlePhotoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const validDataUrl = await readValidatedImage(file);
      setModalInitialImage(validDataUrl);
      setIsCameraOpen(true);
    } catch (err: any) {
      setErrorMessage(err?.message || (isBangla ? 'ছবি ফাইল সঠিক নয়।' : 'Invalid image file.'));
    } finally {
      e.target.value = '';
    }
  };

  const handleStudentPhotoConfirmed = async (confirmedDataUrl: string) => {
    setIsCameraOpen(false);
    setModalInitialImage(null);
    setIsUploadingPhoto(true);
    setErrorMessage(null);
    try {
      const compressed = await compressImageTo200KB(confirmedDataUrl);
      const res = await StudentPhotoStorageService.uploadStudentPhoto({
        fileOrDataUrl: compressed.dataUrl,
        registrationId: studentId.trim() || `VENUE-${Date.now()}`,
        batchYear: passingYear || undefined,
        category,
        currentClass: effectiveCurrentClass || undefined,
        isParent: false,
      });
      if (res.success && res.publicUrl) {
        setPhotoUrl(res.publicUrl);
        setPhotoStoragePath(res.storagePath || null);
        clearValidationError('photoUrl');
      } else {
        // Resilient fallback to compressed data URL if storage bucket offline
        setPhotoUrl(compressed.dataUrl);
        clearValidationError('photoUrl');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error uploading student photo.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  // Parent Photo Upload & Camera
  const handleParentPhotoConfirmed = async (confirmedDataUrl: string) => {
    setIsParentCameraOpen(false);
    setIsUploadingParentPhoto(true);
    try {
      const compressed = await compressImageTo200KB(confirmedDataUrl);
      const res = await StudentPhotoStorageService.uploadStudentPhoto({
        fileOrDataUrl: compressed.dataUrl,
        registrationId: studentId.trim() || `VENUE-${Date.now()}`,
        batchYear: passingYear || undefined,
        category,
        currentClass: effectiveCurrentClass || undefined,
        isParent: true,
      });
      if (res.success && res.publicUrl) {
        setParentPhotoUrl(res.publicUrl);
        setParentPhotoStoragePath(res.storagePath || null);
      } else {
        setParentPhotoUrl(compressed.dataUrl);
      }
      clearValidationError('parentPhotoUrl');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error uploading guardian photo.');
    } finally {
      setIsUploadingParentPhoto(false);
    }
  };

  const handleParentPhotoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const validDataUrl = await readValidatedImage(file);
      await handleParentPhotoConfirmed(validDataUrl);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Invalid guardian photo.');
    } finally {
      e.target.value = '';
    }
  };

  // Optional Payment Slip / Supporting Document Upload
  const handleDocumentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setDocumentName(file.name);
      const reader = new FileReader();
      reader.onload = () => {
        setDocumentUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Live Card Preview Object
  const previewStudentRecord: StudentIdCardRecord = {
    id: `IDC-VENUE-PREVIEW`,
    registrationId: 'PLSCF-2027-PREVIEW',
    eventYear: 2027,
    studentName: fullName || 'Attendee',
    studentNameBn: fullNameBn || undefined,
    batchYear: passingYear || '2027',
    batchName: computedBatchName,
    idNumber: studentId || 'VENUE-REG',
    contactNumber: mobileNumber || '01700000000',
    hasPhoto: Boolean(photoUrl),
    photoUrl: photoUrl,
    qrToken: 'TMP001',
    verificationUrl: '',
    cardStatus: 'ELIGIBLE',
    category,
    gender,
    bloodGroup,
    hasParent: effectiveHasParent,
    parentName: effectiveHasParent ? parentName : undefined,
    parentPhone: effectiveHasParent ? parentPhone : undefined,
    parentRelation: effectiveHasParent ? parentRelation : undefined,
    parentPhotoUrl: effectiveHasParent ? parentPhotoUrl : undefined,
    cardDimensions: '54x86mm',
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // ── Submit Handler ──────────────────────────────────────────────────────────
  const handleGenerateTicket = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (isUploadingPhoto || isUploadingParentPhoto) {
      setErrorMessage(
        isBangla ? 'ছবি আপলোড সম্পন্ন হওয়া পর্যন্ত অপেক্ষা করুন।' : 'Please wait for photo upload to finish.'
      );
      return;
    }

    const formData: RegistrationFormData = {
      fullName: fullName.trim(),
      photoUrl,
      photoStoragePath: photoStoragePath || undefined,
      mobileNumber: mobileNumber.trim(),
      email: email.trim() || undefined,
      address: address.trim() || 'Faridpur',
      gender,
      bloodGroup,
      hasParent: effectiveHasParent,
      parentName: effectiveHasParent ? parentName.trim() : undefined,
      parentAge: effectiveHasParent && parentAge ? Number(parentAge) : undefined,
      parentPhone: effectiveHasParent ? parentPhone.trim() : undefined,
      parentRelation: effectiveHasParent ? parentRelation : undefined,
      parentPhotoUrl: effectiveHasParent ? parentPhotoUrl : undefined,
      parentPhotoStoragePath: effectiveHasParent ? parentPhotoStoragePath || undefined : undefined,
      category,
      studentId: category === 'current' ? studentId.trim().toUpperCase() : undefined,
      passingYear: category === 'former' ? passingYear : undefined,
      lastClassAttended: category === 'former' ? lastClassAttended : undefined,
      currentClass: category === 'current' ? effectiveCurrentClass : undefined,
      batchName: computedBatchName,
      groupOrSection: category === 'current' ? groupOrSection : undefined,
      rollNumber: category === 'current' ? rollNumber : undefined,
      tShirtSize,
      donationAmount: 0,
      termsAccepted: true,
    };

    const result = validateRegistrationData(formData);
    const customErrors: Record<string, { en: string; bn: string }> = { ...result.errors };

    // Current student ID database verification requirement
    if (category === 'current') {
      if (!studentId.trim()) {
        customErrors.studentId = {
          en: 'Student ID is mandatory for current students.',
          bn: 'বর্তমান শিক্ষার্থীদের জন্য স্টুডেন্ট আইডি প্রদান আবশ্যক।',
        };
      } else if (!idVerificationResult?.success) {
        const check = StudentIdService.verifyStudentId(studentId);
        if (!check.success || check.status !== 'AVAILABLE') {
          customErrors.studentId = {
            en: check.messageEn || 'Please click "Verify ID" to load official student details.',
            bn: check.messageBn || 'অফিসিয়াল তথ্য লোড করতে "আইডি যাচাই করুন" বাটনে ক্লিক করুন।',
          };
        }
      }
    }

    // Manual Payment Validation (Cash vs bKash vs Bank Transfer)
    const amtNum = Number(submittedAmount) || 0;
    if (paymentMethod === 'Cash') {
      if (amtNum <= 0) {
        customErrors.paymentAmount = {
          en: 'Please enter the cash amount received (must be > ৳0).',
          bn: 'প্রাপ্ত নগদ টাকার পরিমাণ লিখুন (০ এর বেশি হতে হবে)।',
        };
      }
    } else {
      if (!transactionOrTokenId.trim()) {
        customErrors.transactionId = {
          en: `Transaction ID or Payment Token ID is mandatory for ${paymentMethod}.`,
          bn: `${paymentMethod}-এর জন্য ট্রানজেকশন আইডি বা পেমেন্ট টোকেন আইডি প্রদান বাধ্যতামূলক।`,
        };
      }
      if (amtNum <= 0) {
        customErrors.paymentAmount = {
          en: `Please enter the ${paymentMethod} payment amount.`,
          bn: `${paymentMethod} পেমেন্টের পরিমাণ লিখুন।`,
        };
      }
    }

    if (Object.keys(customErrors).length > 0) {
      setValidationErrors(customErrors);
      const firstKey = Object.keys(customErrors)[0];
      setErrorMessage(customErrors[firstKey][language]);
      return;
    }

    setValidationErrors({});
    setIsSubmitting(true);

    try {
      const input: ManualRegistrationInput = {
        fullName: formData.fullName,
        fullNameBn: fullNameBn.trim() || undefined,
        photoUrl: formData.photoUrl,
        photoStoragePath: formData.photoStoragePath,
        mobileNumber: formData.mobileNumber,
        email: formData.email,
        category,
        studentId: formData.studentId,
        passingYear: formData.passingYear,
        lastClassAttended: formData.lastClassAttended,
        currentClass: formData.currentClass,
        batchName: formData.batchName,
        groupOrSection: formData.groupOrSection,
        rollNumber: formData.rollNumber,
        tShirtSize,
        address: formData.address,
        gender,
        bloodGroup,
        hasParent: effectiveHasParent,
        parentName: formData.parentName,
        parentAge: formData.parentAge,
        parentRelation: formData.parentRelation,
        parentPhone: formData.parentPhone,
        parentPhotoUrl: formData.parentPhotoUrl,
        parentPhotoStoragePath: formData.parentPhotoStoragePath,
        parentFee: calculatedFees.parentFee,
        registrationFee: calculatedFees.registrationFee,
        notes: notes.trim() || undefined,
        documentUrl: documentUrl || undefined,
        documentName: documentName || undefined,
        financialAmount: amtNum,
        financialDescription: `${paymentMethod} manual registration payment at Desk`,
        financialMethod: paymentMethod,
        financialReference: transactionOrTokenId.trim() || undefined,
        financialNotes: paymentNotes.trim() || undefined,
      };

      const res = await ManualRegistrationService.createManualRegistration(input, {
        id: currentAdmin.id,
        name: currentAdmin.fullName || currentAdmin.username,
      });

      if (res.success && res.registration) {
        setGeneratedRegistration(res.registration);
        setShowTicketModal(true);
        handleResetForm();
        refreshStaffList(false);
      } else {
        setErrorMessage(res.error || 'Failed to submit manual registration.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'System error during manual registration submission.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Restricted Staff Edit (ONLY Student Name & Mobile Number allowed)
  const openStaffEdit = (rec: RegistrationRecord) => {
    setStaffEditRecord(rec);
    setEditName(rec.fullName || '');
    setEditMobile(rec.mobileNumber || '');
    setEditError(null);
    setEditSuccessMsg(null);
  };

  const handleSaveStaffEdit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!staffEditRecord) return;
    setIsSavingEdit(true);
    setEditError(null);

    const res = await ManualRegistrationService.staffUpdateStudentDetails(
      staffEditRecord.id,
      { fullName: editName, mobileNumber: editMobile },
      {
        id: currentAdmin.id,
        name: currentAdmin.fullName || currentAdmin.username,
        role: currentAdmin.role,
      }
    );

    if (res.success) {
      setEditSuccessMsg(
        isBangla ? 'নাম ও মোবাইল নম্বর সফলভাবে আপডেট হয়েছে।' : 'Name and mobile number updated successfully.'
      );
      refreshStaffList(false);
      setTimeout(() => {
        setStaffEditRecord(null);
        setEditSuccessMsg(null);
      }, 900);
    } else {
      setEditError(res.error || 'Update failed.');
    }
    setIsSavingEdit(false);
  };

  const passingYears: number[] = [];
  for (let y = 2026; y >= 1962; y--) passingYears.push(y);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* ── Top Banner + Dynamic Staff Dashboard Metrics ── */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-7 text-white shadow-xl border border-indigo-800/40 relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                <span>{isBangla ? 'রেজিস্ট্রেশন ডেস্ক পোর্টাল' : 'REGISTRATION DESK PORTAL'}</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/25 text-indigo-200 text-[10px] font-bold border border-indigo-400/30">
                {isBangla ? 'পৃথক ম্যানুয়াল ডাটাবেজ • সুপার অ্যাডমিন অনুমোদন সাপেক্ষ' : 'Dedicated Manual DB • Pending Super Admin Approval'}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight">
              {isBangla ? 'ম্যানুয়াল শিক্ষার্থী নিবন্ধন ও কার্ড ডেস্ক' : 'Manual Student Registration & Card Desk'}
            </h2>
            <p className="text-xs text-indigo-200/80 max-w-2xl">
              {isBangla
                ? 'মূল নিবন্ধন ফর্মের অনুরূপ সকল তথ্য দিয়ে নিবন্ধন করুন এবং সাথে সাথেই কার্ড প্রিন্ট করুন। সুপার অ্যাডমিন পেমেন্ট যাচাই ও অনুমোদন করলে QR কোড স্বয়ংক্রিয়ভাবে সক্রিয় হবে।'
                : 'Uses the complete registration workflow & card generator. Cards can be printed immediately while QR activation waits for Super Admin payment verification & approval.'}
            </p>
          </div>

          {/* Desk Operator Badge + Sub-Tab Switcher */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <div className="flex items-center gap-2 bg-slate-800/80 px-3.5 py-2.5 rounded-2xl border border-slate-700/70">
              <Lock className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="text-xs">
                <span className="block text-slate-400 text-[10px]">
                  {isBangla ? 'ডেস্ক কর্মকর্তা:' : 'Desk Staff ID:'}
                </span>
                <span className="font-bold text-white">
                  {currentAdmin.fullName || currentAdmin.username}
                </span>
              </div>
            </div>

            <div className="inline-flex p-1 rounded-2xl bg-slate-950/60 border border-slate-700/70">
              <button
                type="button"
                onClick={() => setSubView('form')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${subView === 'form'
                  ? 'bg-sky-500 text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white'
                  }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{isBangla ? 'নতুন নিবন্ধন' : 'New Registration'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSubView('myRegistrations');
                  refreshStaffList(true);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${subView === 'myRegistrations'
                  ? 'bg-amber-400 text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white'
                  }`}
              >
                <ListChecks className="w-3.5 h-3.5" />
                <span>
                  {isSuperAdmin
                    ? isBangla
                      ? `সকল ম্যানুয়াল (${staffStats.total})`
                      : `All Manual (${staffStats.total})`
                    : isBangla
                      ? `আমার নিবন্ধন (${staffStats.total})`
                      : `My Registrations (${staffStats.total})`}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic Staff Statistics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-5 pt-5 border-t border-white/10">
          <div className="bg-white/5 rounded-2xl p-3 border border-white/10">
            <span className="text-[10px] font-bold text-slate-300 uppercase block">
              {isBangla ? 'মোট নিবন্ধন' : 'Total Created'}
            </span>
            <span className="text-xl font-black text-white mt-0.5 block">{staffStats.total}</span>
          </div>
          <div className="bg-white/5 rounded-2xl p-3 border border-white/10">
            <span className="text-[10px] font-bold text-amber-300 uppercase block">
              {isBangla ? 'অনুমোদন অপেক্ষমান' : 'Pending Approval'}
            </span>
            <span className="text-xl font-black text-amber-300 mt-0.5 block">{staffStats.pendingReg}</span>
          </div>
          <div className="bg-white/5 rounded-2xl p-3 border border-white/10">
            <span className="text-[10px] font-bold text-sky-300 uppercase block">
              {isBangla ? 'পেমেন্ট অপেক্ষমান' : 'Payment Pending'}
            </span>
            <span className="text-xl font-black text-sky-300 mt-0.5 block">{staffStats.pendingPaymentCount}</span>
          </div>
          <div className="bg-white/5 rounded-2xl p-3 border border-white/10">
            <span className="text-[10px] font-bold text-emerald-300 uppercase block">
              {isBangla ? 'অনুমোদিত' : 'Approved'}
            </span>
            <span className="text-xl font-black text-emerald-300 mt-0.5 block">{staffStats.approvedReg}</span>
          </div>
          <div className="bg-white/5 rounded-2xl p-3 border border-white/10 col-span-2 sm:col-span-1">
            <span className="text-[10px] font-bold text-rose-300 uppercase block">
              {isBangla ? 'প্রত্যাখ্যাত' : 'Rejected'}
            </span>
            <span className="text-xl font-black text-rose-300 mt-0.5 block">{staffStats.rejectedReg}</span>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* SUB-VIEW B: STAFF DESK REGISTRATIONS LIST & RESTRICTED MANAGEMENT     */}
      {/* ===================================================================== */}
      {subView === 'myRegistrations' && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={deskSearch}
                onChange={(e) => setDeskSearch(e.target.value)}
                placeholder={
                  isBangla
                    ? 'নাম, মোবাইল, রেজিস্ট্রেশন আইডি বা স্টুডেন্ট আইডি দিয়ে খুঁজুন...'
                    : 'Search by student name, mobile, registration ID, or student ID...'
                }
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <select
              value={deskStatusFilter}
              onChange={(e) => setDeskStatusFilter(e.target.value as any)}
              className="px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700"
            >
              <option value="all">{isBangla ? 'সকল স্ট্যাটাস' : 'All Statuses'}</option>
              <option value="pending">{isBangla ? '⏳ অপেক্ষমান' : '⏳ Pending Approval'}</option>
              <option value="approved">{isBangla ? '✅ অনুমোদিত' : '✅ Approved'}</option>
              <option value="rejected">{isBangla ? '❌ প্রত্যাখ্যাত' : '❌ Rejected'}</option>
            </select>

            <button
              type="button"
              onClick={() => refreshStaffList(true)}
              disabled={isSyncingList}
              className="px-4 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingList ? 'animate-spin' : ''}`} />
              <span>{isBangla ? 'রিফ্রেশ' : 'Refresh DB'}</span>
            </button>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            {filteredDeskRegistrations.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <User className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-sm font-bold text-slate-700">
                  {isBangla ? 'কোনো নিবন্ধন পাওয়া যায়নি' : 'No Registrations Found'}
                </p>
                <p className="text-xs text-slate-400">
                  {isBangla
                    ? 'আপনি এখনো কোনো ম্যানুয়াল নিবন্ধন তৈরি করেননি বা সার্চ ফলাফল খালি।'
                    : 'Your submitted manual registrations will appear here. Financial records are read-only.'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredDeskRegistrations.map((rec) => {
                  const regStatus = rec.registrationApprovalStatus || 'pending';
                  const finStatus = rec.financialApprovalStatus || 'pending';
                  const submittedAmt = Number(rec.financialAmount) || 0;
                  const approvedAmt = finStatus === 'approved' ? Number(rec.totalPaid) || submittedAmt : 0;

                  return (
                    <div
                      key={rec.id}
                      className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
                    >
                      <div className="flex items-start gap-3.5 min-w-0 flex-1">
                        <img
                          src={rec.photoUrl || DEFAULT_STUDENT_AVATAR_PLACEHOLDER}
                          alt={rec.fullName}
                          className="w-12 h-12 rounded-2xl object-cover border border-slate-200 shrink-0"
                        />
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-black text-slate-900">{rec.fullName}</span>
                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                              {rec.id}
                            </span>
                            {rec.studentId && (
                              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                                SID: {rec.studentId}
                              </span>
                            )}
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200 uppercase">
                              {rec.category === 'current' ? 'Current' : 'Alumni'}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                            <span className="font-mono">{rec.mobileNumber}</span>
                            <span>•</span>
                            <span>{rec.batchName}</span>
                            <span>•</span>
                            <span>
                              {rec.financialMethod || 'Cash'}: ৳{submittedAmt.toLocaleString()}
                              {rec.financialReference ? ` (${rec.financialReference})` : ''}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-[11px] pt-1">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg font-bold border ${regStatus === 'approved'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : regStatus === 'rejected'
                                  ? 'bg-rose-50 text-rose-800 border-rose-200'
                                  : 'bg-amber-50 text-amber-900 border-amber-200'
                                }`}
                            >
                              {regStatus === 'approved' ? (
                                <CheckCircle2 className="w-3 h-3" />
                              ) : regStatus === 'rejected' ? (
                                <XCircle className="w-3 h-3" />
                              ) : (
                                <Clock className="w-3 h-3" />
                              )}
                              <span>
                                Reg: {regStatus === 'approved' ? 'Approved (QR Active)' : regStatus === 'rejected' ? 'Rejected' : 'Pending Approval'}
                              </span>
                            </span>

                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg font-bold border ${finStatus === 'approved'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : finStatus === 'rejected'
                                  ? 'bg-rose-50 text-rose-800 border-rose-200'
                                  : 'bg-indigo-50 text-indigo-800 border-indigo-200'
                                }`}
                            >
                              <DollarSign className="w-3 h-3" />
                              <span>
                                {finStatus === 'approved'
                                  ? `Approved Amount: ৳${approvedAmt.toLocaleString()}`
                                  : finStatus === 'rejected'
                                    ? 'Payment Rejected'
                                    : 'Payment: Pending Verification'}
                              </span>
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setGeneratedRegistration(rec);
                            setShowTicketModal(true);
                          }}
                          className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5 text-sky-400" />
                          <span>{isBangla ? 'কার্ড / প্রিন্ট' : 'Card & Print'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => openStaffEdit(rec)}
                          className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer border border-slate-200"
                          title="Staff may edit Student Name & Mobile Number only"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>{isBangla ? 'নাম/মোবাইল সংশোধন' : 'Edit Name/Mobile'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-VIEW A: FULL MANUAL REGISTRATION FORM                             */}
      {/* ===================================================================== */}
      {subView === 'form' && (
        <>
          {duplicateWarning && (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex items-start gap-3 text-amber-950 text-xs shadow-xs">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-extrabold block">
                  {isBangla ? 'সম্ভাব্য ডুপ্লিকেট সতর্কতা' : 'Duplicate Record Alert'}
                </span>
                <p className="text-amber-900 mt-0.5">{duplicateWarning}</p>
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-4 flex items-start gap-3 text-rose-950 text-xs shadow-xs">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-extrabold block">{isBangla ? 'ত্রুটি' : 'Submission Notice'}</span>
                <p className="text-rose-900 mt-0.5">{errorMessage}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleGenerateTicket} className="space-y-6" noValidate>
            {/* ── Step 0: Category Selection (Same Fees & Rules as Main Portal) ── */}
            <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                  {isBangla ? 'নিবন্ধনের ধরন নির্বাচন করুন *' : 'Select Registration Category *'}
                </h3>
                <span className="text-[11px] font-semibold text-slate-500">
                  {isBangla ? 'মূল পোর্টালের নিয়ম অনুযায়ী' : 'Synced with Main Portal Rules'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setCategory('former');
                    setIdVerificationResult(null);
                    setValidationErrors({});
                  }}
                  className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer ${category === 'former'
                    ? 'border-[#0284C7] bg-[#E2EEF8]/40 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#0F172A] text-base">
                      {isBangla ? 'প্রাক্তন শিক্ষার্থী (Alumni)' : 'Former Student (Alumni)'}
                    </span>
                    <span className="px-3 py-1 rounded-full bg-[#0284C7] text-white font-extrabold text-xs">
                      ৳ {feeSettings.formerStudentFee}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {isBangla
                      ? '১৯৬২ থেকে ২০২৬ সাল পর্যন্ত সকল পাসের ব্যাচ'
                      : 'All alumni batches from 1962 to 2026'}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCategory('current');
                    setValidationErrors({});
                  }}
                  className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer ${category === 'current'
                    ? 'border-[#0EA5E9] bg-[#E2EEF8]/40 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#0F172A] text-base">
                      {isBangla ? 'বর্তমান শিক্ষার্থী (Current Student)' : 'Current Student'}
                    </span>
                    <span className="px-3 py-1 rounded-full bg-[#0EA5E9] text-white font-extrabold text-xs">
                      ৳ {feeSettings.currentStudentFee}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {isBangla
                      ? 'বিদ্যালয় ও কলেজ শাখায় বর্তমানে অধ্যয়নরত শিক্ষার্থী (আইডি আবশ্যক)'
                      : 'Currently enrolled students (School Student ID verification required)'}
                  </p>
                </button>
              </div>
            </div>

            {/* ── Step 1 (Current Student): Database Student ID Verification & Auto-fill ── */}
            {category === 'current' && (
              <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-xs border border-slate-200 space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-5 h-5 text-[#0284C7]" />
                    <h3 className="text-base font-bold text-slate-900">
                      {isBangla
                        ? '১. প্রাতিষ্ঠানিক তথ্য ও স্টুডেন্ট আইডি যাচাই'
                        : '1. Academic Information & Student ID Verification'}
                    </h3>
                  </div>
                  <span className="text-[11px] font-bold text-[#0284C7] bg-[#E2EEF8] px-2.5 py-1 rounded-full border border-[#0284C7]/20 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>{isBangla ? 'ডাটাবেজ অটো-ফিল' : 'Database Auto-fill'}</span>
                  </span>
                </div>

                {!idVerificationResult?.success ? (
                  <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {isBangla
                        ? 'শিক্ষার্থীর প্রাতিষ্ঠানিক স্টুডেন্ট আইডি বা টোকেন আইডি লিখুন। স্কুল ডাটাবেজ থেকে নাম, শ্রেণি এবং শিক্ষাবর্ষ স্বয়ংক্রিয়ভাবে লোড হবে।'
                        : 'Enter the student’s institutional Student ID. Official full name, enrolled class, and academic year will be retrieved automatically from the current student database.'}
                    </p>

                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <School className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                        <input
                          type="text"
                          value={studentId}
                          onChange={(e) => {
                            setStudentId(e.target.value.toUpperCase());
                            clearValidationError('studentId');
                            if (idVerificationResult) setIdVerificationResult(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              if (studentId.trim() && !isVerifyingId) handleVerifyStudentId(studentId);
                            }
                          }}
                          placeholder="e.g. PLSC-2026-101"
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm font-mono uppercase bg-white focus:border-[#0284C7] focus:outline-hidden"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleVerifyStudentId(studentId)}
                        disabled={!studentId.trim() || isVerifyingId}
                        className="px-5 py-2.5 rounded-xl bg-[#0284C7] hover:bg-[#0EA5E9] text-white font-bold text-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {isVerifyingId ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Search className="w-3.5 h-3.5" />
                        )}
                        <span>{isBangla ? 'আইডি যাচাই করুন' : 'Verify ID'}</span>
                      </button>
                    </div>

                    <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-slate-700">
                        {isBangla ? 'নমুনা আইডি:' : 'Sample IDs:'}
                      </span>
                      {['PLSC-2026-101', 'PLSC-2026-104', 'PLSC-2026-105'].map((demoId) => (
                        <button
                          key={demoId}
                          type="button"
                          onClick={() => {
                            setStudentId(demoId);
                            handleVerifyStudentId(demoId);
                          }}
                          className="px-2 py-0.5 rounded bg-slate-200 hover:bg-slate-300 font-mono text-[10px] text-slate-700 cursor-pointer"
                        >
                          {demoId}
                        </button>
                      ))}
                    </div>

                    {idVerificationResult && !idVerificationResult.success && (
                      <div className="p-3.5 rounded-xl text-xs flex items-start gap-2 border bg-rose-50 border-rose-300 text-rose-800">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <span className="font-bold">
                          {isBangla ? idVerificationResult.messageBn : idVerificationResult.messageEn}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-2xl border-2 border-emerald-400 bg-gradient-to-br from-emerald-50/80 via-white to-sky-50/60 p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-200/60 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-xs font-black uppercase tracking-wider text-emerald-900 block">
                            {isBangla ? 'যাচাইকৃত প্রাতিষ্ঠানিক শিক্ষার্থী রেকর্ড' : 'Verified Official Student Record'}
                          </span>
                          <p className="text-[11px] text-emerald-700 font-medium">
                            {isBangla
                              ? '🔒 ডাটাবেজ থেকে স্বয়ংক্রিয়ভাবে পূরণকৃত (অপরিবর্তনযোগ্য)'
                              : '🔒 Auto-filled from school database — Read-only'}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setIdVerificationResult(null);
                          setStudentId('');
                          setFullName('');
                          setCurrentClass('Class 10');
                          setBatchNameInput('');
                        }}
                        className="text-xs text-slate-500 hover:text-slate-800 font-semibold underline cursor-pointer self-start sm:self-auto"
                      >
                        {isBangla ? 'অন্য আইডি দিন' : 'Change Student ID'}
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="bg-white p-3 rounded-xl border border-emerald-200/70">
                        <span className="text-[10px] font-bold text-slate-500 uppercase block">
                          {isBangla ? 'শিক্ষার্থীর নাম' : 'Student Full Name'}
                        </span>
                        <span className="text-sm font-black text-slate-900 mt-1 block truncate">
                          {fullName}
                        </span>
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-emerald-200/70">
                        <span className="text-[10px] font-bold text-slate-500 uppercase block">
                          {isBangla ? 'স্টুডেন্ট আইডি' : 'Student ID'}
                        </span>
                        <span className="text-sm font-mono font-black text-[#0284C7] mt-1 block">
                          {studentId}
                        </span>
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-emerald-200/70">
                        <span className="text-[10px] font-bold text-slate-500 uppercase block">
                          {isBangla ? 'অধ্যয়নরত শ্রেণি' : 'Current Class'}
                        </span>
                        <span className="text-sm font-black text-slate-900 mt-1 block">
                          {effectiveCurrentClass}
                        </span>
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-emerald-200/70">
                        <span className="text-[10px] font-bold text-slate-500 uppercase block">
                          {isBangla ? 'শিক্ষাবর্ষ' : 'Academic Year'}
                        </span>
                        <span className="text-sm font-black text-slate-900 mt-1 block">
                          {idVerificationResult.record?.academicYear || passingYear || '2026'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Main Form Sections (Alumni always, Current Student once Verified) ── */}
            {(category === 'former' || (category === 'current' && idVerificationResult?.success)) && (
              <>
                <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
                  <div className="border-b border-slate-100 pb-3 flex items-center gap-2">
                    <User className="w-5 h-5 text-[#0284C7]" />
                    <h3 className="text-base font-bold text-slate-900">
                      {category === 'current'
                        ? isBangla
                          ? '২. যোগাযোগ, ছবি ও পরিচয় বিবরণী'
                          : '2. Contact, Photo & Identity Details'
                        : isBangla
                          ? '১. ব্যক্তিগত, ছবি ও একাডেমিক তথ্য'
                          : '1. Personal, Photo & Academic Details'}
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                    {/* Photo Upload & Live Camera (Mandatory) */}
                    <div className="flex flex-col items-center text-center space-y-3 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                      <div className="relative">
                        {photoUrl ? (
                          <img
                            src={photoUrl}
                            alt="Student Avatar"
                            className="w-32 h-32 rounded-2xl object-cover border-4 border-indigo-600 shadow-md bg-white"
                          />
                        ) : (
                          <div className="w-32 h-32 rounded-2xl bg-slate-200 border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-500">
                            <User className="w-10 h-10 text-slate-400" />
                            <span className="text-[10px] mt-1 font-medium">
                              {isBangla ? 'ছবি আবশ্যক *' : 'Photo Required *'}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2 w-full">
                        <button
                          type="button"
                          disabled={isUploadingPhoto}
                          onClick={() => {
                            setModalInitialImage(null);
                            setIsCameraOpen(true);
                          }}
                          className="w-full py-2 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span>{isBangla ? 'লাইভ ক্যামেরা' : 'Take Photo'}</span>
                        </button>

                        <label className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer inline-flex items-center justify-center gap-1.5 shadow-2xs">
                          <Upload className="w-3.5 h-3.5" />
                          <span>{isBangla ? 'ফাইল আপলোড' : 'Upload Photo'}</span>
                          <input
                            ref={photoFileInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={handlePhotoFileUpload}
                            className="hidden"
                            disabled={isUploadingPhoto}
                          />
                        </label>

                        {isUploadingPhoto && (
                          <div className="text-xs text-sky-700 font-semibold animate-pulse">
                            {isBangla ? 'আপলোড হচ্ছে...' : 'Uploading photo...'}
                          </div>
                        )}
                        {validationErrors.photoUrl && (
                          <p className="text-[11px] text-rose-600 font-bold">
                            {validationErrors.photoUrl[language]}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Input Fields */}
                    <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {category === 'former' && (
                        <>
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                              {isBangla ? 'পূর্ণ নাম (ইংরেজি)' : 'Full Name (English)'}{' '}
                              <span className="text-rose-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={fullName}
                              onChange={(e) => {
                                setFullName(e.target.value);
                                clearValidationError('fullName');
                              }}
                              placeholder="e.g. Md. Tanvir Hasan"
                              className="w-full px-3.5 py-2 rounded-xl text-xs border border-slate-300 bg-white focus:border-sky-500 focus:outline-hidden"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                              {isBangla ? 'পূর্ণ নাম (বাংলায় - ঐচ্ছিক)' : 'Full Name (Bengali - Optional)'}
                            </label>
                            <input
                              type="text"
                              value={fullNameBn}
                              onChange={(e) => setFullNameBn(e.target.value)}
                              placeholder="যেমন: মো: তানভীর হাসান"
                              className="w-full px-3.5 py-2 rounded-xl text-xs border border-slate-300 bg-white focus:border-sky-500 focus:outline-hidden"
                            />
                          </div>
                        </>
                      )}

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          {isBangla ? 'মোবাইল নম্বর (১১ ডিজিট)' : 'Mobile Number (11 Digits)'}{' '}
                          <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="tel"
                          inputMode="tel"
                          maxLength={11}
                          value={mobileNumber}
                          onChange={(e) => {
                            const digits = e.target.value.replace(/[^\d]/g, '').slice(0, 11);
                            setMobileNumber(digits);
                            clearValidationError('mobileNumber');
                          }}
                          placeholder="017XXXXXXXX"
                          className="w-full px-3.5 py-2 rounded-xl text-xs border border-slate-300 bg-white font-mono focus:border-sky-500 focus:outline-hidden"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          {isBangla ? 'ইমেইল ঠিকানা (ঐচ্ছিক)' : 'Email Address (Optional)'}
                        </label>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            clearValidationError('email');
                          }}
                          placeholder="student@example.com"
                          className="w-full px-3.5 py-2 rounded-xl text-xs border border-slate-300 bg-white focus:border-sky-500 focus:outline-hidden"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          {isBangla ? 'লিঙ্গ / Gender' : 'Gender'} <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={gender}
                          onChange={(e) => setGender(e.target.value as 'male' | 'female')}
                          className="w-full px-3.5 py-2 rounded-xl text-xs border border-slate-300 bg-white font-bold"
                        >
                          <option value="male">{isBangla ? 'পুরুষ (Male)' : 'Male'}</option>
                          <option value="female">{isBangla ? 'নারী (Female)' : 'Female'}</option>
                        </select>
                      </div>

                      <div>
                        <div className="text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                          <Droplet className="w-3.5 h-3.5 text-rose-600" />
                          <span>{isBangla ? 'রক্তের গ্রুপ' : 'Blood Group'}</span>
                          <span className="text-rose-500">*</span>
                        </div>
                        <select
                          value={bloodGroup}
                          onChange={(e) => {
                            setBloodGroup(e.target.value);
                            clearValidationError('bloodGroup');
                          }}
                          className="w-full px-3.5 py-2 rounded-xl text-xs border border-slate-300 bg-white font-bold"
                        >
                          <option value="">{isBangla ? 'নির্বাচন করুন' : 'Select Blood Group'}</option>
                          {BLOOD_GROUPS.map((bg) => (
                            <option key={bg} value={bg}>
                              {bg}
                            </option>
                          ))}
                        </select>
                      </div>

                      {category === 'former' ? (
                        <>
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                              {isBangla ? 'এসএসসি পাসের সাল / শেষ বর্ষ' : 'Passing / Last Attended Year'}{' '}
                              <span className="text-rose-500">*</span>
                            </label>
                            <select
                              value={passingYear}
                              onChange={(e) => setPassingYear(e.target.value)}
                              className="w-full px-3.5 py-2 rounded-xl text-xs border border-slate-300 bg-white font-mono font-bold"
                            >
                              {passingYears.map((y) => (
                                <option key={y} value={String(y)}>
                                  {y}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                              {isBangla ? 'সর্বশেষ শ্রেণি (ঐচ্ছিক)' : 'Last Class Attended (Optional)'}
                            </label>
                            <input
                              type="text"
                              value={lastClassAttended}
                              onChange={(e) => setLastClassAttended(e.target.value)}
                              placeholder="e.g. SSC / HSC / Class 8"
                              className="w-full px-3.5 py-2 rounded-xl text-xs border border-slate-300 bg-white"
                            />
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                              {isBangla ? 'শাখা / গ্রুপ (ঐচ্ছিক)' : 'Section / Group (Optional)'}
                            </label>
                            <input
                              type="text"
                              value={groupOrSection}
                              onChange={(e) => setGroupOrSection(e.target.value)}
                              placeholder="e.g. Section A"
                              className="w-full px-3.5 py-2 rounded-xl text-xs border border-slate-300 bg-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                              {isBangla ? 'রোল নম্বর (ঐচ্ছিক)' : 'Roll Number (Optional)'}
                            </label>
                            <input
                              type="text"
                              value={rollNumber}
                              onChange={(e) => setRollNumber(e.target.value)}
                              placeholder="e.g. 05"
                              className="w-full px-3.5 py-2 rounded-xl text-xs border border-slate-300 bg-white"
                            />
                          </div>
                        </>
                      )}

                      <div>
                        <div className="text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                          <Shirt className="w-3.5 h-3.5 text-indigo-600" />
                          <span>{isBangla ? 'টি-শার্ট সাইজ' : 'T-Shirt Size'}</span>
                          <span className="text-rose-500">*</span>
                        </div>
                        <select
                          value={tShirtSize}
                          onChange={(e) => setTShirtSize(e.target.value as TShirtSize)}
                          className="w-full px-3.5 py-2 rounded-xl text-xs border border-slate-300 bg-white font-bold"
                        >
                          {T_SHIRT_SIZES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          {isBangla ? 'বর্তমান ঠিকানা' : 'Current Address'}
                        </label>
                        <input
                          type="text"
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          placeholder="e.g. Faridpur Sadar"
                          className="w-full px-3.5 py-2 rounded-xl text-xs border border-slate-300 bg-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Accompanying Parent / Guardian Pass (Strict Eligibility Parity) ── */}
                {isParentEligible && (
                  <div className="bg-amber-50/70 rounded-3xl border-2 border-amber-300 p-6 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-200 pb-3">
                      <div className="flex items-center gap-2.5">
                        <Users className="w-5 h-5 text-amber-700" />
                        <div>
                          <h3 className="text-sm font-black text-slate-900">
                            {isBangla
                              ? 'অভিভাবক পাস (ঐচ্ছিক • +৳১,৫০০)'
                              : 'Accompanying Parent / Guardian Pass (Optional • +৳1,500)'}
                          </h3>
                          <p className="text-[11px] text-slate-600">
                            {isBangla
                              ? 'নারী শিক্ষার্থী বা ৬ষ্ঠ শ্রেণির নিচের শিক্ষার্থীদের জন্য সর্বোচ্চ ১ জন অভিভাবক।'
                              : 'Reserved for female students and current students below Class 6 (Max 1 Guardian).'}
                          </p>
                        </div>
                      </div>
                      <label className="inline-flex items-center gap-2 cursor-pointer bg-white px-3 py-2 rounded-xl border border-amber-300">
                        <input
                          type="checkbox"
                          checked={hasParent}
                          onChange={(e) => setHasParent(e.target.checked)}
                          className="w-4 h-4 rounded text-amber-600"
                        />
                        <span className="text-xs font-bold text-slate-800">
                          {isBangla ? 'অভিভাবক যুক্ত করুন' : 'Include 1 Parent (+৳1,500)'}
                        </span>
                      </label>
                    </div>

                    {hasParent && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            {isBangla ? 'অভিভাবকের নাম *' : 'Parent Full Name *'}
                          </label>
                          <input
                            type="text"
                            value={parentName}
                            onChange={(e) => setParentName(e.target.value)}
                            placeholder="e.g. Md. Abul Kalam"
                            className="w-full px-3 py-2 rounded-xl text-xs border border-amber-300 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            {isBangla ? 'সম্পর্ক *' : 'Relation *'}
                          </label>
                          <select
                            value={parentRelation}
                            onChange={(e) => setParentRelation(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl text-xs border border-amber-300 bg-white font-bold"
                          >
                            <option value="Guardian">Guardian</option>
                            <option value="Father">Father</option>
                            <option value="Mother">Mother</option>
                            <option value="Sister">Sister</option>
                            <option value="Brother">Brother</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            {isBangla ? 'বয়স *' : 'Age *'}
                          </label>
                          <input
                            type="number"
                            min={18}
                            max={100}
                            value={parentAge}
                            onChange={(e) =>
                              setParentAge(e.target.value === '' ? '' : Number(e.target.value))
                            }
                            placeholder="e.g. 45"
                            className="w-full px-3 py-2 rounded-xl text-xs border border-amber-300 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            {isBangla ? 'অভিভাবকের মোবাইল *' : 'Parent Mobile *'}
                          </label>
                          <input
                            type="tel"
                            maxLength={11}
                            value={parentPhone}
                            onChange={(e) =>
                              setParentPhone(e.target.value.replace(/[^\d]/g, '').slice(0, 11))
                            }
                            placeholder="017XXXXXXXX"
                            className="w-full px-3 py-2 rounded-xl text-xs border border-amber-300 bg-white font-mono"
                          />
                        </div>

                        <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap items-center gap-3 pt-1">
                          {parentPhotoUrl && (
                            <img
                              src={parentPhotoUrl}
                              alt="Parent"
                              className="w-12 h-14 rounded-xl object-cover border-2 border-amber-500"
                            />
                          )}
                          <button
                            type="button"
                            onClick={() => setIsParentCameraOpen(true)}
                            className="px-3 py-2 rounded-xl bg-emerald-700 text-white text-xs font-bold cursor-pointer inline-flex items-center gap-1.5"
                          >
                            <Camera className="w-3.5 h-3.5" />
                            <span>{isBangla ? 'অভিভাবকের ছবি তুলুন' : 'Parent Camera'}</span>
                          </button>
                          <label className="px-3 py-2 rounded-xl bg-amber-800 text-white text-xs font-bold cursor-pointer inline-flex items-center gap-1.5">
                            <Upload className="w-3.5 h-3.5" />
                            <span>{isBangla ? 'অভিভাবকের ছবি আপলোড *' : 'Upload Parent Photo *'}</span>
                            <input
                              ref={parentPhotoFileRef}
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              onChange={handleParentPhotoFileUpload}
                              className="hidden"
                            />
                          </label>
                          {isUploadingParentPhoto && (
                            <span className="text-xs font-semibold text-amber-800 animate-pulse">
                              Uploading guardian photo...
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Manual Payment Submission Section (Cash, bKash, Bank Transfer) ── */}
                <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-emerald-600" />
                        <span>
                          {isBangla
                            ? 'ম্যানুয়াল পেমেন্ট তথ্য প্রদান (সুপার অ্যাডমিন যাচাই সাপেক্ষ)'
                            : 'Manual Payment Submission (Super Admin Verification Required)'}
                        </span>
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {isBangla
                          ? 'Cash, bKash অথবা Bank Transfer মাধ্যম নির্বাচন করে তথ্য দিন। সুপার অ্যাডমিন ব্যাংক/অ্যাকাউন্ট স্টেটমেন্টের সাথে মিলিয়ে অনুমোদন করবেন।'
                          : 'Select Cash, bKash, or Bank Transfer. Submitted payments remain Pending Verification until verified by Super Admin.'}
                      </p>
                    </div>
                    <div className="px-3.5 py-2 rounded-2xl bg-slate-900 text-white text-xs font-bold shrink-0">
                      {isBangla ? 'প্রযোজ্য ফি:' : 'Expected Fee:'}{' '}
                      <span className="text-amber-300 font-black">
                        ৳{calculatedFees.totalPayable.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* 3 Required Payment Method Buttons */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {(
                      [
                        {
                          id: 'Cash' as const,
                          title: isBangla ? 'নগদ (Cash)' : 'Cash Payment',
                          sub: isBangla ? 'নগদ টাকার পরিমাণ লিখুন' : 'Enter cash received at desk',
                          icon: Banknote,
                        },
                        {
                          id: 'bKash' as const,
                          title: 'bKash',
                          sub: isBangla ? 'TrxID বাধ্যতামূলক • স্লিপ ঐচ্ছিক' : 'TrxID required • Slip optional',
                          icon: Smartphone,
                        },
                        {
                          id: 'Bank Transfer' as const,
                          title: isBangla ? 'ব্যাংক ট্রান্সফার (Bank Transfer)' : 'Bank Transfer',
                          sub: isBangla ? 'Trx/Token ID বাধ্যতামূলক • স্লিপ ঐচ্ছিক' : 'Trx/Token ID required • Slip optional',
                          icon: Building2,
                        },
                      ] as const
                    ).map((m) => {
                      const Icon = m.icon;
                      const active = paymentMethod === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            setPaymentMethod(m.id);
                            clearValidationError('transactionId');
                            clearValidationError('paymentAmount');
                          }}
                          className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer flex items-start gap-3 ${active
                            ? 'border-emerald-600 bg-emerald-50/60 shadow-xs'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                            }`}
                        >
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${active ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                              }`}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-black text-slate-900">{m.title}</div>
                            <div className="text-[11px] text-slate-500 mt-0.5">{m.sub}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Method-Specific Payment Inputs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        {paymentMethod === 'Cash'
                          ? isBangla
                            ? 'প্রাপ্ত নগদ টাকার পরিমাণ (BDT) *'
                            : 'Cash Amount Received (BDT) *'
                          : isBangla
                            ? 'প্রদানকৃত টাকার পরিমাণ (BDT) *'
                            : 'Submitted Payment Amount (BDT) *'}
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">৳</span>
                        <input
                          type="number"
                          min={1}
                          value={submittedAmount}
                          onChange={(e) => {
                            setAmountManuallyEdited(true);
                            setSubmittedAmount(e.target.value);
                            clearValidationError('paymentAmount');
                          }}
                          className="w-full pl-7 pr-3 py-2 rounded-xl text-xs border border-slate-300 bg-white font-bold tabular-nums"
                          required
                        />
                      </div>
                    </div>

                    {paymentMethod !== 'Cash' ? (
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          {isBangla
                            ? 'ট্রানজেকশন আইডি / পেমেন্ট টোকেন আইডি *'
                            : 'Transaction ID / Payment Token ID *'}
                        </label>
                        <input
                          type="text"
                          value={transactionOrTokenId}
                          onChange={(e) => {
                            setTransactionOrTokenId(e.target.value);
                            clearValidationError('transactionId');
                          }}
                          placeholder="e.g. BL78K9M21 / BANK-REF-902"
                          className="w-full px-3 py-2 rounded-xl text-xs border border-slate-300 bg-white font-mono"
                          required
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          {isBangla ? 'নগদ রসিদ নং (ঐচ্ছিক)' : 'Cash Receipt Ref (Optional)'}
                        </label>
                        <input
                          type="text"
                          value={transactionOrTokenId}
                          onChange={(e) => setTransactionOrTokenId(e.target.value)}
                          placeholder="e.g. CASH-REC-001"
                          className="w-full px-3 py-2 rounded-xl text-xs border border-slate-300 bg-white font-mono"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        {paymentMethod !== 'Cash'
                          ? isBangla
                            ? 'পেমেন্ট স্লিপ / স্ক্রিনশট (ঐচ্ছিক)'
                            : 'Payment Slip / Screenshot (Optional)'
                          : isBangla
                            ? 'প্রমাণক / ডকুমেন্ট (ঐচ্ছিক)'
                            : 'Supporting Slip / ID Copy (Optional)'}
                      </label>
                      <label className="w-full px-3 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-bold cursor-pointer inline-flex items-center justify-between gap-2">
                        <span className="truncate">
                          {documentName || (isBangla ? 'ফাইল নির্বাচন (ঐচ্ছিক)' : 'Attach Slip (Optional)')}
                        </span>
                        <Upload className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          onChange={handleDocumentUpload}
                          className="hidden"
                        />
                      </label>
                    </div>

                    <div className="sm:col-span-2 lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          {isBangla ? 'পেমেন্ট নোট (ঐচ্ছিক)' : 'Payment Remarks (Optional)'}
                        </label>
                        <input
                          type="text"
                          value={paymentNotes}
                          onChange={(e) => setPaymentNotes(e.target.value)}
                          placeholder="e.g. Collected at Registration Desk 01"
                          className="w-full px-3 py-2 rounded-xl text-xs border border-slate-300 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          {isBangla ? 'অতিরিক্ত মন্তব্য (ঐচ্ছিক)' : 'Registration Notes (Optional)'}
                        </label>
                        <input
                          type="text"
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Any additional desk note"
                          className="w-full px-3 py-2 rounded-xl text-xs border border-slate-300 bg-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Submit Buttons */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={handleResetForm}
                    className="w-full sm:w-auto px-5 py-3 rounded-2xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer"
                  >
                    {isBangla ? 'ফর্ম রিসেট করুন' : 'Reset Form'}
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-extrabold shadow-lg shadow-indigo-600/30 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>{isBangla ? 'সংরক্ষণ ও কার্ড তৈরি হচ্ছে...' : 'Submitting & Generating Card...'}</span>
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-4 h-4" />
                        <span>
                          {isBangla ? 'নিবন্ধন জমা ও কার্ড তৈরি করুন' : 'Submit Registration & Generate Card'}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </form>
        </>
      )}

      {/* ── Synchronized Camera Modal (Student) ── */}
      {isCameraOpen && (
        <SynchronizedCameraCardModal
          isOpen={isCameraOpen}
          onClose={() => {
            setIsCameraOpen(false);
            setModalInitialImage(null);
          }}
          onPhotoConfirmed={handleStudentPhotoConfirmed}
          language={language}
          initialImageUrl={modalInitialImage}
          cardType={category === 'former' ? 'alumni' : 'student'}
          studentPreview={previewStudentRecord}
        />
      )}

      {/* ── Synchronized Camera Modal (Parent) ── */}
      {isParentCameraOpen && (
        <SynchronizedCameraCardModal
          isOpen={isParentCameraOpen}
          onClose={() => setIsParentCameraOpen(false)}
          onPhotoConfirmed={handleParentPhotoConfirmed}
          language={language}
          isParentPass={true}
          cardType="parent"
          studentPreview={{
            ...previewStudentRecord,
            studentName: parentName || 'Guardian',
            photoUrl: parentPhotoUrl,
            hasPhoto: Boolean(parentPhotoUrl),
          }}
        />
      )}

      {/* ── Generated Card Preview & Immediate Print Modal ── */}
      {showTicketModal && generatedRegistration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[92vh] overflow-y-auto border border-slate-200 p-6 sm:p-8 space-y-5 relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-900 flex items-center justify-center shrink-0">
                  <QrCode className="w-5 h-5 text-amber-700" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    {isBangla ? 'শিক্ষার্থী কার্ড ও কিউআর প্রিভিউ' : 'Registration Card & QR Preview'}
                  </h3>
                  <p className="text-xs text-amber-800 font-bold">
                    {(generatedRegistration.registrationApprovalStatus || 'pending') === 'approved'
                      ? isBangla
                        ? '✅ সুপার অ্যাডমিন অনুমোদিত — কিউআর কোড সক্রিয়'
                        : '✅ Approved by Super Admin — QR Code Active'
                      : isBangla
                        ? '⏳ ম্যানুয়াল ডাটাবেজে সংরক্ষিত (অনুমোদনের অপেক্ষায়) — কার্ড এখনই প্রিন্ট করতে পারেন, অনুমোদনের পর QR সক্রিয় হবে'
                        : '⏳ Saved to Manual Database (Pending Approval) — You may print now; QR activates upon Super Admin approval'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTicketModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <TicketView
              registration={generatedRegistration}
              language={language}
              onNavigateHome={() => setShowTicketModal(false)}
            />
          </div>
        </div>
      )}

      {/* ── Restricted Staff Edit Modal (Student Name & Mobile Number ONLY) ── */}
      {staffEditRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  {isBangla ? 'শিক্ষার্থীর নাম ও মোবাইল সংশোধন' : 'Edit Student Contact Details'}
                </h3>
                <span className="text-[11px] text-slate-500 font-mono">{staffEditRecord.id}</span>
              </div>
              <button
                type="button"
                onClick={() => setStaffEditRecord(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
              {isBangla
                ? '🔒 আর্থিক তথ্য ও অনুমোদন স্ট্যাটাস সুরক্ষিত — ডেস্ক স্টাফ কেবল নাম ও মোবাইল নম্বর সংশোধন করতে পারবেন।'
                : '🔒 Financial amounts and approval statuses are protected. Desk staff may edit Student Name and Mobile Number only.'}
            </div>

            {editError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 font-semibold">
                {editError}
              </div>
            )}
            {editSuccessMsg && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-semibold">
                {editSuccessMsg}
              </div>
            )}

            <form onSubmit={handleSaveStaffEdit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isBangla ? 'শিক্ষার্থীর পূর্ণ নাম *' : 'Student Full Name *'}
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isBangla ? 'মোবাইল নম্বর (১১ ডিজিট) *' : 'Mobile Number (11 Digits) *'}
                </label>
                <input
                  type="tel"
                  required
                  maxLength={11}
                  value={editMobile}
                  onChange={(e) => setEditMobile(e.target.value.replace(/[^\d]/g, '').slice(0, 11))}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-mono font-semibold"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-0.5">
                <div>
                  <strong>{isBangla ? 'জমা পদ্ধতি:' : 'Payment:'}</strong>{' '}
                  {staffEditRecord.financialMethod || 'Cash'} • ৳
                  {(Number(staffEditRecord.financialAmount) || 0).toLocaleString()} (Read-only)
                </div>
                <div>
                  <strong>{isBangla ? 'অনুমোদিত পরিমাণ:' : 'Approved Amount:'}</strong>{' '}
                  {staffEditRecord.financialApprovalStatus === 'approved'
                    ? `৳${(Number(staffEditRecord.totalPaid) || 0).toLocaleString()}`
                    : 'Pending Verification (Read-only)'}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStaffEditRecord(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  {isBangla ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  {isSavingEdit ? 'Saving...' : isBangla ? 'আপডেট করুন' : 'Save Contact Info'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
