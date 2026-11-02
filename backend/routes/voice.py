import os
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, Optional, List
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix="/api/voice", tags=["Voice & Intent Intelligence"])

SARVAM_API_KEY = os.getenv("SARVAM_API_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

class TTSRequest(BaseModel):
    text: str
    target_language_code: str = "en-IN"
    speaker: str = "kavya"

class GeminiChatRequest(BaseModel):
    message: str
    conversation_history: Optional[List[Dict[str, str]]] = []

@router.post("/sarvam-tts")
async def generate_sarvam_tts(req: TTSRequest):
    if not SARVAM_API_KEY:
        raise HTTPException(status_code=400, detail="SARVAM_API_KEY not configured")

    # Clean text of markdown characters
    clean_text = (
        req.text.replace("**", "")
        .replace("₹", "Rupees ")
        .replace("•", ", ")
        .replace("6E-512", "6 E 5 1 2")
        .replace("6E-W8", "6 E W 8")
        .replace("BLR", "Bangalore")
        .replace("GOI", "Goa")
        .replace("GOX", "Goa")
    )

    url = "https://api.sarvam.ai/text-to-speech"
    headers = {
        "api-subscription-key": SARVAM_API_KEY,
        "Content-Type": "application/json",
    }
    payload = {
        "inputs": [clean_text[:500]], # Sarvam single input slice
        "target_language_code": req.target_language_code,
        "speaker": req.speaker,
        "model": "bulbul:v3",
        "pitch": 0,
        "pace": 1.02,
        "loudness": 1.5,
        "speech_sample_rate": 22050,
        "enable_preprocessing": True,
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                audios = data.get("audios", [])
                if audios:
                    return {"success": True, "audio_base64": audios[0], "provider": "sarvam_bulbul_v3"}
            return {"success": False, "error": resp.text}
    except Exception as e:
        return {"success": False, "error": str(e)}

@router.post("/gemini-reasoning")
async def gemini_reasoning(req: GeminiChatRequest):
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=400, detail="GEMINI_API_KEY not configured")

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
    
    system_instruction = (
        "You are VoyAI Naman, an elite voice travel concierge. "
        "Help the traveler plan Bangalore to Goa or Kochi trips with ₹8,000 budget. "
        "Be concise, conversational, professional, and clear. Never invent fares."
    )

    contents = [{"parts": [{"text": f"System: {system_instruction}\nUser: {req.message}"}]}]

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, json={"contents": contents})
            if resp.status_code == 200:
                data = resp.json()
                reply = data["candidates"][0]["content"]["parts"][0]["text"]
                return {"success": True, "reply": reply}
            return {"success": False, "error": resp.text}
    except Exception as e:
        return {"success": False, "error": str(e)}

@router.get("/status")
async def voice_status():
    return {
        "sarvam_tts_ready": bool(SARVAM_API_KEY),
        "sarvam_model": "bulbul:v3 (Speaker: kavya)",
        "gemini_ready": bool(GEMINI_API_KEY),
        "gemini_model": "gemini-2.5-flash",
    }
