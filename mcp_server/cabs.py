"""
Paytm Travel Cabs (sandbox): the case study's MCP tool contract.

    search_rides · recommend · compare · get_quote · confirm · track_flight
    + report_flight_delay · report_no_show (failure handling from the PRD acceptance criteria)

Rules enforced here, in code:
  - No quote id, no fare: every fare is a quote this engine issued; confirm() only accepts a live quote id.
  - Charge = quote: the all-in lines must add up to the quoted total.
  - Consent: confirm() needs the rider's own confirming words (shared consent gate).
  - City rules engine: paid carpool in private cars only where the state allows it.
  - Late-night women riders: only verified, top-rated women drivers.
Bookings reuse TravelEngine orders, so UPI, reconciliation, refunds and cancellation work unchanged.
All providers, fares, flights and reliability numbers are SANDBOX / illustrative.
"""
from __future__ import annotations

import hashlib
from dataclasses import dataclass

from .travel_core import HarnessViolation, Option, TravelEngine, guard_text, parse_travel_date, _check_breakdown

WEIGHTS = {"price": 0.30, "fit": 0.25, "reliability": 0.25, "rating": 0.20}


@dataclass(frozen=True)
class Provider:
    key: str
    name: str
    on_time_pct: int
    cancel_pct: float
    rating: float
    women_drivers: bool
    knows_ghats: bool


PROVIDERS = [
    Provider("sai", "Sai Cabs", 97, 1.2, 4.7, False, True),
    Provider("kaveri", "Kaveri Cabs", 92, 3.8, 4.4, False, False),
    Provider("gardencity", "Garden City Travels", 95, 2.1, 4.6, True, True),
    Provider("nammametro", "Namma Metro Rentals", 94, 2.6, 4.5, True, False),
    Provider("airporttaxi", "Airport Taxi (licensed)", 96, 1.5, 4.5, True, False),
]
PROV = {p.key: p for p in PROVIDERS}
CARS = {  # label, seats, bags, extra-km rate
    "sedan": ("Sedan", 4, 3, 13), "suv": ("SUV", 6, 4, 15), "innova": ("Innova Crysta", 7, 5, 18),
}
FLIGHTS = {  # booked on Paytm (sandbox)
    "6E2134": {"number": "6E 2134", "kind": "arrival", "time": "23:40", "route": "Delhi → Bengaluru", "terminal": "Kempegowda Airport, T1"},
    "6E512": {"number": "6E 512", "kind": "departure", "time": "08:45", "route": "Bengaluru → Delhi", "terminal": "Kempegowda Airport, T1"},
}
TRIP_KM = {"coorg": (265, "Karnataka"), "mysuru": (145, "Karnataka"), "ooty": (270, "Tamil Nadu"),
           "wayanad": (280, "Kerala"), "chikmagalur": (245, "Karnataka"), "puducherry": (310, "Puducherry")}
CITY_RULES = {
    "pune": (True, "Maharashtra allows app-based, non-profit cost-shared carpool."),
    "mumbai": (True, "Maharashtra allows app-based, non-profit cost-shared carpool."),
    "bengaluru": (False, "Karnataka has fined private (white-plate) cars used for paid rides; only seats in licensed cabs."),
}


def _clock_add(hhmm: str, mins: int) -> str:
    h, m = map(int, hhmm.split(":"))
    t = (h * 60 + m + mins) % 1440
    return f"{t // 60:02d}:{t % 60:02d}"


