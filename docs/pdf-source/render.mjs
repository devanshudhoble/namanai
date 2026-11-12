// Renders case_study.html to PDF with page numbers.  Usage: node docs/pdf-source/render.mjs
import { chromium } from 'playwright';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = pathToFileURL(path.join(here, 'case_study.html')).href;
const out = path.join(here, '..', 'Paytm_Travel_Voice_Agent_Case_Study.pdf');

const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage();
await page.goto(src, { waitUntil: 'load' });
await page.pdf({
  path: out,
  format: 'A4',
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: '<div></div>',
  footerTemplate:
    '<div style="width:100%;font-size:7.5pt;color:#8a93a0;padding:0 17mm;display:flex;justify-content:space-between;font-family:Segoe UI,Arial">' +
    '<span>Voice-first booking for Paytm Travel · Devanshu Dhoble</span><span class="pageNumber"></span></div>',
  margin: { top: '16mm', bottom: '16mm', left: '0', right: '0' },
});
await browser.close();
console.log(out);
