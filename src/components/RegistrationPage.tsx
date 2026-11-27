import React, { useState, useEffect, useRef } from 'react';
import {
  User,
  Upload,
  Phone,
  Mail,
  MapPin,
  GraduationCap,
  Shirt,
  Heart,
  AlertCircle,
  HelpCircle,
  Camera,
  Lock,
  CheckCircle2,
  ShieldCheck,
  Search,
  School,
  X,
  RefreshCw,
  Users,
  Droplet,
  HeartHandshake,
} from 'lucide-react';
import {
  StudentCategory,
  TShirtSize,
  Language,
  FeeSettings,
  GovernanceLoadStatus,
  StudentIdVerificationResult,
} from '../types';
import { translations } from '../i18n/translations';
import {
  validateRegistrationData,
  calculateTotalFee,
  calculateGatewayCharge,
  normalizeBangladeshiMobileNumber,
  RegistrationFormData,
  isStudentBelowClass6,
  isGlobalRegistrationOpen,
  isAlumniRegistrationOpen,
  isCurrentStudentRegistrationOpen,
  isCategoryRegistrationOpen,
  isDonationOpen,
  getRegistrationClosedMessage,
  getStructuredClosureNotice,
} from '../utils/rules';
import { StudentIdService } from '../services/studentIdStore';
import { readValidatedImage } from '../utils/fileValidation';
import { compressImageTo200KB } from '../utils/imageCompressor';
import { AppStore } from '../services/store';
import { isDevTestBypassAllowed } from '../services/supabase';
import { PayStationService } from '../services/paystation';
import { StudentPhotoStorageService, extractStoragePathFromPublicUrl } from '../services/studentPhotoStorageService';
import { StudentIdCardRecord } from '../types/idcard';
import { SynchronizedCameraCardModal } from './idcard/SynchronizedCameraCardModal';
import { GovernanceClosureNoticeCard } from './common/GovernanceClosureNoticeCard';

interface RegistrationPageProps {
  language: Language;
  feeSettings: FeeSettings;
  governanceStatus?: GovernanceLoadStatus;
  governanceError?: string | null;
  onRetryGovernance?: () => void;
  initialCategory?: StudentCategory;
  initialData?: RegistrationFormData | null;
  onInitiatePayment: (formData: RegistrationFormData, fees: { registrationFee: number; donationAmount: number; totalPayable: number }) => void;
  onNavigate: (view: string) => void;
  /** Name of the student who just paid — shows a success banner at the top of the form */
  lastRegisteredName?: string;
  /** Called when user clicks "View Ticket" in the success banner */
  onViewLastTicket?: () => void;
  /** Whether payment processing is active (prevents duplicate submission) */
  isProcessingPayment?: boolean;
}

