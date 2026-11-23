"""Cars (outstation / hourly / airport) and carpool: domain rules + MCP tools."""
import asyncio
import json
from datetime import date, datetime, timedelta

import pytest

from mcp_server.travel_core import HarnessViolation, TravelEngine, carpool_cost_share
from mcp_server import server as srv

TODAY = date(2026, 11, 19)


@pytest.fixture
def e():
    return TravelEngine(today=TODAY)


# ----------------------------------------------------------------- cars
def test_one_way_car_quote_is_all_inclusive_and_adds_up(e):
    r = e.search_cars("Pune", "Mahabaleshwar", "2026-11-25", "6 am", travellers=4, bags=4)
    assert r["options"]
    for o in r["options"]:
        b = o["extras"]["price_breakdown"]
        assert sum(v for k, v in b.items() if k != "total") == b["total"]
        assert o["total_fare"] == b["total"] + o["convenience_fee"]
        assert o["priced_per"] == "vehicle" and o["extras"]["no_cash_to_driver"] is True
        assert "driver_allowance" in b  # outstation includes the driver's allowance


def test_only_cars_that_fit_people_and_bags_are_shown(e):
    r = e.search_cars("Jaipur", "Ajmer", "2026-11-25", travellers=6, bags=4)
    cats = {o["travel_class"] for o in r["options"]}
    assert "Sedan" not in cats and "Hatchback" not in cats
    assert all(o["extras"]["seats"] >= 6 and o["extras"]["bags"] >= 4 for o in r["options"])


def test_too_big_a_group_gets_a_clear_note(e):
    r = e.search_cars("Jaipur", "Ajmer", "2026-11-25", travellers=12, bags=12)
    assert r["options"] == [] and any("No single car fits" in n for n in r["notes"])


def test_round_trip_bills_minimum_km_per_day(e):
    r = e.search_cars("Jaipur", "Ajmer", "2026-11-25", travellers=2, trip_type="round_trip", return_date="2026-11-26")
    o = r["options"][0]
    assert o["extras"]["days"] == 2 and o["extras"]["km_included"] >= 500


def test_interstate_trip_includes_permit_tax(e):
    r = e.search_cars("Delhi", "Agra", "2026-11-25", travellers=2)
    assert all("state_permit_tax" in o["extras"]["price_breakdown"] for o in r["options"])


def test_hourly_and_airport_transfer(e):
    h = e.search_cars("Lucknow", None, "2026-11-25", "10:00", travellers=3, trip_type="local_hourly", hours=8)
    assert h["options"][0]["extras"]["km_included"] == 80
    a = e.search_cars("Nagpur", None, "2026-11-25", "05:30", travellers=1, trip_type="airport_transfer")
    assert "night_charge" in a["options"][0]["extras"]["price_breakdown"]  # pre-6am pickup
    with pytest.raises(ValueError):
        e.search_cars("Wardha", None, "2026-11-25", trip_type="airport_transfer")


def test_car_booking_reuses_consent_payment_and_per_vehicle_refund(e):
    r = e.search_cars("Nagpur", "Wardha", "2026-11-25", "07:30", travellers=2)
    oid = r["cheapest_option_id"]
    with pytest.raises(HarnessViolation):
        e.hold(oid, "Sunita Deshmukh", True, "")
    hold = e.hold(oid, "Sunita Deshmukh", True, "haan, book kar do")
    e.request_payment(hold["order_id"])
    e.sandbox_payment_event(hold["order_id"], "success")
    q = e.quote_refund(hold["order_id"], now=datetime(2026, 11, 20, 9, 0))
    assert q["cancellation_fee"] == 200  # one flat fee per car, not per traveller
    assert "per vehicle" in q["rule"]


def test_credential_guard_on_car_search(e):
    with pytest.raises(HarnessViolation):
        e.search_cars("Pune", "Goa", "2026-11-25", "my upi pin is 4821")


def test_train_search_suggests_a_car_for_short_routes(e):
    r = e.search("Nagpur", "Wardha", "2026-11-25", 1, "all")
    assert any("search_cars" in n for n in r["notes"])


# ----------------------------------------------------------------- carpool
def test_carpool_price_is_the_non_profit_cost_share(e):
    r = e.search_carpool("Pune", "Wakad", "Hinjewadi Phase 1", "2026-11-25", "9 am")
    assert r["available"] and r["options"]
    for o in r["options"]:
        assert o["fare_per_traveller"] == o["extras"]["max_share_allowed"]
        assert o["fare_per_traveller"] <= carpool_cost_share(o["extras"]["km"], 2)


def test_carpool_only_in_permitted_states(e):
    r = e.search_carpool("Bengaluru", "Whitefield", "Electronic City", "2026-11-25")
    assert r["available"] is False and r["options"] == []


def test_women_only_carpool(e):
    r = e.search_carpool("Mumbai", "Andheri East", "Powai", "2026-11-25", "8:30", women_only=True)
    assert all(o["extras"]["driver_gender"] == "F" for o in r["options"])


def test_tampered_carpool_price_is_blocked(e):
    r = e.search_carpool("Pune", "Wakad", "Hinjewadi Phase 1", "2026-11-25")
    oid = r["options"][0]["option_id"]
    e.options[oid].fare_per_traveller += 200  # e.g. a driver trying to profit
    with pytest.raises(HarnessViolation):
        e.hold(oid, "Meera Joshi", True, "yes book it")


# ----------------------------------------------------------------- MCP protocol
def test_mcp_exposes_car_and_carpool_tools():
    from mcp.client import Client

    async def run():
        async with Client(srv.mcp) as c:
            tools = {t.name for t in (await c.list_tools()).tools}
            assert {"search_cars", "search_carpool"} <= tools
            tomorrow = (date.today() + timedelta(days=1)).isoformat()
            res = await c.call_tool("search_cars", {"origin": "Pune", "destination": "Lonavala",
                                                    "pickup_date": tomorrow, "travellers": 3})
            payload = res.structured_content or json.loads(res.content[0].text)
            assert payload["options"] and payload["options"][0]["mode"] == "cab"

    asyncio.run(run())
