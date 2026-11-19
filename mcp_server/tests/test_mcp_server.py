"""Tests for the MCP booking server: domain rules + a real MCP client talking to the server."""
import asyncio
import json
from datetime import date, datetime, timedelta

import pytest

from mcp_server.travel_core import HarnessViolation, TravelEngine
from mcp_server import server as srv

TODAY = date(2026, 11, 19)


@pytest.fixture
def e():
    return TravelEngine(today=TODAY)


def book(e, origin="Bangalore", dest="Delhi", mode="flight", pax=1):
    r = e.search(origin, dest, "2026-11-25", pax, mode)
    oid = r["cheapest_option_id"]
    hold = e.hold(oid, "Riya Sharma", True, "haan, book kar do")
    e.request_payment(hold["order_id"])
    return hold["order_id"], r


# ----------------------------------------------------------------- search
def test_any_indian_place_works_including_unknown_villages(e):
    r = e.search("Chhindwara", "Seoni", "tomorrow", 1, "all")
    assert r["options"], "unknown towns still get train/bus options"
    assert all(o["mode"] != "flight" for o in r["options"])
    assert any("No airport" in n for n in r["notes"])


def test_colloquial_city_names_are_normalised(e):
    r = e.search("Bombay", "Jodpur", "tomorrow", 2, "all")
    assert (r["origin"], r["destination"]) == ("Mumbai", "Jodhpur")


def test_flight_to_town_without_airport_suggests_nearest(e):
    r = e.search("Delhi", "Haridwar", "tomorrow", 1, "flight")
    assert r["options"] == []
    assert any("Nearest airport: Dehradun" in n for n in r["notes"])


def test_budget_and_time_filters(e):
    r = e.search("Bangalore", "Delhi", "tomorrow", 1, "flight", 6000, "morning")
    assert r["options"] and all(o["total_fare"] <= 6000 for o in r["options"])
    assert all(int(o["departs"][:2]) < 12 for o in r["options"])


def test_search_is_deterministic_so_ids_stay_valid(e):
    a = e.search("Pune", "Goa", "2026-11-25", 2, "bus")
    b = e.search("Pune", "Goa", "2026-11-25", 2, "bus")
    assert [o["option_id"] for o in a["options"]] == [o["option_id"] for o in b["options"]]


def test_past_dates_rejected(e):
    with pytest.raises(ValueError):
        e.search("Pune", "Goa", "2026-11-01", 1, "all")


# ----------------------------------------------------------------- guardrails
def test_credential_guard_blocks_pin_in_any_argument(e):
    with pytest.raises(HarnessViolation):
        e.search("Pune my upi pin is 4821", "Goa", "tomorrow")


def test_hold_requires_explicit_customer_words(e):
    oid = e.search("Mumbai", "Goa", "tomorrow", 1, "flight")["cheapest_option_id"]
    with pytest.raises(HarnessViolation):
        e.hold(oid, "Riya Sharma", False, "haan")
    with pytest.raises(HarnessViolation):
        e.hold(oid, "Riya Sharma", True, "")  # model can't just flip a boolean
    with pytest.raises(HarnessViolation):
        e.hold(oid, "Riya Sharma", True, "nahi, ruko")


def test_unknown_option_id_cannot_be_invented(e):
    with pytest.raises(ValueError):
        e.hold("OPT-12345678", "Riya Sharma", True, "yes")


def test_hold_is_idempotent(e):
    oid = e.search("Mumbai", "Goa", "tomorrow", 1, "flight")["cheapest_option_id"]
    a = e.hold(oid, "Riya Sharma", True, "yes book it")
    b = e.hold(oid, "Riya Sharma", True, "yes")
    assert a["order_id"] == b["order_id"] and b["idempotent_replay"]


# ----------------------------------------------------------------- payments
def test_payment_success_issues_pnr(e):
    order, _ = book(e)
    v = e.sandbox_payment_event(order, "success")
    assert v["status"] == "CONFIRMED" and v["pnr"]


def test_failed_payment_retry_reuses_same_order(e):
    order, _ = book(e)
    e.sandbox_payment_event(order, "bank_timeout")
    v = e.request_payment(order)
    assert v["order_id"] == order and v["payment_attempts"] == 2


def test_debited_pending_reconciles_to_ticket(e):
    order, _ = book(e, "Mumbai", "Nagpur", "train")
    e.sandbox_payment_event(order, "debited_pending")
    v = e.reconcile(order)
    assert v["outcome"] == "TICKET_ISSUED" and v["pnr"]


def test_debited_seat_sold_out_auto_refunds_in_full(e):
    order, _ = book(e, "Mumbai", "Nagpur", "train")
    e.sandbox_payment_event(order, "debited_seat_sold_out")
    v = e.reconcile(order)
    assert v["outcome"] == "AUTO_REFUND" and v["refund"]["amount"] == v["amount"] and v["refund"]["fees"] == 0


# ----------------------------------------------------------------- cancellation
def test_cancel_quotes_refund_and_needs_consent(e):
    order, _ = book(e, pax=2)
    e.sandbox_payment_event(order, "success")
    q = e.quote_refund(order, now=datetime(2026, 11, 20, 9, 0))
    assert q["refund_amount"] == q["paid"] - q["cancellation_fee"] - q["convenience_fee_non_refundable"]
    with pytest.raises(HarnessViolation):
        e.cancel(order, True, "")
    v = e.cancel(order, True, "yes cancel it")
    assert v["status"] == "CANCELLED" and v["refund"]["refund_id"].startswith("RFD-")


# ----------------------------------------------------------------- real MCP protocol
def test_mcp_client_lists_and_calls_tools():
    from mcp.client import Client

    async def run():
        async with Client(srv.mcp) as c:
            tools = {t.name for t in (await c.list_tools()).tools}
            assert {"search_trips", "hold_fare", "request_upi_payment", "reconcile_payment", "cancel_booking"} <= tools
            res = await c.call_tool("search_trips", {"origin": "Bangalore", "destination": "Delhi",
                                                     "travel_date": (date.today() + timedelta(days=1)).isoformat(),
                                                     "mode": "flight", "time_of_day": "morning"})
            payload = res.structured_content or json.loads(res.content[0].text)
            assert payload["options"]
            blocked = await c.call_tool("hold_fare", {"option_id": payload["options"][0]["option_id"],
                                                      "passenger_name": "Riya Sharma", "customer_confirmed": True,
                                                      "confirmation_text": "my otp is 482193"})
            bp = blocked.structured_content or json.loads(blocked.content[0].text)
            assert bp["blocked_by_guardrail"] is True
            resources = {str(r.uri) for r in (await c.list_resources()).resources}
            assert "paytm-travel://policies/guardrails" in resources
            prompts = {p.name for p in (await c.list_prompts()).prompts}
            assert "book_trip" in prompts

    asyncio.run(run())
