// Records a captioned product walkthrough of the running app (http://localhost:8000).
import { chromium } from 'playwright';
const outDir = process.argv[2];
const W = 1280, H = 800;

const browser = await chromium.launch({ channel: 'msedge' });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: outDir, size: { width: W, height: H } } });
const page = await ctx.newPage();
await page.goto('http://localhost:8000/');
await page.evaluate(() => localStorage.clear());
await page.reload();

const setup = async () => {
  await page.evaluate(() => {
    if (window.speechSynthesis) window.speechSynthesis.speak = () => {};
    HTMLMediaElement.prototype.play = () => Promise.resolve();
    const st = document.createElement('style');
    st.textContent = `
      #cap{position:fixed;left:50%;bottom:86px;transform:translateX(-50%);z-index:9999;max-width:980px;
        background:rgba(10,37,64,.94);color:#fff;font:600 19px/1.4 Segoe UI,Arial;padding:12px 22px;border-radius:10px;
        box-shadow:0 8px 30px rgba(0,0,0,.25);transition:opacity .3s;text-align:center}
      #cap small{display:block;font-weight:400;font-size:14px;color:#a9c4e4;margin-top:3px}
      #card{position:fixed;inset:0;z-index:10000;background:#0a2540;color:#fff;display:flex;flex-direction:column;
        justify-content:center;padding:0 110px;font-family:Georgia,serif;transition:opacity .5s}
      #card .e{font:700 14px Segoe UI,Arial;letter-spacing:.16em;color:#8fc1ff;text-transform:uppercase}
      #card h1{font-size:62px;line-height:1.05;margin:16px 0}
      #card p{font:400 22px/1.5 Segoe UI,Arial;color:#c9d6e6;max-width:900px;margin:0}`;
    document.head.appendChild(st);
  });
};
await setup();

const caption = async (title, sub = '') => {
  await page.evaluate(([t, s]) => {
    let c = document.getElementById('cap');
    if (!c) { c = document.createElement('div'); c.id = 'cap'; document.body.appendChild(c); }
    c.innerHTML = t + (s ? `<small>${s}</small>` : '');
    c.style.opacity = t ? '1' : '0';
  }, [title, sub]);
};
const card = async (eyebrow, title, text, ms) => {
  await page.evaluate(([e, t, p]) => {
    let c = document.getElementById('card');
    if (!c) { c = document.createElement('div'); c.id = 'card'; document.body.appendChild(c); }
    c.innerHTML = `<div class="e">${e}</div><h1>${t}</h1><p>${p}</p>`; c.style.opacity = '1'; c.style.display = 'flex';
  }, [eyebrow, title, text]);
  await page.waitForTimeout(ms);
  await page.evaluate(() => { const c = document.getElementById('card'); c.style.opacity = '0'; });
  await page.waitForTimeout(500);
  await page.evaluate(() => { document.getElementById('card').style.display = 'none'; });
};
const input = 'input[placeholder^="Type or speak"]';
const say = async (text, waitMs = 4500) => {
  await page.locator(input).scrollIntoViewIfNeeded();
  await page.click(input);
  await page.type(input, text, { delay: 55 });
  await page.waitForTimeout(400);
  await page.press(input, 'Enter');
  // wait for the agent to finish thinking
  await page.waitForTimeout(600);
  await page.waitForFunction(() => !document.body.innerText.includes('Thinking…'), null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(waitMs);
};
const scrollTo = async (sel) => { await page.locator(sel).first().scrollIntoViewIfNeeded(); await page.waitForTimeout(700); };

// ---------------------------------------------------------------- script
await card('Product walkthrough · 2 minutes', 'Say it once.<br>Book it safely.',
  'A voice booking agent for Indian travel. The LLM only understands intent. Tools decide prices. Every spoken ₹ amount is verified before the customer hears it.', 5500);

await caption('The problem: booking is a multi-screen form', 'For Hindi-first and first-time travellers, the form itself is the drop-off');
await page.waitForTimeout(3500);

await caption('1 · One Hinglish sentence → all trip details in one turn', 'Gemini extracts origin, destination, date, travellers and mode, then search runs immediately');
await say('Mumbai se Nagpur agle Friday, 2 log, train', 5000);
await caption('Options in one turn, zero follow-up questions', 'Agent names the fastest and the cheapest. Note the header: "Understood by Gemini"');
await page.waitForTimeout(4500);

await caption('2 · Price-sensitive user: "sabse sasta wala"', 'Read-back of train, time, total and refund rule. Nothing is booked without an explicit yes');
await say('sabse sasta wala', 5500);

await caption('3 · Explicit approval, then fare hold + in-app UPI', 'The UPI PIN is entered only on the UPI screen, never spoken to the agent');
await say('haan kar do', 2500);
await say('Riya Sharma', 2000);
await scrollTo('text=Failure lab');
await page.waitForTimeout(3000);

await caption('4 · Payment patterns: bank timeout', '"No money was taken. Your fare is still held." Retry reuses the same order, so no double charge');
await page.click('button:has-text("Bank timeout")');
await page.waitForTimeout(2500);
await say('haan, dobara bhejo', 3500);
await scrollTo('text=Failure lab');

await caption('5 · Worst case: money debited, seat sold out', 'Customer complains in Hinglish → 3-way check: bank ↔ ledger ↔ inventory');
await page.click('button:has-text("Debited, seat sold out")');
await page.waitForTimeout(2200);
await say('Paise kat gaye but ticket pending hai', 2500);
await caption('Outcome decided from order state: full auto-refund, no fees', 'With an audit trail. If the seat were still available, the ticket would be issued instead');
await page.locator('text=3-way reconciliation audit trail').click().catch(() => {});
await page.locator('text=3-way reconciliation audit trail').scrollIntoViewIfNeeded().catch(() => {});
await page.waitForTimeout(5500);

await caption('6 · Guardrail: a user tries to share their UPI PIN', 'The credential guard blocks it before it is stored, logged or sent to the LLM');
await say('my upi pin is 4821, please pay', 5000);

await caption('7 · Journey insights, measured from real events', 'Funnel with step conversion, turns to options, latency p50/p90, context trace and guardrail counts');
await page.click('header button:has-text("Insights")');
await page.waitForTimeout(4500);
await page.mouse.move(1000, 500);
await page.mouse.wheel(0, 700);
await page.waitForTimeout(4500);
await caption('');

await card('Context engineering harness', 'The LLM understands.<br>Tools decide. Templates speak.',
  'Credential guard · PII redaction · token-budgeted context · schema output + server validation · grounding validator · offline fallback.<br><br>Code, tests and product strategy memo: <b>github.com/devanshudhoble/namanai</b>', 7000);

await ctx.close();
await browser.close();
console.log('recorded');
