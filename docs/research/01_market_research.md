# 01 · Market research report

Scope: Indian travellers booking **bus, train and flight** on mobile. Research done Nov 2026 from public sources. Labels: 🇮🇳 India · 🌍 Global · 🧪 Assumption.

---

## 0. Market context

| Fact | Label | Source |
|---|---|---|
| India online travel market 2025 is estimated at **USD 23–56 bn**; the range is wide because reports define "online travel" differently | 🇮🇳 | [Mordor Intelligence](https://www.mordorintelligence.com/industry-reports/online-travel-market-in-india), [IMARC](https://imarcgroup.com/india-online-travel-market) |
| **Transportation (flight + train + bus) is the biggest segment**, about 36–47% of online travel | 🇮🇳 | Same as above |
| **Mobile is 65–78% of bookings**; app-based share rose from ~58% (2020) to ~73% (2025) | 🇮🇳 | [Mordor](https://www.mordorintelligence.com/industry-reports/online-travel-market-in-india), [IMARC](https://imarcgroup.com/india-online-travel-market), [Ken Research](https://www.kenresearch.com/industry-reports/india-online-travel-ota-platforms-market.md) |
| Total India travel market growth slowed to ~1% in 2025 after 10% in 2024 | 🇮🇳 | [Phocuswright via PhocusWire](https://www.phocuswire.com/news/online/india-travel-market-stalls-2025-then-bets-fare-driven-rebound) |
| **~89% of rail reservations are online**; third-party apps (MakeMyTrip, Paytm, ixigo, ConfirmTkt) do **~28%** of online rail bookings | 🇮🇳 | IRCTC CMD, reported by [Tribune](https://www.tribuneindia.com/news/business/irctc-names-paytm-among-platforms-driving-28-of-online-railway-ticket-bookings/) |
| India has ~958 mn active internet users (2025), **57% rural** | 🇮🇳 | IAMAI-Kantar 2025, reported by [YourStory](https://yourstory.com/2026/01/indias-internet-user-base-crosses-950-million-2025-iamai-report) |
| 57% of urban users prefer Indic-language content; **~1 in 5 users use voice commands** | 🇮🇳 | [IAMAI-Kantar 2024 report (PDF)](https://www.iamai.in/sites/default/files/research/Kantar_%20IAMAI%20report_2024_.pdf) |
| 44% of users have used AI features such as voice search or chatbots | 🇮🇳 | IAMAI-Kantar 2025, [Business Today](https://www.businesstoday.in/technology/news/story/indias-internet-user-base-tops-950-million-as-rural-growth-ai-drive-adoption-513353-2026-01-29) |

**So what:** rail and bus are where the next users are (Tier-2/3, Hindi-first, mobile-only). Voice in Hindi/Hinglish fits them better than forms. Paytm already has rail scale via IRCTC, so it does not need to buy reach. It needs to convert better.

---

## 1. AI-driven analytics for customer journeys

**Research question:** where do users struggle or drop off when booking travel?

| Finding | Label | Source |
|---|---|---|
| Travel has among the **highest abandonment of any e-commerce category**: commonly reported at 80–90% (SaleCycle: ~91% for travel sites, ~94% for OTAs) | 🌍 | [SaleCycle via Amadeus](https://amadeus.com/en/insights/blog/converting-abandoned-bookings-airlines-salecycle), [Contentsquare](https://contentsquare.com/blog/travel-booking-abandonment/) |
| 52% of travellers say they dropped a booking because of a bad digital experience | 🌍 | SiteMinder Changing Traveller Report 2025, via [Hotel-Online](https://www.hotel-online.com/index.php/news/why-do-guests-abandon-hotel-bookings-what-every-hotelier-needs-to-know) |
| Tatkal: **7 in 10 travellers report difficulty**; many say tickets sell out within a minute | 🇮🇳 | LocalCircles, via [Business Standard](https://www.business-standard.com/india-news/irctc-tatkal-ticketing-error-indian-railways-agents-125060200354_1.html) |
| Voice searches in India often end in video, not text; voice users are underserved by text-first products | 🇮🇳 | [IAMAI-Kantar 2024](https://www.iamai.in/sites/default/files/research/Kantar_%20IAMAI%20report_2024_.pdf) |
| Flight vs train vs bus sit in separate tabs, so a user who would take the bus never sees it is cheaper | 🧪 | My product teardown, to test |

**Answers to the research questions**

| Question | What the evidence says | Confidence |
|---|---|---|
| Which step loses most users? | Globally: **search → select** (browsing) and **payment**. India rail adds **availability** (waitlist, Tatkal sell-out) | Medium (global data + Indian complaints) |
| Why search but not book? | Not ready yet, comparing elsewhere, price changed, total higher than expected, availability gone | Medium |
| Do users compare across apps? | Very likely: the same IRCTC inventory is sold by 5+ apps, so price/fee and confirmation odds are the comparison | 🧪 to test in interviews |
| Does too much info confuse? | Likely for Tier-2/3, first-time and Hindi-first users | 🧪 |
| Can AI find the right option faster? | Vernost reports **60% less booking time** with GenAI discovery and booking assistants (vendor claim) | 🌍 low-medium |

**Deliverables:** journey map, funnel and pain points are in [03_journey_and_funnel.md](03_journey_and_funnel.md).

---

## 2. Optimising booking conversions

**Research question:** how can a travel platform convert more searches into confirmed bookings?

| Area | Finding | Label | Source |
|---|---|---|---|
| Pricing | **60% say travel sites don't show the convenience fee upfront**; only 30% say they do | 🇮🇳 | [LocalCircles travel-apps survey](https://localcircles.com/a/press/page/travel-apps-survey) |
| Pricing | ~8 in 10 flyers hit "drip pricing" / hidden charges on airline sites and apps (Dec 2025) | 🇮🇳 | [Business Today](https://www.businesstoday.in/latest/corporate/story/indigo-flight-disruptions-80-flyers-hit-by-airlines-dark-patterns-nationwide-survey-finds-506325-2025-12-11) |
| Pricing | IRCTC convenience fee ₹10 (non-AC) / ₹20 (AC), plus gateway charges that vary by method, so the *same* train costs different amounts by payment method | 🇮🇳 | [Business Today](https://www.businesstoday.in/india/story/why-are-online-train-tickets-costlier-than-counter-bookings-railways-minister-ashwini-vaishnaw-explains-464930-2025-02-17), [ICICI T&C](https://www.icicibank.com/personal-banking/insta-banking/irctc-ticket-booking/terms-conditions) |
| UX standards | Show the final price incl. taxes, show steps and progress, use inline validation and autofill | 🌍 | [Google Travel UX Playbook (PDF)](https://ux.haifa.ac.il/wp-content/uploads/2019/01/pdf_travel_ux_playbook.pdf), [Google Forms UX Playbook (PDF)](https://services.google.com/fh/files/events/pdf_forms_ux_playbook.pdf) |
| Trust | Cancellation processing, timely refunds and price trust are the **top consumer complaints** about travel apps | 🇮🇳 | [LocalCircles](https://localcircles.com/a/press/page/travel-apps-survey) |
| Checkout | UPI is the default method; gateway fees differ by method | 🇮🇳 | [IRCTC fee coverage](https://www.angelone.in/news/market-updates/irctc-defends-upi-and-online-ticket-fees-railway-minister-explains-rs-10-20-charge-for-convenience) |
| Mobile | 65–78% of bookings are on mobile, so passenger forms on a small screen are the main battlefield | 🇮🇳 | [Mordor](https://www.mordorintelligence.com/industry-reports/online-travel-market-in-india) |

**Deliverables:** booking funnel, conversion opportunities and experiment backlog in [03_journey_and_funnel.md](03_journey_and_funnel.md#experiment-backlog).

---

## 3. Payment and cancellation patterns

**Research question:** why do customers fail to pay, abandon bookings or cancel after booking?

| Finding | Label | Source |
|---|---|---|
| UPI technical declines are now low, about **0.7–0.8%** industry-wide (from 8–10% in 2016), but vary a lot by bank (e.g. ~0.02% to 0.9% for large banks; one small bank ~7%) | 🇮🇳 | [Inc42](https://inc42.com/buzz/technical-glitches-on-upi-have-fallen-below-1/amp), [Outlook Business](https://www.outlookbusiness.com/ampstories/news/upi-transaction-failures-how-indias-banks-performed-in-fy25) |
| UPI had **several national outages in Mar–May 2025**; at peak (Tatkal, festivals) one outage can wipe out a booking window | 🇮🇳 | [Business Standard](https://business-standard.com/finance/news/upi-payments-face-outage-for-third-time-in-a-week-npci-flags-latency-125040201311_1.html), [ORF](https://www.orfonline.org/expert-speak/upi-at-scale-outages-and-the-push-for-resilient-systems/) |
| **"Money deducted, no ticket"** is a recurring IRCTC complaint; refund paths depend on the payment method | 🇮🇳 | [Upstox](https://upstox.com/news/personal-finance/latest-updates/money-deducted-but-tatkal-ticket-not-booked-on-rail-one-app-know-the-2-refund-scenarios/article-203294/), [Zee News](https://englishstageapi.zeenews.com/railways/irctc-down-tatkal-ticket-users-complain-of-repeated-error-messages-on-app-netizens-react-how-to-book-train-tickets-online-2999249.html), [ConsumerComplaints.in](https://www.consumercomplaints.in/indian-railway-catering-tourism-corporation-irctc-b100086) |
| **RBI rule:** failed UPI merchant payments must be auto-reversed within **T+5 days**, with **₹100/day** compensation after that, paid without a complaint | 🇮🇳 | [RBI circular RBI/2019-20/67](https://www.rbi.org.in/Scripts/NotificationUser.aspx?Id=11693) |
| IRCTC: Tatkal confirmed = no refund; waitlisted = clerkage ~₹60 + GST; waitlist not confirmed after charting = auto-cancel, full refund | 🇮🇳 | [Zee News](https://zeenews.india.com/mobility/url-indian-railways-ticket-cancellation-rule-update-rs-100-waitlisted-ticket-irctc-2814034.html), [erail](https://erail.in/railway-ticket-cancellation-charges) (check current rates) |
| Payment issues caused **37% of travel booking drop-offs** in a UK study | 🌍 **UK only, not India** | [ecommpay](https://ecommpay.com/blog/travel-cart-abandonment-rates/) |
| After a card decline, 13% rebook with a competitor and 5% abandon | 🌍 | [Nuvei](https://www.nuvei.com/zh/posts/the-silent-drain-on-travel-revenue) |
| Paytm itself sells cancellation products: ₹99 full-refund flight cancellation, Ticket Assure (train), Paytm Assured (bus), Travel Pass | 🇮🇳 | [Paytm blog](https://paytm.com/blog/travel/), [Business Standard](https://www.business-standard.com/companies/news/paytm-launches-ai-powered-travel-app-paytm-checkin-125110601924_1.html) |

**So what:** the failure rate per payment is low, but the **pain per failure is very high**. The user doesn't know if money is gone, if the seat is held, or when the refund comes. That uncertainty drives support contacts and lost trust. It is a **communication and state** problem more than a payments-infrastructure problem.

**Deliverables:** taxonomy and refund journey in [04_payment_cancellation_taxonomy.md](04_payment_cancellation_taxonomy.md).

---

## 4. Real-world use cases from travel platforms

Full table in [02_competitor_analysis.md](02_competitor_analysis.md). Short version:

| Platform | What they shipped | Lesson for us |
|---|---|---|
| **Paytm Checkin** (Nov 2025) 🇮🇳 | AI-first app, conversational booking across flight/train/bus/metro, AI features in early beta at launch ([Skift](https://skift.com/2025/11/10/indian-fintech-paytm-pushes-deeper-into-travel-with-new-ai-backed-app/)) | The surface exists. The opportunity is **depth**: Hindi voice, payment recovery, grounded answers |
| **MakeMyTrip Myra** 🇮🇳 | GenAI assistant (Aug 2025, Hindi + English beta); Myra 2.0 (May 2026) adds full voice booking with barge-in in 8 languages ([BusinessWire](https://www.businesswire.com/news/home/20250806170695/en), [India TV](https://www.indiatvnews.com/technology/news/makemytrip-myra-2-0-ai-asssistant-to-help-completing-travel-bookings-through-voice-conversations-2026-05-14-1041087)) | Voice booking in Indian languages is now table stakes for the top OTA |
| **ixigo TARA** 🇮🇳 | "ixigo Next" AI-native app; TARA voice in English/Hindi/Hinglish; claims 76% of voice support calls resolved end-to-end by AI ([Skift](https://skift.com/2026/05/24/india-is-where-the-voice-first-travel-app-gets-built/)) | Post-booking support is where AI pays back fastest |
| **redBus RAY** 🇮🇳 | Voice assistant on Google ADK + Gemini; earlier WhatsApp Hindi booking bot ([AIM](https://analyticsindiamag.com/ai-trends/redbus-builds-multilingual-ai-copilots-for-bus-operators-travellers)) | Bus users already book in Hindi on chat |
| **Google Travel** 🌍 | Price tracking; building agentic flight/hotel booking with partners ([Skift](https://skift.com/2025/11/17/google-is-building-agentic-travel-booking-plus-other-travel-ai-updates/)) | Discovery may move off-app; OTAs must win on booking + after-sales |
| **Booking.com** 🌍 | AI trip planner on ChatGPT, app-only, English markets ([Yahoo/USA Today](https://ca.news.yahoo.com/ai-trip-planning-tool-best-134756743.html)) | Planning is easy to demo, hard to monetise |
| **Expedia Romie** 🌍 | Assistant for research, booking and in-trip changes ([Expedia](https://www.expedia.com/newsroom/spring-product-release-2024)) | The value is staying with the trip after booking |
| **Vernost on AWS** 🌍/🇮🇳 | GenAI discovery, booking assistant, post-booking automation; **60% less booking time** (vendor claim) ([AWS](https://aws.amazon.com/solutions/case-studies/vernost-case-study/)) | Measure time-to-book as a primary metric |

---

## 5. How the four areas connect

```
Journey analytics ──► users drop at compare / passenger form / payment
Conversion        ──► hidden total + long forms + unclear refund rule
Payment/cancel    ──► rare failures, but huge uncertainty when they happen
Real-world AI     ──► competitors ship voice booking; support is where AI pays back
                         │
                         ▼
   ONE product: a voice booking assistant that
   1) takes the whole trip in one sentence (Hindi/Hinglish),
   2) compares bus vs train vs flight on the real total,
   3) reads back total price + refund rule before payment,
   4) holds the fare and hands off to UPI (PIN never in the chat),
   5) owns failure: retry, reconcile "money gone, no ticket", quote refunds.
```

🧪 **This is a hypothesis.** Expected impact (higher booking completion, fewer payment-related support contacts) must be shown by the experiment in [06](06_opportunities_rice_mvp.md#validation-plan), not claimed.

## 6. Do we even need AI? (simpler options first)

| Problem | Simpler fix first | Where AI adds something a simpler fix can't |
|---|---|---|
| Hidden fees | Show the final price on the results card | None. **Do this without AI** |
| Long passenger forms | Saved travellers + autofill | Voice helps Hindi-first / low-literacy users |
| Comparing modes | A "cheapest across bus/train/flight" toggle | Free-text constraints ("evening, under ₹800, AC") |
| Refund status anxiety | A clear status timeline + push updates | Answering "where is my money" in the user's own words, 24×7 |
| Payment failure | Idempotent retry + auto reconciliation | Explaining what happened and what to do, in Hindi |

## 7. Research gaps

- Paytm funnel step conversion, payment success by method, refund-contact volume: **needed from Paytm**.
- Share of Paytm Travel users who are Hindi-first or Tier-2/3: unknown.
- How Paytm Checkin's assistant performs today (usage, completion): unknown; would ask the team.
- No primary interviews yet. Plan in [05](05_personas_and_interview_plan.md).
- Bus-specific failure data (operator cancellations, boarding-point changes) is mostly anecdotal (reviews).
