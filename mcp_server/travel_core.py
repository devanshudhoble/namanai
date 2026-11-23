"""
Sandbox travel booking engine behind the MCP server.

Pure Python, no MCP imports, so it can be unit-tested and later swapped for real
Paytm / IRCTC / airline / bus-operator APIs without touching the MCP layer.

Harness rules enforced HERE (not in the prompt), so every MCP client gets them:
  1. Credential guard   - UPI PIN / OTP / CVV / card numbers are rejected in any argument.
  2. Consent gate       - hold_fare and cancel_booking require explicit customer confirmation.
  3. Server-side money  - every amount comes from this engine; clients never pass prices in.
  4. Idempotency        - the same option + passenger returns the same hold; retries reuse the order id.
  5. Deterministic data - the same search returns the same options, so ids stay valid across turns.

All inventory, fares, PNRs and payments are SANDBOX. No money moves.
"""

from __future__ import annotations

import hashlib
import re
import time
from dataclasses import dataclass, field, asdict
from datetime import date, datetime, timedelta
from typing import Literal

Mode = Literal["flight", "train", "bus", "cab", "carpool"]

# ---------------------------------------------------------------------------
# Locations: any Indian city, town or village works.
# Known hubs get real airport / station / bus-stand names; anything else gets
# generated sandbox train and bus options, and flights only via a nearby airport.
# ---------------------------------------------------------------------------

ALIASES = {
    "bombay": "mumbai", "bangalore": "bengaluru", "bengalore": "bengaluru", "calcutta": "kolkata",
    "madras": "chennai", "cochin": "kochi", "banaras": "varanasi", "kashi": "varanasi",
    "baroda": "vadodara", "poona": "pune", "trivandrum": "thiruvananthapuram", "vizag": "visakhapatnam",
    "mysore": "mysuru", "allahabad": "prayagraj", "gurgaon": "gurugram", "simla": "shimla",
    "dilli": "delhi", "new delhi": "delhi", "jodpur": "jodhpur", "pondicherry": "puducherry",
    "amritser": "amritsar", "mangalore": "mangaluru", "belgaum": "belagavi", "calicut": "kozhikode",
}

# city: (IATA or None, airport name or None, station code, station name)
HUBS: dict[str, tuple[str | None, str | None, str, str]] = {
    "mumbai": ("BOM", "Chhatrapati Shivaji Maharaj Intl", "CSMT", "Mumbai CSMT"),
    "delhi": ("DEL", "Indira Gandhi Intl", "NDLS", "New Delhi"),
    "bengaluru": ("BLR", "Kempegowda Intl", "SBC", "KSR Bengaluru City"),
    "chennai": ("MAA", "Chennai Intl", "MAS", "Chennai Central"),
    "kolkata": ("CCU", "Netaji Subhas Chandra Bose Intl", "HWH", "Howrah Jn"),
    "hyderabad": ("HYD", "Rajiv Gandhi Intl", "SC", "Secunderabad Jn"),
    "pune": ("PNQ", "Pune Airport", "PUNE", "Pune Jn"),
    "ahmedabad": ("AMD", "Sardar Vallabhbhai Patel Intl", "ADI", "Ahmedabad Jn"),
    "jaipur": ("JAI", "Jaipur Intl", "JP", "Jaipur Jn"),
    "lucknow": ("LKO", "Chaudhary Charan Singh Intl", "LKO", "Lucknow Charbagh"),
    "nagpur": ("NAG", "Dr. Babasaheb Ambedkar Intl", "NGP", "Nagpur Jn"),
    "goa": ("GOX", "Manohar Intl (Mopa)", "MAO", "Madgaon Jn"),
    "kochi": ("COK", "Cochin Intl", "ERS", "Ernakulam Jn"),
    "chandigarh": ("IXC", "Chandigarh Intl", "CDG", "Chandigarh"),
    "varanasi": ("VNS", "Lal Bahadur Shastri Intl", "BSB", "Varanasi Jn"),
    "patna": ("PAT", "Jay Prakash Narayan Airport", "PNBE", "Patna Jn"),
    "bhopal": ("BHO", "Raja Bhoj Airport", "BPL", "Bhopal Jn"),
    "indore": ("IDR", "Devi Ahilyabai Holkar Airport", "INDB", "Indore Jn"),
    "jodhpur": ("JDH", "Jodhpur Airport", "JU", "Jodhpur Jn"),
    "udaipur": ("UDR", "Maharana Pratap Airport", "UDZ", "Udaipur City"),
    "amritsar": ("ATQ", "Sri Guru Ram Dass Jee Intl", "ASR", "Amritsar Jn"),
    "guwahati": ("GAU", "Lokpriya Gopinath Bordoloi Intl", "GHY", "Guwahati"),
    "bhubaneswar": ("BBI", "Biju Patnaik Intl", "BBS", "Bhubaneswar"),
    "raipur": ("RPR", "Swami Vivekananda Airport", "R", "Raipur Jn"),
    "ranchi": ("IXR", "Birsa Munda Airport", "RNC", "Ranchi"),
    "surat": ("STV", "Surat Airport", "ST", "Surat"),
    "vadodara": ("BDQ", "Vadodara Airport", "BRC", "Vadodara Jn"),
    "coimbatore": ("CJB", "Coimbatore Intl", "CBE", "Coimbatore Jn"),
    "madurai": ("IXM", "Madurai Airport", "MDU", "Madurai Jn"),
    "thiruvananthapuram": ("TRV", "Thiruvananthapuram Intl", "TVC", "Thiruvananthapuram Central"),
    "visakhapatnam": ("VTZ", "Visakhapatnam Airport", "VSKP", "Visakhapatnam Jn"),
    "vijayawada": ("VGA", "Vijayawada Airport", "BZA", "Vijayawada Jn"),
    "dehradun": ("DED", "Jolly Grant Airport", "DDN", "Dehradun"),
    "srinagar": ("SXR", "Srinagar Intl", "SINA", "Srinagar"),
    "jammu": ("IXJ", "Jammu Airport", "JAT", "Jammu Tawi"),
    "agra": ("AGR", "Agra Airport", "AGC", "Agra Cantt"),
    "prayagraj": ("IXD", "Prayagraj Airport", "PRYJ", "Prayagraj Jn"),
    "ayodhya": ("AYJ", "Maharishi Valmiki Intl", "AY", "Ayodhya Dham"),
    "mangaluru": ("IXE", "Mangaluru Intl", "MAQ", "Mangaluru Central"),
    "mysuru": ("MYQ", "Mysuru Airport", "MYS", "Mysuru Jn"),
    "aurangabad": ("IXU", "Aurangabad Airport", "AWB", "Chhatrapati Sambhajinagar"),
    "nashik": ("ISK", "Nashik Airport", "NK", "Nashik Road"),
    "shirdi": ("SAG", "Shirdi Airport", "SNSI", "Sainagar Shirdi"),
    "tirupati": ("TIR", "Tirupati Airport", "TPTY", "Tirupati"),
    "gwalior": ("GWL", "Rajmata Vijaya Raje Scindia Airport", "GWL", "Gwalior Jn"),
    "jabalpur": ("JLR", "Jabalpur Airport", "JBP", "Jabalpur Jn"),
    "kanpur": ("KNU", "Kanpur Airport", "CNB", "Kanpur Central"),
    "kozhikode": ("CCJ", "Calicut Intl", "CLT", "Kozhikode"),
    "puducherry": (None, None, "PDY", "Puducherry"),
    "haridwar": (None, None, "HW", "Haridwar Jn"),
    "rishikesh": (None, None, "YNRK", "Yog Nagari Rishikesh"),
    "shimla": (None, None, "SML", "Shimla"),
    "manali": (None, None, "", "No railway station"),
    "darjeeling": (None, None, "DJ", "Darjeeling"),
    "wardha": (None, None, "WR", "Wardha Jn"),
    "kota": (None, None, "KOTA", "Kota Jn"),
    "ujjain": (None, None, "UJN", "Ujjain Jn"),
    "mathura": (None, None, "MTJ", "Mathura Jn"),
    "gurugram": (None, None, "GGN", "Gurugram"),
    "noida": (None, None, "", "No mainline station"),
}

