/**
 * Certificate PDF (SPEC §8.6): A4 landscape, PollWise logo, learner name, course title, score, date, code
 * and the public verification link. Generated on demand, never stored.
 */
import PDFDocument from 'pdfkit';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const ASSETS = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets');
const LOGO = join(ASSETS, 'pollwise-logo@2x.png');
const FONT_BOLD = join(ASSETS, 'fonts', 'Nunito_900Black.ttf');
const FONT_BODY = join(ASSETS, 'fonts', 'Nunito_600SemiBold.ttf');
const JADE = '#1A8257';
const INK = '#13322A';
const INK_SOFT = '#4B5D55';

/**
 * @param {{ learnerName: string, courseTitle: string, score: number, issuedAt: Date, code: string }} cert
 * @param {{ verifyBase: string }} options
 * @returns {Promise<Buffer>}
 */
export function renderCertificatePdf(cert, { verifyBase }) {
  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margin: 56,
    info: { Title: `PollWise certificate ${cert.code}`, Author: 'PollWise' },
  });
  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));
  const done = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const width = doc.page.width;
  doc.image(LOGO, 56, 48, { width: 150 });
  doc
    .font(FONT_BODY)
    .fontSize(12)
    .fillColor(INK_SOFT)
    .text('Certificate of completion', 0, 60, {
      align: 'right',
      width: width - 56,
    });

  doc
    .font(FONT_BOLD)
    .fontSize(34)
    .fillColor(INK)
    .text('This certifies that', 0, 170, { align: 'center', width });
  doc.fontSize(38).fillColor(JADE).text(cert.learnerName, 0, 215, { align: 'center', width });
  doc
    .font(FONT_BODY)
    .fontSize(16)
    .fillColor(INK)
    .text('has completed', 0, 275, { align: 'center', width });
  doc
    .font(FONT_BOLD)
    .fontSize(26)
    .fillColor(INK)
    .text(cert.courseTitle, 80, 305, { align: 'center', width: width - 160 });

  const date = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Africa/Lagos',
  }).format(cert.issuedAt);
  doc
    .font(FONT_BODY)
    .fontSize(14)
    .fillColor(INK_SOFT)
    .text(`Average score ${cert.score}%   ·   Issued ${date}`, 0, 370, {
      align: 'center',
      width,
    });

  doc.fontSize(11).fillColor(INK_SOFT).text(`Certificate code ${cert.code}`, 56, 470);
  doc.text(`Verify at ${verifyBase}/verify/${cert.code}`, 56, 486, {
    link: `${verifyBase}/verify/${cert.code}`,
  });

  doc.end();
  return done;
}
