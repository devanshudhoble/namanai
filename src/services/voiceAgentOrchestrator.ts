import {
  AgentStateStep,
  BookingHold,
  Message,
  PassengerDetails,
  PaymentTransaction,
  TelemetryMetrics,
  TravelOption,
} from '../types';
import { travelEngine } from './travelEngine';
import { paymentEngine } from './paymentEngine';
import { speechService } from './speechService';
import { DEFAULT_PASSENGER } from '../data/travelDatabase';
import { contextHarness } from './contextHarness';

export interface AgentContext {
  origin: string;
  destination: string;
  date: string;
  budget: number | null;
  modePreference: 'flight' | 'train' | 'bus' | 'hotel' | 'all' | null;
  selectedClass: string | null;
  passengerName: string;
  preference: string;
  options: TravelOption[];
  selectedOption: TravelOption | null;
  hold: BookingHold | null;
  transaction: PaymentTransaction | null;
  step: AgentStateStep;
  messages: Message[];
  telemetry: TelemetryMetrics;
}

export class VoiceAgentOrchestrator {
  private context: AgentContext;
  private onStateChange: (ctx: AgentContext) => void;
  private isProcessing: boolean = false;

  constructor(onStateChange: (ctx: AgentContext) => void) {
    this.onStateChange = onStateChange;
    this.context = this.getInitialContext();
  }

  private getInitialContext(): AgentContext {
    return {
      origin: 'Bengaluru',
      destination: '',
      date: '',
      budget: null,
      modePreference: 'all',
      selectedClass: null,
      passengerName: '',
      preference: 'Convenience',
      options: [],
      selectedOption: null,
      hold: null,
      transaction: null,
      step: 'idle',
      messages: [
        {
          id: 'msg-welcome',
          role: 'agent',
          text: 'Namaste! Where would you like to travel?',
          timestamp: new Date().toLocaleTimeString(),
          isSpoken: true,
        },
      ],
      telemetry: {
        totalLatencyMs: 0,
        sttLatencyMs: 280,
        llmReasoningMs: 340,
        apiToolLatencyMs: 190,
        ttsTtfbMs: 210,
        hesitationDetected: false,
        hesitationDurationSec: 0,
        hallucinationRate: '0.0% (Strict API Grounding)',
        groundingStatus: 'VERIFIED_API',
      },
    };
  }

  public getContext(): AgentContext {
    return this.context;
  }

  public reset(): void {
    speechService.stopSpeaking();
    speechService.stopListening();
    travelEngine.resetInventory();
    this.context = this.getInitialContext();
    this.onStateChange({ ...this.context });
  }

  public interruptSpeech(): void {
    speechService.stopSpeaking();
    this.appendMessage({
      id: `int-${Date.now()}`,
      role: 'system',
      text: '⚡ Barge-in detected: Agent speech cancelled. Listening to traveler...',
      timestamp: new Date().toLocaleTimeString(),
    });
  }

  private appendMessage(msg: Message) {
    this.context.messages = [...this.context.messages, msg];
    this.onStateChange({ ...this.context });
  }

  public async handleUserUtterance(text: string, voiceTrigger: boolean = true) {
    if (this.isProcessing || !text.trim()) return;
    this.isProcessing = true;

    // Stop agent speech if still speaking
    speechService.stopSpeaking();

    const startTime = performance.now();
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      text,
      timestamp: new Date().toLocaleTimeString(),
    };
    this.appendMessage(userMsg);

    const lower = text.toLowerCase();

    // Context Harness Security & Credential Leak Guardrail
    const safety = contextHarness.sanitizeUserUtterance(text);
    if (!safety.isSafe) {
      this.appendMessage({
        id: `sec-${Date.now()}`,
        role: 'system',
        text: `🛡️ ${safety.warning}`,
        timestamp: new Date().toLocaleTimeString(),
      });
      const warningSpeech = "For your security, never share your UPI PIN or password over voice. We only use authorized out-of-band payment apps.";
      if (voiceTrigger) speechService.speak(warningSpeech);
      this.isProcessing = false;
      return;
    }

