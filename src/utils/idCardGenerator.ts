/**
 * Police Lines School and College, Faridpur - Grand Reunion 2026 / 2027
 * Student ID Card PDF Generation & Bulk Packaging Engine
 *
 * Implements the official PowerPoint ID card design:
 * "Police Lines Student ID - Campus Signature.pptx"
 * - Exact Dimensions: 54 × 86 mm (portrait CR80 ID card format)
 * - School Crest & Visual Identity
 * - Upper Navy Curve & Metallic Gold Accents
 * - Photo Frame with Embedded Profile Image
 * - Verified Dynamic QR Code Box
 * - Campus Signature Footer Artwork
 * - Gang-run A4 Batch Combined Printing Sheets (9 cards/sheet with cutting marks)
 * - Multi-Batch Hierarchical ZIP Packaging
 */

import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import QRCode from 'qrcode';
import { StudentIdCardRecord } from '../types/idcard';
import {
  SCHOOL_CREST_PNG,
  CAMPUS_FOOTER_PNG,
  ID_CARD_DIMENSIONS,
} from './idCardTemplateAssets';

/**
 * Generate a scannable, secure QR code data URI
 */
export async function generateStudentQrCodeDataUrl(
  verificationUrl: string
): Promise<string> {
  return QRCode.toDataURL(verificationUrl, {
    margin: 0,
    errorCorrectionLevel: 'M',
    width: 400,
    color: {
      dark: '#10203A',
      light: '#FFFFFF',
    },
  });
}

/**
 * Draw an individual ID Card on a jsPDF document at the given offset (default: 0, 0)
 * Uses exact millimeter coordinates derived from the PowerPoint slide.
 */
