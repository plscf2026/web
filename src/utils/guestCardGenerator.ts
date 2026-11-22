/**
 * Police Lines School and College, Faridpur - Grand Reunion 2027
 * Professional Guest Card Generator, Rendering & Batch Packaging Engine
 * Implements Official Vector SVG Template: "Guest_Card.svg"
 */

import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import { GuestCard, GuestBatch } from '../types/guest';
import { renderGuestCardSvg } from './guestCardTemplate';
import { generateStudentQrCodeDataUrl } from './studentQrCode';

// Dimensions in millimeters for standard CR80 / 60mm x 90mm Guest Badge
export const GUEST_CARD_DIMENSIONS = {
  widthMm: 60,
  heightMm: 90,
  a4WidthMm: 210,
  a4HeightMm: 297,
};

/**
 * Generate full SVG string for a given guest card with its secure QR code embedded
 */
export async function generateGuestCardSvg(card: GuestCard): Promise<string> {
  // Use card's secure unguessable token or QR payload
  const qrTarget = card.qrPayload || JSON.stringify({
    type: 'GUEST',
    id: card.id,
    regNumber: card.regNumber,
    token: card.token,
    category: card.category,
  });

  const qrDataUrl = await generateStudentQrCodeDataUrl(qrTarget);
  return renderGuestCardSvg(card, qrDataUrl);
}

/**
 * Convert an SVG string to high-resolution PNG data URL and Blob using offscreen Canvas
 */
export async function convertSvgToPng(
  svgString: string,
  width = 900,
  height = 1350
): Promise<{ blob: Blob; dataUrl: string }> {
  // Check if browser environment
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    // Node environment fallback
    const dummyBlob = new Blob([svgString], { type: 'image/svg+xml' });
    return { blob: dummyBlob, dataUrl: `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}` };
  }

  return new Promise((resolve, reject) => {
    try {
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
            reject(new Error('Canvas 2D context not available'));
            return;
          }

          // Anti-aliased high-quality drawing
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          URL.revokeObjectURL(url);
          const dataUrl = canvas.toDataURL('image/png', 1.0);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve({ blob, dataUrl });
              } else {
                reject(new Error('Failed to generate PNG blob from canvas'));
              }
            },
            'image/png',
            1.0
          );
        } catch (canvasErr) {
          URL.revokeObjectURL(url);
          reject(canvasErr);
        }
      };

      img.onerror = (e) => {
        URL.revokeObjectURL(url);
        reject(new Error(`Failed to load SVG into Image: ${e}`));
      };

      img.src = url;
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Generate high-resolution PNG for an individual Guest Card
 */
export async function generateGuestCardPng(
  card: GuestCard
): Promise<{ blob: Blob; dataUrl: string }> {
  const svg = await generateGuestCardSvg(card);
  return convertSvgToPng(svg, 900, 1350);
}

/**
 * Generate a single-card printable PDF (60mm x 90mm portrait)
 */
export async function generateIndividualGuestCardPdf(
  card: GuestCard
): Promise<{ doc: jsPDF; pdfBlob: Blob }> {
  const { dataUrl } = await generateGuestCardPng(card);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [GUEST_CARD_DIMENSIONS.widthMm, GUEST_CARD_DIMENSIONS.heightMm],
  });

  doc.addImage(
    dataUrl,
    'PNG',
    0,
    0,
    GUEST_CARD_DIMENSIONS.widthMm,
    GUEST_CARD_DIMENSIONS.heightMm,
    undefined,
    'FAST'
  );

  const pdfBlob = doc.output('blob');
  return { doc, pdfBlob };
}

/**
 * Generate gang-run printable A4 PDF for a batch of Guest Cards
 * 6 cards per A4 page (2 columns x 3 rows) with cutting guidelines and header
 */
