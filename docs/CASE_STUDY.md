# Case Study: A voice booking agent for Paytm Travel

**Author:** Devanshu Dhoble · **Format:** product case study + working prototype · **Status:** prototype on sandbox inventory and sandbox payments

> An independent concept, not affiliated with or endorsed by Paytm. "Paytm UPI" in the prototype marks where the real payment step would sit.

---

## TL;DR

- **Problem:** Booking a train, bus or flight on a phone is a form: city pickers, a calendar, passenger steppers, class filters, a payment funnel. For a large share of Indian travellers, especially first-time online bookers in Tier-2/3 towns who are more comfortable speaking Hindi or Hinglish than filling forms, that form *is* the drop-off.
- **Bet:** Let people say the whole trip in one sentence ("Mumbai se Nagpur agle Friday, 2 log, train"). The agent asks only for what's missing, compares modes, and books **only after an explicit "yes"**, with payment on the UPI screen.
- **What makes it shippable rather than a demo:** a **context engineering harness** around the LLM. The model only *understands*. Prices, PNRs and refunds come from tools. Every number spoken is checked against tool output before the customer hears it.
- **Built:** a working React + FastAPI prototype, Gemini 2.5 Flash for understanding (with an offline rules fallback), Sarvam Bulbul for Indian-voice TTS, a real event-based journey funnel, five payment-failure patterns, cancellation/refund maths, 27 automated tests and a 30-utterance NLU eval set.
- **Ask:** a 2-week pilot on **trains, Hindi belt, Android, 1% of Travel home traffic**. Primary metric: search-to-booking conversion versus the existing form. Guardrails: wrong-booking rate and payment-support tickets.

---

## 1. Problem

### What the customer is trying to do
"Get me and my mother to Nagpur on Friday, cheaply, without messing up."

### Where the current form-based flow loses them (hypotheses to validate with Paytm data)

| Step | Friction | Hypothesis |
|---|---|---|
| Search | Station codes, spelling ("Jodpur"), state vs city | Unfamiliar names cause zero-result searches and abandonment |
| Compare | Flight vs train vs bus sit in separate tabs | Price-sensitive users never see that the bus is ₹600 cheaper |
| Decide | Fare rules, baggage, refund terms buried in small print | Uncertainty about refunds delays the decision, and the fare moves |
| Pay | UPI app hand-off, timeouts | "Payment failed" and "money deducted, no ticket" are top support drivers |
| After | Cancellation refund maths is opaque | Customers call support to learn a number the system already knows |

**What I'd pull first at Paytm:** step-level funnel by city tier and app language, zero-result search rate, payment failure reasons, and the top 20 support-ticket intents for Travel.

### Why now
- Speech recognition and LLMs now handle Hinglish and code-switching well enough to *understand*, but not well enough to be *trusted with money*. The product opportunity is the harness that bridges that gap.
- Indian-language neural TTS (Sarvam Bulbul) makes the agent sound local rather than robotic.
- UPI already moved PIN entry to the device, so voice never needs to touch a secret.

---

## 2. Users

| Persona | Job to be done | What they need from voice |
|---|---|---|
| **Sunita, 46, Wardha**: books trains for family 4–5× a year, prefers Hindi | "Book the right train without asking my son" | Speak in Hindi/Hinglish, read-back before paying, clear refund rules |
| **Arjun, 29, Bengaluru**: frequent traveller, busy | "Cheapest decent option to Goa, now" | One sentence → options, "cheapest?" / "fastest?" in one tap |
| **Any customer after paying** | "My money went, where's my ticket?" | An instant, honest answer instead of a 48-hour ticket |

---

## 3. Product principles

1. **Ask only for what's missing.** One sentence can fill every detail. Never re-ask something the user said.
2. **Customer approval comes first.** The agent reads back provider, time, total and refund rule, then waits for "yes". No implicit bookings.
3. **The LLM understands; tools decide; templates speak.** No model-generated price, PNR or refund amount ever reaches the customer.
4. **Secrets never enter the conversation.** UPI PIN, OTP and card numbers are blocked before they're stored, logged or sent to a model.
5. **Every failure has a next step.** Failed payment → retry on the same order. Debited but no ticket → reconcile now. Cancel → show the refund first.
6. **Measure everything; fake nothing.** The analytics panel is computed from real events, and sandbox data is labelled as sandbox.

---

## 4. The four focus areas

### 4.1 AI-driven analytics for customer journeys
**Built** (`src/services/analytics.ts`, Insights drawer):
- Event stream per session: `session_started → trip_details_complete → options_shown → option_selected → booking_approved → payment_requested → booking_confirmed`, plus failure and guardrail events.
- Funnel with **step conversion** (red when a step converts below 60%) and **where sessions were abandoned**.
- Conversation-efficiency metrics specific to voice: **median turns to options**, **trip details captured per turn**, and **share of turns understood by the LLM vs the rules fallback**.
- **Latency p50/p90** for understanding, tools, TTS and full turn, measured, not hardcoded.