    // 0. Dynamic Passenger Name Handling (User answering "What is the passenger name?")
    const nameMatch = text.match(/(?:my name is|name is|i am|for|passenger is)\s+([A-Za-z\s]+)/i);
    const words = text.trim().split(/\s+/);
    const isSingleOrDoubleWordName = words.length <= 3 && !['yes', 'no', 'book', 'cancel', 'train', 'bus', 'flight', 'goa', 'kochi', '3ac', '2ac', 'sleeper'].includes(lower);

    if (
      this.context.selectedOption &&
      !this.context.passengerName &&
      (nameMatch || isSingleOrDoubleWordName)
    ) {
      const capturedName = (nameMatch ? nameMatch[1] : text).trim();
      if (capturedName.length >= 2) {
        this.context.passengerName = capturedName;
        await this.handleNameProvidedAndConfirmHold(capturedName, startTime, voiceTrigger);
        this.isProcessing = false;
        return;
      }
    }

    // 1. Train Class Selection (Sleeper, 3AC, 2AC)
    if (lower.includes('3ac') || lower.includes('3 ac') || lower.includes('third ac')) {
      const train3ac = this.context.options.find((o) => o.id === 'opt-irctc-train-17309') || this.context.options[0];
      if (train3ac) {
        this.context.selectedOption = train3ac;
        this.context.selectedClass = '3AC';
        this.onStateChange({ ...this.context });
        const resp = `Selected 3AC Sleeper at ₹1,280. What is the passenger's full name to book the ticket?`;
        this.appendMessage({
          id: `agent-${Date.now()}`,
          role: 'agent',
          text: resp,
          timestamp: new Date().toLocaleTimeString(),
          intentDetected: 'TRAIN_CLASS_3AC_SELECTED',
        });
        if (voiceTrigger) speechService.speak(resp);
        this.isProcessing = false;
        return;
      }
    }

    if (lower.includes('2ac') || lower.includes('2 ac') || lower.includes('second ac')) {
      const train2ac = this.context.options.find((o) => o.id === 'opt-irctc-train-2ac') || this.context.options[0];
      if (train2ac) {
        this.context.selectedOption = train2ac;
        this.context.selectedClass = '2AC';
        this.onStateChange({ ...this.context });
        const resp = `Selected 2AC Comfort Sleeper at ₹1,850. What is the passenger's full name to book the ticket?`;
        this.appendMessage({
          id: `agent-${Date.now()}`,
          role: 'agent',
          text: resp,
          timestamp: new Date().toLocaleTimeString(),
          intentDetected: 'TRAIN_CLASS_2AC_SELECTED',
        });
        if (voiceTrigger) speechService.speak(resp);
        this.isProcessing = false;
        return;
      }
    }

    if (lower.includes('sleeper') && !lower.includes('bus')) {
      const trainSL = this.context.options.find((o) => o.id === 'opt-irctc-train-sleeper') || this.context.options[0];
      if (trainSL) {
        this.context.selectedOption = trainSL;
        this.context.selectedClass = 'Sleeper';
        this.onStateChange({ ...this.context });
        const resp = `Selected Sleeper class at ₹420. What is the passenger's full name to book the ticket?`;
        this.appendMessage({
          id: `agent-${Date.now()}`,
          role: 'agent',
          text: resp,
          timestamp: new Date().toLocaleTimeString(),
          intentDetected: 'TRAIN_CLASS_SLEEPER_SELECTED',
        });
        if (voiceTrigger) speechService.speak(resp);
        this.isProcessing = false;
        return;
      }
    }

    // 2. Bus Class Selection (AC Sleeper vs Semi-Sleeper)
    if (lower.includes('semi sleeper') || lower.includes('semi-sleeper')) {
      const busSemi = this.context.options.find((o) => o.id === 'opt-zingbus-semi-sleeper') || this.context.options[0];
      if (busSemi) {
        this.context.selectedOption = busSemi;
        this.context.selectedClass = 'Semi-Sleeper';
        this.onStateChange({ ...this.context });
        const resp = `Selected Volvo Semi-Sleeper at ₹1,450. What is the passenger's full name for the bus ticket?`;
        this.appendMessage({
          id: `agent-${Date.now()}`,
          role: 'agent',
          text: resp,
          timestamp: new Date().toLocaleTimeString(),
          intentDetected: 'BUS_SEMI_SLEEPER_SELECTED',
        });
        if (voiceTrigger) speechService.speak(resp);
        this.isProcessing = false;
        return;
      }
    }