export async function drawIdCardOnPdf(
  doc: jsPDF,
  student: StudentIdCardRecord,
  offsetX: number = 0,
  offsetY: number = 0
): Promise<void> {
  const qrDataUrl = await generateStudentQrCodeDataUrl(student.verificationUrl);

  // 1. Base Card Background (Pearl & Sky Blue)
  doc.setFillColor(243, 247, 250);
  doc.rect(offsetX, offsetY, ID_CARD_DIMENSIONS.widthMm, ID_CARD_DIMENSIONS.heightMm, 'F');

  // 2. Upper Deep Navy Card Banner (y = 0 to ~39 mm)
  doc.setFillColor(15, 23, 42); // #0F172A
  doc.rect(offsetX, offsetY, 54, 38.5, 'F');

  // Top-Right Deep Cyan Corner Accent
  doc.setFillColor(16, 77, 119); // #104D77
  doc.triangle(
    offsetX + 38.0, offsetY + 0,
    offsetX + 54.0, offsetY + 0,
    offsetX + 54.0, offsetY + 12.0,
    'F'
  );

  // Metallic Gold Contour Divider Line under Upper Navy
  doc.setDrawColor(245, 190, 53); // Metallic Gold #F5BE35
  doc.setLineWidth(0.6);
  doc.line(offsetX + 0, offsetY + 39.0, offsetX + 54.0, offsetY + 39.0);

  // 3. Header Text & Institution Branding
  // Short gold rule above title
  doc.setFillColor(241, 202, 126); // #F1CA7E
  doc.rect(offsetX + 3.5, offsetY + 3.1, 2.9, 0.3, 'F');

  // "STUDENT IDENTITY CARD"
  doc.setTextColor(142, 217, 245); // Sky Blue #8ED9F5
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(4.5);
  doc.text('STUDENT IDENTITY CARD', offsetX + 3.5, offsetY + 5.5);

  // "Police Lines"
  doc.setTextColor(255, 252, 245); // Off-White #FFFCF5
  doc.setFontSize(10.5);
  doc.text('Police Lines', offsetX + 3.3, offsetY + 9.8);

  // "School & College"
  doc.setFontSize(8.5);
  doc.text('School & College', offsetX + 3.3, offsetY + 13.5);

  // "FARIDPUR"
  doc.setTextColor(244, 203, 124); // #F4CB7C
  doc.setFontSize(4.5);
  doc.text('FARIDPUR', offsetX + 3.5, offsetY + 16.5);

  // School Crest Logo (top-right)
  try {
    doc.addImage(
      SCHOOL_CREST_PNG,
      'PNG',
      offsetX + 36.2,
      offsetY + 4.8,
      15.0,
      7.75
    );
  } catch (err) {
    console.warn('[IdCard] School crest rendering fallback:', err);
  }

  // 4. Student Photo Frame & Image
  // Outer Gold Frame
  doc.setDrawColor(243, 212, 144); // Gold #F3D490
  doc.setLineWidth(0.4);
  doc.roundedRect(offsetX + 3.5, offsetY + 19.5, 16.5, 19.0, 1.5, 1.5, 'S');

  // Photo Inset Background
  doc.setFillColor(228, 237, 242);
  doc.roundedRect(offsetX + 3.9, offsetY + 19.9, 15.7, 18.2, 1.2, 1.2, 'F');

  // Draw Student Photo if available, otherwise draw silhouette
  if (student.photoUrl && student.photoUrl.startsWith('data:image')) {
    try {
      doc.addImage(
        student.photoUrl,
        'JPEG',
        offsetX + 4.0,
        offsetY + 20.0,
        15.5,
        18.0
      );
    } catch {
      drawSilhouetteAvatar(doc, offsetX + 3.9, offsetY + 19.9);
    }
  } else {
    drawSilhouetteAvatar(doc, offsetX + 3.9, offsetY + 19.9);
  }

  // 5. Student Name & Role Badge Beside Photo
  // Gold rule beside name
  doc.setFillColor(235, 196, 116);
  doc.rect(offsetX + 21.9, offsetY + 25.5, 4.2, 0.3, 'F');

  // Student Full Name
  doc.setTextColor(255, 252, 245);
  doc.setFont('helvetica', 'bold');
  const name = student.studentName.trim();
  const fontSize = name.length > 22 ? 6.5 : name.length > 16 ? 7.5 : 8.5;
  doc.setFontSize(fontSize);
  doc.text(name, offsetX + 21.9, offsetY + 30.5);

  // Category Tag ("ALUMNI MEMBER" or "CURRENT STUDENT")
  doc.setTextColor(142, 217, 245);
  doc.setFontSize(4.8);
  doc.setFont('helvetica', 'normal');
  const isCurrent = student.batchName.toLowerCase().includes('class');
  const categoryLabel = isCurrent ? 'CURRENT STUDENT' : 'ALUMNI MEMBER';
  doc.text(categoryLabel, offsetX + 21.9, offsetY + 34.0);

  // 6. Middle Information Block (Batch, ID Number, Contact)
  // Field 1: Batch
  doc.setTextColor(16, 32, 58); // #10203A
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.0);
  doc.text('Batch:', offsetX + 3.6, offsetY + 44.5);

  doc.setTextColor(30, 58, 138); // Deep Blue #1E3A8A
  doc.text(student.batchYear || student.batchName, offsetX + 11.5, offsetY + 44.5);

  doc.setDrawColor(158, 184, 203);
  doc.setLineWidth(0.15);
  doc.line(offsetX + 3.6, offsetY + 46.2, offsetX + 29.5, offsetY + 46.2);

  // Field 2: ID Number
  doc.setTextColor(16, 32, 58);
  doc.setFont('helvetica', 'bold');
  doc.text('ID Number:', offsetX + 3.6, offsetY + 50.5);

  doc.setTextColor(30, 58, 138);
  doc.text(student.idNumber, offsetX + 15.5, offsetY + 50.5);

  doc.setDrawColor(158, 184, 203);
  doc.line(offsetX + 3.6, offsetY + 52.2, offsetX + 29.5, offsetY + 52.2);

  // Field 3: Contact Number
  doc.setTextColor(16, 32, 58);
  doc.setFont('helvetica', 'bold');
  doc.text('Contact:', offsetX + 3.6, offsetY + 56.5);

  doc.setTextColor(30, 58, 138);
  doc.text(student.contactNumber, offsetX + 13.5, offsetY + 56.5);

  doc.setDrawColor(158, 184, 203);
  doc.line(offsetX + 3.6, offsetY + 58.2, offsetX + 29.5, offsetY + 58.2);

  // Field 4: 6-Character QR Token
  if (student.qrToken) {
    doc.setTextColor(180, 83, 9); // Amber 700
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(4.8);
    doc.text(`TOKEN: ${student.qrToken}`, offsetX + 3.6, offsetY + 62.0);
  }

  // 7. QR Code Box
  // Gold Outer Frame
  doc.setDrawColor(217, 177, 94); // #D9B15E
  doc.setLineWidth(0.4);
  doc.roundedRect(offsetX + 30.9, offsetY + 41.5, 19.8, 19.8, 1.2, 1.2, 'S');

  // White Inset
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(offsetX + 31.3, offsetY + 41.9, 19.0, 19.0, 0.9, 0.9, 'F');

  // Corner Accents
  doc.setDrawColor(118, 164, 190); // #76A4BE
  doc.setLineWidth(0.2);
  // Top-Left
  doc.line(offsetX + 32.3, offsetY + 44.0, offsetX + 32.3, offsetY + 43.2);
  doc.line(offsetX + 32.3, offsetY + 43.2, offsetX + 33.1, offsetY + 43.2);
  // Top-Right
  doc.line(offsetX + 48.5, offsetY + 43.2, offsetX + 49.3, offsetY + 43.2);
  doc.line(offsetX + 49.3, offsetY + 43.2, offsetX + 49.3, offsetY + 44.0);
  // Bottom-Left
  doc.line(offsetX + 32.3, offsetY + 59.6, offsetX + 32.3, offsetY + 60.4);
  doc.line(offsetX + 32.3, offsetY + 60.4, offsetX + 33.1, offsetY + 60.4);
  // Bottom-Right
  doc.line(offsetX + 48.5, offsetY + 60.4, offsetX + 49.3, offsetY + 60.4);
  doc.line(offsetX + 49.3, offsetY + 60.4, offsetX + 49.3, offsetY + 59.6);

  // Embed Scannable QR Code
  try {
    doc.addImage(
      qrDataUrl,
      'PNG',
      offsetX + 32.3,
      offsetY + 42.9,
      17.0,
      17.0
    );
  } catch (err) {
    console.warn('[IdCard] QR code embedding notice:', err);
  }

  // 8. Campus Signature Footer Artwork
  try {
    doc.addImage(
      CAMPUS_FOOTER_PNG,
      'PNG',
      offsetX + 0,
      offsetY + 64.2,
      54.0,
      21.8
    );
  } catch (err) {
    console.warn('[IdCard] Campus footer image notice:', err);
  }

  // Gold line above footer
  doc.setDrawColor(245, 190, 53);
  doc.setLineWidth(0.4);
  doc.line(offsetX + 0, offsetY + 64.2, offsetX + 54.0, offsetY + 63.8);

  // Bottom-right Navy Corner Overlay
  doc.setFillColor(6, 25, 49); // #061931
  doc.triangle(
    offsetX + 45.0, offsetY + 86.0,
    offsetX + 54.0, offsetY + 81.5,
    offsetX + 54.0, offsetY + 86.0,
    'F'
  );

  // Fine Gold Line in Corner
  doc.setDrawColor(245, 190, 53);
  doc.setLineWidth(0.25);
  doc.line(offsetX + 44.4, offsetY + 86.0, offsetX + 54.0, offsetY + 81.2);
}

