import QRCode from 'qrcode';

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
