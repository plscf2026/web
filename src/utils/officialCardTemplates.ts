/**
 * Police Lines School & College, Faridpur - Grand Reunion Platform
 * Official Vector SVG Card Engine
 * 
 * Supports 3 authoritative institution designs:
 * 1. Current Student Card (Student_Card.svg) - Deep Navy & Azure Blue Theme
 * 2. Parent / Guardian Pass Card (parents_card.svg) - Emerald & Forest Green Theme
 * 3. Alumni Member Card (Alumni_Card_template.svg) - Royal Maroon & Burgundy Wine Theme
 * 
 * Features:
 * - Deterministic SVG defs namespacing (prevents gradient / clipPath collisions when multiple cards are on screen)
 * - Dynamic photo embedding into the official gold frame
 * - Scannable cryptographic QR code embedding
 * - Long name automatic font scaling
 * - 300+ DPI Canvas rasterization
 * - Standalone individual PDF generation
 * - Isolated iframe high-resolution printing
 */

import { jsPDF } from 'jspdf';
import { studentCardSvgRaw } from '../assets/cards/studentCardSvgRaw';
import { parentCardSvgRaw } from '../assets/cards/parentCardSvgRaw';
import { alumniCardSvgRaw } from '../assets/cards/alumniCardSvgRaw';
import { StudentIdCardRecord } from '../types/idcard';

export type CardType = 'student' | 'alumni' | 'parent';

export interface OfficialCardData {
  cardType?: CardType;
  name: string;
  classOrBatch?: string;
  yearOrSession?: string | number;
  mobile?: string;
  token?: string;
  registrationId?: string;
  photoUrl?: string | null;
  qrDataUrl?: string | null;
  uniqueId?: string;
  isPreview?: boolean;
}

const REFERENCED_DEF_IDS = [
  'blue',
  'book',
  'building-lettering-softness',
  'campus-edge',
  'campus-mask',
  'campus-soft-edge',
  'card-edge',
  'crest-edge',
  'crest-halo',
  'divider',
  'gold',
  'gold-edge',
  'guil-fade',
  'guil-mask',
  'guilloche',
  'header-pattern',
  'laurel',
  'laurel-fold',
  'laurel-gold',
  'laurel-leaf',
  'laurel-leaf-narrow',
  'laurel-relief',
  'laurel-stem',
  'navy',
  'paper',
  'portrait-edge',
  'portrait-paper',
  'portrait-shadow',
  'portrait-silhouette',
  'qr-divider',
  'school-name-lettering',
];

