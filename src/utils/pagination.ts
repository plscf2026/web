/**
 * Global Pagination Utility & Calculation Engine
 * Adheres to RAW FORM // LIGHT SKY EDITION guidelines
 */

export const DEFAULT_PAGE_SIZE = 10;
export const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 30, 40] as const;

export interface PaginationMeta {
  currentPage: number;
  pageSize: number;
  totalRecords: number;
  totalPages: number;
  startIndex: number;
  endIndex: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

/**
 * Pure calculation helper for pagination metadata
 */
export function calculatePagination(
  totalRecords: number,
  page: number = 1,
  pageSize: number = DEFAULT_PAGE_SIZE
): PaginationMeta {
  const safePageSize = Math.max(1, pageSize);
  const safeTotalRecords = Math.max(0, totalRecords);
  const totalPages = Math.max(1, Math.ceil(safeTotalRecords / safePageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);

  const startIndex = safeTotalRecords === 0 ? 0 : (currentPage - 1) * safePageSize + 1;
  const endIndex = Math.min(safeTotalRecords, currentPage * safePageSize);

  return {
    currentPage,
    pageSize: safePageSize,
    totalRecords: safeTotalRecords,
    totalPages,
    startIndex,
    endIndex,
    hasNextPage: currentPage < totalPages,
    hasPrevPage: currentPage > 1,
  };
}

/**
 * Pure slice function for in-memory / filtered datasets
 */
export function paginate<T>(
  items: T[],
  currentPage: number = 1,
  pageSize: number = DEFAULT_PAGE_SIZE
): T[] {
  if (!items || items.length === 0) return [];
  const meta = calculatePagination(items.length, currentPage, pageSize);
  const offset = (meta.currentPage - 1) * meta.pageSize;
  return items.slice(offset, offset + meta.pageSize);
}

/**
 * Generates an array of page numbers with smart ellipsis for UI controls
 * e.g., [1, 2, 3, 4, 5, 'ellipsis', 10] or [1, 'ellipsis', 4, 5, 6, 'ellipsis', 10]
 */
export function getPageNumbers(
  currentPage: number,
  totalPages: number,
  maxVisibleButtons: number = 5
): (number | 'ellipsis')[] {
  if (totalPages <= 1) return [1];
  if (totalPages <= maxVisibleButtons + 2) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: (number | 'ellipsis')[] = [];
  const half = Math.floor(maxVisibleButtons / 2);

  let start = Math.max(2, currentPage - half);
  let end = Math.min(totalPages - 1, currentPage + half);

  if (currentPage <= half + 2) {
    start = 2;
    end = Math.min(totalPages - 1, maxVisibleButtons);
  } else if (currentPage >= totalPages - (half + 1)) {
    start = Math.max(2, totalPages - maxVisibleButtons + 1);
    end = totalPages - 1;
  }

  pages.push(1);

  if (start > 2) {
    pages.push('ellipsis');
  }

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (end < totalPages - 1) {
    pages.push('ellipsis');
  }

  pages.push(totalPages);

  return pages;
}