export async function generateGuestBatchA4Pdf(
  cards: GuestCard[],
  batchTitle: string = 'Guest Passes Batch'
): Promise<{ doc: jsPDF; pdfBlob: Blob }> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const cardW = 60;
  const cardH = 90;
  const marginX = 25; // 25mm left/right -> 25 + 60 + 40 + 60 = 185mm (out of 210mm)
  const gapX = 40;
  const startY = 22;
  const gapY = 94; // row step: 90mm card + 4mm gap

  const cardsPerPage = 6;
  const totalPages = Math.ceil(cards.length / cardsPerPage) || 1;

  for (let p = 0; p < totalPages; p++) {
    if (p > 0) doc.addPage();

    // Page Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42); // Navy
    doc.text(
      `Police Lines School & College, Faridpur — Grand Reunion 2027 | ${batchTitle}`,
      105,
      12,
      { align: 'center' }
    );

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Page ${p + 1} of ${totalPages} — Total Cards: ${cards.length} | Official Guest Badge (Print & Cut along crop marks)`,
      105,
      17,
      { align: 'center' }
    );

    const slice = cards.slice(p * cardsPerPage, (p + 1) * cardsPerPage);

    for (let i = 0; i < slice.length; i++) {
      const card = slice[i];
      const col = i % 2;
      const row = Math.floor(i / 2);

      const x = marginX + col * (cardW + gapX);
      const y = startY + row * gapY;

      // Draw Cutting / Crop Guides (corners)
      doc.setDrawColor(203, 213, 225); // Slate 300
      doc.setLineWidth(0.2);
      // Top-left crop
      doc.line(x - 2, y, x + 2, y);
      doc.line(x, y - 2, x, y + 2);
      // Top-right crop
      doc.line(x + cardW - 2, y, x + cardW + 2, y);
      doc.line(x + cardW, y - 2, x + cardW, y + 2);
      // Bottom-left crop
      doc.line(x - 2, y + cardH, x + 2, y + cardH);
      doc.line(x, y + cardH - 2, x, y + cardH + 2);
      // Bottom-right crop
      doc.line(x + cardW - 2, y + cardH, x + cardW + 2, y + cardH);
      doc.line(x + cardW, y + cardH - 2, x + cardW, y + cardH + 2);

      // Render card image
      try {
        const { dataUrl } = await generateGuestCardPng(card);
        doc.addImage(dataUrl, 'PNG', x, y, cardW, cardH, undefined, 'FAST');
      } catch (err) {
        console.warn(`[GuestCardGenerator] Error rendering card ${card.id}:`, err);
        // Fallback placeholder rectangle
        doc.setFillColor(248, 250, 252);
        doc.rect(x, y, cardW, cardH, 'F');
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(8);
        doc.text(`Card: ${card.id}`, x + 5, y + 20);
        doc.text(`Token: ${card.token}`, x + 5, y + 30);
      }
    }
  }

  const pdfBlob = doc.output('blob');
  return { doc, pdfBlob };
}

/**
 * Generate full downloadable ZIP package for a batch:
 * Contains:
 * - /Individual_Cards/*.png (All cards as crisp individual PNGs)
 * - /Combined_Printable_A4_Batch.pdf (Ready-to-print multi-card A4 sheet)
 * - /Batch_Manifest.txt (Audit summary and token ledger)
 */
export async function generateGuestBatchZip(
  batch: GuestBatch,
  cards: GuestCard[],
  onProgress?: (current: number, total: number, percent: number) => void
): Promise<Blob> {
  const zip = new JSZip();
  const folderName = `Guest_Cards_${batch.id}`;
  const individualFolder = zip.folder(`${folderName}/Individual_Cards`)!;

  const totalSteps = cards.length + 1; // individual cards + combined PDF

  // 1. Generate individual PNG for each card
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    try {
      const { blob: pngBlob } = await generateGuestCardPng(card);
      const filename = `${card.id}_${card.regNumber}.png`;
      individualFolder.file(filename, pngBlob);
    } catch (e) {
      console.warn(`[GuestBatchZip] Error packaging PNG for ${card.id}:`, e);
    }

    if (onProgress) {
      const pct = Math.round(((i + 1) / totalSteps) * 100);
      onProgress(i + 1, totalSteps, pct);
    }
  }

  // 2. Generate Combined Batch A4 PDF
  try {
    const { pdfBlob: a4Blob } = await generateGuestBatchA4Pdf(
      cards,
      `${batch.batchName} (${batch.category})`
    );
    zip.file(`${folderName}/Combined_Printable_A4_${batch.id}.pdf`, a4Blob);
  } catch (e) {
    console.warn('[GuestBatchZip] Error packaging combined PDF:', e);
  }

  // 3. Generate Manifest text file
  const manifestContent = [
    'POLICE LINES SCHOOL & COLLEGE, FARIDPUR — GRAND REUNION 2027',
    'OFFICIAL GUEST CARD BATCH AUDIT MANIFEST',
    '========================================================================',
    `Batch ID:       ${batch.id}`,
    `Batch Name:     ${batch.batchName}`,
    `Batch Number:   #${batch.batchNumber}`,
    `Category:       ${batch.category}`,
    `Total Cards:    ${batch.totalCards}`,
    `Created By:     ${batch.createdBy}`,
    `Created Date:   ${batch.createdAt}`,
    '========================================================================',
    'CARD DIRECTORY & TOKEN AUDIT TABLE:',
    '------------------------------------------------------------------------',
    'Guest ID     | Registration Number    | Secure Token       | Status',
    '------------------------------------------------------------------------',
    ...cards.map(
      (c) =>
        `${c.id.padEnd(12)} | ${c.regNumber.padEnd(22)} | ${c.token.padEnd(18)} | ${c.status}`
    ),
    '========================================================================',
    'SECURITY NOTICE: Guest cards must be activated at the Main Gate before',
    'guests can collect Breakfast, Lunch, or Dinner.',
    'Guest cards are strictly NOT eligible for dress or clothing collection.',
  ].join('\n');

  zip.file(`${folderName}/Batch_${batch.id}_Manifest.txt`, manifestContent);

  if (onProgress) {
    onProgress(totalSteps, totalSteps, 100);
  }

  return zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}

