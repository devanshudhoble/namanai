"""
Language understanding endpoint.

The browser sends: the user's utterance + a context prompt assembled by the
Context Engineering Harness (policy, slot ledger, options on screen, recent turns).
Gemini returns JSON constrained by a response schema. We then validate it again
server-side, because a schema guarantees shape, not sense.

If GEMINI_API_KEY is not set (or Gemini is slow / down) we return 503 and the
frontend falls back to its deterministic rules engine, so the demo never breaks.
"""

import json
import os
import re
import time
from datetime import date
from typing import Any, Dict, Optional

import httpx
from dotenv import load_dotenv
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

load_dotenv()

router = APIRouter(prefix="/api/agent", tags=["Agent understanding"])

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
GEMINI_TIMEOUT_S = float(os.getenv("GEMINI_TIMEOUT_S", "6"))

INTENTS = [
    "trip_details", "ask_cheaper", "ask_fastest", "ask_morning", "select_option", "approve", "decline",
    "give_name", "ask_baggage", "ask_cancellation_policy", "cancel_booking", "payment_issue",
    "payment_failed", "shift_date", "booking_status", "greeting", "other",
]
MODES = ["flight", "train", "bus", "hotel", "all"]

RESPONSE_SCHEMA: Dict[str, Any] = {
    "type": "OBJECT",
    "properties": {
        "intent": {"type": "STRING", "enum": INTENTS},
        "slots": {
            "type": "OBJECT",
            "properties": {
                "destination": {"type": "STRING"},
                "origin": {"type": "STRING"},
                "dateISO": {"type": "STRING", "description": "YYYY-MM-DD"},
                "passengers": {"type": "INTEGER"},
                "mode": {"type": "STRING", "enum": MODES},
                "tripType": {"type": "STRING", "enum": ["one-way", "return"]},
                "travelClass": {"type": "STRING"},
                "timePreference": {"type": "STRING", "enum": ["morning", "afternoon", "evening", "night"]},
                "budget": {"type": "INTEGER"},
                "passengerName": {"type": "STRING"},
            },
        },
        "selection": {
            "type": "OBJECT",
            "properties": {
                "mode": {"type": "STRING", "enum": ["flight", "train", "bus", "hotel"]},
                "index": {"type": "INTEGER", "description": "1-based option number the user referred to"},
            },
        },
        "dateShiftDays": {"type": "INTEGER"},
        "reply": {"type": "STRING", "description": "Only for greeting/other: one short polite sentence. No prices, no PNRs."},
    },
    "required": ["intent", "slots"],
}


class UnderstandRequest(BaseModel):
    utterance: str = Field(..., max_length=500)
    context: str = Field("", max_length=8000)
    today: Optional[str] = None


_ISO = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_NAME = re.compile(r"^[A-Za-z][A-Za-z .'-]{1,60}$")


def clean_understanding(raw: Dict[str, Any], today: date) -> Dict[str, Any]:
    """Second line of defence after the schema: drop anything implausible instead of trusting it."""
    intent = raw.get("intent") if raw.get("intent") in INTENTS else "other"
    s = raw.get("slots") or {}
    out: Dict[str, Any] = {}

    for key in ("destination", "origin"):
        v = s.get(key)
        if isinstance(v, str) and 2 <= len(v.strip()) <= 40 and re.match(r"^[A-Za-z .'-]+$", v.strip()):
            out[key] = v.strip().title()

    d = s.get("dateISO")
    if isinstance(d, str) and _ISO.match(d):
        try:
            parsed = date.fromisoformat(d)
            if 0 <= (parsed - today).days <= 365:  # no past dates, no dates a year out
                out["dateISO"] = d
        except ValueError:
            pass

    p = s.get("passengers")
    if isinstance(p, int) and 1 <= p <= 9:
        out["passengers"] = p
    if s.get("mode") in MODES:
        out["mode"] = s["mode"]
    if s.get("tripType") in ("one-way", "return"):
        out["tripType"] = s["tripType"]
    if isinstance(s.get("travelClass"), str) and len(s["travelClass"]) <= 20:
        out["travelClass"] = s["travelClass"].upper().replace(" ", "")
    if s.get("timePreference") in ("morning", "afternoon", "evening", "night"):
        out["timePreference"] = s["timePreference"]
    b = s.get("budget")
    if isinstance(b, int) and 100 <= b <= 500000:
        out["budget"] = b
    n = s.get("passengerName")
    if isinstance(n, str) and _NAME.match(n.strip()):
        out["passengerName"] = n.strip()

    result: Dict[str, Any] = {"intent": intent, "slots": out}
    sel = raw.get("selection") or {}
    selection: Dict[str, Any] = {}
    if sel.get("mode") in ("flight", "train", "bus", "hotel"):
        selection["mode"] = sel["mode"]
    if isinstance(sel.get("index"), int) and 1 <= sel["index"] <= 10:
        selection["index"] = sel["index"]
    if selection:
        result["selection"] = selection
    shift = raw.get("dateShiftDays")
    if isinstance(shift, int) and -7 <= shift <= 7 and shift != 0:
        result["dateShiftDays"] = shift
    reply = raw.get("reply")
    if intent in ("greeting", "other") and isinstance(reply, str) and 0 < len(reply) <= 200:
        result["reply"] = reply.strip()
    return result


@router.post("/understand")
async def understand(req: UnderstandRequest):
    if not GEMINI_API_KEY:
        return JSONResponse(status_code=503, content={"ok": False, "reason": "llm_not_configured"})

    today = date.today()
    if req.today and _ISO.match(req.today):
        try:
            today = date.fromisoformat(req.today)
        except ValueError:
            pass

    body = {
        "systemInstruction": {"parts": [{"text": req.context}]},
        "contents": [{"role": "user", "parts": [{"text": f"LATEST USER UTTERANCE: {req.utterance}"}]}],
        "generationConfig": {
            "temperature": 0,
            "responseMimeType": "application/json",
            "responseSchema": RESPONSE_SCHEMA,
            "thinkingConfig": {"thinkingBudget": 0},  # NLU does not need thinking; keeps voice latency low
        },
    }
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
    t0 = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=GEMINI_TIMEOUT_S) as client:
            resp = await client.post(url, json=body, headers={"x-goog-api-key": GEMINI_API_KEY})
        if resp.status_code != 200:
            return JSONResponse(status_code=502, content={"ok": False, "reason": f"llm_http_{resp.status_code}"})
        text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
        raw = json.loads(text)
    except (httpx.HTTPError, KeyError, IndexError, ValueError):
        return JSONResponse(status_code=502, content={"ok": False, "reason": "llm_unavailable"})

    return {
        "ok": True,
        "understanding": clean_understanding(raw, today),
        "model": GEMINI_MODEL,
        "latency_ms": round((time.perf_counter() - t0) * 1000),
    }


@router.get("/status")
async def status():
    return {"llm_configured": bool(GEMINI_API_KEY), "model": GEMINI_MODEL}
