from fastapi import APIRouter
from pydantic import BaseModel
from typing import Dict, Any, Optional

router = APIRouter(prefix="/api/voice", tags=["Voice & Intent Intelligence"])

class IntentRequest(BaseModel):
    utterance: str
    session_id: str
    context: Optional[Dict[str, Any]] = None

@router.post("/intent")
async def parse_speech_intent(req: IntentRequest):
    text = req.utterance.lower()
    
    # Deterministic intent classification fallback
    if "goa" in text and ("bangalore" in text or "blr" in text):
        return {
            "intent": "SEARCH_TRAVEL_INTENT",
            "slots": {
                "origin": "BLR",
                "destination": "GOX",
                "date": "2026-11-06",
                "budget": 8000.0,
                "preference": "convenience"
            },
            "suggested_tool": "search_transport_options"
        }
    elif "baggage" in text or "check-in" in text:
        return {
            "intent": "QUERY_ANCILLARY_BAGGAGE",
            "slots": {"target_flight": "6E-512"},
            "suggested_tool": "check_fare_rules"
        }
    elif "deducted" in text or "pending" in text:
        return {
            "intent": "RECONCILE_TRANSACTION_STATUS",
            "slots": {},
            "suggested_tool": "reconcile_money_deducted_ticket_pending"
        }
    
    return {
        "intent": "GENERAL_QUERY",
        "slots": {},
        "suggested_tool": None
    }
