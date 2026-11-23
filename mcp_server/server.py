"""
VoyAI Naman travel booking MCP server (SANDBOX).

Exposes the booking tools as a Model Context Protocol server so ANY agent
(Claude Desktop, a WhatsApp bot, the voice web app, another LLM) can search
and book with the same tools AND the same guardrails.

Run (stdio):            python -m mcp_server.server
Run (HTTP, for remote): python -m mcp_server.server --http
"""

from __future__ import annotations

import json
import sys

from mcp.server import MCPServer
from mcp.types import ToolAnnotations

from .travel_core import HarnessViolation, TravelEngine, list_known_places

INSTRUCTIONS = """You are connected to a SANDBOX travel booking system for India (flights, trains, buses, chauffeur-driven cars, carpool).
Follow these rules. The server also enforces them, so breaking them only produces errors:
1. Resolve dates to YYYY-MM-DD before calling search_trips. Any Indian city, town or village is allowed.
2. Only quote prices, PNRs, order ids and refund amounts that a tool returned. Never estimate them.
3. Before hold_fare: read back operator, departure time, total fare and refund rule, then ask "Shall I book it?".
   Call hold_fare only after the customer says yes, passing their exact words as confirmation_text.
4. Never ask for, accept or repeat a UPI PIN, OTP, CVV or card number. Payment is approved on the UPI screen.
5. If money was debited but there is no ticket, call reconcile_payment. Don't guess the outcome.
6. Before cancel_booking, call quote_refund and tell the customer the exact refund. Cancel only after a yes.
7. Cars (search_cars): say the ALL-INCLUSIVE total, what it includes, km included and the extra-km rate.
   Tell the customer they pay nothing extra to the driver. Never quote a lower "base" price on its own.
8. Carpool (search_carpool): only where available=true. The price is a cost share; never negotiate it."""

mcp = MCPServer(
    name="voyai-naman-travel",
    title="VoyAI Naman travel booking (sandbox)",
    description="Search and book Indian flights, trains, buses, cars and carpool with consent, credential and grounding guardrails.",
    instructions=INSTRUCTIONS,
    version="1.1.0",
)
engine = TravelEngine()

READ_ONLY = ToolAnnotations(readOnlyHint=True, destructiveHint=False, idempotentHint=True, openWorldHint=False)
WRITE = ToolAnnotations(readOnlyHint=False, destructiveHint=False, idempotentHint=True, openWorldHint=False)
DESTRUCTIVE = ToolAnnotations(readOnlyHint=False, destructiveHint=True, idempotentHint=False, openWorldHint=False)


def _safe(fn, *args, **kwargs) -> dict:
    """Turn rule violations and bad input into a clear, structured error the model can relay."""
    try:
        return fn(*args, **kwargs)
    except HarnessViolation as e:
        return {"ok": False, "blocked_by_guardrail": True, "message": str(e)}
    except ValueError as e:
        return {"ok": False, "message": str(e)}


# ------------------------------------------------------------------ tools
@mcp.tool(annotations=READ_ONLY)
def search_trips(origin: str, destination: str, travel_date: str, travellers: int = 1, mode: str = "all",
                 max_total_budget: int | None = None, time_of_day: str | None = None) -> dict:
    """Search flights, trains and buses between any two places in India.

    Args:
        origin: City, town or village (e.g. "Bangalore", "Wardha").
        destination: City, town or village.
        travel_date: YYYY-MM-DD, or "today" / "tomorrow".
        travellers: 1-9.
        mode: "flight", "train", "bus" or "all".
        max_total_budget: Optional cap on the total fare for all travellers, in rupees.
        time_of_day: Optional "morning", "afternoon", "evening" or "night".

    Returns options sorted by total fare, plus cheapest_option_id, fastest_option_id and notes
    (e.g. a town has no airport). All prices are server-side sandbox values.
    """
    return _safe(engine.search, origin, destination, travel_date, travellers, mode, max_total_budget, time_of_day)


@mcp.tool(annotations=READ_ONLY)
def search_cars(origin: str, pickup_date: str, destination: str | None = None, pickup_time: str = "09:00",
                travellers: int = 1, bags: int | None = None, trip_type: str = "one_way",
                return_date: str | None = None, hours: int | None = None) -> dict:
    """Chauffeur-driven cars from verified local tours & travels operators anywhere in India.

    Args:
        origin: Pickup city, town or village (e.g. "Pune", "Nagpur").
        pickup_date: YYYY-MM-DD, or "today" / "tomorrow".
        destination: Drop city for one_way / round_trip. Not needed for local_hourly or airport_transfer.
        pickup_time: "HH:MM" 24h, or like "6 am".
        travellers: 1-12. Only cars with enough seats are returned.
        bags: Number of bags (default = travellers). Only cars with enough boot space are returned.
        trip_type: "one_way", "round_trip", "local_hourly" or "airport_transfer".
        return_date: Required for round_trip.
        hours: 4, 8 or 12 for local_hourly.

    Returns cars sorted by total. Each total is ALL-INCLUSIVE (tolls, state tax, driver allowance, night charge, GST)
    with a price_breakdown that adds up to it, km_included and extra_km_rate. Read these back before hold_fare.
    The same hold_fare / request_upi_payment / quote_refund / cancel_booking tools book and cancel a car.
    """
    return _safe(engine.search_cars, origin, destination, pickup_date, pickup_time, travellers, bags,
                 trip_type, return_date, hours)


