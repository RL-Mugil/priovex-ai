import type { PatentReport } from '@priovex/types';
import { generateHTMLReport } from './html';

export async function generatePDFReport(report: PatentReport): Promise<Buffer> {
  // Dynamic import to avoid loading puppeteer in environments that don't need it
  const puppeteer = await import('puppeteer');

  const browser = await puppeteer.default.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
    ],
  });

  try {
    const page = await browser.newPage();
    const html = generateHTMLReport(report);

    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.emulateMediaType('print');

    const pdf = await page.pdf({
      format: 'A4',
      margin: { top: '25mm', right: '20mm', bottom: '25mm', left: '20mm' },
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: `<div style="font-size:8px; font-family:Arial; color:#9ca3af; width:100%; text-align:center; padding:5px;">
        PrioVex.AI — Confidential Prior Art Search Report
      </div>`,
      footerTemplate: `<div style="font-size:8px; font-family:Arial; color:#9ca3af; width:100%; text-align:center; padding:5px;">
        Page <span class="pageNumber"></span> of <span class="totalPages"></span>
      </div>`,
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