function escapeXml(unsafe?: string | number | null): string {
  if (unsafe === null || unsafe === undefined) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Determine the appropriate card type based on record fields
 */
export function resolveCardType(
  student?: Partial<StudentIdCardRecord> | null,
  isParentPass = false
): CardType {
  if (isParentPass) return 'parent';
  if (!student) return 'student';

  // Explicit category check
  if (student.category === 'current') return 'student';
  if (student.category === 'former') return 'alumni';

  // Batch name or passing year inference
  const batchStr = (student.batchName || student.batchYear || '').toLowerCase();
  if (batchStr.includes('class') || batchStr.includes('student') || batchStr.includes('শ্রেণী')) {
    return 'student';
  }

  return 'alumni';
}

/**
 * Build a sanitized, namespaced SVG string for the specified card
 */
export function buildOfficialCardSvg(data: OfficialCardData): string {
  const cardType: CardType = data.cardType || 'student';

  // 1. Select the base SVG template
  let svg =
    cardType === 'parent'
      ? parentCardSvgRaw
      : cardType === 'alumni'
      ? alumniCardSvgRaw
      : studentCardSvgRaw;

  // 2. Namespace all internal gradient, mask, and clipPath IDs to avoid collision
  const uid = (data.uniqueId || `card_${Math.random().toString(36).substring(2, 9)}`).replace(
    /[^a-zA-Z0-9_-]/g,
    '_'
  );

  for (const rid of REFERENCED_DEF_IDS) {
    const namespacedId = `${rid}_${uid}`;
    // Replace definitions id="..."
    svg = svg.split(`id="${rid}"`).join(`id="${namespacedId}"`);
    // Replace url(#...) references
    svg = svg.split(`url(#${rid})`).join(`url(#${namespacedId})`);
    // Replace xlink:href="#..." references
    svg = svg.split(`xlink:href="#${rid}"`).join(`xlink:href="#${namespacedId}"`);
    svg = svg.split(`href="#${rid}"`).join(`href="#${namespacedId}"`);
  }

  // 3. Format and scale the attendee / parent name
  const rawName = data.name.trim() || (cardType === 'parent' ? 'PARENT NAME' : cardType === 'alumni' ? 'ALUMNI NAME' : 'STUDENT NAME');
  const safeName = escapeXml(rawName);
  const nameLen = rawName.length;
  const nameFontSize = nameLen > 28 ? 32 : nameLen > 22 ? 38 : nameLen > 16 ? 44 : 50;

  svg = svg.replace(
    /<text id="student-name"[^>]*>.*?<\/text>/,
    `<text id="student-name_${uid}" x="450" y="751" fill="${
      cardType === 'parent' ? '#07251c' : cardType === 'alumni' ? '#2b0a17' : '#091e3f'
    }" text-anchor="middle" font-family="Georgia, 'Kohinoor Bangla', 'Noto Serif Bengali', 'Noto Sans Bengali', serif" font-size="${nameFontSize}" font-weight="700">${safeName}</text>`
  );

  // 4. Class / Batch field
  const safeClass = escapeXml(data.classOrBatch || (cardType === 'parent' ? 'IX' : cardType === 'alumni' ? 'SSC' : 'X'));
  svg = svg.replace(
    /<text id="student-class"[^>]*>.*?<\/text>/,
    `<text id="student-class_${uid}" x="345" y="861" font-size="28">${safeClass}</text>`
  );

  // 5. Year / Session / Passing Year field
  const safeYear = escapeXml(data.yearOrSession || (cardType === 'alumni' ? '2018' : '2027'));
  svg = svg.replace(
    /<text id="year"[^>]*>.*?<\/text>/,
    `<text id="year_${uid}" x="345" y="905" font-size="28">${safeYear}</text>`
  );

  // 6. Mobile Number field
  const safeMobile = escapeXml(data.mobile || '01XXX XXXXXX');
  svg = svg.replace(
    /<text id="mobile-number"[^>]*>.*?<\/text>/,
    `<text id="mobile-number_${uid}" x="345" y="949" font-size="23.49">${safeMobile}</text>`
  );

  // 7. Token Number field
  const safeToken = escapeXml(
    data.token || (cardType === 'parent' ? 'P-XXXXXX' : cardType === 'alumni' ? 'ALM-MBR-0045' : 'PLSC-DEMO-0045')
  );
  svg = svg.replace(
    /<text id="token-number"[^>]*>.*?<\/text>/,
    `<text id="token-number_${uid}" x="345" y="993" font-size="19.62">${safeToken}</text>`
  );

  // 8. Registration ID field
  const safeRegId = escapeXml(
    data.registrationId || (cardType === 'parent' ? 'PAR-REG-0000' : cardType === 'alumni' ? 'ALM-DEMO-0045' : 'REG-DEMO-0045')
  );
  svg = svg.replace(
    /<text id="registration-id"[^>]*>.*?<\/text>/,
    `<text id="registration-id_${uid}" x="345" y="1037" font-size="21.27">${safeRegId}</text>`
  );

  // 9. Photo integration
  if (data.photoUrl && data.photoUrl.trim()) {
    const safePhoto = escapeXml(data.photoUrl.trim());
    const photoTag = `<image id="student-photo_${uid}" x="330" y="434" width="240" height="248" preserveAspectRatio="xMidYMid slice" clip-path="url(#portrait-edge_${uid})" xlink:href="${safePhoto}" href="${safePhoto}" />`;
    // Inject right after the silhouette group
    svg = svg.replace(
      new RegExp(`(<g clip-path="url\\(#portrait-edge_${uid}\\)"[^>]*>.*?<\\/g>)`, 's'),
      `$1\n    ${photoTag}`
    );
  }

  // 10. QR Code integration
  if (data.qrDataUrl && data.qrDataUrl.trim()) {
    const safeQr = escapeXml(data.qrDataUrl.trim());
    const qrImageTag = `<image id="qr-image_${uid}" x="8" y="8" width="154" height="154" preserveAspectRatio="xMidYMid meet" xlink:href="${safeQr}" href="${safeQr}" />`;
    // Replace the default placeholder inside qr-code
    svg = svg.replace(
      /<path id="qr-modules[^"]*"[^>]*\/>\s*<g id="qr-placeholder[^"]*"[^>]*>.*?<\/g>\s*<\/g>/s,
      `${qrImageTag}\n    </g>`
    );
  }

  return svg;
}

/**
 * Convert an SVG string into a high-resolution HTML5 Canvas
 */
export function rasterizeSvgToCanvas(
  svgString: string,
  width = 900,
  height = 1350
): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Window context is required for canvas rasterization'));
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Failed to create canvas 2D rendering context'));
      return;
    }

    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const URLObj = window.URL || window.webkitURL || window;
    const blobUrl = URLObj.createObjectURL(svgBlob);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      ctx.drawImage(img, 0, 0, width, height);
      URLObj.revokeObjectURL(blobUrl);
      resolve(canvas);
    };
    img.onerror = (e) => {
      URLObj.revokeObjectURL(blobUrl);
      reject(new Error(`Failed to load SVG into image element: ${e}`));
    };
    img.src = blobUrl;
  });
}