# Towns without an airport -> nearest airport hub in this sandbox
NEAREST_AIRPORT = {
    "haridwar": "dehradun", "rishikesh": "dehradun", "wardha": "nagpur", "kota": "jaipur",
    "ujjain": "indore", "mathura": "agra", "gurugram": "delhi", "noida": "delhi",
    "puducherry": "chennai", "shimla": "chandigarh", "manali": "chandigarh",
    "darjeeling": "kolkata", "pachmarhi": "bhopal",
}


# Approximate coordinates (lat, lon) so sandbox distances, durations and fares are realistic.
COORDS = {
    "mumbai": (19.08, 72.88), "delhi": (28.61, 77.21), "bengaluru": (12.97, 77.59), "chennai": (13.08, 80.27),
    "kolkata": (22.57, 88.36), "hyderabad": (17.39, 78.49), "pune": (18.52, 73.86), "ahmedabad": (23.02, 72.57),
    "jaipur": (26.91, 75.79), "lucknow": (26.85, 80.95), "nagpur": (21.15, 79.09), "goa": (15.30, 74.12),
    "kochi": (9.93, 76.27), "chandigarh": (30.73, 76.78), "varanasi": (25.32, 82.97), "patna": (25.59, 85.14),
    "bhopal": (23.26, 77.41), "indore": (22.72, 75.86), "jodhpur": (26.24, 73.02), "udaipur": (24.59, 73.71),
    "amritsar": (31.63, 74.87), "guwahati": (26.14, 91.74), "bhubaneswar": (20.30, 85.82), "raipur": (21.25, 81.63),
    "ranchi": (23.34, 85.31), "surat": (21.17, 72.83), "vadodara": (22.31, 73.18), "coimbatore": (11.02, 76.96),
    "madurai": (9.93, 78.12), "thiruvananthapuram": (8.52, 76.94), "visakhapatnam": (17.69, 83.22),
    "vijayawada": (16.51, 80.65), "dehradun": (30.32, 78.03), "srinagar": (34.08, 74.80), "jammu": (32.73, 74.86),
    "agra": (27.18, 78.01), "prayagraj": (25.44, 81.85), "ayodhya": (26.80, 82.20), "mangaluru": (12.91, 74.86),
    "mysuru": (12.30, 76.64), "aurangabad": (19.88, 75.34), "nashik": (20.00, 73.79), "shirdi": (19.77, 74.48),
    "tirupati": (13.63, 79.42), "gwalior": (26.22, 78.18), "jabalpur": (23.18, 79.99), "kanpur": (26.45, 80.33),
    "kozhikode": (11.26, 75.78), "puducherry": (11.94, 79.81), "haridwar": (29.95, 78.16), "rishikesh": (30.09, 78.27),
    "shimla": (31.10, 77.17), "manali": (32.24, 77.19), "darjeeling": (27.04, 88.26), "wardha": (20.75, 78.60),
    "kota": (25.21, 75.86), "ujjain": (23.18, 75.78), "mathura": (27.49, 77.67), "gurugram": (28.46, 77.03),
    "noida": (28.54, 77.39), "pachmarhi": (22.47, 78.43),
    # Popular car-trip destinations (no airport; road-trip distances for search_cars)
    "mahabaleshwar": (17.92, 73.66), "lonavala": (18.75, 73.41), "ajmer": (26.45, 74.64), "pushkar": (26.49, 74.55),
    "kolhapur": (16.70, 74.24), "thane": (19.22, 72.98), "navi mumbai": (19.03, 73.03), "alibaug": (18.64, 72.87),
    "coorg": (12.42, 75.74), "ooty": (11.41, 76.70), "mussoorie": (30.46, 78.07), "nainital": (29.38, 79.46),
    "mount abu": (24.59, 72.71), "vrindavan": (27.58, 77.70), "lonar": (19.98, 76.52),
}

ROAD_ONLY = {"manali", "noida"}  # no mainline railway in this sandbox


def normalize_city(raw: str) -> str:
    key = re.sub(r"\s+", " ", raw.strip().lower())
    key = ALIASES.get(key, key)
    return key


def title(key: str) -> str:
    return " ".join(w.capitalize() for w in key.split(" "))


@dataclass
class Place:
    key: str
    name: str
    known: bool
    airport_code: str | None
    airport_name: str | None
    station_code: str
    station_name: str
    nearest_airport: str | None


def resolve_place(raw: str) -> Place:
    if not raw or not re.match(r"^[A-Za-z][A-Za-z .'-]{1,40}$", raw.strip()):
        raise ValueError(f"'{raw}' doesn't look like a place name. Use a city, town or village name.")
    key = normalize_city(raw)
    if key in HUBS:
        code, aname, scode, sname = HUBS[key]
        return Place(key, title(key), True, code, aname, scode, sname, NEAREST_AIRPORT.get(key))
    # Any other Indian town or village: generated sandbox station, no airport
    scode = re.sub(r"[^a-z]", "", key)[:4].upper() or "STN"
    return Place(key, title(key), False, None, None, scode, f"{title(key)} (sandbox station)", NEAREST_AIRPORT.get(key))


def list_known_places() -> list[dict]:
    out = []
    for key, (code, aname, scode, sname) in sorted(HUBS.items()):
        out.append({"city": title(key), "airport": code, "station": scode or None,
                    "nearest_airport_city": title(NEAREST_AIRPORT[key]) if key in NEAREST_AIRPORT else None})
    return out


# ---------------------------------------------------------------------------
# Harness: credential guard
# ---------------------------------------------------------------------------

