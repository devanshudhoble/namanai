from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import travel, payments, voice

app = FastAPI(
    title="VoyAI Naman - Autonomous Voice AI Travel Concierge Engine",
    description="Production-grade API for Voice AI Travel Booking, Out-of-band Payments & GDS Grounding",
    version="1.0.0"
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

@app.get("/health")
async def health_check():
    return {
        "status": "HEALTHY",
        "service": "VoyAI Autonomous Engine",
        "gds_grounding": "ACTIVE",
        "payment_guard": "OUT_OF_BAND_UPI"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
