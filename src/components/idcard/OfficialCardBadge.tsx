import React, { useState, useEffect, useId, useMemo } from 'react';
import {
  FileText,
  Image as ImageIcon,
  Printer,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { StudentIdCardRecord } from '../../types/idcard';
import { Language } from '../../types';
import { generateStudentQrCodeDataUrl } from '../../utils/studentQrCode';
import {
  CardType,
  resolveCardType,
  buildOfficialCardSvg,
  generateOfficialCardImage,
  generateOfficialCardPdf,
  printOfficialCard,
  OfficialCardData,
  convertImageUrlToDataUrl,
} from '../../utils/officialCardTemplates';
import { sanitizeSvg } from '../../utils/security';

export interface OfficialCardBadgeProps {
  student: StudentIdCardRecord;
  cardType?: CardType;
  isParentPass?: boolean;
  language?: Language;
  showActions?: boolean;
  className?: string;
  customPhotoSlot?: React.ReactNode;
  isPreview?: boolean;
}

export const OfficialCardBadge: React.FC<OfficialCardBadgeProps> = ({
  student,
  cardType: propCardType,
  isParentPass = false,
  language = 'en',
  showActions = true,
  className = '',
  customPhotoSlot,
  isPreview = false,
}) => {
  const isBangla = language === 'bn';
  const instanceReactId = useId();
  const safeUniqueId = useMemo(
    () => `badge_${instanceReactId.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
    [instanceReactId]
  );

  const [downloadingType, setDownloadingType] = useState<'pdf' | 'image' | 'print' | null>(null);
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [localQrDataUrl, setLocalQrDataUrl] = useState<string>('');
  const [embeddedPhotoDataUrl, setEmbeddedPhotoDataUrl] = useState<string>('');

  // Determine actual card design: 'student' | 'alumni' | 'parent'
  const resolvedCardType: CardType =
    isParentPass || propCardType === 'parent'
      ? 'parent'
      : propCardType || resolveCardType(student, false);

  // Parent Pass specifics
  const isParent = resolvedCardType === 'parent';

  // Pre-resolve student or parent photo into standalone Base64 Data URL for on-screen SVG & print rasterization
  useEffect(() => {
    let isCancelled = false;
    const targetPhoto = isParent ? student?.parentPhotoUrl : student?.photoUrl;
    if (targetPhoto && targetPhoto.trim()) {
      if (targetPhoto.startsWith('data:image/')) {
        setEmbeddedPhotoDataUrl(targetPhoto);
      } else {
        convertImageUrlToDataUrl(targetPhoto)
          .then((dataUri) => {
            if (!isCancelled && dataUri && dataUri.startsWith('data:image/')) {
              setEmbeddedPhotoDataUrl(dataUri);
            }
          })
          .catch(() => {});
      }
    } else {
      setEmbeddedPhotoDataUrl('');
    }
    return () => {
      isCancelled = true;
    };
  }, [student?.photoUrl, student?.parentPhotoUrl, isParent]);

  const parentPassId = student
    ? student.idNumber?.startsWith('PAR-')
      ? student.idNumber
      : `PAR-${student.idNumber || student.registrationId || 'ID'}`
    : 'PAR-ID';
  const parentToken = student
    ? student.qrToken?.startsWith('P-')
      ? student.qrToken
      : `P-${student.qrToken || 'TOKEN'}`
    : 'P-TOKEN';

  // Target QR URL
  useEffect(() => {
    let isCancelled = false;
    if (student) {
      const baseUrl =
        typeof window !== 'undefined' && window.location.origin
          ? window.location.origin
          : 'https://plscf2026.reunion.org';
      const targetUrl = isParent
        ? `${baseUrl}/verify-parent-pass?id=${encodeURIComponent(
            parentPassId
          )}&studentId=${encodeURIComponent(student.idNumber || '')}&token=${encodeURIComponent(
            parentToken
          )}`
        : student.verificationUrl?.startsWith('http') && !student.verificationUrl.includes('plscf2026.reunion.org')
        ? student.verificationUrl
        : `${baseUrl}/verify-student-id?id=${encodeURIComponent(
            student.idNumber || student.registrationId || 'ID'
          )}&token=${encodeURIComponent(student.qrToken || 'TOKEN')}`;

      generateStudentQrCodeDataUrl(targetUrl)
        .then((url) => {
          if (!isCancelled) setLocalQrDataUrl(url);
        })
        .catch((err) => {
          console.warn('[OfficialCardBadge] QR code generation notice:', err);
        });
    }
    return () => {
      isCancelled = true;
    };
  }, [student, isParent, parentPassId, parentToken]);

  if (!student) {
    return null;
  }

  const isPreviewCard =
    isPreview ||
    student.idNumber?.includes('PREV') ||
    student.idNumber?.includes('XXXX') ||
    student.registrationId?.includes('PREV') ||
    student.registrationId?.includes('XXXX') ||
    student.qrToken === 'XXXXXX' ||
    student.qrToken === 'PREV27';

  // Format data payload for SVG generation
  const cardData: OfficialCardData = {
    cardType: resolvedCardType,
    name: isParent
      ? student.parentName || (isBangla ? 'অভিভাবকের নাম' : 'Parent / Guardian')
      : student.studentName || (isBangla ? 'আপনার নাম' : 'Your Full Name'),
    classOrBatch: isPreviewCard
      ? (resolvedCardType === 'alumni' ? 'SSC / HSC' : 'Class X')
      : isParent
      ? student.batchName || student.batchYear || 'Class'
      : resolvedCardType === 'alumni'
      ? student.batchName || 'General Alumni'
      : student.batchName || 'Class',
    yearOrSession: isPreviewCard
      ? (resolvedCardType === 'alumni' ? 'Passing Year' : '2027')
      : isParent
      ? student.eventYear || 2027
      : resolvedCardType === 'alumni'
      ? student.batchYear || 'Alumni'
      : student.eventYear || 2027,
    mobile: isPreviewCard
      ? '01XXXXXXXXX'
      : isParent
      ? student.parentPhone || student.contactNumber || 'N/A'
      : student.contactNumber || 'N/A',
    token: isPreviewCard
      ? 'XXXXXX'
      : isParent
      ? parentToken
      : student.qrToken || 'TOKEN',
    registrationId: isPreviewCard
      ? 'PLSC-XXXX-XXXX'
      : isParent
      ? parentPassId
      : student.idNumber || student.registrationId || 'N/A',
    photoUrl: embeddedPhotoDataUrl || (isParent ? student.parentPhotoUrl || '' : student.photoUrl || ''),
    qrDataUrl: localQrDataUrl || '',
    uniqueId: safeUniqueId,
    isPreview: isPreviewCard,
  };

  const svgContent = buildOfficialCardSvg(cardData);

  const safeFilename = `${
    isParent ? 'Parent_Pass' : resolvedCardType === 'alumni' ? 'Alumni_Card' : 'Student_ID'
  }_${(student.idNumber || student.registrationId || 'card').replace(/[^a-zA-Z0-9_-]/g, '_')}`;

  const handlePrint = async () => {
    try {
      setDownloadingType('print');
      setErrorMessage('');
      await printOfficialCard(
        cardData,
        `${isParent ? 'Parent Pass' : resolvedCardType === 'alumni' ? 'Alumni Card' : 'Student ID'} - ${cardData.name}`
      );
      setSuccessMessage(isBangla ? 'প্রিন্ট ডায়ালগ প্রস্তুত!' : 'Print dialog ready!');
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err: any) {
      console.error('[OfficialCardBadge] Print error:', err);
      setErrorMessage(isBangla ? 'প্রিন্ট করতে সমস্যা হয়েছে।' : 'Unable to initialize printer.');
    } finally {
      setDownloadingType(null);
    }
  };

  const handleDownloadPhoto = async () => {
    try {
      setDownloadingType('image');
      setErrorMessage('');
      const { dataUrl } = await generateOfficialCardImage(cardData);

      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `${safeFilename}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setSuccessMessage(isBangla ? 'কার্ডের ছবি সফলভাবে ডাউনলোড হয়েছে!' : 'ID Card Photo downloaded successfully!');
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err: any) {
      console.error('[OfficialCardBadge] Photo download error:', err);
      setErrorMessage(isBangla ? 'ছবি ডাউনলোড ব্যর্থ হয়েছে।' : 'Failed to download card photo.');
    } finally {
      setDownloadingType(null);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      setDownloadingType('pdf');
      setErrorMessage('');
      const { pdfDataUri } = await generateOfficialCardPdf(cardData);

      const link = document.createElement('a');
      link.href = pdfDataUri;
      link.download = `${safeFilename}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setSuccessMessage(isBangla ? 'অফিসিয়াল PDF সফলভাবে ডাউনলোড হয়েছে!' : 'Print-ready PDF downloaded successfully!');
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err: any) {
      console.error('[OfficialCardBadge] PDF download error:', err);
      setErrorMessage(isBangla ? 'PDF ডাউনলোড ব্যর্থ হয়েছে।' : 'Failed to download card PDF.');
    } finally {
      setDownloadingType(null);
    }
  };

  return (
    <div className={`flex flex-col items-center select-none ${className}`}>
      {/* Official Tag Badge */}
      <div className="mb-2 flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider shadow-2xs border">
        {isParent ? (
          <span className="text-emerald-800 bg-emerald-100 border-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
            {isBangla ? 'অফিসিয়াল অভিভাবক পাস' : 'Official Parent / Guardian Pass'}
          </span>
        ) : resolvedCardType === 'alumni' ? (
          <span className="text-rose-900 bg-rose-100 border-rose-300 px-2 py-0.5 rounded-full flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-rose-800" />
            {isBangla ? 'অ্যালুমনাই মেম্বার আইডি কার্ড' : 'Alumni Member ID Card'}
          </span>
        ) : (
          <span className="text-sky-900 bg-sky-100 border-sky-300 px-2 py-0.5 rounded-full flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-sky-700" />
            {isBangla ? 'বর্তমান শিক্ষার্থী আইডি কার্ড' : 'Current Student ID Card'}
          </span>
        )}
      </div>

      {/* SVG Card Container */}
      <div className="relative w-full max-w-[300px] sm:max-w-[320px] aspect-[60/90] rounded-2xl shadow-2xl overflow-hidden border border-slate-300/80 bg-white">
        {/* Render Vector SVG Card */}
        <div
          className="w-full h-full [&>svg]:w-full [&>svg]:h-full [&>svg]:block"
          dangerouslySetInnerHTML={{ __html: sanitizeSvg(svgContent) }}
        />

        {/* Live Synchronized Photo Overlay if custom slot provided (e.g. active camera stream) */}
        {customPhotoSlot && (
          <div
            className="absolute z-20 pointer-events-none overflow-hidden"
            style={{
              top: '32.15%',
              left: '36.67%',
              width: '26.67%',
              height: '18.37%',
              borderRadius: '9%',
            }}
          >
            {customPhotoSlot}
          </div>
        )}
      </div>

      {/* Success / Error Feedback */}
      {successMessage && (
        <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 shadow-2xs">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-rose-700 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-200 shadow-2xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Print & Download Action Buttons */}
      {showActions && (
        <div className="mt-4 flex flex-col gap-2 w-full max-w-[300px] sm:max-w-[320px]">
          {/* Primary Action: Print ID Card Photo */}
          <button
            type="button"
            onClick={handlePrint}
            disabled={downloadingType !== null}
            className={`w-full py-3 px-4 rounded-xl text-white font-bold text-xs sm:text-sm shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 border disabled:opacity-60 active:scale-98 ${
              isParent
                ? 'bg-gradient-to-r from-emerald-900 via-teal-900 to-emerald-800 hover:from-emerald-800 hover:to-teal-800 border-emerald-700'
                : resolvedCardType === 'alumni'
                ? 'bg-gradient-to-r from-rose-950 via-rose-900 to-amber-950 hover:from-rose-900 hover:to-amber-900 border-rose-800'
                : 'bg-slate-900 hover:bg-slate-800 border-slate-700'
            }`}
          >
            {downloadingType === 'print' ? (
              <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
            ) : (
              <Printer className="w-4 h-4 text-amber-400" />
            )}
            <span>
              {isBangla
                ? isParent
                  ? 'অভিভাবক পাস প্রিন্ট করুন'
                  : 'আইডি কার্ড প্রিন্ট করুন'
                : isParent
                ? 'Print Parent Pass Photo'
                : 'Print ID Card Photo'}
            </span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            {/* Download Photo Button */}
            <button
              type="button"
              onClick={handleDownloadPhoto}
              disabled={downloadingType !== null}
              className={`py-2.5 px-3 rounded-xl text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-60 active:scale-95 ${
                isParent
                  ? 'bg-emerald-700 hover:bg-emerald-800'
                  : resolvedCardType === 'alumni'
                  ? 'bg-rose-800 hover:bg-rose-900'
                  : 'bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-700 hover:to-blue-800'
              }`}
            >
              {downloadingType === 'image' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
              ) : (
                <ImageIcon className="w-3.5 h-3.5 text-white" />
              )}
              <span>{isBangla ? 'ছবি ডাউনলোড' : 'Download Photo'}</span>
            </button>

            {/* Download PDF Button */}
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={downloadingType !== null}
              className="py-2.5 px-3 rounded-xl bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-bold text-xs shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-60 active:scale-95"
            >
              {downloadingType === 'pdf' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
              ) : (
                <FileText className="w-3.5 h-3.5 text-amber-600" />
              )}
              <span>{isBangla ? 'PDF ডাউনলোড' : 'Download PDF'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
