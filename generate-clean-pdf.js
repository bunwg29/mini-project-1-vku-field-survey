import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const htmlPath = path.resolve(__dirname, 'report.html');
  const pdfPath = path.resolve(__dirname, 'VKU_MiniProject1_Report_23ITB015.pdf');
  const rootPdfPath = path.resolve(__dirname, '..', 'VKU_MiniProject1_Report_23ITB015.pdf');

  console.log('Launching browser with puppeteer-core...');
  const browser = await puppeteer.launch({
    executablePath: edgePath,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu'],
  });

  const page = await browser.newPage();
  const fileUrl = 'file:///' + htmlPath.replace(/\\/g, '/');
  console.log('Loading page:', fileUrl);
  await page.goto(fileUrl, { waitUntil: 'networkidle0' });

  console.log('Exporting PDF with displayHeaderFooter: false...');
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: false, // 100% removes all URL and page number footers from the browser
    margin: {
      top: '12mm',
      bottom: '12mm',
      left: '14mm',
      right: '14mm',
    },
  });

  fs.copyFileSync(pdfPath, rootPdfPath);
  console.log('Clean PDF generated successfully at:', pdfPath);

  await browser.close();
}

main().catch(console.error);