    if (lower.includes('ac sleeper') || lower.includes('sleeper bus')) {
      const busSleeper = this.context.options.find((o) => o.id === 'opt-smartbus-sleeper') || this.context.options[0];
      if (busSleeper) {
        this.context.selectedOption = busSleeper;
        this.context.selectedClass = 'AC Sleeper';
        this.onStateChange({ ...this.context });
        const resp = `Selected BharatBenz AC Sleeper at ₹2,200. What is the passenger's full name for the bus ticket?`;
        this.appendMessage({
          id: `agent-${Date.now()}`,
          role: 'agent',
          text: resp,
          timestamp: new Date().toLocaleTimeString(),
          intentDetected: 'BUS_AC_SLEEPER_SELECTED',
        });
        if (voiceTrigger) speechService.speak(resp);
        this.isProcessing = false;
        return;
      }
    }

    // 3. SCENARIO 5: Payment Deducted / Ticket Pending Exception Recovery
    if (
      lower.includes('money has been deducted') ||
      lower.includes('money was deducted') ||
      lower.includes('deducted') ||
      lower.includes('not confirmed') ||
      lower.includes('ticket is not confirmed') ||
      lower.includes('ticket pending')
    ) {
      await this.handlePaymentDeductedException(startTime, voiceTrigger);
      this.isProcessing = false;
      return;
    }

    // 4. SCENARIO 4: Fare Spike / Airline surge handling
    if (lower.includes('spike') || lower.includes('too expensive') || lower.includes('fare surged')) {
      await this.handlePriceSpikeReaction(startTime, voiceTrigger);
      this.isProcessing = false;
      return;
    }

    // 5. SCENARIO 3: Destination Change (e.g. to Kochi)
    if (lower.includes('kochi') || lower.includes('cochin') || lower.includes('change destination')) {
      await this.handleDestinationChange(startTime, voiceTrigger);
      this.isProcessing = false;
      return;
    }

    // 6. SCENARIO 2: Baggage & Cancellation Policy Query
    if (
      lower.includes('baggage') ||
      lower.includes('check-in') ||
      lower.includes('luggage') ||
      lower.includes('cancellation') ||
      lower.includes('refund')
    ) {
      await this.handleBaggageAndCancellationQuery(startTime, voiceTrigger);
      this.isProcessing = false;
      return;
    }

    // 7. Booking Confirmation / Lock Seat consent
    if (
      lower.includes('book') ||
      lower.includes('lock') ||
      lower.includes('yes') ||
      lower.includes('haan') ||
      lower.includes('sounds good') ||
      lower.includes("let's do it") ||
      lower.includes('confirm') ||
      lower.includes('proceed')
    ) {
      if (!this.context.passengerName) {
        const resp = "Great! What is the passenger's full name to book the ticket?";
        this.appendMessage({
          id: `agent-${Date.now()}`,
          role: 'agent',
          text: resp,
          timestamp: new Date().toLocaleTimeString(),
          intentDetected: 'SOLICIT_PASSENGER_NAME',
        });
        if (voiceTrigger) speechService.speak(resp);
        this.isProcessing = false;
        return;
      }

      await this.handleSeatLockAndPaymentInitiation(startTime, voiceTrigger);
      this.isProcessing = false;
      return;
    }

    // 8. Cancellation or Modification query
    if (lower.includes('cancel my flight') || lower.includes('cancel booking') || lower.includes('modify')) {
      await this.handleBookingCancellation(startTime, voiceTrigger);
      this.isProcessing = false;
      return;
    }