**Finding from my own testing:** Sarvam TTS through the backend proxy took about **4 s to first audio** (non-streaming, local network, small sample). That is longer than every other step combined, and voice users hang up on silence. **Next step:** stream TTS and start speaking the first sentence while the rest is generated. In production I'd alert if **turn p90 > 2.5 s**.

### 4.2 Optimising booking conversions
| Lever | How it's built | Metric it moves |
|---|---|---|
| Multi-slot understanding | Gemini returns every slot in one JSON. Rules fallback does the same offline | Turns to options (target ≤ 2) |
| Ask only what's missing | Slot ledger computes missing required slots: destination, origin, date, travellers | Turn-level abandonment |
| Cross-mode comparison | One search returns flights, trains and buses. The agent names the fastest *and* the cheapest | Option-selected rate, AOV mix |
| "Cheapest? Fastest? One day later?" | Option-stage intents re-rank or re-search without restarting | Re-search without abandonment |
| Explicit approval with read-back | Total, time, refund rule read back before "Shall I book it?" | Wrong-booking rate (guardrail) |
| 10-minute fare hold | Price locked while the user pays | Payment-step conversion |

### 4.3 Payment & cancellation patterns
The failure lab in the payment sheet reproduces the patterns a travel support team actually sees. Each outcome is **decided from order state**, not scripted:

| Pattern | Agent behaviour | Why |
|---|---|---|
| User declined / bank timeout / insufficient balance | "No money was taken. Your fare is still held for N minutes. Retry?" | Reassures first. Keeps the hold |
| Retry | Same order id, so the retry is idempotent | Can never double-charge |
| Debited, callback lost, seat still there | 3-way check (bank ↔ ledger ↔ inventory) → **issue ticket** | Turns a support ticket into a 1-second fix |
| Debited, hold expired, seat sold out | 3-way check → **full auto-refund, no fees**, offer re-search | The worst case, handled honestly |
| No debit at bank | "Nothing is stuck. A pending debit on your bank app usually reverses on its own." | Prevents an unnecessary ticket |
| Cancel after booking | Quote first: paid − cancellation fee (per traveller; more than 24h vs within 24h) − non-refundable convenience fee. Confirm, then refund | No surprise refunds |

**Payment UX note for Paytm specifically:** inside the Paytm app the customer is already in a UPI app, so the right pattern is a **one-tap in-app UPI intent** with the PIN on the UPI screen, not a collect request to another app. The prototype models this.

### 4.4 Real-world use cases from travel platforms
Six demo scenarios in the app, each tied to a real behaviour: one-shot Hinglish booking, partial intent, price-sensitive comparison, baggage question, PIN-leak attempt and post-booking cancellation. The failure lab adds the five payment patterns above.

---

## 5. Context engineering: the core design decision

Full write-up: [CONTEXT_ENGINEERING.md](CONTEXT_ENGINEERING.md). In short, every turn passes through a harness that:

1. **Blocks secrets** (PIN/OTP/card) before anything else happens. At the payment step even a bare 4- or 6-digit number is treated as a probable PIN.
2. **Redacts** long digit runs (phone, account numbers) before text leaves the device for the LLM.
3. **Assembles layered context** under a **1,200-token budget**: immutable policy → slot ledger with provenance → options on screen (only when comparing) → last 6 turns. Old dialogue is trimmed first; policy and state are never dropped.
4. **Constrains output** to a JSON schema, then **re-validates server-side** (no past dates, 1–9 travellers, no injection-looking city names).
5. **Lets deterministic rules win where stakes are high**: payment issues, "yes" and "no".
6. **Validates every spoken reply**: each ₹ amount and booking code must exist in the tool-fact store, or the reply is replaced and the event logged.

This is what lets a PM promise legal and compliance that the agent cannot invent a fare.

---

## 6. Metrics

**North Star:** confirmed bookings from voice sessions, per 100 voice sessions started.

| Type | Metric | Pilot target (to calibrate) |
|---|---|---|
| Input | Median turns to options | ≤ 2 |
| Input | Trip details captured per turn | ≥ 2 |
| Input | Option-selected rate | ≥ form baseline |
| Input | Payment success rate on first attempt | ≥ form baseline |
| Quality | NLU slot accuracy on a golden set from real utterances | ≥ 95% |
| Quality | Turn latency p90 | ≤ 2.5 s |
| **Guardrail** | Wrong-booking rate (cancellations within 1h of booking with reason "wrong train/date") | ≤ form baseline |
| **Guardrail** | Payment-related support tickets per 1k bookings | ≤ form baseline |
| **Guardrail** | Ungrounded-claim blocks per 1k turns | trending to 0 |
| **Guardrail** | PIN/OTP shared over voice | 0 reached the LLM or logs |