/**
 * Draw a clean vector silhouette avatar for cards without photo
 */
function drawSilhouetteAvatar(doc: jsPDF, x: number, y: number): void {
  doc.setFillColor(158, 185, 204); // #9EB9CC
  // Head
  doc.circle(x + 7.8, y + 6.0, 2.8, 'F');
  // Body arc/triangle
  doc.triangle(
    x + 2.5, y + 15.0,
    x + 7.8, y + 9.5,
    x + 13.1, y + 15.0,
    'F'
  );
}

/**
 * Generate a standalone individual Student ID Card PDF (54 × 86 mm)
 */
export async function generateIndividualIdCardPdf(
  student: StudentIdCardRecord
): Promise<{ pdfBlob: Blob; pdfDataUri: string; fileSizeBytes: number }> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [ID_CARD_DIMENSIONS.widthMm, ID_CARD_DIMENSIONS.heightMm],
    compress: true,
  });

  await drawIdCardOnPdf(doc, student, 0, 0);

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
 * Generate a Batch-wise Combined Print-Ready PDF
 * Gang-run printing layout: 9 cards per A4 sheet (3 columns × 3 rows)
 * Page size: 210 × 297 mm with cutting marks and batch title
 */
export async function generateBatchCombinedA4Pdf(
  students: StudentIdCardRecord[],
  batchYear: string
): Promise<{ pdfBlob: Blob; fileSizeBytes: number; totalPages: number }> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const cardsPerPage = 9;
  const totalPages = Math.ceil(students.length / cardsPerPage) || 1;

  // A4 geometry: 210 x 297 mm
  // 3 cols of 54 mm = 162 mm -> (210 - 162)/2 = 24 mm left/right margin
  // 3 rows of 86 mm = 258 mm -> (297 - 258)/2 = 19.5 mm top/bottom margin
  const startX = 24.0;
  const startY = 22.0;
  const cardWidth = 54.0;
  const cardHeight = 86.0;

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    if (pageIdx > 0) {
      doc.addPage('a4', 'portrait');
    }

    // Page Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(
      `POLICE LINES SCHOOL & COLLEGE, FARIDPUR • BATCH ${batchYear} PRINT DECK`,
      startX,
      12.0
    );

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Page ${pageIdx + 1} of ${totalPages} • Standard CR80 Card Size: 54 × 86 mm`,
      startX,
      16.5
    );

    const pageStudents = students.slice(
      pageIdx * cardsPerPage,
      (pageIdx + 1) * cardsPerPage
    );

    for (let i = 0; i < pageStudents.length; i++) {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const posX = startX + col * cardWidth;
      const posY = startY + row * cardHeight;

      await drawIdCardOnPdf(doc, pageStudents[i], posX, posY);

      // Draw subtle cutting/alignment guide lines around the card
      doc.setDrawColor(203, 213, 225); // #CBD5E1
      doc.setLineWidth(0.1);
      doc.rect(posX, posY, cardWidth, cardHeight, 'S');

      // Corner crop tick marks (3 mm long)
      doc.setDrawColor(148, 163, 184); // #94A3B8
      // Top-left
      doc.line(posX - 2.5, posY, posX - 0.5, posY);
      doc.line(posX, posY - 2.5, posX, posY - 0.5);
      // Top-right
      doc.line(posX + cardWidth + 0.5, posY, posX + cardWidth + 2.5, posY);
      doc.line(posX + cardWidth, posY - 2.5, posX + cardWidth, posY - 0.5);
      // Bottom-left
      doc.line(posX - 2.5, posY + cardHeight, posX - 0.5, posY + cardHeight);
      doc.line(posX, posY + cardHeight + 0.5, posX, posY + cardHeight + 2.5);
      // Bottom-right
      doc.line(posX + cardWidth + 0.5, posY + cardHeight, posX + cardWidth + 2.5, posY + cardHeight);
      doc.line(posX + cardWidth, posY + cardHeight + 0.5, posX + cardWidth, posY + cardHeight + 2.5);
    }
  }

  const arrayBuffer = doc.output('arraybuffer');
  const pdfBlob = new Blob([arrayBuffer], { type: 'application/pdf' });

  return {
    pdfBlob,
    fileSizeBytes: arrayBuffer.byteLength,
    totalPages,
  };
}

/**
 * Generate a Year-Wise ZIP Archive:
 * STUDENT_ID_CARDS/
 *   Batch_<year>/
 *     Individual_Cards/
 *       Student_<id>.pdf
 *     Batch_<year>_All_Cards.pdf
 */
export async function generateBatchZipArchive(
  batchYear: string,
  students: StudentIdCardRecord[],
  onProgress?: (processed: number, total: number, percentage: number) => void
): Promise<Blob> {
  const zip = new JSZip();
  const folderName = `Batch_${batchYear}`;
  const individualFolder = zip.folder(`${folderName}/Individual_Cards`)!;

  // 1. Generate all individual cards
  for (let i = 0; i < students.length; i++) {
    const student = students[i];
    const { pdfBlob } = await generateIndividualIdCardPdf(student);
    const safeFilename = `Student_${student.idNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
    individualFolder.file(safeFilename, pdfBlob);

    if (onProgress) {
      const percent = Math.round(((i + 1) / (students.length + 1)) * 100);
      onProgress(i + 1, students.length, percent);
    }
  }

  // 2. Generate Combined Batch A4 PDF
  const { pdfBlob: combinedBlob } = await generateBatchCombinedA4Pdf(
    students,
    batchYear
  );
  zip.file(`${folderName}/Batch_${batchYear}_All_Cards.pdf`, combinedBlob);

  if (onProgress) {
    onProgress(students.length, students.length, 100);
  }

  return zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}

