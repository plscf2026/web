import React, { useState, useEffect } from 'react';
import {
  FileText,
  Image as ImageIcon,
  Printer,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { StudentIdCardRecord } from '../../types/idcard';
import { Language } from '../../types';
import { generateStudentQrCodeDataUrl } from '../../utils/studentQrCode';

export interface StudentIdCardBadgeProps {
  student: StudentIdCardRecord;
  language?: Language;
  showActions?: boolean;
  className?: string;
  customPhotoSlot?: React.ReactNode;
}

export const StudentIdCardBadge: React.FC<StudentIdCardBadgeProps> = ({
  student,
  language = 'en',
  showActions = true,
  className = '',
  customPhotoSlot,
}) => {
  const isBangla = language === 'bn';
  const [downloadingType, setDownloadingType] = useState<'pdf' | 'image' | 'print' | null>(null);
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [localQrDataUrl, setLocalQrDataUrl] = useState<string>('');

  useEffect(() => {
    let isCancelled = false;
    if (student) {
      const targetUrl =
        student.verificationUrl ||
        `https://plscf2026.reunion.org/verify-student-id?id=${encodeURIComponent(
          student.idNumber || student.registrationId || 'ID'
        )}&token=${encodeURIComponent(student.qrToken || 'TOKEN')}`;

      generateStudentQrCodeDataUrl(targetUrl)
        .then((url) => {
          if (!isCancelled) setLocalQrDataUrl(url);
        })
        .catch((err) => {
          console.warn('[StudentIdCardBadge] QR code generation notice:', err);
        });
    }
    return () => {
      isCancelled = true;
    };
  }, [student?.verificationUrl, student?.idNumber, student?.qrToken, student?.registrationId]);

  if (!student) {
    return null;
  }

  const isCurrentStudent = (student.batchName || student.batchYear || '').toLowerCase().includes('class');

  const safeFilename = `Student_ID_${(student.idNumber || student.registrationId || 'card').replace(
    /[^a-zA-Z0-9_-]/g,
    '_'
  )}`;

  const handlePrintCard = async () => {
    try {
      setDownloadingType('print');
      setErrorMessage('');

      // Generate high-resolution PNG image
      const { generateIndividualIdCardImage } = await import('../../utils/idCardGenerator');
      const { dataUrl } = await generateIndividualIdCardImage(student);

      // Create an invisible iframe for dedicated printing
      let iframe = document.getElementById('idcard-print-iframe') as HTMLIFrameElement;
      if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = 'idcard-print-iframe';
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        iframe.style.visibility = 'hidden';
        document.body.appendChild(iframe);
      }

      const doc = iframe.contentWindow?.document;
      if (!doc) {
        window.print();
        return;
      }

      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Student ID - ${student.studentName} (${student.idNumber})</title>
            <style>
              @page {
                size: auto;
                margin: 8mm;
              }
              body {
                margin: 0;
                padding: 10mm 0;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                font-family: system-ui, -apple-system, sans-serif;
                background: #ffffff;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .card-container {
                width: 54mm;
                height: 86mm;
                page-break-inside: avoid;
                margin: 0 auto;
                box-shadow: none;
              }
              .card-container img {
                width: 100%;
                height: 100%;
                object-fit: contain;
                display: block;
                border-radius: 3.5mm;
              }
              .cut-guide {
                margin-top: 4mm;
                font-size: 8pt;
                color: #64748b;
                text-align: center;
              }
            </style>
          </head>
          <body>
            <div class="card-container">
              <img src="${dataUrl}" alt="Student ID Card" />
            </div>
            <div class="cut-guide">
              <strong>Police Lines School and College, Faridpur</strong><br/>
              Standard Physical ID Dimensions: 54 × 86 mm (CR80)
            </div>
            <script>
              window.onload = function() {
                setTimeout(function() {
                  window.focus();
                  window.print();
                }, 300);
              };
            </script>
          </body>
        </html>
      `);
      doc.close();

      setSuccessMessage(isBangla ? 'প্রিন্ট উইন্ডো খোলা হয়েছে!' : 'Print dialog opened!');
      setTimeout(() => setSuccessMessage(''), 3500);
    } catch (err: any) {
      console.error('[StudentIdCardBadge] Print error:', err);
      window.print();
    } finally {
      setDownloadingType(null);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      setDownloadingType('pdf');
      setErrorMessage('');
      const { generateIndividualIdCardPdf } = await import('../../utils/idCardGenerator');
      const { pdfBlob } = await generateIndividualIdCardPdf(student);

      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${safeFilename}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSuccessMessage(isBangla ? 'PDF আইডি কার্ড ডাউনলোড সফল হয়েছে!' : 'ID Card PDF downloaded successfully!');
      setTimeout(() => setSuccessMessage(''), 3500);
    } catch (err: any) {
      console.error('[StudentIdCardBadge] PDF download failed:', err);
      setErrorMessage(isBangla ? 'PDF ডাউনলোড ব্যর্থ হয়েছে।' : 'Failed to download PDF ID card.');
      setTimeout(() => setErrorMessage(''), 4000);
    } finally {
      setDownloadingType(null);
    }
  };

  const handleDownloadPhoto = async () => {
    try {
      setDownloadingType('image');
      setErrorMessage('');
      const { generateIndividualIdCardImage } = await import('../../utils/idCardGenerator');
      const { blob } = await generateIndividualIdCardImage(student);

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${safeFilename}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSuccessMessage(isBangla ? 'ছবি ডাউনলোড সফল হয়েছে!' : 'ID Card photo downloaded successfully!');
      setTimeout(() => setSuccessMessage(''), 3500);
    } catch (err: any) {
      console.error('[StudentIdCardBadge] Photo download failed:', err);
      setErrorMessage(isBangla ? 'ছবি ডাউনলোড ব্যর্থ হয়েছে।' : 'Failed to download photo ID card.');
      setTimeout(() => setErrorMessage(''), 4000);
    } finally {
      setDownloadingType(null);
    }
  };

  return (
    <div className={`flex flex-col items-center ${className}`}>
      {/* Physical CR80 Card Dimensions: 54 × 86 mm (Aspect Ratio: 1 : 1.5926) */}
      <div
        id={`student-id-card-${student.idNumber}`}
        className="relative w-[280px] h-[446px] rounded-2xl overflow-hidden shadow-2xl border-2 border-amber-400/50 select-none bg-[#FDFCF8]"
        style={{
          background: 'linear-gradient(135deg, #FDFCF8 0%, #F3F7FA 60%, #E1F0F8 100%)',
        }}
      >
        {/* 1. Upper Deep Navy Card Banner */}
        <div
          className="absolute top-0 left-0 right-0 h-[200px]"
          style={{
            background: 'linear-gradient(180deg, #041025 0%, #092446 52%, #123F66 100%)',
          }}
        >
          {/* Top-Right Deep Cyan Accent */}
          <div
            className="absolute top-0 right-0 w-[80px] h-[65px] bg-[#104D77]"
            style={{ clipPath: 'polygon(100% 0, 0 0, 100% 100%)' }}
          />

          {/* School Crest Logo */}
          <img
            src="/assets/id_card/school_crest.png"
            alt="School Crest"
            className="absolute top-2.5 right-2 w-[76px] h-[39px] object-contain drop-shadow"
          />

          {/* Header Titles */}
          <div className="absolute top-2.5 left-3 text-left">
            <div className="w-4 h-[2px] bg-[#F1CA7E] mb-1" />
            <p className="text-[9px] font-bold tracking-wider text-[#8ED9F5] uppercase">
              STUDENT IDENTITY CARD
            </p>
            <h4 className="text-[17px] font-extrabold text-[#FFFCF5] leading-none mt-0.5">
              Police Lines
            </h4>
            <p className="text-[14px] font-bold text-[#FFFCF5] leading-tight">
              School &amp; College
            </p>
            <p className="text-[8px] font-bold tracking-widest text-[#F4CB7C] mt-0.5">
              FARIDPUR
            </p>
          </div>

          {/* Photo Frame & Avatar */}
          <div className="absolute top-[102px] left-3 w-[84px] h-[96px] rounded-lg p-[2px] bg-gradient-to-br from-[#AE7108] via-[#FFE590] to-[#B4780B] shadow-md">
            <div className="w-full h-full rounded-[6px] overflow-hidden bg-[#E4EDF2] flex items-center justify-center">
              {customPhotoSlot ? (
                customPhotoSlot
              ) : student.photoUrl ? (
                <img
                  src={student.photoUrl}
                  alt={student.studentName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-slate-200 text-slate-500">
                  <div className="w-8 h-8 rounded-full bg-slate-400 mb-1" />
                  <div className="w-12 h-6 rounded-t-full bg-slate-400" />
                </div>
              )}
            </div>
          </div>

          {/* Beside Photo: Student Name & Category Badge */}
          <div className="absolute top-[132px] left-[105px] right-2 text-left">
            <div className="w-5 h-[2px] bg-[#EBC474] mb-1" />
            <h3 className="text-[14px] font-bold text-[#FFFCF5] leading-tight line-clamp-2">
              {student.studentName || 'Student Name'}
            </h3>
            <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[8px] font-semibold tracking-wider text-[#8ED9F5] bg-sky-950/70 border border-sky-400/40">
              {isCurrentStudent ? 'CURRENT STUDENT' : 'ALUMNI MEMBER'}
            </span>
          </div>
        </div>

        {/* Gold Metallic Divider Line under navy header */}
        <div
          className="absolute top-[200px] left-0 right-0 h-[3px]"
          style={{
            background: 'linear-gradient(90deg, #AE7108 0%, #F5BE35 25%, #FFE590 50%, #F4BD36 74%, #B4780B 100%)',
          }}
        />

        {/* 2. Middle Student Details & QR Code */}
        <div className="absolute top-[210px] left-3 right-3 flex justify-between items-start">
          {/* Left Column: Data fields */}
          <div className="flex-1 pr-2 space-y-2 text-left">
            {/* Batch */}
            <div className="border-b border-slate-300 pb-0.5">
              <span className="text-[9px] font-bold text-[#10203A] mr-1">Batch:</span>
              <span className="text-[10px] font-extrabold text-[#1E3A8A]">
                {student.batchYear || student.batchName || 'General'}
              </span>
            </div>

            {/* ID Number */}
            <div className="border-b border-slate-300 pb-0.5">
              <span className="text-[9px] font-bold text-[#10203A] mr-1">ID No:</span>
              <span className="text-[9px] font-extrabold text-[#1E3A8A]">
                {student.idNumber || student.registrationId || 'N/A'}
              </span>
            </div>

            {/* Contact */}
            <div className="border-b border-slate-300 pb-0.5">
              <span className="text-[9px] font-bold text-[#10203A] mr-1">Contact:</span>
              <span className="text-[9px] font-bold text-[#1E3A8A]">
                {student.contactNumber || 'N/A'}
              </span>
            </div>

            {/* 6-Character QR Token */}
            <div className="pb-0.5 flex items-center justify-between">
              <span className="text-[9px] font-bold text-[#10203A]">Token:</span>
              <span className="text-[10px] font-mono font-black tracking-widest text-[#B45309] bg-amber-50 px-1.5 py-0.2 rounded border border-amber-300">
                {student.qrToken || 'TOKEN'}
              </span>
            </div>
          </div>

          {/* Right Column: QR Code Box */}
          <div className="w-[96px] h-[96px] rounded-lg p-[2px] bg-gradient-to-br from-[#AE7108] via-[#FFE590] to-[#B4780B] shadow-md flex-shrink-0">
            <div className="w-full h-full bg-white rounded-[6px] p-1 flex flex-col items-center justify-center relative">
              {/* Decorative corner ticks */}
              <div className="absolute top-1 left-1 w-2 h-2 border-t-2 border-l-2 border-[#76A4BE]" />
              <div className="absolute top-1 right-1 w-2 h-2 border-t-2 border-r-2 border-[#76A4BE]" />
              <div className="absolute bottom-1 left-1 w-2 h-2 border-b-2 border-l-2 border-[#76A4BE]" />
              <div className="absolute bottom-1 right-1 w-2 h-2 border-b-2 border-r-2 border-[#76A4BE]" />

              {localQrDataUrl ? (
                <img
                  src={localQrDataUrl}
                  alt="Verification QR"
                  className="w-[78px] h-[78px] object-contain"
                />
              ) : (
                <div className="w-[78px] h-[78px] flex items-center justify-center bg-slate-50 rounded text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin text-amber-600" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 3. Campus Signature Footer Artwork */}
        <div className="absolute bottom-0 left-0 right-0 h-[112px]">
          <div
            className="w-full h-[2px]"
            style={{
              background: 'linear-gradient(90deg, #AE7108 0%, #F5BE35 25%, #FFE590 50%, #B4780B 100%)',
            }}
          />
          <img
            src="/assets/id_card/campus_footer.png"
            alt="Campus Signature"
            className="w-full h-[110px] object-cover"
          />

          {/* Bottom-right navy corner triangle */}
          <div
            className="absolute bottom-0 right-0 w-[50px] h-[25px] bg-[#061931]"
            style={{ clipPath: 'polygon(100% 0, 0 100%, 100% 100%)' }}
          />
          <div
            className="absolute bottom-0 right-0 w-[52px] h-[26px] pointer-events-none"
            style={{
              borderBottom: '2px solid #F5BE35',
              clipPath: 'polygon(100% 0, 0 100%, 100% 100%)',
            }}
          />
        </div>
      </div>

      {/* Success / Error Feedback */}
      {successMessage && (
        <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 shadow-2xs">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-rose-600 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-200">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Print & Download Action Buttons */}
      {showActions && (
        <div className="mt-4 flex flex-col gap-2 w-full max-w-[280px]">
          {/* Primary Action: Print ID Card Photo */}
          <button
            type="button"
            onClick={handlePrintCard}
            disabled={downloadingType !== null}
            className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-bold text-xs sm:text-sm shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 border border-slate-700 disabled:opacity-60"
          >
            {downloadingType === 'print' ? (
              <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
            ) : (
              <Printer className="w-4 h-4 text-amber-400" />
            )}
            <span>{isBangla ? 'আইডি কার্ড প্রিন্ট করুন' : 'Print ID Card Photo'}</span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            {/* Download Photo Button */}
            <button
              type="button"
              onClick={handleDownloadPhoto}
              disabled={downloadingType !== null}
              className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-700 hover:to-blue-800 text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-60 active:scale-95"
            >
              {downloadingType === 'image' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-200" />
              ) : (
                <ImageIcon className="w-3.5 h-3.5 text-sky-300" />
              )}
              <span>{isBangla ? 'ছবি ডাউনলোড' : 'Download Photo'}</span>
            </button>

            {/* Download PDF Button */}
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={downloadingType !== null}
              className="py-2.5 px-3 rounded-xl bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-bold text-xs shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-60 active:scale-95"
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

