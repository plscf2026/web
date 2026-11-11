/**
 * Police Lines High School & College, Faridpur Reunion 2027
 * Browser-Based XSS Execution & DOM Integration Security Test Suite
 *
 * Verifies that malicious payloads do not execute within an active DOM runtime.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import {
  sanitizeUrl,
  sanitizeImageUrl,
  formatCsvRow,
  sanitizeSearchQuery,
} from './security';
import { RmsStore } from '../services/rmsStore';

test('Browser-Based XSS 1: Stored XSS does not execute in DOM', () => {
  const dom = new JSDOM(
    '<!DOCTYPE html><html><body><div id="container"></div></body></html>',
    { runScripts: 'dangerously' }
  );
  const win = dom.window as any;
  const doc = dom.window.document;
  const container = doc.getElementById('container')!;

  // 1. Attempt Stored XSS via Task Title
  const payload = '<script>window.STORED_PWNED = true;</script>Task 01';
  const task = RmsStore.createTask({
    title: payload,
    committeeId: 'cultural-entertainment',
    committeeName: 'Cultural Committee',
    priority: 'HIGH',
    status: 'PENDING',
    description: 'Description with <img src=x onerror="window.STORED_PWNED = true;">',
    assignedMemberId: 'MEM-01',
    assignedMemberName: 'Rahim',
    startDate: '2027-01-10',
    deadline: '2027-01-20',
    attachments: [],
    comments: [],
    createdBy: 'ADMIN',
    createdByName: 'Admin',
  });

  // Render into DOM node (simulating React rendering)
  const titleSpan = doc.createElement('span');
  titleSpan.textContent = task.title; // React's native string rendering
  container.appendChild(titleSpan);

  const descDiv = doc.createElement('div');
  descDiv.textContent = task.description;
  container.appendChild(descDiv);

  assert.equal(win.STORED_PWNED, undefined, 'Stored XSS payload executed in DOM!');
  assert.equal(titleSpan.innerHTML.includes('<script>'), false);
  assert.equal(descDiv.innerHTML.includes('onerror'), false);
});

test('Browser-Based XSS 2: Dynamic Anchor href clicking does not execute JavaScript', () => {
  const dom = new JSDOM(
    '<!DOCTYPE html><html><body><div id="links"></div></body></html>',
    { runScripts: 'dangerously' }
  );
  const win = dom.window as any;
  const doc = dom.window.document;
  const linkContainer = doc.getElementById('links')!;

  const dangerousUrls = [
    'javascript:window.HREF_PWNED = true;',
    'JAVASCRIPT:window.HREF_PWNED = true;',
    'javascript:/*comment*/window.HREF_PWNED = true;',
    'data:text/html,<script>window.HREF_PWNED = true;</script>',
  ];

  dangerousUrls.forEach((url) => {
    const a = doc.createElement('a');
    a.href = sanitizeUrl(url);
    a.textContent = 'View Voucher';
    linkContainer.appendChild(a);

    // Simulate user click
    a.click();

    assert.equal(win.HREF_PWNED, undefined, `URL payload executed upon click: ${url}`);
    assert.equal(a.getAttribute('href'), '#', `Anchor href must be inert '#', got: ${a.getAttribute('href')}`);
  });
});

test('Browser-Based XSS 3: Reflected search input in DOM does not execute scripts', () => {
  const dom = new JSDOM(
    '<!DOCTYPE html><html><body><div id="search-results"></div></body></html>',
    { runScripts: 'dangerously' }
  );
  const win = dom.window as any;
  const doc = dom.window.document;
  const container = doc.getElementById('search-results')!;

  const searchInput = '<svg onload="window.REFLECTED_PWNED = true;">';
  const sanitizedSearch = sanitizeSearchQuery(searchInput);

  // Render search badge / indicator in DOM
  const badge = doc.createElement('div');
  badge.textContent = `Showing results for: ${sanitizedSearch}`;
  container.appendChild(badge);

  assert.equal(win.REFLECTED_PWNED, undefined, 'Reflected search query executed in DOM!');
  assert.equal(container.innerHTML.includes('<svg'), false);
  assert.equal(container.innerHTML.includes('&lt;svg'), true);
});

test('Browser-Based XSS 4: SVG Data URI is blocked from Image element src', () => {
  const dom = new JSDOM(
    '<!DOCTYPE html><html><body><div id="photos"></div></body></html>',
    { runScripts: 'dangerously' }
  );
  const doc = dom.window.document;
  const container = doc.getElementById('photos')!;

  const maliciousSvgUri = 'data:image/svg+xml;utf8,<svg onload="window.SVG_IMG_PWNED = true;"></svg>';
  const safeImgSrc = sanitizeImageUrl(maliciousSvgUri);

  const img = doc.createElement('img');
  img.src = safeImgSrc;
  container.appendChild(img);

  assert.equal(safeImgSrc, '', 'SVG data URI must resolve to empty string');
  assert.equal(img.getAttribute('src'), '');
});

test('Browser-Based XSS 5: CSV formula injection neutralized for spreadsheet software', () => {
  const dangerousCells = [
    '=cmd|\'/C calc\'!A0',
    '@SUM(1+1)*cmd|\'/C calc\'!A0',
    '+12345678',
    '-98765432',
    '\t=1+1',
  ];

  const row = formatCsvRow(dangerousCells);

  // Each formula cell must be quoted with a leading apostrophe
  assert.equal(row.includes("''=cmd"), false); // no double quoting of apostrophe
  assert.equal(row.includes("'=cmd"), true);
  assert.equal(row.includes("'@SUM"), true);
  assert.equal(row.includes("'+12345678"), true);
  assert.equal(row.includes("'-98765432"), true);
});