@mcp.tool(annotations=READ_ONLY)
def search_carpool(city: str, from_area: str, to_area: str, travel_date: str, depart_time: str = "09:00",
                   seats: int = 1, community: str = "office", women_only: bool = False) -> dict:
    """Cost-shared carpool for office or college commutes inside a city.

    Args:
        city: City (e.g. "Pune").
        from_area: Pickup area or landmark (e.g. "Wakad").
        to_area: Drop area or landmark (e.g. "Hinjewadi Phase 1").
        travel_date: YYYY-MM-DD, or "today" / "tomorrow".
        depart_time: "HH:MM" or like "9 am".
        seats: 1-3.
        community: "office" (verified work email), "college" (verified student ID) or "public" (Paytm KYC).
        women_only: Only women drivers and co-riders.

    Available only in states whose rules allow app-based carpool in private cars; elsewhere returns
    available=false. The price is a computed non-profit fuel cost share, never set by the driver.
    """
    return _safe(engine.search_carpool, city, from_area, to_area, travel_date, depart_time, seats, community, women_only)


@mcp.tool(annotations=READ_ONLY)
def get_fare_rules(option_id: str) -> dict:
    """Baggage, refund rule and cancellation fees for an option returned by search_trips."""
    return _safe(engine.fare_rules, option_id)


@mcp.tool(annotations=WRITE)
def hold_fare(option_id: str, passenger_name: str, customer_confirmed: bool, confirmation_text: str) -> dict:
    """Lock the fare for 10 minutes. Requires the customer's explicit approval.

    Args:
        option_id: From search_trips.
        passenger_name: Lead passenger's full name as on ID.
        customer_confirmed: True only if the customer said yes to the read-back.
        confirmation_text: The customer's exact confirming words, e.g. "haan, book kar do".

    Idempotent: the same option and passenger return the same order while the hold is live.
    """
    return _safe(engine.hold, option_id, passenger_name, customer_confirmed, confirmation_text)


@mcp.tool(annotations=WRITE)
def request_upi_payment(order_id: str) -> dict:
    """Create the UPI payment request for a held order. The customer approves it in the UPI app.
    Never ask for a PIN or OTP. Retries reuse the same order id, so the customer can't be charged twice."""
    return _safe(engine.request_payment, order_id)


@mcp.tool(annotations=WRITE)
def sandbox_payment_event(order_id: str, outcome: str) -> dict:
    """SANDBOX ONLY: simulate what the bank reports for a payment (a webhook in production).

    outcome: "success", "declined", "bank_timeout", "insufficient_funds",
             "debited_pending" (money taken, ticket not issued) or
             "debited_seat_sold_out" (money taken, hold expired, seat gone).
    """
    return _safe(engine.sandbox_payment_event, order_id, outcome)


@mcp.tool(annotations=READ_ONLY)
def get_booking_status(order_id: str) -> dict:
    """Current status, PNR, amount, refund and audit trail for an order."""
    return _safe(engine.status, order_id)


@mcp.tool(annotations=WRITE)
def reconcile_payment(order_id: str) -> dict:
    """Use when the customer says money was deducted but there's no ticket.
    Runs a 3-way check (bank, ledger, inventory) and either issues the ticket or starts a full refund."""
    return _safe(engine.reconcile, order_id)


@mcp.tool(annotations=READ_ONLY)
def quote_refund(order_id: str) -> dict:
    """Exact refund if a confirmed booking is cancelled now. Tell the customer this before cancelling."""
    return _safe(engine.quote_refund, order_id)


@mcp.tool(annotations=DESTRUCTIVE)
def cancel_booking(order_id: str, customer_confirmed: bool, confirmation_text: str) -> dict:
    """Cancel a confirmed booking and start the refund. Only after quoting the refund and
    getting the customer's yes, passing their exact words as confirmation_text."""
    return _safe(engine.cancel, order_id, customer_confirmed, confirmation_text)


# ------------------------------------------------------------------ resources
@mcp.resource("paytm-travel://policies/guardrails", name="booking-guardrails", mime_type="text/markdown",
              description="The safety rules this server enforces on every tool call.")
def guardrails() -> str:
    return "# Booking guardrails\n\n" + INSTRUCTIONS + (
        "\n\nEnforced in code: credential guard on every text argument, consent gate on hold and cancel, "
        "server-side prices only, idempotent holds and payment retries, deterministic sandbox inventory, "
        "car fare breakdowns that must add up to the total, carpool prices capped at the non-profit cost share, "
        "carpool only in states that permit it."
    )


@mcp.resource("paytm-travel://places/known", name="known-places", mime_type="application/json",
              description="Hubs with real airport and station names. Any other Indian place also works (generated sandbox station).")
def known_places() -> str:
    return json.dumps(list_known_places(), ensure_ascii=False)


# ------------------------------------------------------------------ prompts
@mcp.prompt(title="Book a trip safely")
def book_trip(request: str) -> str:
    """Start a booking conversation from one free-text request (English, Hindi or Hinglish)."""
    return (
        f"The customer said: \"{request}\".\n"
        "Extract origin, destination, date, travellers, mode, time of day and budget. Ask only for what is missing. "
        "Then call search_trips, name the fastest and the cheapest option, and follow the server's guardrails: "
        "read back and get an explicit yes before hold_fare, never handle a PIN or OTP, quote only tool-returned prices."
    )


def main() -> None:
    if "--http" in sys.argv:
        mcp.run(transport="streamable-http")
    else:
        mcp.run()


if __name__ == "__main__":
    main()
