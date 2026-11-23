# 05 · Proto-personas and user interview plan

> **These are proto-personas**: built from public research and complaints, **not from interviews**. No interview has been run yet. Replace each 🧪 line with real quotes after the interviews below.

## Persona 1 · Sunita, the family booker

| | |
|---|---|
| **Who** | 46, Wardha (Tier-3), homemaker, books trains for the family 4–5 times a year |
| **Language** | Hindi first; reads some English; types slowly in English |
| **Device** | Mid-range Android, Paytm already used for UPI |
| **Job to be done** | "Book the right train for 4 people without asking my son." |
| **Today** 🧪 | Asks son or a local agent; when she books herself she gets stuck at station names and passenger forms |
| **Fears** 🧪 | Paying for the wrong date; money gone without a ticket |
| **What would make her switch** | Speak in Hindi; hear the train, time and total read back; know the refund rule before paying |
| **Success for her** | Booked alone, under 3 minutes, no surprises |
| **Evidence base** | 57% of urban users prefer Indic content, ~1 in 5 use voice (IAMAI-Kantar 2024); 57% of users are rural (IAMAI-Kantar 2025) |

## Persona 2 · Arjun, the price-sensitive regular

| | |
|---|---|
| **Who** | 29, Bengaluru, IT job, travels home to Hubballi monthly and to Goa sometimes |
| **Language** | English + Hinglish/Kannada |
| **Job to be done** | "Cheapest decent option, now, without opening 4 apps." |
| **Today** 🧪 | Checks bus on one app, train on another, flight on a third; books where the total is lowest |
| **Fears** 🧪 | Fees added at checkout; bus cancelled last minute |
| **What would make him switch** | One sentence → cheapest and fastest across bus, train, flight, with the real total |
| **Success for him** | Lowest total found in under 1 minute |
| **Evidence base** | 60% say convenience fee not shown upfront (LocalCircles); same inventory sold by many apps |

## Persona 3 · Rahul, the anxious payer (a moment, not a segment)

| | |
|---|---|
| **Who** | Any user right after a failed or pending payment, often in a Tatkal or festival rush |
| **Job to be done** | "Tell me if my money is gone and if I have a ticket. Right now." |
| **Today** 🧪 | Refreshes the app, checks bank SMS, retries and fears being charged twice, then calls support |
| **What would help** | An honest, instant answer: what happened, money status, ticket status, refund date |
| **Success for him** | Knows the state in under 10 seconds; no support call |
| **Evidence base** | "Money deducted, no ticket" complaints (Upstox, Zee News, ConsumerComplaints.in); UPI outages in 2025 |

## Interview plan (to run in week 1–3)

**Goal:** confirm or kill three hypotheses.
- H1: Hindi-first users drop at search/forms, and would use voice to book.
- H2: Users compare total price across apps, and late fees cause them to leave.
- H3: After a payment failure, not knowing the state hurts more than the failure itself.

**Who (15 people):** 6 Hindi-first Tier-2/3 train bookers (Sunita), 5 metro price-sensitive multi-mode travellers (Arjun), 4 users who had a failed travel payment in the last 3 months (Rahul). Recruit through Paytm in-app survey or a recruiter; pay an incentive.

**Format:** 30 minutes, in Hindi or English, remote or in person. Ask them to *show* their last booking on their own phone.

**Script**

1. Tell me about the last train or bus you booked. Who was it for? Where did you book it? *(Show me.)*
2. What did you check before you picked that option? Did you look at any other app?
3. Was there any point where you nearly gave up? What happened?
4. Was the amount you paid what you expected when you started? *(Probe fees.)*
5. Have you ever had a payment fail or money deducted without a ticket? What did you do next? How long until you knew what happened?
6. Have you cancelled a booking recently? Did you know how much you'd get back before you cancelled?
7. Do you use voice search or voice notes on your phone? For what?
8. *(Show prototype)* Try: "Mumbai se Nagpur agle Friday, 2 log, train." Think aloud. What would stop you paying here?
9. If this were in Paytm, would you use it instead of the usual screens? Why or why not?

**Synthesis:** tag each note by journey stage and taxonomy code (P1–P10, C1–C10); count how many people hit each pain; pull 2–3 verbatim quotes per hypothesis; update personas and the RICE scores in [06](06_opportunities_rice_mvp.md).

**Kill criteria:** if fewer than 4 of 6 Hindi-first users say they'd prefer voice over the form *after trying it*, drop voice-first and ship E1/E2/E5/E6 (non-voice) instead.
