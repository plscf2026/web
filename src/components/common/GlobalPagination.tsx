import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import {
  DEFAULT_PAGE_SIZE,
  DEFAULT_PAGE_SIZE_OPTIONS,
  calculatePagination,
  getPageNumbers,
} from '../../utils/pagination';

export interface GlobalPaginationProps {
  currentPage: number;
  totalRecords: number;
  pageSize?: number;
  onPageChange: (newPage: number) => void;
  onPageSizeChange?: (newPageSize: number) => void;
  pageSizeOptions?: readonly number[] | number[];
  language?: 'en' | 'bn';
  className?: string;
  showPageSizeSelector?: boolean;
  variant?: 'light' | 'dark';
}

export const GlobalPagination: React.FC<GlobalPaginationProps> = ({
  currentPage,
  totalRecords,
  pageSize = DEFAULT_PAGE_SIZE,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  language = 'en',
  className = '',
  showPageSizeSelector = true,
  variant = 'light',
}) => {
  const meta = calculatePagination(totalRecords, currentPage, pageSize);
  const pageNumbers = getPageNumbers(meta.currentPage, meta.totalPages, 5);

  const handlePageSizeSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSize = Number(e.target.value);
    if (onPageSizeChange) {
      onPageSizeChange(newSize);
    }
    // Automatically reset to page 1
    onPageChange(1);
  };

  const isDark = variant === 'dark';

  // Text localization
  const showingText =
    language === 'bn'
      ? `${totalRecords === 0 ? 0 : meta.startIndex}–${meta.endIndex}, সর্বমোট ${totalRecords} টি রেকর্ড`
      : `Showing ${meta.startIndex}–${meta.endIndex} of ${totalRecords} records`;

  const rowsPerPageText = language === 'bn' ? 'প্রতি পৃষ্ঠায়:' : 'Rows per page:';
  const pageLabel = language === 'bn' ? 'পৃষ্ঠা' : 'Page';
  const ofLabel = language === 'bn' ? 'এর' : 'of';

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-4 py-3.5 px-4 text-xs select-none transition-colors ${
        isDark
          ? 'bg-slate-900/90 text-slate-300 border-t border-slate-800'
          : 'bg-[#F0F6FA]/80 text-[#0F172A] border-t border-[#E2EEF8]'
      } ${className}`}
    >
      {/* Left: Record Range Summary & Rows Per Page */}
      <div className="flex flex-wrap items-center gap-4 text-xs w-full sm:w-auto justify-between sm:justify-start">
        <span className={`font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
          {showingText}
        </span>

        {showPageSizeSelector && onPageSizeChange && (
          <div className="flex items-center gap-1.5">
            <label
              htmlFor="pagination-page-size"
              className={`text-[11px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
            >
              {rowsPerPageText}
            </label>
            <select
              id="pagination-page-size"
              value={meta.pageSize}
              onChange={handlePageSizeSelect}
              className={`rounded-lg px-2 py-1 text-xs font-semibold focus:outline-hidden transition-all cursor-pointer ${
                isDark
                  ? 'bg-slate-800 text-slate-200 border border-slate-700 hover:border-slate-600 focus:border-[#0284C7]'
                  : 'bg-white text-[#0F172A] border border-[#E2EEF8] hover:border-[#0284C7]/40 focus:border-[#0284C7] shadow-2xs'
              }`}
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right: Pagination Controls */}
      <div className="flex items-center gap-1.5 w-full sm:w-auto justify-center sm:justify-end">
        {/* Mobile Page indicator (compact) */}
        <div className={`sm:hidden text-xs font-medium mr-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
          {pageLabel} <span className="font-bold text-[#0284C7]">{meta.currentPage}</span> {ofLabel} {meta.totalPages}
        </div>

        {/* First Page Button */}
        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={!meta.hasPrevPage}
          title={language === 'bn' ? 'প্রথম পৃষ্ঠা' : 'First Page'}
          className={`flex items-center justify-center w-8 h-8 rounded-lg border transition-all ${
            meta.hasPrevPage
              ? isDark
                ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white cursor-pointer active:scale-95'
                : 'bg-white border-[#E2EEF8] text-[#0F172A] hover:bg-[#E2EEF8] hover:border-[#0284C7]/40 cursor-pointer active:scale-95 shadow-2xs'
              : isDark
              ? 'bg-slate-900 border-slate-800 text-slate-600 opacity-40 cursor-not-allowed'
              : 'bg-slate-50 border-slate-200 text-slate-300 opacity-40 cursor-not-allowed'
          }`}
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>

        {/* Previous Button */}
        <button
          type="button"
          onClick={() => onPageChange(meta.currentPage - 1)}
          disabled={!meta.hasPrevPage}
          title={language === 'bn' ? 'পূর্ববর্তী' : 'Previous'}
          className={`flex items-center justify-center px-2.5 h-8 gap-1 rounded-lg border font-medium transition-all ${
            meta.hasPrevPage
              ? isDark
                ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white cursor-pointer active:scale-95'
                : 'bg-white border-[#E2EEF8] text-[#0F172A] hover:bg-[#E2EEF8] hover:border-[#0284C7]/40 cursor-pointer active:scale-95 shadow-2xs'
              : isDark
              ? 'bg-slate-900 border-slate-800 text-slate-600 opacity-40 cursor-not-allowed'
              : 'bg-slate-50 border-slate-200 text-slate-300 opacity-40 cursor-not-allowed'
          }`}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span className="hidden md:inline">{language === 'bn' ? 'পূর্ববর্তী' : 'Prev'}</span>
        </button>

        {/* Dynamic Number Buttons (hidden on extra small screens for clean compact layout) */}
        <div className="hidden sm:flex items-center gap-1">
          {pageNumbers.map((p, idx) => {
            if (p === 'ellipsis') {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className={`w-7 text-center font-bold tracking-widest ${
                    isDark ? 'text-slate-600' : 'text-slate-400'
                  }`}
                >
                  …
                </span>
              );
            }

            const isActive = p === meta.currentPage;
            return (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                className={`min-w-8 h-8 px-2 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                  isActive
                    ? isDark
                      ? 'bg-[#0284C7] text-white border border-[#0284C7] shadow-sm scale-105'
                      : 'bg-[#0F172A] text-white border border-[#0F172A] shadow-sm scale-105'
                    : isDark
                    ? 'bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white'
                    : 'bg-white border border-[#E2EEF8] text-[#0F172A] hover:bg-[#E2EEF8] hover:border-[#0284C7]/40 shadow-2xs'
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>

        {/* Next Button */}
        <button
          type="button"
          onClick={() => onPageChange(meta.currentPage + 1)}
          disabled={!meta.hasNextPage}
          title={language === 'bn' ? 'পরবর্তী' : 'Next'}
          className={`flex items-center justify-center px-2.5 h-8 gap-1 rounded-lg border font-medium transition-all ${
            meta.hasNextPage
              ? isDark
                ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white cursor-pointer active:scale-95'
                : 'bg-white border-[#E2EEF8] text-[#0F172A] hover:bg-[#E2EEF8] hover:border-[#0284C7]/40 cursor-pointer active:scale-95 shadow-2xs'
              : isDark
              ? 'bg-slate-900 border-slate-800 text-slate-600 opacity-40 cursor-not-allowed'
              : 'bg-slate-50 border-slate-200 text-slate-300 opacity-40 cursor-not-allowed'
          }`}
        >
          <span className="hidden md:inline">{language === 'bn' ? 'পরবর্তী' : 'Next'}</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        {/* Last Page Button */}
        <button
          type="button"
          onClick={() => onPageChange(meta.totalPages)}
          disabled={!meta.hasNextPage}
          title={language === 'bn' ? 'সর্বশেষ পৃষ্ঠা' : 'Last Page'}
          className={`flex items-center justify-center w-8 h-8 rounded-lg border transition-all ${
            meta.hasNextPage
              ? isDark
                ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white cursor-pointer active:scale-95'
                : 'bg-white border-[#E2EEF8] text-[#0F172A] hover:bg-[#E2EEF8] hover:border-[#0284C7]/40 cursor-pointer active:scale-95 shadow-2xs'
              : isDark
              ? 'bg-slate-900 border-slate-800 text-slate-600 opacity-40 cursor-not-allowed'
              : 'bg-slate-50 border-slate-200 text-slate-300 opacity-40 cursor-not-allowed'
          }`}
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

