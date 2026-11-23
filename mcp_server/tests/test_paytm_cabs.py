"""Paytm Cabs MCP tool contract: PRD acceptance criteria as eval cases."""
import asyncio
import json
from datetime import date, timedelta

import pytest

from mcp_server.cabs import CabsService, WEIGHTS
from mcp_server.travel_core import HarnessViolation, TravelEngine
from mcp_server import server as srv

TODAY = date(2026, 11, 19)


@pytest.fixture
def c():
    return CabsService(TravelEngine(today=TODAY))


def book(c, quote_id):
    hold = c.confirm(quote_id, "Ananya Rao", True, "haan, book karo")
    c.engine.request_payment(hold["order_id"])
    c.engine.sandbox_payment_event(hold["order_id"], "success")
    return hold["order_id"]


def test_airport_pickup_is_flight_linked_with_fixed_night_fare(c):
    r = c.search_rides("airport", "2026-11-20", 1, flight_number="6E 2134")
    sedan = next(q for q in r["quotes"] if q["travel_class"] == "Sedan")
    assert sedan["total_fare"] == 1150  # 1000 base + 100 toll/parking + 50 night (case study example)
    assert sedan["extras"]["flight"] == "6E 2134"


def test_fixed_fare_charge_equals_quote(c):
    q = c.search_rides("rental", "2026-11-21", 5, hours=8, planned_km=95)["quotes"][0]
    b = q["extras"]["price_breakdown"]
    assert sum(v for k, v in b.items() if k != "total") == b["total"] == q["total_fare"]
    assert b["extra_km"] > 0  # 95 km plan on an 80 km package


def test_flight_delay_moves_pickup_at_no_charge(c):
    q = c.search_rides("airport", "2026-11-20", 1, flight_number="6E 2134")["quotes"][0]
    order = book(c, q["quote_id"])
    before = c.engine.status(order)["trip"]["departs"]
    r = c.report_flight_delay(order, "6E 2134", 45)
    assert r["pickup_moved"] and r["pickup"] != before and r["extra_charge"] == 0
    assert r["amount"] == q["total_fare"]


def test_no_show_gets_backup_at_same_fare(c):
    q = c.search_rides("airport", "2026-11-20", 1, flight_number="6E 2134")["quotes"][0]
    order = book(c, q["quote_id"])
    r = c.report_no_show(order)
    assert r["eta_minutes"] == 5 and r["amount"] == q["total_fare"]
    assert r["backup_provider"] not in q["operator"]


def test_no_quote_id_no_fare(c):
    with pytest.raises(HarnessViolation):
        c.confirm("QT-MADEUP", "Ravi Kumar", True, "yes")
    with pytest.raises(HarnessViolation):
        c.get_quote("anything")


def test_confirm_needs_riders_own_yes(c):
    q = c.search_rides("rental", "2026-11-21", 2, hours=4)["quotes"][0]
    with pytest.raises(HarnessViolation):
        c.confirm(q["quote_id"], "Ravi Kumar", True, "")


def test_recommender_picks_a_car_that_fits_under_budget(c):
    r = c.search_rides("trip", "2026-11-27", 5, destination="Coorg", days=3, bags=4)
    ids = [q["quote_id"] for q in r["quotes"]]
    top = c.recommend(ids, 5, 4, budget=10000, elderly=True, ghats=True)["ranked"][0]
    assert top["extras"]["seats"] >= 5 and top["total_fare"] <= 10000 and "Under budget" in top["why"]
    assert abs(sum(WEIGHTS.values()) - 1) < 1e-9


def test_interstate_trip_adds_permit_upfront(c):
    r = c.search_rides("trip", "2026-11-27", 2, destination="Wayanad", days=2)
    assert all(q["extras"]["price_breakdown"].get("state_permit") for q in r["quotes"])


def test_city_rules_engine_blocks_private_carpool_in_bengaluru(c):
    blr = c.search_rides("share", "2026-11-20", 1, from_area="HSR", to_area="Whitefield", city="Bengaluru")
    assert not any(q["extras"].get("colleague_carpool") for q in blr["quotes"])
    pune = c.search_rides("share", "2026-11-20", 1, from_area="Wakad", to_area="Hinjewadi", city="Pune")
    assert any(q["extras"].get("colleague_carpool") for q in pune["quotes"])


def test_women_only_shows_only_verified_top_rated_women_drivers(c):
    r = c.search_rides("rental", "2026-11-21", 2, hours=8, women_only=True)
    assert r["quotes"] and all(q["extras"]["women_driver"] and q["extras"]["rating"] >= 4.5 for q in r["quotes"])


def test_compare_tags_best_value_and_most_reliable(c):
    ids = [q["quote_id"] for q in c.search_rides("rental", "2026-11-21", 4, hours=8)["quotes"]]
    tags = {r.get("tag") for r in c.compare(ids)["rows"]}
    assert {"Best value", "Most reliable"} <= tags


def test_mcp_exposes_case_study_tool_contract():
    from mcp.client import Client

    async def run():
        async with Client(srv.mcp) as cl:
            tools = {t.name for t in (await cl.list_tools()).tools}
            assert {"search_rides", "recommend", "compare", "get_quote", "confirm", "track_flight",
                    "report_flight_delay", "report_no_show"} <= tools
            res = await cl.call_tool("search_rides", {"product": "airport", "flight_number": "6E 2134",
                                                      "pickup_date": (date.today() + timedelta(days=1)).isoformat()})
            payload = res.structured_content or json.loads(res.content[0].text)
            assert payload["quotes"][0]["quote_id"].startswith("QT")

    asyncio.run(run())
