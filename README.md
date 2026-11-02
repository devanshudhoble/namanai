# VoyAI Naman – Autonomous Voice AI Travel Concierge

[![Architecture](https://img.shields.io/badge/Architecture-Event--Driven%20%7C%20Stepwise%20Conversational%20Agent-blue)]()
[![Voice AI](https://img.shields.io/badge/Voice%20AI-Sarvam%20AI%20Bulbul%20Neural-orange)]()
[![LLM Reasoning](https://img.shields.io/badge/LLM-Google%20Gemini%202.5%20Flash-indigo)]()
[![Payment Guard](https://img.shields.io/badge/Payment-Out--of--Band%20UPI-emerald)]()
[![Grounding](https://img.shields.io/badge/Grounding-GDS%20%26%20IRCTC%20All%20India%20Routes-teal)]()

> **VoyAI Naman** is an enterprise-grade Autonomous Voice AI Travel Concierge engineered for Indian digital travel platforms. It replaces multi-screen search grids, tedious date toggles, and complex payment funnels with a polite, natural step-by-step voice conversation across **Domestic Flights, Indian Railways (IRCTC Trains), Intercity Sleeper Buses, and Hotels** for **ANY city, state, or village across India**.

---

## 📱 Product Experience & Design

![VoyAI Flagship Product Experience](public/docs/flagship_mobile_app.png)
*Flagship Indian Travel AI Experience: Step-by-Step Voice Dialogue, Multi-Modal Options & Out-of-Band UPI*

![Product Dashboard](public/docs/product_ui_dashboard.png)
*Multi-Modal Travel Canvas: Flights, IRCTC Trains (3AC, 2AC, Sleeper), Intercity Buses & Hotels with Live 10-Min Seat Hold*

---

## 🗣️ Natural, Polite & Customer-First Conversational Workflow

The agent follows an intuitive human travel advisor paradigm, asking **one question at a time** before retrieving live options:

```mermaid
flowchart TD
    S1["<b>Step 1: Greeting</b><br/>'Namaste! Where would you like to travel today?'"]
    S2["<b>Step 2: Destination & Origin</b><br/>User mentions destination (e.g. 'Nagpur').<br/>Agent: 'Where will you be travelling from to reach Nagpur?'"]
    S3["<b>Step 3: Travel Date</b><br/>Agent: 'When would you like to travel?'"]
    S4["<b>Step 4: Return Journey</b><br/>Agent: 'Would you like a one-way trip or a return journey?'"]
    S5["<b>Step 5: Number of Travellers</b><br/>Agent: 'How many people will be travelling?'"]
    S6["<b>Step 6: Mode of Transport</b><br/>Agent: 'How would you prefer to travel? By flight, train or bus?'"]
    S7["<b>Step 7: Preferences</b><br/>Agent: 'Do you have any preferences like morning departure or a specific train class?'"]
    S8["<b>Step 8: Grounded Multi-Modal Options</b><br/>Retrieves 3-5 verified options for that exact route across India.<br/>Agent: 'Here are the available options. Would you like to explore one?'"]
    S9["<b>Step 9: Customer Follow-ups & Decides</b><br/>'Can you find something cheaper?' / 'Show morning flights' / 'Which is fastest?'"]
    S10["<b>Step 10: Strict Customer Approval First</b><br/>Agent shows complete booking summary.<br/>'Would you like me to proceed with this booking?'<br/>Never books automatically!"]
    S11["<b>Step 11: Seat Lock & Out-of-Band UPI</b><br/>10-minute hold placed. Instant UPI push sent to GPay/PhonePe."]
    S12["<b>Step 12: Ticket Confirmation</b><br/>PNR issued and confirmed ticket sent to WhatsApp."]

    S1 --> S2 --> S3 --> S4 --> S5 --> S6 --> S7 --> S8 --> S9 --> S10 --> S11 --> S12
```

---

## 🇮🇳 Universal India Geo & Route Grounding

Unlike prototype chatbots locked to single destinations, **VoyAI supports ANY destination across India**:
- **Metros:** Mumbai, Delhi, Bengaluru, Chennai, Kolkata, Hyderabad, Pune, Ahmedabad
- **Tier-2 & Tier-3 Cities:** Nagpur, Jaipur, Lucknow, Chandigarh, Varanasi, Bhopal, Indore, Patna, Surat, Kochi, Goa, Amritsar, Coimbatore, Vadodara, Visakhapatnam, Ranchi, Raipur, Guwahati, Bhubaneswar
- **Hill Stations & Heritage Towns:** Manali, Shimla, Dehradun, Rishikesh, Haridwar, Ayodhya, Shirdi, Udaipur, Jodhpur, Agra, Ooty, Darjeeling
- **Towns & Villages:** Automatically extracts station codes, bus hubs, and schedules for any location entered or spoken.

---

## 🛡️ Strict Customer Approval & Payment Security Protocols

1. **Customer Approval Comes First:**
   - **Never books automatically.**
   - **Never initiates payment automatically.**
   - Shows complete booking summary: Primary passenger name, travel dates, flight/train/bus details, and total fare.
   - Solicits explicit verbal consent (*"Would you like me to proceed with this booking?"*).
2. **Zero-Voice-Credentials Protocol:**
   - Never asks for or accepts UPI PINs, CVVs, or OTPs over audio.
   - Dispatches an out-of-band UPI collect push directly to the customer's Google Pay or PhonePe app.
3. **Automated 3-Way Bank Reconciliation Engine:**
   - If a customer says: *"My money was deducted from Google Pay but ticket is pending"*, the agent executes an automated 3-way check across Bank Gateway $\leftrightarrow$ Internal Ledger $\leftrightarrow$ GDS Reservation Desk, recovers the booking, and confirms the PNR immediately.

---

## 🏛️ The 4 Strategic Pillars

### Pillar 1: AI-Driven Analytics for Customer Journeys
- **Dynamic Slot State Matrix:** Tracks Origin, Destination, Date, Return preference, Traveler count, and Transport mode.
- **Latency Waterfall:** Real-time tracking of STT ($240\text{ms}$), LLM Reasoning ($290\text{ms}$), Travel APIs ($180\text{ms}$), and Sarvam Neural TTS ($190\text{ms}$).
- **Drop-off Mitigation:** Detects customer hesitation and offers economical alternatives (e.g. Sleeper train or bus).

### Pillar 2: Optimising Booking Conversions
- **No Fabricated Assumptions:** Collects details politely without making premature budget or destination assumptions.
- **Multi-Modal Options per Route:**
  - ✈️ **Flight:** Direct morning IndiGo flight (1h 45m).
  - 🚆 **IRCTC Train:** 3AC Sleeper (₹1,280), 2AC Executive (₹1,850), and Sleeper Class (₹420).
  - 🚌 **Bus:** BharatBenz AC Sleeper (₹1,450) and Volvo Semi-Sleeper (₹980).
  - 🏨 **Hotel:** Top-rated hotel in destination city (₹3,200/night).
- **10-Minute Seat & Price Guarantee:** Locks seat inventory to protect customers from price surges during payment.

### Pillar 3: Payment & Transaction Support
- **Out-of-Band UPI Push:** Dispatches instant UPI collect requests to the traveler's registered UPI ID.
- **Automated Exception Recovery:** Resolves pending payment states with idempotent booking locks.

### Pillar 4: Real-Time Platform Data Synchronization
- **Strict Grounding:** Live fares, seat availability, train berths, and baggage allowances are retrieved directly from authorized APIs.
- **Dynamic Surge Mitigation:** Proactively alerts customers when a fare changes and surfaces alternative flights or trains.

---

## 💬 Real-World Conversational Examples

### Conversation 1: Step-by-Step Flight Booking to Nagpur
```text
Traveler: "nagpur"
Agent:    "Where will you be travelling from to reach Nagpur?"
Traveler: "Mumbai se"
Agent:    "When would you like to travel to Nagpur?"
Traveler: "Next Friday"
Agent:    "Would you like a one-way trip or a return journey?"
Traveler: "One-way"
Agent:    "How many people will be travelling?"
Traveler: "2 people"
Agent:    "How would you prefer to travel? By flight, train or bus?"
Traveler: "Flight"
Agent:    "Do you have any particular preferences, such as a morning journey or a specific airline?"
Traveler: "Morning flight"
Agent:    "Here are the available options for Mumbai to Nagpur on Next Friday for 2 traveller(s). Would you like to explore one of these, or should I look for alternatives?"
[UI Displays IndiGo 6E-458 at 06:20 AM for ₹10,200 total, Akasa Air, and IRCTC Trains]
Traveler: "Select the IndiGo flight"
Agent:    "Selected IndiGo Airlines (6E-458) for 2 traveller(s) from Mumbai to Nagpur on Next Friday. Total fare is ₹10,200. Would you like me to proceed with this booking?"
Traveler: "Yes, proceed"
Agent:    "Great! What is the primary passenger's full name for the ticket?"
Traveler: "Devanshu"
Agent:    "I've placed a 10-minute hold for Devanshu at ₹10,200. I sent an instant UPI payment request to devanshu@okhdfcbank. Please open Google Pay or PhonePe to approve the payment."
[Traveler approves payment on phone]
Agent:    "Payment received! Your ticket is confirmed for Devanshu. Your PNR is 6E-4812-KJ9A. E-ticket has been sent to your WhatsApp. Have a wonderful journey!"
```

### Conversation 2: Interactive Follow-ups & Mode Switching
```text
Traveler: "Can you find something cheaper?"
Agent:    "The most affordable option is the Nagpur Express (Sleeper Class) at ₹840 total. Would you like to proceed with this, or check 3AC?"
Traveler: "What if I travel one day later?"
Agent:    "Updated for Next Saturday! We have flights from ₹9,600 and trains from ₹840. Which one works better for you?"
```

### Conversation 3: Exception Recovery (Money Deducted, Ticket Pending)
```text
Traveler: "My money has been deducted from Google Pay but ticket pending"
Agent:    "Don't worry, Devanshu! I ran an instant 3-way check across our payment gateway, bank ledger, and reservation system. Your payment was captured and your ticket is confirmed! Your PNR is 6E-W8KZ7Q. Have a safe journey!"
```

---

## 🛠️ Quick Start & Setup

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
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

### 2. Backend Setup (Python + FastAPI)

```bash
cd backend

# Create virtual environment (optional)
python -m venv venv
venv\Scripts\activate   # Windows
source venv/bin/activate # Mac/Linux

# Install dependencies
pip install -r requirements.txt

# Run the FastAPI server
python -m uvicorn main:app --reload --port 8000
```
Open [http://localhost:8000/docs](http://localhost:8000/docs) for the interactive Swagger documentation.

---

## 🔐 Security & Privacy Architecture

- **PCI-DSS Isolation:** Audio streams never touch card PANs, CVVs, or bank passwords.
- **Out-of-Band UPI MFA:** Transaction authorizations occur exclusively on the user's mobile device via Google Pay, PhonePe, or Paytm.
- **Credential Leak Interceptor:** Real-time regex and NLP scanner automatically intercepts spoken PINs or OTPs and warns the user.
- **Idempotency Guarantees:** Every seat hold and transaction request includes a unique UUID token, preventing duplicate charges.

---

## 📄 License
MIT License. Built for enterprise Indian travel platforms by the VoyAI engineering team.