_SECRET_WORDS = re.compile(r"\b(otp|cvv|upi\s*pin|pin|password|passcode|mpin)\b", re.I)
_DIGITS = re.compile(r"\b\d{3,6}\b")
_CARD = re.compile(r"\b(?:\d[ -]?){13,19}\b")


class HarnessViolation(ValueError):
    """Raised when a request breaks a safety rule. The message is safe to show the user."""


def guard_text(*values: object) -> None:
    for v in values:
        if not isinstance(v, str):
            continue
        if _CARD.search(v) or (_SECRET_WORDS.search(v) and _DIGITS.search(v)):
            raise HarnessViolation(
                "Blocked: this looks like a UPI PIN, OTP or card number. Never share these with the assistant. "
                "The PIN is entered only on the UPI app screen."
            )


_CONSENT = re.compile(r"\b(yes|yeah|haan|haa|ji|sure|proceed|confirm|book it|go ahead|kar do|kardo|ok|okay|theek hai|thik hai)\b", re.I)
_REFUSAL = re.compile(r"\b(no|nahi|nahin|don't|do not|wait|ruko|cancel that|stop)\b", re.I)


def require_consent(customer_confirmed: bool, confirmation_text: str, action: str) -> None:
    """The model must pass the customer's own words. A bare boolean is not enough."""
    if not customer_confirmed:
        raise HarnessViolation(f"Not allowed: {action} needs the customer's explicit 'yes' first. Read back the details and ask.")
    text = (confirmation_text or "").strip()
    if not text or not _CONSENT.search(text) or _REFUSAL.search(text):
        raise HarnessViolation(
            f"Not allowed: {action} needs the customer's own confirming words in confirmation_text "
            f"(for example 'haan, book kar do'). Got: '{text[:60]}'."
        )


# ---------------------------------------------------------------------------
# Dates
# ---------------------------------------------------------------------------

def parse_travel_date(raw: str, today: date | None = None) -> date:
    today = today or date.today()
    s = (raw or "").strip().lower()
    if s in ("today", "aaj"):
        return today
    if s in ("tomorrow", "kal"):
        return today + timedelta(days=1)
    if s in ("day after tomorrow", "parso"):
        return today + timedelta(days=2)
    try:
        d = date.fromisoformat(s)
    except ValueError:
        raise ValueError("Use the date as YYYY-MM-DD (or 'today' / 'tomorrow'). Resolve phrases like 'next Friday' first.")
    if d < today:
        raise ValueError(f"{d.isoformat()} is in the past.")
    if d > today + timedelta(days=365):
        raise ValueError("Bookings open at most 365 days ahead in this sandbox.")
    return d


# ---------------------------------------------------------------------------
# Inventory generation (deterministic per route + date)
# ---------------------------------------------------------------------------

def _h(*parts: str) -> int:
    return int(hashlib.sha256("|".join(parts).encode()).hexdigest()[:12], 16)


def _coords(key: str):
    if key in COORDS:
        return COORDS[key]
    near = NEAREST_AIRPORT.get(key)
    return COORDS.get(near) if near else None


def _route_km(a: str, b: str) -> int:
    """Road/rail distance: great-circle x 1.25 when both places are known, else a stable pseudo-distance."""
    ca, cb = _coords(a), _coords(b)
    if ca and cb:
        from math import radians, sin, cos, asin, sqrt
        la1, lo1, la2, lo2 = map(radians, (*ca, *cb))
        hav = sin((la2 - la1) / 2) ** 2 + cos(la1) * cos(la2) * sin((lo2 - lo1) / 2) ** 2
        return max(60, int(2 * 6371 * asin(sqrt(hav)) * 1.25))
    x, y = sorted([a, b])
    return 150 + _h("km", x, y) % 1900


def _clock(minutes: int) -> str:
    minutes %= 24 * 60
    h, m = divmod(minutes, 60)
    return f"{h:02d}:{m:02d}"


def _dur(minutes: int) -> str:
    return f"{minutes // 60}h {minutes % 60:02d}m"


@dataclass
class Option:
    option_id: str
    mode: Mode
    operator: str
    service: str
    travel_class: str
    origin: str
    origin_point: str
    destination: str
    destination_point: str
    date: str
    departs: str
    arrives: str
    duration_minutes: int
    fare_per_traveller: int
    convenience_fee: int
    travellers: int
    total_fare: int
    seats_left: int
    baggage: str
    cancellation_fee_before_24h: int
    cancellation_fee_within_24h: int
    refund_rule: str
    priced_per: str = "traveller"  # "traveller" (seat) or "vehicle" (whole car)
    extras: dict = field(default_factory=dict)

    def summary(self) -> dict:
        d = asdict(self)
        d["duration"] = _dur(self.duration_minutes)
        return d


AIRLINES = [("IndiGo", "6E"), ("Air India", "AI"), ("Akasa Air", "QP"), ("Air India Express", "IX"), ("SpiceJet", "SG")]
TRAIN_NAMES = ["Superfast Express", "Duronto Express", "Rajdhani Express", "Vande Bharat Express", "Sampark Kranti", "Mail"]
BUS_OPS = ["IntrCity SmartBus", "VRL Travels", "SRS Travels", "Zingbus", "State Transport (sandbox)"]


def _flights(o: Place, d: Place, day: date, pax: int) -> list[Option]:
    km = _route_km(o.key, d.key)
    out = []
    for i in range(3):
        name, code = AIRLINES[_h("air", o.key, d.key, str(i)) % len(AIRLINES)]
        dep = [6 * 60 + 10, 11 * 60 + 40, 19 * 60 + 5][i] + _h("fd", o.key, d.key, str(i)) % 40
        air_km = int(km / 1.25)  # flights fly the straight line
        dur = 35 + air_km // 13 + (_h("fl", str(i)) % 15)
        fare = int(1900 + air_km * 1.7 + (_h("ff", o.key, d.key, day.isoformat(), str(i)) % 1800)) // 10 * 10
        num = f"{code}-{100 + _h('fn', o.key, d.key, str(i)) % 899}"
        conv = 350
        out.append(Option(
            option_id="", mode="flight", operator=name, service=num, travel_class="Economy",
            origin=o.name, origin_point=f"{o.airport_name} ({o.airport_code})",
            destination=d.name, destination_point=f"{d.airport_name} ({d.airport_code})",
            date=day.isoformat(), departs=_clock(dep), arrives=_clock(dep + dur), duration_minutes=dur,
            fare_per_traveller=fare, convenience_fee=conv, travellers=pax, total_fare=fare * pax + conv,
            seats_left=3 + _h("fs", num, day.isoformat()) % 20, baggage="Cabin 7 kg + check-in 15 kg",
            cancellation_fee_before_24h=2500, cancellation_fee_within_24h=3500,
            refund_rule="Refundable minus airline fee; convenience fee non-refundable"))
    return out


