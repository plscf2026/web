/**
 * Manual Student Registration Portal (Admin Venue Assistance)
 * Police Lines High School & College, Faridpur — Grand Reunion 2027
 * Enables authorized staff/admins to register attendees on-site, generate scannable tickets with QR codes,
 * and submit optional financial entries for Super Admin review.
 */

import React, { useState, useMemo, useRef } from 'react';
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
} from 'lucide-react';
import {
  Language,
  StudentCategory,
  TShirtSize,
  AdminAccount,
  RegistrationRecord,
  ManualRegistrationInput,
} from '../../../types';
import { ManualRegistrationService } from '../../../services/manualRegistrationService';
import { AppStore } from '../../../services/store';
import { SynchronizedCameraCardModal } from '../../idcard/SynchronizedCameraCardModal';
import { TicketView } from '../../TicketView';
import { isValidBangladeshiMobile, normalizeBangladeshiMobileNumber } from '../../../utils/rules';
import { StudentPhotoStorageService } from '../../../services/studentPhotoStorageService';
import { readValidatedImage } from '../../../utils/fileValidation';
import { compressImageTo200KB } from '../../../utils/imageCompressor';

interface ManualRegistrationTabProps {
  language: Language;
  currentAdmin: AdminAccount;
}

const T_SHIRT_SIZES: TShirtSize[] = ['S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'Oversize 50'];

export const ManualRegistrationTab: React.FC<ManualRegistrationTabProps> = ({
  language,
  currentAdmin,
}) => {
  const isBangla = language === 'bn';

  // ── Form State ─────────────────────────────────────────────────────────────
  const [fullName, setFullName] = useState('');
  const [fullNameBn, setFullNameBn] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const photoFileInputRef = useRef<HTMLInputElement | null>(null);
  const [mobileNumber, setMobileNumber] = useState('');
  const [email, setEmail] = useState('');
  const [category, setCategory] = useState<StudentCategory>('former');
  const [passingYear, setPassingYear] = useState('2014');
  const [lastClassAttended, setLastClassAttended] = useState('');
  const [currentClass, setCurrentClass] = useState('Class 10');
  const [studentId, setStudentId] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [groupOrSection, setGroupOrSection] = useState('Section A');
  const [tShirtSize, setTShirtSize] = useState<TShirtSize>('L');
  const [bloodGroup, setBloodGroup] = useState('B+');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [address, setAddress] = useState('Faridpur');
  const [hasParent, setHasParent] = useState(false);
  const [parentName, setParentName] = useState('');
  const [parentRelation, setParentRelation] = useState('Father');
  const [parentPhone, setParentPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [documentName, setDocumentName] = useState('');
  const [documentUrl, setDocumentUrl] = useState('');

  // ── Optional Financial Section ─────────────────────────────────────────────
  const [hasFinancialAmount, setHasFinancialAmount] = useState(false);
  const [financialAmount, setFinancialAmount] = useState<string>('1500');
  const [financialDescription, setFinancialDescription] = useState('Venue cash payment');
  const [financialMethod, setFinancialMethod] = useState('Cash');
  const [financialReference, setFinancialReference] = useState('');
  const [financialNotes, setFinancialNotes] = useState('');

  // ── Modals & Processing States ─────────────────────────────────────────────
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [generatedRegistration, setGeneratedRegistration] = useState<RegistrationRecord | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Auto-calculated batch name
  const batchName = useMemo(() => {
    if (category === 'former') {
      return passingYear ? `SSC ${passingYear}` : 'Alumni';
    }
    return `${currentClass} (${groupOrSection})`;
  }, [category, passingYear, currentClass, groupOrSection]);

  // Duplicate Check in Real Time
  const duplicateWarning = useMemo(() => {
    if (!mobileNumber.trim()) return null;
    const cleanPhone = normalizeBangladeshiMobileNumber(mobileNumber.trim());
    const all = AppStore.getRegistrations();
    const match = all.find((r) => normalizeBangladeshiMobileNumber(r.mobileNumber) === cleanPhone);
    if (match) {
      return isBangla
        ? `সতর্কতা: এই মোবাইল নম্বরে (${mobileNumber}) ইতোমধ্যে একজন শিক্ষার্থী নিবন্ধিত: ${match.fullName} (আইডি: ${match.id})`
        : `Warning: Mobile ${mobileNumber} already registered for ${match.fullName} (ID: ${match.id})`;
    }
    return null;
  }, [mobileNumber, isBangla]);

  // Reset form
  const handleResetForm = () => {
    setFullName('');
    setFullNameBn('');
    setMobileNumber('');
    setEmail('');
    setStudentId('');
    setRollNumber('');
    setNotes('');
    setHasParent(false);
    setParentName('');
    setParentPhone('');
    setHasFinancialAmount(false);
    setFinancialAmount('1500');
    setFinancialReference('');
    setDocumentName('');
    setDocumentUrl('');
    setPhotoUrl('');
    setErrorMessage(null);
    if (photoFileInputRef.current) {
      photoFileInputRef.current.value = '';
    }
  };

  // Student Photo upload handler directly to Supabase Storage student-photos bucket
  const handlePhotoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingPhoto(true);
    setErrorMessage(null);
    try {
      const validDataUrl = await readValidatedImage(file);
      const compressed = await compressImageTo200KB(validDataUrl);
      const res = await StudentPhotoStorageService.uploadStudentPhoto({
        fileOrDataUrl: compressed.dataUrl,
        registrationId: studentId.trim() || `VENUE-${Date.now()}`,
        batchYear: passingYear || undefined,
        category,
        currentClass: currentClass || undefined,
        isParent: false,
      });
      if (res.success && res.publicUrl) {
        setPhotoUrl(res.publicUrl);
      } else {
        setErrorMessage(res.error || (isBangla ? 'ছবি আপলোড ব্যর্থ হয়েছে।' : 'Failed to upload photo to storage.'));
      }
    } catch (err: any) {
      setErrorMessage(err?.message || (isBangla ? 'ছবি ভ্যালিডেশন বা আপলোডে ত্রুটি।' : 'Error processing image file.'));
    } finally {
      setIsUploadingPhoto(false);
      if (photoFileInputRef.current) {
        photoFileInputRef.current.value = '';
      }
    }
  };

  // Document upload simulation
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

  // Submit Handler: Generate Student Ticket
  const handleGenerateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!fullName.trim()) {
      setErrorMessage(isBangla ? 'শিক্ষার্থীর পুরো নাম লিখুন।' : 'Student Full Name is required.');
      return;
    }

    if (!mobileNumber.trim() || !isValidBangladeshiMobile(mobileNumber.trim())) {
      setErrorMessage(
        isBangla
          ? 'অনুগ্রহ করে সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন (যেমন: 017XXXXXXXX)।'
          : 'Please enter a valid 11-digit Bangladeshi mobile number.'
      );
      return;
    }

    if (category === 'current' && !studentId.trim()) {
      setErrorMessage(
        isBangla
          ? 'বর্তমান শিক্ষার্থীদের জন্য স্টুডেন্ট আইডি প্রদান আবশ্যক।'
          : 'Student ID is mandatory for Current Students.'
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const input: ManualRegistrationInput = {
        fullName,
        fullNameBn,
        photoUrl,
        mobileNumber,
        email: email.trim() || undefined,
        category,
        studentId: studentId.trim() || undefined,
        passingYear: category === 'former' ? passingYear : undefined,
        lastClassAttended: category === 'former' ? lastClassAttended : undefined,
        currentClass: category === 'current' ? currentClass : undefined,
        batchName,
        groupOrSection: category === 'current' ? groupOrSection : undefined,
        rollNumber: category === 'current' ? rollNumber : undefined,
        tShirtSize,
        address,
        gender,
        bloodGroup,
        hasParent,
        parentName: hasParent ? parentName : undefined,
        parentRelation: hasParent ? parentRelation : undefined,
        parentPhone: hasParent ? parentPhone : undefined,
        notes,
        documentUrl: documentUrl || undefined,
        documentName: documentName || undefined,
        financialAmount: hasFinancialAmount ? Number(financialAmount) || 0 : 0,
        financialDescription: hasFinancialAmount ? financialDescription : undefined,
        financialMethod: hasFinancialAmount ? financialMethod : undefined,
        financialReference: hasFinancialAmount ? financialReference : undefined,
        financialNotes: hasFinancialAmount ? financialNotes : undefined,
      };

      const res = await ManualRegistrationService.createManualRegistration(input, {
        id: currentAdmin.id,
        name: currentAdmin.fullName || currentAdmin.username,
      });

      if (res.success && res.registration) {
        setGeneratedRegistration(res.registration);
        setShowSuccessModal(true);
        handleResetForm();
      } else {
        setErrorMessage(res.error || 'Failed to generate manual registration.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'System error while generating ticket.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* ── Top Header Banner ── */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-indigo-800/40 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-slate-950" />
                <span>{isBangla ? 'অন-সাইট ম্যানুয়াল ডেস্ক' : 'VENUE DESK PORTAL'}</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-bold border border-indigo-400/30">
                {isBangla ? 'অনুমোদন সাপেক্ষ টিকিট' : 'Pending Super Admin Approval'}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {isBangla ? 'ম্যানুয়াল শিক্ষার্থী নিবন্ধন ও টিকিট তৈরি' : 'Manual Student Registration & Ticket Generation'}
            </h2>
            <p className="text-xs sm:text-sm text-indigo-200/80 leading-relaxed">
              {isBangla
                ? 'অনলাইনে নিবন্ধন করতে না পারা ও ভেন্যুতে সরাসরি উপস্থিত শিক্ষার্থীদের জন্য অ্যাডমিন সহায়তায় তাত্ক্ষণিক রেজিস্ট্রেশন ও কিউআর টিকিট ইস্যু করুন। টিকিটটি সুপার অ্যাডমিন অনুমোদনের পর সক্রিয় হবে।'
                : 'Register attendees directly at the event venue. Generate instant digital tickets with unique QR codes. The ticket remains PENDING_APPROVAL until reviewed and approved by the Super Admin.'}
            </p>
          </div>

          <div className="flex items-center gap-2 bg-slate-800/80 p-3 rounded-2xl border border-slate-700/60 self-start sm:self-auto shrink-0">
            <Lock className="w-5 h-5 text-amber-400 shrink-0" />
            <div className="text-xs">
              <span className="block text-slate-400 text-[10px]">{isBangla ? 'নিবন্ধনকারী কর্মকর্তা:' : 'Assisting Staff:'}</span>
              <span className="font-bold text-white">{currentAdmin.fullName || currentAdmin.username}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Duplicate Warning Banner ── */}
      {duplicateWarning && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex items-start gap-3 text-amber-950 text-xs shadow-xs animate-in fade-in">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-extrabold block">{isBangla ? 'সম্ভাব্য ডুপ্লিকেট সতর্কতা' : 'Duplicate Record Alert'}</span>
            <p className="text-amber-900 mt-0.5 leading-relaxed">{duplicateWarning}</p>
          </div>
        </div>
      )}

      {/* ── Error Banner ── */}
      {errorMessage && (
        <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-4 flex items-start gap-3 text-rose-950 text-xs shadow-xs animate-in shake">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-extrabold block">{isBangla ? 'ত্রুটি' : 'Submission Error'}</span>
            <p className="text-rose-900 mt-0.5">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* ── Registration Form ── */}
      <form onSubmit={handleGenerateTicket} className="space-y-8">
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <User className="w-4 h-4 text-indigo-600" />
              <span>{isBangla ? '১. শিক্ষার্থীর ব্যক্তিগত ও একাডেমিক তথ্য' : '1. Student Personal & Academic Details'}</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {isBangla
                ? 'শিক্ষার্থীর সঠিক নাম, ছবি এবং ব্যাচের তথ্য পূরণ করুন।'
                : 'Enter accurate attendee personal details, photograph, and graduation batch.'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {/* Col 1: Photo Selection / Capture */}
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
                    <span className="text-[10px] mt-1 font-medium">{isBangla ? 'ছবি নেই' : 'No Photo'}</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setIsCameraOpen(true)}
                  className="absolute -bottom-2 -right-2 p-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md cursor-pointer transition-transform hover:scale-105"
                  title={isBangla ? 'ক্যামেরা দিয়ে ছবি তুলুন' : 'Capture via Camera'}
                >
                  <Camera className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2 w-full">
                <button
                  type="button"
                  disabled={isUploadingPhoto}
                  onClick={() => setIsCameraOpen(true)}
                  className="w-full py-1.5 px-3 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                >
                  <Camera className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{isBangla ? 'লাইভ ক্যামেরা' : 'Open Camera'}</span>
                </button>

                <label className="w-full py-1.5 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs">
                  <Upload className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{isBangla ? 'ফাইল থেকে আপলোড' : 'Upload File'}</span>
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
                  <div className="flex items-center justify-center gap-1.5 text-xs text-sky-700 font-medium py-1 animate-pulse">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-600" />
                    <span>{isBangla ? 'ক্লাউডে আপলোড হচ্ছে...' : 'Uploading to cloud...'}</span>
                  </div>
                )}

                {!isUploadingPhoto && photoUrl && (
                  <div className="flex items-center justify-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{isBangla ? 'নিরাপদ ক্লাউডে সংরক্ষিত' : 'Verified Cloud Storage'}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Col 2 & 3: Input Fields */}
            <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isBangla ? 'পুরো নাম (ইংরেজি)' : 'Full Name (English)'} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Md. Tanvir Hasan"
                  className="w-full px-3.5 py-2 rounded-xl text-xs border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isBangla ? 'পুরো নাম (বাংলায় - ঐচ্ছিক)' : 'Full Name (Bengali - Optional)'}
                </label>
                <input
                  type="text"
                  value={fullNameBn}
                  onChange={(e) => setFullNameBn(e.target.value)}
                  placeholder="যেমন: মো: তানভীর হাসান"
                  className="w-full px-3.5 py-2 rounded-xl text-xs border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isBangla ? 'মোবাইল নম্বর (১১ ডিজিট)' : 'Mobile Number (11-digit)'} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                  placeholder="017XXXXXXXX"
                  className="w-full px-3.5 py-2 rounded-xl text-xs border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isBangla ? 'ইমেইল ঠিকানা (ঐচ্ছিক)' : 'Email Address (Optional)'}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="student@example.com"
                  className="w-full px-3.5 py-2 rounded-xl text-xs border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              {/* Category Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isBangla ? 'শিক্ষার্থীর বিভাগ' : 'Student Category'} <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCategory('former')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                      category === 'former'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {isBangla ? 'প্রাক্তন শিক্ষার্থী' : 'Former (Alumni)'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCategory('current')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                      category === 'current'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {isBangla ? 'বর্তমান শিক্ষার্থী' : 'Current Student'}
                  </button>
                </div>
              </div>

              {/* Category-Specific Fields */}
              {category === 'former' ? (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {isBangla ? 'এসএসসি পাসের সাল / ব্যাচ' : 'SSC Passing Year / Batch'} <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={passingYear}
                      onChange={(e) => setPassingYear(e.target.value)}
                      placeholder="e.g. 1998 or 2014"
                      className="w-full px-3.5 py-2 rounded-xl text-xs border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {isBangla ? 'সর্বশেষ শ্রেণি' : 'Last Class Attended'}
                    </label>
                    <input
                      type="text"
                      value={lastClassAttended}
                      onChange={(e) => setLastClassAttended(e.target.value)}
                      placeholder="e.g. Class 10 / SSC"
                      className="w-full px-3.5 py-2 rounded-xl text-xs border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {isBangla ? 'স্টুডেন্ট আইডি (আইডি কার্ড থেকে)' : 'Student ID (from School Card)'} <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={studentId}
                      onChange={(e) => setStudentId(e.target.value.toUpperCase())}
                      placeholder="e.g. STU-2024-001"
                      className="w-full px-3.5 py-2 rounded-xl text-xs border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 font-mono uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {isBangla ? 'শাখা / গ্রুপ' : 'Section / Group'}
                    </label>
                    <input
                      type="text"
                      value={groupOrSection}
                      onChange={(e) => setGroupOrSection(e.target.value)}
                      placeholder="e.g. Section A"
                      className="w-full px-3.5 py-2 rounded-xl text-xs border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden"
                    />
                  </div>
                </>
              )}

              {/* Current Student Extra Details */}
              {category === 'current' && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {isBangla ? 'বর্তমান শ্রেণি' : 'Current Class'}
                    </label>
                    <select
                      value={currentClass}
                      onChange={(e) => setCurrentClass(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl text-xs border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden"
                    >
                      {['Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'].map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {isBangla ? 'রোল নম্বর / সেকশন' : 'Roll / Section'}
                    </label>
                    <input
                      type="text"
                      value={rollNumber}
                      onChange={(e) => setRollNumber(e.target.value)}
                      placeholder="e.g. Roll 05, Sec A"
                      className="w-full px-3.5 py-2 rounded-xl text-xs border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden"
                    />
                  </div>
                </>
              )}

              {/* T-Shirt Size */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Shirt className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{isBangla ? 'টি-শার্ট সাইজ' : 'T-Shirt Size'}</span> <span className="text-rose-500">*</span>
                </label>
                <select
                  value={tShirtSize}
                  onChange={(e) => setTShirtSize(e.target.value as TShirtSize)}
                  className="w-full px-3.5 py-2 rounded-xl text-xs border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden font-bold"
                >
                  {T_SHIRT_SIZES.map((size) => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
              </div>

              {/* Blood Group */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isBangla ? 'রক্তের গ্রুপ' : 'Blood Group'}
                </label>
                <select
                  value={bloodGroup}
                  onChange={(e) => setBloodGroup(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl text-xs border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden font-bold"
                >
                  {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                    <option key={bg} value={bg}>{bg}</option>
                  ))}
                </select>
              </div>

              {/* Gender */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isBangla ? 'লিঙ্গ' : 'Gender'}
                </label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as 'male' | 'female')}
                  className="w-full px-3.5 py-2 rounded-xl text-xs border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden font-bold"
                >
                  <option value="male">{isBangla ? 'পুরুষ' : 'Male'}</option>
                  <option value="female">{isBangla ? 'মহিলা' : 'Female'}</option>
                </select>
              </div>

              {/* Address */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isBangla ? 'বর্তমান ঠিকানা' : 'Address'}
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. Faridpur"
                  className="w-full px-3.5 py-2 rounded-xl text-xs border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden font-medium"
                />
              </div>
            </div>
          </div>

          {/* Optional Document Upload */}
          <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-slate-800 block">
                {isBangla ? 'প্রয়োজনীয় ডকুমেন্ট / প্রমাণক আপলোড (ঐচ্ছিক)' : 'Supporting Document / ID Upload (Optional)'}
              </span>
              <p className="text-[11px] text-slate-400">
                {isBangla ? 'শিক্ষার্থীর স্কুল আইডি কার্ড, সার্টিফিকেট বা রসিদের ছবি আপলোড করতে পারেন।' : 'Upload photo of student ID card or payment slip for archiving.'}
              </p>
            </div>
            <label className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0">
              <Upload className="w-3.5 h-3.5 text-slate-600" />
              <span>{documentName ? documentName : (isBangla ? 'ফাইল সিলেক্ট করুন' : 'Attach File')}</span>
              <input type="file" accept="image/*,.pdf" onChange={handleDocumentUpload} className="hidden" />
            </label>
          </div>
        </div>

        {/* ── Optional Parent / Guardian Section ── */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                {isBangla ? 'অভিভাবকের তথ্য (ঐচ্ছিক)' : 'Parent / Guardian Details (Optional)'}
              </h3>
              <p className="text-xs text-slate-500">
                {isBangla ? 'শিক্ষার্থীর সাথে অভিভাবক উপস্থিত থাকলে তথ্য যুক্ত করুন।' : 'Add accompanying parent or guardian details if attending.'}
              </p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hasParent}
                onChange={(e) => setHasParent(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
              />
              <span className="text-xs font-bold text-slate-700">
                {isBangla ? 'অভিভাবক যুক্ত করুন' : 'Include Parent'}
              </span>
            </label>
          </div>

          {hasParent && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isBangla ? 'অভিভাবকের নাম' : 'Parent Name'}
                </label>
                <input
                  type="text"
                  value={parentName}
                  onChange={(e) => setParentName(e.target.value)}
                  placeholder="e.g. Md. Abul Kalam"
                  className="w-full px-3.5 py-2 rounded-xl text-xs border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isBangla ? 'সম্পর্ক' : 'Relationship'}
                </label>
                <select
                  value={parentRelation}
                  onChange={(e) => setParentRelation(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl text-xs border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden font-medium"
                >
                  <option value="Father">{isBangla ? 'বাবা' : 'Father'}</option>
                  <option value="Mother">{isBangla ? 'মা' : 'Mother'}</option>
                  <option value="Guardian">{isBangla ? 'অভিভাবক' : 'Guardian'}</option>
                  <option value="Spouse">{isBangla ? 'স্ত্রী / স্বামী' : 'Spouse'}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isBangla ? 'অভিভাবকের মোবাইল' : 'Parent Mobile'}
                </label>
                <input
                  type="tel"
                  value={parentPhone}
                  onChange={(e) => setParentPhone(e.target.value)}
                  placeholder="017XXXXXXXX"
                  className="w-full px-3.5 py-2 rounded-xl text-xs border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden font-mono"
                />
              </div>
            </div>
          )}
        </div>

        {/* ── 2. Optional Financial Section (Requirement 4) ── */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                <span>{isBangla ? '২. আর্থিক কালেকশন বিবরণ (ঐচ্ছিক)' : '2. Financial Collection Details (Optional)'}</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {isBangla
                  ? 'ভেন্যুতে শিক্ষার্থী নগদ বা অন্য মাধ্যমে ফি প্রদান করলে তা এখানে যুক্ত করুন। এটি সুপার অ্যাডমিনের পর্যালোচনার জন্য অপেক্ষমান থাকবে।'
                  : 'Enter collected cash or payment reference if attendee paid at the desk. This will be marked as PENDING_APPROVAL.'}
              </p>
            </div>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hasFinancialAmount}
                onChange={(e) => setHasFinancialAmount(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
              />
              <span className="text-xs font-extrabold text-slate-700">
                {isBangla ? 'আর্থিক পরিমাণ যুক্ত করুন' : 'Record Financial Amount'}
              </span>
            </label>
          </div>

          {hasFinancialAmount ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200/60 animate-in fade-in">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isBangla ? 'পরিমাণ (টাকা - BDT)' : 'Amount (BDT)'} <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">৳</span>
                  <input
                    type="number"
                    required={hasFinancialAmount}
                    value={financialAmount}
                    onChange={(e) => setFinancialAmount(e.target.value)}
                    placeholder="1500"
                    className="w-full pl-7 pr-3 py-1.5 rounded-xl text-xs border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 font-bold tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isBangla ? 'পেমেন্ট মাধ্যম' : 'Payment Method'}
                </label>
                <select
                  value={financialMethod}
                  onChange={(e) => setFinancialMethod(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl text-xs border border-slate-200 bg-white focus:outline-hidden font-bold"
                >
                  <option value="Cash">Cash (নগদ)</option>
                  <option value="bKash">bKash</option>
                  <option value="Nagad">Nagad</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Card">Card</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isBangla ? 'ট্রানজেকশন / রসিদ রেফারেন্স' : 'Trx / Receipt Reference'}
                </label>
                <input
                  type="text"
                  value={financialReference}
                  onChange={(e) => setFinancialReference(e.target.value)}
                  placeholder="e.g. REC-1042 / TrxID"
                  className="w-full px-3 py-1.5 rounded-xl text-xs border border-slate-200 bg-white focus:outline-hidden font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isBangla ? 'পেমেন্ট বিবরণ' : 'Description'}
                </label>
                <input
                  type="text"
                  value={financialDescription}
                  onChange={(e) => setFinancialDescription(e.target.value)}
                  placeholder="e.g. Venue cash collection"
                  className="w-full px-3 py-1.5 rounded-xl text-xs border border-slate-200 bg-white focus:outline-hidden"
                />
              </div>

              <div className="sm:col-span-2 md:col-span-4">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isBangla ? 'আর্থিক নোট / কাউন্টার মন্তব্য (ঐচ্ছিক)' : 'Financial Notes / Counter Remarks (Optional)'}
                </label>
                <input
                  type="text"
                  value={financialNotes}
                  onChange={(e) => setFinancialNotes(e.target.value)}
                  placeholder="e.g. Verified by cash counter desk 01"
                  className="w-full px-3 py-1.5 rounded-xl text-xs border border-slate-200 bg-white focus:outline-hidden"
                />
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-slate-50 border border-dashed border-slate-200 text-center text-xs text-slate-500">
              {isBangla
                ? 'কোনো আর্থিক পরিমাণ যুক্ত করা হয়নি। রেজিস্ট্রেশনটি আর্থিক এন্ট্রি ছাড়াই স্বাভাবিকভাবে সম্পন্ন হবে।'
                : 'No financial amount entered. Registration will proceed normally without creating financial entries.'}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {isBangla ? 'অতিরিক্ত নোট / মন্তব্য (ঐচ্ছিক)' : 'Additional Notes / Remarks (Optional)'}
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Registered in person at Main Gate Desk 01"
              className="w-full px-3.5 py-2 rounded-xl text-xs border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden"
            />
          </div>
        </div>

        {/* ── Submit Action Button ── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <button
            type="button"
            onClick={handleResetForm}
            className="w-full sm:w-auto px-5 py-3 rounded-2xl border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-bold transition-all cursor-pointer"
          >
            {isBangla ? 'ফর্ম রিসেট করুন' : 'Reset Form'}
          </button>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-extrabold shadow-lg shadow-indigo-600/30 hover:shadow-xl transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>{isBangla ? 'টিকিট তৈরি হচ্ছে...' : 'Generating Student Ticket...'}</span>
              </>
            ) : (
              <>
                <QrCode className="w-4 h-4" />
                <span>{isBangla ? 'শিক্ষার্থীর টিকিট তৈরি করুন' : 'Generate Student Ticket'}</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* ── Synchronized Camera Modal ── */}
      {isCameraOpen && (
        <SynchronizedCameraCardModal
          isOpen={isCameraOpen}
          onClose={() => setIsCameraOpen(false)}
          onPhotoConfirmed={async (photoDataUrl: string) => {
            setIsCameraOpen(false);
            setIsUploadingPhoto(true);
            try {
              const res = await StudentPhotoStorageService.uploadStudentPhoto({
                fileOrDataUrl: photoDataUrl,
                registrationId: studentId.trim() || `VENUE-${Date.now()}`,
                batchYear: passingYear || undefined,
                category,
                currentClass: currentClass || undefined,
                isParent: false,
              });
              if (res.success && res.publicUrl) {
                setPhotoUrl(res.publicUrl);
                setErrorMessage(null);
              } else {
                setErrorMessage(res.error || (isBangla ? 'ছবি আপলোড করতে ব্যর্থ হয়েছে।' : 'Failed to upload photo to storage.'));
              }
            } catch (err: any) {
              setErrorMessage(err?.message || (isBangla ? 'ছবি আপলোডে ত্রুটি।' : 'Error uploading photo.'));
            } finally {
              setIsUploadingPhoto(false);
            }
          }}
          language={language}
          studentPreview={{
            id: 'IDC-VENUE-PREVIEW',
            registrationId: 'PLSCF-2027-VENUE',
            eventYear: 2027,
            studentName: fullName || 'Attendee',
            studentNameBn: fullNameBn || undefined,
            batchYear: passingYear || '2027',
            batchName: category === 'current' ? currentClass : `Batch ${passingYear}`,
            idNumber: studentId || 'VENUE-REG',
            contactNumber: mobileNumber || '01700000000',
            hasPhoto: Boolean(photoUrl),
            photoUrl: photoUrl,
            qrToken: 'TMP001',
            verificationUrl: '',
            cardStatus: 'ELIGIBLE',
            category,
            cardDimensions: '54x86mm',
            version: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }}
        />
      )}

      {/* ── Success Modal: Display Generated Ticket ── */}
      {showSuccessModal && generatedRegistration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[92vh] overflow-y-auto border border-slate-200 p-6 sm:p-8 space-y-6 relative animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-900 flex items-center justify-center shrink-0">
                  <QrCode className="w-5 h-5 text-amber-700" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    {isBangla ? 'শিক্ষার্থীর টিকিট সফলভাবে তৈরি হয়েছে!' : 'Student Ticket Successfully Generated!'}
                  </h3>
                  <p className="text-xs text-amber-800 font-bold">
                    {isBangla
                      ? '⚠️ স্ট্যাটাস: PENDING_APPROVAL (সুপার অ্যাডমিন অনুমোদনের অপেক্ষায়)'
                      : '⚠️ Initial Status: PENDING_APPROVAL (Awaiting Super Admin Review)'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowSuccessModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Generated Ticket Preview */}
            <TicketView
              registration={generatedRegistration}
              language={language}
              onNavigateHome={() => setShowSuccessModal(false)}
            />

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowSuccessModal(false)}
                className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer transition-all"
              >
                {isBangla ? 'সম্পন্ন' : 'Done & Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