class CabsService:
    def __init__(self, engine: TravelEngine):
        self.engine = engine
        self.delays: dict[str, int] = {}

    # ---------------------------------------------------------------- flights
    def track_flight(self, flight_number: str) -> dict:
        guard_text(flight_number)
        key = flight_number.replace(" ", "").replace("-", "").upper()
        f = FLIGHTS.get(key)
        if not f:
            raise ValueError(f"No Paytm booking found for flight {flight_number}.")
        delay = self.delays.get(key, 0)
        return {**f, "delay_minutes": delay, "status": f"delayed {delay} min" if delay >= 15 else "on time",
                "actual_time": _clock_add(f["time"], delay)}

    # ---------------------------------------------------------------- quotes
    def _quote(self, product: str, p: Provider, car: str, lines: dict[str, int], pickup: str, drop: str,
               date: str, time: str, pax: int, extras: dict) -> Option:
        label, seats, bags, xkm = CARS[car]
        lines = {k: v for k, v in lines.items() if v}
        lines["total"] = sum(lines.values())
        _check_breakdown(lines)
        qid = "QT" + hashlib.sha256(f"{product}|{p.key}|{car}|{date}|{time}|{drop}|{pax}".encode()).hexdigest()[:8].upper()
        opt = Option(
            option_id=qid, mode="cab", operator=p.name, service=f"{label}", travel_class=label,
            origin=pickup, origin_point=pickup, destination=drop, destination_point=drop, date=date,
            departs=time, arrives=time, duration_minutes=extras.get("ride_minutes", 60),
            fare_per_traveller=lines["total"], convenience_fee=0, travellers=pax, total_fare=lines["total"],
            seats_left=1 + p.on_time_pct % 3, baggage=f"{seats} seats · {bags} bags",
            cancellation_fee_before_24h=0, cancellation_fee_within_24h=lines["total"] // 4,
            refund_rule="Paytm Assured: backup cab or refund; flight delays never cost you",
            priced_per="vehicle",
            extras={"product": product, "price_breakdown": lines, "seats": seats, "bags": bags, "km_included": extras.get("km", 0),
                    "extra_km_rate": xkm, "provider": p.key, "on_time_pct": p.on_time_pct, "cancel_pct": p.cancel_pct,
                    "rating": p.rating, "women_driver": p.women_drivers, "no_cash_to_driver": True, **extras},
        )
        self.engine.options[qid] = opt
        return opt

    def search_rides(self, product: str, pickup_date: str, travellers: int = 1, flight_number: str | None = None,
                     hours: int | None = None, planned_km: int | None = None, destination: str | None = None,
                     days: int = 1, bags: int | None = None, from_area: str | None = None, to_area: str | None = None,
                     city: str = "Bengaluru", women_only: bool = False) -> dict:
        guard_text(product, pickup_date, flight_number, destination, from_area, to_area, city)
        if product not in ("airport", "rental", "trip", "share"):
            raise ValueError("product must be airport, rental, trip or share.")
        if not 1 <= travellers <= 12:
            raise ValueError("Travellers must be between 1 and 12.")
        day = parse_travel_date(pickup_date, self.engine.today).isoformat()
        bags = travellers if bags is None else bags
        quotes: list[Option] = []
        notes: list[str] = []
        if product == "airport":
            if not flight_number:
                raise ValueError("Airport cabs are linked to a flight: pass the flight_number from the Paytm booking.")
            f = self.track_flight(flight_number)
            pickup = f["kind"] == "arrival"
            time = _clock_add(f["actual_time"], 20) if pickup else _clock_add(f["time"], -150)
            night = pickup and (int(time[:2]) >= 22 or int(time[:2]) < 6)
            base = 1000 if pickup else 950
            where = (f"{f['terminal']} · Pillar 7", "Home, HSR Layout") if pickup else ("Home, HSR Layout", f["terminal"])
            for pk, car, add in (("airporttaxi", "sedan", 0), ("sai", "suv", 250)):
                quotes.append(self._quote("airport", PROV[pk], car, {"base_fare": base + add, "airport_toll_parking": 100,
                                          "night_charge": (50 if car == "sedan" else 100) if night else 0},
                                          *where, day, time, travellers, {"flight": f["number"], "km": 38, "ride_minutes": 45}))
            notes.append(f"{f['number']} {f['status']}; the pickup follows the real landing time.")
        elif product == "rental":
            hours = hours or 8
            if hours not in (4, 8, 12):
                raise ValueError("Rentals are 4, 8 or 12 hours.")
            inc = hours * 10
            extra = max(0, (planned_km or inc) - inc)
            for pk, car, base in (("kaveri", "suv", 2500), ("nammametro", "suv", 2740), ("sai", "innova", 2900), ("gardencity", "innova", 3500)):
                rate = CARS[car][3]
                quotes.append(self._quote("rental", PROV[pk], car, {"base_fare": base * hours // 8, "extra_km": extra * rate, "tolls_parking": 75},
                                          "Home, HSR Layout", f"{city} · {hours} h / {inc} km", day, "09:00", travellers,
                                          {"km": inc, "planned_km": planned_km or inc, "hours": hours}))
        elif product == "trip":
            if not destination:
                raise ValueError("Tell me the destination for the trip.")
            km, state = TRIP_KM.get(destination.strip().lower(), (180, "Karnataka"))
            total_km = max(2 * km + 40 * (days - 1), 250 * days) if days > 1 else km
            permit = 400 + 100 * days if state != "Karnataka" else 0
            if permit:
                notes.append(f"{state} permit added upfront.")
            for pk, car, rate in (("kaveri", "innova", 10.2), ("sai", "innova", 11.0), ("nammametro", "suv", 10.5), ("kaveri", "sedan", 9.5)):
                quotes.append(self._quote("trip", PROV[pk], car, {"base_fare": int(total_km * rate), "driver_allowance": 400 * days,
                                          "tolls": (km // 60) * 85 * (2 if days > 1 else 1), "state_permit": permit},
                                          "Your address", destination.title(), day, "06:00", travellers, {"km": total_km, "days": days}))
        else:  # share
            area_city = (city or "Bengaluru").strip().lower()
            allowed, rule = CITY_RULES.get(area_city, (False, "No carpool framework found for this state."))
            notes.append(rule)
            q = self._quote("share", PROV["airporttaxi"], "suv", {"base_fare": 180 * travellers},
                            f"{from_area or 'Pickup'}, {city}", f"{to_area or 'Drop'}, {city}", day, "08:50", travellers,
                            {"km": 14, "shared": True, "licensed_cab": True})
            q.mode = "carpool"
            quotes.append(q)
            if allowed:
                share_amt = -(-14 * 7 // 4) * travellers
                c = self._quote("share", PROV["gardencity"], "sedan", {"base_fare": share_amt},
                                f"{from_area}, {city}", f"{to_area}, {city}", day, "08:45", travellers,
                                {"km": 14, "shared": True, "colleague_carpool": True, "max_share_allowed": share_amt // travellers})
                c.mode = "carpool"
                quotes.append(c)
        ranked = self.recommend([q.option_id for q in quotes], travellers, bags, women_only=women_only)
        return {"product": product, "date": day, "quotes": ranked["ranked"], "notes": notes,
                "data": "SANDBOX: providers, fares and reliability are illustrative"}

    # ---------------------------------------------------------------- AI ranking
    def recommend(self, quote_ids: list[str], travellers: int, bags: int, budget: int | None = None,
                  elderly: bool = False, women_only: bool = False, ghats: bool = False) -> dict:
        opts = [self._live(q) for q in quote_ids]
        if women_only:
            opts = [o for o in opts if o.extras["women_driver"] and o.extras["rating"] >= 4.5]
        if not opts:
            return {"ranked": [], "weights": WEIGHTS}
        lo, hi = min(o.total_fare for o in opts), max(o.total_fare for o in opts)
        out = []
        for o in opts:
            x = o.extras
            fits = x["seats"] >= travellers and x["bags"] >= bags
            price = 1.0 if hi == lo else 1 - (o.total_fare - lo) / (hi - lo)
            over_budget = bool(budget and o.total_fare > budget)
            if over_budget:
                price = 0.0
            reliability = max(0.0, (x["on_time_pct"] - 85) / 15 - x["cancel_pct"] / 20)
            rating = (x["rating"] - 4) + (0.15 if elderly and x["seats"] >= 7 else 0) + (0.1 if ghats and PROV[x["provider"]].knows_ghats else 0)
            score = (WEIGHTS["price"] * price + WEIGHTS["fit"] * (1 if fits else 0)
                     + WEIGHTS["reliability"] * reliability + WEIGHTS["rating"] * min(1.2, max(0.0, rating))
                     - (0.15 if over_budget else 0))
            why = (["Under budget" if o.total_fare <= budget else "Over budget"] if budget else []) + \
                  [f"Fits {travellers} + {bags} bags" if fits else f"Too small for {travellers} + {bags} bags",
                   f"{x['on_time_pct']}% on time", f"{x['rating']}★"]
            out.append({**o.summary(), "quote_id": o.option_id, "score": round(score * 100), "why": why})
        out.sort(key=lambda r: -r["score"])
        return {"ranked": out, "weights": WEIGHTS}

    def compare(self, quote_ids: list[str]) -> dict:
        rows = []
        for q in quote_ids:
            o = self._live(q)
            b = o.extras["price_breakdown"]
            rows.append({"quote_id": q, "provider": o.operator, "car": o.travel_class, "base": b.get("base_fare", 0),
                         "all_in": o.total_fare, "on_time_pct": o.extras["on_time_pct"], "rating": o.extras["rating"]})
        if rows:
            min(rows, key=lambda r: r["all_in"])["tag"] = "Best value"
            max(rows, key=lambda r: r["on_time_pct"])["tag"] = "Most reliable"
        return {"rows": rows}

    def get_quote(self, quote_id: str) -> dict:
        o = self._live(quote_id)
        return {"quote_id": quote_id, "provider": o.operator, "car": o.travel_class, "all_in": o.total_fare,
                "price_breakdown": o.extras["price_breakdown"], "km_included": o.extras["km_included"],
                "extra_km_rate": o.extras["extra_km_rate"], "no_cash_to_driver": True, "refund_rule": o.refund_rule}

    def confirm(self, quote_id: str, rider_name: str, customer_confirmed: bool, confirmation_text: str) -> dict:
        o = self._live(quote_id)
        if o.extras.get("colleague_carpool") and o.fare_per_traveller > o.extras.get("max_share_allowed", 0):
            raise HarnessViolation("Blocked: carpool price is above the non-profit cost share.")
        return self.engine.hold(quote_id, rider_name, customer_confirmed, confirmation_text)

    def _live(self, quote_id: str) -> Option:
        guard_text(quote_id)
        o = self.engine.options.get(quote_id)
        if not o or o.mode not in ("cab", "carpool") or "provider" not in o.extras:
            raise HarnessViolation(f"No quote id, no fare: '{quote_id}' is not a live cab quote. Call search_rides first.")
        return o

    # ---------------------------------------------------------------- failures (PRD acceptance criteria)
    def report_flight_delay(self, order_id: str, flight_number: str, delay_minutes: int) -> dict:
        od = self.engine._order(order_id)
        key = flight_number.replace(" ", "").upper()
        self.delays[key] = delay_minutes
        f = self.track_flight(flight_number)
        moved = delay_minutes >= 15 and f["kind"] == "arrival"
        if moved:
            od.option.departs = _clock_add(f["actual_time"], 20)
        self.engine._log(od, f"{f['number']} {f['status']}: pickup {'moved to ' + od.option.departs if moved else 'unchanged'}, no charge")
        return {"order_id": order_id, "flight": f, "pickup": od.option.departs, "pickup_moved": moved, "extra_charge": 0,
                "amount": od.option.total_fare}

    def report_no_show(self, order_id: str) -> dict:
        od = self.engine._order(order_id)
        current = od.option.extras.get("provider")
        backup = sorted((p for p in PROVIDERS if p.key not in (current, "airporttaxi")), key=lambda p: -p.on_time_pct)[0]
        od.option.operator = f"{backup.name} (backup)"
        self.engine._log(od, f"Driver no-show: backup from {backup.name} in 5 min, same fare")
        return {"order_id": order_id, "backup_provider": backup.name, "eta_minutes": 5, "amount": od.option.total_fare,
                "if_backup_fails": "full refund plus travel credit"}