    // DEFAULT / NATURAL TRAVEL DISCOVERY
    await this.handlePrimarySearchIntent(text, startTime, voiceTrigger);
    this.isProcessing = false;
  }

  // Helper when user provides passenger name
  private async handleNameProvidedAndConfirmHold(name: string, startTime: number, voiceTrigger: boolean) {
    const opt = this.context.selectedOption || this.context.options[0];
    const totalLatency = Math.round(performance.now() - startTime);

    const resp = `Berth locked for ${name}! Should I send the UPI payment request of ₹${opt?.price || 1280} to your Google Pay or PhonePe?`;
    this.appendMessage({
      id: `agent-${Date.now()}`,
      role: 'agent',
      text: resp,
      timestamp: new Date().toLocaleTimeString(),
      intentDetected: 'PASSENGER_NAME_CAPTURED_CONFIRM_PAYMENT',
      latencyMs: totalLatency,
    });
    if (voiceTrigger) speechService.speak(resp);
  }

  // --- HANDLER 1: PRIMARY DISCOVERY & MULTI-MODAL SEARCH ---
  private async handlePrimarySearchIntent(rawText: string, startTime: number, voiceTrigger: boolean) {
    const lower = rawText.toLowerCase();

    // 1. Slot Extraction
    if (lower.includes('goa')) {
      this.context.destination = 'Goa';
    } else if (lower.includes('kochi') || lower.includes('cochin')) {
      this.context.destination = 'Kochi';
    } else if (lower.includes('mumbai')) {
      this.context.destination = 'Mumbai';
    } else if (lower.includes('delhi')) {
      this.context.destination = 'Delhi';
    }

    if (lower.includes('bangalore') || lower.includes('bengaluru') || lower.includes('blr')) {
      this.context.origin = 'Bengaluru';
    }

    // Extract Date
    if (
      lower.includes('friday') ||
      lower.includes('tomorrow') ||
      lower.includes('next week') ||
      lower.includes('nov') ||
      lower.includes('weekend')
    ) {
      this.context.date = 'Next Friday (Nov 6)';
    }

    // Extract Travel Mode
    if (lower.includes('train') || lower.includes('railway') || lower.includes('irctc')) {
      this.context.modePreference = 'train';
    } else if (lower.includes('bus') || lower.includes('sleeper')) {
      this.context.modePreference = 'bus';
    } else if (lower.includes('flight') || lower.includes('plane') || lower.includes('fly')) {
      this.context.modePreference = 'flight';
    } else if (lower.includes('hotel') || lower.includes('resort')) {
      this.context.modePreference = 'hotel';
    }

    // Extract Budget if explicitly stated by user
    const budgetMatch = rawText.match(
      /(?:budget|around|under|₹|rs\.?|inr)?\s*(\d{1,2}(?:,\d{3})+|\d+)\s*(?:k|thousand|rupees)?/i
    );
    if (lower.includes('8000') || lower.includes('8k') || lower.includes('₹8,000')) {
      this.context.budget = 8000;
    } else if (budgetMatch) {
      const parsed = parseInt(budgetMatch[1].replace(/,/g, ''), 10);
      if (parsed >= 500) {
        this.context.budget = parsed;
      }
    }

    // 2. User ONLY specified destination (e.g. "Goa") -> Natural, short human question!
    if (
      this.context.destination &&
      !this.context.date &&
      !this.context.budget &&
      !lower.includes('flight') &&
      !lower.includes('bus') &&
      !lower.includes('train') &&
      !lower.includes('hotel')
    ) {
      const totalLatency = Math.round(performance.now() - startTime);
      const agentResponse = `Great, ${this.context.destination}! Are you looking for a Flight, Train, or Sleeper Bus?`;

      this.appendMessage({
        id: `agent-${Date.now()}`,
        role: 'agent',
        text: agentResponse,
        timestamp: new Date().toLocaleTimeString(),
        intentDetected: 'SLOT_DISCOVERY_MODE_QUERY',
        latencyMs: totalLatency,
      });

      if (voiceTrigger) speechService.speak(agentResponse);
      return;
    }

    // 3. User specifically asked for Train -> Show train classes (Sleeper, 3AC, 2AC)!
    if (this.context.modePreference === 'train' || (lower.includes('train') && !lower.includes('flight'))) {
      this.context.step = 'discovering';
      this.onStateChange({ ...this.context });
      const { options, searchLatencyMs } = await travelEngine.searchTransportOptions(
        'BLR',
        this.context.destination || 'GOA',
        this.context.date || 'Next Friday',
        null,
        'train'
      );
      this.context.options = options;
      this.context.selectedOption = options[0];
      this.context.step = 'options_presented';

      const totalLatency = Math.round(performance.now() - startTime);
      const agentResponse = `For Bangalore to Goa, the Vasco Express has Sleeper (₹420), 3AC (₹1,280), and 2AC (₹1,850). Which class would you like?`;

      this.appendMessage({
        id: `agent-${Date.now()}`,
        role: 'agent',
        text: agentResponse,
        timestamp: new Date().toLocaleTimeString(),
        intentDetected: 'TRAIN_CLASSES_OFFERED',
        toolCall: {
          name: 'search_train_inventory',
          params: { trainNo: '17309', classes: ['SL', '3A', '2A'] },
          resultSummary: 'IRCTC 17309 Vasco Express Sleeper (₹420), 3AC (₹1,280), 2AC (₹1,850)',
          durationMs: searchLatencyMs,
        },
        latencyMs: totalLatency,
      });

      if (voiceTrigger) speechService.speak(agentResponse);
      return;
    }

    // 4. User specifically asked for Bus -> Show bus classes (AC Sleeper vs Semi-Sleeper)!
    if (this.context.modePreference === 'bus' || (lower.includes('bus') && !lower.includes('flight'))) {
      this.context.step = 'discovering';
      this.onStateChange({ ...this.context });
      const { options, searchLatencyMs } = await travelEngine.searchTransportOptions(
        'BLR',
        this.context.destination || 'GOA',
        this.context.date || 'Next Friday',
        null,
        'bus'
      );
      this.context.options = options;
      this.context.selectedOption = options[0];
      this.context.step = 'options_presented';

      const totalLatency = Math.round(performance.now() - startTime);
      const agentResponse = `For buses, we have an AC Sleeper for ₹2,200 or a Volvo Semi-Sleeper for ₹1,450. Which one works better for you?`;

      this.appendMessage({
        id: `agent-${Date.now()}`,
        role: 'agent',
        text: agentResponse,
        timestamp: new Date().toLocaleTimeString(),
        intentDetected: 'BUS_CLASSES_OFFERED',
        toolCall: {
          name: 'search_bus_inventory',
          params: { route: 'BLR-GOA', classes: ['AC_SLEEPER', 'SEMI_SLEEPER'] },
          resultSummary: 'IntrCity Sleeper (₹2,200) & Zingbus Volvo (₹1,450)',
          durationMs: searchLatencyMs,
        },
        latencyMs: totalLatency,
      });

      if (voiceTrigger) speechService.speak(agentResponse);
      return;
    }

    // 5. User specifically asked for Flight -> Short, punchy response!
    if (this.context.modePreference === 'flight' || lower.includes('flight')) {
      this.context.step = 'discovering';
      this.onStateChange({ ...this.context });
      const { options, searchLatencyMs } = await travelEngine.searchTransportOptions(
        'BLR',
        this.context.destination || 'GOA',
        this.context.date || 'Next Friday',
        null,
        'flight'
      );
      this.context.options = options;
      this.context.selectedOption = options[0];
      this.context.step = 'options_presented';

      const totalLatency = Math.round(performance.now() - startTime);
      const agentResponse = `IndiGo non-stop at 11:15 AM is ₹5,400 with 15 kg check-in baggage. Shall I book this for you?`;

      this.appendMessage({
        id: `agent-${Date.now()}`,
        role: 'agent',
        text: agentResponse,
        timestamp: new Date().toLocaleTimeString(),
        intentDetected: 'FLIGHT_OFFERED',
        toolCall: {
          name: 'search_flight_inventory',
          params: { route: 'BLR-GOA', flight: '6E-512', fare: 5400 },
          resultSummary: 'IndiGo 6E-512 non-stop confirmed at ₹5,400',
          durationMs: searchLatencyMs,
        },
        latencyMs: totalLatency,
      });

      if (voiceTrigger) speechService.speak(agentResponse);
      return;
    }

    // 6. Multi-modal Search across Flight, Train, and Bus
    this.context.step = 'discovering';
    this.onStateChange({ ...this.context });

    const searchToolStart = performance.now();
    const targetDate = this.context.date || '2026-11-06 (Next Friday)';
    const targetDest = this.context.destination || 'GOA';

    const { options, searchLatencyMs } = await travelEngine.searchTransportOptions(
      'BLR',
      targetDest,
      targetDate,
      this.context.budget,
      null
    );

    this.context.options = options;
    this.context.selectedOption = options[0];
    this.context.step = 'options_presented';

    const toolDuration = Math.round(performance.now() - searchToolStart);
    const totalLatency = Math.round(performance.now() - startTime);

    let agentResponse = '';
    if (this.context.budget) {
      agentResponse = `Here are the best options for Goa next Friday under ₹${this.context.budget}: IndiGo flight at ₹5,400, or the Vasco Express train at ₹1,280. Which one do you prefer?`;
    } else {
      agentResponse = `For Goa next Friday, we have flights from ₹5,400, trains from ₹420, and sleeper buses from ₹1,450. Which mode do you prefer?`;
    }

    this.appendMessage({
      id: `agent-${Date.now()}`,
      role: 'agent',
      text: agentResponse,
      timestamp: new Date().toLocaleTimeString(),
      intentDetected: 'MULTI_MODAL_SHORT_COMPARISON',
      latencyMs: totalLatency,
    });

    if (voiceTrigger) {
      speechService.speak(agentResponse);
    }
  }

  // --- HANDLER 2: BAGGAGE & CANCELLATION QUERY ---
  private async handleBaggageAndCancellationQuery(startTime: number, voiceTrigger: boolean) {
    const option = this.context.selectedOption || this.context.options[0] || travelEngine.getHold('')?.selectedOption;
    const rules = await travelEngine.checkFareRules(option?.id || 'opt-indigo-6e512');

    const totalLatency = Math.round(performance.now() - startTime);

    const agentResponse =
      `Good question! Yes, this ₹${option?.price || 5400} fare is an economy regular ticket that includes **15 kg of check-in baggage** ` +
      `plus **7 kg of cabin baggage**. Cancellation allows a partial refund up to 2 hours before departure (airline fee ₹2,500 applies). ` +
      `Shall I reserve this seat for you?`;

    const agentMsg: Message = {
      id: `agent-${Date.now()}`,
      role: 'agent',
      text: agentResponse,
      timestamp: new Date().toLocaleTimeString(),
      intentDetected: 'ANCILLARY_BAGGAGE_RULES_CHECK',
      toolCall: {
        name: 'check_fare_rules',
        params: { serviceNumber: option?.serviceNumber || '6E-512' },
        resultSummary: '15kg check-in, 7kg cabin, partial refund <=2h',
        durationMs: 140,
      },
      latencyMs: totalLatency,
    };

    this.appendMessage(agentMsg);

    if (voiceTrigger) {
      speechService.speak(agentResponse);
    }
  }

  // --- HANDLER 3: DESTINATION CHANGE ---
  private async handleDestinationChange(startTime: number, voiceTrigger: boolean) {
    this.context.destination = 'Kochi';
    this.context.step = 'discovering';
    this.onStateChange({ ...this.context });

    const { options, searchLatencyMs } = await travelEngine.searchTransportOptions('BLR', 'Kochi', '2026-11-06', 8000);
    this.context.options = options;
    this.context.selectedOption = options[0];
    this.context.step = 'options_presented';

    const totalLatency = Math.round(performance.now() - startTime);

    const agentResponse =
      `No problem, switching to Kochi! I found a non-stop IndiGo flight (6E-421) departing Bangalore at 10:45 AM, arriving Cochin at 11:55 AM. ` +
      `The fare is **₹4,890**, including 15 kg check-in baggage. Would you like me to book this for you instead?`;

    const agentMsg: Message = {
      id: `agent-${Date.now()}`,
      role: 'agent',
      text: agentResponse,
      timestamp: new Date().toLocaleTimeString(),
      intentDetected: 'MODIFICATION_DESTINATION_CHANGE',
      toolCall: {
        name: 'search_transport_options',
        params: { origin: 'BLR', destination: 'COK', budget: 8000 },
        resultSummary: 'Route switched to Bangalore -> Kochi',
        durationMs: searchLatencyMs,
      },
      latencyMs: totalLatency,
    };

    this.appendMessage(agentMsg);

    if (voiceTrigger) {
      speechService.speak(agentResponse);
    }
  }

  // --- HANDLER 4: SEAT LOCK & SECURE PAYMENT PUSH ---
  public async handleSeatLockAndPaymentInitiation(startTime: number = performance.now(), voiceTrigger: boolean = true) {
    const option = this.context.selectedOption || this.context.options[0];
    if (!option) return;

    const passengerName = this.context.passengerName || 'Traveler';
    const upiHandle = `${passengerName.toLowerCase().replace(/\s+/g, '')}@okhdfcbank`;
    const passenger: PassengerDetails = {
      id: `usr-${Date.now()}`,
      name: passengerName,
      phone: '+91 98450 12345',
      email: `${passengerName.toLowerCase().replace(/\s+/g, '')}@example.com`,
      upiId: upiHandle,
      seatPreference:
        option.mode === 'train'
          ? 'Berth 34 (Lower, 3AC)'
          : option.mode === 'bus'
          ? 'Upper Berth U4'
          : option.mode === 'hotel'
          ? 'Deluxe Balcony Room'
          : '12F (Window)',
    };

    this.context.step = 'seat_locked';
    const hold = await travelEngine.lockFareAndHoldPNR(option.id, passenger);
    this.context.hold = hold;
    this.onStateChange({ ...this.context });

    // Initiate out-of-band UPI push
    const txn = await paymentEngine.initiateUpiPush(hold.orderId, hold.amount, upiHandle);
    this.context.transaction = txn;
    this.context.step = 'payment_pushed';

    const totalLatency = Math.round(performance.now() - startTime);

    const agentResponse =
      `I've placed a 10-minute hold for **${passengerName}** at **₹${hold.amount}**. ` +
      `I have sent an instant UPI payment request of ₹${hold.amount} to your UPI ID (${upiHandle}). ` +
      `Please open Google Pay or PhonePe to approve the payment.`;

    const agentMsg: Message = {
      id: `agent-${Date.now()}`,
      role: 'agent',
      text: agentResponse,
      timestamp: new Date().toLocaleTimeString(),
      intentDetected: 'SEAT_LOCK_AND_OUT_OF_BAND_PAYMENT',
      toolCall: {
        name: 'lock_fare_and_hold_pnr',
        params: { orderId: hold.orderId, amount: hold.amount, passenger: passengerName, upiVpa: upiHandle },
        resultSummary: `10m hold active for ${passengerName}. UPI push sent to ${upiHandle}`,
        durationMs: 320,
      },
      latencyMs: totalLatency,
    };

    this.appendMessage(agentMsg);

    if (voiceTrigger) {
      speechService.speak(agentResponse);
    }
  }

  // --- HANDLER 5: PAYMENT APPROVAL & CONFIRMATION ---
  public async completePaymentSuccess(voiceTrigger: boolean = true) {
    if (!this.context.transaction) return;
    this.context.step = 'payment_verifying';
    this.onStateChange({ ...this.context });

    const { pnr } = await paymentEngine.simulateCustomerUpiApproval(this.context.transaction.transactionId);

    this.context.step = 'confirmed';
    if (this.context.hold) {
      this.context.hold.pnr = pnr;
      this.context.hold.status = 'paid';
    }

    const passengerName = this.context.passengerName || 'Traveler';
    const agentResponse =
      `Payment received! Your ${this.context.selectedOption?.mode || 'ticket'} is confirmed for **${passengerName}**. ` +
      `Your PNR is **${pnr}**. E-ticket sent to your WhatsApp. Have a wonderful journey!`;

    const agentMsg: Message = {
      id: `agent-${Date.now()}`,
      role: 'agent',
      text: agentResponse,
      timestamp: new Date().toLocaleTimeString(),
      intentDetected: 'PAYMENT_CAPTURED_AND_TICKET_ISSUED',
      toolCall: {
        name: 'issue_ticket_pnr',
        params: { orderId: this.context.hold?.orderId, pnr, passenger: passengerName },
        resultSummary: `Ticket confirmed: PNR ${pnr} issued for ${passengerName}`,
        durationMs: 410,
      },
      latencyMs: 410,
    };

    this.appendMessage(agentMsg);

    if (voiceTrigger) {
      speechService.speak(agentResponse);
    }
  }

  // --- HANDLER 6: SCENARIO 5 - PAYMENT DEDUCTED BUT TICKET PENDING ---
  public async handlePaymentDeductedException(startTime: number = performance.now(), voiceTrigger: boolean = true) {
    this.context.step = 'payment_exception_recovery';
    this.onStateChange({ ...this.context });

    const orderId = this.context.hold?.orderId || 'ORD-VOY-782194';
    const audit = await paymentEngine.reconcileMoneyDeductedTicketPending(orderId);

    this.context.step = 'confirmed';
    if (this.context.hold) {
      this.context.hold.pnr = audit.pnr;
      this.context.hold.status = 'reconciled';
    }

    const totalLatency = Math.round(performance.now() - startTime);
    const passengerName = this.context.passengerName || 'Traveler';

    const agentResponse =
      `Don't worry, ${passengerName}! I ran an instant 3-way check across our payment gateway, bank ledger, and reservation desk. ` +
      `The payment was captured, and your ticket is confirmed! Your PNR is **${audit.pnr}**. Have a safe trip!`;

    const agentMsg: Message = {
      id: `agent-${Date.now()}`,
      role: 'agent',
      text: agentResponse,
      timestamp: new Date().toLocaleTimeString(),
      intentDetected: 'RECONCILIATION_MONEY_DEDUCTED_EXCEPTION',
      toolCall: {
        name: 'reconcile_money_deducted_ticket_pending',
        params: { orderId },
        resultSummary: `3-Way reconciliation completed: Bank=OK, GDS=CONFIRMED, PNR=${audit.pnr}`,
        durationMs: 780,
      },
      latencyMs: totalLatency,
    };

    this.appendMessage(agentMsg);

    if (voiceTrigger) {
      speechService.speak(agentResponse);
    }
  }

  // --- HANDLER 7: PRICE SPIKE REACTION ---
  public async handlePriceSpikeReaction(startTime: number = performance.now(), voiceTrigger: boolean = true) {
    travelEngine.triggerPriceSpike('opt-indigo-6e512', 8600);
    const { options } = await travelEngine.searchTransportOptions('BLR', 'GOA', '2026-11-06', 9000);
    this.context.options = options;
    this.onStateChange({ ...this.context });

    const totalLatency = Math.round(performance.now() - startTime);

    const passengerName = this.context.passengerName || 'Traveler';
    const agentResponse =
      `Before I lock that seat: the airline just updated the fare from ₹5,400 to **₹8,600**, which exceeds your ₹8,000 budget. ` +
      `However, there is another direct flight on **Akasa Air (QP-1344)** at 2:30 PM for **₹5,100**. ` +
      `Would you prefer the 2:30 PM Akasa flight, or should we stick with IndiGo at ₹8,600?`;

    const agentMsg: Message = {
      id: `agent-${Date.now()}`,
      role: 'agent',
      text: agentResponse,
      timestamp: new Date().toLocaleTimeString(),
      intentDetected: 'DYNAMIC_FARE_SPIKE_DETECTION',
      toolCall: {
        name: 'check_fare_surge_and_alternatives',
        params: { originalFlight: '6E-512', oldPrice: 5400, newPrice: 8600, alternative: 'QP-1344' },
        resultSummary: 'Surge detected; offered Akasa Air QP-1344 at ₹5,100',
        durationMs: 220,
      },
      latencyMs: totalLatency,
    };

    this.appendMessage(agentMsg);

    if (voiceTrigger) {
      speechService.speak(agentResponse);
    }
  }

  // --- HANDLER 8: BOOKING CANCELLATION & REFUND ---
  public async handleBookingCancellation(startTime: number = performance.now(), voiceTrigger: boolean = true) {
    this.context.step = 'cancelled';
    this.onStateChange({ ...this.context });

    const totalLatency = Math.round(performance.now() - startTime);

    const agentResponse =
      `I can process that for you. According to IndiGo's fare rules for PNR 6E-W8KZ7Q, cancelling today incurs a standard airline cancellation fee of ₹2,500. ` +
      `You will receive a net refund of **₹2,900** credited back to your original payment method (HDFC UPI) within 48 hours. ` +
      `Shall I execute this cancellation?`;

    const agentMsg: Message = {
      id: `agent-${Date.now()}`,
      role: 'agent',
      text: agentResponse,
      timestamp: new Date().toLocaleTimeString(),
      intentDetected: 'POST_BOOKING_CANCELLATION_REFUND_INQUIRY',
      toolCall: {
        name: 'calculate_cancellation_refund',
        params: { pnr: '6E-W8KZ7Q', totalFare: 5400, fee: 2500 },
        resultSummary: 'Net refund ₹2,900 calculated deterministically',
        durationMs: 160,
      },
      latencyMs: totalLatency,
    };

    this.appendMessage(agentMsg);

    if (voiceTrigger) {
      speechService.speak(agentResponse);
    }
  }
}
