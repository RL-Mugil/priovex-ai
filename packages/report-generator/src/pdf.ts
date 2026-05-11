import type { PatentReport } from '@priovex/types';
import { generateHTMLReport } from './html';

const PDF_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--no-first-run',
];

const HEADER = `<div style="font-size:8px;font-family:Arial;color:#9ca3af;width:100%;text-align:center;padding:5px;">
  PrioVex.AI — Confidential Prior Art Search Report
</div>`;

const FOOTER = `<div style="font-size:8px;font-family:Arial;color:#9ca3af;width:100%;text-align:center;padding:5px;">
  Page <span class="pageNumber"></span> of <span class="totalPages"></span>
</div>`;

async function htmlToPDF(html: string): Promise<Buffer> {
  const puppeteer = await import('puppeteer');
  // In Alpine Docker (Railway), use the system Chromium installed via apk.
  // Locally, fall back to the Puppeteer-managed binary.
  const executablePath =
    process.env.PUPPETEER_EXECUTABLE_PATH ??
    (process.env.RAILWAY_ENVIRONMENT ? '/usr/bin/chromium-browser' : undefined);
  const browser = await puppeteer.default.launch({
    headless: true,
    args: PDF_ARGS,
    ...(executablePath ? { executablePath } : {}),
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.emulateMediaType('print');
    const pdf = await page.pdf({
      format: 'A4',
      margin: { top: '25mm', right: '20mm', bottom: '25mm', left: '20mm' },
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: HEADER,
      footerTemplate: FOOTER,
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

/** Generate PDF from a full PatentReport object (used during pipeline). */
export async function generatePDFReport(report: PatentReport): Promise<Buffer> {
  return htmlToPDF(generateHTMLReport(report));
}

/** Generate PDF from raw HTML string (used for on-demand download of existing reports). */
export async function generatePDFFromHTML(html: string): Promise<Buffer> {
  return htmlToPDF(html);
}
