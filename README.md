# VoyAI Naman – Autonomous Voice AI Travel Concierge

[![Build Status](https://img.shields.io/badge/Build-Passing-brightgreen)]()
[![Frontend](https://img.shields.io/badge/Frontend-React%20%7C%20TypeScript%20%7C%20TailwindCSS-blue)]()
[![Backend](https://img.shields.io/badge/Backend-FastAPI%20%7C%20Python%203.13-teal)]()
[![Zero-Hallucination](https://img.shields.io/badge/Grounding-Deterministic%20GDS%20API-emerald)]()
[![Security](https://img.shields.io/badge/Payment-Out--of--Band%20UPI-cyan)]()

> **VoyAI Naman** is an enterprise-grade Autonomous Voice AI Travel Concierge built for modern travel platforms. It collapses the tedious multi-screen search-and-booking funnel into a single continuous, natural voice conversation.

---

## 🌟 Key Capabilities & Architectural Pillars

### 1. AI-Driven Analytics for Customer Journeys (Pillar 1)
- **Acoustic Prosody & Hesitation Radar:** Detects hesitation when pauses exceed 3.5 seconds post-pricing, dynamically clarifying payment terms or surfacing sleeper alternatives.
- **Micro-Funnel Telemetry:** Emits real-time events (`intent_extracted`, `options_compared`, `seat_hold_locked`, `out_of_band_payment_pushed`).
- **Real-Time Latency Breakdown:** Telemetry waterfall tracking STT ($280\text{ms}$), LLM Reasoning ($340\text{ms}$), Travel API ($190\text{ms}$), and TTS ($210\text{ms}$) under an end-to-end target of $<800\text{ms}$ to $1,020\text{ms}$.

### 2. Optimising Booking Conversions (Pillar 2)
- **Elimination of Choice Paralysis:** Synthesizes large multi-option inventory grids into the **Top 2 curated trade-offs** (e.g. IndiGo morning non-stop flight vs IntrCity SmartBus sleeper).
- **Proactive Friction Pre-emption:** Clarifies baggage allowances (15 kg check-in + 7 kg cabin) and cancellation rules before user hesitation leads to drop-off.
- **Zero-Typing Checkout:** Voice confirmation locks passenger records and sets up instant booking.

### 3. Payments & Transaction Support (Pillar 3)
- **Zero-Voice-Credentials Security Protocol:** Strictly forbids asking for or transmitting UPI PINs, CVVs, passwords, or OTPs over voice channels.
- **Out-of-Band UPI Push:** Pushes an instant UPI collect request or QR payment directly to the user's phone app (Google Pay, PhonePe, Paytm).
- **Automated 3-Way Reconciliation Engine:** Automatically resolves the high-anxiety exception *"My money was deducted, but my ticket is not confirmed"* across Bank Gateway $\leftrightarrow$ Internal Ledger $\leftrightarrow$ GDS Reservation Desk within seconds.

### 4. Real-Time Insights & GDS Grounding (Pillar 4)
- **Zero-Hallucination Guarantee:** Flight schedules, fares, seats, and policies are strictly bound to live GDS / NDC / OTA API JSON responses. LLMs are never permitted to guess or calculate prices.

---

## 🚀 Quick Start Guide

### 1. Frontend Setup (React + Vite + Tailwind CSS)

```bash
# Clone the repository
git clone https://github.com/devanshudhoble/namanai.git
cd namanai

# Install dependencies
npm install

# Run the development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in Google Chrome or Microsoft Edge for Web Speech API microphone and audio synthesis support.

---

### 2. Backend Setup (Python + FastAPI)

```bash
cd backend

# Create virtual environment (optional)
python -m venv venv
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Install requirements
pip install -r requirements.txt

# Run the FastAPI server
uvicorn main:app --reload --port 8000
```

The interactive OpenAPI docs will be available at [http://localhost:8000/docs](http://localhost:8000/docs).

---

## 🎙️ Interactive Demo Scenarios (1-Click Presets)

The product UI includes 1-click test scenarios in the header to demonstrate real edge-case handling:

1. **Primary Intent:** *"Hi, I want to travel from Bangalore to Goa next Friday. My budget is around ₹8,000. I prefer a convenient journey and don't want to spend too much time comparing options."*
2. **Baggage & Policy Clarification:** *"Wait, does the ₹5,400 flight include check-in baggage?"*
3. **Mid-Flow Modification:** *"Actually wait! Don't book Goa. Can we check Kochi instead?"*
4. **Dynamic Fare Spike Alert:** Simulates airline surge from ₹5,400 to ₹8,600 and offers Akasa Air QP-1344 (₹5,100) fallback.
5. **Money Deducted, Ticket Pending:** Triggers instant 3-way reconciliation audit between Bank, Ledger, and IndiGo reservation system to confirm PNR: `6E-W8KZ7Q`.
6. **Post-Booking Cancellation & Refund:** Calculates deterministic airline penalty (₹2,500) and net refund (₹2,900).

---

## 🔑 External API Integrations (When You Want Live Connectors)

VoyAI runs immediately out-of-the-box in **High-Fidelity Sandbox Simulator Mode**. When you are ready to connect live enterprise endpoints, provide the following keys in the UI **Settings modal** or `backend/.env`:

| Service | Provider | Purpose |
| :--- | :--- | :--- |
| **LLM Reasoning** | Google Gemini (`GEMINI_API_KEY`) or OpenAI (`OPENAI_API_KEY`) | Intent extraction & multi-turn dialogue planning |
| **Speech-to-Text** | Deepgram Nova-2 (`DEEPGRAM_API_KEY`) | Streaming telephony audio transcription |
| **Neural Voice (TTS)** | ElevenLabs (`ELEVENLABS_API_KEY`) | Ultra-realistic voice synthesis |
| **Travel Inventory** | Amadeus / Sabre (`AMADEUS_CLIENT_ID`, `AMADEUS_CLIENT_SECRET`) | Live flight fares, schedules & seat maps |
| **Payment Gateway** | Razorpay / Cashfree (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`) | Live UPI Intent & Webhook status polling |
| **Database** | PostgreSQL (`DATABASE_URL`) | Production persistent user profiles & PNR ledgers |

---

## 🛡️ Security & Privacy Architecture

- **PCI-DSS Isolation:** Audio channels never touch payment card primary account numbers or PINs.
- **Out-of-Band MFA:** Authorizations occur exclusively on the user's mobile device.
- **Idempotency Guarantees:** Every seat hold and transaction request includes a unique UUIDv4 token, preventing duplicate charges or reservations on network reconnects.

---

## 📄 License
MIT License. Built for enterprise travel platforms by the VoyAI engineering team.