/**
 * Generate a standalone high-resolution individual ID Card Photo (PNG)
 */
export async function generateOfficialCardImage(
  data: OfficialCardData
): Promise<{ dataUrl: string; blob: Blob }> {
  const svgString = buildOfficialCardSvg(data);
  const canvas = await rasterizeSvgToCanvas(svgString, 900, 1350);

  const dataUrl = canvas.toDataURL('image/png');
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error('Canvas toBlob returned null'));
    }, 'image/png');
  });

  return { dataUrl, blob };
}

/**
 * Generate a standalone individual print-ready PDF (60 × 90 mm) matching physical card format
 */
export async function generateOfficialCardPdf(
  data: OfficialCardData
): Promise<{ pdfBlob: Blob; pdfDataUri: string; fileSizeBytes: number }> {
  const { dataUrl } = await generateOfficialCardImage(data);

  // Standard CR80 / 60 × 90 mm card size
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [60, 90],
    compress: true,
  });

  doc.addImage(dataUrl, 'PNG', 0, 0, 60, 90, undefined, 'FAST');

  const arrayBuffer = doc.output('arraybuffer');
  const pdfBlob = new Blob([arrayBuffer], { type: 'application/pdf' });
  const pdfDataUri = doc.output('datauristring');

  return {
    pdfBlob,
    pdfDataUri,
    fileSizeBytes: arrayBuffer.byteLength,
  };
}

/**
 * Dedicated isolated high-resolution print routine via hidden iframe
 */
export async function printOfficialCard(
  data: OfficialCardData,
  title = 'Official ID Card'
): Promise<void> {
  const { dataUrl } = await generateOfficialCardImage(data);

  let iframe = document.getElementById('official-card-print-iframe') as HTMLIFrameElement;
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = 'official-card-print-iframe';
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
        <title>${escapeXml(title)}</title>
        <style>
          @page {
            size: auto;
            margin: 0;
          }
          body {
            margin: 0;
            padding: 8mm 0;
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
            width: 60mm;
            height: 90mm;
            border-radius: 4mm;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            page-break-inside: avoid;
          }
          .card-container img {
            width: 100%;
            height: 100%;
            display: block;
            object-fit: cover;
          }
        </style>
      </head>
      <body>
        <div class="card-container">
          <img src="${dataUrl}" alt="ID Card" />
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
}
