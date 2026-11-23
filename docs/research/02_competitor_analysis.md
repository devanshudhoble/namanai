# 02 · Competitor analysis

Public information only, Nov 2026. Feature claims are what each company announced; I have not verified them hands-on unless the "Checked" column says so. Company-reported numbers are marked as such.

## Feature comparison

| Capability | Paytm Checkin | MakeMyTrip (Myra) | ixigo (TARA) | redBus (RAY) | Google Travel | Booking.com | Expedia (Romie) | **This prototype** |
|---|---|---|---|---|---|---|---|---|
| Modes | Flight, train, bus, metro | Flight, train, bus, hotel, holidays | Train, flight, bus, hotel | Bus, train (redRail) | Flight, hotel | Hotel, flight, car | Flight, hotel, car, activities | Flight, train, bus |
| Conversational booking | Yes (AI early beta at launch) | Yes, query → booking in one chat | Yes, "agentic flows" | Yes (RAY) | Building agentic booking | Planner, not full booking | Yes | Yes |
| **Voice** | Speak or type (reported) | Yes; Myra 2.0 full voice booking + barge-in | Yes, voice-native | Yes | Via Google Assistant / Gemini | No (reported) | Limited | Yes, browser speech + Sarvam TTS |
| **Hindi / Hinglish** | "Multilingual" (Hindi not confirmed) | Hindi + English beta → 8 languages | English, Hindi, Hinglish | Hindi (WhatsApp bot) | Many languages | English markets | English-first | Hinglish one-sentence |
| Compares modes in one answer | Unknown | Unknown | Unknown | No (bus-first) | No | No | No | **Yes** (cheapest / fastest across modes) |
| Total price + refund rule before pay | Claims "transparent pricing" | Unknown | Unknown | Unknown | Shows total | Shows total | Shows total | **Yes, read-back required** |
| Payment failure recovery in chat | Unknown | Unknown | AI support resolves calls | Unknown | n/a | n/a | n/a | **Yes**: retry, reconcile, auto-refund |
| Cancellation product | ₹99 flight cancel, Ticket Assure, Paytm Assured, Travel Pass | Zero-cancellation add-ons | Assured/free-cancel add-ons | Free-cancel add-ons | n/a | Free-cancel filter | Flexible bookings | Refund quote before cancel |
| Post-booking support AI | Unknown | Yes | **76% of voice calls resolved by AI** (company-reported) | WhatsApp support bot | n/a | Support assistant | In-trip help | Reconciliation + refund |
| Own payments rail | **Yes (Paytm UPI)** | No | No | No | No | No | No | Sandbox UPI |

## Sources

- Paytm Checkin: [Skift](https://skift.com/2025/11/10/indian-fintech-paytm-pushes-deeper-into-travel-with-new-ai-backed-app/), [Business Standard](https://www.business-standard.com/companies/news/paytm-launches-ai-powered-travel-app-paytm-checkin-125110601924_1.html), [Paytm blog](https://paytm.com/blog/travel/paytm-bets-on-ai-in-travel-launches-dedicated-ai-travel-booking-app-paytm-checkin)
- MakeMyTrip Myra: [BusinessWire](https://www.businesswire.com/news/home/20250806170695/en), [India TV (Myra 2.0)](https://www.indiatvnews.com/technology/news/makemytrip-myra-2-0-ai-asssistant-to-help-completing-travel-bookings-through-voice-conversations-2026-05-14-1041087)
- ixigo TARA: [Skift](https://skift.com/2026/05/24/india-is-where-the-voice-first-travel-app-gets-built/), [PhocusWire](https://www.phocuswire.com/news/technology/ixigo-launches-travel-app-conversational-booking-agentic-ai)
- redBus: [Analytics India Magazine](https://analyticsindiamag.com/ai-trends/redbus-builds-multilingual-ai-copilots-for-bus-operators-travellers), [Motor India](https://www.motorindiaonline.in/redbus-supports-operator-growth-through-ai-powered-solutions-and-data-intelligence/)
- Google: [Skift](https://skift.com/2025/11/17/google-is-building-agentic-travel-booking-plus-other-travel-ai-updates/)
- Booking.com: [USA Today via Yahoo](https://ca.news.yahoo.com/ai-trip-planning-tool-best-134756743.html)
- Expedia: [Expedia newsroom](https://www.expedia.com/newsroom/spring-product-release-2024), [TechCrunch](https://techcrunch.com/2024/05/14/expedia-starts-testing-ai-powered-features-for-search-and-travel-planning)
- Vernost: [AWS case study](https://aws.amazon.com/solutions/case-studies/vernost-case-study/)

## What this tells us

1. **Voice booking alone is no longer a differentiator.** MakeMyTrip and ixigo both ship it in Hindi. A Paytm pitch built on "we added voice" loses.
2. **Paytm's unique asset is the payment rail.** Only Paytm owns UPI, the wallet and the bank relationship. So Paytm can do something the others can't do as well: **know the real payment state instantly and fix it in the same conversation** ("₹1,240 debited at 10:02, seat not issued, refund started, back by tomorrow").
3. **Nobody publicly claims cross-mode comparison in one answer.** "Bus is ₹600 cheaper and 1 hour slower" is a gap worth testing for price-sensitive users.
4. **Grounding is a trust feature.** Hidden fees are the #1 Indian complaint. An assistant that *cannot* say a price that isn't in tool output, and always says the total, turns safety engineering into a marketing message.

## Positioning (for the interview)

> **Inside Paytm Checkin, for Hindi-first train and bus bookers: say the trip once, hear the real total and refund rule, and never be left wondering where your money went.**
> Unlike other assistants that stop at the booking, it owns the payment until there is a ticket or a refund, because Paytm owns the payment.

## Hands-on teardown still to do (before a real interview)

- [ ] Book the same Mumbai → Nagpur train on Paytm Checkin, MakeMyTrip, ixigo, IRCTC Rail Connect. Count taps, screens, fields, time, and the total paid.
- [ ] Try the same request by voice in Hinglish on each assistant. Note what it understood and where it fell back to forms.
- [ ] Trigger a payment cancel mid-flow and screenshot the recovery message on each.