---

## 7. Experiment & rollout

**Pilot (2 weeks):** trains only (biggest Tier-2/3 volume hypothesis, simplest inventory model), Hindi-belt states, Android, voice entry point shown to 1% of Travel home traffic. Control sees the current form.

- **Primary:** search-to-booking conversion. **Secondary:** time to booking, support tickets per booking.
- **Randomisation:** user-level, so one person never sees both experiences.
- **Exit criteria to 10%:** primary metric not worse, every guardrail within bounds, turn p90 ≤ 2.5 s.

| Phase | Scope | Gate |
|---|---|---|
| 0 | Internal dogfood + golden set from 500 real support/search utterances | Slot accuracy ≥ 95% |
| 1 | 1% trains, Hindi belt | Guardrails within bounds |
| 2 | 10%, add buses | Conversion ≥ control |
| 3 | Flights + hotels, more languages (Marathi, Tamil, Bengali via Sarvam) | Per-language accuracy bar |
| 4 | Post-booking voice support (status, cancel, refund) for all bookings | Support ticket deflection |

---

## 8. Risks and mitigations

| Risk | Mitigation in the prototype | Still open |
|---|---|---|
| Wrong booking (misheard date/city) | Read-back + explicit approval. Slot ledger shows what was understood | Measure ASR WER on accents and noisy stations |
| LLM invents a fare or PNR | Tools decide, templates speak, grounding validator | Extend to LLM small-talk in more languages |
| Social engineering / PIN sharing | Credential guard before LLM and logs. PIN only on UPI screen | Detect "agent impersonation" scams in support flows |
| Latency kills voice UX | NLU without "thinking", 7 s timeout → rules fallback, p50/p90 measured | Streaming STT + TTS |
| LLM outage | Offline rules engine with the same output shape (100% on current golden set) | Golden set must come from real traffic |
| Privacy (DPDP Act 2023) | Number redaction before the LLM, no audio stored, keys server-side | Consent copy, retention policy, data residency of providers |
| Cost per session | 1,200-token context budget per turn, small JSON output | Measure real tokens per booking. Cache stable prompt prefix |

---

## 9. Evaluation (and its limits)

- `npm run eval` runs **30 English/Hindi/Hinglish utterances** (one-shot bookings, partial intents, bare answers like "4" or "teen log", comparison, approval, support) through the offline engine. The current result is 100% intent and 100% slot accuracy.
- **Honest caveat:** I wrote that set alongside the rules, so it's a **regression floor**, not proof the system generalises. The first real task is a golden set mined from actual search queries and support transcripts, run against both the Gemini path and the rules path, with per-language accuracy reported.
- 27 automated tests in total: 22 in TypeScript (harness, refund maths, end-to-end journeys including all payment failure patterns) and 5 in Python (server-side validation, fallback behaviour).

---

## 10. What I'd do in my first 90 days as an APM on this

1. **Weeks 1–3:** pull funnel and support data, interview 15 Tier-2/3 train bookers in Hindi, and build the real golden set.
2. **Weeks 4–6:** with engineering, integrate real train search and the in-app UPI intent behind the harness. Ship streaming TTS.
3. **Weeks 7–10:** run the 1% pilot, review conversations weekly with support, tune prompts and rules from failures.
4. **Weeks 11–13:** decide scale-up from data. Write the post-booking voice support spec (status, cancel, refund), since it has the clearest ticket-deflection ROI.

---

## 11. What is real vs simulated

| Component | Status |
|---|---|
| Gemini 2.5 Flash understanding (JSON schema, server-side key) | **Real** (when `GEMINI_API_KEY` is set) |
| Offline rules NLU, Hinglish date parser | **Real** |
| Context harness: guards, ledger, budgeted context, grounding validator | **Real** |
| Sarvam Bulbul TTS via backend proxy | **Real** (when `SARVAM_API_KEY` is set). Browser voice otherwise |
| Speech-to-text | Browser Web Speech API (en-IN / hi-IN) |
| Journey analytics and latency | **Real**, measured in the browser |
| Flight/train/bus inventory, fares, PNRs | **Simulated** (sandbox generator) |
| UPI payment, bank callbacks, refunds | **Simulated**. The decision logic is real; no money moves |

## 12. Questions I'd bring to the Paytm Travel team
- Which step loses the most Tier-2/3 users today, and is it the same for Hindi-language app users?
- What share of Travel support tickets are "money deducted, ticket pending" and how long do they take to resolve?
- Is IRCTC's flow (IRCTC login, captcha) a hard constraint that voice must hand off to, and where exactly?
- Is there appetite to start with **post-booking voice support** (status, cancel, refund), which has lower risk and a measurable ticket-deflection win, before voice booking?
