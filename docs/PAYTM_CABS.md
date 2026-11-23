# Paytm Travel Cabs: from case study to working prototype

Branch `feat/paytm-cabs-airport-rentals-share`. Built from the 30-page case study *"Paytm Travel Cabs: Airport, Rentals, Trips and Shared Rides"*. Everything from earlier branches (voice agent, context engineering harness, UPI and payment-failure lab, MCP server, research pack, cars and carpool) is unchanged; cab requests are routed into the new Cabs engine.

> Sandbox: providers (Sai Cabs, Kaveri Cabs, Garden City Travels, Namma Metro Rentals, Airport Taxi), fares, flights, on-time rates and charts are **illustrative**, as in the case study. Real partners (Savaari- and CabBazar-type platforms, ONDC/Namma Yatri, BIAL kerbside) would plug in behind the same tools.

## What the deck asked for → where it is built

| Case study | Built | Where |
|---|---|---|
| Cabs tab: Airport · Rentals · Trips · Share, "Paytm Assured" | Cabs tab with 4 sub-tabs and voice prompts | `src/components/CabsTab.tsx` |
| Flow 1: flight-linked airport pickup, fixed fare (₹1,150 sedan / ₹1,450 SUV at night), driver at Pillar 7 | `airport()` uses the Paytm flight (6E 2134 / 6E 512), night charge, pillar, masked numbers | `src/services/cabsEngine.ts`, `mcp_server/cabs.py` |
| "Kal subah 6 baje airport ke liye cab chahiye" → flight status + fixed fare + read-back | Drop quote with "leave by" time (traffic model) and the rider's flight status | same |
| Flight late 15+ min → pickup moves, no charge | "Meri flight 45 min late hai" or `report_flight_delay` | orchestrator `cabFlightDelay`, MCP |
| Driver no-show → backup in 5 min or refund + credit | "Driver nahi aaya" or `report_no_show`: next most reliable company, same fare | orchestrator `cabNoShow`, MCP |
| Flow 2: 8 h / 80 km rental, compare local companies, all-in | 4/8/12 h, base vs AI all-in (extra km + tolls/parking for your planned km), on-time %, tags, filters (cheapest, reliable, fits, women driver, EV) | `rentals()`, `CabsInsights.tsx` |
| Flow 3: Coorg, 5 people, Amma too, ₹10,000 → AI picks Innova | Recommender: price vs budget 30 %, fit 25 %, reliability 25 %, rating/safety 20 %, with a "why" per pick; 2-sedan split ranks lower | `rankOptions()`, `recommend` |
| State permit surprise (Wayanad) | Kerala / Tamil Nadu permit added upfront as a fare line | `trips()` |
| Paytm Share: seats in licensed cabs, empty returns, colleague carpool where rules allow | City rules engine: Karnataka blocks private paid carpool → licensed seats + empty-return leg; Pune/Mumbai allow a no-profit fuel share | `share()`, `CITY_RULES` |
| AI analytics for riders | True-cost breakdown, reliability, no-show risk, best day to book, "book now", wait-time | `CabsInsights.tsx` |
| AI insights for operators | Paytm flyers landing at KIA by hour → "keep 8 cars near Yelahanka" | `OPERATOR_DEMAND`, `operatorAdvice()` |
| MCP tool contract: search_rides · recommend · compare · get_quote · confirm · track_flight | All six, plus `report_flight_delay`, `report_no_show` | `mcp_server/server.py` |
| Guardrails: no quote ID no fare · pay only after tap/PIN · city rules · late-night women riders verified · masked numbers | Enforced in code in both engines | `cabsEngine.ts`, `cabs.py`, orchestrator |
| PRD acceptance criteria as eval cases | Airport pickup, fixed fare, no-show, voice consent | `src/__tests__/cabs.test.ts`, `mcp_server/tests/test_paytm_cabs.py` |

## Voice flow (same agent, new tools)

```
"6E 2134 se aa rahi hoon, airport se ghar cab chahiye"
  -> parseCabRequest: airport · pickup · flight 6E 2134
  -> track_flight + search_rides -> AI rank
Agent: "Your flight 6E 2134 lands 11:40 PM (on time). The cab waits at Pillar 7 ... Fixed fare ₹1,150 ... Book it?"
"pehla wala" -> read-back: all-inclusive lines, nothing extra to the driver, Paytm Assured
"haan, book karo" -> name -> fare hold -> Paytm UPI (PIN on UPI screen) -> driver details, masked
"Meri flight 45 min late hai" -> pickup moved to 12:45 AM, no charge
"Driver nahi aaya" -> backup from Sai Cabs in 5 min, same fare
```

## Demo script (2 minutes)

1. **Cabs tab → Airport →** "6E 2134 se aa rahi hoon…" → pick → "haan" → name → Approve.
2. Tap **"Meri flight 45 min late hai"**, then **"Driver nahi aaya abhi tak"**.
3. **Rentals →** "Kal 8 ghante ke liye gaadi chahiye, 95 km, 5 log" → show compare table, filters, true cost.
4. **Trips →** "Bangalore se Coorg 3 din, 5 log, Amma bhi, 4 bags, budget 10000" → AI pick and "why".
5. **Share →** "Kal HSR se Whitefield office carpool" → city rules engine explains why only licensed seats.

## Tests

- Web: 38 (14 new for cabs). Python: 47 (12 new for the cabs MCP contract).
