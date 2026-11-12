/**
 * Police Lines School & College, Faridpur - Grand Reunion 2026 / 2027
 * Interactive Student ID Card Preview Modal
 * Replicates the PowerPoint ID Card Design with live CSS & Canvas rendering
 */

import React, { useState, useEffect } from 'react';
import { X, Download, Printer, CheckCircle2, AlertTriangle, ShieldCheck, Loader2 } from 'lucide-react';
import { StudentIdCardRecord } from '../../../types/idcard';
import { generateStudentQrCodeDataUrl } from '../../../utils/studentQrCode';
import { IdCardStore } from '../../../services/idCardStore';

interface IdCardPreviewModalProps {
  student: StudentIdCardRecord;
  currentUserName: string;
  currentUserRole: string;
  onClose: () => void;
  onCardGenerated?: () => void;
}

export const IdCardPreviewModal: React.FC<IdCardPreviewModalProps> = ({
  student,
  currentUserName,
  currentUserRole,
  onClose,
  onCardGenerated,
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
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
          console.warn('[IdCardPreviewModal] QR code generation notice:', err);
        });
    }
    return () => {
      isCancelled = true;
    };
  }, [student?.verificationUrl, student?.idNumber, student?.qrToken, student?.registrationId]);

  if (!student) {
    return null;
  }

  const safeIdNumber = (student.idNumber || student.registrationId || 'card').replace(
    /[^a-zA-Z0-9_-]/g,
    '_'
  );

  const handleDownloadPdf = async () => {
    try {
      setIsDownloading(true);
      const { generateIndividualIdCardPdf } = await import('../../../utils/idCardGenerator');
      const { pdfBlob } = await generateIndividualIdCardPdf(student);

      // Trigger browser download
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Student_ID_${safeIdNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Mark card generated in store
      IdCardStore.markCardGenerated(student.registrationId, {
        generatedBy: currentUserName,
        fileSizeBytes: pdfBlob.size,
      });

      // Record download audit log
      IdCardStore.logDownload({
        userId: currentUserName,
        userName: currentUserName,
        userRole: currentUserRole,
        downloadType: 'INDIVIDUAL_PDF',
        batchYear: student.batchYear || 'N/A',
        registrationId: student.idNumber || student.registrationId,
        cardCount: 1,
        status: 'SUCCESS',
        details: `Downloaded individual ID card for ${student.studentName || 'Student'} (${student.idNumber || 'ID'})`,
      });

      setDownloadSuccess(true);
      if (onCardGenerated) onCardGenerated();
      setTimeout(() => setDownloadSuccess(false), 3000);
    } catch (err) {
      console.error('[IdCardPreview] Failed to generate PDF:', err);
      alert('Unable to generate ID card PDF. Please verify data and try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  const isCurrentStudent = (student.batchName || student.batchYear || '').toLowerCase().includes('class');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h3 className="text-lg font-bold text-white">Student ID Card Preview</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content - The Card Render */}
        <div className="p-6 flex flex-col items-center justify-center bg-slate-900/60 overflow-y-auto">
          {/* Physical CR80 Card Dimensions: 54 × 86 mm (Ratio: 1 : 1.5926) */}
          <div
            id="student-id-card-view"
            className="relative w-[280px] h-[446px] rounded-xl overflow-hidden shadow-2xl border border-amber-400/40 select-none"
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
              <div className="absolute top-2 left-3 text-left">
                {/* Gold header rule */}
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
                  {student.photoUrl ? (
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
              <div className="absolute top-[135px] left-[105px] right-2 text-left">
                <div className="w-5 h-[2px] bg-[#EBC474] mb-1" />
                <h3 className="text-[15px] font-bold text-[#FFFCF5] leading-tight line-clamp-2">
                  {student.studentName || 'Student Name'}
                </h3>
                <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[8px] font-semibold tracking-wider text-[#8ED9F5] bg-sky-950/60 border border-sky-400/30">
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
              <div className="flex-1 pr-2 space-y-2.5 text-left">
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
              <div className="w-[100px] h-[100px] rounded-lg p-[2px] bg-gradient-to-br from-[#AE7108] via-[#FFE590] to-[#B4780B] shadow-md flex-shrink-0">
                <div className="w-full h-full bg-white rounded-[6px] p-1.5 flex flex-col items-center justify-center relative">
                  {/* Decorative corner ticks */}
                  <div className="absolute top-1 left-1 w-2 h-2 border-t-2 border-l-2 border-[#76A4BE]" />
                  <div className="absolute top-1 right-1 w-2 h-2 border-t-2 border-r-2 border-[#76A4BE]" />
                  <div className="absolute bottom-1 left-1 w-2 h-2 border-b-2 border-l-2 border-[#76A4BE]" />
                  <div className="absolute bottom-1 right-1 w-2 h-2 border-b-2 border-r-2 border-[#76A4BE]" />

                  {/* QR Code graphic */}
                  {localQrDataUrl ? (
                    <img
                      src={localQrDataUrl}
                      alt="Verification QR"
                      className="w-[80px] h-[80px] object-contain"
                    />
                  ) : (
                    <div className="w-[80px] h-[80px] flex items-center justify-center bg-slate-50 rounded text-slate-400">
                      <Loader2 className="w-5 h-5 animate-spin text-amber-600" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 3. Campus Signature Footer Artwork */}
            <div className="absolute bottom-0 left-0 right-0 h-[112px]">
              {/* Gold border line above campus photo */}
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

              {/* Bottom-right navy corner triangle with gold line */}
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

          {/* Review Alert if missing info */}
          {student.cardStatus === 'FLAGGED_REVIEW' && (
            <div className="mt-4 w-full p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2 text-amber-300 text-xs">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>
                <strong>Review Required:</strong> {student.reviewReason || 'Missing data detected.'}
              </span>
            </div>
          )}

          {downloadSuccess && (
            <div className="mt-3 flex items-center gap-1.5 text-emerald-400 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              <span>Print-ready PDF downloaded successfully!</span>
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-6 py-4 border-t border-slate-800 bg-slate-950/80">
          <div className="text-xs text-slate-400 text-center sm:text-left">
            Dimensions: <strong className="text-white">54 × 86 mm</strong> (Standard CR80)
          </div>
          <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2.5 w-full sm:w-auto">
            <button
              onClick={() => window.print()}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs flex items-center gap-1.5 transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Print Preview
            </button>
            <button
              onClick={handleDownloadPdf}
              disabled={isDownloading}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              {isDownloading ? 'Generating PDF...' : 'Download Individual PDF'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

