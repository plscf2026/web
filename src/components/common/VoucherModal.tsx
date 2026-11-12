import React, { useState } from 'react';
import {
  X,
  Download,
  Printer,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Receipt,
  Building,
  User,
  Clock,
  AlertTriangle,
  Calendar,
} from 'lucide-react';
import { StaffExpense } from '../../types';
import { sanitizeImageUrl } from '../../utils/security';

export interface VoucherModalProps {
  isOpen: boolean;
  onClose: () => void;
  expense: StaffExpense | null;
}

export const VoucherModal: React.FC<VoucherModalProps> = ({
  isOpen,
  onClose,
  expense,
}) => {
  const [zoomLevel, setZoomLevel] = useState(1);

  if (!isOpen || !expense) return null;

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.25, 0.75));
  const handleResetZoom = () => setZoomLevel(1);

  const handleDownloadImage = () => {
    if (!expense.receiptUrl) return;
    const a = document.createElement('a');
    a.href = expense.receiptUrl;
    a.download = `Voucher_${expense.id}_${expense.expenseDate}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black tracking-tight">Receipt / Voucher Verification</h3>
                <span
                  className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    expense.status === 'APPROVED'
                      ? 'bg-emerald-500 text-white'
                      : expense.status === 'SUBMITTED'
                      ? 'bg-amber-400 text-slate-950'
                      : expense.status === 'REJECTED'
                      ? 'bg-rose-500 text-white'
                      : 'bg-slate-700 text-slate-200'
                  }`}
                >
                  {expense.status}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 font-mono mt-0.5">
                Voucher Ref: <strong className="text-white">{expense.id}</strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            title="Close popup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Amount (BDT)
              </span>
              <span className="text-base font-black text-slate-900 font-mono">
                ৳{expense.amount.toLocaleString()}
              </span>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Category
              </span>
              <span className="text-xs font-bold text-slate-800 line-clamp-1" title={expense.category}>
                {expense.category}
              </span>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Recorded Date
              </span>
              <span className="text-xs font-mono font-bold text-slate-800 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-400" />
                {expense.expenseDate}
              </span>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Recorded Time
              </span>
              <span className="text-xs font-mono font-bold text-slate-800 flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-400" />
                {expense.expenseTime}
              </span>
            </div>
          </div>

          {/* Description & Vendor */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5 text-xs">
            <div className="flex items-center justify-between text-slate-500 text-[11px]">
              <span className="flex items-center gap-1 font-semibold">
                <User className="w-3.5 h-3.5 text-slate-400" />
                Staff: <strong className="text-slate-800">{expense.staffName}</strong> ({expense.staffId})
              </span>
              {expense.vendorName && (
                <span className="flex items-center gap-1 font-semibold">
                  <Building className="w-3.5 h-3.5 text-slate-400" />
                  Vendor: <strong className="text-slate-800">{expense.vendorName}</strong>
                </span>
              )}
            </div>
            <div className="pt-1 border-t border-slate-200/80">
              <span className="font-bold text-slate-700">Detailed Description:</span>
              <p className="text-slate-800 mt-0.5 leading-relaxed">{expense.description}</p>
            </div>
          </div>

          {/* Image Viewport */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5 text-indigo-600" />
                <span>Original Voucher / Cash Memo</span>
              </span>

              {expense.receiptUrl && (
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={handleZoomIn}
                    className="p-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white transition cursor-pointer"
                    title="Zoom in"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleZoomOut}
                    className="p-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white transition cursor-pointer"
                    title="Zoom out"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleResetZoom}
                    className="p-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white transition cursor-pointer"
                    title="Reset zoom"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[10px] font-mono font-bold text-slate-500 px-1.5">
                    {Math.round(zoomLevel * 100)}%
                  </span>
                </div>
              )}
            </div>

            <div className="relative min-h-[220px] max-h-[50vh] bg-slate-950/5 rounded-2xl border-2 border-dashed border-slate-200 overflow-auto flex items-center justify-center p-3">
              {expense.receiptUrl ? (
                <div
                  className="transition-transform duration-150 origin-center flex items-center justify-center"
                  style={{ transform: `scale(${zoomLevel})` }}
                >
                  <img
                    src={sanitizeImageUrl(expense.receiptUrl)}
                    alt={`Voucher for ${expense.id}`}
                    className="max-h-[46vh] max-w-full object-contain rounded-xl shadow-md border border-slate-200"
                  />
                </div>
              ) : (
                <div className="p-8 text-center space-y-2">
                  <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
                  <p className="text-xs text-slate-600 font-bold">
                    No physical voucher or receipt was uploaded for this expense.
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Voucher submission is optional per financial operational guidelines.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:px-6 sm:py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            {expense.receiptUrl && (
              <>
                <button
                  type="button"
                  onClick={handleDownloadImage}
                  className="px-3.5 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Download Voucher</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-3.5 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-600" />
                  <span>Print</span>
                </button>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
