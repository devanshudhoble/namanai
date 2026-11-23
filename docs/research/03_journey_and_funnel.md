# 03 · Customer journey map, booking funnel, experiment backlog

## Customer journey map (today, form-based app, train booking)

Persona: Sunita, Hindi-first family booker (see [05](05_personas_and_interview_plan.md)). Emotions and pain points are 🧪 hypotheses from public complaints, to be confirmed in interviews.

| Stage | 1. Open app | 2. Search | 3. Compare | 4. Select | 5. Passenger details | 6. Pay | 7. Confirmation | 8. After booking |
|---|---|---|---|---|---|---|---|---|
| **What she does** | Opens Paytm, finds Travel tile | Types From/To, picks date, class | Scrolls 10+ trains, checks availability per class | Picks a train and class | Enters 4 names, ages, berth choice, ID | UPI app opens, enters PIN | Waits for PNR / SMS | Checks waitlist, cancels, chases refund |
| **What she thinks** | "Where is train in this?" | "Is it Nagpur or Nagpur Jn?" | "Which one will get confirmed?" | "Is this the total?" | "So many fields, again" | "Did it go through?" | "Money gone, no ticket?" | "When will my refund come?" |
| **Feeling** | 😐 | 😐 | 😟 | 😟 | 😩 | 😰 | 😰 / 😊 | 😟 |
| **Pain point** | Travel is buried in a super-app | Station names, English-only fields | Too many options, availability per class hidden | Fees appear later | Re-typing family details on a small screen | Bank timeout, app switch, unclear state | "Money deducted, ticket not booked" | Refund timeline unclear, waitlist anxiety |
| **Evidence** | 🧪 | 🧪 | 🇮🇳 Tatkal difficulty (LocalCircles) | 🇮🇳 60% say fee not shown upfront | 🌍 Google UX playbook: autofill | 🇮🇳 UPI outages 2025 | 🇮🇳 IRCTC complaints | 🇮🇳 refund is a top complaint |
| **AI / product opportunity** | Voice entry: "Bol ke book karo" | One-sentence intent, station disambiguation | Shortlist 3, cross-mode cheapest/fastest, confirm-chance | Read back total + refund rule | Saved travellers by voice: "same as last time" | Fare hold, in-app UPI, idempotent retry | Instant reconciliation, honest status | Refund quote, push timeline, Hindi answers |

Sources for evidence: see [01_market_research.md](01_market_research.md).

## Booking funnel

The **step definitions** are standard. The **conversion rates below are illustrative placeholders**, not Paytm data: they show what to measure, and what a "good" read would look like.

| # | Funnel step | Event | Illustrative step conversion 🧪 | What to look at first |
|---|---|---|---|---|
| 1 | Travel entry | `travel_home_view` | 100% | Entry point (home tile, search, push) |
| 2 | Search | `search_submitted` | 60% | Empty or failed searches, station mismatch |
| 3 | Results viewed | `results_viewed` | 90% | Latency, zero-result rate |
| 4 | Option selected | `option_selected` | 35% | **Biggest expected drop**: browsing, comparing, waitlist |
| 5 | Passenger details done | `traveller_form_completed` | 70% | Field errors, time on form, saved-traveller use |
| 6 | Payment started | `payment_initiated` | 90% | Total shown vs expected (fee surprise) |
| 7 | Payment succeeded | `payment_success` | 85–95% | By method, by bank, by time (Tatkal 10:00/11:00) |
| 8 | Ticket issued | `ticket_issued` | 98% | "Debited, no ticket" cases, reconciliation time |
| 9 | Not cancelled / no support contact in 7 days | `booking_kept` | — | Cancel reasons, refund contacts per 1k bookings |

**Voice funnel (added events for the assistant)** — these are live in the prototype's Insights panel:
`voice_session_start → intent_captured (all slots) → options_shown → option_chosen → readback_approved → fare_held → payment_success → ticket_issued`, plus `turns_to_options`, `fallback_to_form`, `guardrail_block`, `latency_p90`.

## Conversion opportunities

| Drop point | Likely reason | Opportunity | AI needed? |
|---|---|---|---|
| Search → select | Too many choices, availability unclear | Shortlist 3 with reasons; cross-mode cheapest/fastest; confirm-chance | Partly (ranking by stated preferences) |
| Select → form done | Re-typing travellers | Saved travellers, autofill, voice "same 4 people as Diwali" | No for autofill; voice optional |
| Form → payment | Fee surprise | Final total on the results card | **No** |
| Payment start → success | Timeout, app switch, bank decline | Fare hold, retry same order, suggest another UPI app/bank | No for retry; AI to explain |
| Success → ticket | Supplier failure after debit | Instant 3-way reconciliation, auto-refund, honest message | No for logic; AI to talk |
| Ticket → kept | Plans change, waitlist | Refund quote before cancel; waitlist confirm-chance | Partly |

## Experiment backlog

| # | Hypothesis | Experiment | Primary metric | Guardrail metric | Effort |
|---|---|---|---|---|---|
| E1 | Users leave because the total appears late | Show final price (incl. convenience + gateway fee) on result cards | Search → booking conversion | Revenue per booking | S |
| E2 | Long forms cause drop-offs | Saved travellers + one-tap "same as last trip" | Form completion rate | Wrong-passenger tickets | S |
| E3 | Users aren't ready to book | "Save trip" + price/availability alert | Return-to-booking rate (7 days) | Notification opt-out | M |
| E4 | Hindi-first users drop at forms | Voice entry "Bol ke book karo" for Hindi-locale users | Booking completion for Hindi-locale cohort | Wrong-booking rate, CSAT | L |
| E5 | Payment failure loses the booking | 10-min fare hold + retry on same order | Payment-step recovery rate | Duplicate debits = 0 | M |
| E6 | "Money gone, no ticket" drives support | In-chat reconciliation with honest status + refund ETA | Refund-related contacts per 1k bookings | Refund TAT | M |
| E7 | Price-sensitive users don't see cheaper modes | Show "bus is ₹X cheaper" nudge on train results | Cross-mode bookings, total GMV | Cancellation rate | M |
| E8 | Refund fear blocks booking | Show refund rule in one line before pay | Payment-start rate | Cancel rate | S |

E1, E2 and E8 don't need AI. **Run them anyway**: they are cheap and they make the AI test (E4) cleaner, because E4 then measures voice, not a fee-display fix.