/**
 * Trigger browser file download from Blob
 */
export function downloadBlob(blob: Blob, filename: string): void {
  if (typeof window === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * One-click helper: Download Single Card as PNG
 */
export async function downloadGuestCardPng(card: GuestCard): Promise<void> {
  const { blob } = await generateGuestCardPng(card);
  downloadBlob(blob, `GuestCard_${card.id}_${card.regNumber}.png`);
}

/**
 * One-click helper: Download Single Card as PDF
 */
export async function downloadIndividualGuestCardPdf(card: GuestCard): Promise<void> {
  const { pdfBlob } = await generateIndividualGuestCardPdf(card);
  downloadBlob(pdfBlob, `GuestCard_${card.id}_${card.regNumber}.pdf`);
}

/**
 * One-click helper: Download Combined A4 PDF
 */
export async function downloadGuestBatchPdf(
  cards: GuestCard[],
  batchName: string = 'Guest_Batch'
): Promise<void> {
  const { pdfBlob } = await generateGuestBatchA4Pdf(cards, batchName);
  const safeName = batchName.replace(/[^a-zA-Z0-9_-]/g, '_');
  downloadBlob(pdfBlob, `${safeName}_Printable_A4.pdf`);
}

/**
 * One-click helper: Download Complete Batch as ZIP
 */
export async function downloadGuestBatchZip(
  batch: GuestBatch,
  cards: GuestCard[],
  onProgress?: (cur: number, tot: number, pct: number) => void
): Promise<void> {
  const zipBlob = await generateGuestBatchZip(batch, cards, onProgress);
  downloadBlob(zipBlob, `Guest_Cards_Batch_${batch.id}.zip`);
}
