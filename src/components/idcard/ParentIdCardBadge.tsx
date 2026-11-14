import React, { useState, useEffect } from 'react';
import {
  FileText,
  Image as ImageIcon,
  Printer,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Users,
} from 'lucide-react';
import { StudentIdCardRecord } from '../../types/idcard';
import { Language } from '../../types';
import { generateStudentQrCodeDataUrl } from '../../utils/studentQrCode';

export interface ParentIdCardBadgeProps {
  student: StudentIdCardRecord;
  language?: Language;
  showActions?: boolean;
  className?: string;
}

export const ParentIdCardBadge: React.FC<ParentIdCardBadgeProps> = ({
  student,
  language = 'en',
  showActions = true,
  className = '',
}) => {
  const isBangla = language === 'bn';
  const [downloadingType, setDownloadingType] = useState<'pdf' | 'image' | 'print' | null>(null);
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [localQrDataUrl, setLocalQrDataUrl] = useState<string>('');

  const parentName = student.parentName || (isBangla ? 'অভিভাবকের নাম' : 'Parent / Guardian');
  const parentRelation = student.parentRelation || (isBangla ? 'অভিভাবক' : 'Guardian');
  const parentPhone = student.parentPhone || student.contactNumber || 'N/A';
  const parentAge = student.parentAge ? `${student.parentAge} Yrs` : '';
  const parentPassId = `PAR-${student.idNumber || student.registrationId || 'ID'}`;
  const parentToken = `P-${student.qrToken || 'TOKEN'}`;

  useEffect(() => {
    let isCancelled = false;
    if (student) {
      const targetUrl = `https://plscf2026.reunion.org/verify-parent-pass?id=${encodeURIComponent(
        parentPassId
      )}&studentId=${encodeURIComponent(student.idNumber || '')}&token=${encodeURIComponent(
        parentToken
      )}`;

      generateStudentQrCodeDataUrl(targetUrl)
        .then((url) => {
          if (!isCancelled) setLocalQrDataUrl(url);
        })
        .catch((err) => {
          console.warn('[ParentIdCardBadge] QR code generation notice:', err);
        });
    }
    return () => {
      isCancelled = true;
    };
  }, [student, parentPassId, parentToken]);

  const safeFilename = `Parent_Pass_${(student.idNumber || 'pass').replace(/[^a-zA-Z0-9_-]/g, '_')}`;

  const renderCardToCanvas = async (): Promise<HTMLCanvasElement> => {
    const canvas = document.createElement('canvas');
    // Scale for ultra-crisp 300+ DPI (CR80: 54x86mm => ~638 x 1016 px at 300 DPI)
    canvas.width = 640;
    canvas.height = 1018;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context not available');

    // Background gradient: Warm Burgundy / Wine
    const bgGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bgGrad.addColorStop(0, '#26040F');
    bgGrad.addColorStop(0.45, '#450A1A');
    bgGrad.addColorStop(1, '#68122B');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Decorative geometric accents
    ctx.fillStyle = 'rgba(217, 119, 6, 0.15)';
    ctx.beginPath();
    ctx.arc(canvas.width, 0, 220, 0, Math.PI * 2);
    ctx.fill();

    // Top Header Banner Box
    ctx.fillStyle = '#170208';
    ctx.fillRect(0, 0, canvas.width, 180);

    // Gold Divider line under header
    const goldGrad = ctx.createLinearGradient(0, 0, canvas.width, 0);
    goldGrad.addColorStop(0, '#B45309');
    goldGrad.addColorStop(0.5, '#FDE68A');
    goldGrad.addColorStop(1, '#D97706');
    ctx.fillStyle = goldGrad;
    ctx.fillRect(0, 180, canvas.width, 6);

    // Institution Text
    ctx.fillStyle = '#FDE68A';
    ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('POLICE LINES SCHOOL & COLLEGE, FARIDPUR', 30, 48);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 36px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('GRAND REUNION 2027', 30, 92);

    // Pass Ribbon
    ctx.fillStyle = '#F59E0B';
    ctx.fillRect(30, 114, 380, 42);
    ctx.fillStyle = '#1C040A';
    ctx.font = '900 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('★ PARENT / GUARDIAN PASS ★', 45, 143);

    // 1 Person Admit Badge
    ctx.fillStyle = '#DC2626';
    ctx.fillRect(canvas.width - 200, 114, 170, 42);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('1 PERSON ONLY', canvas.width - 190, 142);

    // Body Container (Off-white / cream card inset)
    ctx.fillStyle = '#FFFDF8';
    ctx.beginPath();
    ctx.roundRect(24, 210, canvas.width - 48, 570, 20);
    ctx.fill();
    ctx.strokeStyle = '#FDE68A';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Draw parent photo on canvas
    if (student.parentPhotoUrl) {
      try {
        const pImg = new Image();
        pImg.crossOrigin = 'anonymous';
        await new Promise<void>((resolve) => {
          pImg.onload = () => resolve();
          pImg.onerror = () => resolve();
          pImg.src = student.parentPhotoUrl!;
        });
        ctx.drawImage(pImg, 46, 230, 115, 138);
        ctx.strokeStyle = '#B45309';
        ctx.lineWidth = 3;
        ctx.strokeRect(46, 230, 115, 138);
      } catch (err) {
        console.warn('Canvas parent photo load notice:', err);
      }
    } else {
      ctx.fillStyle = '#F1F5F9';
      ctx.fillRect(46, 230, 115, 138);
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 2;
      ctx.strokeRect(46, 230, 115, 138);
      ctx.fillStyle = '#64748B';
      ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('GUARDIAN', 60, 295);
      ctx.fillText('PHOTO', 74, 318);
    }

    // Parent details beside photo
    const textStartX = 180;
    ctx.fillStyle = '#1A040B';
    ctx.font = '900 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(parentName, textStartX, 265);

    ctx.fillStyle = '#991B1B';
    ctx.font = 'bold 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(`RELATION: ${parentRelation.toUpperCase()}${parentAge ? ` (${parentAge})` : ''}`, textStartX, 300);

    ctx.fillStyle = '#DC2626';
    ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('ENTITLEMENT: ENTRY & FOOD (NO T-SHIRT)', textStartX, 332);

    // Divider line
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(46, 385);
    ctx.lineTo(canvas.width - 46, 385);
    ctx.stroke();

    // Data rows
    const drawRow = (label: string, value: string, y: number) => {
      ctx.fillStyle = '#64748B';
      ctx.font = 'bold 17px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(label, 46, y);

      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 18px monospace';
      ctx.fillText(value, 200, y);
    };

    drawRow('Pass ID:', parentPassId, 420);
    drawRow('Mobile No:', parentPhone, 455);
    drawRow('Student Name:', student.studentName, 490);
    drawRow('Student ID:', student.idNumber || student.registrationId || 'N/A', 525);
    drawRow('Student Batch:', student.batchYear || student.batchName || 'General', 560);
    drawRow('Access Token:', parentToken, 595);

    // QR Code Container
    if (localQrDataUrl) {
      const qrImg = new Image();
      qrImg.crossOrigin = 'anonymous';
      await new Promise<void>((resolve) => {
        qrImg.onload = () => resolve();
        qrImg.onerror = () => resolve();
        qrImg.src = localQrDataUrl;
      });
      ctx.drawImage(qrImg, canvas.width - 220, 410, 165, 165);
      ctx.strokeStyle = '#B45309';
      ctx.lineWidth = 2;
      ctx.strokeRect(canvas.width - 220, 410, 165, 165);
    }

    // Security Notice Box inside Inset
    ctx.fillStyle = '#FEF2F2';
    ctx.fillRect(40, 630, canvas.width - 80, 125);
    ctx.strokeStyle = '#FCA5A5';
    ctx.lineWidth = 1;
    ctx.strokeRect(40, 630, canvas.width - 80, 125);

    ctx.fillStyle = '#991B1B';
    ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('ENTRY GUIDELINES & PROTOCOL:', 55, 655);
    ctx.fillStyle = '#4B5563';
    ctx.font = '13.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('• Entitlement: Strictly 1 parent/guardian for Gate & Food. NO T-SHIRT.', 55, 680);
    ctx.fillText('• Must be accompanied by registered student at campus security gate.', 55, 705);
    ctx.fillText('• Non-transferable. QR code verification mandatory at gate station.', 55, 730);

    // Campus Signature Footer
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('POLICE LINES CAMPUS, FARIDPUR • REUNION 2027 OFFICIAL ADMIT', 50, 830);

    ctx.fillStyle = '#FDE68A';
    ctx.font = '14px monospace';
    ctx.fillText(`SECURITY HASH: ${student.qrToken ? student.qrToken.toUpperCase() : 'AUTH'}-PAR-2027`, 50, 860);

    return canvas;
  };

  const handlePrintCard = async () => {
    try {
      setDownloadingType('print');
      setErrorMessage('');
      const canvas = await renderCardToCanvas();
      const dataUrl = canvas.toDataURL('image/png');

      let iframe = document.getElementById('parent-pass-print-iframe') as HTMLIFrameElement;
      if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = 'parent-pass-print-iframe';
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
            <title>Parent Pass - ${parentName} (${parentPassId})</title>
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
              <img src="${dataUrl}" alt="Parent Guardian Pass" />
            </div>
            <div class="cut-guide">
              <strong>Police Lines School and College, Faridpur — Reunion 2027</strong><br/>
              Official Parent / Guardian Entry Pass (CR80 Dimension: 54 × 86 mm)
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
      console.error('[ParentIdCardBadge] Print error:', err);
      window.print();
    } finally {
      setDownloadingType(null);
    }
  };

  const handleDownloadPhoto = async () => {
    try {
      setDownloadingType('image');
      setErrorMessage('');
      const canvas = await renderCardToCanvas();
      const dataUrl = canvas.toDataURL('image/png');

      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${safeFilename}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setSuccessMessage(isBangla ? 'অভিভাবক পাস ছবি ডাউনলোড হয়েছে!' : 'Parent pass photo downloaded!');
      setTimeout(() => setSuccessMessage(''), 3500);
    } catch (err: any) {
      console.error('[ParentIdCardBadge] Download photo failed:', err);
      setErrorMessage(isBangla ? 'ছবি ডাউনলোড ব্যর্থ হয়েছে।' : 'Failed to download photo.');
      setTimeout(() => setErrorMessage(''), 4000);
    } finally {
      setDownloadingType(null);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      setDownloadingType('pdf');
      setErrorMessage('');
      const { jsPDF } = await import('jspdf');
      const canvas = await renderCardToCanvas();
      const imgData = canvas.toDataURL('image/png');

      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [54, 86],
      });
      doc.addImage(imgData, 'PNG', 0, 0, 54, 86);
      doc.save(`${safeFilename}.pdf`);

      setSuccessMessage(isBangla ? 'অভিভাবক পাস PDF ডাউনলোড হয়েছে!' : 'Parent pass PDF downloaded!');
      setTimeout(() => setSuccessMessage(''), 3500);
    } catch (err: any) {
      console.error('[ParentIdCardBadge] Download PDF failed:', err);
      setErrorMessage(isBangla ? 'PDF ডাউনলোড ব্যর্থ হয়েছে।' : 'Failed to download PDF.');
      setTimeout(() => setErrorMessage(''), 4000);
    } finally {
      setDownloadingType(null);
    }
  };

  return (
    <div className={`flex flex-col items-center ${className}`}>
      {/* Visual Badge Card: Distinct Deep Burgundy / Royal Wine Theme */}
      <div
        id={`parent-pass-card-${student.idNumber}`}
        className="relative w-[280px] h-[446px] rounded-2xl overflow-hidden shadow-2xl border-2 border-amber-500/60 select-none flex flex-col justify-between"
        style={{
          background: 'linear-gradient(180deg, #24040F 0%, #450A1A 52%, #68122B 100%)',
        }}
      >
        {/* Top Header */}
        <div className="p-3 text-left border-b border-amber-400/40 relative">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold tracking-wider text-amber-300 uppercase flex items-center gap-1">
              <Users className="w-3 h-3 text-amber-400" />
              <span>PARENT PASS</span>
            </span>
            <span className="text-[8px] font-black tracking-widest text-white bg-rose-700/80 px-1.5 py-0.5 rounded border border-rose-400/50">
              1 PERSON ONLY
            </span>
          </div>
          <h4 className="text-[15px] font-extrabold text-white leading-none mt-1">
            Police Lines
          </h4>
          <p className="text-[12px] font-bold text-amber-100 leading-tight">
            School &amp; College, Faridpur
          </p>
          <div className="flex items-center justify-between mt-1 pt-1 border-t border-amber-500/20">
            <span className="text-[8px] font-bold text-amber-300 tracking-wider">REUNION 2027</span>
            <span className="text-[8px] font-mono text-white/80">Fee: ৳1,500 PAID</span>
          </div>
        </div>

        {/* Middle Content: Inset White/Cream Card */}
        <div className="mx-2.5 my-1.5 bg-[#FFFDF8] rounded-xl p-2.5 shadow-md border border-amber-300 flex-1 flex flex-col justify-between text-left">
          {/* Parent Headline & Photo Frame */}
          <div className="flex items-center gap-2.5 border-b border-slate-200 pb-2">
            {/* Parent Photo */}
            <div className="w-[58px] h-[70px] rounded-lg overflow-hidden border-2 border-amber-600/80 bg-slate-100 shrink-0 shadow-xs relative">
              {student.parentPhotoUrl ? (
                <img
                  src={student.parentPhotoUrl}
                  alt={parentName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 text-slate-400">
                  <Users className="w-5 h-5 text-amber-800/40" />
                  <span className="text-[7px] mt-0.5 text-slate-500 font-bold">Photo</span>
                </div>
              )}
            </div>

            {/* Parent Details beside photo */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-[8px] font-black text-rose-800 uppercase tracking-wider bg-rose-100 px-1.5 py-0.5 rounded border border-rose-300">
                  {parentRelation}
                </span>
                {parentAge && (
                  <span className="text-[8px] font-semibold text-slate-500 font-mono">{parentAge}</span>
                )}
              </div>
              <h3 className="text-[12.5px] font-extrabold text-slate-900 leading-tight truncate mt-1">
                {parentName}
              </h3>
              <p className="text-[9px] text-slate-600 font-mono mt-0.5 truncate">
                {parentPhone}
              </p>
              <div className="mt-1">
                <span className="text-[7px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 inline-block">
                  🚫 NO T-SHIRT (ENTRY &amp; FOOD ONLY)
                </span>
              </div>
            </div>
          </div>

          {/* Student reference info & QR code */}
          <div className="flex items-center justify-between gap-1.5 py-1">
            <div className="flex-1 space-y-0.5 min-w-0 text-[8.5px]">
              <div className="border-b border-slate-100 pb-0.5">
                <span className="text-slate-500">Student: </span>
                <span className="font-bold text-slate-900 truncate inline-block max-w-[95px] align-bottom">
                  {student.studentName}
                </span>
              </div>
              <div className="border-b border-slate-100 pb-0.5">
                <span className="text-slate-500">Student ID: </span>
                <span className="font-mono font-bold text-slate-800 truncate inline-block max-w-[95px] align-bottom">
                  {student.idNumber}
                </span>
              </div>
              <div className="border-b border-slate-100 pb-0.5">
                <span className="text-slate-500">Pass ID: </span>
                <span className="font-mono font-bold text-rose-900 truncate inline-block max-w-[95px] align-bottom">
                  {parentPassId}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Token: </span>
                <span className="font-mono font-extrabold text-amber-700 bg-amber-50 px-1 py-0.2 rounded border border-amber-300">
                  {parentToken}
                </span>
              </div>
            </div>

            {/* QR Box */}
            <div className="w-[74px] h-[74px] p-1 bg-white rounded-lg border border-amber-500 shadow-2xs flex items-center justify-center shrink-0">
              {localQrDataUrl ? (
                <img
                  src={localQrDataUrl}
                  alt="Parent QR"
                  className="w-full h-full object-contain"
                />
              ) : (
                <Loader2 className="w-5 h-5 animate-spin text-amber-600" />
              )}
            </div>
          </div>

          {/* Security rule notice */}
          <div className="bg-rose-50 border border-rose-200 rounded p-1 text-[7.5px] text-rose-900 leading-tight">
            <strong>১ জন অভিভাবকের প্রবেশাধিকার:</strong> শিক্ষার্থী সহ প্রধান গেটে কিউআর যাচাই সাপেক্ষে প্রবেশ প্রযোজ্য।
          </div>
        </div>

        {/* Footer */}
        <div className="px-3 py-1.5 bg-[#170208] text-center border-t border-amber-400/30">
          <p className="text-[8px] font-bold text-amber-300 tracking-wider">
            POLICE LINES REUNION 2027 • OFFICIAL GUARDIAN PASS
          </p>
        </div>
      </div>

      {/* Success / Error Feedback */}
      {successMessage && (
        <div className="mt-2.5 flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-200 shadow-2xs">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="mt-2.5 flex items-center gap-1.5 text-xs font-semibold text-rose-600 bg-rose-50 px-3 py-1 rounded-xl border border-rose-200">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Action Buttons */}
      {showActions && (
        <div className="mt-3 flex flex-col gap-2 w-full max-w-[280px]">
          <button
            type="button"
            onClick={handlePrintCard}
            disabled={downloadingType !== null}
            className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-rose-900 to-amber-900 hover:from-rose-800 hover:to-amber-800 active:scale-95 text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 border border-amber-500/40 disabled:opacity-60"
          >
            {downloadingType === 'print' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
            ) : (
              <Printer className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span>{isBangla ? 'অভিভাবক পাস প্রিন্ট করুন' : 'Print Parent Pass Photo'}</span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleDownloadPhoto}
              disabled={downloadingType !== null}
              className="py-2 px-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1 disabled:opacity-60 active:scale-95"
            >
              {downloadingType === 'image' ? (
                <Loader2 className="w-3 h-3 animate-spin text-amber-200" />
              ) : (
                <ImageIcon className="w-3 h-3 text-amber-200" />
              )}
              <span>{isBangla ? 'ছবি ডাউনলোড' : 'Download Photo'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={downloadingType !== null}
              className="py-2 px-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-bold text-xs shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1 disabled:opacity-60 active:scale-95"
            >
              {downloadingType === 'pdf' ? (
                <Loader2 className="w-3 h-3 animate-spin text-rose-600" />
              ) : (
                <FileText className="w-3 h-3 text-rose-600" />
              )}
              <span>{isBangla ? 'PDF ডাউনলোড' : 'Download PDF'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
