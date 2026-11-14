import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import {
  StudentCategory,
  TShirtSize,
  Language,
  FeeSettings,
  StudentIdVerificationResult,
} from '../types';
import { translations } from '../i18n/translations';
import {
  validateRegistrationData,
  calculateTotalFee,
  normalizeBangladeshiMobileNumber,
  RegistrationFormData,
} from '../utils/rules';
import { StudentIdService } from '../services/studentIdStore';
import { readValidatedImage } from '../utils/fileValidation';
import { AppStore } from '../services/store';
import { PayStationService } from '../services/paystation';
import { StudentIdCardRecord } from '../types/idcard';
import { SynchronizedCameraCardModal } from './idcard/SynchronizedCameraCardModal';

interface RegistrationPageProps {
  language: Language;
  feeSettings: FeeSettings;
  initialData?: RegistrationFormData | null;
  onInitiatePayment: (formData: RegistrationFormData, fees: { registrationFee: number; donationAmount: number; totalPayable: number }) => void;
  onNavigate: (view: string) => void;
}

const SAMPLE_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop&q=80',
];

export const RegistrationPage: React.FC<RegistrationPageProps> = ({
  language,
  feeSettings,
  initialData,
  onInitiatePayment,
  onNavigate: _onNavigate,
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
  const [mobileNumber, setMobileNumber] = useState(() => draft?.mobileNumber || '');
  const [email, setEmail] = useState(() => draft?.email || ''); // OPTIONAL
  const [address, setAddress] = useState(() => draft?.address || '');
  const [category, setCategory] = useState<StudentCategory>(() => draft?.category || 'former');

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
  const [termsAccepted, setTermsAccepted] = useState(() => Boolean(draft?.termsAccepted));

  // Auto-save form draft to localStorage on any field update
  useEffect(() => {
    try {
      const currentDraft = {
        fullName,
        photoUrl,
        mobileNumber,
        email,
        address,
        category,
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
    } catch {}
  }, [
    fullName,
    photoUrl,
    mobileNumber,
    email,
    address,
    category,
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

  // Synchronize form fields whenever initialData is provided or updated (e.g. after failed payment or return)
  useEffect(() => {
    if (!initialData) return;
    if (initialData.fullName !== undefined) setFullName(initialData.fullName || '');
    if (initialData.photoUrl !== undefined) setPhotoUrl(initialData.photoUrl || '');
    if (initialData.mobileNumber !== undefined) setMobileNumber(initialData.mobileNumber || '');
    if (initialData.email !== undefined) setEmail(initialData.email || '');
    if (initialData.address !== undefined) setAddress(initialData.address || '');
    if (initialData.category !== undefined) setCategory(initialData.category || 'former');
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

  const donationAmount = typeof donationInput === 'number' ? donationInput : 0;
  const fees = calculateTotalFee(category, feeSettings, donationAmount);

  // Auto-generate batch suggestion if empty
  const getComputedBatch = () => {
    if (batchName.trim()) return batchName;
    if (category === 'former') {
      return `SSC ${passingYear || 'Batch'}`;
    }
    return `${currentClass} (${groupOrSection})`;
  };

  // Open Synchronized Live Camera & ID Card Preview Modal
  const openLiveCamera = () => {
    setModalInitialImage(null);
    setIsCameraModalOpen(true);
  };

  // Callback when user confirms photo crop in the modal
  const handlePhotoConfirmed = (confirmedDataUrl: string, sizeKb: number) => {
    setPhotoUrl(confirmedDataUrl);
    setPhotoSizeKb(sizeKb);
    setValidationErrors((current) => {
      const next = { ...current };
      delete next.photoUrl;
      return next;
    });
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

  // Live Student ID Card Preview Record (placeholder "XXXXXX" style for pre-registration camera preview)
  const previewStudentRecord: StudentIdCardRecord = {
    id: `PREVIEW-${Date.now()}`,
    registrationId: 'PLSC-XXXX-XXXX',
    eventYear: 2027,
    idNumber: 'PLSC-XXXX-XXXX',
    studentName: fullName.trim() || (language === 'bn' ? 'আপনার নাম' : 'Your Full Name'),
    batchName: 'XXXXXX',
    batchYear: 'XXXXXX',
    contactNumber: '01XXXXXXXXX',
    photoUrl: photoUrl || '',
    hasPhoto: Boolean(photoUrl),
    qrToken: 'XXXXXX',
    verificationUrl: `${typeof window !== 'undefined' ? window.location.origin : ''}/ticket-verification?token=PREVIEW`,
    cardStatus: 'ELIGIBLE',
    cardDimensions: '54x86mm',
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Student ID Verification Handler
  const handleVerifyStudentId = (idToVerify?: string) => {
    const rawId = (idToVerify !== undefined ? idToVerify : studentId).trim();
    if (!rawId) {
      setIdVerificationResult(null);
      return;
    }
    setIsVerifyingId(true);
    setTimeout(() => {
      const res = StudentIdService.verifyStudentId(rawId);
      setIdVerificationResult(res);
      setIsVerifyingId(false);

      if (res.success && res.record) {
        if (res.record.studentName && !fullName) {
          setFullName(res.record.studentName);
        }
        if (res.record.className) {
          setCurrentClass(res.record.className);
        }
        if (validationErrors.studentId) {
          const next = { ...validationErrors };
          delete next.studentId;
          setValidationErrors(next);
        }
      }
    }, 150);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!feeSettings.registrationOpen) {
      return;
    }

    const formData: RegistrationFormData = {
      fullName,
      photoUrl,
      mobileNumber,
      email: email.trim() || undefined,
      address,
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
      termsAccepted,
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

    const normalizedMobileNumber = normalizeBangladeshiMobileNumber(mobileNumber);
    if (
      normalizedMobileNumber &&
      AppStore.getRegistrations().some(
        (registration) =>
          normalizeBangladeshiMobileNumber(registration.mobileNumber) === normalizedMobileNumber
      )
    ) {
      customErrors.mobileNumber = {
        en: 'This mobile number is already registered. Use a different number.',
        bn: 'এই মোবাইল নম্বরটি ইতোমধ্যে নিবন্ধিত। অনুগ্রহ করে অন্য নম্বর দিন।',
      };
    }

    if (Object.keys(customErrors).length > 0) {
      setValidationErrors(customErrors);
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

  const currentClasses = [
    'Class 6',
    'Class 7',
    'Class 8',
    'Class 9',
    'Class 10',
    'Class 11 (HSC)',
    'Class 12 (HSC)',
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
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

        {!feeSettings.registrationOpen && (
          <div className="mt-4 p-4 rounded-2xl bg-rose-50 border-2 border-rose-300 text-rose-900 max-w-2xl mx-auto text-left shadow-sm">
            <div className="flex items-center gap-2 font-bold text-rose-800 mb-1">
              <Lock className="w-4 h-4 text-rose-600" />
              <span>{t.regStatusClosedBadge}</span>
            </div>
            <p className="text-xs text-rose-700 leading-relaxed">
              {language === 'bn'
                ? feeSettings.closedMessageBn || t.regClosedNoticeDefault
                : feeSettings.closedMessageEn || t.regClosedNoticeDefault}
            </p>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-8" noValidate>
        {/* Category Selector Card - RAW FORM tokens */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-[#E2EEF8]">
          <label className="block text-sm font-bold text-[#0F172A] mb-3">
            {t.categoryLabel} *
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                category === 'former'
                  ? 'border-[#0284C7] bg-[#E2EEF8]/40 shadow-xs'
                  : 'border-[#E2EEF8] hover:border-slate-300 bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#0F172A] text-base">
                  {t.categoryFormer}
                </span>
                <span className="px-3 py-1 rounded-full bg-[#0284C7] text-white font-extrabold text-xs">
                  ৳ {feeSettings.formerStudentFee}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {language === 'bn'
                  ? '১৯৬২ থেকে ২০২৫ সাল পর্যন্ত সকল পাসের ব্যাচ'
                  : 'All alumni batches from 1962 to 2025'}
              </p>
            </button>

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
                category === 'current'
                  ? 'border-[#0EA5E9] bg-[#E2EEF8]/40 shadow-xs'
                  : 'border-[#E2EEF8] hover:border-slate-300 bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#0F172A] text-base">
                  {t.categoryCurrent}
                </span>
                <span className="px-3 py-1 rounded-full bg-[#0EA5E9] text-white font-extrabold text-xs">
                  ৳ {feeSettings.currentStudentFee}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {language === 'bn'
                  ? 'বিদ্যালয় ও কলেজ শাখায় বর্তমানে অধ্যয়নরত শিক্ষার্থী (আইডি আবশ্যক)'
                  : 'Currently enrolled school & college students (Student ID required)'}
              </p>
            </button>
          </div>
        </div>

        {/* Section 1: Personal Information */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-6">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <User className="w-5 h-5 text-[#263B8C]" />
            <h2 className="text-lg font-bold text-slate-900">
              {t.personalInfoHeading}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Full Name */}
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
                    : 'border-slate-300 focus:border-[#172554] focus:ring-2 focus:ring-[#172554]/20'
                }`}
              />
              {validationErrors.fullName && (
                <p className="mt-1 text-xs text-rose-600 flex items-center gap-1 font-medium">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{validationErrors.fullName[language]}</span>
                </p>
              )}
            </div>

            {/* Profile Photo Upload & Live Camera Capture (Requirement 4) */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                <span>
                  {t.photoLabel} <span className="text-rose-600">*</span>
                </span>
                <span className="text-[10px] text-sky-700 font-medium bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200">
                  {language === 'bn' ? 'সর্বোচ্চ ২০০ কেবিতে কম্প্রেসড হবে' : 'Auto-compressed to ≤ 200 KB'}
                </span>
              </label>

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
                      className="w-24 h-24 rounded-xl object-cover border-2 border-[#172554] shadow-sm mx-auto"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setPhotoUrl('');
                        setPhotoSizeKb(null);
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
                      className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shadow-xs cursor-pointer transition-colors inline-flex items-center gap-1.5"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>{language === 'bn' ? '📷 ক্যামেরা দিয়ে ছবি তুলুন' : '📷 Take Photo'}</span>
                    </button>

                    {/* 2. Upload File Button */}
                    <label className="px-4 py-2 rounded-lg bg-[#172554] hover:bg-[#263B8C] text-white text-xs font-semibold shadow-xs cursor-pointer transition-colors inline-flex items-center gap-1.5">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{language === 'bn' ? '📁 ফাইল আপলোড করুন' : '📁 Upload Photo'}</span>
                      <input
                        type="file"
                        name="photoUrl"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handlePhotoUpload}
                        className="hidden"
                      />
                    </label>

                    {/* Quick Sample Avatars */}
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 ml-auto">
                      <span className="text-[11px] font-medium hidden md:inline">
                        {language === 'bn' ? 'নমুনা:' : 'Sample:'}
                      </span>
                      {SAMPLE_AVATARS.map((avatar, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setPhotoUrl(avatar);
                            setPhotoSizeKb(48);
                            if (validationErrors.photoUrl) {
                              const next = { ...validationErrors };
                              delete next.photoUrl;
                              setValidationErrors(next);
                            }
                          }}
                          className="w-8 h-8 rounded-lg overflow-hidden border border-slate-300 hover:scale-110 transition-transform cursor-pointer"
                          title="Use sample photo"
                        >
                          <img src={avatar} alt={`Avatar ${idx}`} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
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

            {/* Synchronized Camera Capture & Live Student ID Card Preview Modal */}
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
                    const cleaned = e.target.value.replace(/[^\d]/g, '').slice(0, 11);
                    setMobileNumber(cleaned);
                    clearValidationError('mobileNumber');
                  }}
                  placeholder="017XXXXXXXX"
                  maxLength={11}
                  className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm font-mono transition-all focus:outline-hidden ${
                    validationErrors.mobileNumber
                      ? 'border-rose-500 bg-rose-50/30 focus:ring-2 focus:ring-rose-500'
                      : 'border-slate-300 focus:border-[#172554] focus:ring-2 focus:ring-[#172554]/20'
                  }`}
                />
              </div>
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                {language === 'bn'
                  ? '১১ ডিজিট; প্রতিটি নিবন্ধনের জন্য আলাদা মোবাইল নম্বর আবশ্যক'
                  : '11 digits; each registration must use a different mobile number'}
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
                      : 'border-slate-300 focus:border-[#172554] focus:ring-2 focus:ring-[#172554]/20'
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
                  name="studentId"
                  aria-invalid={Boolean(validationErrors.studentId)}
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder={t.addressPlaceholder}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-[#172554] focus:ring-2 focus:ring-[#172554]/20 focus:outline-hidden"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Academic Information & Current Student ID Verification */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-6">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <GraduationCap className="w-5 h-5 text-[#263B8C]" />
            <h2 className="text-lg font-bold text-slate-900">
              {t.academicInfoHeading}
            </h2>
          </div>

          {/* CURRENT STUDENT SPECIFIC: MANDATORY VERIFIED STUDENT ID */}
          {category === 'current' && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              {/* Testing Student ID Banner */}
              <div className="p-2.5 bg-sky-50 border border-sky-300 text-sky-900 rounded-xl text-xs flex flex-wrap items-center justify-between gap-2 shadow-2xs">
                <div className="flex items-center gap-1.5 font-medium flex-wrap">
                  <span className="font-bold text-sky-950">🧪 Testing Student ID:</span>
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
                  Auto-fill & Verify
                </button>
              </div>

              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-900">
                  {language === 'bn' ? 'স্টুডেন্ট আইডি নম্বর *' : 'Student ID Number *'}{' '}
                  <span className="text-rose-600">*</span>
                </label>
                <span className="text-[11px] text-[#263B8C] font-semibold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {language === 'bn' ? 'প্রতিষ্ঠানিক আইডি ভেরিফিকেশন' : 'Institutional ID Verification'}
                </span>
              </div>

              <div className="flex gap-2">
                <div className="relative flex-1">
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
                    onBlur={() => {
                      if (studentId.trim() && !idVerificationResult) {
                        handleVerifyStudentId(studentId);
                      }
                    }}
                    placeholder="e.g. PLSC-2026-101"
                    className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm font-mono tracking-wide uppercase transition-all focus:outline-hidden ${
                      idVerificationResult?.success
                        ? 'border-emerald-500 bg-emerald-50/40'
                        : idVerificationResult && !idVerificationResult.success
                        ? 'border-rose-500 bg-rose-50/40'
                        : 'border-slate-300 focus:border-[#172554] focus:ring-2 focus:ring-[#172554]/20'
                    }`}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleVerifyStudentId(studentId)}
                  disabled={!studentId.trim() || isVerifyingId}
                  className="px-4 py-2.5 rounded-xl bg-[#172554] hover:bg-[#263B8C] text-white font-bold text-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>{isVerifyingId ? (language === 'bn' ? 'যাচাই হচ্ছে...' : 'Verifying...') : (language === 'bn' ? 'যাচাই করুন' : 'Verify ID')}</span>
                </button>
              </div>

              {/* Sample IDs helper to assist user testing */}
              <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-1.5 pt-1">
                <span className="font-semibold text-slate-700">
                  {language === 'bn' ? 'নমুনা ভেরিফাইড আইডি:' : 'Test IDs:'}
                </span>
                {['PLSC-2026-101', 'PLSC-2026-104', 'PLSC-2026-105', 'PLSC-2026-106'].map((demoId) => (
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

              {/* Status Message Badges */}
              {idVerificationResult && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-start gap-2 border ${
                    idVerificationResult.success
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                      : idVerificationResult.status === 'ALREADY_USED'
                      ? 'bg-rose-50 border-rose-300 text-rose-800'
                      : idVerificationResult.status === 'INACTIVE'
                      ? 'bg-amber-50 border-amber-300 text-amber-800'
                      : 'bg-rose-50 border-rose-300 text-rose-800'
                  }`}
                >
                  {idVerificationResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className="font-bold">
                      {language === 'bn' ? idVerificationResult.messageBn : idVerificationResult.messageEn}
                    </div>
                    {idVerificationResult.record && (
                      <div className="text-[11px] text-slate-600 mt-0.5">
                        {language === 'bn'
                          ? `শিক্ষার্থী: ${idVerificationResult.record.studentName || 'এন/এ'} | শ্রেণি: ${idVerificationResult.record.className || 'এন/এ'}`
                          : `Student: ${idVerificationResult.record.studentName || 'N/A'} | Class: ${idVerificationResult.record.className || 'N/A'}`}
                      </div>
                    )}
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
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {category === 'former' ? (
              /* Former Student: Graduation / Last Attended Year is MANDATORY */
              <>
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
                        : 'border-slate-300 focus:border-[#172554] focus:ring-2 focus:ring-[#172554]/20'
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
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-[#172554] focus:ring-2 focus:ring-[#172554]/20 focus:outline-hidden"
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
              </>
            ) : (
              /* Current Student: Current Class & Section */
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    {t.currentClassLabel} <span className="text-rose-600">*</span>
                  </label>
                  <select
                    name="currentClass"
                    aria-invalid={Boolean(validationErrors.currentClass)}
                    value={currentClass}
                    onChange={(e) => {
                      setCurrentClass(e.target.value);
                      clearValidationError('currentClass');
                    }}
                    className={`w-full px-4 py-2.5 rounded-xl border text-sm transition-all focus:outline-hidden ${
                      validationErrors.currentClass
                        ? 'border-rose-500 bg-rose-50/30'
                        : 'border-slate-300 focus:border-[#172554] focus:ring-2 focus:ring-[#172554]/20'
                    }`}
                  >
                    <option value="">{t.currentClassPlaceholder}</option>
                    {currentClasses.map((cls) => (
                      <option key={cls} value={cls}>
                        {cls}
                      </option>
                    ))}
                  </select>
                  {validationErrors.currentClass && (
                    <p className="mt-1 text-xs text-rose-600 flex items-center gap-1 font-medium">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>{validationErrors.currentClass[language]}</span>
                    </p>
                  )}
                </div>

                {/* Section / Group for Current Students */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    {language === 'bn' ? 'শাখা / বিভাগ' : 'Section / Group'}
                  </label>
                  <select
                    value={groupOrSection}
                    onChange={(e) => setGroupOrSection(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-[#172554] focus:ring-2 focus:ring-[#172554]/20 focus:outline-hidden"
                  >
                    <option value="Section A">Section A (ক শাখা)</option>
                    <option value="Section B">Section B (খ শাখা)</option>
                    <option value="Science">Science (বিজ্ঞান)</option>
                    <option value="Humanities">Humanities (মানবিক)</option>
                    <option value="Business Studies">Business Studies (ব্যবসায় শিক্ষা)</option>
                    <option value="General">General (সাধারণ)</option>
                  </select>
                </div>
              </>
            )}

            {/* Batch Name / Identifier */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {t.batchNameLabel}
              </label>
              <input
                type="text"
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
                placeholder={getComputedBatch()}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-[#172554] focus:ring-2 focus:ring-[#172554]/20 focus:outline-hidden"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                {language === 'bn'
                  ? 'খালি রাখলে স্বয়ংক্রিয় ব্যাচ নির্ধারণ হবে।'
                  : 'Defaults automatically to selected passing year or class.'}
              </span>
            </div>

            {/* Roll Number (for current students) */}
            {category === 'current' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {t.rollNumberLabel}
                </label>
                <input
                  type="text"
                  value={rollNumber}
                  onChange={(e) => setRollNumber(e.target.value)}
                  placeholder="e.g. 05"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-[#172554] focus:ring-2 focus:ring-[#172554]/20 focus:outline-hidden"
                />
              </div>
            )}
          </div>
        </div>

        {/* Section 3: T-shirt Selection */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Shirt className="w-5 h-5 text-[#263B8C]" />
              <h2 className="text-lg font-bold text-slate-900">{t.tshirtHeading}</h2>
            </div>
            <button
              type="button"
              onClick={() => setShowSizeModal(true)}
              className="text-xs text-[#263B8C] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
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
                  tShirtSize === size
                    ? 'border-[#172554] bg-[#172554] text-white shadow-xs'
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

        {/* Section 4: Optional Donation */}
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
                    ? 'border-[#263B8C] bg-[#263B8C] text-white font-bold'
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
              className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-[#172554] focus:ring-2 focus:ring-[#172554]/20 focus:outline-hidden"
            />
          </div>
        </div>

        {/* Section 5: Order Summary & Terms - SOLID DEEP NAVY BLUE, STRICTLY ZERO GRADIENTS */}
        <div className="bg-[#172554] text-white rounded-2xl p-6 sm:p-8 shadow-xl space-y-6">
          <h2 className="text-lg font-bold border-b border-blue-900 pb-3 flex items-center justify-between">
            <span>{t.summaryHeading}</span>
            <span className="text-xs text-[#C5A45D] font-normal">
              {category === 'former' ? t.feeFormerTitle : t.feeCurrentTitle}
            </span>
          </h2>

          <div className="space-y-2.5 text-sm text-slate-200">
            <div className="flex justify-between">
              <span>{t.regFeeSummary}</span>
              <span className="font-semibold text-white">৳ {fees.registrationFee}</span>
            </div>
            {fees.donationAmount > 0 && (
              <div className="flex justify-between text-[#C5A45D]">
                <span>{t.donationSummary}</span>
                <span className="font-semibold">+ ৳ {fees.donationAmount}</span>
              </div>
            )}
            <div className="pt-3 border-t border-blue-900 flex justify-between items-center text-lg sm:text-xl font-black text-[#C5A45D]">
              <span>{t.totalPayable}</span>
              <span>৳ {fees.totalPayable} BDT</span>
            </div>
          </div>

          {/* Terms checkbox */}
          <div className="pt-2">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                name="termsAccepted"
                aria-invalid={Boolean(validationErrors.termsAccepted)}
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => {
                  setTermsAccepted(e.target.checked);
                  clearValidationError('termsAccepted');
                  if (validationErrors.termsAccepted) {
                    const next = { ...validationErrors };
                    delete next.termsAccepted;
                    setValidationErrors(next);
                  }
                }}
                className="mt-1 w-4 h-4 rounded border-slate-700 text-[#263B8C] focus:ring-[#263B8C]"
              />
              <span className="text-xs text-slate-300 leading-relaxed">
                {t.termsText}
              </span>
            </label>
            {validationErrors.termsAccepted && (
              <p className="mt-1.5 text-xs text-rose-300 flex items-center gap-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{validationErrors.termsAccepted[language]}</span>
              </p>
            )}
          </div>

          {feeSettings.registrationOpen ? (
            <button
              type="submit"
              className="w-full py-4 rounded-full bg-[#0284C7] hover:bg-[#0EA5E9] text-white font-black text-base shadow-lg shadow-sky-600/30 transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98"
            >
              <ShieldCheck className="w-5 h-5 text-[#38BDF8]" />
              <span>{t.btnProceedToPayment} (৳ {fees.totalPayable})</span>
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
      </form>

      {/* Size Chart Modal */}
      {showSizeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Shirt className="w-4 h-4 text-[#263B8C]" />
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
              className="mt-6 w-full py-2 bg-[#172554] text-white rounded-lg text-xs font-semibold cursor-pointer"
            >
              {language === 'bn' ? 'বুঝেছি' : 'Close Chart'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