export const RegistrationPage: React.FC<RegistrationPageProps> = ({
  language,
  feeSettings,
  governanceStatus = 'ready',
  governanceError = null,
  onRetryGovernance,
  initialCategory,
  initialData,
  onInitiatePayment,
  onNavigate: _onNavigate,
  lastRegisteredName,
  onViewLastTicket,
  isProcessingPayment,
}) => {
  const t = translations[language];

  // Helper to retrieve saved registration form draft
  // Preserves data across failures, cancellations, and external gateway redirects
  const getDraft = () => {
    if (initialData) return initialData;
    try {
      const raw = localStorage.getItem('plscf_registration_draft');
      if (raw) return JSON.parse(raw);
    } catch {}
    try {
      const session = PayStationService.getPendingSession();
      if (session?.formData) return session.formData;
    } catch {}
    return null;
  };
  const draft = React.useMemo(() => getDraft(), [initialData]);

  // Form State — initialized from saved draft if available
  const [fullName, setFullName] = useState(() => draft?.fullName || '');
  const [photoUrl, setPhotoUrl] = useState(() => draft?.photoUrl || '');
  const [photoStoragePath, setPhotoStoragePath] = useState<string | null>(() => draft?.photoStoragePath || extractStoragePathFromPublicUrl(draft?.photoUrl) || null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [mobileNumber, setMobileNumber] = useState(() => draft?.mobileNumber || '');
  const [email, setEmail] = useState(() => draft?.email || ''); // OPTIONAL
  const [address, setAddress] = useState(() => draft?.address || '');
  const [category, setCategory] = useState<StudentCategory>(
    () => initialCategory || draft?.category || 'former'
  );
  const [gender, setGender] = useState<'male' | 'female'>(() => draft?.gender || 'male');
  const [bloodGroup, setBloodGroup] = useState(() => draft?.bloodGroup || '');

  // Accompanying Parent / Guardian State (Allowed for females or current students below Class 6, max 1 parent, ৳1,500)
  const [hasParent, setHasParent] = useState(() => Boolean(draft?.hasParent));
  const [parentName, setParentName] = useState(() => draft?.parentName || '');
  const [parentAge, setParentAge] = useState<number | ''>(() => (typeof draft?.parentAge === 'number' ? draft.parentAge : ''));
  const [parentPhone, setParentPhone] = useState(() => draft?.parentPhone || '');
  const [parentRelation, setParentRelation] = useState(() => draft?.parentRelation || 'Guardian');
  const [parentPhotoUrl, setParentPhotoUrl] = useState(() => draft?.parentPhotoUrl || '');
  const [parentPhotoStoragePath, setParentPhotoStoragePath] = useState<string | null>(() => draft?.parentPhotoStoragePath || extractStoragePathFromPublicUrl(draft?.parentPhotoUrl) || null);
  const [isUploadingParentPhoto, setIsUploadingParentPhoto] = useState(false);
  const [parentPhotoSizeKb, setParentPhotoSizeKb] = useState<number | null>(null);
  const [isCompressingParentPhoto, setIsCompressingParentPhoto] = useState(false);
  const [isParentCameraModalOpen, setIsParentCameraModalOpen] = useState(false);
  const parentFileInputRef = useRef<HTMLInputElement>(null);
  const [registrationDraftId] = useState(() => `DRAFT-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`);

  // Academic Information
  const [passingYear, setPassingYear] = useState(() => draft?.passingYear || '2015'); // Mandatory for former
  const [lastClassAttended, setLastClassAttended] = useState(() => draft?.lastClassAttended || 'SSC'); // Optional for former
  const [currentClass, setCurrentClass] = useState(() => draft?.currentClass || 'Class 10'); // For current students
  const [studentId, setStudentId] = useState(() => draft?.studentId || ''); // Mandatory for current students
  const [idVerificationResult, setIdVerificationResult] = useState<StudentIdVerificationResult | null>(null);
  const [isVerifyingId, setIsVerifyingId] = useState(false);
  const [batchName, setBatchName] = useState(() => draft?.batchName || '');
  const [groupOrSection, setGroupOrSection] = useState(() => draft?.groupOrSection || 'Section A'); // For current students
  const [rollNumber, setRollNumber] = useState(() => draft?.rollNumber || '');

  // T-shirt & Donation
  const [tShirtSize, setTShirtSize] = useState<TShirtSize>(() => draft?.tShirtSize || 'L');
  const [donationInput, setDonationInput] = useState<number | ''>(() => (typeof draft?.donationInput === 'number' ? draft.donationInput : ''));
  const [termsAccepted, setTermsAccepted] = useState(true);

  // Submission & File Input States (Requirement 3 & 10)
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showSuccessBanner, setShowSuccessBanner] = useState(() => Boolean(lastRegisteredName));

  useEffect(() => {
    if (lastRegisteredName) {
      setShowSuccessBanner(true);
    }
  }, [lastRegisteredName]);

  useEffect(() => {
    if (!isProcessingPayment) {
      setIsSubmitting(false);
    }
  }, [isProcessingPayment]);

  // Synchronize student IDs with cloud database on registration portal mount
  useEffect(() => {
    StudentIdService.syncWithSupabase().catch(() => {});
  }, []);

  // Respect explicit route/card category selection so closed category notices display as intended
  useEffect(() => {
    if (initialCategory) {
      setCategory(initialCategory);
      if (initialCategory === 'former') {
        setIdVerificationResult(null);
      }
    }
  }, [initialCategory]);

  // Comprehensive form reset — clears all input fields, previews, file input, and state
  const resetForm = () => {
    setFullName('');
    setPhotoUrl('');
    setMobileNumber('');
    setEmail('');
    setAddress('');
    setCategory(initialCategory || 'former');
    setGender('male');
    setBloodGroup('');
    setHasParent(false);
    setParentName('');
    setParentAge('');
    setParentPhone('');
    setParentRelation('Guardian');
    setParentPhotoUrl('');
    setParentPhotoSizeKb(null);
    setIsCompressingParentPhoto(false);
    setIsParentCameraModalOpen(false);
    if (parentFileInputRef.current) {
      parentFileInputRef.current.value = '';
    }
    setPassingYear('2015');
    setLastClassAttended('SSC');
    setCurrentClass('Class 10');
    setStudentId('');
    setIdVerificationResult(null);
    setIsVerifyingId(false);
    setBatchName('');
    setGroupOrSection('Section A');
    setRollNumber('');
    setTShirtSize('L');
    setDonationInput('');
    setTermsAccepted(true);
    setPhotoSizeKb(null);
    setIsCompressingPhoto(false);
    setIsCameraModalOpen(false);
    setModalInitialImage(null);
    setValidationErrors({});
    setIsSubmitting(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    try {
      localStorage.removeItem('plscf_registration_draft');
    } catch {}
    try {
      PayStationService.clearPendingSession();
    } catch {}
  };

  // Auto-save form draft to localStorage on any field update (only if active content exists)
  useEffect(() => {
    try {
      const hasContent = Boolean(
        fullName.trim() ||
        mobileNumber.trim() ||
        photoUrl ||
        email.trim() ||
        address.trim() ||
        studentId.trim() ||
        rollNumber.trim()
      );
      if (hasContent) {
        const currentDraft = {
          fullName,
          photoUrl,
          mobileNumber,
          email,
          address,
          category,
          gender,
          bloodGroup,
          hasParent,
          parentName,
          parentAge,
          parentPhone,
          parentRelation,
          parentPhotoUrl,
          passingYear,
          lastClassAttended,
          currentClass,
          studentId,
          batchName,
          groupOrSection,
          rollNumber,
          tShirtSize,
          donationInput,
          termsAccepted,
        };
        localStorage.setItem('plscf_registration_draft', JSON.stringify(currentDraft));
      } else {
        localStorage.removeItem('plscf_registration_draft');
      }
    } catch {}
  }, [
    fullName,
    photoUrl,
    mobileNumber,
    email,
    address,
    category,
    gender,
    bloodGroup,
    hasParent,
    parentName,
    parentAge,
    parentPhone,
    parentRelation,
    parentPhotoUrl,
    passingYear,
    lastClassAttended,
    currentClass,
    studentId,
    batchName,
    groupOrSection,
    rollNumber,
    tShirtSize,
    donationInput,
    termsAccepted,
  ]);

  // Synchronize form fields whenever initialData changes (only reset on non-null -> null transition)
  const prevInitialDataRef = useRef<RegistrationFormData | null | undefined>(initialData);
  useEffect(() => {
    const prev = prevInitialDataRef.current;
    prevInitialDataRef.current = initialData;
    if (initialData === null) {
      if (prev !== null && prev !== undefined) {
        resetForm();
      }
      return;
    }
    if (!initialData) return;
    if (initialData.fullName !== undefined) setFullName(initialData.fullName || '');
    if (initialData.photoUrl !== undefined) setPhotoUrl(initialData.photoUrl || '');
    if (initialData.mobileNumber !== undefined) setMobileNumber(initialData.mobileNumber || '');
    if (initialData.email !== undefined) setEmail(initialData.email || '');
    if (initialData.address !== undefined) setAddress(initialData.address || '');
    if (initialData.category !== undefined) setCategory(initialData.category || 'former');
    if (initialData.gender !== undefined) setGender(initialData.gender || 'male');
    if (initialData.bloodGroup !== undefined) setBloodGroup(initialData.bloodGroup || '');
    if (initialData.hasParent !== undefined) setHasParent(Boolean(initialData.hasParent));
    if (initialData.parentName !== undefined) setParentName(initialData.parentName || '');
    if (initialData.parentAge !== undefined) setParentAge(initialData.parentAge !== undefined && initialData.parentAge !== null ? Number(initialData.parentAge) : '');
    if (initialData.parentPhone !== undefined) setParentPhone(initialData.parentPhone || '');
    if (initialData.parentRelation !== undefined) setParentRelation(initialData.parentRelation || 'Guardian');
    if (initialData.parentPhotoUrl !== undefined) setParentPhotoUrl(initialData.parentPhotoUrl || '');
    if (initialData.passingYear !== undefined) setPassingYear(initialData.passingYear || '2015');
    if (initialData.lastClassAttended !== undefined) setLastClassAttended(initialData.lastClassAttended || 'SSC');
    if (initialData.currentClass !== undefined) setCurrentClass(initialData.currentClass || 'Class 10');
    if (initialData.studentId !== undefined) setStudentId(initialData.studentId || '');
    if (initialData.batchName !== undefined) setBatchName(initialData.batchName || '');
    if (initialData.groupOrSection !== undefined) setGroupOrSection(initialData.groupOrSection || 'Section A');
    if (initialData.rollNumber !== undefined) setRollNumber(initialData.rollNumber || '');
    if (initialData.tShirtSize !== undefined) setTShirtSize((initialData.tShirtSize as TShirtSize) || 'L');
    if (typeof initialData.donationAmount === 'number') {
      setDonationInput(initialData.donationAmount > 0 ? initialData.donationAmount : '');
    }
    if (initialData.termsAccepted !== undefined) setTermsAccepted(Boolean(initialData.termsAccepted));
  }, [initialData]);

  // Photo live camera, adjustment & compression state (Requirement 4)
  const [photoSizeKb, setPhotoSizeKb] = useState<number | null>(null);
  const [isCompressingPhoto, setIsCompressingPhoto] = useState(false);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [modalInitialImage, setModalInitialImage] = useState<string | null>(null);

  // Errors state
  const [validationErrors, setValidationErrors] = useState<Record<string, { en: string; bn: string }>>({});
  const [showSizeModal, setShowSizeModal] = useState(false);

  const clearValidationError = (field: string) => {
    setValidationErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  // Accompanying Parent Eligibility Rule:
  // Eligible if female (any category/class), OR if current student below Class 6 (male or female)
  const effectiveCurrentClass =
    (category === 'current' && idVerificationResult?.record?.className)
      ? idVerificationResult.record.className
      : currentClass;
  const isBelowClass6 = category === 'current' && isStudentBelowClass6(effectiveCurrentClass);
  const isParentEligible = gender === 'female' || isBelowClass6;
  const effectiveHasParent = isParentEligible && hasParent;

  const isOptionalDonationOpen = isDonationOpen(feeSettings);
  const donationAmount = isOptionalDonationOpen && typeof donationInput === 'number' ? donationInput : 0;
  const fees = calculateTotalFee(category, feeSettings, donationAmount, effectiveHasParent);
  const gatewayCharge = calculateGatewayCharge(fees.totalPayable);
  const totalPayableWithCharge = Math.round((fees.totalPayable + gatewayCharge) * 100) / 100;

  // Auto-generate batch name based on category and selected academic fields
  const getComputedBatch = () => {
    if (category === 'former') {
      return `SSC ${passingYear || 'Batch'}`;
    }
    if (batchName.trim()) return batchName;
    return `${currentClass} (${groupOrSection})`;
  };

  // Open Synchronized Live Camera & ID Card Preview Modal
  const openLiveCamera = () => {
    setModalInitialImage(null);
    setIsCameraModalOpen(true);
  };

  // Callback when user confirms photo crop in the modal
  // Directly uploads photo to Supabase Storage bucket 'student-photos' and retrieves public URL
  const handlePhotoConfirmed = async (confirmedDataUrl: string, sizeKb: number) => {
    setIsUploadingPhoto(true);
    setPhotoSizeKb(sizeKb);
    try {
      const uploadRes = await StudentPhotoStorageService.uploadStudentPhoto({
        fileOrDataUrl: confirmedDataUrl,
        registrationId: studentId.trim() || registrationDraftId,
        batchYear: passingYear || undefined,
        category,
        currentClass: currentClass || undefined,
        isParent: false,
      });

      if (uploadRes.success && uploadRes.publicUrl) {
        setPhotoUrl(uploadRes.publicUrl);
        setPhotoStoragePath(uploadRes.storagePath);
        setPhotoSizeKb(Math.round((uploadRes.sizeBytes || 0) / 1024) || sizeKb);
        setValidationErrors((current) => {
          const next = { ...current };
          delete next.photoUrl;
          return next;
        });
      } else {
        const message =
          uploadRes.error ||
          (language === 'bn'
            ? 'ছবি ক্লাউড স্টোরেজে আপলোড করতে সমস্যা হয়েছে।'
            : 'Failed to upload photo to Supabase Storage.');
        setValidationErrors((current) => ({
          ...current,
          photoUrl: { en: message, bn: message },
        }));
      }
    } catch (uploadError: any) {
      const message =
        uploadError?.message ||
        (language === 'bn'
          ? 'ছবি আপলোড করতে ত্রুটি হয়েছে।'
          : 'Error uploading photo to Supabase Storage.');
      setValidationErrors((current) => ({
        ...current,
        photoUrl: { en: message, bn: message },
      }));
    } finally {
      setIsUploadingPhoto(false);
      setIsCameraModalOpen(false);
      setModalInitialImage(null);
    }
  };

  // Handle Photo File Upload & Open Synchronized Adjuster with ID Card Preview
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressingPhoto(true);
    try {
      const validDataUrl = await readValidatedImage(file);
      setModalInitialImage(validDataUrl);
      setIsCameraModalOpen(true);
    } catch (error) {
      e.target.value = '';
      const message =
        error instanceof Error ? error.message : 'Unable to validate the selected image.';
      setValidationErrors((current) => ({
        ...current,
        photoUrl: {
          en: message,
          bn: message,
        },
      }));
    } finally {
      setIsCompressingPhoto(false);
    }
  };

  // Live Student / Alumni ID Card Preview Record
  const previewStudentRecord: StudentIdCardRecord = {
    id: `PREVIEW-${Date.now()}`,
    registrationId: 'PLSC-XXXX-XXXX',
    eventYear: 2027,
    idNumber: 'PLSC-XXXX-XXXX',
    studentName:
      fullName.trim() ||
      (language === 'bn'
        ? category === 'former'
          ? 'আপনার নাম (অ্যালুমনাই)'
          : 'আপনার নাম (শিক্ষার্থী)'
        : category === 'former'
        ? 'Alumni Full Name'
        : 'Student Full Name'),
    category,
    batchName:
      category === 'current'
        ? currentClass
          ? `Class ${currentClass}`
          : 'Class X'
        : passingYear
        ? `SSC ${passingYear}`
        : 'Alumni Member',
    batchYear: category === 'current' ? '2027' : passingYear || '2018',
    contactNumber: mobileNumber || '01XXXXXXXXX',
    photoUrl: photoUrl || '',
    hasPhoto: Boolean(photoUrl),
    qrToken: 'XXXXXX',
    verificationUrl: `${typeof window !== 'undefined' ? window.location.origin : ''}/ticket-verification?token=PREVIEW`,
    cardStatus: 'ELIGIBLE',
    gender,
    bloodGroup,
    hasParent: effectiveHasParent,
    parentName: effectiveHasParent ? parentName.trim() : undefined,
    parentAge: effectiveHasParent && parentAge ? Number(parentAge) : undefined,
    parentPhone: effectiveHasParent ? parentPhone.trim() : undefined,
    parentRelation: effectiveHasParent ? parentRelation : undefined,
    parentPhotoUrl: effectiveHasParent ? parentPhotoUrl : undefined,
    cardDimensions: '54x86mm',
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Live Parent Pass Preview Record
  const previewParentRecord: StudentIdCardRecord = {
    ...previewStudentRecord,
    id: `PREV-PAR-${Date.now()}`,
    idNumber: 'PAR-PLSC-XXXX',
    studentName: parentName.trim() || (language === 'bn' ? 'অভিভাবকের নাম' : 'Parent / Guardian Name'),
    parentName: parentName.trim() || (language === 'bn' ? 'অভিভাবকের নাম' : 'Parent / Guardian Name'),
    photoUrl: parentPhotoUrl || '',
    hasPhoto: Boolean(parentPhotoUrl),
    parentPhotoUrl: parentPhotoUrl || '',
    contactNumber: parentPhone.trim() || mobileNumber || '01XXXXXXXXX',
    parentPhone: parentPhone.trim() || mobileNumber || '01XXXXXXXXX',
    batchName: currentClass ? `Class ${currentClass}` : 'Class IX',
    batchYear: '2027',
    qrToken: 'P-PREV',
    category: 'current',
  };

  // Callback when user confirms parent photo
  const handleParentPhotoConfirmed = async (confirmedDataUrl: string, sizeKb: number) => {
    setIsUploadingParentPhoto(true);
    setParentPhotoSizeKb(sizeKb);
    try {
      const uploadRes = await StudentPhotoStorageService.uploadStudentPhoto({
        fileOrDataUrl: confirmedDataUrl,
        registrationId: studentId.trim() || registrationDraftId,
        batchYear: passingYear || undefined,
        category,
        currentClass: currentClass || undefined,
        isParent: true,
      });

      if (uploadRes.success && uploadRes.publicUrl) {
        setParentPhotoUrl(uploadRes.publicUrl);
        setParentPhotoStoragePath(uploadRes.storagePath);
        setParentPhotoSizeKb(Math.round((uploadRes.sizeBytes || 0) / 1024) || sizeKb);
        clearValidationError('parentPhotoUrl');
      } else {
        const message =
          uploadRes.error ||
          (language === 'bn'
            ? 'অভিভাবকের ছবি আপলোড করতে সমস্যা হয়েছে।'
            : 'Failed to upload guardian photo to storage.');
        setValidationErrors((current) => ({
          ...current,
          parentPhotoUrl: { en: message, bn: message },
        }));
      }
    } catch (uploadError: any) {
      const message =
        uploadError?.message ||
        (language === 'bn'
          ? 'অভিভাবকের ছবি আপলোড করতে ত্রুটি হয়েছে।'
          : 'Error uploading guardian photo to storage.');
      setValidationErrors((current) => ({
        ...current,
        parentPhotoUrl: { en: message, bn: message },
      }));
    } finally {
      setIsUploadingParentPhoto(false);
      setIsParentCameraModalOpen(false);
    }
  };

  // Handle Parent Photo File Upload
  const handleParentPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressingParentPhoto(true);
    try {
      const validDataUrl = await readValidatedImage(file);
      const compressed = await compressImageTo200KB(validDataUrl);
      await handleParentPhotoConfirmed(compressed.dataUrl, compressed.sizeKb);
    } catch (error: any) {
      e.target.value = '';
      const message =
        error instanceof Error ? error.message : 'Unable to validate the selected guardian image.';
      setValidationErrors((current) => ({
        ...current,
        parentPhotoUrl: {
          en: message,
          bn: message,
        },
      }));
    } finally {
      setIsCompressingParentPhoto(false);
    }
  };

  // Student ID Verification Handler with Instant Cloud Database Fallback
  const handleVerifyStudentId = async (idToVerify?: string) => {
    const rawId = (idToVerify !== undefined ? idToVerify : studentId).trim();
    if (!rawId) {
      setIdVerificationResult(null);
      return;
    }
    setIsVerifyingId(true);
    try {
      const res = await StudentIdService.verifyStudentIdAsync(rawId);
      setIdVerificationResult(res);

      if (res.success && res.record) {
        if (res.record.studentName) {
          setFullName(res.record.studentName);
        }
        if (res.record.className) {
          setCurrentClass(res.record.className);
        }
        if (res.record.academicYear) {
          setPassingYear(res.record.academicYear);
          setBatchName(`${res.record.className} (${res.record.academicYear})`);
        } else if (res.record.className) {
          setBatchName(res.record.className);
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

  const handleSubmit = (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (isSubmitting) return; // Prevent duplicate submissions (Requirement 10)
    if (governanceStatus !== 'ready') return;
    if (!isGlobalRegistrationOpen(feeSettings)) {
      const msg = getRegistrationClosedMessage(feeSettings, 'global', language);
      setValidationErrors((current) => ({
        ...current,
        termsAccepted: { en: msg, bn: msg },
      }));
      return;
    }
    if (!isCategoryRegistrationOpen(category, feeSettings)) {
      const msg = getRegistrationClosedMessage(feeSettings, category, language);
      setValidationErrors((current) => ({
        ...current,
        termsAccepted: { en: msg, bn: msg },
      }));
      return;
    }

    if (isUploadingPhoto || isUploadingParentPhoto) {
      setValidationErrors((current) => ({
        ...current,
        photoUrl: {
          en: 'Please wait for your photo to finish uploading to secure storage.',
          bn: 'অনুগ্রহ করে নিরাপদ স্টোরেজে ছবি আপলোড সম্পন্ন হওয়া পর্যন্ত অপেক্ষা করুন।',
        },
      }));
      return;
    }

    setIsSubmitting(true);

    const formData: RegistrationFormData = {
      fullName,
      photoUrl,
      photoStoragePath: photoStoragePath || (photoUrl ? extractStoragePathFromPublicUrl(photoUrl) || undefined : undefined),
      mobileNumber,
      email: email.trim() || undefined,
      address,
      gender,
      bloodGroup,
      hasParent: effectiveHasParent,
      parentName: effectiveHasParent ? parentName.trim() : undefined,
      parentAge: effectiveHasParent && parentAge ? Number(parentAge) : undefined,
      parentPhone: effectiveHasParent ? parentPhone.trim() : undefined,
      parentRelation: effectiveHasParent ? parentRelation : undefined,
      parentPhotoUrl: effectiveHasParent ? parentPhotoUrl : undefined,
      parentPhotoStoragePath: effectiveHasParent ? (parentPhotoStoragePath || (parentPhotoUrl ? extractStoragePathFromPublicUrl(parentPhotoUrl) || undefined : undefined)) : undefined,
      category,
      studentId: category === 'current' ? studentId.trim() : undefined,
      passingYear: category === 'former' ? passingYear : undefined,
      lastClassAttended: category === 'former' ? lastClassAttended : undefined,
      currentClass: category === 'current' ? currentClass : undefined,
      batchName: getComputedBatch(),
      groupOrSection: category === 'current' ? groupOrSection : undefined,
      rollNumber: category === 'current' ? rollNumber : undefined,
      tShirtSize,
      donationAmount,
      termsAccepted: true,
    };

    const result = validateRegistrationData(formData);
    const customErrors: Record<string, { en: string; bn: string }> = { ...result.errors };

    // Strict validation for current student ID status
    if (category === 'current') {
      if (!studentId.trim()) {
        customErrors.studentId = {
          en: 'Student ID is mandatory for current students.',
          bn: 'বর্তমান শিক্ষার্থীদের জন্য স্টুডেন্ট আইডি প্রদান আবশ্যক।',
        };
      } else {
        const check = StudentIdService.verifyStudentId(studentId);
        if (!check.success || check.status !== 'AVAILABLE') {
          customErrors.studentId = {
            en: check.messageEn,
            bn: check.messageBn,
          };
        }
      }
    }

    // Multiple students or family members can register using the same mobile number (e.g. parent's phone or shared contact).
    // We only prevent duplicate registration if the EXACT same alumnus (same name, batch, and mobile) is already registered.
    // For Current Students, Roll/Student ID verification above guarantees uniqueness.
    const normalizedMobileNumber = normalizeBangladeshiMobileNumber(mobileNumber);
    if (normalizedMobileNumber && category === 'former') {
      const cleanName = fullName.trim().toLowerCase();
      const cleanBatch = batchName.trim().toLowerCase();
      const isAlumniExactDuplicate = AppStore.getRegistrations().some(
        (registration) =>
          registration.category === 'former' &&
          normalizeBangladeshiMobileNumber(registration.mobileNumber) === normalizedMobileNumber &&
          registration.fullName?.trim().toLowerCase() === cleanName &&
          registration.batchName?.trim().toLowerCase() === cleanBatch
      );
      if (isAlumniExactDuplicate) {
        customErrors.mobileNumber = {
          en: 'A registration with this name, batch, and mobile number already exists.',
          bn: 'এই নাম, ব্যাচ এবং মোবাইল নম্বর দিয়ে ইতোমধ্যে একটি নিবন্ধন রয়েছে।',
        };
      }
    }

    if (Object.keys(customErrors).length > 0) {
      setValidationErrors(customErrors);
      setIsSubmitting(false); // Re-enable on validation errors so user can fix
      const firstInvalidField = Object.keys(customErrors)[0];
      window.requestAnimationFrame(() => {
        const field = document.querySelector<HTMLElement>(
          `[name="${firstInvalidField}"], [data-validation-field="${firstInvalidField}"]`
        );
        field?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        field?.focus({ preventScroll: true });
      });
      return;
    }

    setValidationErrors({});
    onInitiatePayment(formData, fees);
  };

  // Generate passing years 1962 to 2025
  const passingYears: number[] = [];
  for (let y = 2025; y >= 1962; y--) {
    passingYears.push(y);
  }

  const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

  const selectedCategoryOpen = isCategoryRegistrationOpen(category, feeSettings);
  const otherCategory: StudentCategory = category === 'former' ? 'current' : 'former';
  const otherCategoryOpen = isCategoryRegistrationOpen(otherCategory, feeSettings);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* ── Post-payment success banner — appears after a confirmed registration ── */}
      {showSuccessBanner && (
        <div className="mb-6 p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-300 shadow-sm flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
            <div className="min-w-0">
              <p className="font-bold text-emerald-900 text-sm leading-tight">
                {language === 'bn'
                  ? 'রেজিস্ট্রেশন সফলভাবে সম্পন্ন হয়েছে! এখন আপনি পরবর্তী শিক্ষার্থীর তথ্য পূরণ করতে পারেন।'
                  : 'Registration Successful! You can now register another student.'}
              </p>
              {lastRegisteredName && (
                <p className="text-xs text-emerald-700 mt-0.5">
                  {language === 'bn'
                    ? `শিক্ষার্থী: ${lastRegisteredName}`
                    : `Student: ${lastRegisteredName}`}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            {onViewLastTicket && (
              <button
                type="button"
                onClick={onViewLastTicket}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition cursor-pointer shadow-xs whitespace-nowrap"
              >
                {language === 'bn' ? '🎫 টিকিট দেখুন' : '🎫 View Ticket'}
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowSuccessBanner(false)}
              className="p-1 rounded-lg text-emerald-700 hover:bg-emerald-100 hover:text-emerald-900 transition cursor-pointer"
              title={language === 'bn' ? 'বন্ধ করুন' : 'Dismiss'}
              aria-label="Dismiss banner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Title */}
      <div className="text-center mb-8">
        <span className="inline-flex items-center px-3.5 py-1 rounded-full text-xs font-bold bg-[#E2EEF8] text-[#0284C7] border border-[#0284C7]/20 mb-2">
          {t.reunionTitle} • {t.reunionDates}
        </span>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight">
          {t.regPageTitle}
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 mt-2 max-w-2xl mx-auto">
          {t.regPageSubtitle}
        </p>
      </div>

      {governanceStatus === 'loading' ? (
        <div className="bg-white rounded-3xl p-10 border border-slate-200 text-center space-y-3 shadow-sm max-w-2xl mx-auto">
          <RefreshCw className="w-8 h-8 text-[#0284C7] animate-spin mx-auto" />
          <h2 className="text-base font-bold text-slate-900">
            {language === 'bn' ? 'নিবন্ধনের সর্বশেষ অবস্থা যাচাই করা হচ্ছে...' : 'Checking Registration Status...'}
          </h2>
          <p className="text-xs text-slate-500">
            {language === 'bn'
              ? 'অনুগ্রহ করে অপেক্ষা করুন, সার্ভার থেকে অনুমোদিত সেটিংস লোড হচ্ছে।'
              : 'Please wait while authoritative governance settings load from Supabase.'}
          </p>
        </div>
      ) : governanceStatus === 'error' ? (
        <div className="bg-white rounded-3xl p-8 border border-rose-200 text-center space-y-4 shadow-sm max-w-2xl mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-slate-900">
              {language === 'bn' ? 'নিবন্ধন সেটিংস লোড করা সম্ভব হয়নি' : 'Unable to Load Registration Status'}
            </h2>
            <p className="text-xs text-slate-600 max-w-md mx-auto">
              {governanceError ||
                (language === 'bn'
                  ? 'সার্ভারের সাথে সংযোগ বিচ্ছিন্ন রয়েছে। অনুগ্রহ করে পুনরায় চেষ্টা করুন।'
                  : 'Could not load portal settings from Supabase. Please try again.')}
            </p>
          </div>
          {onRetryGovernance && (
            <button
              type="button"
              onClick={onRetryGovernance}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{language === 'bn' ? 'পুনরায় চেষ্টা করুন' : 'Retry Loading'}</span>
            </button>
          )}
        </div>
      ) : !isGlobalRegistrationOpen(feeSettings) ? (
        <GovernanceClosureNoticeCard
          notice={getStructuredClosureNotice(feeSettings, 'global', language)}
          language={language}
          badgeText={t.regStatusClosedBadge}
          onBackHome={() => _onNavigate('home')}
          onFindTicket={() => _onNavigate('find-ticket')}
        />
      ) : (
      <form onSubmit={handleSubmit} className="space-y-8" noValidate>
        {/* Category Selector Card - always visible & clickable when Global Registration is ON */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-[#E2EEF8]">
          <label className="block text-sm font-bold text-[#0F172A] mb-3">
            {t.categoryLabel} *
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Alumni Button */}
            <button
              type="button"
              onClick={() => {
                setCategory('former');
                setIdVerificationResult(null);
                if (validationErrors.passingYear || validationErrors.studentId) {
                  const next = { ...validationErrors };
                  delete next.passingYear;
                  delete next.studentId;
                  setValidationErrors(next);
                }
              }}
              className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                !isAlumniRegistrationOpen(feeSettings)
                  ? category === 'former'
                    ? 'border-amber-500 bg-amber-50/70 shadow-xs'
                    : 'border-amber-200 bg-amber-50/30 hover:border-amber-300'
                  : category === 'former'
                  ? 'border-[#0284C7] bg-[#E2EEF8]/40 shadow-xs'
                  : 'border-[#E2EEF8] hover:border-slate-300 bg-white'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-[#0F172A] text-base">
                  {t.categoryFormer}
                </span>
                {isAlumniRegistrationOpen(feeSettings) ? (
                  <span className="px-3 py-1 rounded-full bg-[#0284C7] text-white font-extrabold text-xs shrink-0">
                    ৳ {feeSettings.formerStudentFee}
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full bg-amber-200 text-amber-900 font-bold text-xs flex items-center gap-1 shrink-0">
                    <Lock className="w-3 h-3" />
                    <span>{language === 'bn' ? 'বন্ধ (Closed)' : 'Closed'}</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {language === 'bn'
                  ? '১৯৬২ থেকে ২০২৫ সাল পর্যন্ত সকল পাসের ব্যাচ'
                  : 'All alumni batches from 1962 to 2025'}
              </p>
            </button>

            {/* Current Student Button */}
            <button
              type="button"
              onClick={() => {
                setCategory('current');
                if (validationErrors.currentClass) {
                  const next = { ...validationErrors };
                  delete next.currentClass;
                  setValidationErrors(next);
                }
              }}
              className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                !isCurrentStudentRegistrationOpen(feeSettings)
                  ? category === 'current'
                    ? 'border-amber-500 bg-amber-50/70 shadow-xs'
                    : 'border-amber-200 bg-amber-50/30 hover:border-amber-300'
                  : category === 'current'
                  ? 'border-[#0EA5E9] bg-[#E2EEF8]/40 shadow-xs'
                  : 'border-[#E2EEF8] hover:border-slate-300 bg-white'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-[#0F172A] text-base">
                  {t.categoryCurrent}
                </span>
                {isCurrentStudentRegistrationOpen(feeSettings) ? (
                  <span className="px-3 py-1 rounded-full bg-[#0EA5E9] text-white font-extrabold text-xs shrink-0">
                    ৳ {feeSettings.currentStudentFee}
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full bg-amber-200 text-amber-900 font-bold text-xs flex items-center gap-1 shrink-0">
                    <Lock className="w-3 h-3" />
                    <span>{language === 'bn' ? 'বন্ধ (Closed)' : 'Closed'}</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {language === 'bn'
                  ? 'বিদ্যালয় ও কলেজ শাখায় বর্তমানে অধ্যয়নরত শিক্ষার্থী (আইডি আবশ্যক)'
                  : 'Currently enrolled school & college students (Student ID required)'}
              </p>
            </button>
          </div>
        </div>

        {/* Category-specific closure notice replaces application form when selected category is OFF */}
        {!selectedCategoryOpen && (
          <GovernanceClosureNoticeCard
            notice={getStructuredClosureNotice(
              feeSettings,
              category === 'former' ? 'alumni' : 'currentStudent',
              language
            )}
            language={language}
            badgeText={language === 'bn' ? 'সাময়িকভাবে বন্ধ' : 'Temporarily Closed'}
            onBackHome={() => _onNavigate('home')}
            onFindTicket={() => _onNavigate('find-ticket')}
            alternateAction={
              otherCategoryOpen
                ? {
                    label:
                      otherCategory === 'current'
                        ? language === 'bn'
                          ? 'বর্তমান শিক্ষার্থী নিবন্ধনে যান'
                          : 'Switch to Current Student Registration'
                        : language === 'bn'
                          ? 'প্রাক্তন শিক্ষার্থী নিবন্ধনে যান'
                          : 'Switch to Alumni Registration',
                    onClick: () => {
                      setCategory(otherCategory);
                      if (otherCategory === 'former') {
                        setIdVerificationResult(null);
                      }
                    },
                  }
                : undefined
            }
          />
        )}

        {/* CURRENT STUDENT SPECIFIC: 1. ACADEMIC INFORMATION & INSTITUTIONAL VERIFICATION (FIRST STEP) */}
        {selectedCategoryOpen && category === 'current' && (
          <div className="bg-white rounded-2xl p-4 sm:p-8 shadow-sm border border-slate-200 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-[#0284C7]" />
                <h2 className="text-lg font-bold text-slate-900">
                  {language === 'bn' ? '১. প্রাতিষ্ঠানিক তথ্য ও আইডি যাচাই' : '1. Academic Information & Student ID Verification'}
                </h2>
              </div>
              <span className="text-[11px] font-bold text-[#0284C7] bg-[#E2EEF8] px-2.5 py-1 rounded-full border border-[#0284C7]/20 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                {language === 'bn' ? 'ডাটাবেজ অটো-ফিল' : 'Database Auto-fill'}
              </span>
            </div>

            {/* If NOT verified yet: Render ID Input Box with Testing Helper */}
            {!idVerificationResult?.success ? (
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                <div className="text-xs text-slate-600 leading-relaxed">
                  {language === 'bn'
                    ? 'আপনার প্রাতিষ্ঠানিক স্টুডেন্ট আইডি প্রদান করুন। বিদ্যালয় ডাটাবেজ থেকে আপনার নাম, শ্রেণি ও বছর স্বয়ংক্রিয়ভাবে লোড হবে এবং প্রদর্শন করা হবে।'
                    : 'Enter your institutional Student ID. Your official full name, enrolled class, and academic year will be loaded and displayed directly from the school database.'}
                </div>

                {/* Quick Testing Badges (Development only) */}
                {isDevTestBypassAllowed() && (
                  <div className="p-2.5 bg-sky-50 border border-sky-300 text-sky-900 rounded-xl text-xs flex flex-wrap items-center justify-between gap-2 shadow-2xs">
                    <div className="flex items-center gap-1.5 font-medium flex-wrap">
                      <span className="font-bold text-sky-950">🧪 {language === 'bn' ? 'নমুনা ভেরিফাইড আইডি:' : 'Quick Test ID:'}</span>
                      <span className="font-mono bg-white px-2 py-0.5 rounded border border-sky-200 text-sky-800 font-bold">PLSC-2026-101</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setStudentId('PLSC-2026-101');
                        clearValidationError('studentId');
                        handleVerifyStudentId('PLSC-2026-101');
                      }}
                      className="text-[10px] text-sky-800 bg-sky-100 hover:bg-sky-200 px-2.5 py-1 rounded-full font-bold cursor-pointer transition-colors shadow-2xs"
                    >
                      {language === 'bn' ? 'অটো-ফিল ও যাচাই' : 'Auto-fill & Verify'}
                    </button>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-900">
                    {language === 'bn' ? 'স্টুডেন্ট আইডি নম্বর *' : 'Student ID Number *'}{' '}
                    <span className="text-rose-600">*</span>
                  </label>

                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <div className="relative flex-1 min-w-0">
                      <School className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                      <input
                        type="text"
                        value={studentId}
                        onChange={(e) => {
                          const val = e.target.value.toUpperCase();
                          setStudentId(val);
                          clearValidationError('studentId');
                          if (idVerificationResult) setIdVerificationResult(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (studentId.trim() && !isVerifyingId) {
                              handleVerifyStudentId(studentId);
                            }
                          }
                        }}
                        placeholder="e.g. PLSC-2026-101"
                        className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm font-mono tracking-wide uppercase transition-all focus:outline-hidden ${
                          idVerificationResult && !idVerificationResult.success
                            ? 'border-rose-500 bg-rose-50/40'
                            : 'border-slate-300 focus:border-[#0284C7] focus:ring-2 focus:ring-[#0284C7]/20'
                        }`}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleVerifyStudentId(studentId)}
                      disabled={!studentId.trim() || isVerifyingId}
                      className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#0284C7] hover:bg-[#0EA5E9] text-white font-bold text-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm shrink-0"
                    >
                      {isVerifyingId ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>{language === 'bn' ? 'যাচাই হচ্ছে...' : 'Verifying...'}</span>
                        </>
                      ) : (
                        <>
                          <Search className="w-3.5 h-3.5" />
                          <span>{language === 'bn' ? 'আইডি যাচাই করুন' : 'Verify ID'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* More test IDs (dev/sandbox only) */}
                {isDevTestBypassAllowed() && (
                  <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="font-semibold text-slate-700">
                      {language === 'bn' ? 'অন্যান্য টেস্ট আইডি:' : 'More Sample IDs:'}
                    </span>
                    {['PLSC-2026-104', 'PLSC-2026-105', 'PLSC-2026-106'].map((demoId) => (
                      <button
                        key={demoId}
                        type="button"
                        onClick={() => {
                          setStudentId(demoId);
                          handleVerifyStudentId(demoId);
                        }}
                        className="px-1.5 py-0.5 rounded bg-slate-200 hover:bg-slate-300 font-mono text-[10px] text-slate-700 cursor-pointer"
                      >
                        {demoId}
                      </button>
                    ))}
                  </div>
                )}

                {/* Status Error feedback */}
                {idVerificationResult && !idVerificationResult.success && (
                  <div className="p-3.5 rounded-xl text-xs flex items-start gap-2 border bg-rose-50 border-rose-300 text-rose-800">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold">
                        {language === 'bn' ? idVerificationResult.messageBn : idVerificationResult.messageEn}
                      </div>
                      <div className="text-[11px] text-rose-700 mt-0.5">
                        {language === 'bn'
                          ? 'সুপার এডমিন কর্তৃক আপলোডকৃত সঠিক স্টুডেন্ট আইডি প্রদান করুন অথবা বিদ্যালয় হেল্পডেস্কে যোগাযোগ করুন।'
                          : 'Please enter a valid student ID pre-uploaded by the school administration or contact the help desk.'}
                      </div>
                    </div>
                  </div>
                )}

                {validationErrors.studentId && !idVerificationResult && (
                  <p className="text-xs text-rose-600 flex items-center gap-1 font-medium">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{validationErrors.studentId[language]}</span>
                  </p>
                )}
              </div>
            ) : (
              /* If VERIFIED: Show Read-Only Official Information Card ("they can't change, just view") */
              <div className="rounded-2xl border-2 border-emerald-400 bg-gradient-to-br from-emerald-50/80 via-white to-sky-50/60 p-5 sm:p-6 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-200/60 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-xs font-black uppercase tracking-wider text-emerald-900 block">
                        {language === 'bn' ? 'যাচাইকৃত প্রাতিষ্ঠানিক শিক্ষার্থী প্রোফাইল' : 'Verified Official Student Record'}
                      </span>
                      <p className="text-[11px] text-emerald-700 font-medium">
                        {language === 'bn'
                          ? '🔒 প্রশাসনিক ডাটাবেজ থেকে তথ্য যাচাই সম্পন্ন — শুধুমাত্র প্রদর্শনযোগ্য ও অপরিবর্তনযোগ্য'
                          : '🔒 Verified against institutional database — Read-only & Tamper-proof'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setIdVerificationResult(null);
                      setStudentId('');
                      setFullName('');
                      setCurrentClass('');
                      setBatchName('');
                    }}
                    className="text-xs text-slate-500 hover:text-slate-800 font-semibold underline cursor-pointer self-start sm:self-auto"
                  >
                    {language === 'bn' ? 'অন্য আইডি যাচাই করুন' : 'Change Student ID'}
                  </button>
                </div>

                {/* 4 Read-Only Credential Badges */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="bg-white p-3.5 rounded-xl border border-emerald-200/70 shadow-2xs">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      {language === 'bn' ? 'শিক্ষার্থীর নাম' : 'Student Full Name'}
                    </span>
                    <span className="text-sm font-black text-slate-900 mt-1 block truncate">
                      {fullName || idVerificationResult.record?.studentName || 'N/A'}
                    </span>
                    <span className="text-[9px] text-emerald-600 font-semibold mt-0.5 block">
                      ✓ {language === 'bn' ? 'ডাটাবেজ থেকে যাচাইকৃত' : 'Database verified'}
                    </span>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-emerald-200/70 shadow-2xs">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      {language === 'bn' ? 'স্টুডেন্ট আইডি' : 'Student ID'}
                    </span>
                    <span className="text-sm font-mono font-black text-[#0284C7] mt-1 block">
                      {studentId || idVerificationResult.record?.studentId}
                    </span>
                    <span className="text-[9px] text-emerald-600 font-semibold mt-0.5 block">
                      ✓ {language === 'bn' ? 'অনুমোদিত আইডি' : 'Authorized ID'}
                    </span>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-emerald-200/70 shadow-2xs">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      {language === 'bn' ? 'অধ্যয়নরত শ্রেণি' : 'Current Class'}
                    </span>
                    <span className="text-sm font-black text-slate-900 mt-1 block">
                      {currentClass || idVerificationResult.record?.className || 'N/A'}
                    </span>
                    <span className="text-[9px] text-emerald-600 font-semibold mt-0.5 block">
                      ✓ {language === 'bn' ? 'নথিভুক্ত শ্রেণি' : 'Official Enrolled Class'}
                    </span>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-emerald-200/70 shadow-2xs">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      {language === 'bn' ? 'শিক্ষাবর্ষ / ব্যাচ' : 'Academic Year / Batch'}
                    </span>
                    <span className="text-sm font-black text-slate-900 mt-1 block">
                      {idVerificationResult.record?.academicYear || passingYear || '2026'}
                    </span>
                    <span className="text-[9px] text-emerald-600 font-semibold mt-0.5 block">
                      ✓ {language === 'bn' ? 'নিয়মিত শিক্ষাবর্ষ' : 'Official Academic Year'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Gated Callout for Current Students if not yet verified */}
        {selectedCategoryOpen && category === 'current' && !idVerificationResult?.success && (
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-dashed border-slate-300 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-sky-50 text-[#0284C7] flex items-center justify-center mx-auto">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-800">
              {language === 'bn' ? 'পরবর্তী ধাপের জন্য স্টুডেন্ট আইডি যাচাই করুন' : 'Verify Student ID to Unlock Registration'}
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              {language === 'bn'
                ? 'বর্তমান শিক্ষার্থীদের জন্য স্টুডেন্ট আইডি যাচাই আবশ্যক। ওপরে আপনার সঠিক স্টুডেন্ট আইডি প্রদান করে "আইডি যাচাই করুন" বাটনে ক্লিক করলে আপনার নাম ও শ্রেণি প্রদর্শিত হবে এবং রেজিস্ট্রেশনের পরবর্তী ধাপসমূহ উন্মুক্ত হবে।'
                : 'Institutional Student ID verification is mandatory for current students. Please enter your Student ID above and click "Verify ID" to load your verified record and unlock the rest of the registration form.'}
            </p>
          </div>
        )}

        {/* Section 1 / Next Steps: Rendered for Alumni, or for Current Student once verified */}
        {selectedCategoryOpen && (category === 'former' || (category === 'current' && idVerificationResult?.success)) && (
          <>
          <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-6">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <User className="w-5 h-5 text-[#0284C7]" />
              <h2 className="text-lg font-bold text-slate-900">
                {category === 'current'
                  ? (language === 'bn' ? '২. যোগাযোগ ও পরিচয়পত্র বিবরণী' : '2. Contact & Identity Details')
                  : t.personalInfoHeading}
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Full Name: Only manually editable for Former students (Alumni). For current students, verified & locked above! */}
              {category === 'former' && (
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    {t.fullNameLabel} <span className="text-rose-600">*</span>
                  </label>
                  <input
                    name="fullName"
                    aria-invalid={Boolean(validationErrors.fullName)}
                    type="text"
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value);
                      clearValidationError('fullName');
                    }}
                    placeholder={t.fullNamePlaceholder}
                    className={`w-full px-4 py-2.5 rounded-xl border text-sm transition-all focus:outline-hidden ${
                      validationErrors.fullName
                        ? 'border-rose-500 bg-rose-50/30 focus:ring-2 focus:ring-rose-500'
                        : 'border-slate-300 focus:border-[#0284C7] focus:ring-2 focus:ring-[#0284C7]/20'
                    }`}
                  />
                  {validationErrors.fullName && (
                    <p className="mt-1 text-xs text-rose-600 flex items-center gap-1 font-medium">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>{validationErrors.fullName[language]}</span>
                    </p>
                  )}
                </div>
              )}

            {/* Gender Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {language === 'bn' ? 'লিঙ্গ / Gender' : 'Gender'} <span className="text-rose-600">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setGender('male')}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    gender === 'male'
                      ? 'border-[#0F172A] bg-[#0F172A] text-white shadow-xs'
                      : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>👨</span>
                  <span>{language === 'bn' ? 'পুরুষ (Male)' : 'Male'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setGender('female')}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    gender === 'female'
                      ? 'border-pink-600 bg-pink-600 text-white shadow-xs'
                      : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>👩</span>
                  <span>{language === 'bn' ? 'নারী (Female)' : 'Female'}</span>
                </button>
              </div>
            </div>

            {/* Blood Group Selection */}
            <div>
              <div className="text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Droplet className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span>{language === 'bn' ? 'রক্তের গ্রুপ (Blood Group)' : 'Blood Group'}</span>
                <span className="text-rose-600">*</span>
              </div>
              <div>
                <select
                  name="bloodGroup"
                  aria-invalid={Boolean(validationErrors.bloodGroup)}
                  value={bloodGroup}
                  onChange={(e) => {
                    setBloodGroup(e.target.value);
                    clearValidationError('bloodGroup');
                  }}
                  className={`w-full px-4 py-2.5 rounded-xl border text-sm transition-all focus:outline-hidden ${
                    validationErrors.bloodGroup
                      ? 'border-rose-500 bg-rose-50/30'
                      : 'border-slate-300 focus:border-[#0284C7] focus:ring-2 focus:ring-[#0284C7]/20'
                  }`}
                >
                  <option value="">{language === 'bn' ? 'রক্তের গ্রুপ নির্বাচন করুন' : 'Select Blood Group'}</option>
                  {BLOOD_GROUPS.map((bg) => (
                    <option key={bg} value={bg}>
                      {bg}
                    </option>
                  ))}
                </select>
              </div>
              {validationErrors.bloodGroup && (
                <p className="mt-1 text-xs text-rose-600 flex items-center gap-1 font-medium">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{validationErrors.bloodGroup[language]}</span>
                </p>
              )}
            </div>

            {/* Profile Photo Upload & Live Camera Capture (Requirement 4) */}
            <div className="md:col-span-2">
              <div className="text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                <span>
                  {t.photoLabel} <span className="text-rose-600">*</span>
                </span>
                <span className="text-[10px] text-[#0284C7] font-medium bg-[#E2EEF8] px-2 py-0.5 rounded-full border border-[#0284C7]/20">
                  {language === 'bn' ? 'সর্বোচ্চ ২০০ কেবিতে কম্প্রেসড হবে' : 'Auto-compressed to ≤ 200 KB'}
                </span>
              </div>

              <div
                data-validation-field="photoUrl"
                aria-invalid={Boolean(validationErrors.photoUrl)}
                tabIndex={-1}
                className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/50"
              >
                {photoUrl ? (
                  <div className="relative shrink-0 text-center">
                    <img
                      src={photoUrl}
                      alt="Uploaded profile"
                      className="w-24 h-24 rounded-xl object-cover border-2 border-[#0284C7] shadow-sm mx-auto"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setPhotoUrl('');
                        setPhotoStoragePath('');
                        setPhotoSizeKb(null);
                        setModalInitialImage(null);
                        if (fileInputRef.current) {
                          fileInputRef.current.value = '';
                        }
                      }}
                      className="absolute -top-2 -right-2 bg-rose-600 text-white rounded-full p-1 text-[10px] cursor-pointer hover:bg-rose-700 shadow-xs"
                      title="Remove photo"
                    >
                      ✕
                    </button>
                    {photoSizeKb !== null && (
                      <span className="inline-block mt-1 text-[10px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-1.5 py-0.5 rounded">
                        ✓ {photoSizeKb} KB
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="w-24 h-24 rounded-xl bg-slate-200 flex flex-col items-center justify-center text-slate-500 shrink-0">
                    <Camera className="w-6 h-6" />
                    <span className="text-[10px] mt-1 font-medium">
                      {language === 'bn' ? 'ছবি নেই' : 'No Photo'}
                    </span>
                  </div>
                )}

                <div className="flex-1 space-y-2.5 text-center sm:text-left w-full">
                  <p className="text-xs text-slate-600">
                    {language === 'bn'
                      ? 'পাসপোর্ট সাইজ ছবি সরাসরি ক্যামেরা দিয়ে তুলুন অথবা ডিভাইস থেকে আপলোড করুন। সিস্টেমটি স্বয়ংক্রিয়ভাবে ২০০ কেবি-র মধ্যে অপটিমাইজ করবে।'
                      : 'Take a clear portrait photo directly using your camera or upload from device. Automatically compressed to ≤ 200 KB.'}
                  </p>

                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    {/* 1. Take Photo Button */}
                    <button
                      type="button"
                      onClick={() => openLiveCamera()}
                      className="px-4 py-2 rounded-xl bg-[#0284C7] hover:bg-[#0EA5E9] text-white text-xs font-semibold shadow-xs cursor-pointer transition-colors inline-flex items-center gap-1.5"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>{language === 'bn' ? '📷 ক্যামেরা দিয়ে ছবি তুলুন' : '📷 Take Photo'}</span>
                    </button>

                    {/* 2. Upload File Button */}
                    <label className="px-4 py-2 rounded-xl bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold shadow-xs cursor-pointer transition-colors inline-flex items-center gap-1.5">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{language === 'bn' ? '📁 ফাইল আপলোড করুন' : '📁 Upload Photo'}</span>
                      <input
                        ref={fileInputRef}
                        type="file"
                        name="photoUrl"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handlePhotoUpload}
                        className="hidden"
                      />
                    </label>

                    {/* Supabase Storage upload indicator / verification badge */}
                    {isUploadingPhoto ? (
                      <div className="flex items-center gap-1.5 text-xs text-sky-800 font-medium ml-auto bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-200 animate-pulse">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-600" />
                        <span>{language === 'bn' ? 'ক্লাউড স্টোরেজে আপলোড হচ্ছে...' : 'Uploading to cloud storage...'}</span>
                      </div>
                    ) : photoUrl ? (
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 ml-auto">
                        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>{language === 'bn' ? 'নিরাপদ ক্লাউডে সংরক্ষিত' : 'Verified Cloud Storage'}</span>
                      </div>
                    ) : null}
                  </div>

                  {isCompressingPhoto && (
                    <div className="text-xs text-sky-800 flex items-center gap-1.5 font-medium animate-pulse">
                      <span className="w-2 h-2 rounded-full bg-sky-600 animate-ping" />
                      <span>{language === 'bn' ? 'ছবি প্রসেস ও ২০০ কেবি-র মধ্যে অপটিমাইজ করা হচ্ছে...' : 'Processing and compressing photo to ≤ 200 KB...'}</span>
                    </div>
                  )}
                </div>
              </div>

              {validationErrors.photoUrl && (
                <p className="mt-1 text-xs text-rose-600 flex items-center gap-1 font-medium">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{validationErrors.photoUrl[language]}</span>
                </p>
              )}
            </div>

            {/* Synchronized Camera Capture & Live Student / Alumni ID Card Preview Modal */}
            <SynchronizedCameraCardModal
              isOpen={isCameraModalOpen}
              onClose={() => {
                setIsCameraModalOpen(false);
                setModalInitialImage(null);
              }}
              onPhotoConfirmed={handlePhotoConfirmed}
              studentPreview={previewStudentRecord}
              language={language}
              initialImageUrl={modalInitialImage}
              cardType={category === 'former' ? 'alumni' : 'student'}
            />

            {/* Mobile number must be unique for each registration */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {t.mobileLabel} <span className="text-rose-600">*</span>
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  name="mobileNumber"
                  aria-invalid={Boolean(validationErrors.mobileNumber)}
                  type="tel"
                  inputMode="tel"
                  value={mobileNumber}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const normalized = normalizeBangladeshiMobileNumber(raw);
                    const cleaned = (normalized.length >= 10 ? normalized : raw.replace(/[^\d]/g, '')).slice(0, 11);
                    setMobileNumber(cleaned);

                    // Real-time inline feedback while typing
                    if (cleaned.length === 0) {
                      clearValidationError('mobileNumber');
                    } else if (cleaned.length >= 2 && !cleaned.startsWith('01')) {
                      setValidationErrors((prev) => ({
                        ...prev,
                        mobileNumber: {
                          en: 'Mobile number must start with 01 (e.g. 017XXXXXXXX)',
                          bn: 'মোবাইল নম্বর অবশ্যই ০১ দিয়ে শুরু হতে হবে (যেমন: ০১৭XXXXXXXX)',
                        },
                      }));
                    } else if (cleaned.length === 11 && !cleaned.startsWith('01')) {
                      setValidationErrors((prev) => ({
                        ...prev,
                        mobileNumber: {
                          en: 'Mobile number must start with 01 and be exactly 11 digits',
                          bn: 'মোবাইল নম্বর ০১ দিয়ে শুরু হতে হবে এবং মোট ১১টি ডিজিট হতে হবে',
                        },
                      }));
                    } else if (cleaned.length === 11 && cleaned.startsWith('01')) {
                      // Full length & correct prefix — clear any error
                      clearValidationError('mobileNumber');
                    } else if (validationErrors.mobileNumber && cleaned.startsWith('01')) {
                      // Prefix is now correct, clear the prefix error while still typing
                      clearValidationError('mobileNumber');
                    }
                  }}
                  placeholder="017XXXXXXXX"
                  maxLength={11}
                  className={`w-full pl-10 pr-14 py-2.5 rounded-xl border text-sm font-mono transition-all focus:outline-hidden ${
                    validationErrors.mobileNumber
                      ? 'border-rose-500 bg-rose-50/30 focus:ring-2 focus:ring-rose-500'
                      : mobileNumber.length === 11 && mobileNumber.startsWith('01')
                      ? 'border-emerald-500 bg-emerald-50/20 focus:ring-2 focus:ring-emerald-500'
                      : 'border-slate-300 focus:border-[#0284C7] focus:ring-2 focus:ring-[#0284C7]/20'
                  }`}
                />
                {/* Live digit counter badge */}
                <span
                  className={`absolute right-3 top-2.5 text-[11px] font-bold font-mono px-1.5 py-0.5 rounded-md tabular-nums ${
                    mobileNumber.length === 11 && mobileNumber.startsWith('01')
                      ? 'text-emerald-700 bg-emerald-100'
                      : mobileNumber.length > 0
                      ? 'text-slate-500 bg-slate-100'
                      : 'hidden'
                  }`}
                >
                  {mobileNumber.length}/11
                </span>
              </div>
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                {language === 'bn'
                  ? '০১ দিয়ে শুরু, মোট ১১ ডিজিট — একই পারিবারিক নম্বর একাধিক নিবন্ধনে ব্যবহারযোগ্য'
                  : 'Must start with 01, exactly 11 digits — family/shared number allowed across registrations'}
              </span>
              {validationErrors.mobileNumber && (
                <p className="mt-1 text-xs text-rose-600 flex items-center gap-1 font-medium">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{validationErrors.mobileNumber[language]}</span>
                </p>
              )}
            </div>

            {/* Email Address - COMPLETELY OPTIONAL */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  {t.emailLabel}{' '}
                  <span className="text-slate-400 font-normal">
                    ({language === 'bn' ? 'ঐচ্ছিক' : 'Optional'})
                  </span>
                </label>
                <span className="text-[10px] text-slate-400">
                  {language === 'bn' ? 'ইমেইল ছাড়াও টিকিট সংগ্রহ সম্ভব' : 'Ticket available without email'}
                </span>
              </div>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  name="email"
                  aria-invalid={Boolean(validationErrors.email)}
                  type="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    clearValidationError('email');
                  }}
                  placeholder={language === 'bn' ? 'উদা: name@example.com (প্রযোজ্য হলে)' : 'e.g. name@example.com (if applicable)'}
                  className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm transition-all focus:outline-hidden ${
                    validationErrors.email
                      ? 'border-rose-500 bg-rose-50/30 focus:ring-2 focus:ring-rose-500'
                      : 'border-slate-300 focus:border-[#0284C7] focus:ring-2 focus:ring-[#0284C7]/20'
                  }`}
                />
              </div>
              {validationErrors.email && (
                <p className="mt-1 text-xs text-rose-600 flex items-center gap-1 font-medium">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{validationErrors.email[language]}</span>
                </p>
              )}
            </div>

            {/* Address */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {t.addressLabel}
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  name="address"
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder={t.addressPlaceholder}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-[#0284C7] focus:ring-2 focus:ring-[#0284C7]/20 focus:outline-hidden"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Accompanying Parent / Guardian Section (Eligibility: Female or Current Student below Class 6, max 1 parent, ৳1,500) */}
        {isParentEligible ? (
          <div className="bg-gradient-to-br from-amber-50/80 via-white to-amber-50/40 rounded-2xl p-6 sm:p-8 shadow-sm border-2 border-amber-300 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-200 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                    <span>{language === 'bn' ? 'অভিভাবক সহ অংশগ্রহণ' : 'Accompanying Parent / Guardian'}</span>
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                      ১ জন মাত্র / 1 Person Only
                    </span>
                  </h2>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {language === 'bn'
                      ? 'নারী শিক্ষার্থী অথবা ৬ষ্ঠ শ্রেণির নিচের বর্তমান শিক্ষার্থীরা কেবল ১ জন অভিভাবক সঙ্গে আনতে পারবেন।'
                      : 'Eligible for female students or current students below Class 6 (Strictly 1 Parent/Guardian).'}
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full bg-amber-600 text-white font-black text-xs shrink-0 self-start sm:self-auto shadow-2xs">
                + ৳ 1,500 BDT
              </span>
            </div>

            {/* Checkbox toggle */}
            <label className="inline-flex items-start gap-3 p-3.5 rounded-xl bg-white border border-amber-200 hover:border-amber-400 transition cursor-pointer select-none shadow-2xs w-full">
              <input
                type="checkbox"
                checked={hasParent}
                onChange={(e) => {
                  setHasParent(e.target.checked);
                  if (!e.target.checked) {
                    clearValidationError('parentName');
                    clearValidationError('parentPhotoUrl');
                    clearValidationError('parentAge');
                    clearValidationError('parentPhone');
                    clearValidationError('parentRelation');
                  }
                }}
                className="mt-0.5 w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
              />
              <div className="text-xs">
                <span className="font-bold text-slate-900 block">
                  {language === 'bn'
                    ? 'হ্যাঁ, আমি ১ জন অভিভাবক সহ অংশগ্রহণ করব (+৳১,৫০০ ফি প্রযোজ্য)'
                    : 'Yes, I will attend with 1 parent/guardian (+৳1,500 fee applies)'}
                </span>
                <span className="text-slate-500 mt-0.5 block">
                  {language === 'bn'
                    ? 'অভিভাবকের জন্য আলাদা স্পেশাল এন্ট্রি কার্ড ও ফুড কুপন প্রদান করা হবে।'
                    : 'A dedicated official Guardian Entry Pass and food access will be issued.'}
                </span>
              </div>
            </label>

            {/* Parent Form Fields */}
            {hasParent && (
              <div className="space-y-4 pt-2 border-t border-amber-200/60">
                {/* T-Shirt Notice for Guardian */}
                <div className="p-3 rounded-xl bg-amber-100/70 border border-amber-300 text-xs text-amber-900 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">
                      {language === 'bn' ? '⚠️ টি-শার্ট সুবিধা সংক্রান্ত নিয়ম:' : '⚠️ T-Shirt Distribution Notice:'}
                    </span>
                    <span>
                      {language === 'bn'
                        ? 'পুনর্মিলনী টি-শার্ট শুধুমাত্র মূল নিবন্ধিত শিক্ষার্থীর জন্য প্রযোজ্য। অভিভাবক বা গার্ডিয়ানের জন্য কোনো টি-শার্ট বরাদ্দ নেই (অভিভাবক পাস দিয়ে ভেন্যুতে প্রবেশ ও খাবার গ্রহণ করা যাবে)।'
                        : 'Reunion T-shirt is exclusively for the registered student. Accompanying parents/guardians are NOT eligible for T-shirts (Guardian pass grants entry & food access only).'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Parent Name */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      {language === 'bn' ? 'অভিভাবকের পূর্ণ নাম' : 'Parent / Guardian Full Name'} <span className="text-rose-600">*</span>
                    </label>
                    <input
                      name="parentName"
                      type="text"
                      value={parentName}
                      onChange={(e) => {
                        setParentName(e.target.value);
                        clearValidationError('parentName');
                      }}
                      placeholder={language === 'bn' ? 'অভিভাবকের নাম লিখুন' : "Enter parent's full name"}
                      className={`w-full px-4 py-2.5 rounded-xl border text-sm transition-all focus:outline-hidden ${
                        validationErrors.parentName
                          ? 'border-rose-500 bg-rose-50/30'
                          : 'border-slate-300 bg-white focus:border-amber-600 focus:ring-2 focus:ring-amber-500/20'
                      }`}
                    />
                    {validationErrors.parentName && (
                      <p className="mt-1 text-xs text-rose-600 flex items-center gap-1 font-medium">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>{validationErrors.parentName[language]}</span>
                      </p>
                    )}
                  </div>

                  {/* Relation with student: default is Guardian; options: Guardian, Father, Mother, Sister, Brother */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      {language === 'bn' ? 'শিক্ষার্থীর সাথে সম্পর্ক' : 'Relation with Student'} <span className="text-rose-600">*</span>
                    </label>
                    <select
                      name="parentRelation"
                      value={parentRelation}
                      onChange={(e) => {
                        setParentRelation(e.target.value);
                        clearValidationError('parentRelation');
                      }}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm focus:border-amber-600 focus:ring-2 focus:ring-amber-500/20 focus:outline-hidden"
                    >
                      <option value="Guardian">{language === 'bn' ? 'বৈধ অভিভাবক (Guardian)' : 'Guardian'}</option>
                      <option value="Father">{language === 'bn' ? 'পিতা (Father)' : 'Father'}</option>
                      <option value="Mother">{language === 'bn' ? 'মাতা (Mother)' : 'Mother'}</option>
                      <option value="Sister">{language === 'bn' ? 'বোন (Sister)' : 'Sister'}</option>
                      <option value="Brother">{language === 'bn' ? 'ভাই (Brother)' : 'Brother'}</option>
                    </select>
                  </div>

                  {/* Parent Photo Upload & Camera Capture */}
                  <div className="md:col-span-2">
                    <div className="text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                      <span>
                        {language === 'bn' ? 'অভিভাবকের পাসপোর্ট সাইজ ছবি' : 'Parent / Guardian Photo'} <span className="text-rose-600">*</span>
                      </span>
                      <span className="text-[10px] text-amber-800 font-medium bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                        {language === 'bn' ? 'সর্বোচ্চ ২০০ কেবি' : 'Auto-compressed to ≤ 200 KB'}
                      </span>
                    </div>

                    <div
                      data-validation-field="parentPhotoUrl"
                      aria-invalid={Boolean(validationErrors.parentPhotoUrl)}
                      tabIndex={-1}
                      className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-xl border-2 border-dashed border-amber-300 bg-white shadow-2xs"
                    >
                      {isCompressingParentPhoto ? (
                        <div className="w-20 h-24 rounded-xl bg-amber-50 border border-amber-300 flex flex-col items-center justify-center text-amber-700 shrink-0">
                          <RefreshCw className="w-5 h-5 animate-spin text-amber-600 mb-1" />
                          <span className="text-[8px] font-bold">Compressing...</span>
                        </div>
                      ) : parentPhotoUrl ? (
                        <div className="relative shrink-0 text-center">
                          <img
                            src={parentPhotoUrl}
                            alt="Guardian preview"
                            className="w-20 h-24 rounded-xl object-cover border-2 border-amber-600 shadow-sm mx-auto"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setParentPhotoUrl('');
                              setParentPhotoStoragePath('');
                              setParentPhotoSizeKb(null);
                              if (parentFileInputRef.current) {
                                parentFileInputRef.current.value = '';
                              }
                            }}
                            className="absolute -top-2 -right-2 bg-rose-600 text-white rounded-full p-1 text-[10px] cursor-pointer hover:bg-rose-700 shadow-xs"
                            title="Remove guardian photo"
                          >
                            ✕
                          </button>
                          {parentPhotoSizeKb !== null && (
                            <span className="inline-block mt-1 text-[10px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-1.5 py-0.5 rounded">
                              ✓ {parentPhotoSizeKb} KB
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="w-20 h-24 rounded-xl bg-amber-100/70 border border-amber-200 flex flex-col items-center justify-center text-amber-800 shrink-0">
                          <Users className="w-6 h-6" />
                          <span className="text-[9px] mt-1 font-bold">
                            {language === 'bn' ? 'ছবি নেই' : 'No Photo'}
                          </span>
                        </div>
                      )}

                      <div className="flex-1 space-y-2 text-center sm:text-left w-full">
                        <p className="text-xs text-slate-600">
                          {language === 'bn'
                            ? 'অভিভাবকের পরিষ্কার পাসপোর্ট সাইজ ছবি ক্যামেরা দিয়ে তুলুন অথবা ফাইল থেকে আপলোড করুন।'
                            : 'Capture guardian portrait photo directly using camera or upload from your device.'}
                        </p>

                        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                          <button
                            type="button"
                            onClick={() => setIsParentCameraModalOpen(true)}
                            className="px-3.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shadow-xs cursor-pointer transition-colors inline-flex items-center gap-1.5"
                          >
                            <Camera className="w-3.5 h-3.5" />
                            <span>{language === 'bn' ? '📷 ক্যামেরা দিয়ে ছবি তুলুন' : '📷 Take Photo'}</span>
                          </button>

                          <label className="px-3.5 py-1.5 rounded-lg bg-amber-800 hover:bg-amber-900 text-white text-xs font-semibold shadow-xs cursor-pointer transition-colors inline-flex items-center gap-1.5">
                            <Upload className="w-3.5 h-3.5" />
                            <span>{language === 'bn' ? '📁 ফাইল আপলোড' : '📁 Upload Photo'}</span>
                            <input
                              ref={parentFileInputRef}
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              onChange={handleParentPhotoUpload}
                              className="hidden"
                            />
                          </label>

                          {/* Supabase Storage upload indicator / verification badge */}
                          {isUploadingParentPhoto ? (
                            <div className="flex items-center gap-1.5 text-xs text-amber-800 font-medium ml-auto bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 animate-pulse">
                              <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-600" />
                              <span>{language === 'bn' ? 'অভিভাবকের ছবি আপলোড হচ্ছে...' : 'Uploading guardian photo...'}</span>
                            </div>
                          ) : parentPhotoUrl ? (
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 ml-auto">
                              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                              <span>{language === 'bn' ? 'নিরাপদ ক্লাউডে সংরক্ষিত' : 'Verified Cloud Storage'}</span>
                            </div>
                          ) : null}
                        </div>

                        {validationErrors.parentPhotoUrl && (
                          <p className="mt-1 text-xs text-rose-600 flex items-center gap-1 font-medium">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>{validationErrors.parentPhotoUrl[language]}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                {/* Parent Age */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    {language === 'bn' ? 'অভিভাবকের বয়স' : 'Parent / Guardian Age'} <span className="text-rose-600">*</span>
                  </label>
                  <input
                    name="parentAge"
                    type="number"
                    inputMode="numeric"
                    min="18"
                    max="100"
                    value={parentAge}
                    onChange={(e) => {
                      const val = e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value) || 0);
                      setParentAge(val);
                      clearValidationError('parentAge');
                    }}
                    placeholder="e.g. 45"
                    className={`w-full px-4 py-2.5 rounded-xl border text-sm transition-all focus:outline-hidden ${
                      validationErrors.parentAge
                        ? 'border-rose-500 bg-rose-50/30'
                        : 'border-slate-300 bg-white focus:border-amber-600 focus:ring-2 focus:ring-amber-500/20'
                    }`}
                  />
                  {validationErrors.parentAge && (
                    <p className="mt-1 text-xs text-rose-600 flex items-center gap-1 font-medium">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>{validationErrors.parentAge[language]}</span>
                    </p>
                  )}
                </div>

                {/* Parent Phone */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    {language === 'bn' ? 'অভিভাবকের মোবাইল নম্বর' : 'Parent Mobile Number'} <span className="text-rose-600">*</span>
                  </label>
                  <input
                    name="parentPhone"
                    type="tel"
                    inputMode="tel"
                    value={parentPhone}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const normalized = normalizeBangladeshiMobileNumber(raw);
                      const cleaned = (normalized.length >= 10 ? normalized : raw.replace(/[^\d]/g, '')).slice(0, 11);
                      setParentPhone(cleaned);
                      clearValidationError('parentPhone');
                    }}
                    placeholder="01XXXXXXXXX"
                    maxLength={11}
                    className={`w-full px-4 py-2.5 rounded-xl border text-sm font-mono transition-all focus:outline-hidden ${
                      validationErrors.parentPhone
                        ? 'border-rose-500 bg-rose-50/30'
                        : 'border-slate-300 bg-white focus:border-amber-600 focus:ring-2 focus:ring-amber-500/20'
                    }`}
                  />
                  {validationErrors.parentPhone && (
                    <p className="mt-1 text-xs text-rose-600 flex items-center gap-1 font-medium">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>{validationErrors.parentPhone[language]}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Synchronized Camera Capture Modal for Parent / Guardian Pass */}
              <SynchronizedCameraCardModal
                isOpen={isParentCameraModalOpen}
                onClose={() => setIsParentCameraModalOpen(false)}
                onPhotoConfirmed={(photoDataUrl, sizeKb) => {
                  handleParentPhotoConfirmed(photoDataUrl, sizeKb);
                }}
                studentPreview={previewParentRecord}
                language={language}
                isParentPass={true}
                cardType="parent"
              />
            </div>
          )}
          </div>
        ) : (
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-500 flex items-center gap-2">
            <HeartHandshake className="w-4 h-4 text-slate-400 shrink-0" />
            <span>
              {language === 'bn'
                ? 'অভিভাবক নিবন্ধন কেবল নারী শিক্ষার্থী অথবা ৬ষ্ঠ শ্রেণির নিচের বর্তমান শিক্ষার্থীদের জন্য প্রযোজ্য (সর্বোচ্চ ১ জন, ফি ৳১,৫০০)।'
                : 'Accompanying parent pass is reserved for female students and current students below Class 6 (Max 1 Person, ৳1,500).'}
            </span>
          </div>
        )}


        {/* Section 2: Academic Information (Alumni / Former Students Only) */}
        {category === 'former' && (
          <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-6">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <GraduationCap className="w-5 h-5 text-[#0284C7]" />
              <h2 className="text-lg font-bold text-slate-900">
                {t.academicInfoHeading}
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Former Student: Graduation / Last Attended Year is MANDATORY */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {language === 'bn' ? 'পাস বা অধ্যয়নের শেষ বছর *' : 'Graduation / Last Attended Year *'}{' '}
                  <span className="text-rose-600">*</span>
                </label>
                <select
                  name="passingYear"
                  aria-invalid={Boolean(validationErrors.passingYear)}
                  value={passingYear}
                  onChange={(e) => {
                    setPassingYear(e.target.value);
                    clearValidationError('passingYear');
                  }}
                  className={`w-full px-4 py-2.5 rounded-xl border text-sm transition-all focus:outline-hidden ${
                    validationErrors.passingYear
                      ? 'border-rose-500 bg-rose-50/30'
                      : 'border-slate-300 focus:border-[#0284C7] focus:ring-2 focus:ring-[#0284C7]/20'
                  }`}
                >
                  <option value="">{t.passingYearPlaceholder}</option>
                  {passingYears.map((yr) => (
                    <option key={yr} value={yr}>
                      {yr} {language === 'bn' ? 'সাল' : 'Batch'}
                    </option>
                  ))}
                </select>
                {validationErrors.passingYear && (
                  <p className="mt-1 text-xs text-rose-600 flex items-center gap-1 font-medium">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{validationErrors.passingYear[language]}</span>
                  </p>
                )}
              </div>

              {/* Optional Last Class Attended for Former Students */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {language === 'bn' ? 'সর্বশেষ অধ্যয়নের শ্রেণি (ঐচ্ছিক)' : 'Last Class Attended (Optional)'}
                </label>
                <select
                  value={lastClassAttended}
                  onChange={(e) => setLastClassAttended(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-[#0284C7] focus:ring-2 focus:ring-[#0284C7]/20 focus:outline-hidden"
                >
                  <option value="SSC">SSC (মাধ্যমিক)</option>
                  <option value="HSC">HSC (উচ্চ মাধ্যমিক)</option>
                  <option value="Class 10">Class 10 (দশম শ্রেণি)</option>
                  <option value="Class 8">Class 8 (অষ্টম শ্রেণি)</option>
                  <option value="Class 5">Class 5 (পঞ্চম শ্রেণি)</option>
                  <option value="Class 3">Class 3 (তৃতীয় শ্রেণি)</option>
                  <option value="Other">Other / অন্যান্য</option>
                </select>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  {language === 'bn'
                    ? 'এসএসসি বা এইচএসসির আগেই বিদ্যালয় ত্যাগ করে থাকলে প্রযোজ্য শ্রেণি নির্বাচন করুন।'
                    : 'Applicable if student left school prior to SSC or HSC completion.'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Section 3: T-shirt Selection */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Shirt className="w-5 h-5 text-[#0284C7]" />
              <h2 className="text-lg font-bold text-slate-900">{t.tshirtHeading}</h2>
            </div>
            <button
              type="button"
              onClick={() => setShowSizeModal(true)}
              className="text-xs text-[#0284C7] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>{t.sizeGuide}</span>
            </button>
          </div>

          <p className="text-xs text-slate-600">{t.tshirtDesc}</p>

          <div
            data-validation-field="tShirtSize"
            aria-invalid={Boolean(validationErrors.tShirtSize)}
            tabIndex={-1}
            className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-3"
          >
            {(['S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'Oversize 50'] as TShirtSize[]).map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => {
                  setTShirtSize(size);
                  clearValidationError('tShirtSize');
                }}
                className={`py-3 px-2 rounded-xl border-2 font-bold text-sm transition-all cursor-pointer ${
                  size === 'Oversize 50' ? 'col-span-3 sm:col-span-2 md:col-span-1' : ''
                } ${
                  tShirtSize === size
                    ? 'border-[#0284C7] bg-[#0284C7] text-white shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                }`}
              >
                {size}
              </button>
            ))}
          </div>

          {validationErrors.tShirtSize && (
            <p className="mt-1 text-xs text-rose-600 flex items-center gap-1 font-medium">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{validationErrors.tShirtSize[language]}</span>
            </p>
          )}
        </div>

        {/* Section 4: Optional Donation (omitted cleanly if Donation is OFF) */}
        {isOptionalDonationOpen && (
        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Heart className="w-5 h-5 text-rose-600" />
            <h2 className="text-lg font-bold text-slate-900">{t.donationHeading}</h2>
          </div>
          <p className="text-xs text-slate-600">{t.donationDesc}</p>

          <div className="flex flex-wrap gap-2 items-center">
            {[500, 1000, 2000, 5000].map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => setDonationInput(amt)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                  donationInput === amt
                    ? 'border-[#0284C7] bg-[#0284C7] text-white font-bold'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                }`}
              >
                + ৳{amt}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setDonationInput('')}
              className="text-xs text-slate-400 hover:text-slate-600 ml-2 cursor-pointer"
            >
              {language === 'bn' ? 'মুছে ফেলুন' : 'Clear'}
            </button>
          </div>

          <div className="relative max-w-xs">
            <span className="absolute left-3.5 top-2.5 text-slate-400 font-bold text-sm">৳</span>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              value={donationInput}
              onChange={(e) => {
                const val = e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0);
                setDonationInput(val);
              }}
              placeholder={t.donationPlaceholder}
              className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-[#0284C7] focus:ring-2 focus:ring-[#0284C7]/20 focus:outline-hidden"
            />
          </div>
        </div>
        )}

        {/* Section 5: Order Summary & Terms */}
        <div className="bg-[#0F172A] text-white rounded-3xl p-5 sm:p-8 shadow-xl border border-slate-800 space-y-6">
          <h2 className="text-lg font-bold border-b border-slate-800 pb-3 flex flex-wrap items-center justify-between gap-2">
            <span>{t.summaryHeading}</span>
            <span className="text-xs text-[#38BDF8] font-normal">
              {category === 'former' ? t.feeFormerTitle : t.feeCurrentTitle}
            </span>
          </h2>

          <div className="space-y-2.5 text-sm text-slate-200">
            <div className="flex justify-between">
              <span>{t.regFeeSummary}</span>
              <span className="font-semibold text-white">৳ {fees.registrationFee}</span>
            </div>
            {fees.parentFee > 0 && (
              <div className="flex justify-between text-amber-300">
                <span>{language === 'bn' ? 'অভিভাবক ফি (১ জন)' : 'Accompanying Parent Fee (1 Person)'}</span>
                <span className="font-semibold">+ ৳ {fees.parentFee}</span>
              </div>
            )}
            {fees.donationAmount > 0 && (
              <div className="flex justify-between text-[#38BDF8]">
                <span>{t.donationSummary}</span>
                <span className="font-semibold">+ ৳ {fees.donationAmount}</span>
              </div>
            )}
            <div className="pt-2 border-t border-slate-800/80 flex justify-between text-slate-300">
              <span>{language === 'bn' ? 'গেটওয়ে চার্জ (১.৮%)' : 'Gateway Charge (1.8%)'}</span>
              <span className="font-semibold text-indigo-300">+ ৳ {gatewayCharge.toLocaleString()}</span>
            </div>
            <div className="pt-3 border-t border-slate-800 flex justify-between items-center text-lg sm:text-xl font-black text-[#38BDF8]">
              <span>{t.totalPayable}</span>
              <span>৳ {totalPayableWithCharge.toLocaleString()} BDT</span>
            </div>
          </div>

          {isGlobalRegistrationOpen(feeSettings) && isCategoryRegistrationOpen(category, feeSettings) ? (
            <button
              type="submit"
              disabled={isSubmitting || isProcessingPayment}
              className={`w-full py-4 rounded-full text-white font-black text-base shadow-lg transition-all flex items-center justify-center gap-2 ${
                isSubmitting || isProcessingPayment
                  ? 'bg-sky-400 cursor-not-allowed opacity-80'
                  : 'bg-[#0284C7] hover:bg-[#0EA5E9] shadow-sky-600/30 cursor-pointer active:scale-98'
              }`}
            >
              {isSubmitting || isProcessingPayment ? (
                <>
                  <RefreshCw className="w-5 h-5 text-white animate-spin" />
                  <span>{language === 'bn' ? 'PayStation চেকআউটে যাওয়া হচ্ছে...' : 'Redirecting to PayStation...'}</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5 text-[#38BDF8]" />
                  <span>{t.btnProceedToPayment} (৳ {totalPayableWithCharge.toLocaleString()})</span>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              disabled
              className="w-full py-4 rounded-full bg-slate-800 text-slate-400 font-bold text-base shadow-lg cursor-not-allowed flex items-center justify-center gap-2 border border-slate-700"
            >
              <Lock className="w-5 h-5 text-slate-500" />
              <span>{t.btnRegistrationClosed}</span>
            </button>
          )}
        </div>
          </>
        )}
      </form>
      )}

      {/* Size Chart Modal */}
      {showSizeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Shirt className="w-4 h-4 text-[#0284C7]" />
                <span>{t.sizeGuide}</span>
              </h3>
              <button
                onClick={() => setShowSizeModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <th className="py-2 px-3">Size</th>
                  <th className="py-2 px-3">{t.sizeChest}</th>
                  <th className="py-2 px-3">{t.sizeLength}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr><td className="py-2 px-3 font-bold">S</td><td className="py-2 px-3">36"</td><td className="py-2 px-3">26"</td></tr>
                <tr><td className="py-2 px-3 font-bold">M</td><td className="py-2 px-3">38"</td><td className="py-2 px-3">27"</td></tr>
                <tr><td className="py-2 px-3 font-bold">L</td><td className="py-2 px-3">40"</td><td className="py-2 px-3">28"</td></tr>
                <tr><td className="py-2 px-3 font-bold">XL</td><td className="py-2 px-3">42"</td><td className="py-2 px-3">29"</td></tr>
                <tr><td className="py-2 px-3 font-bold">XXL</td><td className="py-2 px-3">44"</td><td className="py-2 px-3">30"</td></tr>
                <tr><td className="py-2 px-3 font-bold">XXXL</td><td className="py-2 px-3">46"</td><td className="py-2 px-3">31"</td></tr>
              </tbody>
            </table>

            <button
              onClick={() => setShowSizeModal(false)}
              className="mt-6 w-full py-2.5 bg-[#0F172A] hover:bg-slate-800 text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors"
            >
              {language === 'bn' ? 'বুঝেছি' : 'Close Chart'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
