import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PAGE_SIZE,
  DEFAULT_PAGE_SIZE_OPTIONS,
  calculatePagination,
  paginate,
  getPageNumbers,
} from './pagination';

describe('Global Pagination Engine', () => {
  it('1. Default records per page is 10 and default options are [10, 20, 30, 40]', () => {
    assert.strictEqual(DEFAULT_PAGE_SIZE, 10);
    assert.deepStrictEqual(DEFAULT_PAGE_SIZE_OPTIONS, [10, 20, 30, 40]);
  });

  it('2. Calculates total pages dynamically for 100 records', () => {
    // 10 per page -> 10 pages
    const p10 = calculatePagination(100, 1, 10);
    assert.strictEqual(p10.totalPages, 10);
    assert.strictEqual(p10.startIndex, 1);
    assert.strictEqual(p10.endIndex, 10);

    // 20 per page -> 5 pages
    const p20 = calculatePagination(100, 1, 20);
    assert.strictEqual(p20.totalPages, 5);
    assert.strictEqual(p20.startIndex, 1);
    assert.strictEqual(p20.endIndex, 20);

    // 30 per page -> 4 pages (ceil(100/30) = 4)
    const p30 = calculatePagination(100, 1, 30);
    assert.strictEqual(p30.totalPages, 4);
    assert.strictEqual(p30.startIndex, 1);
    assert.strictEqual(p30.endIndex, 30);

    // 40 per page -> 3 pages (ceil(100/40) = 3)
    const p40 = calculatePagination(100, 1, 40);
    assert.strictEqual(p40.totalPages, 3);
    assert.strictEqual(p40.startIndex, 1);
    assert.strictEqual(p40.endIndex, 40);
  });

  it('3. Handles edge cases: 0 records, out-of-range page requests, and remainder pages', () => {
    // Empty dataset
    const empty = calculatePagination(0, 1, 10);
    assert.strictEqual(empty.totalPages, 1);
    assert.strictEqual(empty.totalRecords, 0);
    assert.strictEqual(empty.startIndex, 0);
    assert.strictEqual(empty.endIndex, 0);
    assert.strictEqual(empty.hasNextPage, false);
    assert.strictEqual(empty.hasPrevPage, false);

    // Partial last page (23 items at 10/page)
    const partial = calculatePagination(23, 3, 10);
    assert.strictEqual(partial.totalPages, 3);
    assert.strictEqual(partial.startIndex, 21);
    assert.strictEqual(partial.endIndex, 23);
    assert.strictEqual(partial.hasNextPage, false);
    assert.strictEqual(partial.hasPrevPage, true);

    // Out of range (requesting page 99 when there are only 3 pages) -> clamps to page 3
    const clamped = calculatePagination(25, 99, 10);
    assert.strictEqual(clamped.currentPage, 3);
  });

  it('4. Slices in-memory datasets accurately with paginate helper', () => {
    const dataset = Array.from({ length: 25 }, (_, i) => `item-${i + 1}`);

    const page1 = paginate(dataset, 1, 10);
    assert.strictEqual(page1.length, 10);
    assert.strictEqual(page1[0], 'item-1');
    assert.strictEqual(page1[9], 'item-10');

    const page2 = paginate(dataset, 2, 10);
    assert.strictEqual(page2.length, 10);
    assert.strictEqual(page2[0], 'item-11');
    assert.strictEqual(page2[9], 'item-20');

    const page3 = paginate(dataset, 3, 10);
    assert.strictEqual(page3.length, 5);
    assert.strictEqual(page3[0], 'item-21');
    assert.strictEqual(page3[4], 'item-25');

    // Page size 20
    const page1Of20 = paginate(dataset, 1, 20);
    assert.strictEqual(page1Of20.length, 20);

    const page2Of20 = paginate(dataset, 2, 20);
    assert.strictEqual(page2Of20.length, 5);
  });

  it('5. Generates smart dynamic page numbers with ellipsis', () => {
    // 5 pages: all visible
    const pages5 = getPageNumbers(1, 5);
    assert.deepStrictEqual(pages5, [1, 2, 3, 4, 5]);

    // 10 pages, on page 1: [1, 2, 3, 4, 5, 'ellipsis', 10]
    const pages10Start = getPageNumbers(1, 10);
    assert.deepStrictEqual(pages10Start, [1, 2, 3, 4, 5, 'ellipsis', 10]);

    // 10 pages, on page 5: [1, 'ellipsis', 3, 4, 5, 6, 7, 'ellipsis', 10]
    const pages10Mid = getPageNumbers(5, 10);
    assert.deepStrictEqual(pages10Mid, [1, 'ellipsis', 3, 4, 5, 6, 7, 'ellipsis', 10]);

    // 10 pages, on page 10: [1, 'ellipsis', 6, 7, 8, 9, 10]
    const pages10End = getPageNumbers(10, 10);
    assert.deepStrictEqual(pages10End, [1, 'ellipsis', 6, 7, 8, 9, 10]);
  });
});
