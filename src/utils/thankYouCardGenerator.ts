/**
 * Police Lines School & College, Faridpur - Grand Reunion Platform
 * Official Thank You Card Vector SVG Engine & Generator
 *
 * Generates the official commemorative Patron & Donor Thank You Card
 * based on the authoritative Thank_You_Card_Reunion.svg design.
 *
 * Features:
 * - Replaces 'XXX' with attendee / donor name with automatic font scaling
 * - Injects Registration ID, 6-Character Token ID, and Phone Number
 * - Deterministic defs namespacing to prevent gradient/clipPath collision
 * - High-resolution (300+ DPI) Canvas PNG rasterization
 * - Standalone individual PDF generation via jsPDF
 * - Direct vector SVG download
 * - Isolated iframe high-resolution printing
 */

import { jsPDF } from 'jspdf';
import { thankYouCardSvgRaw } from '../assets/cards/thankYouCardSvgRaw';

export interface ThankYouCardData {
  donorName: string;
  registrationId: string;
  token?: string;
  qrToken?: string;
  mobileNumber: string;
  amount?: number;
  purpose?: string;
  date?: string;
  uniqueId?: string;
}

const REFERENCED_DEF_IDS = [
  'gold',
  'goldText',
  'paper',
  'maroon',
  'fade',
  'arch',
  'round',
  'shadow',
  'tshadow',
  'dots',
];

function escapeXml(unsafe: string): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Builds the customized vector SVG string for the Thank You Card.
 */
export function buildThankYouCardSvg(data: ThankYouCardData): string {
  let svg = thankYouCardSvgRaw;

  // 1. Generate unique deterministic ID to namespace defs
  const uid = (data.uniqueId || `card_${Math.random().toString(36).substring(2, 9)}`).replace(
    /[^a-zA-Z0-9_-]/g,
    '_'
  );

  // 2. Namespace all internal gradients, clip paths, patterns, and filters
  for (const rid of REFERENCED_DEF_IDS) {
    const namespacedId = `${rid}_${uid}`;
    svg = svg.split(`id="${rid}"`).join(`id="${namespacedId}"`);
    svg = svg.split(`url(#${rid})`).join(`url(#${namespacedId})`);
    svg = svg.split(`xlink:href="#${rid}"`).join(`xlink:href="#${namespacedId}"`);
    svg = svg.split(`href="#${rid}"`).join(`href="#${namespacedId}"`);
  }

  // 3. Format donor name with responsive font scaling
  const rawName = data.donorName?.trim() || 'HONORED PATRON';
  const safeName = escapeXml(rawName);
  const nameLen = rawName.length;
  const nameFontSize = nameLen > 28 ? 32 : nameLen > 22 ? 38 : nameLen > 16 ? 48 : 58;

  // Replace XXX (middle of card)
  svg = svg.replace(
    /<text x="500" y="722"[^>]*>XXX<\/text>/,
    `<text x="500" y="722" text-anchor="middle" class="serif" font-size="${nameFontSize}" font-weight="bold" fill="#3b0a14" filter="url(#tshadow_${uid})">${safeName}</text>`
  );

  // 4. Details: Registration ID, Token ID, Phone Number
  const safeRegId = escapeXml(data.registrationId || 'DON-2027-0000');
  const safeToken = escapeXml(data.token || data.qrToken || 'TK-XXXXXX');
  const safeMobile = escapeXml(data.mobileNumber || '01XXXXXXXXX');

  const formattedDetails = `<g id="donor-details_${uid}">
<text x="500" y="788" text-anchor="middle"><tspan class="lab">REGISTRATION ID  </tspan><tspan class="val">${safeRegId}</tspan></text>
<text x="500" y="824" text-anchor="middle"><tspan class="lab">TOKEN ID  </tspan><tspan class="val">${safeToken}</tspan></text>
<text x="500" y="860" text-anchor="middle"><tspan class="lab">PHONE NUMBER  </tspan><tspan class="val">${safeMobile}</tspan></text>
</g>`;

  // Replace default details group
  svg = svg.replace(
    /<g>\s*<text x="500" y="800"[^>]*>.*?<\/text>\s*<text x="500" y="844"[^>]*>.*?<\/text><\/g>/s,
    formattedDetails
  );

  // Fallback direct replacement if regex missed whitespace
  if (svg.includes('XXXXxX')) {
    svg = svg.replace('XXXXxX', safeRegId);
  }
  if (svg.includes('XXXXX')) {
    svg = svg.replace('XXXXX', safeMobile);
  }

  // 5. Update Year to 2027 if present in template message
  svg = svg.replace(/Reunion 2026/g, 'Reunion 2027');

  return svg;
}

/**
 * Rasterizes the Thank You Card SVG into a high-resolution PNG data URL.
 */
export async function generateThankYouCardImage(
  data: ThankYouCardData,
  scale: number = 2
): Promise<string> {
  const svgString = buildThankYouCardSvg(data);
  const width = 1000 * scale;
  const height = 1400 * scale;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          reject(new Error('Canvas 2D context unavailable'));
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        URL.revokeObjectURL(url);
        const dataUrl = canvas.toDataURL('image/png', 1.0);
        resolve(dataUrl);
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(new Error(`Failed to load SVG into image: ${err}`));
    };

    img.src = url;
  });
}

/**
 * Generates an official downloadable PDF for the Thank You Card.
 */
export async function generateThankYouCardPdf(data: ThankYouCardData): Promise<Blob> {
  const imgDataUrl = await generateThankYouCardImage(data, 2.5);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [100, 140],
    compress: true,
  });

  doc.addImage(imgDataUrl, 'PNG', 0, 0, 100, 140, undefined, 'FAST');
  return doc.output('blob');
}

/**
 * Direct file download trigger for SVG format.
 */
export function downloadThankYouCardSvg(data: ThankYouCardData, filename?: string): void {
  const svgString = buildThankYouCardSvg(data);
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const safeName = (filename || `Thank_You_Card_${data.registrationId || 'Reunion'}`).replace(
    /[^a-zA-Z0-9_-]/g,
    '_'
  );

  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeName}.svg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Direct file download trigger for PNG format.
 */
export async function downloadThankYouCardPng(data: ThankYouCardData, filename?: string): Promise<void> {
  const dataUrl = await generateThankYouCardImage(data, 2);
  const safeName = (filename || `Thank_You_Card_${data.registrationId || 'Reunion'}`).replace(
    /[^a-zA-Z0-9_-]/g,
    '_'
  );

  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `${safeName}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Triggers high-resolution isolated iframe printing.
 */
export async function printThankYouCard(data: ThankYouCardData): Promise<void> {
  const imgDataUrl = await generateThankYouCardImage(data, 2);

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';

  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    throw new Error('Unable to access printing iframe document');
  }

  const triggerPrint = () => {
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    }, 250);
  };
  iframe.onload = triggerPrint;

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Thank You Card – Police Lines School & College Reunion</title>
        <style>
          @page {
            size: portrait;
            margin: 0;
          }
          body {
            margin: 0;
            padding: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #fff;
          }
          img {
            max-width: 100vw;
            max-height: 100vh;
            width: auto;
            height: auto;
            object-fit: contain;
          }
        </style>
      </head>
      <body>
        <img src="${imgDataUrl}" alt="Thank You Card" />
      </body>
    </html>
  `);
  doc.close();
  triggerPrint();

  setTimeout(() => {
    try {
      document.body.removeChild(iframe);
    } catch {}
  }, 10000);
}
