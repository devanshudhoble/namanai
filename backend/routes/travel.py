from fastapi import APIRouter, HTTPException
from typing import List
from models import SearchRequest, TravelOptionResponse, LockHoldRequest, LockHoldResponse
import time
import random

router = APIRouter(prefix="/api/travel", tags=["Travel Engine"])

MOCK_INVENTORY = [
    {
        "id": "opt-indigo-6e512",
        "mode": "flight",
        "provider": "IndiGo Airlines",
        "operator": "IndiGo",
        "service_number": "6E-512",
        "origin": "Bengaluru",
        "origin_code": "BLR",
        "destination": "Goa (Mopa)",
        "dest_code": "GOX",
        "departure_time": "11:15 AM",
        "arrival_time": "12:30 PM",
        "duration": "1h 15m (Non-stop)",
        "price": 5400.0,
        "baggage": {
            "cabin": "7 kg Hand Bag",
            "check_in": "15 kg Check-in Included"
        },
        "cancellation": {
            "refundable": True,
            "refund_summary": "Partial refund up to 2h prior",
            "fee_before_24h": 1500.0,
            "fee_within_24h": 3000.0
        },
        "trade_off_description": "Fastest morning flight within budget. 15 kg check-in baggage included.",
        "is_recommended": True
    },
    {
        "id": "opt-smartbus-sleeper",
        "mode": "bus",
        "provider": "IntrCity SmartBus",
        "operator": "IntrCity",
        "service_number": "IC-GOA-EXP",
        "origin": "Bengaluru (Indiranagar)",
        "origin_code": "BLR-IND",
        "destination": "Goa (Panjim)",
        "dest_code": "GOA-PNJ",
        "departure_time": "09:30 PM (Thu Night)",
        "arrival_time": "08:00 AM (Fri Morning)",
        "duration": "10h 30m (Overnight AC Sleeper)",
        "price": 2200.0,
        "baggage": {
            "cabin": "5 kg Hand Bag",
            "check_in": "20 kg Compartment"
        },
        "cancellation": {
            "refundable": True,
            "refund_summary": "Full refund 12h prior",
            "fee_before_24h": 200.0,
            "fee_within_24h": 1100.0
        },
        "trade_off_description": "Budget alternative. Leaves ₹5,800 savings in budget.",
        "is_recommended": False
    }
]

@router.post("/search", response_model=List[TravelOptionResponse])
async def search_options(req: SearchRequest):
    # Filter by budget
    results = [opt for opt in MOCK_INVENTORY if opt["price"] <= req.budget + 1000]
    return results

@router.post("/lock-hold", response_model=LockHoldResponse)
async def lock_hold(req: LockHoldRequest):
    order_id = f"ORD-VOY-{random.randint(100000, 999999)}"
    pnr = f"6E-W8{random.randint(1000, 9999)}"
    expires_at = int(time.time() * 1000) + (10 * 60 * 1000)
    
    return LockHoldResponse(
        order_id=order_id,
        pnr=pnr,
        amount=5400.0,
        hold_expires_at=expires_at,
        fare_guaranteed=True,
        status="HELD"
    )