def _trains(o: Place, d: Place, day: date, pax: int) -> list[Option]:
    km = _route_km(o.key, d.key)
    tname = f"{o.name}-{d.name} {TRAIN_NAMES[_h('tn', o.key, d.key) % len(TRAIN_NAMES)]}"
    tno = str(12000 + _h("tno", o.key, d.key) % 7999)
    dep = 16 * 60 + _h("td", o.key, d.key) % 360
    dur = int(km / 58 * 60) + 30
    out = []
    for cls, per_km, fee_b, fee_w in [("Sleeper (SL)", 0.55, 120, 240), ("AC 3 Tier (3A)", 1.45, 180, 360), ("AC 2 Tier (2A)", 2.1, 200, 400)]:
        fare = max(180, int(km * per_km)) // 5 * 5
        out.append(Option(
            option_id="", mode="train", operator="Indian Railways (IRCTC)", service=f"{tname} ({tno})", travel_class=cls,
            origin=o.name, origin_point=f"{o.station_name} ({o.station_code})",
            destination=d.name, destination_point=f"{d.station_name} ({d.station_code})",
            date=day.isoformat(), departs=_clock(dep), arrives=_clock(dep + dur), duration_minutes=dur,
            fare_per_traveller=fare, convenience_fee=30, travellers=pax, total_fare=fare * pax + 30,
            seats_left=_h("ts", tno, cls, day.isoformat()) % 60, baggage="Free allowance per IRCTC rules",
            cancellation_fee_before_24h=fee_b, cancellation_fee_within_24h=fee_w,
            refund_rule="Per IRCTC rules; no refund after chart preparation for confirmed tickets (sandbox simplification)"))
    return out


def _buses(o: Place, d: Place, day: date, pax: int) -> list[Option]:
    km = _route_km(o.key, d.key)
    if km > 1300:
        return []  # no direct buses on very long routes
    dur = int(km / 50 * 60)
    out = []
    for i, (kind, per_km) in enumerate([("AC Sleeper", 1.7), ("Non-AC Seater", 0.9)]):
        op = BUS_OPS[_h("bo", o.key, d.key, str(i)) % len(BUS_OPS)]
        dep = 20 * 60 + 30 + i * 75
        fare = max(250, int(km * per_km)) // 10 * 10
        out.append(Option(
            option_id="", mode="bus", operator=op, service=f"{op} {kind}", travel_class=kind,
            origin=o.name, origin_point=f"{o.name} Central Bus Stand",
            destination=d.name, destination_point=f"{d.name} Bus Stand",
            date=day.isoformat(), departs=_clock(dep), arrives=_clock(dep + dur), duration_minutes=dur,
            fare_per_traveller=fare, convenience_fee=25, travellers=pax, total_fare=fare * pax + 25,
            seats_left=_h("bs", op, day.isoformat()) % 30, baggage="1 bag up to 15 kg",
            cancellation_fee_before_24h=100, cancellation_fee_within_24h=fare // 2,
            refund_rule="Full refund minus fee; 50% fee within 24h of departure"))
    return out


# ---------------------------------------------------------------------------
# Cars: outstation cabs, hourly rentals, transfers from local tours & travels
# operators, plus cost-shared carpool. Same Option/Order pipeline as trains.
# ---------------------------------------------------------------------------

STATE_OF = {
    "mumbai": "Maharashtra", "pune": "Maharashtra", "nagpur": "Maharashtra", "aurangabad": "Maharashtra",
    "nashik": "Maharashtra", "shirdi": "Maharashtra", "wardha": "Maharashtra", "kolhapur": "Maharashtra",
    "thane": "Maharashtra", "navi mumbai": "Maharashtra", "mahabaleshwar": "Maharashtra", "lonavala": "Maharashtra",
    "alibaug": "Maharashtra", "lonar": "Maharashtra", "pushkar": "Rajasthan", "mount abu": "Rajasthan",
    "coorg": "Karnataka", "ooty": "Tamil Nadu", "mussoorie": "Uttarakhand", "nainital": "Uttarakhand",
    "vrindavan": "Uttar Pradesh",
    "delhi": "Delhi", "gurugram": "Haryana", "noida": "Uttar Pradesh", "bengaluru": "Karnataka", "mysuru": "Karnataka",
    "mangaluru": "Karnataka", "chennai": "Tamil Nadu", "coimbatore": "Tamil Nadu", "madurai": "Tamil Nadu",
    "kolkata": "West Bengal", "darjeeling": "West Bengal", "hyderabad": "Telangana", "ahmedabad": "Gujarat",
    "surat": "Gujarat", "vadodara": "Gujarat", "jaipur": "Rajasthan", "jodhpur": "Rajasthan", "udaipur": "Rajasthan",
    "kota": "Rajasthan", "ajmer": "Rajasthan", "lucknow": "Uttar Pradesh", "varanasi": "Uttar Pradesh",
    "agra": "Uttar Pradesh", "kanpur": "Uttar Pradesh", "prayagraj": "Uttar Pradesh", "ayodhya": "Uttar Pradesh",
    "mathura": "Uttar Pradesh", "goa": "Goa", "kochi": "Kerala", "kozhikode": "Kerala", "thiruvananthapuram": "Kerala",
    "chandigarh": "Chandigarh", "patna": "Bihar", "bhopal": "Madhya Pradesh", "indore": "Madhya Pradesh",
    "gwalior": "Madhya Pradesh", "jabalpur": "Madhya Pradesh", "ujjain": "Madhya Pradesh", "pachmarhi": "Madhya Pradesh",
    "amritsar": "Punjab", "guwahati": "Assam", "bhubaneswar": "Odisha", "raipur": "Chhattisgarh", "ranchi": "Jharkhand",
    "visakhapatnam": "Andhra Pradesh", "vijayawada": "Andhra Pradesh", "tirupati": "Andhra Pradesh",
    "dehradun": "Uttarakhand", "haridwar": "Uttarakhand", "rishikesh": "Uttarakhand", "srinagar": "Jammu and Kashmir",
    "jammu": "Jammu and Kashmir", "shimla": "Himachal Pradesh", "manali": "Himachal Pradesh", "puducherry": "Puducherry",
}

# States where app-based, cost-shared carpool in private cars is permitted (sandbox policy table).
# Maharashtra approved it in 2025. Legal must confirm before adding any state.
CARPOOL_PERMITTED_STATES = {"Maharashtra"}

# category, example car, seats, bags, ₹ per km, ₹ per extra hour (hourly rentals)
CAR_TYPES = [
    ("Hatchback", "WagonR or similar", 4, 2, 11, 120),
    ("Sedan", "Swift Dzire or similar", 4, 3, 12, 150),
    ("SUV", "Ertiga or similar", 6, 4, 15, 190),
    ("Innova", "Toyota Innova Crysta or similar", 7, 5, 19, 240),
    ("Tempo Traveller", "Force Traveller 12-seater", 12, 8, 26, 320),
]
LOCAL_OPERATORS = ["Shree Balaji Tours & Travels", "Sai Krupa Travels", "Royal Cabs & Tours",
                   "Maa Durga Travels", "Om Sai Ram Tours", "Highway King Cabs"]
