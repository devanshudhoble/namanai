import os
import sys
from datetime import date

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
os.environ["GEMINI_API_KEY"] = ""  # tests must never call the real API

from fastapi.testclient import TestClient  # noqa: E402

import routes.agent as agent  # noqa: E402
from main import app  # noqa: E402

TODAY = date(2026, 11, 12)


def test_valid_understanding_passes_through():
    raw = {
        "intent": "trip_details",
        "slots": {"origin": "mumbai", "destination": "Nagpur", "dateISO": "2026-11-20", "passengers": 2, "mode": "train"},
    }
    out = agent.clean_understanding(raw, TODAY)
    assert out["intent"] == "trip_details"
    assert out["slots"] == {"origin": "Mumbai", "destination": "Nagpur", "dateISO": "2026-11-20", "passengers": 2, "mode": "train"}


def test_implausible_values_are_dropped_not_trusted():
    raw = {
        "intent": "make_me_a_sandwich",
        "slots": {"dateISO": "2026-11-01", "passengers": 40, "destination": "DROP TABLE; --", "budget": 5},
        "reply": "Your PNR is 6E-1234",
    }
    out = agent.clean_understanding(raw, TODAY)
    assert out["intent"] == "other"
    assert out["slots"] == {}  # past date, absurd pax, injection-like city, tiny budget all removed


def test_reply_only_kept_for_small_talk():
    out = agent.clean_understanding({"intent": "trip_details", "slots": {}, "reply": "hello"}, TODAY)
    assert "reply" not in out


def test_understand_returns_503_without_key_so_frontend_falls_back():
    agent.GEMINI_API_KEY = ""
    client = TestClient(app)
    r = client.post("/api/agent/understand", json={"utterance": "Mumbai to Nagpur", "context": ""})
    assert r.status_code == 503
    assert r.json()["reason"] == "llm_not_configured"


def test_health_is_honest_about_sandbox():
    client = TestClient(app)
    body = client.get("/health").json()
    assert body["travel_inventory"] == "SANDBOX"
    assert body["payments"] == "SANDBOX"
