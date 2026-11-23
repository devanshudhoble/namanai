# 04 · Payment failure and cancellation taxonomy, refund journey

India-specific unless marked. Frequencies are not known for Paytm; the "how common" column is a 🧪 estimate from public complaints, to replace with Paytm data.

## A. Payment failure taxonomy

| Code | Failure | Method | Where it happens | What the user sees today | Right response | How common 🧪 |
|---|---|---|---|---|---|---|
| P1 | **Technical decline** (bank/NPCI) | UPI | Bank or switch down; ~0.7–0.8% overall, much higher at weak banks | "Transaction failed" | Retry same order; suggest another bank/UPI app | Low, spikes at peak |
| P2 | **Timeout / pending** | UPI | Collect request not approved in time, app switch lost | Spinner, then unclear | Hold fare 10 min; poll status; never charge twice | Medium |
| P3 | **User decline / wrong PIN / limit** | UPI | Business decline | "Declined" | Explain plainly; offer other method; no blame | Medium |
| P4 | **Card decline / OTP fail** | Card | Issuer, 3-DS | "Payment failed" | Offer UPI; retry | Low-medium |
| P5 | **Net banking drop-off** | Net banking | Redirect, session expiry | Back on app, no state | Resume order | Low |
| P6 | **Wallet insufficient balance** | Wallet | Balance < total | Top-up prompt | Split pay / UPI | Low |
| P7 | **Debited, no ticket** (supplier failure after payment) | Any | Seat sold out, IRCTC/operator error after debit | "Money deducted, ticket not booked" | Reconcile now; auto-refund; tell the user the exact ETA | Low but **worst trust damage** |
| P8 | **Duplicate payment fear** | Any | User retries after P2 | Pays twice "to be safe" | Idempotency key; show "only one charge will happen" | Medium |
| P9 | **Fee surprise at checkout** | Any | Gateway / convenience fee shown late | Abandons at pay step | Show total upfront | Medium-high |
| P10 | **Social-engineering risk** | UPI | "Agent" asks for PIN/OTP | Fraud | Agent never asks; credential guard blocks it | Rare, severe |

Regulation to design around: for failed UPI merchant payments, **auto-reversal within T+5 days, ₹100/day compensation after that** ([RBI circular](https://www.rbi.org.in/Scripts/NotificationUser.aspx?Id=11693)). The product should beat this limit by a wide margin and *say* the date.

## B. Cancellation reason taxonomy

| Code | Who cancels | Reason | Mode | Policy that applies | Product need |
|---|---|---|---|---|---|
| C1 | Customer | Plans changed | All | IRCTC slab by time to departure; bus/flight by operator | Refund quote before confirm |
| C2 | Customer | Waitlist not confirmed (manual) | Train | Clerkage ~₹60 + GST per passenger | Show confirm-chance early; suggest alternatives |
| C3 | System | Waitlist not confirmed after chart | Train | Auto-cancel, full refund | Tell user before they ask |
| C4 | Customer | Found cheaper / better option | All | Normal slab | Cross-mode compare before booking |
| C5 | Customer | Booked wrong date/name/station | All | Normal slab; name change often not allowed | Read-back before pay prevents it |
| C6 | Operator | Bus cancelled / breakdown | Bus | Operator full refund | Proactive alert + rebook |
| C7 | Airline | Flight cancelled/rescheduled | Flight | Airline refund or free change | Proactive alert + options |
| C8 | Railways | Train cancelled / diverted | Train | Full refund (auto or TDR) | TDR help in plain language |
| C9 | Customer | Missed the trip | All | Often no refund; TDR in some cases | TDR deadline reminders |
| C10 | Customer | Tatkal booked, plans changed | Train | **No refund on confirmed Tatkal** | Warn before booking Tatkal |

Policy references: [IRCTC rules summary (erail)](https://erail.in/railway-ticket-cancellation-charges), [Zee News on clerkage](https://zeenews.india.com/mobility/url-indian-railways-ticket-cancellation-rule-update-rs-100-waitlisted-ticket-irctc-2814034.html). Check current rates before quoting numbers in the product.

## C. Refund journey map

| Stage | Cancel request | Refund quote | Confirm | Refund initiated | In transit | Credited | Not credited by ETA |
|---|---|---|---|---|---|---|---|
| User question | "Can I cancel?" | "How much will I get?" | "Is it really cancelled?" | "Has it started?" | "Where is it?" | "Did it come?" | "Who do I call?" |
| Today 🧪 | Find booking, find cancel button | Often shown late or as % | SMS | Rarely told | No status | Must check bank | Support call / complaint |
| Target | "Cancel karna hai" by voice | Exact ₹ from policy engine, before confirm | Read-back + explicit yes | Push: "₹X refund started, ref ID" | Status on one screen | Push: "₹X credited to account ending 12" | Auto-escalate + RBI-compensation-aware |
| Metric | Cancel success rate | Quote shown before cancel = 100% | Wrong cancellations = 0 | Time to initiate | Refund TAT p90 | % within promised ETA | Refund contacts / 1k bookings |

## D. What the prototype already covers

| Taxonomy item | Prototype feature |
|---|---|
| P1, P2, P3 | Payment failure lab: bank timeout, decline, retry on same order |
| P7 | "Debited, seat sold out" → 3-way reconciliation → full auto-refund |
| P8 | Idempotency key on hold and payment (MCP `hold_fare`, `request_upi_payment`) |
| P9 | Read-back of total before booking |
| P10 | Credential guard blocks PIN/OTP/card in input and logs |
| C1, C5 | `quote_refund` before `cancel_booking`; read-back prevents wrong bookings |

Not covered yet: C6–C8 proactive operator/airline/railway alerts, C10 Tatkal warning, TDR help.