HOURLY_PACKAGES = {4: 40, 8: 80, 12: 120}  # hours -> km included
TRIP_TYPES = ("one_way", "round_trip", "local_hourly", "airport_transfer")
DRIVER_ALLOWANCE_PER_DAY = 300
MIN_KM_PER_DAY_ROUND_TRIP = 250
CAR_CONVENIENCE_FEE = 49
CARPOOL_FUEL_COST_PER_KM = 7  # ₹, used for the non-profit cost share
CARPOOL_PLATFORM_FEE = 5


def state_of(key: str) -> str | None:
    return STATE_OF.get(key)


def _parse_clock(raw: str | None, default: str = "09:00") -> int:
    s = (raw or default).strip().lower()
    m = re.match(r"^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$", s)
    if not m:
        raise ValueError("Give the pickup time as HH:MM (24h) or like '6 am'.")
    h, mi, ap = int(m.group(1)), int(m.group(2) or 0), m.group(3)
    if ap == "pm" and h < 12:
        h += 12
    if ap == "am" and h == 12:
        h = 0
    if not (0 <= h < 24 and 0 <= mi < 60):
        raise ValueError("Pickup time is not a valid clock time.")
    return h * 60 + mi


def car_fare_breakdown(per_km: int, billable_km: int, road_km: int, days: int, pickup_min: int,
                       trip_type: str, interstate: bool) -> dict:
    """All-inclusive fare. Every rupee the customer pays is a line here; lines must add up to the total."""
    base = billable_km * per_km
    return_fee = int(road_km * per_km * 0.35) if trip_type == "one_way" and road_km > 80 else 0
    tolls = 0 if trip_type in ("local_hourly", "airport_transfer") else (road_km // 60) * 85 * (2 if trip_type == "round_trip" else 1)
    state_tax = 400 if interstate else 0
    outstation = trip_type in ("one_way", "round_trip")
    driver_allowance = DRIVER_ALLOWANCE_PER_DAY * days if outstation else 0
    end_min = pickup_min + int(road_km / 50 * 60)
    night = 250 if (pickup_min < 6 * 60 or pickup_min >= 22 * 60 or (outstation and end_min % (24 * 60) >= 22 * 60)) else 0
    gst = round((base + return_fee) * 0.05)
    lines = {"base_fare": base, "one_way_return_fee": return_fee, "tolls": tolls, "state_permit_tax": state_tax,
             "driver_allowance": driver_allowance, "night_charge": night, "gst": gst}
    lines = {k: v for k, v in lines.items() if v}
    lines["total"] = sum(lines.values())
    return lines


def _check_breakdown(b: dict) -> None:
    if sum(v for k, v in b.items() if k != "total") != b["total"]:
        raise HarnessViolation("Fare breakdown does not add up to the total. Refusing to show a price.")


def carpool_cost_share(km: int, car_seats_offered: int) -> int:
    """Non-profit cost share per seat: fuel for the trip split across driver + riders."""
    return max(10, -(-km * CARPOOL_FUEL_COST_PER_KM // (car_seats_offered + 1)))


FIRST_NAMES_F = ["Priya", "Sneha", "Ananya", "Meera", "Kavya", "Pooja"]
FIRST_NAMES_M = ["Rohit", "Amit", "Karan", "Vikram", "Sahil", "Nikhil"]
POOL_CARS = ["Hyundai i20", "Maruti Baleno", "Tata Nexon", "Honda City", "Kia Seltos", "Maruti Swift"]

# ---------------------------------------------------------------------------
# Orders, payments, refunds (in-memory sandbox store)
# ---------------------------------------------------------------------------

HOLD_MINUTES = 10


@dataclass
class Order:
    order_id: str
    option: Option
    passenger_name: str
    status: str  # HELD, PAYMENT_REQUESTED, CONFIRMED, PAYMENT_FAILED, DEBITED_PENDING, REFUNDED, CANCELLED, EXPIRED
    hold_expires_at: float
    pnr: str | None = None
    payment_attempts: int = 0
    last_payment_status: str | None = None
    seat_sold_out: bool = False
    refund: dict | None = None
    audit: list[str] = field(default_factory=list)

    def view(self) -> dict:
        mins = max(0, int((self.hold_expires_at - time.time()) // 60)) if self.status in ("HELD", "PAYMENT_REQUESTED", "PAYMENT_FAILED") else 0
        return {
            "order_id": self.order_id, "status": self.status, "pnr": self.pnr,
            "passenger_name": self.passenger_name, "amount": self.option.total_fare,
            "hold_minutes_left": mins, "trip": self.option.summary(),
            "payment_attempts": self.payment_attempts, "refund": self.refund, "audit_trail": self.audit,
        }


class TravelEngine:
    def __init__(self, today: date | None = None):
        self._today = today
        self.options: dict[str, Option] = {}
        self.orders: dict[str, Order] = {}

    @property
    def today(self) -> date:
        return self._today or date.today()

    def _log(self, order: Order, msg: str) -> None:
        order.audit.append(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")

    # -- search --------------------------------------------------------------
    def search(self, origin: str, destination: str, travel_date: str, travellers: int = 1,
               mode: str = "all", max_total_budget: int | None = None, time_of_day: str | None = None) -> dict:
        guard_text(origin, destination, travel_date, mode, time_of_day)
        if not 1 <= travellers <= 9:
            raise ValueError("Travellers must be between 1 and 9.")
        o, d = resolve_place(origin), resolve_place(destination)
        if o.key == d.key:
            raise ValueError("Origin and destination are the same place.")
        day = parse_travel_date(travel_date, self.today)
        modes = ["flight", "train", "bus"] if mode in (None, "", "all") else [mode]
        if any(m not in ("flight", "train", "bus") for m in modes):
            raise ValueError("mode must be flight, train, bus or all.")

        notes: list[str] = []
        results: list[Option] = []
        if "flight" in modes:
            if o.airport_code and d.airport_code:
                results += _flights(o, d, day, travellers)
            else:
                for p in (o, d):
                    if not p.airport_code:
                        near = f" Nearest airport: {title(p.nearest_airport)}." if p.nearest_airport else ""
                        notes.append(f"No airport in {p.name} in this sandbox.{near} Train or bus may be better.")
        if "train" in modes:
            if o.key in ROAD_ONLY or d.key in ROAD_ONLY:
                notes.append("No direct train: one end has no mainline railway station.")
            else:
                results += _trains(o, d, day, travellers)
        if "bus" in modes:
            buses = _buses(o, d, day, travellers)
            if not buses:
                notes.append("No direct buses on this long route.")
            results += buses

        if time_of_day:
            windows = {"morning": (5, 12), "afternoon": (12, 17), "evening": (17, 21), "night": (21, 29)}
            lo, hi = windows.get(time_of_day.lower(), (0, 29))
            def in_window(opt: Option) -> bool:
                h = int(opt.departs[:2])
                h = h + 24 if h < 5 else h
                return lo <= h < hi
            filtered = [r for r in results if in_window(r)]
            if not filtered and results:
                notes.append(f"Nothing departs in the {time_of_day}; showing all times.")
            else:
                results = filtered
        if max_total_budget:
            within = [r for r in results if r.total_fare <= max_total_budget]
            if not within and results:
                cheapest = min(results, key=lambda r: r.total_fare)
                notes.append(f"Nothing within ₹{max_total_budget:,}. Cheapest available is ₹{cheapest.total_fare:,} ({cheapest.mode}).")
            else:
                results = within

        if _route_km(o.key, d.key) <= 400 or not (o.known and d.known):
            notes.append("Door to door: a chauffeur-driven car from a verified local operator may suit this route "
                         "(search_cars).")
        for r in results:
            r.option_id = f"OPT-{_h(r.mode, r.service, r.travel_class, r.date, str(r.travellers)) % 10**8:08d}"
            self.options[r.option_id] = r
        results.sort(key=lambda r: r.total_fare)
        fastest = min(results, key=lambda r: r.duration_minutes) if results else None
        return {
            "origin": o.name, "destination": d.name, "date": day.isoformat(), "travellers": travellers,
            "options": [r.summary() for r in results],
            "cheapest_option_id": results[0].option_id if results else None,
            "fastest_option_id": fastest.option_id if fastest else None,
            "notes": notes, "data": "SANDBOX inventory: fares and seats are simulated",
        }

    # -- cars ----------------------------------------------------------------
    def search_cars(self, origin: str, destination: str | None, pickup_date: str, pickup_time: str = "09:00",
                    travellers: int = 1, bags: int | None = None, trip_type: str = "one_way",
                    return_date: str | None = None, hours: int | None = None) -> dict:
        """Chauffeur-driven cars from verified local tours & travels operators (sandbox)."""
        guard_text(origin, destination, pickup_date, pickup_time, trip_type, return_date)
        if trip_type not in TRIP_TYPES:
            raise ValueError(f"trip_type must be one of {', '.join(TRIP_TYPES)}.")
        if not 1 <= travellers <= 12:
            raise ValueError("Travellers must be between 1 and 12 for a car.")
        bags = travellers if bags is None else bags
        if not 0 <= bags <= 12:
            raise ValueError("Bags must be between 0 and 12.")
        o = resolve_place(origin)
        day = parse_travel_date(pickup_date, self.today)
        pick = _parse_clock(pickup_time)
        notes: list[str] = []
        days, interstate = 1, False

        if trip_type == "local_hourly":
            hours = hours or 8
            if hours not in HOURLY_PACKAGES:
                raise ValueError("Hourly packages are 4, 8 or 12 hours.")
            d_name, road_km = o.name, HOURLY_PACKAGES[hours]
            billable_km, dur = road_km, hours * 60
            drop_point = f"Anywhere within {o.name} city limits"
        elif trip_type == "airport_transfer":
            if not o.airport_code:
                raise ValueError(f"No airport in {o.name} in this sandbox. Use one_way to the nearest airport city.")
            d_name, road_km = f"{o.name} airport", 25 + _h("apt", o.key) % 25
            billable_km, dur = road_km, int(road_km / 30 * 60)
            drop_point = f"{o.airport_name} ({o.airport_code})"
        else:
            if not destination:
                raise ValueError("Tell me where the car should drop you.")
            d = resolve_place(destination)
            if d.key == o.key:
                raise ValueError("Pickup and drop are in the same city: use local_hourly or airport_transfer.")
            d_name, road_km = d.name, _route_km(o.key, d.key)
            if road_km > 1500:
                raise ValueError(f"{road_km} km is too far for a car trip in this sandbox. Try train or flight.")
            so, sd = state_of(o.key), state_of(d.key)
            interstate = bool(so and sd and so != sd)
            drop_point = f"Your address in {d.name}"
            dur = int(road_km / 50 * 60)
            if trip_type == "round_trip":
                if not return_date:
                    raise ValueError("For a round trip, tell me the return date.")
                back = parse_travel_date(return_date, self.today)
                if back < day:
                    raise ValueError("Return date is before the pickup date.")
                days = (back - day).days + 1
                billable_km = max(2 * road_km, MIN_KM_PER_DAY_ROUND_TRIP * days)
                notes.append(f"Round trip: {days} day(s), {billable_km} km included "
                             f"(minimum {MIN_KM_PER_DAY_ROUND_TRIP} km/day).")
            else:
                billable_km = road_km
                days = 1 + dur // (14 * 60)

        results: list[Option] = []
        for cat, example, seats, cap_bags, per_km, extra_hr in CAR_TYPES:
            if seats < travellers or cap_bags < bags:
                continue
            op = LOCAL_OPERATORS[_h("op", o.key, d_name, cat) % len(LOCAL_OPERATORS)]
            b = car_fare_breakdown(per_km, billable_km, road_km, days, pick, trip_type, interstate)
            _check_breakdown(b)
            vehicle_total = b["total"]
            rating = 4.2 + (_h("rt", op, cat) % 8) / 10
            results.append(Option(
                option_id="", mode="cab", operator=f"{op} (verified)", service=example, travel_class=cat,
                origin=o.name, origin_point=f"Pickup from your address in {o.name}",
                destination=d_name, destination_point=drop_point,
                date=day.isoformat(), departs=_clock(pick), arrives=_clock(pick + dur), duration_minutes=dur,
                fare_per_traveller=vehicle_total, convenience_fee=CAR_CONVENIENCE_FEE, travellers=travellers,
                total_fare=vehicle_total + CAR_CONVENIENCE_FEE,
                seats_left=1 + _h("cars", op, cat, day.isoformat()) % 4,
                baggage=f"Up to {cap_bags} bags · {seats} seats",
                cancellation_fee_before_24h=200 if seats <= 4 else 300,
                cancellation_fee_within_24h=max(300, vehicle_total // 4),
                refund_rule="Flat fee more than 24h before pickup; 25% of the car fare within 24h; convenience fee non-refundable",
                priced_per="vehicle",
                extras={
                    "trip_type": trip_type, "seats": seats, "bags": cap_bags, "road_km": road_km,
                    "km_included": billable_km, "extra_km_rate": per_km + 1, "extra_hour_rate": extra_hr,
                    "days": days, "interstate": interstate, "price_breakdown": b,
                    "inclusions": [k for k in b if k not in ("total", "base_fare", "gst")] + ["gst"],
                    "no_cash_to_driver": True,
                    "operator_checks": {
                        "permit": "All India Tourist Permit" if trip_type in ("one_way", "round_trip") else "State contract carriage",
                        "vehicle_age_max_years": 12, "insurance": True, "driver_police_verified": True},
                    "operator_rating": round(rating, 1),
                }))
        if not results:
            notes.append(f"No single car fits {travellers} travellers with {bags} bags. "
                         "Book two cars, or a Tempo Traveller with fewer bags.")
        for r in results:
            r.option_id = f"CAR-{_h(r.mode, r.operator, r.travel_class, r.date, r.departs, r.destination, str(r.travellers), trip_type, str(days)) % 10**8:08d}"
            self.options[r.option_id] = r
        results.sort(key=lambda r: r.total_fare)
        return {
            "origin": o.name, "destination": d_name, "date": day.isoformat(), "pickup_time": _clock(pick),
            "trip_type": trip_type, "travellers": travellers, "bags": bags,
            "options": [r.summary() for r in results],
            "cheapest_option_id": results[0].option_id if results else None,
            "notes": notes + ["Prices are all-inclusive: tolls, state tax, driver allowance and night charges are "
                              "already in the total. The customer pays nothing extra to the driver."],
            "data": "SANDBOX inventory: operators, cars and fares are simulated",
        }

    def search_carpool(self, city: str, from_area: str, to_area: str, travel_date: str,
                       depart_time: str = "09:00", seats: int = 1, community: str = "office",
                       women_only: bool = False) -> dict:
        """Cost-shared carpool for office / college commutes, only where state rules allow it."""
        guard_text(city, from_area, to_area, travel_date, depart_time, community)
        c = resolve_place(city)
        for area in (from_area, to_area):
            if not area or not re.match(r"^[A-Za-z][A-Za-z0-9 .'-]{1,40}$", area.strip()):
                raise ValueError(f"'{area}' doesn't look like an area or landmark name.")
        if from_area.strip().lower() == to_area.strip().lower():
            raise ValueError("Pickup and drop areas are the same.")
        if community not in ("office", "college", "public"):
            raise ValueError("community must be office, college or public.")
        if not 1 <= seats <= 3:
            raise ValueError("A carpool booking is for 1 to 3 seats.")
        day = parse_travel_date(travel_date, self.today)
        want = _parse_clock(depart_time)
        st = state_of(c.key)
        if st not in CARPOOL_PERMITTED_STATES:
            return {"available": False, "city": c.name, "state": st, "options": [],
                    "notes": [f"Carpool in private cars isn't permitted on apps in {st or 'this state'} yet. "
                              "We'll notify you when it is. A cab or bus may work instead."],
                    "data": "SANDBOX policy table"}
        fa, ta = from_area.strip().lower(), to_area.strip().lower()
        km = 8 + _h("pool", c.key, fa, ta) % 22
        verify = {"office": "Verified work email", "college": "Verified student ID", "public": "Paytm KYC verified"}[community]
        results: list[Option] = []
        for i, offset in enumerate((-15, 0, 10, 25)):
            female = _h("g", c.key, fa, str(i)) % 2 == 0
            if women_only and not female:
                continue
            name = (FIRST_NAMES_F if female else FIRST_NAMES_M)[(_h("n", fa) + i) % 6]  # distinct per ride
            car = POOL_CARS[_h("pc", ta, str(i)) % len(POOL_CARS)]
            offered = 2 + _h("so", str(i), fa) % 2
            free = offered - _h("taken", str(i), day.isoformat()) % 2
            if free < seats:
                continue
            share = carpool_cost_share(km, offered)
            dep = want + offset
            dur = int(km / 22 * 60) + 5
            results.append(Option(
                option_id="", mode="carpool", operator=f"{name} {chr(65 + _h('ini', name, str(i)) % 26)}. ({verify})",
                service=f"{car} · {offered} seats offered", travel_class="Women-only" if women_only else "Shared",
                origin=from_area.strip().title(), origin_point=f"{from_area.strip().title()}, {c.name}",
                destination=to_area.strip().title(), destination_point=f"{to_area.strip().title()}, {c.name}",
                date=day.isoformat(), departs=_clock(dep), arrives=_clock(dep + dur), duration_minutes=dur,
                fare_per_traveller=share, convenience_fee=CARPOOL_PLATFORM_FEE, travellers=seats,
                total_fare=share * seats + CARPOOL_PLATFORM_FEE, seats_left=free, baggage="Laptop bag",
                cancellation_fee_before_24h=0, cancellation_fee_within_24h=share // 2,
                refund_rule="Free cancellation until 24h before; half the share within 24h",
                priced_per="traveller",
                extras={"km": km, "community": community, "women_only": women_only,
                        "driver_gender": "F" if female else "M",
                        "cost_share_rule": f"₹{CARPOOL_FUEL_COST_PER_KM}/km fuel × {km} km ÷ ({offered} seats + driver), non-profit",
                        "max_share_allowed": carpool_cost_share(km, offered), "state": st,
                        "safety": ["Live trip sharing", "SOS", "Verified co-riders"]}))
        for r in results:
            r.option_id = f"POOL-{_h(r.operator, r.departs, r.date, str(r.travellers), str(women_only)) % 10**8:08d}"
            self.options[r.option_id] = r
        results.sort(key=lambda r: abs(_parse_clock(r.departs) - want))
        return {"available": True, "city": c.name, "state": st, "from": from_area.strip().title(),
                "to": to_area.strip().title(), "date": day.isoformat(),
                "options": [r.summary() for r in results],
                "notes": ([] if results else ["No matching rides yet. Post your route and we'll match you."]) +
                         ["Price is a computed fuel cost share. Drivers can't charge more (non-profit carpool)."],
                "data": "SANDBOX carpool rides"}

    def _option(self, option_id: str) -> Option:
        opt = self.options.get(option_id)
        if not opt:
            raise ValueError(f"Unknown option_id '{option_id}'. Run search_trips first and use an id it returned.")
        return opt

    def fare_rules(self, option_id: str) -> dict:
        o = self._option(option_id)
        return {"option_id": option_id, "baggage": o.baggage, "refund_rule": o.refund_rule,
                "cancellation_fee_per_traveller_before_24h": o.cancellation_fee_before_24h,
                "cancellation_fee_per_traveller_within_24h": o.cancellation_fee_within_24h,
                "convenience_fee_non_refundable": o.convenience_fee, "priced_per": o.priced_per,
                **({"price_breakdown": o.extras["price_breakdown"], "km_included": o.extras["km_included"],
                    "extra_km_rate": o.extras["extra_km_rate"], "no_cash_to_driver": True} if o.mode == "cab" else {}),
                **({"cost_share_rule": o.extras["cost_share_rule"]} if o.mode == "carpool" else {})}

    # -- booking ---------------------------------------------------------------
    def hold(self, option_id: str, passenger_name: str, customer_confirmed: bool, confirmation_text: str) -> dict:
        guard_text(passenger_name, confirmation_text)
        require_consent(customer_confirmed, confirmation_text, "Holding a fare")
        if not re.match(r"^[A-Za-z][A-Za-z .'-]{1,60}$", (passenger_name or "").strip()):
            raise ValueError("Give the lead passenger's full name as on their ID.")
        opt = self._option(option_id)
        if opt.seats_left <= 0:
            raise ValueError("No seats left on this option. Pick another.")
        if opt.mode == "carpool" and opt.fare_per_traveller > opt.extras.get("max_share_allowed", 0):
            raise HarnessViolation("Blocked: carpool price is above the non-profit cost share.")
        if opt.mode == "cab":
            _check_breakdown(opt.extras["price_breakdown"])
        # Idempotent: same option + passenger while a hold is live -> same order
        for od in self.orders.values():
            if od.option.option_id == option_id and od.passenger_name.lower() == passenger_name.strip().lower() \
                    and od.status in ("HELD", "PAYMENT_REQUESTED", "PAYMENT_FAILED") and od.hold_expires_at > time.time():
                return {**od.view(), "idempotent_replay": True}
        order_id = f"ORD-{_h(option_id, passenger_name, str(time.time())) % 10**6:06d}"
        od = Order(order_id, opt, passenger_name.strip(), "HELD", time.time() + HOLD_MINUTES * 60)
        self._log(od, f"Fare held for {HOLD_MINUTES} min at ₹{opt.total_fare:,} after customer said: '{confirmation_text.strip()[:60]}'")
        self.orders[order_id] = od
        return od.view()

    def _order(self, order_id: str) -> Order:
        od = self.orders.get(order_id)
        if not od:
            raise ValueError(f"Unknown order_id '{order_id}'.")
        if od.status in ("HELD", "PAYMENT_REQUESTED", "PAYMENT_FAILED") and od.hold_expires_at <= time.time():
            od.status = "EXPIRED"
            self._log(od, "Hold expired")
        return od

    def request_payment(self, order_id: str) -> dict:
        guard_text(order_id)
        od = self._order(order_id)
        if od.status not in ("HELD", "PAYMENT_FAILED", "PAYMENT_REQUESTED"):
            raise ValueError(f"Can't request payment for an order that is {od.status}.")
        od.status = "PAYMENT_REQUESTED"
        od.payment_attempts += 1
        self._log(od, f"UPI intent #{od.payment_attempts} created for ₹{od.option.total_fare:,} (same order id: no double charge)")
        return {**od.view(), "next_step": "Ask the customer to approve the payment on the Paytm UPI screen. Never ask for the PIN."}

    def sandbox_payment_event(self, order_id: str, outcome: str) -> dict:
        """Simulates what the bank / PSP reports. In production this is a webhook, not a tool."""
        od = self._order(order_id)
        if od.status != "PAYMENT_REQUESTED":
            raise ValueError(f"No payment in progress (order is {od.status}).")
        if outcome == "success":
            od.status, od.pnr = "CONFIRMED", f"PNR{_h(order_id, 'pnr') % 10**7:07d}"
            od.option.seats_left -= 1
            self._log(od, f"PSP: SUCCESS. Ticket issued, PNR {od.pnr}")
        elif outcome in ("declined", "bank_timeout", "insufficient_funds"):
            od.status, od.last_payment_status = "PAYMENT_FAILED", outcome
            self._log(od, f"PSP: FAILED ({outcome}). No debit. Hold kept for retry.")
        elif outcome in ("debited_pending", "debited_seat_sold_out"):
            od.status = "DEBITED_PENDING"
            if outcome == "debited_seat_sold_out":
                od.seat_sold_out, od.hold_expires_at = True, time.time() - 1
                od.option.seats_left = 0
            self._log(od, "PSP: debit at bank, callback lost. Ledger PENDING.")
        else:
            raise ValueError("outcome must be success, declined, bank_timeout, insufficient_funds, debited_pending or debited_seat_sold_out.")
        return od.view()

    def status(self, order_id: str) -> dict:
        return self._order(order_id).view()

    def reconcile(self, order_id: str) -> dict:
        od = self._order(order_id)
        self._log(od, "3-way check started: bank ↔ ledger ↔ inventory")
        if od.status != "DEBITED_PENDING":
            outcome = "NOTHING_STUCK" if od.status != "CONFIRMED" else "ALREADY_CONFIRMED"
            self._log(od, f"Outcome: {outcome}")
            return {**od.view(), "outcome": outcome}
        if not od.seat_sold_out and od.option.seats_left > 0:
            od.status, od.pnr = "CONFIRMED", f"PNR{_h(order_id, 'pnr') % 10**7:07d}"
            od.option.seats_left -= 1
            self._log(od, f"Outcome: ticket issued against existing payment, PNR {od.pnr}")
            return {**od.view(), "outcome": "TICKET_ISSUED"}
        od.status = "REFUNDED"
        od.refund = {"refund_id": f"RFD-{_h(order_id, 'rfd') % 10**6:06d}", "amount": od.option.total_fare,
                     "fees": 0, "reason": "Booking failed after debit: full refund"}
        self._log(od, f"Outcome: seat sold out. Full auto-refund {od.refund['refund_id']} of ₹{od.option.total_fare:,}")
        return {**od.view(), "outcome": "AUTO_REFUND"}

    def quote_refund(self, order_id: str, now: datetime | None = None) -> dict:
        od = self._order(order_id)
        if od.status != "CONFIRMED":
            raise ValueError(f"Only confirmed bookings can be cancelled (order is {od.status}).")
        o = od.option
        h, m = map(int, o.departs.split(":"))
        dep = datetime.fromisoformat(o.date).replace(hour=h, minute=m)
        hours = (dep - (now or datetime.now())).total_seconds() / 3600
        paid = o.total_fare
        if hours <= 0:
            fee, rule = paid - o.convenience_fee, "Departure has passed: no refund"
        else:
            per = o.cancellation_fee_before_24h if hours >= 24 else o.cancellation_fee_within_24h
            units = 1 if o.priced_per == "vehicle" else o.travellers
            fee = min(paid - o.convenience_fee, per * units)
            unit_txt = "per vehicle" if o.priced_per == "vehicle" else f"× {o.travellers}"
            rule = f"{'More than' if hours >= 24 else 'Within'} 24h of departure: ₹{per:,} {unit_txt}"
        return {"order_id": order_id, "paid": paid, "cancellation_fee": fee,
                "convenience_fee_non_refundable": o.convenience_fee,
                "refund_amount": max(0, paid - fee - o.convenience_fee),
                "hours_to_departure": round(hours, 1), "rule": rule}

    def cancel(self, order_id: str, customer_confirmed: bool, confirmation_text: str) -> dict:
        guard_text(confirmation_text)
        q = self.quote_refund(order_id)
        require_consent(customer_confirmed, confirmation_text, "Cancelling a booking")
        od = self._order(order_id)
        od.status = "CANCELLED"
        od.refund = {"refund_id": f"RFD-{_h(order_id, 'cxl') % 10**6:06d}", "amount": q["refund_amount"],
                     "fees": q["cancellation_fee"] + q["convenience_fee_non_refundable"], "reason": q["rule"]}
        self._log(od, f"Cancelled after customer said '{confirmation_text.strip()[:60]}'. Refund {od.refund['refund_id']} ₹{q['refund_amount']:,}")
        return od.view()
