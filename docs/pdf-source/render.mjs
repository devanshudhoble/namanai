// Renders case_study.html (fixed A4 pages, footers in the HTML) to PDF.
// Usage: node docs/pdf-source/render.mjs   (uses the installed Microsoft Edge via Playwright)
import { chromium } from 'playwright';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = pathToFileURL(path.join(here, 'case_study.html')).href;
const out = path.join(here, '..', 'Paytm_Travel_Voice_Agent_Case_Study.pdf');

const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage();
await page.goto(src, { waitUntil: 'load' });
await page.pdf({ path: out, format: 'A4', printBackground: true, preferCSSPageSize: true, margin: { top: '0', bottom: '0', left: '0', right: '0' } });
await browser.close();
console.log(out);
