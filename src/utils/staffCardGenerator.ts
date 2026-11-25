/**
 * Police Lines School and College, Faridpur - Grand Reunion 2027
 * Dedicated Staff Card Generator, Rendering & Batch Packaging Engine
 * Implements Official Vector SVG Template: Staff_Card_Yellow.svg
 */

import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import { StaffCard } from '../types/staffCard';
import { renderStaffCardSvg } from './staffCardTemplate';
import { generateStudentQrCodeDataUrl } from './studentQrCode';

// Dimensions in millimeters for standard CR80 / 60mm x 90mm Staff Badge
export const STAFF_CARD_DIMENSIONS = {
  widthMm: 60,
  heightMm: 90,
  a4WidthMm: 210,
  a4HeightMm: 297,
};

/**
 * Generate full SVG string for a given staff card with its secure QR code embedded
 */
export async function generateStaffCardSvg(card: StaffCard): Promise<string> {
  const qrTarget = card.qrPayload || JSON.stringify({
    type: 'STAFF',
    id: card.id,
    regNumber: card.regNumber,
    token: card.token,
    category: card.category,
    name: card.staffName,
    meals: card.mealFacilities,
  });

  const qrDataUrl = await generateStudentQrCodeDataUrl(qrTarget);
  return renderStaffCardSvg(card, qrDataUrl);
}

/**
 * Convert an SVG string to high-resolution PNG data URL and Blob using offscreen Canvas
 */
export async function convertSvgToPng(
  svgString: string,
  width = 900,
  height = 1350
): Promise<{ blob: Blob; dataUrl: string }> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
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

          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          URL.revokeObjectURL(url);
          canvas.toBlob(
            (blob) => {
              if (blob) {
                const dataUrl = canvas.toDataURL('image/png');
                resolve({ blob, dataUrl });
              } else {
                reject(new Error('Failed to convert canvas to blob'));
              }
            },
            'image/png',
            1.0
          );
        } catch (err) {
          URL.revokeObjectURL(url);
          reject(err);
        }
      };

      img.onerror = (e) => {
        URL.revokeObjectURL(url);
        reject(new Error(`Failed to load SVG into image: ${e}`));
      };

      img.src = url;
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Generate high-resolution PNG for an individual Staff Card
 */
export async function generateStaffCardPng(
  card: StaffCard
): Promise<{ blob: Blob; dataUrl: string }> {
  const svg = await generateStaffCardSvg(card);
  return convertSvgToPng(svg, 900, 1350);
}

/**
 * Generate a single-card printable PDF (60mm x 90mm portrait)
 */
export async function generateIndividualStaffCardPdf(
  card: StaffCard
): Promise<{ doc: jsPDF; pdfBlob: Blob }> {
  const { dataUrl } = await generateStaffCardPng(card);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [STAFF_CARD_DIMENSIONS.widthMm, STAFF_CARD_DIMENSIONS.heightMm],
  });

  doc.addImage(
    dataUrl,
    'PNG',
    0,
    0,
    STAFF_CARD_DIMENSIONS.widthMm,
    STAFF_CARD_DIMENSIONS.heightMm,
    undefined,
    'FAST'
  );

  const pdfBlob = doc.output('blob');
  return { doc, pdfBlob };
}

/**
 * Generate gang-run printable A4 PDF for a batch of Staff Cards
 * 6 cards per A4 page (2 columns x 3 rows) with cutting guidelines and header
 */
export async function generateStaffBatchA4Pdf(
  cards: StaffCard[],
  batchTitle: string = 'Staff Cards Batch'
): Promise<{ doc: jsPDF; pdfBlob: Blob }> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const cardW = 60;
  const cardH = 90;
  const marginX = 25;
  const gapX = 40;
  const startY = 22;
  const gapY = 94;

  const cardsPerPage = 6;
  const totalPages = Math.ceil(cards.length / cardsPerPage) || 1;

  for (let p = 0; p < totalPages; p++) {
    if (p > 0) doc.addPage();

    // Page Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(
      `Police Lines School & College, Faridpur — Grand Reunion 2027 | ${batchTitle}`,
      105,
      12,
      { align: 'center' }
    );

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Sheet ${p + 1} of ${totalPages} — Staff ID Badges (60mm x 90mm)`, 105, 17, { align: 'center' });

    const pageCards = cards.slice(p * cardsPerPage, (p + 1) * cardsPerPage);

    for (let i = 0; i < pageCards.length; i++) {
      const card = pageCards[i];
      const col = i % 2;
      const row = Math.floor(i / 2);

      const x = marginX + col * (cardW + gapX);
      const y = startY + row * gapY;

      // Draw dashed cutting guidelines
      doc.setDrawColor(203, 213, 225);
      doc.setLineDashPattern([2, 2], 0);
      doc.rect(x - 1, y - 1, cardW + 2, cardH + 2);
      doc.setLineDashPattern([], 0);

      // Render high-res PNG image
      const { dataUrl } = await generateStaffCardPng(card);
      doc.addImage(dataUrl, 'PNG', x, y, cardW, cardH, undefined, 'FAST');
    }
  }

  const pdfBlob = doc.output('blob');
  return { doc, pdfBlob };
}

/**
 * Generate a ZIP file containing high-res PNGs and individual PDFs for a batch of cards
 */
export async function generateStaffBatchZip(
  cards: StaffCard[],
  batchTitle: string = 'Staff_Cards_Batch',
  onProgress?: (current: number, total: number) => void
): Promise<Blob> {
  const zip = new JSZip();
  const folder = zip.folder(batchTitle.replace(/[^a-zA-Z0-9_-]/g, '_')) || zip;

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const { blob: pngBlob } = await generateStaffCardPng(card);
    const fileName = `${card.id}_${card.staffName ? card.staffName.replace(/\s+/g, '_') : 'Staff'}.png`;
    folder.file(fileName, pngBlob);

    if (onProgress) {
      onProgress(i + 1, cards.length);
    }
  }

  return zip.generateAsync({ type: 'blob' });
}

/**
 * Trigger client browser download for an individual SVG
 */
export async function downloadStaffCardSvg(card: StaffCard): Promise<void> {
  const svg = await generateStaffCardSvg(card);
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${card.id}_Staff_Card.svg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Trigger client browser download for an individual PNG
 */
export async function downloadStaffCardPng(card: StaffCard): Promise<void> {
  const { blob } = await generateStaffCardPng(card);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${card.id}_Staff_Card.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Trigger client browser download for an individual PDF
 */
export async function downloadIndividualStaffCardPdf(card: StaffCard): Promise<void> {
  const { doc } = await generateIndividualStaffCardPdf(card);
  doc.save(`${card.id}_Staff_Card.pdf`);
}

/**
 * Trigger client browser download for a batch A4 PDF
 */
export async function downloadStaffBatchPdf(
  cards: StaffCard[],
  batchTitle: string = 'Staff_Cards_Batch'
): Promise<void> {
  const { doc } = await generateStaffBatchA4Pdf(cards, batchTitle);
  doc.save(`${batchTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`);
}

/**
 * Trigger client browser download for a batch ZIP
 */
export async function downloadStaffBatchZip(
  cards: StaffCard[],
  batchTitle: string = 'Staff_Cards_Batch',
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  const blob = await generateStaffBatchZip(cards, batchTitle, onProgress);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${batchTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
