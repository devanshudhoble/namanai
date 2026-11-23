# 06 · AI opportunity matrix, RICE prioritisation, MVP

## AI opportunity matrix

Axes: **user and business value** vs **AI fit** (does AI do something rules or UI can't?).

| | **Low AI fit** (rules / UI are enough) | **High AI fit** |
|---|---|---|
| **High value** | O1 Final price upfront · O4 Fare hold + idempotent retry · O5 Reconciliation engine | **O2 One-sentence Hinglish booking** · **O6 Payment & refund status assistant** · O3 Cross-mode compare by stated preference |
| **Low value** | O9 Saved-trip reminders | O7 Destination inspiration / itinerary chat · O8 Generic travel Q&A bot |

Rule: build the left column **without AI**. Spend AI only on the top-right box. O7 and O8 are what most "AI travel" demos show; for bus/train bookers they are low value.

## RICE scoring

Reach = share of monthly travel users touched (🧪 estimate, scale 1–10). Impact = 0.25 / 0.5 / 1 / 2 / 3. Confidence = how sure the evidence is. Effort = person-months. **RICE = R × I × C ÷ E.** All inputs are assumptions to re-score with Paytm data.

| # | Opportunity | Reach | Impact | Confidence | Effort | **RICE** | Why |
|---|---|---|---|---|---|---|---|
| O1 | Final total on results card | 9 | 1 | 80% | 1 | **7.2** | Strong Indian evidence (fee complaints), cheap, no AI |
| O5 | Reconciliation + honest "money/ticket" status | 3 | 3 | 70% | 2 | **3.2** | Rare but very costly in trust and support |
| O4 | Fare hold + retry on same order | 4 | 2 | 70% | 2 | **2.8** | Saves bookings at the payment step |
| O6 | Payment & refund status assistant (chat/voice) | 4 | 2 | 60% | 2 | **2.4** | ixigo shows support is where AI pays back |
| O2 | One-sentence Hinglish voice booking | 3 | 2 | 50% | 3 | **1.0** | Big upside for Hindi-first users; least proven; competitors already ship it |
| O3 | Cross-mode compare by preference | 4 | 1 | 50% | 2 | **1.0** | Gap in market, demand unproven |
| O9 | Saved trip + alerts | 3 | 0.5 | 60% | 1 | **0.9** | Simple, modest |
| O7 | Itinerary / inspiration chat | 2 | 0.5 | 40% | 2 | **0.2** | Low value for this audience |
| O8 | Generic travel Q&A bot | 5 | 0.25 | 40% | 2 | **0.25** | Hard to tie to conversion |

## Recommendation: one product, built in this order

RICE says the **cheap non-AI fixes come first**, and the AI should sit on top of them. So the MVP is **one assistant** with a strong non-AI core:

> **"Bol ke book karo" assistant inside Paytm Checkin, for train and bus.**
> Say the trip once → shortlist with real totals → read-back of total + refund rule → fare hold → Paytm UPI → if anything fails, the assistant tells you exactly where your money and ticket are, and fixes it.

| Phase | Scope | Ships | AI? |
|---|---|---|---|
| **Now (MVP, ~13 weeks)** | O1 + O4 + O5 as the engine; O6 + O2 as the assistant on top; train + bus; Hindi + Hinglish | Behind a flag for Hindi-locale users | Yes, but only for understanding and explaining |
| **Next** | O3 cross-mode compare; flights; proactive cancellation alerts (C6–C8) | After E4 shows a win | Yes |
| **Later** | More languages; WhatsApp entry via the MCP server; Tatkal assist | After guardrail record is clean | Yes |

**Out of scope for MVP:** itinerary planning, hotels, generic Q&A, agent-initiated bookings without the user's words.

## Validation plan

| | |
|---|---|
| Experiment | E4 from [03](03_journey_and_funnel.md#experiment-backlog): Hindi-locale users, 50/50 split, assistant entry vs today's flow, **after** E1 has shipped to both arms |
| Primary metric | Booking completion rate (session start → ticket issued) |
| Secondary | Time to book; turns to options; payment-step recovery rate; refund-related contacts per 1k bookings |
| Guardrails | Wrong bookings (date/name/station) ≤ control; PIN/OTP reaching model or logs = 0; ungrounded price statements = 0; latency p90 ≤ 2.5 s |
| Ship if | Completion up with 95% confidence and all guardrails clean |
| Kill if | No lift after 4 weeks, or any credential leak, or wrong-booking rate above control |

## Where the prototype stands against this MVP

| MVP piece | Status in repo |
|---|---|
| O2 one-sentence Hinglish booking | ✅ Built (Gemini + offline fallback, 30-utterance eval) |
| Read-back + explicit yes | ✅ Built (and enforced server-side in MCP `hold_fare`) |
| O4 fare hold + idempotent retry | ✅ Built |
| O5 reconciliation + auto-refund | ✅ Built (sandbox) |
| O6 refund quote and status | ✅ Built (`quote_refund`, `get_booking_status`) |
| O1 final total on cards | ✅ Shown in options |
| O3 cross-mode compare | ✅ Basic (cheapest/fastest across modes) |
| Real Paytm inventory and payments | ❌ Sandbox only |
| Proactive alerts (C6–C8), Tatkal warning | ❌ Not built |
