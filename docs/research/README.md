# APM research pack: voice booking for Paytm Travel (bus, train, flight)

This folder holds the research behind the case study and prototype. It follows one rule: **research four areas, find how they connect, then build one product for one validated problem.**

> **Honesty labels used throughout**
> - 🇮🇳 **India**: the finding is about Indian users or the Indian market.
> - 🌍 **Global**: the finding is from another market. Use it only as a direction, never as a Paytm number.
> - 🧪 **Assumption**: my hypothesis. It needs Paytm data or user interviews before anyone acts on it.
> - No internal Paytm data and no interview results are invented here. Where real data is missing, the gap is named.

## Contents

| # | Deliverable | File |
|---|---|---|
| 1 | Market research report (four areas, with sources) | [01_market_research.md](01_market_research.md) |
| 2 | Competitor analysis | [02_competitor_analysis.md](02_competitor_analysis.md) and the `Competitors` sheet in the spreadsheet |
| 3 | Customer journey map, booking funnel, experiment backlog | [03_journey_and_funnel.md](03_journey_and_funnel.md) |
| 4 | Payment failure and cancellation taxonomy, refund journey | [04_payment_cancellation_taxonomy.md](04_payment_cancellation_taxonomy.md) |
| 5 | Proto-personas and user interview plan | [05_personas_and_interview_plan.md](05_personas_and_interview_plan.md) |
| 6 | AI opportunity matrix, RICE prioritisation, MVP recommendation | [06_opportunities_rice_mvp.md](06_opportunities_rice_mvp.md) |
| 7 | Master research spreadsheet (all of the above in one workbook) | [research_master.xlsx](research_master.xlsx) |
| 8 | Low-fidelity wireframes (Figma-ready) | [wireframes/index.html](wireframes/index.html) |
| 9 | Final case study presentation | [presentation/index.html](presentation/index.html) |

Open the HTML files in a browser. The presentation uses the arrow keys.

## The one-line answer

The four areas point to the same moment: **a user who knows the trip they want, but loses it between "compare" and "ticket in hand"**, because of form friction, hidden total price, payment failure, or refund uncertainty. The MVP is a voice booking assistant that takes the trip in one sentence, shows the real total and refund rule before payment, and owns failed payments through to a ticket or refund. See [06](06_opportunities_rice_mvp.md).

## Where this research is weak (read before the interview)

1. **No Paytm funnel data.** Every drop-off rate for Paytm is an assumption to check against Paytm's analytics on day one.
2. **No real interviews yet.** [05](05_personas_and_interview_plan.md) gives the plan and script, not results.
3. **Market-size numbers disagree** by more than 2× because reports define "online travel" differently. I quote ranges, not one number.
4. **Paytm Checkin already exists** (Nov 2025, AI-first travel app with conversational booking). This pack positions the work as *what I would test and improve inside Checkin*, not as a new app.
