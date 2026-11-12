import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from routes import travel, payments, voice, agent

app = FastAPI(
    title="VoyAI Naman - Voice Travel Booking Agent (prototype)",
    description="Gemini NLU + Sarvam TTS proxy (real) and sandbox travel / payment endpoints (simulated).",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(travel.router)
app.include_router(payments.router)
app.include_router(voice.router)
app.include_router(agent.router)

@app.get("/health")
async def health_check():
    return {
        "status": "HEALTHY",
        "service": "VoyAI Naman",
        "llm_configured": bool(os.getenv("GEMINI_API_KEY")),
        "tts_configured": bool(os.getenv("SARVAM_API_KEY")),
        "travel_inventory": "SANDBOX",
        "payments": "SANDBOX"
    }

# Static Files & SPA Frontend Serving
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
DIST_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "dist"))

# Pick static directory if present
SERVE_DIR = STATIC_DIR if os.path.exists(STATIC_DIR) else (DIST_DIR if os.path.exists(DIST_DIR) else None)

if SERVE_DIR and os.path.exists(os.path.join(SERVE_DIR, "index.html")):
    assets_dir = os.path.join(SERVE_DIR, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    docs_dir = os.path.join(SERVE_DIR, "docs")
    if os.path.exists(docs_dir):
        app.mount("/docs-static", StaticFiles(directory=docs_dir), name="docs-static")

    @app.get("/")
    async def serve_index():
        return FileResponse(os.path.join(SERVE_DIR, "index.html"))

    @app.get("/{full_path:path}")
    async def catch_all(full_path: str):
        # Don't intercept API routes or Swagger docs
        if full_path.startswith("api/") or full_path in ["docs", "redoc", "openapi.json", "health"]:
            return {"detail": "Not Found"}
        target = os.path.join(SERVE_DIR, full_path)
        if os.path.exists(target) and os.path.isfile(target):
            return FileResponse(target)
        return FileResponse(os.path.join(SERVE_DIR, "index.html"))
else:
    @app.get("/")
    async def root_fallback():
        return {
            "status": "ONLINE",
            "service": "VoyAI Naman - Autonomous Voice AI Travel Concierge",
            "api_documentation": "/docs",
            "health_check": "/health",
            "endpoints": [
                "/api/travel/search",
                "/api/travel/lock-hold",
                "/api/payments/upi-push",
                "/api/payments/reconcile",
                "/api/voice/sarvam-tts",
                "/api/agent/understand"
            ]
        }

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
