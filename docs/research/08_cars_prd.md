# 08 · PRD: Cars and carpool on Paytm Travel (voice-first)

| | |
|---|---|
| **Author** | AI APM candidate (concept, not affiliated with Paytm) |
| **Status** | Draft for review · prototype built in sandbox |
| **Research** | [07_cars_cabs_carpool_research.md](07_cars_cabs_carpool_research.md) |
| **Code** | `mcp_server/travel_core.py` (`search_cars`, `search_carpool`), MCP tools in `mcp_server/server.py`, web app car mode |

## 1. Problem

Paytm Travel gets users to a city by flight, train or bus, but not **door to door**. To book a car for an outstation trip, a day's rental or the last 60 km from the station, users leave Paytm for Ola/Uber, Savaari, MakeMyTrip or a phone call to a local operator. When they do book, **~59% of app-based cab users report hidden charges** added at the end (tolls, state tax, driver allowance, extra km). Meanwhile, thousands of local tours & travels operators run on phone calls and WhatsApp, with no steady digital demand.

For daily commutes, office and college carpool is growing (BlaBlaCar's biggest market is India; MakeMyTrip bought into Quick Ride), but Paytm has no product there.

## 2. Goals and non-goals

**Goals (first 2 quarters)**
1. Let users book an outstation, hourly or airport/station car **by voice in Hindi/Hinglish**, with an **all-inclusive price** read back before payment.
2. Bring **local tours & travels operators** onto Paytm with a simple operator flow and fast payouts.
3. Offer **last-mile car** right after a train/flight/bus booking.
4. Pilot **office/college carpool** in a state that permits it (Maharashtra: Pune, Mumbai).

**Non-goals**
- Instant city ride-hailing (Bharat Taxi / ONDC partners already cover it inside Paytm).
- Self-drive rentals (insurance and damage handling; revisit later).
- Carpool in states without a legal framework.
- Driver-set carpool prices (cost share is computed, never a profit).

## 3. Users

| Persona | Need |
|---|---|
| **Sunita (family booker)**, from [05](05_personas_and_interview_plan.md) | Station → village car after the train; Hindi; no haggling with the driver |
| **Arjun (price-sensitive regular)** | Weekend trip by SUV with friends; split cost; see the real total |
| **Meera, 26, Pune IT employee** (new) | Office carpool Wakad → Hinjewadi, women-only option, pay by UPI |
| **Rakesh, 41, owns 6 cars, "Shree Balaji Tours & Travels", Nashik** (operator) | Steady bookings, paid on time, simple app in Hindi/Marathi |

## 4. User stories

| # | As a… | I want to… | So that… | Priority |
|---|---|---|---|---|
| U1 | traveller | say my car trip in one sentence | I don't fill 10 fields | P0 |
| U2 | traveller | see only cars that fit my group and luggage | I don't book a Dzire for 6 people | P0 |
| U3 | traveller | hear one all-inclusive price and what's included | nothing extra is asked at drop-off | P0 |
| U4 | traveller | know the extra-km rate and the cancellation fee before paying | I can decide | P0 |
| U5 | train passenger | get offered a car from my arrival station | the last mile is solved | P1 |
| U6 | traveller | report "driver asked for extra money" by voice | Paytm resolves it against the quote | P1 |
| U7 | commuter | set a recurring carpool by voice | I don't search every day | P1 |
| U8 | woman commuter | choose women-only carpool | I feel safe | P0 for carpool |
| U9 | operator | accept a job and see the fare, pickup and payout | I can plan my fleet | P0 |
| U10 | operator | see demand forecasts on my routes | I place cars where demand is | P2 |

## 5. Requirements

### 5.1 Search and quote (`search_cars`)

| ID | Requirement |
|---|---|
| R1 | Trip types: `one_way`, `round_trip` (with return date), `local_hourly` (4h/40km, 8h/80km, 12h/120km), `airport` / station transfer |
| R2 | Car categories with **seats and bag capacity**: Hatchback (4/2), Sedan (4/3), SUV (6/4), Innova-class (7/5), Tempo Traveller (12/8). Hide cars that don't fit travellers or bags |
| R3 | **All-inclusive fare** = base + tolls + state tax + driver allowance + night charge (if any) + GST. The breakdown must add up to the total (enforced in code) |
| R4 | Show included km, extra-km rate, extra-hour rate, and the cancellation rule |
| R5 | One-way pricing must not bill the driver's empty return unless stated as a "return fee" line |
| R6 | Operators shown only if **verified**: permit (AITP or state), vehicle age ≤ 12 years, insurance, driver licence + police verification |
| R7 | Rank by fit → reliability score → price. Never hide the cheapest fitting option |

### 5.2 Booking, payment, cancellation (reuse the existing harness)

| ID | Requirement |
|---|---|
| R8 | Read-back before booking: car type, pickup time and address, total, inclusions, extra-km rate, cancellation fee; user's own "yes" required (`hold_fare` consent gate) |
| R9 | Pay with Paytm UPI; PIN only on the UPI screen; idempotent retry; reconcile "debited, no car" with auto-refund |
| R10 | Cancellation fee by time to pickup; refund quote before confirm |
| R11 | **No cash to driver** for anything in the quote; extra km/hours added only through the app with the customer's approval |

### 5.3 Carpool (`search_carpool`)

| ID | Requirement |
|---|---|
| R12 | Available only in **permitted states**; elsewhere show "not yet available in your state" and capture waitlist interest |
| R13 | Contribution per seat is **computed** from distance × fuel cost ÷ (seats + 1) + toll share. Drivers cannot set a higher price (non-profit rule) |
| R14 | Communities: `office` (verified work email domain), `college` (verified student ID), `public` (KYC'd Paytm users) |
| R15 | `women_only` filter shows only women drivers and co-riders |
| R16 | Live trip sharing and SOS on every carpool and cab trip |

### 5.4 Operator side

| ID | Requirement |
|---|---|
| R17 | Operator onboarding: KYC, permit upload, vehicle list, bank/UPI for payouts; Hindi + regional language |
| R18 | Job card: pickup, drop, time, car type, payout, inclusions (so the driver never asks for extras) |
| R19 | Payout T+1 to operator; Paytm keeps a commission (🧪 to test 10–15%) |
| R20 | Operator can accept/decline in 15 min; auto-reassign on decline |

## 6. Voice design (sample turns)

```
User:  Pune se Mahabaleshwar kal subah 6 baje, 4 log, bags zyada hain
Agent: Kal 6 baje Pune se Mahabaleshwar, 4 log, zyada saamaan. SUV ya Innova theek rahegi.
       Teen gaadiyan: Ertiga ₹4,180, Innova Crysta ₹5,240, Tempo ₹7,900. Sab mila ke —
       toll, state tax, driver allowance shamil. Kaunsi?
User:  Ertiga
Agent: Ertiga, Shree Balaji Tours, kal 6:00 baje aapke ghar se. ₹4,180 sab mila ke,
       130 km tak; uske baad ₹13/km. 24 ghante pehle cancel par ₹200 katega.
       Driver ko cash nahi dena. Book kar doon?
User:  Haan, book kar do
```

## 7. AI architecture (what changes)

Same pipeline as trains/buses. New pieces:
- **NLU slots:** trip_type, pickup_time, return_date, hours, luggage, car_type, community, women_only.
- **MCP tools:** `search_cars`, `search_carpool` (new); `get_fare_rules`, `hold_fare`, `request_upi_payment`, `reconcile_payment`, `quote_refund`, `cancel_booking` (reused).
- **New guardrails in code:** fare breakdown must sum to total; carpool price = computed cost share; carpool blocked outside permitted states; capacity check before showing a car.
- **Grounding:** every ₹ and every "included" claim must come from the tool output.

## 8. Metrics

| Type | Metric | Target (🧪) |
|---|---|---|
| North star | Car trips completed with **final bill = quote** | ≥ 98% |
| Adoption | Last-mile attach rate on train/flight bookings to non-metro towns | 3–5% |
| Conversion | Car quote → booking | +20% vs form flow |
| Voice | Turns to a quote · fallback-to-form rate | ≤ 3 · ≤ 15% |
| Supply | Operator acceptance rate · operator cancellation rate | ≥ 90% · ≤ 3% |
| Trust | Extra-charge complaints / 1k trips | ≤ 2 |
| Carpool | Match rate per live corridor · repeat commuters per week | ≥ 60% · ≥ 3 trips |
| Guardrails | PIN/OTP to model = 0 · ungrounded price = 0 · carpool outside permitted state = 0 | 0 |

## 9. Rollout

| Phase | Scope | Exit gate |
|---|---|---|
| 0 · Supply pilot (weeks 1–6) | 50 verified operators in 3 cities (Pune, Nagpur, Jaipur); outstation + station transfer; text first | ≥ 85% acceptance, final bill = quote ≥ 95% |
| 1 · Voice + last mile (weeks 7–12) | Voice booking; offer after train/flight to those cities; A/B vs form | Attach rate lift, no guardrail breach |
| 2 · Carpool pilot (Q2) | Pune: 5 tech parks, office communities, women-only | ≥ 60% match rate on 3 corridors |
| 3 · Scale | More cities via ONDC mobility + direct operators | Unit economics positive per trip |

## 10. Risks

| Risk | Mitigation |
|---|---|
| Operators ask for cash extras anyway | All-inclusive job card, no-cash rule, dispute by voice, payout hold on proven over-charge |
| Low operator supply in small towns | ONDC / Namma Yatri intercity + direct onboarding; demand heatmap to recruit |
| Carpool legal risk | Permitted states only; non-profit computed price; legal sign-off per state |
| Safety incidents | Verified drivers, live tracking, SOS, women-only option, 24×7 control centre (MV Guidelines 2025) |
| Cannibalising partner city cabs | Focus on outstation/rental/last mile, not instant rides |

## 11. Open questions

1. Build the operator network directly, through ONDC, or both?
2. What commission do small operators accept if payouts are T+1?
3. Which Paytm entry gets the car offer first: train confirmation screen or the assistant?
4. Can carpool verification reuse Paytm KYC + work email without extra friction?
