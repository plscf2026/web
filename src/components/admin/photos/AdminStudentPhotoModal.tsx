import React, { useState, useRef } from 'react';
import {
  X,
  Camera,
  Upload,
  Download,
  Trash2,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Copy,
  ShieldCheck,
  HardDrive,
  User,
} from 'lucide-react';
import { RegistrationRecord } from '../../../types';
import {
  StudentPhotoStorageService,
  validateStudentImage,
  compressStudentPhoto,
  STUDENT_PHOTOS_BUCKET,
  buildStudentPhotoStoragePath,
} from '../../../services/studentPhotoStorageService';

interface AdminStudentPhotoModalProps {
  isOpen: boolean;
  onClose: () => void;
  registration: RegistrationRecord | null;
  adminName: string;
  language?: 'en' | 'bn';
  onPhotoUpdated?: (updatedReg: RegistrationRecord) => void;
}

export const AdminStudentPhotoModal: React.FC<AdminStudentPhotoModalProps> = ({
  isOpen,
  onClose,
  registration,
  adminName,
  language = 'en',
  onPhotoUpdated,
}) => {
  const [currentPhotoUrl, setCurrentPhotoUrl] = useState<string>(registration?.photoUrl || '');
  const [currentStoragePath, setCurrentStoragePath] = useState<string | null>(
    registration?.photoStoragePath || null
  );
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);
  const [pendingSizeKb, setPendingSizeKb] = useState<number | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  const [copiedPath, setCopiedPath] = useState(false);
  const [isCapturingCamera, setIsCapturingCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen || !registration) return null;

  const isBn = language === 'bn';

  // Derived display storage path
  const displayStoragePath =
    currentStoragePath ||
    buildStudentPhotoStoragePath({
      registrationId: registration.id,
      batchYear: registration.passingYear,
      category: registration.category,
      currentClass: registration.currentClass,
    });

  const handleCopyPath = () => {
    if (displayStoragePath) {
      navigator.clipboard.writeText(displayStoragePath);
      setCopiedPath(true);
      setTimeout(() => setCopiedPath(false), 2000);
    }
  };

  // Handle file selection from local disk
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatusMessage(null);
    setIsLoading(true);

    try {
      // 1. Validate file format and size
      const validation = await validateStudentImage(file);
      if (!validation.valid) {
        setStatusMessage({
          type: 'error',
          text: validation.error || (isBn ? 'ভুল ছবির ফরম্যাট বা সাইজ।' : 'Invalid photo file or size.'),
        });
        setIsLoading(false);
        return;
      }

      // 2. Compress client-side to <= 150 KB and max dimension 800px
      const compressed = await compressStudentPhoto(file);
      setPendingBlob(compressed.blob);
      setPendingPreviewUrl(compressed.dataUrl);
      setPendingSizeKb(Math.round(compressed.sizeBytes / 1024));
      setStatusMessage({
        type: 'info',
        text: isBn
          ? `ছবি সফলভাবে অপটিমাইজ করা হয়েছে (${Math.round(compressed.sizeBytes / 1024)} KB)। সেভ করতে নিচের বাটনে চাপুন।`
          : `Photo compressed to ${Math.round(compressed.sizeBytes / 1024)} KB (WebP). Click "Save & Sync" to commit to Supabase.`,
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || (isBn ? 'ছবি প্রসেস করতে ব্যর্থ।' : 'Failed to process image.'),
      });
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Start live webcam stream
  const startCamera = async () => {
    setStatusMessage(null);
    setIsCapturingCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err: any) {
      setIsCapturingCamera(false);
      setStatusMessage({
        type: 'error',
        text: isBn
          ? 'ক্যামেরা চালু করা সম্ভব হয়নি। ডিভাইসে ক্যামেরা পারমিশন চেক করুন।'
          : 'Could not access camera. Please verify device camera permissions.',
      });
    }
  };

  // Stop camera stream
  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setIsCapturingCamera(false);
  };

  // Snap photo from webcam stream
  const captureFromCamera = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    stopCamera();

    setIsLoading(true);
    try {
      const rawDataUrl = canvas.toDataURL('image/jpeg', 0.95);
      const compressed = await compressStudentPhoto(rawDataUrl);
      setPendingBlob(compressed.blob);
      setPendingPreviewUrl(compressed.dataUrl);
      setPendingSizeKb(Math.round(compressed.sizeBytes / 1024));
      setStatusMessage({
        type: 'info',
        text: isBn
          ? `ক্যামেরা থেকে ছবি নেওয়া হয়েছে (${Math.round(compressed.sizeBytes / 1024)} KB)। সেভ করতে নিচের বাটনে চাপুন।`
          : `Photo captured (${Math.round(compressed.sizeBytes / 1024)} KB). Click "Save & Sync" to commit to Supabase.`,
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Failed to capture webcam photo.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Commit new photo to Supabase storage & database
  const handleSaveAndSync = async () => {
    if (!pendingPreviewUrl && !pendingBlob) return;

    setIsLoading(true);
    setStatusMessage(null);

    try {
      const res = await StudentPhotoStorageService.updateStudentPhotoInDatabase({
        registrationId: registration.id,
        fileOrDataUrl: pendingBlob || pendingPreviewUrl!,
        adminName,
        batchYear: registration.passingYear,
        category: registration.category,
        currentClass: registration.currentClass,
      });

      if (!res.success) {
        throw new Error(res.error || 'Failed to upload photo to student-photos bucket.');
      }

      setCurrentPhotoUrl(res.photoUrl || pendingPreviewUrl!);
      setCurrentStoragePath(res.storagePath || displayStoragePath);
      setPendingPreviewUrl(null);
      setPendingBlob(null);
      setPendingSizeKb(null);

      const updatedRecord: RegistrationRecord = {
        ...registration,
        photoUrl: res.photoUrl || pendingPreviewUrl!,
        photoStoragePath: res.storagePath || displayStoragePath,
        photoUpdatedAt: new Date().toISOString(),
        photoUpdatedBy: adminName,
      };

      if (onPhotoUpdated) {
        onPhotoUpdated(updatedRecord);
      }

      setStatusMessage({
        type: 'success',
        text: isBn
          ? `ছবি সফলভাবে Supabase Storage বাকেট "${STUDENT_PHOTOS_BUCKET}"-এ সংরক্ষিত হয়েছে!`
          : `Photo successfully uploaded to "${STUDENT_PHOTOS_BUCKET}" bucket and synchronized!`,
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || (isBn ? 'ছবি সংরক্ষণ ব্যর্থ হয়েছে।' : 'Failed to save student photo.'),
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Reset photo to standard default avatar
  const handleResetToDefault = async () => {
    const confirmMsg = isBn
      ? 'আপনি কি নিশ্চিত যে শিক্ষার্থীর ছবি ডিফল্ট অবতারে রিসেট করতে চান?'
      : 'Are you sure you want to reset this student photo to the default avatar?';
    if (!window.confirm(confirmMsg)) return;

    setIsLoading(true);
    setStatusMessage(null);

    const defaultAvatar = '';

    try {
      await StudentPhotoStorageService.resetStudentPhotoToDefault({
        registrationId: registration.id,
        defaultAvatarUrl: defaultAvatar,
        adminName,
        oldStoragePath: currentStoragePath,
      });

      setCurrentPhotoUrl(defaultAvatar);
      setCurrentStoragePath(null);
      setPendingPreviewUrl(null);
      setPendingBlob(null);

      const updatedRecord: RegistrationRecord = {
        ...registration,
        photoUrl: defaultAvatar,
        photoStoragePath: null,
        photoUpdatedAt: new Date().toISOString(),
        photoUpdatedBy: adminName,
      };

      if (onPhotoUpdated) {
        onPhotoUpdated(updatedRecord);
      }

      setStatusMessage({
        type: 'success',
        text: isBn
          ? 'ছবি ডিফল্ট অবতারে রিসেট করা হয়েছে।'
          : 'Photo reset to default avatar successfully.',
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Failed to reset photo.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Download high-resolution photo file
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = pendingPreviewUrl || currentPhotoUrl;
    link.download = `${registration.id}_photo.webp`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-xs">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                {isBn ? 'শিক্ষার্থীর ছবি ও স্টোরেজ ম্যানেজমেন্ট' : 'Student Photo & Storage Management'}
              </h3>
              <p className="text-xs text-slate-500 font-mono">
                {registration.id} • {registration.fullName}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Storage Bucket & Path Information Banner */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-slate-700">
                  {isBn ? 'সুপাবেস স্টোরেজ বাকেট:' : 'Dedicated Storage Bucket:'}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {STUDENT_PHOTOS_BUCKET}
                </span>
              </div>

              <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Edge CDN Public Read</span>
              </span>
            </div>

            {/* Storage Path Sharding Display */}
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                {isBn ? 'স্টোরেজ ফোল্ডার ও ফাইল পাথ (ব্যাচ অনুসারে সুশৃঙ্খল):' : 'Organized Sharded Storage Path:'}
              </span>
              <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200 font-mono text-xs text-slate-800">
                <span className="truncate flex-1">{displayStoragePath}</span>
                <button
                  type="button"
                  onClick={handleCopyPath}
                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-sans font-bold flex items-center gap-1 cursor-pointer transition-colors shrink-0"
                  title="Copy storage path"
                >
                  <Copy className="w-3 h-3" />
                  <span>{copiedPath ? (isBn ? 'কপি হয়েছে!' : 'Copied!') : (isBn ? 'কপি' : 'Copy')}</span>
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                {isBn
                  ? '১০,০০০+ শিক্ষার্থীর ফাইলের জন্য ব্যাচ ভিত্তিক ফোল্ডারে স্বয়ংক্রিয়ভাবে সংরক্ষিত হয়।'
                  : 'Organized as <batch_year>/<student_id>/profile.webp for seamless 10,000+ registration scalability.'}
              </p>
            </div>
          </div>

          {/* Status Message Notification */}
          {statusMessage && (
            <div
              className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : statusMessage.type === 'error'
                  ? 'bg-rose-50 text-rose-800 border border-rose-200'
                  : 'bg-indigo-50 text-indigo-800 border border-indigo-200'
              }`}
            >
              {statusMessage.type === 'success' && <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />}
              {statusMessage.type === 'error' && <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />}
              {statusMessage.type === 'info' && <RefreshCw className="w-4 h-4 text-indigo-600 shrink-0" />}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* Live Webcam Stream (if active) */}
          {isCapturingCamera && (
            <div className="bg-slate-950 rounded-xl p-4 flex flex-col items-center space-y-3">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full max-h-72 object-cover rounded-lg bg-black border border-slate-700"
              />
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={captureFromCamera}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-2 cursor-pointer shadow-sm"
                >
                  <Camera className="w-4 h-4" />
                  <span>{isBn ? 'ছবি তুলুন' : 'Capture Photo'}</span>
                </button>
                <button
                  type="button"
                  onClick={stopCamera}
                  className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  {isBn ? 'বাতিল' : 'Cancel'}
                </button>
              </div>
            </div>
          )}

          {/* Image Preview & Comparison Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Current Active Photo */}
            <div className="border border-slate-200 rounded-xl p-4 flex flex-col items-center bg-slate-50/50">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block text-center">
                {isBn ? 'বর্তমান সক্রিয় ছবি' : 'Current Active Photo'}
              </span>
              <div className="relative w-40 h-40 rounded-xl overflow-hidden border-2 border-slate-300 shadow-xs bg-slate-100 flex items-center justify-center">
                <img
                  src={currentPhotoUrl}
                  alt={registration.fullName}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="mt-2 text-center">
                <span className="text-[10px] text-slate-400 block font-mono">
                  {currentStoragePath ? 'Storage Linked' : 'External / Preset'}
                </span>
                {registration.photoUpdatedAt && (
                  <span className="text-[10px] text-slate-400 block">
                    Updated: {new Date(registration.photoUpdatedAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>

            {/* Pending New Photo (if uploaded / captured) */}
            <div className="border border-slate-200 rounded-xl p-4 flex flex-col items-center bg-slate-50/50">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block text-center">
                {isBn ? 'নতুন অপটিমাইজড ছবি প্রিভিউ' : 'New Optimized Preview'}
              </span>
              <div className="relative w-40 h-40 rounded-xl overflow-hidden border-2 border-dashed border-indigo-300 shadow-xs bg-white flex items-center justify-center">
                {pendingPreviewUrl ? (
                  <img
                    src={pendingPreviewUrl}
                    alt="Pending upload"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-center p-3 text-slate-400">
                    <User className="w-10 h-10 mx-auto text-slate-300 mb-1" />
                    <span className="text-[11px] block">
                      {isBn ? 'কোনো নতুন ছবি নির্বাচন করা হয়নি' : 'No new photo staged'}
                    </span>
                  </div>
                )}
              </div>
              <div className="mt-2 text-center">
                {pendingSizeKb !== null ? (
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    ✓ {pendingSizeKb} KB (WebP ≤ 150KB)
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400">
                    {isBn ? 'সর্বোচ্চ ৮০০x৮০০ পিক্সেল, ≤ ১৫০ KB' : 'Max 800px, ≤ 150 KB'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action Trigger Controls */}
          <div className="border-t border-slate-100 pt-4 space-y-3">
            <span className="text-xs font-bold text-slate-700 block">
              {isBn ? 'অ্যাকশন ও ছবি পরিবর্তন:' : 'Photo Management Actions:'}
            </span>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {/* File Upload Button */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFileChange}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading || isCapturingCamera}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer transition-colors shadow-xs"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{isBn ? 'ফাইল আপলোড' : 'Upload File'}</span>
              </button>

              {/* Live Webcam Button */}
              <button
                type="button"
                onClick={startCamera}
                disabled={isLoading || isCapturingCamera}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold border border-indigo-200 cursor-pointer transition-colors"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>{isBn ? 'ওয়েবক্যাম ক্যামেরা' : 'Webcam'}</span>
              </button>

              {/* Download Photo */}
              <button
                type="button"
                onClick={handleDownload}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isBn ? 'ডাউনলোড' : 'Download'}</span>
              </button>

              {/* Reset to Avatar */}
              <button
                type="button"
                onClick={handleResetToDefault}
                disabled={isLoading}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold border border-rose-200 cursor-pointer transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isBn ? 'ডিফল্ট রিসেট' : 'Reset'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50">
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            {isBn ? 'বন্ধ করুন' : 'Close'}
          </button>

          {pendingPreviewUrl && (
            <button
              type="button"
              onClick={handleSaveAndSync}
              disabled={isLoading}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-md transition-all hover:scale-[1.02] disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>{isBn ? 'সংরক্ষণ হচ্ছে...' : 'Saving to Supabase...'}</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>{isBn ? 'সেভ ও সুপাবেস সিঙ্ক করুন' : 'Save & Sync to Supabase'}</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