/**
 * Generate One-Click Complete Bulk ZIP of ALL Year-Wise Folders:
 * Police_Lines_All_Student_ID_Cards.zip
 * Inside:
 *   Batch_1962/
 *   Batch_1963/
 *   ...
 *   Batch_2026/
 */
export async function generateAllBatchesBulkZip(
  studentsByBatch: Record<string, StudentIdCardRecord[]>,
  onProgress?: (processedBatches: number, totalBatches: number, percent: number) => void
): Promise<Blob> {
  const masterZip = new JSZip();
  const batchYears = Object.keys(studentsByBatch).sort();
  const totalBatches = batchYears.length;

  for (let b = 0; b < totalBatches; b++) {
    const batchYear = batchYears[b];
    const batchStudents = studentsByBatch[batchYear];
    const folderName = `Batch_${batchYear}`;
    const individualFolder = masterZip.folder(`${folderName}/Individual_Cards`)!;

    // Add individual PDFs
    for (const student of batchStudents) {
      const { pdfBlob } = await generateIndividualIdCardPdf(student);
      const safeFilename = `Student_${student.idNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
      individualFolder.file(safeFilename, pdfBlob);
    }

    // Add combined A4 PDF
    const { pdfBlob: combinedBlob } = await generateBatchCombinedA4Pdf(
      batchStudents,
      batchYear
    );
    masterZip.file(`${folderName}/Batch_${batchYear}_All_Cards.pdf`, combinedBlob);

    if (onProgress) {
      const percent = Math.round(((b + 1) / totalBatches) * 100);
      onProgress(b + 1, totalBatches, percent);
    }
  }

  return masterZip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}

