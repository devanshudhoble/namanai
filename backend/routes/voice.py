import os
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix="/api/voice", tags=["Voice & Intent Intelligence"])

SARVAM_API_KEY = os.getenv("SARVAM_API_KEY", "")

ALLOWED_LANGS = {"en-IN", "hi-IN"}


class TTSRequest(BaseModel):
    text: str = Field(..., max_length=600)
    target_language_code: str = "en-IN"
    speaker: str = "kavya"

@router.post("/sarvam-tts")
async def generate_sarvam_tts(req: TTSRequest):
    if not SARVAM_API_KEY:
        raise HTTPException(status_code=400, detail="SARVAM_API_KEY not configured")

    # Clean text of markdown characters
    clean_text = req.text.replace("**", "").replace("₹", "Rupees ").replace("•", ", ")
    lang = req.target_language_code if req.target_language_code in ALLOWED_LANGS else "en-IN"

    url = "https://api.sarvam.ai/text-to-speech"
    headers = {
        "api-subscription-key": SARVAM_API_KEY,
        "Content-Type": "application/json",
    }
    payload = {
        "inputs": [clean_text[:500]], # Sarvam single input slice
        "target_language_code": lang,
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

@router.get("/status")
async def voice_status():
    return {
        "sarvam_tts_ready": bool(SARVAM_API_KEY),
        "sarvam_model": "bulbul:v3 (Speaker: kavya)",
    }
