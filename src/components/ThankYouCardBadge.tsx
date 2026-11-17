import React, { useState, useId, useMemo } from 'react';
import {
  Download,
  Image as ImageIcon,
  FileText,
  Printer,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Language } from '../types';
import {
  ThankYouCardData,
  buildThankYouCardSvg,
  downloadThankYouCardSvg,
  downloadThankYouCardPng,
  generateThankYouCardPdf,
  printThankYouCard,
} from '../utils/thankYouCardGenerator';

export interface ThankYouCardBadgeProps {
  cardData: ThankYouCardData;
  language?: Language;
  showActions?: boolean;
  className?: string;
}

export const ThankYouCardBadge: React.FC<ThankYouCardBadgeProps> = ({
  cardData,
  language = 'en',
  showActions = true,
  className = '',
}) => {
  const isBangla = language === 'bn';
  const instanceId = useId();
  const safeUniqueId = useMemo(
    () => `tycard_${instanceId.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
    [instanceId]
  );

  const [downloadingType, setDownloadingType] = useState<'svg' | 'png' | 'pdf' | 'print' | null>(null);
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const enrichedCardData: ThankYouCardData = useMemo(() => {
    return {
      ...cardData,
      uniqueId: safeUniqueId,
    };
  }, [cardData, safeUniqueId]);

  const svgContent = useMemo(() => {
    return buildThankYouCardSvg(enrichedCardData);
  }, [enrichedCardData]);

  const handleDownloadSvg = () => {
    try {
      setDownloadingType('svg');
      downloadThankYouCardSvg(enrichedCardData);
      setSuccessMessage(isBangla ? 'SVG কার্ড সফলভাবে ডাউনলোড হয়েছে' : 'SVG Card downloaded successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to download SVG');
      setTimeout(() => setErrorMessage(''), 4000);
    } finally {
      setDownloadingType(null);
    }
  };

  const handleDownloadPng = async () => {
    try {
      setDownloadingType('png');
      await downloadThankYouCardPng(enrichedCardData);
      setSuccessMessage(isBangla ? 'PNG ছবি সফলভাবে ডাউনলোড হয়েছে' : 'High-res image downloaded successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to generate image');
      setTimeout(() => setErrorMessage(''), 4000);
    } finally {
      setDownloadingType(null);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      setDownloadingType('pdf');
      const blob = await generateThankYouCardPdf(enrichedCardData);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Thank_You_Card_${enrichedCardData.registrationId || 'Reunion'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      setSuccessMessage(isBangla ? 'অফিসিয়াল PDF কার্ড ডাউনলোড হয়েছে' : 'Official PDF card downloaded');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to generate PDF');
      setTimeout(() => setErrorMessage(''), 4000);
    } finally {
      setDownloadingType(null);
    }
  };

  const handlePrint = async () => {
    try {
      setDownloadingType('print');
      await printThankYouCard(enrichedCardData);
    } catch (err: any) {
      setErrorMessage(err.message || 'Print error');
      setTimeout(() => setErrorMessage(''), 4000);
    } finally {
      setDownloadingType(null);
    }
  };

  return (
    <div className={`flex flex-col items-center w-full max-w-md mx-auto ${className}`}>
      {/* Official Vector Thank You Card Display Frame */}
      <div className="relative w-full aspect-[10/14] rounded-2xl overflow-hidden shadow-2xl border-4 border-amber-600/50 bg-[#3b0a14] flex items-center justify-center">
        <div
          className="w-full h-full flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>svg]:max-w-full [&>svg]:max-h-full"
          dangerouslySetInnerHTML={{ __html: svgContent }}
        />
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="mt-3 w-full flex items-center gap-2 p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="mt-3 w-full flex items-center gap-2 p-2.5 rounded-xl bg-rose-950/80 border border-rose-500/40 text-rose-300 text-xs animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Action Buttons */}
      {showActions && (
        <div className="mt-4 w-full grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            type="button"
            onClick={handleDownloadPng}
            disabled={downloadingType !== null}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/40 text-xs font-bold transition-all cursor-pointer shadow-xs disabled:opacity-50"
            title="Download high-resolution image"
          >
            {downloadingType === 'png' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ImageIcon className="w-3.5 h-3.5" />
            )}
            <span>{isBangla ? 'ছবি (PNG)' : 'PNG Image'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={downloadingType !== null}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/40 text-xs font-bold transition-all cursor-pointer shadow-xs disabled:opacity-50"
            title="Download printable PDF"
          >
            {downloadingType === 'pdf' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <FileText className="w-3.5 h-3.5" />
            )}
            <span>{isBangla ? 'পিডিএফ (PDF)' : 'PDF File'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadSvg}
            disabled={downloadingType !== null}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/40 text-xs font-bold transition-all cursor-pointer shadow-xs disabled:opacity-50"
            title="Download scalable vector SVG"
          >
            {downloadingType === 'svg' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>{isBangla ? 'ভেক্টর (SVG)' : 'Vector SVG'}</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            disabled={downloadingType !== null}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-black text-xs transition-all cursor-pointer shadow-sm disabled:opacity-50"
            title="Print Thank You Card"
          >
            {downloadingType === 'print' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Printer className="w-3.5 h-3.5" />
            )}
            <span>{isBangla ? 'প্রিন্ট' : 'Print'}</span>
          </button>
        </div>
      )}
    </div>
  );
};
